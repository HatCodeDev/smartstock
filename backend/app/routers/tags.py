from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user
from app.services.tag_service import tag_service
from app.schemas.tags import (
    ScanBatchStartRequest,
    ScanBatchStartResponse,
    ResolveConflictsRequest,
)
from app.websocket.manager import manager

router = APIRouter(
    prefix="/api/tags", tags=["tags"], dependencies=[Depends(get_current_user)]
)

@router.post("/scan-batch", response_model=ScanBatchStartResponse)
async def start_scan_batch(
    request: ScanBatchStartRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Inicia una sesión de registro para un producto específico.
    El estado se guarda en memoria y se asociará a los EPCs recibidos vía MQTT en modo REGISTRO.
    """
    try:
        response = await tag_service.start_registration_session(request, db)
        return response
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resolve-conflicts")
async def resolve_conflicts(
    request: ResolveConflictsRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Resuelve conflictos de etiquetas (reasigna producto y opcionalmente deduce inventario original).
    """
    try:
        await tag_service.resolve_conflicts(request, db)
        await db.commit()
        await manager.broadcast({"type": "INVENTORY_UPDATED", "payload": {}})
        return {"status": "ok", "message": "Conflictos resueltos exitosamente."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{epc}")
async def unlink_tag(
    epc: str = Path(..., title="El código EPC de la etiqueta"),
    db: AsyncSession = Depends(get_db)
):
    """
    Desvincula una etiqueta de su producto (producto_id = null, activa = false).
    """
    try:
        await tag_service.unlink_tag(epc, db)
        await db.commit()
        await manager.broadcast({"type": "INVENTORY_UPDATED", "payload": {}})
        return {"status": "ok", "message": f"Etiqueta {epc} desvinculada exitosamente."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
