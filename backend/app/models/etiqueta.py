import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Boolean, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Etiqueta(Base):
    __tablename__ = "etiquetas"

    epc: Mapped[str] = mapped_column(String(24), primary_key=True)
    producto_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("productos.id"), nullable=True, index=True
    )
    activa: Mapped[bool] = mapped_column(Boolean, default=True)
    asignada_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    producto = relationship("Producto", back_populates="etiquetas")
    eventos = relationship("Evento", back_populates="etiqueta")
