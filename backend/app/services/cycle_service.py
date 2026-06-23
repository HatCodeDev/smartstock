"""
CycleService — Gestión del ciclo diario y contadores del dashboard.

Responsabilidades:
  1. Proveer contadores en tiempo real (get_dashboard_counters).
  2. Gestionar la creación de ciclos bajo demanda (get_or_create_active_cycle).
  3. Cierre de ciclo (manual o automático) y generación de resumen.
  4. Consulta de resumen del último ciclo cerrado.
"""

import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional

from sqlalchemy import select, func, desc, case, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.alerta import Alerta
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.etiqueta import Etiqueta
from app.models.evento import Evento, TipoEvento
from app.models.producto import Producto
from app.schemas.ciclo import CicloDashboard, CycleSummary, AlertaSummary, CycleStatus, DashboardActivityResponse, ActivityItem, AlertaPayload
from collections import defaultdict
from app.mqtt.publisher import publish_command
from app.config import settings


logger = logging.getLogger(__name__)


class CycleService:
    """
    Stateless service para gestión de ciclos.
    """

    async def get_active_cycle(self, db: AsyncSession) -> Optional[Ciclo]:
        """Devuelve el ciclo activo (estado ABIERTO), si existe."""
        stmt = select(Ciclo).where(Ciclo.estado == EstadoCiclo.ABIERTO).order_by(desc(Ciclo.creado_en))
        result = await db.execute(stmt)
        return result.scalars().first()

    async def start_cycle(self, db: AsyncSession) -> Ciclo:
        """
        Inicia un nuevo turno/ciclo de manera explícita.
        """
        ciclo = await self.get_active_cycle(db)
        if ciclo is not None:
            raise ValueError("CICLO_ABIERTO: Ya existe un turno activo. Debe cerrarlo primero.")

        hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()
        logger.info("Iniciando nuevo ciclo de turno para el día %s", hoy)
        nuevo_ciclo = Ciclo(
            estado=EstadoCiclo.ABIERTO,
            modo_portal=ModoPortal.APAGADO,
            fecha=hoy,
        )
        db.add(nuevo_ciclo)
        await db.flush()
        return nuevo_ciclo

    async def get_active_cycle_or_fail(self, db: AsyncSession) -> Ciclo:
        """
        Obtiene el ciclo abierto. Lanza error si no existe.
        Utilizado por los procesadores MQTT y cambios de portal.
        """
        ciclo = await self.get_active_cycle(db)
        
        if ciclo is not None:
            hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()
            if ciclo.fecha < hoy:
                # Lazy close
                logger.info("Cerrando automáticamente ciclo anterior: %s", ciclo.fecha)
                await self.close_active_cycle(db, automatico=True)
                raise ValueError("CICLO_CERRADO: El ciclo anterior fue cerrado automáticamente. Inicie un nuevo turno.")
            return ciclo

        raise ValueError("SIN_CICLO: No hay un turno activo iniciado.")

    async def get_dashboard_counters(self, db: AsyncSession) -> Optional[CicloDashboard]:
        """
        Calcula contadores en tiempo real para el GET /api/dashboard.
        """
        ciclo = await self.get_active_cycle(db)
        if not ciclo:
            return None

        # 1. Contar Salidas y Retornos del ciclo activo
        stmt = select(
            Evento.tipo,
            func.count(Evento.id).label('count')
        ).where(
            Evento.ciclo_id == ciclo.id
        ).group_by(
            Evento.tipo
        )
        result = await db.execute(stmt)
        counts = {tipo: count for tipo, count in result.all()}

        total_salidas = counts.get(TipoEvento.SALIDA, 0)
        total_retornos = counts.get(TipoEvento.RETORNO, 0)
        articulos_en_transito = max(0, total_salidas - total_retornos)

        # 3. Contar total de etiquetas activas
        stmt_tags = select(func.count(Etiqueta.epc)).where(Etiqueta.activa == True)  # noqa: E712
        total_activos = (await db.execute(stmt_tags)).scalar_one() or 0
        total_en_bodega = max(0, total_activos - articulos_en_transito)

        # 4. Contar Alertas activas (no revisadas)
        stmt_alertas = select(func.count(Alerta.id)).where(
            Alerta.ciclo_id == ciclo.id,
            Alerta.revisada == False  # noqa: E712
        )
        alertas_activas = (await db.execute(stmt_alertas)).scalar_one()

        return CicloDashboard(
            ciclo_id=ciclo.id,
            fecha=ciclo.fecha,
            modo_portal=ciclo.modo_portal,
            total_salidas=total_salidas,
            total_retornos=total_retornos,
            articulos_en_transito=articulos_en_transito,
            total_en_bodega=total_en_bodega,
            alertas_activas=alertas_activas
        )

    async def close_active_cycle(self, db: AsyncSession, automatico: bool = False) -> CycleSummary:
        """
        Cierra el ciclo activo y genera el resumen.
        """
        ciclo = await self.get_active_cycle(db)
        if not ciclo:
            raise ValueError("No hay ciclo abierto para cerrar.")

        # Evaluar y registrar outliers antes del cierre definitivo
        from app.services.alert_service import alert_service
        await alert_service.evaluar_outliers_ciclo(ciclo.id, db)
        await alert_service.evaluar_exceso_retorno_ciclo(ciclo.id, db)

        # Obtener los contadores antes de cerrar
        counters = await self.get_dashboard_counters(db)
        if not counters:
             # Debería ser imposible llegar aquí
             raise RuntimeError("Error obteniendo contadores para el cierre.")

        # Obtener EPCs en tránsito y aplicar deducción de stock atómicamente
        epcs_sin_retorno = await self._get_epcs_sin_retorno(ciclo.id, db)
        await self._apply_stock_deduction(epcs_sin_retorno, db)

        # Cerrar el ciclo
        ciclo.estado = EstadoCiclo.CERRADO
        ciclo.cerrado_en = datetime.now(timezone.utc).replace(tzinfo=None)
        ciclo.cierre_automatico = automatico

        await db.flush()

        # Encolar pipeline de analítica avanzada en segundo plano
        try:
            from app.scheduler.scheduler import scheduler
            from app.scheduler.jobs import advanced_analytics_pipeline_job
            scheduler.add_job(
                advanced_analytics_pipeline_job,
                args=[ciclo.id],
                id=f"advanced_analytics_{ciclo.id}_{int(datetime.now(timezone.utc).timestamp())}",
                misfire_grace_time=60
            )
            logger.info(f"Encolado job de analítica avanzada para el ciclo {ciclo.id}")
        except Exception as e:
            logger.error(f"Error encolando job de analítica avanzada: {str(e)}", exc_info=True)

        # Apagar portal físicamente
        import asyncio
        asyncio.create_task(publish_command(
            settings.MQTT_DEVICE_ID, 
            command="SET_MODE", 
            payload={"mode": "APAGADO"}
        ))

        # Armar el summary (cargando alertas)
        stmt_alertas = select(Alerta).where(Alerta.ciclo_id == ciclo.id)
        alertas = (await db.execute(stmt_alertas)).scalars().all()

        alertas_summary = [
             AlertaSummary(
                 tipo=a.tipo.value,
                 descripcion=a.descripcion,
                 revisada=a.revisada
             ) for a in alertas
        ]

        return CycleSummary(
             fecha=ciclo.fecha,
             salidos=counters.total_salidas,
             retornados=counters.total_retornos,
             vendidos_final=counters.articulos_en_transito,
             cierre_automatico=automatico,
             cerrado_en=ciclo.cerrado_en,
             alertas=alertas_summary
        )

    async def get_last_closed_cycle_summary(self, db: AsyncSession) -> Optional[CycleSummary]:
        """
        Devuelve el summary del último ciclo CERRADO.
        """
        stmt = select(Ciclo).where(
            Ciclo.estado == EstadoCiclo.CERRADO
        ).order_by(
            desc(Ciclo.cerrado_en)
        ).options(
            selectinload(Ciclo.alertas)
        ).limit(1)

        result = await db.execute(stmt)
        ciclo = result.scalar_one_or_none()

        if not ciclo:
            return None

        # Re-calcular contadores históricos (usualmente el query pesado, pero solo para GET summary)
        stmt_counts = select(
            Evento.tipo,
            func.count(Evento.id)
        ).where(
            Evento.ciclo_id == ciclo.id
        ).group_by(
            Evento.tipo
        )
        result_counts = await db.execute(stmt_counts)
        counts = {tipo: count for tipo, count in result_counts.all()}

        total_salidas = counts.get(TipoEvento.SALIDA, 0)
        total_retornos = counts.get(TipoEvento.RETORNO, 0)

        alertas_summary = [
             AlertaSummary(
                 tipo=a.tipo.value,
                 descripcion=a.descripcion,
                 revisada=a.revisada
             ) for a in ciclo.alertas
        ]

        return CycleSummary(
             fecha=ciclo.fecha,
             salidos=total_salidas,
             retornados=total_retornos,
             vendidos_final=max(0, total_salidas - total_retornos),
             cierre_automatico=ciclo.cierre_automatico,
             cerrado_en=ciclo.cerrado_en,  # type: ignore (sabemos que no es None si está CERRADO)
             alertas=alertas_summary
        )

    async def _get_epcs_sin_retorno(self, ciclo_id: int, db: AsyncSession) -> list[str]:
        stmt = select(Evento.epc, Evento.tipo).where(Evento.ciclo_id == ciclo_id).order_by(Evento.timestamp_esp32.asc())
        result = await db.execute(stmt)
        estado_epcs = {}
        for epc, tipo in result.all():
            estado_epcs[epc] = tipo
        
        return [epc for epc, tipo in estado_epcs.items() if tipo == TipoEvento.SALIDA]

    async def _apply_stock_deduction(self, epcs: list[str], db: AsyncSession) -> int:
        if not epcs:
            return 0

        # 1. Agrupar por producto_id para descontar de forma atómica
        stmt_productos = select(Etiqueta.producto_id, func.count(Etiqueta.epc)).where(
            Etiqueta.epc.in_(epcs),
            Etiqueta.producto_id.is_not(None)
        ).group_by(Etiqueta.producto_id)
        result = await db.execute(stmt_productos)
        conteo_por_producto = result.all()

        # 2. Desactivar etiquetas
        stmt_upd_etiquetas = update(Etiqueta).where(Etiqueta.epc.in_(epcs)).values(activa=False)
        await db.execute(stmt_upd_etiquetas)

        # 3. Descontar stock (bulk update is hard without case/when for dynamic updates, so we loop per product_id safely)
        for producto_id, conteo in conteo_por_producto:
            stmt_upd_prod = update(Producto).where(Producto.id == producto_id).values(
                cantidad_inicial=case((Producto.cantidad_inicial - conteo > 0, Producto.cantidad_inicial - conteo), else_=0)
            )
            await db.execute(stmt_upd_prod)
            
        return len(epcs)

    async def get_cycle_status(self, db: AsyncSession) -> CycleStatus:
        ciclo = await self.get_active_cycle(db)
        if ciclo:
            counters = await self.get_dashboard_counters(db)
            en_transito = counters.articulos_en_transito if counters else 0
            return CycleStatus(estado=ciclo.estado.value, en_transito=en_transito, fecha=ciclo.fecha)
            
        stmt = select(Ciclo).where(Ciclo.estado == EstadoCiclo.CERRADO).order_by(desc(Ciclo.cerrado_en)).limit(1)
        result = await db.execute(stmt)
        ultimo_cerrado = result.scalar_one_or_none()
        
        if ultimo_cerrado:
            return CycleStatus(estado="CERRADO", en_transito=0, fecha=ultimo_cerrado.fecha)
            
        return CycleStatus(estado="SIN_CICLO", en_transito=0, fecha=None)


    async def get_recent_activity(self, db: AsyncSession) -> DashboardActivityResponse:
        ciclo = await self.get_active_cycle(db)
        if not ciclo:
            return DashboardActivityResponse(history=[], alerts=[])

        # Obtener las ultimas 20 alertas
        stmt_alertas = select(Alerta).where(Alerta.ciclo_id == ciclo.id).order_by(desc(Alerta.timestamp)).limit(20)
        alertas_db = (await db.execute(stmt_alertas)).scalars().all()
        
        alerts_list = []
        for a in alertas_db:
            ts_ms = int(a.timestamp.timestamp() * 1000)
            alerts_list.append(AlertaPayload(
                id=a.id,
                type=a.tipo.value,
                message=a.descripcion,
                timestamp=ts_ms
            ))

        # Obtener los ultimos eventos con producto, limite por batch (traemos ultimos 150 eventos para agrupar)
        stmt_eventos = select(Evento).where(
            Evento.ciclo_id == ciclo.id
        ).options(
            selectinload(Evento.producto)
        ).order_by(desc(Evento.timestamp_servidor)).limit(150)
        
        eventos_db = (await db.execute(stmt_eventos)).scalars().all()
        
        # Agrupar por batch_id conservando el orden de más reciente
        batches = {}
        for e in eventos_db:
            bid = e.batch_id or str(e.id)
            if bid not in batches:
                batches[bid] = {
                    "id": bid,
                    "tipo": e.tipo.value,
                    "timestamp": int(e.timestamp_servidor.timestamp() * 1000),
                    "items": defaultdict(int)
                }
            prod_name = e.producto.nombre if e.producto else "Desconocido"
            batches[bid]["items"][prod_name] += 1
            
        history_list = []
        for bid, bdata in batches.items():
            is_salida = bdata["tipo"] == "SALIDA"
            total_items = sum(bdata["items"].values())
            title_text = f"{'Salida' if is_salida else 'Retorno'} de {total_items} artículo{'s' if total_items > 1 else ''}"
            
            # Limitar descripciones largas (igual que en JS: slice(0,2) + N mas)
            items_list = list(bdata["items"].items())
            parts = [f"{qty}x {name}" for name, qty in items_list[:2]]
            diff = len(items_list) - 2
            if diff > 0:
                parts.append(f"{diff} artículo{'s' if diff > 1 else ''} más")
                
            desc_text = ", ".join(parts)
            
            history_list.append(ActivityItem(
                id=bdata["id"],
                type="move-out" if is_salida else "move-in",
                title=title_text,
                timestamp=bdata["timestamp"],
                description=desc_text
            ))
            
        # Agregar alertas al historial unificado
        for a in alerts_list:
            history_list.append(ActivityItem(
                id=a.id,
                type="alert",
                title=a.type,
                timestamp=a.timestamp,
                description=a.message
            ))
            
        # Ordenar historial por timestamp descendente y tomar los top 20
        history_list.sort(key=lambda x: x.timestamp, reverse=True)
        history_list = history_list[:20]

        return DashboardActivityResponse(
            history=history_list,
            alerts=alerts_list
        )


cycle_service = CycleService()
