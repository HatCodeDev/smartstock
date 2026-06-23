"""
AlertService — Gestión y evaluación de alertas.

Responsabilidades:
  1. Deduplicación: No insertar la misma alerta activa en un ciclo.
  2. Generar alertas TAG_DESCONOCIDA (usado desde BatchProcessor).
  3. Generar alerta MODO_REGISTRO_ACTIVO (usado desde PortalService).
  4. Evaluación de TIEMPO_EXCEDIDO: Analizar artículos en tránsito.
"""

import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, and_, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerta import Alerta, TipoAlerta
from app.models.ciclo import Ciclo
from app.models.evento import Evento, TipoEvento
from app.models.etiqueta import Etiqueta
from app.models.producto import Producto

logger = logging.getLogger(__name__)


class AlertService:
    async def _exists_unresolved(self, tipo: TipoAlerta, ciclo_id: int, db: AsyncSession, epc: str | None = None) -> bool:
        """Verifica si ya existe una alerta NO revisada del mismo tipo, ciclo y epc."""
        conditions = [
            Alerta.tipo == tipo,
            Alerta.ciclo_id == ciclo_id,
            Alerta.revisada == False  # noqa: E712
        ]
        if epc is not None:
            conditions.append(Alerta.epc == epc)

        stmt = select(func.count(Alerta.id)).where(and_(*conditions))
        count = (await db.execute(stmt)).scalar_one()
        return count > 0

    async def create_tag_desconocida(self, epc: str, ciclo_id: int, timestamp: datetime, db: AsyncSession) -> bool:
        """
        Crea una alerta TAG_DESCONOCIDA si no existe una activa para ese EPC.
        Retorna True si la creó, False si estaba duplicada.
        """
        if await self._exists_unresolved(TipoAlerta.TAG_DESCONOCIDA, ciclo_id, db, epc=epc):
            return False

        alerta = Alerta(
            tipo=TipoAlerta.TAG_DESCONOCIDA,
            descripcion=f"Etiqueta no reconocida: {epc} detectada en portal a las {timestamp.strftime('%H:%M:%S')}",
            epc=epc,
            ciclo_id=ciclo_id,
            timestamp=timestamp
        )
        db.add(alerta)
        return True

    async def create_movimiento_duplicado(
        self,
        epc: str,
        nombre_producto: str,
        modo: str,
        ciclo_id: int,
        timestamp: datetime,
        db: AsyncSession,
        descripcion: str | None = None
    ) -> bool:
        """
        Crea una alerta MOVIMIENTO_DUPLICADO cuando se lee repetidamente el mismo producto en el mismo modo o de forma inválida.
        """
        # Para no spamear, evitamos crear la misma alerta si ya hay una sin revisar para este EPC
        if await self._exists_unresolved(TipoAlerta.MOVIMIENTO_DUPLICADO, ciclo_id, db, epc=epc):
            return False

        if not descripcion:
            descripcion = f"Movimiento duplicado: '{nombre_producto}' ya fue registrado en {modo}."

        alerta = Alerta(
            tipo=TipoAlerta.MOVIMIENTO_DUPLICADO,
            descripcion=descripcion,
            epc=epc,
            ciclo_id=ciclo_id,
            timestamp=timestamp
        )
        db.add(alerta)
        return True

    async def create_modo_registro_alerta(self, ciclo_id: int, db: AsyncSession) -> bool:
        """Crea la alerta informativa de MODO_REGISTRO si no existe."""
        if await self._exists_unresolved(TipoAlerta.MODO_REGISTRO_ACTIVO, ciclo_id, db):
            return False

        alerta = Alerta(
            tipo=TipoAlerta.MODO_REGISTRO_ACTIVO,
            descripcion="El portal está en modo Registro. Los movimientos de inventario están pausados.",
            ciclo_id=ciclo_id
        )
        db.add(alerta)
        return True

    async def auto_resolve_modo_registro(self, ciclo_id: int, db: AsyncSession) -> None:
        """Marca como revisada la alerta de MODO_REGISTRO (al salir del modo)."""
        stmt = select(Alerta).where(
            Alerta.tipo == TipoAlerta.MODO_REGISTRO_ACTIVO,
            Alerta.ciclo_id == ciclo_id,
            Alerta.revisada == False  # noqa: E712
        )
        alertas = (await db.execute(stmt)).scalars().all()
        for alerta in alertas:
            alerta.revisada = True

    async def evaluar_outliers_ciclo(self, ciclo_id: int, db: AsyncSession) -> None:
        """
        Evalúa si existen productos en el ciclo activo que presenten salidas altas 
        (ej: >= 10 unidades) pero retornos nulos (0). Dispara una alerta OUTLIER_VENTA.
        """
        # Agrupar movimientos de salidas y retornos por producto_id en el ciclo dado
        stmt = select(
            Evento.producto_id,
            func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)).label("salidas"),
            func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)).label("retornos")
        ).where(
            Evento.ciclo_id == ciclo_id,
            Evento.producto_id.is_not(None)
        ).group_by(Evento.producto_id)

        res = await db.execute(stmt)
        for prod_id, salidas, retornos in res.all():
            salidas = salidas or 0
            retornos = retornos or 0
            if salidas >= 10 and retornos == 0:
                # Buscar nombre del producto
                stmt_prod = select(Producto.nombre).where(Producto.id == prod_id)
                prod_name = (await db.execute(stmt_prod)).scalar_one_or_none() or "Artículo Desconocido"
                
                # Verificar si ya existe una alerta sin revisar para este producto en el ciclo actual
                stmt_exist = select(func.count(Alerta.id)).where(
                    Alerta.tipo == TipoAlerta.OUTLIER_VENTA,
                    Alerta.ciclo_id == ciclo_id,
                    Alerta.revisada == False,
                    Alerta.descripcion.like(f"%'{prod_name}'%")
                )
                count = (await db.execute(stmt_exist)).scalar_one()
                
                if count == 0:
                    alerta = Alerta(
                        tipo=TipoAlerta.OUTLIER_VENTA,
                        descripcion=f"Desvío de venta: Salida alta de '{prod_name}' ({salidas} unidades) sin retornos registrados.",
                        ciclo_id=ciclo_id,
                        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
                    )
                    db.add(alerta)
                    await db.flush()
                    logger.info("Alerta OUTLIER_VENTA generada para el producto %s (salidas=%s)", prod_name, salidas)
                    
                    # Emitir por WS para avisar al dashboard en vivo
                    from app.websocket.manager import manager
                    import asyncio
                    asyncio.create_task(manager.broadcast({
                        "type": "NEW_ALERT",
                        "payload": {
                            "type": "OUTLIER_VENTA",
                            "message": alerta.descripcion,
                            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
                        }
                    }))

    async def evaluar_exceso_retorno_ciclo(self, ciclo_id: int, db: AsyncSession) -> None:
        """
        Evalúa si existen productos que superen el umbral_retorno_critico (ej: 20%) basado en ciclos cerrados (incluyendo este).
        Dispara una alerta EXCESO_RETORNO si no existe ya una alerta activa.
        """
        from app.models.configuracion import Configuracion
        from app.models.ciclo import EstadoCiclo

        # 1. Obtener el umbral crítico configurado
        config_result = await db.execute(select(Configuracion).limit(1))
        config = config_result.scalar_one_or_none()
        umbral = config.umbral_retorno_critico if config else 80.0

        # Subquery para evaluar solo los productos que tuvieron al menos una salida en el ciclo actual
        productos_con_salida_en_ciclo = select(Evento.producto_id).where(
            Evento.ciclo_id == ciclo_id,
            Evento.tipo == TipoEvento.SALIDA
        ).scalar_subquery()

        # 2. Obtener salidas y retornos por producto en ciclos cerrados (incluyendo el actual que se está cerrando)
        stmt = select(
            Producto.id,
            Producto.nombre,
            func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)).label("salidas"),
            func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)).label("retornos")
        ).join(
            Evento, Evento.producto_id == Producto.id
        ).join(
            Ciclo, Evento.ciclo_id == Ciclo.id
        ).where(
            Producto.activo == True,
            (Ciclo.estado == EstadoCiclo.CERRADO) | (Ciclo.id == ciclo_id),
            Producto.id.in_(productos_con_salida_en_ciclo)
        ).group_by(Producto.id)

        res = await db.execute(stmt)
        for prod_id, prod_name, salidas, retornos in res.all():
            salidas = salidas or 0
            retornos = retornos or 0
            rate = (retornos / salidas) * 100 if salidas > 0 else 0.0
            
            if rate > umbral:
                # Verificar si ya existe una alerta activa (no revisada) de tipo EXCESO_RETORNO para este producto
                stmt_exist = select(func.count(Alerta.id)).where(
                    Alerta.tipo == TipoAlerta.EXCESO_RETORNO,
                    Alerta.revisada == False,
                    Alerta.descripcion.like(f"%'{prod_name}'%")
                )
                count = (await db.execute(stmt_exist)).scalar_one()

                if count == 0:
                    alerta = Alerta(
                        tipo=TipoAlerta.EXCESO_RETORNO,
                        descripcion=f"Tasa de retorno de exhibición crítica: '{prod_name}' tiene un {round(rate, 1)}% de devoluciones (umbral {umbral}%).",
                        ciclo_id=ciclo_id,
                        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
                    )
                    db.add(alerta)
                    await db.flush()
                    logger.info("Alerta EXCESO_RETORNO generada para el producto %s (rate=%s%%)", prod_name, round(rate, 1))

                    # Emitir por WS para avisar al dashboard en vivo
                    from app.websocket.manager import manager
                    import asyncio
                    asyncio.create_task(manager.broadcast({
                        "type": "NEW_ALERT",
                        "payload": {
                            "type": "EXCESO_RETORNO",
                            "message": alerta.descripcion,
                            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
                        }
                    }))


alert_service = AlertService()

