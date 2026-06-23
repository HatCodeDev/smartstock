from sqlalchemy import Integer, String, Boolean, Float, event, DDL
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Configuracion(Base):
    __tablename__ = "configuracion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hora_cierre_auto: Mapped[str] = mapped_column(String(5), default="23:00")
    cierre_auto_habilitado: Mapped[bool] = mapped_column(Boolean, default=True)
    umbral_retorno_critico: Mapped[float] = mapped_column(Float, default=80.0)


# Seed por defecto
event.listen(
    Configuracion.__table__,
    "after_create",
    DDL(
        "INSERT INTO configuracion (id, hora_cierre_auto, cierre_auto_habilitado, umbral_retorno_critico) VALUES (1, '23:00', true, 80.0)"
    ),
)


