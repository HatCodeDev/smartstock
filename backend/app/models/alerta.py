import enum
from datetime import datetime, timezone
from sqlalchemy import Enum as SAEnum, String, DateTime, Boolean, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TipoAlerta(str, enum.Enum):
    TAG_DESCONOCIDA = "TAG_DESCONOCIDA"
    MODO_REGISTRO_ACTIVO = "MODO_REGISTRO_ACTIVO"
    MOVIMIENTO_DUPLICADO = "MOVIMIENTO_DUPLICADO"
    OUTLIER_VENTA = "OUTLIER_VENTA"
    EXCESO_RETORNO = "EXCESO_RETORNO"



class Alerta(Base):
    __tablename__ = "alertas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tipo: Mapped[TipoAlerta] = mapped_column(SAEnum(TipoAlerta), index=True)
    descripcion: Mapped[str] = mapped_column(String(255))
    epc: Mapped[str | None] = mapped_column(String(24), nullable=True)
    ciclo_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ciclos.id"), nullable=True, index=True
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    revisada: Mapped[bool] = mapped_column(Boolean, default=False)

    ciclo = relationship("Ciclo", back_populates="alertas")
