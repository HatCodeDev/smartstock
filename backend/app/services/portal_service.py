"""
PortalService — Gestión del estado y modos del Portal RFID (ESP32).

Responsabilidades:
  1. Cambiar el modo del portal en la Base de Datos (en el ciclo activo).
  2. Publicar comando MQTT SET_MODE al ESP32.
  3. Gestionar alertas asociadas al modo REGISTRO (AlertService).
"""

import json
import logging
from typing import Protocol
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ciclo import ModoPortal
from app.services.cycle_service import cycle_service
from app.services.alert_service import alert_service

logger = logging.getLogger(__name__)


class MQTTPublisherProtocol(Protocol):
    """Protocolo para abstraer la publicación MQTT e inyectarla para tests."""
    async def publish(self, topic: str, payload: str, qos: int = 1) -> None:
        ...


class DummyPublisher:
    """Implementación dummy por defecto (se reemplaza en app.mqtt)"""
    async def publish(self, topic: str, payload: str, qos: int = 1) -> None:
        logger.info(f"DUMMY PUBLISH a {topic}: {payload}")


class PortalService:
    def __init__(self, mqtt_publisher: MQTTPublisherProtocol | None = None):
        self.mqtt_publisher = mqtt_publisher or DummyPublisher()

    async def change_mode(self, new_mode: ModoPortal, device_id: str, db: AsyncSession) -> bool:
        """
        Cambia el modo del portal.
        Retorna True si fue exitoso, False si no se pudo (ej: ciclo cerrado).
        """
        try:
            ciclo = await cycle_service.get_active_cycle_or_fail(db)
        except ValueError as e:
            logger.warning(f"No se puede cambiar modo: {e}")
            return False

        # Si el modo ya es el mismo, no hacemos nada en BD, pero igual enviamos MQTT por las dudas
        if ciclo.modo_portal != new_mode:
            logger.info(f"Cambiando modo de portal de {ciclo.modo_portal.value} a {new_mode.value}")
            ciclo.modo_portal = new_mode
            
            # Gestionar alerta de REGISTRO
            if new_mode == ModoPortal.REGISTRO:
                await alert_service.create_modo_registro_alerta(ciclo.id, db)
            else:
                await alert_service.auto_resolve_modo_registro(ciclo.id, db)

        # Publicar comando al ESP32 vía MQTT
        topic = f"smartstock/{device_id}/commands"
        payload = json.dumps({
            "command": "SET_MODE",
            "mode": new_mode.value
        })
        
        try:
            await self.mqtt_publisher.publish(topic, payload, qos=1)
            return True
        except Exception as e:
            logger.error(f"Fallo al publicar comando MQTT a {device_id}: {e}")
            # Aunque falle el MQTT, la DB se actualizará con el commit externo.
            # En un entorno real, dependeríamos del ACK del ESP32, pero por ahora asumimos éxito.
            return True


portal_service = PortalService()
