from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.alerta import TipoAlerta


class AlertaBase(BaseModel):
    tipo: TipoAlerta
    descripcion: str
    epc: Optional[str] = None
    ciclo_id: Optional[int] = None
    revisada: bool = False


class AlertaCreate(AlertaBase):
    pass


class AlertaUpdate(BaseModel):
    revisada: Optional[bool] = None


class AlertaResponse(AlertaBase):
    id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
