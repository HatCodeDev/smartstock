import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.scheduler.jobs import auto_close_job

logger = logging.getLogger(__name__)

# Instancia singleton del scheduler
scheduler = AsyncIOScheduler()


def setup_scheduler() -> None:
    """Configura los jobs iniciales del scheduler."""
    logger.info("Configurando APScheduler...")

    # Job: Cierre automático (se revisa cada minuto si es la hora)
    scheduler.add_job(
        auto_close_job,
        CronTrigger(minute="*"),  # Cada minuto
        id="auto_close_job",
        replace_existing=True,
        misfire_grace_time=10,
    )

    logger.info("APScheduler configurado correctamente.")

