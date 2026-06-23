import enum
from datetime import date, datetime, timezone
from sqlalchemy import Date, DateTime, Enum as SAEnum, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class TipoReporteAvanzado(str, enum.Enum):
    HOLT_WINTERS = "HOLT_WINTERS"
    K_MEANS = "K_MEANS"

class ReporteAvanzado(Base):
    __tablename__ = "reportes_avanzados"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tipo: Mapped[TipoReporteAvanzado] = mapped_column(SAEnum(TipoReporteAvanzado), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(timezone.utc).date(), index=True)
    datos: Mapped[dict] = mapped_column(JSON, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
