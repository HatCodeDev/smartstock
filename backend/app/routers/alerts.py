from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.dependencies import get_db, get_current_user
from app.models.alerta import Alerta
from app.schemas.alerta import AlertaResponse
from app.services.cycle_service import cycle_service

router = APIRouter(
    prefix="/api/alerts", tags=["alerts"], dependencies=[Depends(get_current_user)]
)

@router.get("", response_model=list[AlertaResponse])
async def get_active_alerts(db: AsyncSession = Depends(get_db)):
    """
    Retorna alertas del ciclo activo donde revisada = false, ordenadas por timestamp DESC.
    """
    ciclo = await cycle_service.get_active_cycle(db)
    if not ciclo:
        return []
    
    stmt = select(Alerta).where(
        Alerta.ciclo_id == ciclo.id,
        Alerta.revisada == False
    ).order_by(desc(Alerta.timestamp))
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/{alerta_id}/review")
async def review_alert(
    alerta_id: int = Path(..., title="El ID de la alerta"),
    db: AsyncSession = Depends(get_db)
):
    """
    Marca una alerta como revisada.
    """
    alerta = await db.get(Alerta, alerta_id)
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    
    alerta.revisada = True
    await db.commit()
    
    return {"status": "ok", "message": "Alerta marcada como revisada."}
