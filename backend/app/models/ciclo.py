import enum
from datetime import date, datetime, timezone
from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class EstadoCiclo(str, enum.Enum):
    ABIERTO = "ABIERTO"
    CERRADO = "CERRADO"


class ModoPortal(str, enum.Enum):
    SALIDA = "SALIDA"
    RETORNO = "RETORNO"
    REGISTRO = "REGISTRO"
    APAGADO = "APAGADO"


class Ciclo(Base):
    __tablename__ = "ciclos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    estado: Mapped[EstadoCiclo] = mapped_column(
        SAEnum(EstadoCiclo), default=EstadoCiclo.ABIERTO
    )
    modo_portal: Mapped[ModoPortal] = mapped_column(
        SAEnum(ModoPortal), default=ModoPortal.APAGADO
    )
    fecha: Mapped[date] = mapped_column(
        Date, default=lambda: datetime.now(timezone.utc).date()
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    cerrado_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cierre_automatico: Mapped[bool] = mapped_column(Boolean, default=False)

    eventos = relationship("Evento", back_populates="ciclo")
    alertas = relationship("Alerta", back_populates="ciclo")
