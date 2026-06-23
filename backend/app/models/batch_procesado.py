from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class BatchProcesado(Base):
    __tablename__ = "batches_procesados"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    device_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    procesado_exitosamente: Mapped[bool] = mapped_column(Boolean, default=True)
