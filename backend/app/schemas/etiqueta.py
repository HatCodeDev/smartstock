from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID


class EtiquetaBase(BaseModel):
    epc: str
    producto_id: Optional[UUID] = None  # nullable: etiqueta puede existir sin producto
    activa: bool = True


class EtiquetaCreate(EtiquetaBase):
    pass


class EtiquetaUpdate(BaseModel):
    activa: Optional[bool] = None
    producto_id: Optional[UUID] = None
    asignada_en: Optional[datetime] = None


class EtiquetaResponse(EtiquetaBase):
    asignada_en: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
