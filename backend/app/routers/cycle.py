from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user
from app.services.cycle_service import cycle_service
from app.schemas.ciclo import CycleSummary, CycleStatus
from app.websocket.manager import manager

router = APIRouter(
    prefix="/api/cycle", tags=["cycle"], dependencies=[Depends(get_current_user)]
)

@router.get("/status", response_model=CycleStatus)
async def get_cycle_status(db: AsyncSession = Depends(get_db)):
    """
    Retorna el estado del ciclo actual (ABIERTO, CERRADO, SIN_CICLO).
    """
    return await cycle_service.get_cycle_status(db)

@router.post("/start")
async def start_cycle(db: AsyncSession = Depends(get_db)):
    """
    Inicia explícitamente un nuevo turno (ciclo).
    """
    try:
        ciclo = await cycle_service.start_cycle(db)
        await db.commit()
        
        payload = {
            "ciclo_id": str(ciclo.id) if ciclo.id else None,
            "fecha": ciclo.fecha.isoformat() if ciclo.fecha else None,
            "estado": ciclo.estado.value
        }
        await manager.broadcast({
            "type": "CYCLE_STARTED",
            "payload": payload
        })
        
        return {"status": "ok", **payload}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.post("/close", response_model=CycleSummary)
async def close_cycle(db: AsyncSession = Depends(get_db)):
    """
    Cierra manualmente el ciclo activo.
    """
    try:
        summary = await cycle_service.close_active_cycle(db, automatico=False)
        await db.commit()
        
        # Emitir WS CYCLE_CLOSED
        await manager.broadcast({
            "type": "CYCLE_CLOSED",
            "payload": summary.model_dump(mode="json")
        })
        
        return summary
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/summary", response_model=CycleSummary)
async def get_cycle_summary(db: AsyncSession = Depends(get_db)):
    """
    Retorna el resumen del último ciclo cerrado.
    """
    summary = await cycle_service.get_last_closed_cycle_summary(db)
    if not summary:
        raise HTTPException(status_code=404, detail="No se encontró ningún ciclo cerrado anterior.")
    return summary
