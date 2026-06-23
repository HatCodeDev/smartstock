"""
Tests del AlertService — Fase 2.4 del plan M2.

Escenarios:
- create_tag_desconocida crea alerta y deduplica.
- create_modo_registro_alerta crea alerta y deduplica.
- auto_resolve_modo_registro marca como revisada la alerta.
"""
from datetime import datetime, timezone, timedelta
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerta import Alerta, TipoAlerta
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.evento import Evento, TipoEvento
from app.models.producto import Producto
from app.services.alert_service import alert_service


@pytest_asyncio.fixture()
async def ciclo_activo(db_session: AsyncSession):
    ciclo = Ciclo(estado=EstadoCiclo.ABIERTO, modo_portal=ModoPortal.SALIDA)
    db_session.add(ciclo)
    await db_session.commit()
    await db_session.refresh(ciclo)
    return ciclo


@pytest.mark.asyncio
async def test_create_tag_desconocida(db_session: AsyncSession, ciclo_activo):
    # Primera vez se crea
    creada = await alert_service.create_tag_desconocida("EPC1", ciclo_activo.id, datetime.now(timezone.utc).replace(tzinfo=None), db_session)
    assert creada is True
    
    # Segunda vez se deduplica
    creada_dup = await alert_service.create_tag_desconocida("EPC1", ciclo_activo.id, datetime.now(timezone.utc).replace(tzinfo=None), db_session)
    assert creada_dup is False

    alertas = (await db_session.execute(select(Alerta))).scalars().all()
    assert len(alertas) == 1
    assert alertas[0].epc == "EPC1"


@pytest.mark.asyncio
async def test_modo_registro_alerta(db_session: AsyncSession, ciclo_activo):
    creada = await alert_service.create_modo_registro_alerta(ciclo_activo.id, db_session)
    assert creada is True
    
    creada_dup = await alert_service.create_modo_registro_alerta(ciclo_activo.id, db_session)
    assert creada_dup is False

    alertas = (await db_session.execute(select(Alerta))).scalars().all()
    assert len(alertas) == 1
    
    # Resolver
    await alert_service.auto_resolve_modo_registro(ciclo_activo.id, db_session)
    await db_session.commit()
    
    alerta_resuelta = await db_session.get(Alerta, alertas[0].id)
    assert alerta_resuelta.revisada is True


# El servicio evaluate_tiempo_excedido fue removido por requerimiento de negocio.
