from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db, get_current_user
from app.models.configuracion import Configuracion
from app.schemas.configuracion import ConfiguracionResponse, ConfiguracionUpdate

router = APIRouter(
    prefix="/api/config", tags=["config"], dependencies=[Depends(get_current_user)]
)


@router.get("", response_model=ConfiguracionResponse)
async def get_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Configuracion).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return config


@router.put("", response_model=ConfiguracionResponse)
async def update_config(
    config_in: ConfiguracionUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Configuracion).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    update_data = config_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)

    await db.commit()
    await db.refresh(config)
    return config
