from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


# Payload que llega del ESP32 vía MQTT
class RFIDTag(BaseModel):
    epc: str
    rssi: Optional[int] = None
    timestamp_esp32: int  # millis() del ESP32


class BatchMQTTPayload(BaseModel):
    """Payload completo de un batch RFID publicado al topic smartstock/{device_id}/events"""
    batch_id: str
    device_id: str
    modo: str  # SALIDA | RETORNO | REGISTRO
    tags: list[RFIDTag]
    timestamp: int  # epoch seconds del ESP32


class BatchProcesadoCreate(BaseModel):
    batch_id: str
    device_id: Optional[str] = None
    procesado_exitosamente: bool = True


class BatchProcesadoResponse(BatchProcesadoCreate):
    id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
