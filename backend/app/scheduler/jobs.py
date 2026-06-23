import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from app.config import settings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.configuracion import Configuracion
from app.services.cycle_service import cycle_service
from app.websocket.manager import manager

logger = logging.getLogger(__name__)


async def auto_close_job() -> None:
    """
    Se ejecuta cada minuto. Lee la configuración de la BD y, si la hora actual
    coincide con la configurada, cierra el ciclo si está abierto.
    """
    current_time_str = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%H:%M")

    async with async_session_maker() as db:
        try:
            config = (await db.execute(select(Configuracion).limit(1))).scalar_one_or_none()
            if not config:
                return

            if not config.cierre_auto_habilitado:
                return

            hora_cierre = config.hora_cierre_auto

            if current_time_str == hora_cierre:
                ciclo = await cycle_service.get_active_cycle(db)
                if ciclo:
                    logger.info(f"Iniciando cierre automático de ciclo. Hora configurada: {hora_cierre}")
                    # Al llamar a close_active_cycle se guardan los cambios dentro, pero
                    # debemos hacer commit en la sesión actual de job.
                    summary = await cycle_service.close_active_cycle(db, automatico=True)
                    await db.commit()

                    # Emitir evento WS
                    await manager.broadcast({
                        "type": "CYCLE_CLOSED",
                        "payload": summary.model_dump(mode='json')
                    })
        except Exception as e:
            logger.error("Error en auto_close_job: %s", str(e))
            await db.rollback()


async def advanced_analytics_pipeline_job(ciclo_id: int) -> None:
    """
    Job de ejecución inmediata que corre el pipeline de analítica avanzada
    (FP-Growth, Holt-Winters y K-Means) y persiste los reportes.
    """
    logger.info(f"Iniciando advanced_analytics_pipeline_job para el ciclo {ciclo_id}")
    from app.services.advanced_report_service import advanced_report_service

    async with async_session_maker() as db:
        try:
            await advanced_report_service.generar_reportes_avanzados_ciclo(ciclo_id, db)
            await db.commit()
            logger.info(f"advanced_analytics_pipeline_job completado exitosamente para el ciclo {ciclo_id}")
        except Exception as e:
            logger.error(f"Error en advanced_analytics_pipeline_job para el ciclo {ciclo_id}: {str(e)}", exc_info=True)
            await db.rollback()


