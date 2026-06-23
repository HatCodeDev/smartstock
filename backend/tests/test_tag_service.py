"""
Tests del TagService — Fase 2.3 del plan M2.

Escenarios:
- Iniciar sesión (start_registration_session) asigna session en memoria.
- Procesar batch REGISTRO con etiqueta nueva → estado "new".
- Procesar batch REGISTRO con etiqueta existente mismo producto → estado "duplicate".
- Procesar batch REGISTRO con etiqueta existente otro producto → estado "conflict" e ignora.
- Resolver conflicto (reassign_all) mueve producto, actualiza cantidad y limpia sesión.
- Resolver conflicto (cancel) limpia sesión sin hacer cambios.
- Unlink de etiqueta funciona correctamente.
"""
import uuid
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.etiqueta import Etiqueta
from app.models.producto import Producto
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.evento import Evento, TipoEvento
from app.schemas.batch import BatchMQTTPayload, RFIDTag
from app.schemas.tags import ScanBatchStartRequest, ResolveConflictsRequest, ConflictDecision
from app.services.tag_service import TagService


@pytest_asyncio.fixture()
async def tag_service_instance():
    # Retornamos una nueva instancia en lugar del singleton global para aislar tests
    return TagService()


@pytest_asyncio.fixture()
async def productos_test(db_session: AsyncSession):
    p1 = Producto(nombre="Producto A", categoria="cat A", cantidad_inicial=10)
    p2 = Producto(nombre="Producto B", categoria="cat B", cantidad_inicial=5)
    db_session.add_all([p1, p2])
    await db_session.commit()
    await db_session.refresh(p1)
    await db_session.refresh(p2)
    return p1, p2


@pytest.mark.asyncio
async def test_start_session(db_session: AsyncSession, productos_test, tag_service_instance):
    p1, _ = productos_test
    req = ScanBatchStartRequest(product_id=p1.id)
    
    resp = await tag_service_instance.start_registration_session(req, db_session)
    
    assert resp.session_id is not None
    assert resp.product_name == "Producto A"
    
    sess = tag_service_instance.get_active_session()
    assert sess is not None
    assert sess.product_id == p1.id


@pytest.mark.asyncio
async def test_batch_registro_new_duplicate_conflict(db_session: AsyncSession, productos_test, tag_service_instance):
    p1, p2 = productos_test
    
    # Pre-crear etiquetas
    e_dup = Etiqueta(epc="DUP", producto_id=p1.id, activa=True)
    e_conf = Etiqueta(epc="CONF", producto_id=p2.id, activa=True)
    db_session.add_all([e_dup, e_conf])
    await db_session.commit()

    # Iniciar sesión para p1
    req = ScanBatchStartRequest(product_id=p1.id)
    await tag_service_instance.start_registration_session(req, db_session)
    
    payload = BatchMQTTPayload(
        batch_id="b1",
        device_id="d1",
        modo="REGISTRO",
        timestamp=100,
        tags=[
            RFIDTag(epc="NEW", timestamp_esp32=1),
            RFIDTag(epc="DUP", timestamp_esp32=2),
            RFIDTag(epc="CONF", timestamp_esp32=3)
        ]
    )

    resultados = await tag_service_instance.handle_registration_batch(payload, db_session)
    await db_session.commit()

    assert len(resultados) == 3
    res_dict = {r.epc: r.status for r in resultados}
    assert res_dict["NEW"] == "new"
    assert res_dict["DUP"] == "duplicate"
    assert res_dict["CONF"] == "conflict"
    
    sess = tag_service_instance.get_active_session()
    assert "CONF" in sess.conflicts
    assert "NEW" not in sess.conflicts

    # Comprobar base de datos
    db_tags = (await db_session.execute(select(Etiqueta))).scalars().all()
    db_map = {t.epc: t.producto_id for t in db_tags}
    
    assert db_map["NEW"] == p1.id
    assert db_map["DUP"] == p1.id
    assert db_map["CONF"] == p2.id  # Aún pertenece a p2


@pytest.mark.asyncio
async def test_resolve_conflicts_reassign(db_session: AsyncSession, productos_test, tag_service_instance):
    p1, p2 = productos_test
    
    e_conf = Etiqueta(epc="CONF", producto_id=p2.id, activa=True)
    db_session.add(e_conf)
    await db_session.commit()

    req = ScanBatchStartRequest(product_id=p1.id)
    resp = await tag_service_instance.start_registration_session(req, db_session)
    
    tag_service_instance.get_active_session().conflicts.add("CONF")
    
    resolve_req = ResolveConflictsRequest(
        session_id=resp.session_id,
        action="reassign_all",
        decisions=[
            ConflictDecision(epc="CONF", deduct_from_original=True)
        ]
    )
    
    await tag_service_instance.resolve_conflicts(resolve_req, db_session)
    await db_session.commit()

    # Comprobar reasignación
    e_db = await db_session.get(Etiqueta, "CONF")
    assert e_db.producto_id == p1.id

    # Comprobar deducción de stock en el producto original
    await db_session.refresh(p2)
    assert p2.cantidad_inicial == 4  # Era 5

    # Sesión debe estar limpia
    assert tag_service_instance.get_active_session() is None


@pytest.mark.asyncio
async def test_resolve_conflicts_cancel(db_session: AsyncSession, productos_test, tag_service_instance):
    p1, p2 = productos_test
    
    req = ScanBatchStartRequest(product_id=p1.id)
    resp = await tag_service_instance.start_registration_session(req, db_session)
    
    resolve_req = ResolveConflictsRequest(
        session_id=resp.session_id,
        action="cancel",
        decisions=[]
    )
    
    await tag_service_instance.resolve_conflicts(resolve_req, db_session)
    
    assert tag_service_instance.get_active_session() is None


@pytest.mark.asyncio
async def test_unlink_tag(db_session: AsyncSession, productos_test, tag_service_instance):
    p1, _ = productos_test
    e = Etiqueta(epc="T1", producto_id=p1.id, activa=True)
    db_session.add(e)
    await db_session.commit()

    await tag_service_instance.unlink_tag("T1", db_session)
    await db_session.commit()
    
    e_db = await db_session.get(Etiqueta, "T1")
    assert e_db.producto_id is None
    assert e_db.activa is False

@pytest.mark.asyncio
async def test_derived_states_and_reassignment(db_session: AsyncSession, productos_test, tag_service_instance):
    p1, p2 = productos_test
    
    # Create tags
    tags = [
        Etiqueta(epc="REASSIGNABLE", producto_id=p2.id, activa=True),
        Etiqueta(epc="RECYCLABLE", producto_id=p2.id, activa=True),
        Etiqueta(epc="TRANSIT", producto_id=p2.id, activa=True),
        Etiqueta(epc="RETURNED", producto_id=p2.id, activa=True)
    ]
    db_session.add_all(tags)
    
    # Create cycles
    c_cerrado = Ciclo(estado=EstadoCiclo.CERRADO, modo_portal=ModoPortal.SALIDA)
    c_abierto = Ciclo(estado=EstadoCiclo.ABIERTO, modo_portal=ModoPortal.SALIDA)
    db_session.add_all([c_cerrado, c_abierto])
    await db_session.flush()

    # Create events to set states
    ev_recyclable = Evento(epc="RECYCLABLE", ciclo_id=c_cerrado.id, tipo=TipoEvento.SALIDA, producto_id=p2.id, timestamp_esp32=1)
    ev_transit = Evento(epc="TRANSIT", ciclo_id=c_abierto.id, tipo=TipoEvento.SALIDA, producto_id=p2.id, timestamp_esp32=2)
    ev_returned = Evento(epc="RETURNED", ciclo_id=c_abierto.id, tipo=TipoEvento.RETORNO, producto_id=p2.id, timestamp_esp32=3)
    db_session.add_all([ev_recyclable, ev_transit, ev_returned])
    await db_session.commit()

    # Start session for p1
    req = ScanBatchStartRequest(product_id=p1.id)
    resp = await tag_service_instance.start_registration_session(req, db_session)
    
    # Handle batch to generate conflicts
    payload = BatchMQTTPayload(
        batch_id="b_test", device_id="d1", modo="REGISTRO", timestamp=100,
        tags=[
            RFIDTag(epc="REASSIGNABLE", timestamp_esp32=1),
            RFIDTag(epc="RECYCLABLE", timestamp_esp32=2),
            RFIDTag(epc="TRANSIT", timestamp_esp32=3),
            RFIDTag(epc="RETURNED", timestamp_esp32=4)
        ]
    )
    
    # Should calculate derived states
    resultados = await tag_service_instance.handle_registration_batch(payload, db_session)
    res_map = {r.epc: r.derived_state for r in resultados}
    
    assert res_map.get("REASSIGNABLE") == "reassignable"
    assert res_map.get("RECYCLABLE") == "recyclable"
    assert res_map.get("TRANSIT") == "blocked_transit"
    assert res_map.get("RETURNED") == "blocked_return"
    
    # Try resolving conflicts
    tag_service_instance.get_active_session().conflicts.update(res_map.keys())
    
    resolve_req = ResolveConflictsRequest(
        session_id=resp.session_id,
        action="reassign_all",
        decisions=[
            ConflictDecision(epc="REASSIGNABLE", deduct_from_original=True),
            ConflictDecision(epc="RECYCLABLE", deduct_from_original=False),
        ]
    )
    
    await tag_service_instance.resolve_conflicts(resolve_req, db_session)
    await db_session.commit()
    
    # Assert REASSIGNABLE stock deducted and product changed
    e_reass = await db_session.get(Etiqueta, "REASSIGNABLE")
    assert e_reass.producto_id == p1.id
    
    e_recyclable = await db_session.get(Etiqueta, "RECYCLABLE")
    assert e_recyclable.producto_id == p1.id
    
    await db_session.refresh(p2)
    # Original stock was 5. REASSIGNABLE deducts 1 -> 4. RECYCLABLE does not deduct.
    assert p2.cantidad_inicial == 4
    
    # Test blocked tags cannot be resolved
    req2 = ScanBatchStartRequest(product_id=p1.id)
    resp2 = await tag_service_instance.start_registration_session(req2, db_session)
    tag_service_instance.get_active_session().conflicts.add("TRANSIT")
    
    resolve_req_blocked = ResolveConflictsRequest(
        session_id=resp2.session_id,
        action="reassign_all",
        decisions=[ConflictDecision(epc="TRANSIT", deduct_from_original=False)]
    )
    
    with pytest.raises(ValueError, match="no pueden ser reasignadas"):
        await tag_service_instance.resolve_conflicts(resolve_req_blocked, db_session)


@pytest.mark.asyncio
async def test_batch_registro_reactivate_inactive_tag(db_session: AsyncSession, productos_test, tag_service_instance):
    p1, _ = productos_test
    
    # Pre-crear etiqueta inactiva del mismo producto
    e_inactive = Etiqueta(epc="INACTIVE_TAG", producto_id=p1.id, activa=False)
    db_session.add(e_inactive)
    await db_session.commit()

    # Iniciar sesión para p1
    req = ScanBatchStartRequest(product_id=p1.id)
    await tag_service_instance.start_registration_session(req, db_session)
    
    payload = BatchMQTTPayload(
        batch_id="b_reactivate",
        device_id="d1",
        modo="REGISTRO",
        timestamp=100,
        tags=[
            RFIDTag(epc="INACTIVE_TAG", timestamp_esp32=1)
        ]
    )

    resultados = await tag_service_instance.handle_registration_batch(payload, db_session)
    await db_session.commit()

    assert len(resultados) == 1
    assert resultados[0].epc == "INACTIVE_TAG"
    assert resultados[0].status == "new"
    assert resultados[0].message == "Reactivada"

    # Verificar BD
    await db_session.refresh(e_inactive)
    assert e_inactive.activa is True
    await db_session.refresh(p1)
    assert p1.cantidad_inicial == 11  # Era 10, incrementado en 1


@pytest.mark.asyncio
async def test_resolve_conflicts_reassign_sets_activa_true(db_session: AsyncSession, productos_test, tag_service_instance):
    p1, p2 = productos_test
    
    # Pre-crear etiqueta inactiva en el producto original
    e_conf = Etiqueta(epc="CONF_INACTIVE", producto_id=p2.id, activa=False)
    db_session.add(e_conf)
    await db_session.commit()

    req = ScanBatchStartRequest(product_id=p1.id)
    resp = await tag_service_instance.start_registration_session(req, db_session)
    
    tag_service_instance.get_active_session().conflicts.add("CONF_INACTIVE")
    
    resolve_req = ResolveConflictsRequest(
        session_id=resp.session_id,
        action="reassign_all",
        decisions=[
            ConflictDecision(epc="CONF_INACTIVE", deduct_from_original=True)
        ]
    )
    
    await tag_service_instance.resolve_conflicts(resolve_req, db_session)
    await db_session.commit()

    # Comprobar reasignación y activación
    await db_session.refresh(e_conf)
    assert e_conf.producto_id == p1.id
    assert e_conf.activa is True

    # Comprobar deducción de stock en el producto original (p2)
    await db_session.refresh(p2)
    assert p2.cantidad_inicial == 4  # Era 5
