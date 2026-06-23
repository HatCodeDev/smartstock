from datetime import date, datetime
from pydantic import BaseModel
from app.models.reporte_avanzado import TipoReporteAvanzado

class ReporteAvanzadoResponse(BaseModel):
    id: int
    tipo: TipoReporteAvanzado
    fecha: date
    datos: dict
    creado_en: datetime

    class Config:
        orm_mode = True
        from_attributes = True
