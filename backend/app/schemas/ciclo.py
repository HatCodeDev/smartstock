from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime
from app.models.ciclo import EstadoCiclo, ModoPortal


class CicloBase(BaseModel):
    estado: EstadoCiclo = EstadoCiclo.ABIERTO
    modo_portal: ModoPortal = ModoPortal.SALIDA


class CicloCreate(CicloBase):
    pass


class CicloUpdate(BaseModel):
    estado: Optional[EstadoCiclo] = None
    modo_portal: Optional[ModoPortal] = None
    cerrado_en: Optional[datetime] = None
    cierre_automatico: Optional[bool] = None


class CicloResponse(CicloBase):
    id: int
    fecha: date
    creado_en: datetime
    cerrado_en: Optional[datetime] = None
    cierre_automatico: bool

    model_config = ConfigDict(from_attributes=True)


# Schema específico para GET /api/dashboard — contadores del ciclo activo
class CicloDashboard(BaseModel):
    ciclo_id: int
    fecha: date
    modo_portal: ModoPortal
    total_salidas: int
    total_retornos: int
    articulos_en_transito: int  # salidas - retornos
    total_en_bodega: int
    alertas_activas: int

    model_config = ConfigDict(from_attributes=True)


class AlertaSummary(BaseModel):
    tipo: str
    descripcion: str
    revisada: bool


class CycleSummary(BaseModel):
    fecha: date
    salidos: int
    retornados: int
    vendidos_final: int
    cierre_automatico: bool
    cerrado_en: datetime
    alertas: list[AlertaSummary]

    model_config = ConfigDict(from_attributes=True)


class CycleStatus(BaseModel):
    estado: str  # "ABIERTO" | "CERRADO" | "SIN_CICLO"
    en_transito: int
    fecha: Optional[date]

    model_config = ConfigDict(from_attributes=True)


class ActivityItem(BaseModel):
    id: str | int
    type: str
    title: str
    timestamp: int
    description: str


class AlertaPayload(BaseModel):
    id: int
    type: str
    message: str
    timestamp: int


class DashboardActivityResponse(BaseModel):
    history: list[ActivityItem]
    alerts: list[AlertaPayload]
