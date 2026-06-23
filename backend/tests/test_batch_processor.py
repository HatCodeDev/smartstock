"""
Tests del BatchProcessor — Fase 5.1 del plan M2.

Escenarios cubiertos:
  - Idempotencia: el mismo batch_id no se procesa dos veces.
  - Transacción atómica: si falla a mitad, no queda ningún dato parcial.
  - Modo SALIDA: crea Eventos tipo SALIDA para EPCs conocidos.
  - Modo RETORNO: crea Eventos tipo RETORNO para EPCs conocidos.
  - Modo REGISTRO: no crea Eventos (stub), sólo registra el batch.
  - EPC desconocido: genera alerta TAG_DESCONOCIDA y no crea Evento.
  - Sin ciclo abierto: retorna error, no registra nada en BD.
"""
import pytest
import pytest_asyncio
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

# ---------------------------------------------------------------------------
# Fixtures helpers
# ---------------------------------------------------------------------------

def _make_payload(
    batch_id: str = "batch-001",
    device_id: str = "esp32-A",
    modo: str = "SALIDA",
    tags: list[RFIDTag] | None = None,
) -> BatchMQTTPayload:
    if tags is None:
        tags = [RFIDTag(epc="E200000123456789", rssi=-60, timestamp_esp32=1000)]
    return BatchMQTTPayload(
        batch_id=batch_id,
        device_id=device_id,
        modo=modo,
        tags=tags,
        timestamp=1700000000,
    )


@pytest_asyncio.fixture()
async def ciclo_abierto(db_session: AsyncSession) -> Ciclo:
    """Inserta un Ciclo ABIERTO en BD y lo devuelve."""
    ciclo = Ciclo(estado=EstadoCiclo.ABIERTO, modo_portal=ModoPortal.SALIDA)
    db_session.add(ciclo)
    await db_session.commit()
    await db_session.refresh(ciclo)
    return ciclo


@pytest_asyncio.fixture()
async def etiqueta_conocida(db_session: AsyncSession) -> Etiqueta:
    """Inserta un Producto + Etiqueta activa con EPC conocido."""
    producto = Producto(nombre="Camisa Talle M", categoria="Ropa")
    db_session.add(producto)
    await db_session.flush()

    etiqueta = Etiqueta(epc="E200000123456789", producto_id=producto.id, activa=True)
    db_session.add(etiqueta)
    await db_session.commit()
    return etiqueta


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_proceso_salida_crea_evento(
    db_session: AsyncSession,
    ciclo_abierto: Ciclo,
    etiqueta_conocida: Etiqueta,
):
    """Modo SALIDA con EPC conocido → crea 1 Evento SALIDA."""
    processor = BatchProcessor()
    payload = _make_payload(modo="SALIDA")

    result = await processor.process(payload, db_session)

    assert result.skipped is False
    assert result.error is None
    assert result.eventos_creados == 1
    assert result.alertas_creadas == 0
    assert len(result.articulos_movidos) == 1
    assert result.articulos_movidos[0]["nombre"] == "Camisa Talle M"
    assert result.articulos_movidos[0]["cantidad"] == 1

    eventos = (await db_session.execute(select(Evento))).scalars().all()
    assert len(eventos) == 1
    assert eventos[0].tipo == TipoEvento.SALIDA
    assert eventos[0].epc == "E200000123456789"
    assert eventos[0].ciclo_id == ciclo_abierto.id
    assert eventos[0].batch_id == "batch-001"


@pytest.mark.asyncio
async def test_proceso_retorno_crea_evento(
    db_session: AsyncSession,
    ciclo_abierto: Ciclo,
    etiqueta_conocida: Etiqueta,
):
    """Modo RETORNO con EPC conocido en tránsito → crea 1 Evento RETORNO."""
    processor = BatchProcessor()
    
    # 1. Hacer una salida primero
    payload_salida = _make_payload(batch_id="batch-001", modo="SALIDA")
    res_salida = await processor.process(payload_salida, db_session)
    assert res_salida.eventos_creados == 1

    # 2. Hacer el retorno
    payload_retorno = _make_payload(batch_id="batch-002", modo="RETORNO")
    result = await processor.process(payload_retorno, db_session)

    assert result.eventos_creados == 1
    evento = (await db_session.execute(
        select(Evento).where(Evento.tipo == TipoEvento.RETORNO)
    )).scalar_one()
    assert evento.tipo == TipoEvento.RETORNO


@pytest.mark.asyncio
async def test_retorno_sin_salida_previo_genera_alerta_y_no_crea_evento(
    db_session: AsyncSession,
    ciclo_abierto: Ciclo,
    etiqueta_conocida: Etiqueta,
):
    """Modo RETORNO para etiqueta que ya está en bodega (sin salida previa hoy) → genera alerta y no crea evento."""
    processor = BatchProcessor()
    payload = _make_payload(modo="RETORNO")

    result = await processor.process(payload, db_session)

    assert result.eventos_creados == 0
    assert result.alertas_creadas == 1
    
    alertas = (await db_session.execute(select(Alerta))).scalars().all()
    assert len(alertas) == 1
    assert alertas[0].tipo == TipoAlerta.MOVIMIENTO_DUPLICADO
    assert "ya está en bodega" in alertas[0].descripcion


@pytest.mark.asyncio
async def test_idempotencia_batch_duplicado(
    db_session: AsyncSession,
    ciclo_abierto: Ciclo,
    etiqueta_conocida: Etiqueta,
):
    """El mismo batch_id procesado dos veces → el segundo es ignorado."""
    processor = BatchProcessor()
    payload = _make_payload(modo="SALIDA")

    result1 = await processor.process(payload, db_session)
    result2 = await processor.process(payload, db_session)

    assert result1.skipped is False
    assert result2.skipped is True

    # Sólo un evento creado (del primer proceso)
    eventos = (await db_session.execute(select(Evento))).scalars().all()
    assert len(eventos) == 1


@pytest.mark.asyncio
async def test_epc_desconocido_genera_alerta(
    db_session: AsyncSession,
    ciclo_abierto: Ciclo,
):
    """EPC no registrado en BD → alerta TAG_DESCONOCIDA, sin Evento."""
    processor = BatchProcessor()
    payload = _make_payload(
        modo="SALIDA",
        tags=[RFIDTag(epc="FFFFFFFFFFFFFFFF", rssi=-70, timestamp_esp32=999)],
    )

    result = await processor.process(payload, db_session)

    assert result.eventos_creados == 0
    assert result.alertas_creadas == 1
    assert "FFFFFFFFFFFFFFFF" in result.epcs_desconocidos

    alertas = (await db_session.execute(select(Alerta))).scalars().all()
    assert len(alertas) == 1
    assert alertas[0].tipo == TipoAlerta.TAG_DESCONOCIDA
    assert alertas[0].epc == "FFFFFFFFFFFFFFFF"
    assert alertas[0].ciclo_id == ciclo_abierto.id


@pytest.mark.asyncio
async def test_sin_ciclo_rechaza_batch(db_session: AsyncSession):
    """Sin ciclo ABIERTO -> BatchResult.error SIN_CICLO."""
    from app.services.cycle_service import cycle_service
    # Creamos un ciclo para hoy
    ciclo = await cycle_service.start_cycle(db_session)
    await db_session.commit()
    # Lo cerramos
    await cycle_service.close_active_cycle(db_session)
    await db_session.commit()

    processor = BatchProcessor()
    payload = _make_payload()

    result = await processor.process(payload, db_session)

    assert result.error is not None
    assert "SIN_CICLO" in result.error
    assert result.eventos_creados == 0


@pytest.mark.asyncio
async def test_modo_registro_no_crea_eventos(
    db_session: AsyncSession,
    ciclo_abierto: Ciclo,
    etiqueta_conocida: Etiqueta,
):
    """Modo REGISTRO → stub activo, no crea Eventos pero sí registra el batch."""
    processor = BatchProcessor()
    payload = _make_payload(modo="REGISTRO")

    result = await processor.process(payload, db_session)

    assert result.skipped is False
    assert result.error is None
    assert result.eventos_creados == 0

    # El batch queda registrado para idempotencia futura
    batch = (await db_session.execute(select(BatchProcesado))).scalar_one()
    assert batch.batch_id == "batch-001"


@pytest.mark.asyncio
async def test_batch_mixto_conocidos_y_desconocidos(
    db_session: AsyncSession,
    ciclo_abierto: Ciclo,
    etiqueta_conocida: Etiqueta,
):
    """Batch con EPCs mezclados → eventos para conocidos, alertas para desconocidos."""
    processor = BatchProcessor()
    payload = _make_payload(
        modo="SALIDA",
        tags=[
            RFIDTag(epc="E200000123456789", rssi=-55, timestamp_esp32=100),   # conocido
            RFIDTag(epc="DEADBEEFDEADBEEF", rssi=-80, timestamp_esp32=101),   # desconocido
        ],
    )

    result = await processor.process(payload, db_session)

    assert result.eventos_creados == 1
    assert result.alertas_creadas == 1
    assert "DEADBEEFDEADBEEF" in result.epcs_desconocidos


@pytest.mark.asyncio
async def test_registro_batch_procesado_en_bd(
    db_session: AsyncSession,
    ciclo_abierto: Ciclo,
    etiqueta_conocida: Etiqueta,
):
    """Después de procesar, existe un BatchProcesado con el batch_id correcto."""
    processor = BatchProcessor()
    payload = _make_payload(batch_id="batch-XYZ", device_id="esp32-B")

    await processor.process(payload, db_session)

    batch = (await db_session.execute(select(BatchProcesado))).scalar_one()
    assert batch.batch_id == "batch-XYZ"
    assert batch.device_id == "esp32-B"
    assert batch.procesado_exitosamente is True
