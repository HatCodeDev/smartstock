"""
Tests del CycleService — Fase 2.2 del plan M2.

Escenarios cubiertos:
  - Creación de ciclo bajo demanda al consultar el activo por primera vez.
  - RN-07: Intento de crear ciclo cuando ya hay uno cerrado hoy falla (CICLO_CERRADO).
  - Cálculo de dashboard counters correcto (Salidas, Retornos, Tránsito, Alertas).
  - Cierre manual genera summary y cambia estado a CERRADO.
  - Consulta de último summary retorna los datos del ciclo cerrado más reciente.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from app.config import settings
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerta import Alerta, TipoAlerta
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.evento import Evento, TipoEvento
from app.models.etiqueta import Etiqueta
from app.models.producto import Producto
from app.services.cycle_service import cycle_service
import uuid
from datetime import timedelta


@pytest.mark.asyncio
async def test_start_cycle_crea_si_no_existe(db_session: AsyncSession):
    # No hay ciclos
    ciclos_antes = (await db_session.execute(select(Ciclo))).scalars().all()
    assert len(ciclos_antes) == 0

    ciclo = await cycle_service.start_cycle(db_session)
    await db_session.commit()

    assert ciclo is not None
    assert ciclo.estado == EstadoCiclo.ABIERTO
    assert ciclo.fecha == datetime.now(ZoneInfo(settings.TIMEZONE)).date()

    ciclos_despues = (await db_session.execute(select(Ciclo))).scalars().all()
    assert len(ciclos_despues) == 1


@pytest.mark.asyncio
async def test_start_cycle_rechaza_si_abierto(db_session: AsyncSession):
    await cycle_service.start_cycle(db_session)
    await db_session.commit()
    
    with pytest.raises(ValueError, match="CICLO_ABIERTO"):
        await cycle_service.start_cycle(db_session)


@pytest.mark.asyncio
async def test_get_active_cycle_or_fail_rechaza_si_no_hay(db_session: AsyncSession):
    with pytest.raises(ValueError, match="SIN_CICLO"):
        await cycle_service.get_active_cycle_or_fail(db_session)


@pytest.mark.asyncio
async def test_dashboard_counters(db_session: AsyncSession):
    ciclo = await cycle_service.start_cycle(db_session)
    
    # Agregar 3 salidas, 1 retorno, 2 alertas (1 revisada)
    ev1 = Evento(epc="1", ciclo_id=ciclo.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1)
    ev2 = Evento(epc="2", ciclo_id=ciclo.id, tipo=TipoEvento.SALIDA, timestamp_esp32=2)
    ev3 = Evento(epc="3", ciclo_id=ciclo.id, tipo=TipoEvento.SALIDA, timestamp_esp32=3)
    ev4 = Evento(epc="1", ciclo_id=ciclo.id, tipo=TipoEvento.RETORNO, timestamp_esp32=4)

    alerta1 = Alerta(tipo=TipoAlerta.TAG_DESCONOCIDA, descripcion="A", epc="A", ciclo_id=ciclo.id, revisada=False)
    alerta2 = Alerta(tipo=TipoAlerta.TAG_DESCONOCIDA, descripcion="B", epc="B", ciclo_id=ciclo.id, revisada=True)

    db_session.add_all([ev1, ev2, ev3, ev4, alerta1, alerta2])
    await db_session.commit()

    counters = await cycle_service.get_dashboard_counters(db_session)
    assert counters is not None
    assert counters.total_salidas == 3
    assert counters.total_retornos == 1
    assert counters.articulos_en_transito == 2
    assert counters.alertas_activas == 1


@pytest.mark.asyncio
async def test_close_active_cycle(db_session: AsyncSession):
    ciclo = await cycle_service.start_cycle(db_session)
    
    # 2 salidas, 1 retorno, 1 alerta
    ev1 = Evento(epc="A", ciclo_id=ciclo.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1)
    ev2 = Evento(epc="B", ciclo_id=ciclo.id, tipo=TipoEvento.SALIDA, timestamp_esp32=2)
    ev3 = Evento(epc="A", ciclo_id=ciclo.id, tipo=TipoEvento.RETORNO, timestamp_esp32=3)
    alerta = Alerta(tipo=TipoAlerta.TAG_DESCONOCIDA, descripcion="Exc", epc="B", ciclo_id=ciclo.id)
    
    db_session.add_all([ev1, ev2, ev3, alerta])
    await db_session.commit()

    summary = await cycle_service.close_active_cycle(db_session, automatico=True)
    await db_session.commit()

    assert summary.salidos == 2
    assert summary.retornados == 1
    assert summary.vendidos_final == 1
    assert summary.cierre_automatico is True
    assert len(summary.alertas) == 1
    
    await db_session.refresh(ciclo)
    assert ciclo.estado == EstadoCiclo.CERRADO
    assert ciclo.cerrado_en is not None


@pytest.mark.asyncio
async def test_close_active_cycle_deducts_stock(db_session: AsyncSession):
    # Crear producto y etiquetas
    prod_id = uuid.uuid4()
    prod = Producto(id=prod_id, nombre="Test", categoria="Test", cantidad_inicial=10, activo=True)
    et1 = Etiqueta(epc="E1", producto_id=prod_id, activa=True)
    et2 = Etiqueta(epc="E2", producto_id=prod_id, activa=True)
    et3 = Etiqueta(epc="E3", producto_id=prod_id, activa=True)
    
    db_session.add_all([prod, et1, et2, et3])
    await db_session.commit()

    ciclo = await cycle_service.start_cycle(db_session)
    
    # E1: SALIDA (Se debe descontar)
    # E2: SALIDA y luego RETORNO (No se debe descontar)
    # E3: Sin eventos (No se debe descontar)
    ev1 = Evento(epc="E1", ciclo_id=ciclo.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1)
    ev2 = Evento(epc="E2", ciclo_id=ciclo.id, tipo=TipoEvento.SALIDA, timestamp_esp32=2)
    ev3 = Evento(epc="E2", ciclo_id=ciclo.id, tipo=TipoEvento.RETORNO, timestamp_esp32=3)
    db_session.add_all([ev1, ev2, ev3])
    await db_session.commit()

    await cycle_service.close_active_cycle(db_session)
    await db_session.commit()

    await db_session.refresh(prod)
    await db_session.refresh(et1)
    await db_session.refresh(et2)

    # Solo E1 debió ser marcado inactivo y descontado del stock
    assert et1.activa is False
    assert et2.activa is True
    assert prod.cantidad_inicial == 9


@pytest.mark.asyncio
async def test_lazy_close_past_cycle(db_session: AsyncSession):
    # Forzar un ciclo abierto en el pasado
    ayer = datetime.now(ZoneInfo(settings.TIMEZONE)).date() - timedelta(days=1)
    ciclo_ayer = Ciclo(estado=EstadoCiclo.ABIERTO, fecha=ayer, modo_portal=ModoPortal.APAGADO)
    db_session.add(ciclo_ayer)
    await db_session.commit()

    # Agregar evento de salida ayer para validar que se cerró bien
    prod = Producto(id=uuid.uuid4(), nombre="A", categoria="A", cantidad_inicial=5, activo=True)
    et = Etiqueta(epc="Z1", producto_id=prod.id, activa=True)
    ev = Evento(epc="Z1", ciclo_id=ciclo_ayer.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1)
    db_session.add_all([prod, et, ev])
    await db_session.commit()

    # Llamar get_active_cycle_or_fail HOY
    with pytest.raises(ValueError, match="CICLO_CERRADO"):
        await cycle_service.get_active_cycle_or_fail(db_session)
    await db_session.commit()

    await db_session.refresh(ciclo_ayer)
    assert ciclo_ayer.estado == EstadoCiclo.CERRADO
    assert ciclo_ayer.cierre_automatico is True

    await db_session.refresh(prod)
    assert prod.cantidad_inicial == 4  # El lazy close descontó stock!


@pytest.mark.asyncio
async def test_get_cycle_status(db_session: AsyncSession):
    # Sin ciclo
    status_none = await cycle_service.get_cycle_status(db_session)
    assert status_none.estado == "SIN_CICLO"
    assert status_none.en_transito == 0

    # Ciclo abierto
    ciclo = await cycle_service.start_cycle(db_session)
    ev1 = Evento(epc="1", ciclo_id=ciclo.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1)
    db_session.add(ev1)
    await db_session.commit()

    status_abierto = await cycle_service.get_cycle_status(db_session)
    assert status_abierto.estado == "ABIERTO"
    assert status_abierto.en_transito == 1

    # Ciclo cerrado
    await cycle_service.close_active_cycle(db_session)
    await db_session.commit()

    status_cerrado = await cycle_service.get_cycle_status(db_session)
    assert status_cerrado.estado == "CERRADO"
    assert status_cerrado.en_transito == 0


@pytest.mark.asyncio
async def test_get_last_closed_cycle_summary(db_session: AsyncSession):
    ciclo = await cycle_service.start_cycle(db_session)
    ev = Evento(epc="A", ciclo_id=ciclo.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1)
    db_session.add(ev)
    await db_session.commit()
    
    await cycle_service.close_active_cycle(db_session)
    await db_session.commit()

    # Checar
    summary = await cycle_service.get_last_closed_cycle_summary(db_session)
    assert summary is not None
    assert summary.salidos == 1
    assert summary.retornados == 0
    assert summary.cierre_automatico is False
