"""
MQTT message handlers — Procesamiento de payloads RFID.

Recibe bytes crudos del broker, parsea JSON, delega al BatchProcessor,
y emite eventos WebSocket con los resultados.
"""

import asyncio
import json
import logging

from app.database import async_session_maker
from app.mqtt.publisher import publish_command
from app.schemas.batch import BatchMQTTPayload
from app.services.batch_processor import BatchResult, batch_processor
from app.services.cycle_service import cycle_service
from app.websocket.manager import manager

logger = logging.getLogger(__name__)


def _determine_buzzer_sound(result: BatchResult) -> str:
    """
    Decide qué patrn de buzzer publicar al ESP32 basándose en el resultado del batch.
    Retorna una de: 'SALIDA_OK', 'RETORNO_OK', 'REGISTRO_NUEVA', 'ERROR', 'NONE'.
    """
    modo = result.modo.upper()

    if modo == "REGISTRO":
        if not result.registro_resultados:
            return "NONE"
        statuses = [r.status for r in result.registro_resultados]
        if "conflict" in statuses:
            return "ERROR"
        if "new" in statuses:
            return "REGISTRO_NUEVA"
        return "NONE"  # Solo duplicados

    # SALIDA / RETORNO
    if result.epcs_desconocidos:
        return "ERROR"
    if result.eventos_creados > 0:
        return "SALIDA_OK" if modo == "SALIDA" else "RETORNO_OK"
    return "NONE"  # Solo movimientos duplicados, sin eventos nuevos


async def _publish_buzzer_batch(device_id: str, buzzer: str) -> None:
    """Publica BUZZER_BATCH al ESP32. Fire-and-forget — no propaga errores."""
    try:
        await publish_command(
            device_id=device_id,
            command="BUZZER_BATCH",
            payload={"buzzer": buzzer},
        )
    except Exception as exc:
        logger.warning("No se pudo publicar BUZZER_BATCH a %s: %s", device_id, exc)



async def handle_batch(topic: str, payload: bytes) -> None:
    """Procesa un batch RFID recibido por MQTT.

    Pipeline: Parse JSON → BatchProcessor → WS broadcast.
    """
    # 1. Parsear payload
    try:
        raw = json.loads(payload)
        batch_payload = BatchMQTTPayload(**raw)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("MQTT payload inválido en topic=%s: %s", topic, exc)
        return

    logger.info(
        "MQTT batch recibido | topic=%s | batch_id=%s | tags=%d",
        topic,
        batch_payload.batch_id,
        len(batch_payload.tags),
    )

    # 2. Procesar en una sesión de BD propia
    async with async_session_maker() as db:
        result = await batch_processor.process(batch_payload, db)

    # 3. Broadcast por WebSocket
    if result.skipped:
        logger.debug("batch_id=%s ya procesado, sin broadcast WS.", result.batch_id)
        return

    if result.error:
        await manager.broadcast({
            "type": "BATCH_ERROR",
            "payload": {
                "batch_id": result.batch_id,
                "error": result.error,
            },
        })
        if "CICLO_CERRADO" in str(result.error) or "SIN_CICLO" in str(result.error):
            asyncio.create_task(_publish_buzzer_batch(batch_payload.device_id, "BUZZ_CYCLE_CLOSED"))
        return

    # Broadcast exitoso → COUNTER_UPDATE o REGISTRATION_UPDATE
    msg_type = "REGISTRATION_UPDATE" if result.modo == "REGISTRO" else "COUNTER_UPDATE"
    
    await manager.broadcast({
        "type": msg_type,
        "payload": {
            "batch_id": result.batch_id,
            "modo": result.modo,
            "eventos_creados": result.eventos_creados,
            "alertas_creadas": result.alertas_creadas,
            "epcs_desconocidos": result.epcs_desconocidos,
            "articulos_movidos": result.articulos_movidos,
            "registro_resultados": [r.model_dump() for r in result.registro_resultados] if hasattr(result, "registro_resultados") else [],
            "counters": result.contadores_actuales
        },
    })

    # Broadcast individual para cada alerta generada
    for alerta_info in getattr(result, 'alertas_generadas', []):
        now_ms = int(time.time() * 1000)
        await manager.broadcast({
            "type": "ALERT",
            "payload": {
                "id": now_ms,
                "type": alerta_info["type"],
                "message": alerta_info["message"],
                "timestamp": now_ms
            }
        })

    # Publicar BUZZER_BATCH al ESP32 (fire-and-forget, no bloquea el handler)
    buzzer_sound = _determine_buzzer_sound(result)
    asyncio.create_task(
        _publish_buzzer_batch(batch_payload.device_id, buzzer_sound)
    )


async def handle_portal_ack(topic: str, payload: bytes) -> None:
    """Procesa el ACK de un comando o cambio de modo físico del ESP32.
    
    Actualiza la base de datos y notifica al frontend.
    """
    try:
        data = json.loads(payload)
        command = data.get("command")
        
        if command == "SET_MODE":
            new_mode = data.get("mode")
            logger.info("MQTT portal ack | topic=%s | new_mode=%s", topic, new_mode)
            
            async with async_session_maker() as db:
                ciclo = await cycle_service.get_active_cycle(db)
                if ciclo and ciclo.modo_portal.value != new_mode:
                    ciclo.modo_portal = new_mode
                    await db.commit()
                    logger.info("Modo de ciclo actualizado en BD vía MQTT ACK.")
            
            # Notificar al Front
            await manager.broadcast({
                "type": "PORTAL_MODE_CHANGED",
                "payload": new_mode
            })
            
            # Marcar el portal como activo
            device_id = topic.split("/")[1]
            _portal_last_seen[device_id] = time.time()
            await manager.broadcast({
                "type": "PORTAL_STATUS",
                "payload": {"status": "online", "device_id": device_id}
            })

    except Exception as exc:
        logger.error("Error procesando portal ack: %s", exc)


import time
_portal_last_seen: dict[str, float] = {}

async def handle_portal_status_mqtt(topic: str, payload: bytes) -> None:
    """Procesa el LWT (status) o heartbeat del ESP32."""
    try:
        data = json.loads(payload)
        status = data.get("status")
        device_id = data.get("device_id")
        if not device_id:
            device_id = topic.split("/")[1]
            
        if status in ("online", "offline"):
            if status == "online":
                _portal_last_seen[device_id] = time.time()
            elif status == "offline":
                _portal_last_seen.pop(device_id, None)

            logger.info("MQTT portal status | device_id=%s | status=%s", device_id, status)
            await manager.broadcast({
                "type": "PORTAL_STATUS",
                "payload": {"status": status, "device_id": device_id}
            })
        elif status == "heartbeat":
            _portal_last_seen[device_id] = time.time()
            await manager.broadcast({
                "type": "PORTAL_STATUS",
                "payload": {"status": "online", "device_id": device_id}
            })
    except Exception as exc:
        logger.error("Error procesando portal status: %s", exc)
