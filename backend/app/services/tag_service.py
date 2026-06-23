"""
TagService — Gestión de etiquetas, sesiones de registro (REGISTRO mode) y resolución de conflictos.

Responsabilidades:
  1. Mantener sesión en memoria de qué producto se está registrando.
  2. Procesar batches en modo REGISTRO:
       - CASO A: EPC nuevo → inserta y asocia.
       - CASO B: EPC existente del mismo producto → ignora.
       - CASO C: EPC existente de otro producto → marca como conflicto en la sesión.
  3. Resolver conflictos (reasignar).
  4. Desvincular etiquetas.
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.etiqueta import Etiqueta
from app.models.producto import Producto
from app.schemas.batch import BatchMQTTPayload
from app.schemas.tags import (
    TagRegistrationStatus,
    ScanBatchStartRequest,
    ScanBatchStartResponse,
    ResolveConflictsRequest,
)

logger = logging.getLogger(__name__)


@dataclass
class RegistrationSession:
    session_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    conflicts: set[str] = field(default_factory=set)


class TagService:
    def __init__(self):
        # Almacenamiento en memoria para la sesión activa de registro
        self._active_session: Optional[RegistrationSession] = None

    # ----------------------------------------------------------------------- #
    # 1. Gestión de la Sesión de Registro
    # ----------------------------------------------------------------------- #

    async def start_registration_session(
        self,
        request: ScanBatchStartRequest,
        db: AsyncSession
    ) -> ScanBatchStartResponse:
        """Inicia una sesión de registro para un producto específico."""
        producto = await db.get(Producto, request.product_id)
        if not producto:
            raise ValueError(f"Producto {request.product_id} no encontrado")

        session_id = uuid.uuid4()
        self._active_session = RegistrationSession(
            session_id=session_id,
            product_id=producto.id,
            product_name=producto.nombre,
        )
        
        logger.info(
            "Sesión de registro %s iniciada para producto %s (%s)",
            session_id, producto.nombre, producto.id
        )
        return ScanBatchStartResponse(
            session_id=session_id,
            product_name=producto.nombre
        )

    def get_active_session(self) -> Optional[RegistrationSession]:
        return self._active_session

    def invalidate_session(self) -> None:
        """Limpia la sesión de registro."""
        if self._active_session:
            logger.info("Sesión de registro %s invalidada.", self._active_session.session_id)
            self._active_session = None

    # ----------------------------------------------------------------------- #
    # 2. Procesamiento de Batch (Modo REGISTRO)
    # ----------------------------------------------------------------------- #

    async def handle_registration_batch(
        self,
        payload: BatchMQTTPayload,
        db: AsyncSession
    ) -> list[TagRegistrationStatus]:
        """
        Procesa el batch según SKILL.md.
        Se ejecuta dentro de una transacción gestionada por el caller.
        """
        session = self._active_session
        if not session:
            logger.warning("Recibido batch de REGISTRO sin sesión activa.")
            return []

        epcs = [tag.epc for tag in payload.tags]
        if not epcs:
            return []

        from sqlalchemy.orm import joinedload
        # Obtener todas las etiquetas que ya existen en la BD
        stmt = select(Etiqueta).options(joinedload(Etiqueta.producto)).where(Etiqueta.epc.in_(epcs))
        rows = await db.execute(stmt)
        existentes: dict[str, Etiqueta] = {e.epc: e for e in rows.scalars().all()}

        # Obtener el producto para actualizar su stock (M5 Fix)
        producto = await db.get(Producto, session.product_id)

        resultados = []

        for tag in payload.tags:
            etiqueta = existentes.get(tag.epc)

            if etiqueta is None:
                # CASO A: Nueva etiqueta
                nueva_etiqueta = Etiqueta(
                    epc=tag.epc,
                    producto_id=session.product_id,
                    activa=True,
                    asignada_en=datetime.now(timezone.utc).replace(tzinfo=None)
                )
                db.add(nueva_etiqueta)
                
                # Incrementar stock si el producto existe
                if producto:
                    producto.cantidad_inicial += 1

                resultados.append(
                    TagRegistrationStatus(epc=tag.epc, status="new", message="Registrada")
                )
            elif etiqueta.producto_id == session.product_id:
                # CASO B: Existe y es del mismo producto → Ignorar o Reactivar si está inactiva
                if not etiqueta.activa:
                    etiqueta.activa = True
                    if producto:
                        producto.cantidad_inicial += 1
                    resultados.append(
                        TagRegistrationStatus(epc=tag.epc, status="new", message="Reactivada")
                    )
                else:
                    resultados.append(
                        TagRegistrationStatus(epc=tag.epc, status="duplicate", message="Ya asociada")
                    )
            else:
                # CASO C: Conflicto (pertenece a otro producto)
                session.conflicts.add(tag.epc)
                orig_name = etiqueta.producto.nombre if etiqueta.producto else "Producto Desconocido"
                resultados.append(
                    TagRegistrationStatus(
                        epc=tag.epc,
                        status="conflict",
                        message="Pertenece a otro producto",
                        original_product_name=orig_name
                    )
                )

        # Post-process conflicts to determine derived_state
        conflict_epcs = [r.epc for r in resultados if r.status == "conflict"]
        if conflict_epcs:
            derived_states = await self._get_derived_states(conflict_epcs, db)
            for r in resultados:
                if r.status == "conflict":
                    r.derived_state = derived_states.get(r.epc, "reassignable")

        return resultados

    async def _get_derived_states(self, epcs: list[str], db: AsyncSession) -> dict[str, str]:
        """Calcula el estado derivado de una lista de EPCs basado en su último evento."""
        from sqlalchemy import func
        from sqlalchemy.orm import joinedload
        from app.models.evento import Evento, TipoEvento
        from app.models.ciclo import Ciclo, EstadoCiclo

        if not epcs:
            return {}

        # Subquery to get max timestamp for each EPC
        subq = (
            select(Evento.epc, func.max(Evento.timestamp_servidor).label("max_ts"))
            .where(Evento.epc.in_(epcs))
            .group_by(Evento.epc)
            .subquery()
        )

        stmt = (
            select(Evento)
            .options(joinedload(Evento.ciclo))
            .join(subq, (Evento.epc == subq.c.epc) & (Evento.timestamp_servidor == subq.c.max_ts))
        )

        latest_events = (await db.execute(stmt)).scalars().all()

        states = {epc: "reassignable" for epc in epcs}

        for ev in latest_events:
            if ev.tipo == TipoEvento.RETORNO:
                states[ev.epc] = "blocked_return"
            elif ev.tipo == TipoEvento.SALIDA:
                if ev.ciclo and ev.ciclo.estado == EstadoCiclo.ABIERTO:
                    states[ev.epc] = "blocked_transit"
                else:
                    states[ev.epc] = "recyclable"

        return states


    # ----------------------------------------------------------------------- #
    # 3. Resolución de Conflictos
    # ----------------------------------------------------------------------- #

    async def resolve_conflicts(
        self,
        request: ResolveConflictsRequest,
        db: AsyncSession
    ) -> None:
        """
        Resuelve los conflictos guardados en la sesión.
        Toda esta operación debe estar envuelta en un transaccional por el caller (o FastAPI).
        """
        session = self._active_session
        if not session or session.session_id != request.session_id:
            raise ValueError("Sesión de registro inválida o expirada")

        if request.action == "cancel":
            self.invalidate_session()
            return

        if request.action == "reassign_all":
            # Extraemos los EPCs que la sesión tiene marcados como conflictos
            # (para evitar que inyecten EPCs no escaneados)
            epcs_a_reasignar = [
                d.epc for d in request.decisions if d.epc in session.conflicts
            ]

            if epcs_a_reasignar:
                # Validar estrictamente los estados derivados
                derived_states = await self._get_derived_states(epcs_a_reasignar, db)
                for epc in epcs_a_reasignar:
                    state = derived_states.get(epc, "reassignable")
                    if state in ("blocked_transit", "blocked_return"):
                        raise ValueError(f"Las etiquetas bloqueadas ({state}) no pueden ser reasignadas.")

                stmt = select(Etiqueta).where(Etiqueta.epc.in_(epcs_a_reasignar))
                etiquetas_db = (await db.execute(stmt)).scalars().all()
                etiquetas_map = {e.epc: e for e in etiquetas_db}

                # Diccionario para agrupar deducciones (product_id -> cantidad a restar)
                deducciones: dict[uuid.UUID, int] = {}
                tags_reasignadas = 0

                for decision in request.decisions:
                    if decision.epc not in etiquetas_map:
                        continue
                    
                    state = derived_states.get(decision.epc, "reassignable")

                    etiqueta = etiquetas_map[decision.epc]
                    prod_original_id = etiqueta.producto_id

                    # 1. Actualizar producto de la etiqueta y activarla
                    etiqueta.producto_id = session.product_id
                    etiqueta.activa = True
                    etiqueta.asignada_en = datetime.now(timezone.utc).replace(tzinfo=None)
                    tags_reasignadas += 1

                    # 2. Registrar deducción si corresponde (solo si no fue Vendido/recyclable)
                    # Forzar override: si es recyclable, NUNCA se deduce sin importar lo que pida el FE.
                    # Si es reassignable, respetamos la decisión del FE (o la forzamos a True según regla de negocio).
                    if decision.deduct_from_original and prod_original_id and state == "reassignable":
                        deducciones[prod_original_id] = deducciones.get(prod_original_id, 0) + 1

                # 3. Aplicar deducciones al producto original
                for prod_id, cant in deducciones.items():
                    prod = await db.get(Producto, prod_id)
                    if prod and prod.cantidad_inicial >= cant:
                        prod.cantidad_inicial -= cant
                    elif prod:
                        prod.cantidad_inicial = 0
                        
                # 4. Incrementar stock del producto destino (Tag-driven inventory)
                if tags_reasignadas > 0:
                    prod_destino = await db.get(Producto, session.product_id)
                    if prod_destino:
                        prod_destino.cantidad_inicial += tags_reasignadas

        self.invalidate_session()

    # ----------------------------------------------------------------------- #
    # 4. Desvinculación de Etiquetas
    # ----------------------------------------------------------------------- #

    async def unlink_tag(self, epc: str, db: AsyncSession) -> None:
        """Desvincula una etiqueta de su producto pero no la elimina."""
        etiqueta = await db.get(Etiqueta, epc)
        if not etiqueta:
            raise ValueError(f"Etiqueta {epc} no encontrada")

        etiqueta.producto_id = None
        etiqueta.activa = False


tag_service = TagService()
