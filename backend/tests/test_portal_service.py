"""
Tests del PortalService — Fase 2.5 del plan M2.

Escenarios:
- change_mode a REGISTRO crea alerta MODO_REGISTRO_ACTIVO, publica MQTT y cambia el modo del ciclo.
- change_mode de REGISTRO a SALIDA resuelve la alerta, publica MQTT y cambia modo.
- change_mode sin ciclo activo crea uno nuevo (vía CycleService).
- change_mode si ya cerró el ciclo del día falla y retorna False.
- MQTT errors no bloquean la persistencia en base de datos.
"""
import json
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerta import Alerta, TipoAlerta
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.services.portal_service import PortalService
from app.services.cycle_service import cycle_service


class MockPublisher:
    def __init__(self):
        self.published = []
        self.should_fail = False

    async def publish(self, topic: str, payload: str, qos: int = 1) -> None:
        if self.should_fail:
            raise ConnectionError("Broker unreachable")
        self.published.append((topic, payload))


@pytest_asyncio.fixture()
async def mock_publisher():
    return MockPublisher()


@pytest_asyncio.fixture()
async def portal_srv(mock_publisher):
    return PortalService(mqtt_publisher=mock_publisher)


@pytest.mark.asyncio
async def test_change_mode_fails_if_no_cycle(db_session: AsyncSession, portal_srv, mock_publisher):
    # No hay ciclos
    success = await portal_srv.change_mode(ModoPortal.RETORNO, "esp32-1", db_session)
    await db_session.commit()
    
    assert success is False
    assert len(mock_publisher.published) == 0


@pytest.mark.asyncio
async def test_change_mode_to_registro_creates_alert(db_session: AsyncSession, portal_srv):
    await cycle_service.start_cycle(db_session)
    await db_session.commit()

    await portal_srv.change_mode(ModoPortal.REGISTRO, "esp32-1", db_session)
    await db_session.commit()
    
    alertas = (await db_session.execute(select(Alerta))).scalars().all()
    assert len(alertas) == 1
    assert alertas[0].tipo == TipoAlerta.MODO_REGISTRO_ACTIVO
    assert alertas[0].revisada is False


@pytest.mark.asyncio
async def test_change_mode_from_registro_resolves_alert(db_session: AsyncSession, portal_srv):
    await cycle_service.start_cycle(db_session)
    await db_session.commit()

    # Primero ir a REGISTRO
    await portal_srv.change_mode(ModoPortal.REGISTRO, "esp32-1", db_session)
    await db_session.commit()
    
    # Luego a SALIDA
    await portal_srv.change_mode(ModoPortal.SALIDA, "esp32-1", db_session)
    await db_session.commit()
    
    alertas = (await db_session.execute(select(Alerta))).scalars().all()
    assert len(alertas) == 1
    assert alertas[0].tipo == TipoAlerta.MODO_REGISTRO_ACTIVO
    assert alertas[0].revisada is True


@pytest.mark.asyncio
async def test_change_mode_fails_if_cycle_closed(db_session: AsyncSession, portal_srv):
    # RN-07: Si el ciclo del día está CERRADO, no se pueden hacer movimientos ni abrir ciclo
    ciclo = await cycle_service.start_cycle(db_session)
    await db_session.commit()
    await cycle_service.close_active_cycle(db_session)
    await db_session.commit()
    
    success = await portal_srv.change_mode(ModoPortal.RETORNO, "esp32-1", db_session)
    assert success is False


@pytest.mark.asyncio
async def test_change_mode_mqtt_failure_still_updates_db(db_session: AsyncSession, portal_srv, mock_publisher):
    await cycle_service.start_cycle(db_session)
    await db_session.commit()

    mock_publisher.should_fail = True
    
    success = await portal_srv.change_mode(ModoPortal.REGISTRO, "esp32-1", db_session)
    await db_session.commit()
    
    # Aunque el broker falle, el servicio lo maneja gracefully
    assert success is True
    ciclo = await cycle_service.get_active_cycle(db_session)
    assert ciclo.modo_portal == ModoPortal.REGISTRO
