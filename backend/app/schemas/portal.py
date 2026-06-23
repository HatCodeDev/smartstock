from pydantic import BaseModel
from typing import Literal
from app.models.ciclo import ModoPortal


class PortalModeRequest(BaseModel):
    mode: ModoPortal
    device_id: str


class PortalModeResponse(BaseModel):
    device_id: str
    mode: ModoPortal
    status: Literal["ok", "error"]
    message: str | None = None
