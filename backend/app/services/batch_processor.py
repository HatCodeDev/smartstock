"""
BatchProcessor — Procesamiento de batches RFID publicados por el ESP32 vía MQTT.

Responsabilidades:
  1. Idempotencia:   rechaza silenciosamente un batch_id ya procesado.
  2. Transacción:    todo o nada. Si algo falla, rollback completo (mandato AGENTS.md).
  3. Switch por modo:
       - SALIDA / RETORNO → crea Evento por cada EPC conocido.
       - REGISTRO         → delega al TagService (stub: sólo logea, se implementa en 2.3).
  4. EPCs desconocidos → alerta TAG_DESCONOCIDA (una por EPC, en el mismo batch).

Contrato de entrada: BatchMQTTPayload (schemas/batch.py)
Contrato de salida:  BatchResult (dataclass interna, consumida por mqtt/client.py y tests)
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from collections import Counter

from app.models.alerta import Alerta, TipoAlerta
from app.models.batch_procesado import BatchProcesado
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.etiqueta import Etiqueta
from app.models.evento import Evento, TipoEvento
from app.schemas.batch import BatchMQTTPayload

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Resultado del procesamiento — lo consume el MQTT client para el WS broadcast
# ---------------------------------------------------------------------------

@dataclass
class BatchResult:
    batch_id: str
    modo: str
    eventos_creados: int = 0
    alertas_creadas: int = 0
    epcs_desconocidos: list[str] = field(default_factory=list)
    alertas_generadas: list[dict] = field(default_factory=list) # Detalles de alertas para WS
    registro_resultados: list = field(default_factory=list) # Resultados de TagService
    contadores_actuales: dict = field(default_factory=dict) # Contadores globales para el Dashboard
    articulos_movidos: list[dict] = field(default_factory=list) # Nombres de artículos procesados
    skipped: bool = False          # True si el batch ya fue procesado antes
    error: Optional[str] = None    # Mensaje de error si la transacción falló


# ---------------------------------------------------------------------------
# Servicio
# ---------------------------------------------------------------------------

class BatchProcessor:
    """
    Stateless: no guarda estado entre llamadas.
    Recibe la sesión de BD como parámetro para facilitar el testing con mocks.
    """

    async def process(
        self,
        payload: BatchMQTTPayload,
        db: AsyncSession,
    ) -> BatchResult:
        """
        Punto de entrada principal.
        Toda la lógica corre dentro de una única transacción atómica.
        """
        result = BatchResult(batch_id=payload.batch_id, modo=payload.modo)

        # ------------------------------------------------------------------ #
        # 1. Idempotencia — ¿ya procesamos este batch_id?                     #
        # ------------------------------------------------------------------ #
        already_processed = await self._is_duplicate(payload.batch_id, db)
        if already_processed:
            logger.info(
                "batch_id=%s ya fue procesado anteriormente. Ignorando.",
                payload.batch_id,
            )
            result.skipped = True
            return result

        # ------------------------------------------------------------------ #
        # 2. Obtener el ciclo abierto o crearlo bajo demanda (RN-06)          #
        # ------------------------------------------------------------------ #
        from app.services.cycle_service import cycle_service
        try:
            ciclo = await cycle_service.get_active_cycle_or_fail(db)
        except ValueError as e:
            # RN-07: el ciclo de hoy ya fue cerrado
            logger.warning(
                "batch_id=%s rechazado: %s",
                payload.batch_id,
                str(e)
            )
            result.error = str(e)
            return result

        # ------------------------------------------------------------------ #
        # 3. Procesar en la sesión existente — el COMMIT lo hace el caller   #
        # ------------------------------------------------------------------ #
        try:
            await self._dispatch_by_mode(payload, ciclo, result, db)
            await self._register_batch(payload, db)
            
            # 4. Obtener contadores actualizados para el broadcast (M5 Fix)
            counters = await cycle_service.get_dashboard_counters(db)
            if counters:
                result.contadores_actuales = {
                    "salidos": counters.total_salidas,
                    "retornados": counters.total_retornos,
                    "vendidos_estimado": counters.articulos_en_transito,
                    "en_bodega": counters.total_en_bodega,
                    "alertas": counters.alertas_activas
                }

            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.exception(
                "Error procesando batch_id=%s. Rollback ejecutado.",
                payload.batch_id,
            )
            result.error = str(exc)

        return result

    # ---------------------------------------------------------------------- #
    # Despacho según modo                                                     #
    # ---------------------------------------------------------------------- #

    async def _dispatch_by_mode(
        self,
        payload: BatchMQTTPayload,
        ciclo: Ciclo,
        result: BatchResult,
        db: AsyncSession,
    ) -> None:
        modo = payload.modo.upper()

        if modo in (ModoPortal.SALIDA.value, ModoPortal.RETORNO.value):
            tipo_evento = (
                TipoEvento.SALIDA if modo == ModoPortal.SALIDA.value else TipoEvento.RETORNO
            )
            await self._process_movement_batch(payload, ciclo, tipo_evento, result, db)

        elif modo == ModoPortal.REGISTRO.value:
            # Stub: la lógica completa se implementa en TagService (tarea 2.3).
            # Por ahora sólo logea para que el pipeline MQTT no explote.
            logger.info(
                "batch_id=%s en modo REGISTRO. Delegando a TagService.",
                payload.batch_id,
            )
            from app.services.tag_service import tag_service
            result.registro_resultados = await tag_service.handle_registration_batch(payload, db)

        else:
            logger.warning(
                "batch_id=%s con modo desconocido '%s'. Ignorando tags.",
                payload.batch_id,
                payload.modo,
            )

    # ---------------------------------------------------------------------- #
    # Procesamiento SALIDA / RETORNO                                          #
    # ---------------------------------------------------------------------- #

    async def _process_movement_batch(
        self,
        payload: BatchMQTTPayload,
        ciclo: Ciclo,
        tipo_evento: TipoEvento,
        result: BatchResult,
        db: AsyncSession,
    ) -> None:
        """
        Por cada tag en el payload:
          - Si el EPC existe y está activo:
              * Si su último movimiento es igual al actual -> Crea alerta MOVIMIENTO_DUPLICADO.
              * Sino -> crea un Evento.
          - Si NO existe o está desactivada → crea una alerta TAG_DESCONOCIDA.

        Toda la operación corre dentro del begin() abierto por el llamador.
        """
        epcs = [tag.epc for tag in payload.tags]

        # Traer de BD todas las etiquetas activas del batch en una sola query
        stmt = select(Etiqueta).options(joinedload(Etiqueta.producto)).where(
            Etiqueta.epc.in_(epcs),
            Etiqueta.activa == True,  # noqa: E712
        )
        rows = await db.execute(stmt)
        etiquetas_conocidas: dict[str, Etiqueta] = {
            e.epc: e for e in rows.scalars().all()
        }

        # Traer el último evento registrado para estos EPCs en el ciclo actual
        from sqlalchemy import func
        subq = (
            select(
                Evento.epc,
                func.max(Evento.id).label("last_id")
            )
            .where(Evento.ciclo_id == ciclo.id, Evento.epc.in_(epcs))
            .group_by(Evento.epc)
            .subquery()
        )
        stmt_last_events = select(Evento).join(subq, Evento.id == subq.c.last_id)
        last_events_rows = await db.execute(stmt_last_events)
        last_events_by_epc: dict[str, Evento] = {
            e.epc: e for e in last_events_rows.scalars().all()
        }

        counts = Counter()

        for tag in payload.tags:
            etiqueta = etiquetas_conocidas.get(tag.epc)

            if etiqueta is None:
                # EPC desconocido o inactivo
                result.epcs_desconocidos.append(tag.epc)
                
                from app.services.alert_service import alert_service
                creada = await alert_service.create_tag_desconocida(
                    epc=tag.epc,
                    ciclo_id=ciclo.id,
                    timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
                    db=db
                )
                
                if creada:
                    result.alertas_creadas += 1
                    logger.debug("Alerta TAG_DESCONOCIDA creada en BD para EPC=%s", tag.epc)
                
                # Siempre enviamos la notificación al WS para dar feedback visual,
                # incluso si ya existía en BD y se evitó el spam
                result.alertas_generadas.append({
                    "type": "TAG_DESCONOCIDA",
                    "message": f"Etiqueta no reconocida: {tag.epc} detectada en portal"
                })
                continue

            nombre_producto = etiqueta.producto.nombre if etiqueta.producto else "Artículo Desconocido"

            # Verificar si es un movimiento duplicado o inválido
            # SALIDA: duplicado si el último evento ya fue SALIDA
            # RETORNO: duplicado/inválido si el último evento fue RETORNO o si no hay eventos hoy (ya está en bodega)
            ultimo_evento = last_events_by_epc.get(tag.epc)
            es_duplicado = False
            desc_alerta = ""

            if tipo_evento == TipoEvento.SALIDA:
                if ultimo_evento and ultimo_evento.tipo == TipoEvento.SALIDA:
                    es_duplicado = True
                    desc_alerta = f"Movimiento duplicado: '{nombre_producto}' ya fue registrado en SALIDA hoy."
            elif tipo_evento == TipoEvento.RETORNO:
                if ultimo_evento is None:
                    es_duplicado = True
                    desc_alerta = f"Movimiento inválido: '{nombre_producto}' ya está en bodega (no se registró salida hoy)."
                elif ultimo_evento.tipo == TipoEvento.RETORNO:
                    es_duplicado = True
                    desc_alerta = f"Movimiento duplicado: '{nombre_producto}' ya fue registrado en RETORNO hoy."

            if es_duplicado:
                from app.services.alert_service import alert_service
                creada = await alert_service.create_movimiento_duplicado(
                    epc=tag.epc,
                    nombre_producto=nombre_producto,
                    modo=tipo_evento.value,
                    ciclo_id=ciclo.id,
                    timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
                    db=db,
                    descripcion=desc_alerta
                )
                
                if creada:
                    result.alertas_creadas += 1
                    logger.debug("Alerta MOVIMIENTO_DUPLICADO creada en BD para EPC=%s", tag.epc)
                    
                # Siempre damos feedback visual en la Actividad Reciente del dashboard
                result.alertas_generadas.append({
                    "type": "MOVIMIENTO_DUPLICADO",
                    "message": desc_alerta
                })
                continue

            evento = Evento(
                epc=tag.epc,
                ciclo_id=ciclo.id,
                tipo=tipo_evento,
                producto_id=etiqueta.producto_id,
                batch_id=payload.batch_id,
                timestamp_esp32=tag.timestamp_esp32,
            )
            db.add(evento)
            result.eventos_creados += 1
            
            # Sumar al contador de artículos movidos
            counts[nombre_producto] += 1
            
        result.articulos_movidos = [{"nombre": k, "cantidad": v} for k, v in counts.items()]

        # Evaluar outliers si es un lote de retornos
        if tipo_evento == TipoEvento.RETORNO:
            from app.services.alert_service import alert_service
            await alert_service.evaluar_outliers_ciclo(ciclo.id, db)

    # ---------------------------------------------------------------------- #
    # Registro de idempotencia                                                #
    # ---------------------------------------------------------------------- #

    async def _register_batch(
        self,
        payload: BatchMQTTPayload,
        db: AsyncSession,
    ) -> None:
        """Escribe el registro de idempotencia. Llamar al FINAL de la transacción."""
        batch_record = BatchProcesado(
            batch_id=payload.batch_id,
            device_id=payload.device_id,
            procesado_exitosamente=True,
        )
        db.add(batch_record)

    # ---------------------------------------------------------------------- #
    # Helpers                                                                 #
    # ---------------------------------------------------------------------- #

    async def _is_duplicate(self, batch_id: str, db: AsyncSession) -> bool:
        stmt = select(BatchProcesado).where(BatchProcesado.batch_id == batch_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none() is not None

    # Ya no se necesita _get_ciclo_abierto, usamos CycleService


# Instancia singleton — se importa desde mqtt/client.py y desde los tests
batch_processor = BatchProcessor()
