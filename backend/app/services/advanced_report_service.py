import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, desc, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.ciclo import Ciclo, EstadoCiclo
from app.models.evento import Evento, TipoEvento
from app.models.producto import Producto
from app.models.reporte_avanzado import ReporteAvanzado, TipoReporteAvanzado
from app.services.holt_winters import HoltWintersAdditive

logger = logging.getLogger(__name__)

class AdvancedReportService:
    """
    Servicio de analítica avanzada para SmartStock.
    Ejecuta algoritmos de Holt-Winters y K-Means y los persiste en caché.
    """

    async def generar_reportes_avanzados_ciclo(self, ciclo_id: int, db: AsyncSession) -> None:
        """
        Ejecuta el pipeline de analítica avanzada para el ciclo y la fecha correspondiente.
        Actualiza (o inserta) los tres reportes avanzados.
        """
        logger.info(f"Iniciando pipeline de analítica avanzada para el ciclo {ciclo_id}")
        
        # 1. Obtener ciclo
        ciclo = await db.get(Ciclo, ciclo_id)
        if not ciclo:
            logger.error(f"Ciclo {ciclo_id} no encontrado en la base de datos.")
            return
        
        fecha_analisis = ciclo.fecha
        logger.info(f"Fecha de análisis para reportes avanzados: {fecha_analisis}")

        # Ejecutar los algoritmos analíticos estacionales y de segmentación
        try:
            logger.debug("Iniciando Holt-Winters...")
            # B. Holt-Winters (Pronóstico de Demanda a 7 días)
            datos_hw = await self._calcular_holt_white(db, fecha_analisis)
            logger.debug("Guardando Holt-Winters...")
            await self._guardar_reporte(db, TipoReporteAvanzado.HOLT_WINTERS, fecha_analisis, datos_hw)

            logger.debug("Iniciando K-Means...")
            # C. K-Means (Segmentación de Productos)
            datos_km = await self._calcular_kmeans(db)
            logger.debug("Guardando K-Means...")
            await self._guardar_reporte(db, TipoReporteAvanzado.K_MEANS, fecha_analisis, datos_km)

            logger.info("Pipeline de analítica avanzada completado exitosamente.")
        except Exception as e:
            logger.error(f"Error ejecutando pipeline de analítica avanzada: {str(e)}", exc_info=True)
            raise e

    async def _guardar_reporte(self, db: AsyncSession, tipo: TipoReporteAvanzado, fecha: date, datos: dict) -> None:
        """Guarda un reporte avanzado en la base de datos, sobrescribiendo si ya existe para la misma fecha."""
        # Verificar si ya existe para la fecha y tipo
        stmt = select(ReporteAvanzado).where(
            ReporteAvanzado.tipo == tipo,
            ReporteAvanzado.fecha == fecha
        )
        res = await db.execute(stmt)
        reporte_existente = res.scalars().first()

        if reporte_existente:
            logger.info(f"Actualizando reporte existente de tipo {tipo.value} para la fecha {fecha}")
            reporte_existente.datos = datos
            reporte_existente.creado_en = datetime.now(timezone.utc).replace(tzinfo=None)
        else:
            logger.info(f"Creando nuevo reporte de tipo {tipo.value} para la fecha {fecha}")
            nuevo_reporte = ReporteAvanzado(
                tipo=tipo,
                fecha=fecha,
                datos=datos,
                creado_en=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add(nuevo_reporte)
        
        await db.flush()


    async def _calcular_holt_white(self, db: AsyncSession, fecha: date) -> dict:
        """
        Pronóstico de demanda a 7 días mediante Holt-Winters aditivo (suavizado triple exponencial).
        No contiene datos estáticos ni estacionalidad falsa; se basa puramente en los datos disponibles.
        """
        # Generar fechas futuras para la proyección
        fechas_futuras = [(fecha + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, 8)]
        
        # Obtener los últimos 30 ciclos cerrados de forma cronológica
        stmt_ciclos = select(Ciclo.id, Ciclo.fecha).where(Ciclo.estado == EstadoCiclo.CERRADO).order_by(desc(Ciclo.fecha)).limit(30)
        ciclos_res = await db.execute(stmt_ciclos)
        ciclos = list(ciclos_res.all())
        ciclos.reverse()  # Orden cronológico para series de tiempo
        
        y = []
        if ciclos:
            ciclos_ids = [c[0] for c in ciclos]
            # Contar salidas reales por ciclo
            stmt_salidas = select(
                Evento.ciclo_id,
                func.count(Evento.id)
            ).where(
                Evento.ciclo_id.in_(ciclos_ids),
                Evento.tipo == TipoEvento.SALIDA
            ).group_by(Evento.ciclo_id)
            
            res_salidas = await db.execute(stmt_salidas)
            salidas_por_ciclo = {c_id: count for c_id, count in res_salidas.all()}
            
            y = [salidas_por_ciclo.get(c_id, 0) for c_id, _ in ciclos]

        L = 7  # Estacionalidad semanal
        n_obs = len(y)
        
        # Lógica de cálculo o fallback si el historial es menor a dos temporadas completas (14 observaciones)
        if n_obs >= 14:
            # Utilizar el motor Holt-Winters nativo
            hw_model = HoltWintersAdditive(alpha=0.2, beta=0.1, gamma=0.3)
            raw_predictions, _ = hw_model.forecast(y, L=7, steps=7)
            pronostico_total = [max(0, int(round(val))) for val in raw_predictions]
        else:
            # Fallback dinámico si no hay historial suficiente: promedio simple
            promedio_diario = sum(y) / n_obs if n_obs > 0 else 0.0
            
            pronostico_total = []
            for m in range(1, 8):
                # Mantener una proyección plana conservadora sin estacionalidad irreal
                pronostico_total.append(int(round(promedio_diario)))

        # Proporciones reales por categorías presentes en la BD (Dinámico)
        stmt_cat_ventas = select(
            Producto.categoria,
            func.count(Evento.id)
        ).join(
            Evento, Evento.producto_id == Producto.id
        ).where(
            Evento.tipo == TipoEvento.SALIDA
        ).group_by(Producto.categoria)
        
        res_cat = await db.execute(stmt_cat_ventas)
        ventas_por_categoria = {cat: count for cat, count in res_cat.all() if cat}
        
        # Si no hay ventas, distribuir equitativamente entre las categorías existentes
        stmt_todas_categorias = select(Producto.categoria).where(Producto.activo == True).distinct()
        res_todas = await db.execute(stmt_todas_categorias)
        todas_categorias = [c for c in res_todas.scalars().all() if c]

        proporciones = {}
        categorias_esperadas = todas_categorias if todas_categorias else []
        
        total_salidas = sum(ventas_por_categoria.values())

        if total_salidas > 0 and categorias_esperadas:
            for cat in categorias_esperadas:
                proporciones[cat] = ventas_por_categoria.get(cat, 0) / total_salidas
        elif categorias_esperadas:
            # Distribución equitativa sin datos
            dist_eq = 1.0 / len(categorias_esperadas)
            for cat in categorias_esperadas:
                proporciones[cat] = dist_eq

        # Aplicar proporciones al pronóstico total
        por_categoria = {}
        for cat in categorias_esperadas:
            por_categoria[cat] = [int(round(val * proporciones.get(cat, 0))) for val in pronostico_total]

        # Insights dinámicos
        total_previsto = sum(pronostico_total)
        msg = f"Se prevé un volumen de {total_previsto} unidades en la próxima semana."
        if total_previsto == 0:
            msg = "No hay datos suficientes o historial de ventas para generar una proyección."
        elif total_previsto > 0 and por_categoria:
            # Encontrar categoría líder prevista
            lider = max(categorias_esperadas, key=lambda c: sum(por_categoria[c]))
            msg = f"Se prevé un movimiento activo. La categoría más demandada proyectada es '{lider}'."

        return {
            "fechas": fechas_futuras,
            "pronostico_total": pronostico_total,
            "por_categoria": por_categoria,
            "mensaje_inteligente": msg
        }

    async def _calcular_kmeans(self, db: AsyncSession) -> dict:
        """
        Segmenta los productos en 3 clusters ("Alta Rotación", "Rotación Media", "Stock Inactivo")
        utilizando una matriz RFV (Recency, Frequency, Volume) y el algoritmo K-Means en 3D normalizado.
        """
        # 1. Obtener todos los productos activos
        stmt_prod = select(Producto).where(Producto.activo == True)
        res_prod = await db.execute(stmt_prod)
        productos = res_prod.scalars().all()

        if not productos:
            return {
                "clusters": [],
                "mensaje_inteligente": "No hay productos activos para analizar.",
                "total_productos_analizados": 0
            }

        # 2. Determinar la fecha de referencia (último ciclo cerrado o hoy) para cálculo determinista de Recencia
        stmt_max_fecha = select(func.max(Ciclo.fecha)).where(Ciclo.estado == EstadoCiclo.CERRADO)
        max_fecha_res = await db.execute(stmt_max_fecha)
        fecha_referencia = max_fecha_res.scalar() or date.today()

        # 3. Consultar las métricas de Recencia, Frecuencia y Volumen neto en la base de datos
        # Subquery para calcular las ventas netas de cada producto por ciclo cerrado
        subq = (
            select(
                Evento.producto_id,
                Evento.ciclo_id,
                Ciclo.fecha.label("ciclo_fecha"),
                (
                    func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)) -
                    func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0))
                ).label("venta_neta")
            )
            .join(Ciclo, Evento.ciclo_id == Ciclo.id)
            .where(
                Ciclo.estado == EstadoCiclo.CERRADO,
                Evento.tipo.in_([TipoEvento.SALIDA, TipoEvento.RETORNO])
            )
            .group_by(Evento.producto_id, Evento.ciclo_id, Ciclo.fecha)
        ).subquery()

        # Query principal para agrupar las métricas RFV reales (ventas netas > 0)
        stmt_rfv = (
            select(
                subq.c.producto_id,
                func.max(subq.c.ciclo_fecha).label("ultima_fecha"),
                func.count(subq.c.ciclo_id).label("frecuencia"),
                func.sum(subq.c.venta_neta).label("volumen")
            )
            .where(subq.c.venta_neta > 0)
            .group_by(subq.c.producto_id)
        )

        res_rfv = await db.execute(stmt_rfv)
        rfv_data = {}
        for r in res_rfv.all():
            vol_neto = int(max(0, r.volumen)) if r.volumen is not None else 0
            rfv_data[r.producto_id] = (r.ultima_fecha, r.frecuencia, vol_neto)

        # 4. Construir la matriz de características RFV y realizar Min-Max scaling
        productos_features = []
        recencies = []
        frequencies = []
        volumes = []

        # Primero calcular la recencia máxima real existente para no inventar un valor
        max_recency_real = 0
        for p in productos:
            ultima_fecha, freq, vol = rfv_data.get(p.id, (None, 0, 0))
            if ultima_fecha:
                max_recency_real = max(max_recency_real, (fecha_referencia - ultima_fecha).days)
        
        # Valor de fallback dinámico
        recencia_fallback = max(max_recency_real, 30)

        for p in productos:
            ultima_fecha, freq, vol = rfv_data.get(p.id, (None, 0, 0))
            if ultima_fecha:
                recency = (fecha_referencia - ultima_fecha).days
            else:
                recency = recencia_fallback  # Recencia máxima dinámica para productos sin ventas

            recencies.append(recency)
            frequencies.append(freq)
            volumes.append(vol)

            productos_features.append({
                "producto": p,
                "recency_raw": recency,
                "frequency_raw": freq,
                "volume_raw": vol
            })

        min_r, max_r = min(recencies), max(recencies)
        min_f, max_f = min(frequencies), max(frequencies)
        min_v, max_v = min(volumes), max(volumes)

        # Normalizar a rango [0, 1]
        for pf in productos_features:
            pf["r_norm"] = (pf["recency_raw"] - min_r) / (max_r - min_r) if max_r > min_r else 0.5
            pf["f_norm"] = (pf["frequency_raw"] - min_f) / (max_f - min_f) if max_f > min_f else 0.5
            pf["v_norm"] = (pf["volume_raw"] - min_v) / (max_v - min_v) if max_v > min_v else 0.5

        # 5. Algoritmo K-Means en 3D con inicialización estable orientada al negocio
        # Centroides iniciales en el espacio normalizado [R, F, V]
        centroids = [
            [0.1, 0.9, 0.9],  # Centroide Alta Rotación (baja recencia, alta freq, alto volumen)
            [0.5, 0.5, 0.5],  # Centroide Rotación Media
            [0.9, 0.1, 0.1]   # Centroide Stock Inactivo (alta recencia, baja freq, bajo volumen)
        ]

        assignments = [-1] * len(productos_features)

        # Iterar hasta convergencia o un máximo de 100 iteraciones
        for iteration in range(100):
            new_assignments = []
            
            # Asignar cada punto al centroide más cercano (distancia euclidiana)
            for pf in productos_features:
                min_dist = float('inf')
                best_cluster = 0
                for k in range(3):
                    c = centroids[k]
                    dist = math.sqrt(
                        (pf["r_norm"] - c[0]) ** 2 +
                        (pf["f_norm"] - c[1]) ** 2 +
                        (pf["v_norm"] - c[2]) ** 2
                    )
                    if dist < min_dist:
                        min_dist = dist
                        best_cluster = k
                new_assignments.append(best_cluster)

            # Verificar convergencia
            if new_assignments == assignments:
                break
            assignments = new_assignments

            # Recalcular centroides
            cluster_points = {0: [], 1: [], 2: []}
            for idx, pf in enumerate(productos_features):
                cluster_points[assignments[idx]].append(pf)

            for k in range(3):
                pts = cluster_points[k]
                if pts:
                    avg_r = sum(p["r_norm"] for p in pts) / len(pts)
                    avg_f = sum(p["f_norm"] for p in pts) / len(pts)
                    avg_v = sum(p["v_norm"] for p in pts) / len(pts)
                    centroids[k] = [avg_r, avg_f, avg_v]

        # 6. Agrupamiento final y etiquetado dinámico de clusters según volumen de ventas promedio
        groups = {0: [], 1: [], 2: []}
        for idx, pf in enumerate(productos_features):
            groups[assignments[idx]].append(pf)

        group_stats = []
        for k in range(3):
            pts = groups[k]
            avg_vol = sum(p["volume_raw"] for p in pts) / len(pts) if pts else -1.0
            group_stats.append((k, avg_vol))

        # Ordenar clusters de mayor a menor volumen promedio real para evitar transposición de etiquetas
        group_stats.sort(key=lambda x: x[1], reverse=True)

        alta_idx = group_stats[0][0]
        media_idx = group_stats[1][0]
        baja_idx = group_stats[2][0]

        cluster_alta = groups[alta_idx]
        cluster_media = groups[media_idx]
        cluster_baja = groups[baja_idx]

        # Formatear el listado de productos para cada cluster (limitando a 10 productos para vista móvil)
        def format_cluster_products(pts):
            sorted_pts = sorted(pts, key=lambda x: x["volume_raw"], reverse=True)
            out = []
            for pf in sorted_pts[:10]:
                p = pf["producto"]
                out.append({
                    "id": str(p.id),
                    "nombre": p.nombre,
                    "sku": p.sku,
                    "categoria": p.categoria,
                    "ventas": pf["volume_raw"],
                    "stock": p.cantidad_inicial
                })
            return out

        clusters_output = [
            {
                "nombre": "Alta Rotación",
                "descripcion": "Productos con venta diaria masiva. Requieren reabastecimiento continuo.",
                "metrica_promedio_ventas": round(sum(p["volume_raw"] for p in cluster_alta) / len(cluster_alta), 1) if cluster_alta else 0.0,
                "productos": format_cluster_products(cluster_alta)
            },
            {
                "nombre": "Rotación Media",
                "descripcion": "Productos estables. Mantienen un ritmo constante.",
                "metrica_promedio_ventas": round(sum(p["volume_raw"] for p in cluster_media) / len(cluster_media), 1) if cluster_media else 0.0,
                "productos": format_cluster_products(cluster_media)
            },
            {
                "nombre": "Stock Inactivo",
                "descripcion": "Productos con nulo o bajísimo movimiento. Riesgo de estancamiento.",
                "metrica_promedio_ventas": round(sum(p["volume_raw"] for p in cluster_baja) / len(cluster_baja), 1) if cluster_baja else 0.0,
                "productos": format_cluster_products(cluster_baja)
            }
        ]

        # Insight inteligente dinámico
        n_inactivos = len(cluster_baja)
        msg = f"Tenés {n_inactivos} productos clasificados en 'Stock Inactivo'. Te recomendamos armar combos con productos de 'Alta Rotación' para liquidar este inventario."
        if n_inactivos == 0:
            msg = "¡Excelente rotación general! Todos tus productos se están moviendo activamente."

        return {
            "clusters": clusters_output,
            "mensaje_inteligente": msg,
            "total_productos_analizados": len(productos)
        }

# Instancia singleton del servicio
advanced_report_service = AdvancedReportService()
