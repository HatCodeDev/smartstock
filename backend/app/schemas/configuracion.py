from pydantic import BaseModel, ConfigDict
from typing import Optional


class ConfiguracionBase(BaseModel):
    hora_cierre_auto: str
    cierre_auto_habilitado: bool = True
    umbral_retorno_critico: float = 80.0


class ConfiguracionCreate(ConfiguracionBase):
    pass


class ConfiguracionUpdate(BaseModel):
    hora_cierre_auto: Optional[str] = None
    cierre_auto_habilitado: Optional[bool] = None
    umbral_retorno_critico: Optional[float] = None


class ConfiguracionResponse(ConfiguracionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

