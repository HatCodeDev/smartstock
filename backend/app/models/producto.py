import uuid
from typing import Optional
from sqlalchemy import String, Boolean, Integer, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Producto(Base):
    __tablename__ = "productos"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(255), index=True)
    sku: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True, index=True)
    categoria: Mapped[str] = mapped_column(String(100), index=True)
    cantidad_inicial: Mapped[int] = mapped_column(Integer, default=0)
    stock_minimo: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    etiquetas = relationship("Etiqueta", back_populates="producto")
    eventos = relationship("Evento", back_populates="producto")
