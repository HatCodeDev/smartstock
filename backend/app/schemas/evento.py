from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.models.evento import TipoEvento


class EventoBase(BaseModel):
    epc: str
    ciclo_id: int
    tipo: TipoEvento
    producto_id: Optional[UUID] = None
    batch_id: Optional[str] = None
    timestamp_esp32: int


class EventoCreate(EventoBase):
    pass


class EventoResponse(EventoBase):
    id: int
    timestamp_servidor: datetime

    model_config = ConfigDict(from_attributes=True)
