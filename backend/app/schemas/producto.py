from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID


class ProductoBase(BaseModel):
    nombre: str
    sku: Optional[str] = None
    categoria: str
    cantidad_inicial: int = 0
    stock_minimo: int = 5
    activo: bool = True


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    cantidad_inicial: Optional[int] = None
    stock_minimo: Optional[int] = None
    activo: Optional[bool] = None


class ProductoResponse(ProductoBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
