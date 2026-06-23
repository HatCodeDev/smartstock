from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.dependencies import get_db, get_current_user
from app.models.ciclo import Ciclo, EstadoCiclo
from app.schemas.portal import PortalModeRequest, PortalModeResponse
from app.services.portal_service import portal_service
from app.websocket.manager import manager

router = APIRouter(
    prefix="/api/portal", tags=["portal"], dependencies=[Depends(get_current_user)]
)


from app.mqtt.handlers import _portal_last_seen
import time

@router.get("/status")
async def get_portal_status(db: AsyncSession = Depends(get_db)):
    """
    Retorna el estado del portal.
    Si tenemos heartbeat o presencia MQTT reciente (90s), es online.
    Caso contrario, offline.
    """
    result = await db.execute(
        select(Ciclo)
        .where(Ciclo.estado == EstadoCiclo.ABIERTO)
        .order_by(desc(Ciclo.creado_en))
        .limit(1)
    )
    ciclo = result.scalar_one_or_none()

    # Comprobar si hay algún portal activo en _portal_last_seen
    is_online = False
    now = time.time()
    for device_id, last_seen in _portal_last_seen.items():
        if now - last_seen <= 90:
            is_online = True
            break

    status = "online" if is_online else "offline"

    if not ciclo:
        return {"status": status, "modo_portal": None, "ciclo_id": None}

    return {
        "status": status,
        "modo_portal": ciclo.modo_portal.value,
        "ciclo_id": ciclo.id,
    }

@router.post("/mode", response_model=PortalModeResponse)
async def set_portal_mode(
    req: PortalModeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Cambia el modo del portal, lo emite por MQTT al hardware ESP32 y vía WebSocket al Dashboard.
    """
    success = await portal_service.change_mode(new_mode=req.mode, device_id=req.device_id, db=db)
    
    if not success:
        raise HTTPException(status_code=400, detail="No se pudo cambiar el modo del portal. Verifique si el ciclo está abierto.")
    
    await db.commit()

    # Emitir WebSocket
    await manager.broadcast({
        "type": "PORTAL_MODE_CHANGED",
        "payload": req.mode.value,
        "device_id": req.device_id
    })

    return PortalModeResponse(
        device_id=req.device_id,
        mode=req.mode,
        status="ok"
    )

