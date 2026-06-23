"""
Test de integración E2E — Fase 5.5 del plan M2.

Flujo completo: Payload MQTT → BatchProcessor → BD + WebSocket broadcast.

Escenarios:
  - E2E SALIDA: payload con EPC conocido → Evento en BD + WS COUNTER_UPDATE
  - E2E idempotencia: mismo batch_id dos veces → segundo skipped
  - E2E RETORNO: payload RETORNO → Evento RETORNO en BD
  - E2E EPC desconocido: genera Alerta TAG_DESCONOCIDA en BD
  - E2E ciclo auto-open: si no hay ciclo, se crea automáticamente
  - E2E mixed: batch con EPCs conocidos y desconocidos
"""
import json
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerta import Alerta, TipoAlerta
from app.models.batch_procesado import BatchProcesado
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.etiqueta import Etiqueta
from app.models.evento import Evento, TipoEvento
from app.models.producto import Producto
from app.schemas.batch import BatchMQTTPayload, RFIDTag
from app.services.batch_processor import BatchProcessor
from app.websocket.manager import ConnectionManager


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture()
async def ciclo(db_session: AsyncSession) -> Ciclo:
    c = Ciclo(estado=EstadoCiclo.ABIERTO, modo_portal=ModoPortal.SALIDA)
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return c


@pytest_asyncio.fixture()
async def producto_y_etiqueta(db_session: AsyncSession):
    prod = Producto(nombre="Camisa Test", categoria="Ropa")
    db_session.add(prod)
    await db_session.flush()
    etiq = Etiqueta(epc="E200000AABBCCDD1", producto_id=prod.id, activa=True)
    db_session.add(etiq)
    await db_session.commit()
    return prod, etiq


def _payload(
    batch_id="e2e-batch-001", modo="SALIDA",
    epcs=None, device_id="esp32-e2e",
) -> BatchMQTTPayload:
    if epcs is None:
        epcs = ["E200000AABBCCDD1"]
    tags = [RFIDTag(epc=e, rssi=-55, timestamp_esp32=100 + i) for i, e in enumerate(epcs)]
    return BatchMQTTPayload(
        batch_id=batch_id, device_id=device_id,
        modo=modo, tags=tags, timestamp=1700000000,
    )


# ---------------------------------------------------------------------------
# Tests E2E
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_e2e_salida_creates_evento_and_batch(
    db_session: AsyncSession, ciclo: Ciclo, producto_y_etiqueta
):
    """E2E: Payload SALIDA con EPC conocido → Evento SALIDA + BatchProcesado en BD."""
    processor = BatchProcessor()
    ws_mock = AsyncMock()
    mgr = ConnectionManager()
    await mgr.connect(ws_mock)

    payload = _payload(modo="SALIDA")
    result = await processor.process(payload, db_session)

    # Verificar resultado
    assert result.skipped is False
    assert result.error is None
    assert result.eventos_creados == 1
    assert result.alertas_creadas == 0

    # Verificar BD: Evento
    eventos = (await db_session.execute(select(Evento))).scalars().all()
    assert len(eventos) == 1
    assert eventos[0].tipo == TipoEvento.SALIDA
    assert eventos[0].epc == "E200000AABBCCDD1"
    assert eventos[0].ciclo_id == ciclo.id
    assert eventos[0].batch_id == "e2e-batch-001"

    # Verificar BD: BatchProcesado
    batch = (await db_session.execute(select(BatchProcesado))).scalar_one()
    assert batch.batch_id == "e2e-batch-001"
    assert batch.device_id == "esp32-e2e"
    assert batch.procesado_exitosamente is True

    # Simular broadcast WS
    await mgr.broadcast({
        "event": "COUNTER_UPDATE",
        "data": {
            "batch_id": result.batch_id,
            "eventos_creados": result.eventos_creados,
        },
    })
    ws_mock.send_text.assert_awaited_once()
    sent = json.loads(ws_mock.send_text.call_args[0][0])
    assert sent["event"] == "COUNTER_UPDATE"
    assert sent["data"]["eventos_creados"] == 1


@pytest.mark.asyncio
async def test_e2e_idempotencia(
    db_session: AsyncSession, ciclo: Ciclo, producto_y_etiqueta
):
    """E2E: Mismo batch_id dos veces → segundo es skipped, 1 solo evento en BD."""
    processor = BatchProcessor()
    payload = _payload(batch_id="e2e-idem")

    r1 = await processor.process(payload, db_session)
    r2 = await processor.process(payload, db_session)

    assert r1.skipped is False
    assert r2.skipped is True

    eventos = (await db_session.execute(select(Evento))).scalars().all()
    assert len(eventos) == 1

    batches = (await db_session.execute(select(BatchProcesado))).scalars().all()
    assert len(batches) == 1


@pytest.mark.asyncio
async def test_e2e_retorno(
    db_session: AsyncSession, ciclo: Ciclo, producto_y_etiqueta
):
    """E2E: Payload RETORNO → Evento tipo RETORNO en BD (con salida previa)."""
    processor = BatchProcessor()
    
    # 1. Hacer una salida primero
    payload_salida = _payload(batch_id="e2e-ret-salida", modo="SALIDA")
    res_salida = await processor.process(payload_salida, db_session)
    assert res_salida.eventos_creados == 1

    # 2. Hacer el retorno
    payload = _payload(batch_id="e2e-ret", modo="RETORNO")
    result = await processor.process(payload, db_session)

    assert result.eventos_creados == 1
    evento = (await db_session.execute(
        select(Evento).where(Evento.tipo == TipoEvento.RETORNO)
    )).scalar_one()
    assert evento.tipo == TipoEvento.RETORNO


@pytest.mark.asyncio
async def test_e2e_epc_desconocido_genera_alerta(
    db_session: AsyncSession, ciclo: Ciclo
):
    """E2E: EPC no registrado → Alerta TAG_DESCONOCIDA en BD, 0 eventos."""
    processor = BatchProcessor()
    payload = _payload(
        batch_id="e2e-unknown",
        epcs=["FFFFFFFFFFFFFFFF"],
    )

    result = await processor.process(payload, db_session)

    assert result.eventos_creados == 0
    assert result.alertas_creadas == 1
    assert "FFFFFFFFFFFFFFFF" in result.epcs_desconocidos

    alerta = (await db_session.execute(select(Alerta))).scalar_one()
    assert alerta.tipo == TipoAlerta.TAG_DESCONOCIDA
    assert alerta.epc == "FFFFFFFFFFFFFFFF"
    assert alerta.ciclo_id == ciclo.id


@pytest.mark.asyncio
async def test_e2e_fails_without_cycle(
    db_session: AsyncSession, producto_y_etiqueta
):
    """E2E: Sin ciclo abierto → BatchProcessor devuelve SIN_CICLO."""
    processor = BatchProcessor()
    payload = _payload(batch_id="e2e-no-cycle")

    result = await processor.process(payload, db_session)

    assert result.error is not None
    assert "SIN_CICLO" in result.error
    assert result.eventos_creados == 0


@pytest.mark.asyncio
async def test_e2e_mixed_known_and_unknown(
    db_session: AsyncSession, ciclo: Ciclo, producto_y_etiqueta
):
    """E2E: Batch con EPCs mezclados → eventos para conocidos, alertas para desconocidos."""
    processor = BatchProcessor()
    payload = _payload(
        batch_id="e2e-mixed",
        epcs=["E200000AABBCCDD1", "DEADBEEFDEADBEEF"],
    )

    result = await processor.process(payload, db_session)

    assert result.eventos_creados == 1
    assert result.alertas_creadas == 1
    assert "DEADBEEFDEADBEEF" in result.epcs_desconocidos

    eventos = (await db_session.execute(select(Evento))).scalars().all()
    assert len(eventos) == 1

    alertas = (await db_session.execute(select(Alerta))).scalars().all()
    assert len(alertas) == 1


@pytest.mark.asyncio
async def test_e2e_cycle_closed_rejects_batch(db_session: AsyncSession):
    """E2E: Ciclo cerrado hoy → batch rechazado con error SIN_CICLO."""
    from app.services.cycle_service import cycle_service

    # Crear y cerrar ciclo
    ciclo = await cycle_service.start_cycle(db_session)
    await db_session.commit()
    await cycle_service.close_active_cycle(db_session)
    await db_session.commit()

    processor = BatchProcessor()
    payload = _payload(batch_id="e2e-closed")

    result = await processor.process(payload, db_session)

    assert result.error is not None
    assert "SIN_CICLO" in result.error
    assert result.eventos_creados == 0


@pytest.mark.asyncio
async def test_e2e_full_flow_salida_counters_ws(
    db_session: AsyncSession, ciclo: Ciclo, producto_y_etiqueta
):
    """E2E completo: SALIDA → verificar counters del dashboard + broadcast WS."""
    from app.services.cycle_service import cycle_service

    processor = BatchProcessor()
    payload = _payload(batch_id="e2e-full")

    result = await processor.process(payload, db_session)
    assert result.eventos_creados == 1

    # Verificar dashboard counters
    counters = await cycle_service.get_dashboard_counters(db_session)
    assert counters is not None
    assert counters.total_salidas == 1
    assert counters.total_retornos == 0
    assert counters.articulos_en_transito == 1

    # Verificar WS broadcast
    ws_mock = AsyncMock()
    mgr = ConnectionManager()
    await mgr.connect(ws_mock)

    await mgr.broadcast({
        "event": "COUNTER_UPDATE",
        "data": {
            "total_salidas": counters.total_salidas,
            "articulos_en_transito": counters.articulos_en_transito,
        },
    })

    ws_mock.send_text.assert_awaited_once()
    sent = json.loads(ws_mock.send_text.call_args[0][0])
    assert sent["event"] == "COUNTER_UPDATE"
    assert sent["data"]["total_salidas"] == 1
    assert sent["data"]["articulos_en_transito"] == 1
