import re

file_path = r'c:\Users\misae\smartstock\backend\app\services\advanced_report_service.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
content = content.replace(
    'from app.models.reporte_avanzado import ReporteAvanzado, TipoReporteAvanzado',
    'from app.models.reporte_avanzado import ReporteAvanzado, TipoReporteAvanzado\nfrom app.services.fp_growth import FPGrowth'
)

# 2. Replace FP Growth
# We match from "    async def _calcular_fp_growth(self, db: AsyncSession, fecha: date) -> dict:"
# up to "    async def _calcular_holt_white"
pattern_fp = re.compile(r'(    async def _calcular_fp_growth.*?)(?=    async def _calcular_holt_white)', re.DOTALL)

new_fp = '''    async def _calcular_fp_growth(self, db: AsyncSession, fecha: date) -> dict:
        """
        Ejecuta minería de reglas de asociación utilizando la implementación nativa de FP-Growth.
        Mapea co-ocurrencias en los lotes de ventas diarios sin datos falsos.
        """
        # Consultar ventas reales de los últimos ciclos cerrados en una sola query optimizada
        stmt_ciclos = select(Ciclo.id).where(Ciclo.estado == EstadoCiclo.CERRADO).order_by(desc(Ciclo.fecha)).limit(30)
        ciclos_ids = (await db.execute(stmt_ciclos)).scalars().all()

        transacciones = []
        if ciclos_ids:
            # Obtener todos los eventos de los últimos ciclos ordenados cronológicamente
            stmt_eventos = select(
                Evento.ciclo_id,
                Evento.epc,
                Evento.tipo,
                Producto.nombre
            ).join(
                Producto, Evento.producto_id == Producto.id
            ).where(
                Evento.ciclo_id.in_(ciclos_ids)
            ).order_by(
                Evento.ciclo_id, Evento.timestamp_esp32.asc()
            )
            
            res_eventos = await db.execute(stmt_eventos)
            eventos = res_eventos.all()
            
            # Agrupar eventos por ciclo
            eventos_por_ciclo = {}
            for ciclo_id, epc, tipo, prod_nombre in eventos:
                if ciclo_id not in eventos_por_ciclo:
                    eventos_por_ciclo[ciclo_id] = {}
                eventos_por_ciclo[ciclo_id][epc] = (tipo, prod_nombre)
            
            # Determinar productos realmente vendidos (último evento en ciclo es SALIDA)
            for c_id in ciclos_ids:
                if c_id in eventos_por_ciclo:
                    epcs_dict = eventos_por_ciclo[c_id]
                    vendidos = []
                    for epc, (tipo, prod_nombre) in epcs_dict.items():
                        if tipo == TipoEvento.SALIDA:
                            vendidos.append(prod_nombre)
                    if vendidos:
                        transacciones.append(vendidos)

        n_transacciones = len(transacciones)
        reglas_finales = []

        if n_transacciones > 0:
            # Utilizar el motor FP-Growth nativo
            fp_growth = FPGrowth(min_support=0.05, min_confidence=0.3)
            frequent_patterns = fp_growth.find_frequent_patterns(transacciones)
            reglas_generadas = fp_growth.generate_rules(frequent_patterns, n_transacciones)
            
            # Ordenar por confianza descendente y limitar a las mejores 5
            reglas_finales = sorted(reglas_generadas, key=lambda x: x["confianza"], reverse=True)[:5]

        return {
            "reglas": reglas_finales,
            "total_transacciones_analizadas": n_transacciones
        }

'''
content = pattern_fp.sub(new_fp, content)


# 3. Replace Holt-Winters
pattern_hw = re.compile(r'(    async def _calcular_holt_white.*?)(?=    async def _calcular_kmeans)', re.DOTALL)
new_hw = '''    async def _calcular_holt_white(self, db: AsyncSession, fecha: date) -> dict:
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
            # Algoritmo Holt-Winters Triple Exponencial Aditivo
            alpha = 0.2
            beta = 0.1
            gamma = 0.3
            
            # Inicialización de nivel a_0 (promedio de la primera semana)
            a_prev = sum(y[:L]) / L
            
            # Inicialización de tendencia b_0 (promedio de diferencias entre la segunda y la primera semana)
            b_prev = sum((y[i + L] - y[i]) / L for i in range(L)) / L
            
            # Inicialización de factores estacionales
            seasonal_factors = [y[i] - a_prev for i in range(L)]
            
            # Ciclo de actualización iterativo
            for t in range(L, n_obs):
                y_t = y[t]
                s_t_minus_L = seasonal_factors[t - L]
                
                # Nivel
                a_curr = alpha * (y_t - s_t_minus_L) + (1 - alpha) * (a_prev + b_prev)
                # Tendencia
                b_curr = beta * (a_curr - a_prev) + (1 - beta) * b_prev
                # Factor estacional
                s_curr = gamma * (y_t - a_curr) + (1 - gamma) * s_t_minus_L
                
                a_prev = a_curr
                b_prev = b_curr
                seasonal_factors.append(s_curr)
                
            # Proyección para los próximos 7 días (m = 1 a 7)
            pronostico_total = []
            for m in range(1, 8):
                dia_futuro = fecha + timedelta(days=m)
                dia_semana = dia_futuro.weekday()
                s_idx = len(seasonal_factors) - L + (m - 1) % L
                val = a_prev + m * b_prev + seasonal_factors[s_idx]
                val_lim = max(0, int(round(val)))
                pronostico_total.append(val_lim)
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

'''
content = pattern_hw.sub(new_hw, content)


# 4. Replace K-Means recency fallback
# Target:
#         for p in productos:
#             ultima_fecha, freq, vol = rfv_data.get(p.id, (None, 0, 0))
#             if ultima_fecha:
#                 recency = (fecha_referencia - ultima_fecha).days
#             else:
#                 recency = 60  # Recencia máxima por defecto para productos sin ventas
# 
#             recencies.append(recency)
#             frequencies.append(freq)
#             volumes.append(vol)

old_kmeans_chunk = """        for p in productos:
            ultima_fecha, freq, vol = rfv_data.get(p.id, (None, 0, 0))
            if ultima_fecha:
                recency = (fecha_referencia - ultima_fecha).days
            else:
                recency = 60  # Recencia máxima por defecto para productos sin ventas

            recencies.append(recency)
            frequencies.append(freq)
            volumes.append(vol)"""

new_kmeans_chunk = """        # Primero calcular la recencia máxima real existente para no inventar un valor
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
            volumes.append(vol)"""

content = content.replace(old_kmeans_chunk, new_kmeans_chunk)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
