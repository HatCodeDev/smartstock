from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user
from app.services.cycle_service import cycle_service
from app.schemas.ciclo import CicloDashboard, DashboardActivityResponse

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"]
)

@router.get("", response_model=CicloDashboard)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Calcula los contadores en tiempo real a partir de los eventos del ciclo activo.
    No hay contadores precalculados en BD.
    """
    dashboard_data = await cycle_service.get_dashboard_counters(db)
    if not dashboard_data:
        raise HTTPException(status_code=404, detail="No hay ciclo activo en este momento")
    return dashboard_data

@router.get("/activity", response_model=DashboardActivityResponse)
async def get_activity(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Devuelve las alertas y los ultimos eventos agrupados del ciclo activo.
    """
    return await cycle_service.get_recent_activity(db)
