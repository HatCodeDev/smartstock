"""
MQTT Publisher — SmartStock
Publica comandos al tópico smartstock/{device_id}/commands.
Usa paho-mqtt con publish() síncrono en executor para no bloquear el loop de asyncio.

NOTA: Reemplazado aiomqtt por paho-mqtt directo (aiomqtt es incompatible con Python 3.14 en Windows).
"""

import asyncio
import json
import logging
import ssl
from typing import Any

import paho.mqtt.client as mqtt
import paho.mqtt.publish as paho_publish

from app.config import settings

logger = logging.getLogger(__name__)


def _build_tls_context() -> ssl.SSLContext | None:
    """Retorna un contexto TLS si el puerto es 8883, None en caso contrario."""
    if settings.MQTT_PORT == 8883:
        return ssl.create_default_context()
    return None


def _sync_publish(topic: str, message: str) -> None:
    """
    Publica un mensaje de forma síncrona usando paho client.
    Diseñado para correr en un executor thread desde asyncio.
    """
    import uuid
    unique_pub_id = f"{settings.MQTT_DEVICE_ID}-pub-{uuid.uuid4().hex[:6]}"

    auth = None
    if settings.MQTT_USERNAME:
        auth = {"username": settings.MQTT_USERNAME, "password": settings.MQTT_PASSWORD}

    # Usamos el cliente directo para poder configurar tls_set
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=unique_pub_id,
        protocol=mqtt.MQTTv311,
    )
    if auth:
        client.username_pw_set(auth["username"], auth["password"])
        
    if settings.MQTT_PORT == 8883:
        client.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)

    client.connect(settings.MQTT_BROKER_URL, settings.MQTT_PORT, keepalive=10)
    result = client.publish(topic, payload=message, qos=1)
    result.wait_for_publish(timeout=5.0)
    client.disconnect()


async def publish_command(
    device_id: str,
    command: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """
    Publica un comando JSON al dispositivo indicado.

    Tópico destino: smartstock/{device_id}/commands

    Args:
        device_id: Identificador del portal/ESP32 destino.
        command:   Nombre del comando, p. ej. "set_mode", "reboot".
        payload:   Datos adicionales del comando (opcional).
    """
    topic = f"smartstock/{device_id}/commands"
    message = json.dumps(
        {"command": command, "data": payload or {}},
        ensure_ascii=False,
    )

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _sync_publish, topic, message)

    logger.info("MQTT publish → %s | command=%s", topic, command)


async def publish_set_mode(device_id: str, mode: str) -> None:
    """
    Atajo para cambiar el modo operativo del portal.

    Args:
        device_id: ID del portal destino.
        mode:      "REGISTRO" | "LECTURA" | "IDLE"
    """
    await publish_command(device_id, command="set_mode", payload={"mode": mode})
