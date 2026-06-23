import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Enum as SAEnum, String, DateTime, ForeignKey, Integer, BigInteger
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TipoEvento(str, enum.Enum):
    SALIDA = "SALIDA"
    RETORNO = "RETORNO"


class Evento(Base):
    __tablename__ = "eventos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    epc: Mapped[str] = mapped_column(
        String(24), ForeignKey("etiquetas.epc"), index=True
    )
    ciclo_id: Mapped[int] = mapped_column(Integer, ForeignKey("ciclos.id"), index=True)
    tipo: Mapped[TipoEvento] = mapped_column(SAEnum(TipoEvento), nullable=False)
    producto_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("productos.id"), nullable=True, index=True
    )
    batch_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    timestamp_servidor: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    timestamp_esp32: Mapped[int] = mapped_column(BigInteger)

    etiqueta = relationship("Etiqueta", back_populates="eventos")
    ciclo = relationship("Ciclo", back_populates="eventos")
    producto = relationship("Producto", back_populates="eventos")
