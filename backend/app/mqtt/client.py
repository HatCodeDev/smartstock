"""
MQTT subscriber client — SmartStock
Se conecta a HiveMQ Cloud y escucha smartstock/+/events.
Todas las credenciales vienen exclusivamente de Settings (variables de entorno / .env).

IMPLEMENTACIÓN:
  Usa paho-mqtt directamente con loop_start() (threading nativo de paho).
  Este approach evita el uso de add_reader/add_writer del event loop de asyncio,
  que es incompatible con Python 3.14 en Windows (IocpProactor no los implementa,
  y WindowsSelectorEventLoopPolicy está deprecada en 3.14).

  Los mensajes MQTT llegan al thread de paho y se encolan en una asyncio.Queue
  usando call_soon_threadsafe para despachar al loop principal de FastAPI.
"""

import asyncio
import logging
import ssl
import threading

import paho.mqtt.client as mqtt

from app.config import settings

logger = logging.getLogger(__name__)

# Tópicos
TOPIC_EVENTS = "smartstock/+/events"
TOPIC_ACK = "smartstock/+/ack"
TOPIC_STATUS = "smartstock/+/status"
TOPIC_HEARTBEAT = "smartstock/+/heartbeat"

# Cola compartida entre el thread paho y el loop de FastAPI
_message_queue: asyncio.Queue | None = None
_main_loop: asyncio.AbstractEventLoop | None = None
_client_instance: mqtt.Client | None = None

# Evento para señalizar shutdown al thread paho
_stop_event = threading.Event()

class PahoMQTTPublisher:
    async def publish(self, topic: str, payload: str, qos: int = 1) -> None:
        if _client_instance:
            _client_instance.publish(topic, payload, qos=qos)
            logger.info("Published to %s: %s", topic, payload)
        else:
            logger.warning("No MQTT client available to publish to %s", topic)


def _on_connect(
    client: mqtt.Client,
    userdata: object,
    flags: mqtt.ConnectFlags,
    reason_code: mqtt.ReasonCode,
    properties: object,
) -> None:
    if reason_code == 0:
        print(f">>> [SUCCESS] MQTT Conectado a HiveMQ: {settings.MQTT_BROKER_URL}")
        logger.info(
            "MQTT connected → %s:%d",
            settings.MQTT_BROKER_URL,
            settings.MQTT_PORT,
        )
        client.subscribe(TOPIC_EVENTS, qos=1)
        client.subscribe(TOPIC_ACK, qos=1)
        client.subscribe(TOPIC_STATUS, qos=1)
        client.subscribe(TOPIC_HEARTBEAT, qos=1)
    else:
        print(f">>> [ERROR] Fallo de conexión MQTT. Código: {reason_code}")
        logger.error("MQTT connection failed — reason_code: %s", reason_code)


def _on_subscribe(
    client: mqtt.Client,
    userdata: object,
    mid: int,
    reason_codes: list,
    properties: object,
) -> None:
    logger.info("MQTT subscribed (mid=%d)", mid)


def _on_message(
    client: mqtt.Client,
    userdata: object,
    msg: mqtt.MQTTMessage,
) -> None:
    """Callback de paho — corre en el thread de paho, NO en el loop de asyncio."""
    if _main_loop and _message_queue:
        _main_loop.call_soon_threadsafe(
            _message_queue.put_nowait,
            (msg.topic, bytes(msg.payload)),
        )


def _on_disconnect(
    client: mqtt.Client,
    userdata: object,
    flags: mqtt.DisconnectFlags,
    reason_code: mqtt.ReasonCode,
    properties: object,
) -> None:
    if reason_code != 0:
        logger.warning("MQTT disconnected unexpectedly — reason_code: %s", reason_code)
    else:
        logger.info("MQTT disconnected cleanly")


def _build_paho_client() -> mqtt.Client:
    """Construye y configura el cliente paho con ID único para evitar colisiones."""
    import uuid
    unique_id = f"{settings.MQTT_DEVICE_ID}-sub-{uuid.uuid4().hex[:6]}"
    
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=unique_id,
        protocol=mqtt.MQTTv311,
        reconnect_on_failure=True,
    )

    client.on_connect = _on_connect
    client.on_subscribe = _on_subscribe
    client.on_message = _on_message
    client.on_disconnect = _on_disconnect

    if settings.MQTT_USERNAME:
        client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)

    if settings.MQTT_PORT == 8883:
        client.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)

    return client


async def _dispatch_loop() -> None:
    """
    Corre en el loop principal de FastAPI.
    Consume mensajes de la queue y los despacha al handler de batches.
    """
    assert _message_queue is not None  # noqa: S101
    while True:
        try:
            # Usar timeout para no bloquear
            try:
                topic, payload = await asyncio.wait_for(_message_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                # Timeout alcanzado, continuar loop
                continue
                
            from app.mqtt.handlers import handle_batch, handle_portal_ack, handle_portal_status_mqtt  # noqa: PLC0415
            
            if "events" in topic:
                await handle_batch(topic, payload)
            elif "ack" in topic:
                await handle_portal_ack(topic, payload)
            elif "status" in topic or "heartbeat" in topic:
                await handle_portal_status_mqtt(topic, payload)
        except asyncio.CancelledError:
            logger.info("MQTT dispatch loop shutting down")
            break
        except Exception as exc:  # noqa: BLE001
            logger.error("Error dispatching MQTT message: %s", exc)


async def portal_watchdog() -> None:
    """Revisa si algún portal dejó de enviar heartbeats/mensajes en los últimos 90s."""
    from app.mqtt.handlers import _portal_last_seen
    from app.websocket.manager import manager
    import time

    while True:
        await asyncio.sleep(30)
        now = time.time()
        for device_id, last_seen in list(_portal_last_seen.items()):
            if now - last_seen > 90:
                logger.warning("Watchdog: Portal %s offline timeout", device_id)
                await manager.broadcast({
                    "type": "PORTAL_STATUS",
                    "payload": {"status": "offline", "device_id": device_id}
                })
                # Remover para no spamear
                _portal_last_seen.pop(device_id, None)

async def mqtt_listener() -> None:
    """
    Punto de entrada que arranca el backend MQTT.
    
    - Construye un cliente paho-mqtt con loop_start() (thread propio de paho).
    - Paho maneja reconexión automática (reconnect_on_failure=True).
    - Mensajes llegan al loop de FastAPI vía asyncio.Queue + call_soon_threadsafe.
    """
    global _message_queue, _main_loop, _client_instance  # noqa: PLW0603

    _main_loop = asyncio.get_running_loop()
    _message_queue = asyncio.Queue()

    print(f"\n>>> [DEBUG] Iniciando mqtt_listener en thread: {threading.current_thread().name}")
    
    client = _build_paho_client()
    _client_instance = client

    logger.info(
        "MQTT connecting to %s:%d as '%s'",
        settings.MQTT_BROKER_URL,
        settings.MQTT_PORT,
        settings.MQTT_DEVICE_ID,
    )

    try:
        # connect_async es non-blocking; loop_start() arranca el thread de paho
        client.connect_async(settings.MQTT_BROKER_URL, settings.MQTT_PORT, keepalive=60)
        client.loop_start()

        # Iniciar el watchdog
        watchdog_task = asyncio.create_task(portal_watchdog())

        # Correr el dispatch loop hasta que sea cancelado
        await _dispatch_loop()

        watchdog_task.cancel()

    except asyncio.CancelledError:
        logger.info("MQTT listener shutting down")
    except Exception as exc:
        logger.error("MQTT listener error: %s", exc)
    finally:
        client.loop_stop()
        client.disconnect()
        logger.info("MQTT client stopped")
