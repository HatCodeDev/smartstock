from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, desc
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from app.config import settings
from typing import List, Dict, Any

from app.dependencies import get_db, get_current_user
from app.models.ciclo import Ciclo, EstadoCiclo
from app.models.evento import Evento, TipoEvento
from app.models.producto import Producto
from app.services.cycle_service import cycle_service

router = APIRouter(
    prefix="/api/reports", tags=["reports"], dependencies=[Depends(get_current_user)]
)

DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

@router.get("/averages")
async def get_weekday_averages(db: AsyncSession = Depends(get_db)):
    """
    Compara las ventas estimadas del ciclo actual con el promedio histórico 
    del mismo día de la semana para ciclos cerrados.
    """
    hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()
    dia_semana_hoy = hoy.weekday()  # 0 = Lunes, 6 = Domingo
    nombre_dia = DIAS_SEMANA[dia_semana_hoy]

    # 1. Obtener ventas históricas para ciclos cerrados
    stmt_historico = select(
        Ciclo.fecha,
        func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)).label("salidas"),
        func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)).label("retornos")
    ).outerjoin(Evento, Evento.ciclo_id == Ciclo.id).where(
        Ciclo.estado == EstadoCiclo.CERRADO
    ).group_by(Ciclo.id, Ciclo.fecha)
    
    res_historico = await db.execute(stmt_historico)
    historicos = res_historico.all()

    # Filtrar en Python por el mismo día de la semana
    ventas_mismo_dia = []
    for fecha, salidas, retornos in historicos:
        if fecha.weekday() == dia_semana_hoy:
            ventas_mismo_dia.append(max(0, (salidas or 0) - (retornos or 0)))

    promedio_historico = sum(ventas_mismo_dia) / len(ventas_mismo_dia) if ventas_mismo_dia else 0.0

    # 2. Obtener ventas estimadas de hoy (ciclo activo)
    ciclo_activo = await cycle_service.get_active_cycle(db)
    ventas_hoy = 0
    if ciclo_activo:
        stmt_hoy = select(
            func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)).label("salidas"),
            func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)).label("retornos")
        ).where(Evento.ciclo_id == ciclo_activo.id)
        res_hoy = await db.execute(stmt_hoy)
        salidas_hoy, retornos_hoy = res_hoy.first()
        ventas_hoy = max(0, (salidas_hoy or 0) - (retornos_hoy or 0))

    # 3. Calcular porcentaje de diferencia
    if promedio_historico > 0:
        diferencia_pct = round(((ventas_hoy - promedio_historico) / promedio_historico) * 100, 1)
    else:
        diferencia_pct = 0.0

    return {
        "dia_semana": nombre_dia,
        "promedio_historico": round(promedio_historico, 1),
        "ventas_hoy": ventas_hoy,
        "diferencia_pct": diferencia_pct
    }


@router.get("/trends")
async def get_weekly_trends(db: AsyncSession = Depends(get_db)):
    """
    Calcula y compara la tendencia de ventas por categoría en los últimos 7 días 
    vs los 7 días anteriores a esos.
    """
    hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()
    
    inicio_actual = hoy - timedelta(days=6)
    inicio_anterior = hoy - timedelta(days=13)
    fin_anterior = hoy - timedelta(days=7)

    # 1. Ventas por categoría - Período Actual (últimos 7 días, incluye hoy)
    stmt_actual = select(
        Producto.categoria,
        func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)).label("salidas"),
        func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)).label("retornos")
    ).join(Evento, Evento.producto_id == Producto.id).join(Ciclo, Ciclo.id == Evento.ciclo_id).where(
        Ciclo.fecha >= inicio_actual
    ).group_by(Producto.categoria)

    res_actual = await db.execute(stmt_actual)
    data_actual = {cat: max(0, (salidas or 0) - (retornos or 0)) for cat, salidas, retornos in res_actual.all()}

    # 2. Ventas por categoría - Período Anterior (días -14 a -7)
    stmt_anterior = select(
        Producto.categoria,
        func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)).label("salidas"),
        func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)).label("retornos")
    ).join(Evento, Evento.producto_id == Producto.id).join(Ciclo, Ciclo.id == Evento.ciclo_id).where(
        Ciclo.fecha >= inicio_anterior,
        Ciclo.fecha <= fin_anterior
    ).group_by(Producto.categoria)

    res_anterior = await db.execute(stmt_anterior)
    data_anterior = {cat: max(0, (salidas or 0) - (retornos or 0)) for cat, salidas, retornos in res_anterior.all()}

    # 3. Combinar y calcular porcentajes de cambio
    todas_categorias = set(data_actual.keys()).union(data_anterior.keys())
    trends = []

    for cat in todas_categorias:
        actual = data_actual.get(cat, 0)
        anterior = data_anterior.get(cat, 0)

        if anterior > 0:
            cambio_pct = round(((actual - anterior) / anterior) * 100, 1)
        elif actual > 0:
            cambio_pct = 100.0  # Incremento total de 0 a X
        else:
            cambio_pct = 0.0

        if cambio_pct > 5.0:
            tendencia = "UP"
        elif cambio_pct < -5.0:
            tendencia = "DOWN"
        else:
            tendencia = "STABLE"

        trends.append({
            "categoria": cat,
            "ventas_actual": actual,
            "ventas_anterior": anterior,
            "cambio_pct": cambio_pct,
            "tendencia": tendencia
        })

    return trends


from app.models.reporte_avanzado import TipoReporteAvanzado, ReporteAvanzado
from app.schemas.reporte_avanzado import ReporteAvanzadoResponse
from fastapi import Query, HTTPException, status, Response
from app.services.pdf_service import PDFReportGenerator

@router.get("/advanced", response_model=ReporteAvanzadoResponse)
async def get_advanced_report(
    tipo: TipoReporteAvanzado = Query(..., description="Tipo de reporte avanzado a consultar"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna el reporte avanzado en caché de tipo especificado (HOLT_WINTERS, K_MEANS)
    más reciente disponible.
    """
    stmt = select(ReporteAvanzado).where(
        ReporteAvanzado.tipo == tipo
    ).order_by(desc(ReporteAvanzado.fecha)).limit(1)

    res = await db.execute(stmt)
    reporte = res.scalar_one_or_none()

    if not reporte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró un reporte avanzado del tipo {tipo.value} en caché."
        )

    return reporte


@router.get("/shifts")
async def get_shifts_report(
    month: str = Query(None, description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna el listado de turnos/ciclos del mes especificado con sus métricas y KPIs.
    """
    from datetime import date
    from collections import defaultdict
    from app.models.alerta import Alerta

    if not month:
        month = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m")

    try:
        start_date = datetime.strptime(f"{month}-01", "%Y-%m-%d").date()
        if start_date.month == 12:
            end_date = date(start_date.year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(start_date.year, start_date.month + 1, 1) - timedelta(days=1)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de mes inválido. Debe ser YYYY-MM."
        )

    # 1. Obtener todos los ciclos del mes
    stmt = select(Ciclo).where(
        Ciclo.fecha >= start_date,
        Ciclo.fecha <= end_date
    ).order_by(desc(Ciclo.fecha), desc(Ciclo.creado_en))
    res = await db.execute(stmt)
    cycles = res.scalars().all()

    if not cycles:
        return []

    cycle_ids = [c.id for c in cycles]

    # 2. Agrupar eventos por ciclo en una sola query
    eventos_data = {}
    if cycle_ids:
        stmt_events = select(
            Evento.ciclo_id,
            func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)).label("salidas"),
            func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)).label("retornos")
        ).where(Evento.ciclo_id.in_(cycle_ids)).group_by(Evento.ciclo_id)
        res_events = await db.execute(stmt_events)
        eventos_data = {row.ciclo_id: (row.salidas or 0, row.retornos or 0) for row in res_events.all()}

    # 3. Agrupar alertas por ciclo en una sola query
    alertas_data = defaultdict(list)
    if cycle_ids:
        stmt_alerts = select(Alerta).where(Alerta.ciclo_id.in_(cycle_ids)).order_by(Alerta.timestamp.asc())
        res_alerts = await db.execute(stmt_alerts)
        for a in res_alerts.scalars().all():
            alertas_data[a.ciclo_id].append({
                "tipo": a.tipo.value,
                "descripcion": a.descripcion,
                "timestamp": a.timestamp
            })

    # 4. Formatear respuesta y evaluar KPIs
    result = []
    for c in cycles:
        salidas, retornos = eventos_data.get(c.id, (0, 0))
        alertas = alertas_data.get(c.id, [])

        duracion_segundos = None
        if c.cerrado_en and c.creado_en:
            duracion_segundos = (c.cerrado_en - c.creado_en).total_seconds()

        kpi_cumplido = False
        if c.estado == EstadoCiclo.CERRADO and not c.cierre_automatico:
            if duracion_segundos is not None and duracion_segundos < 12 * 3600:
                kpi_cumplido = True

        result.append({
            "id": c.id,
            "fecha": c.fecha,
            "creado_en": c.creado_en,
            "cerrado_en": c.cerrado_en,
            "estado": c.estado.value,
            "cierre_automatico": c.cierre_automatico,
            "salidas": salidas,
            "retornos": retornos,
            "alertas_count": len(alertas),
            "alertas": alertas,
            "kpi_cumplido": kpi_cumplido,
            "duracion_segundos": duracion_segundos
        })

    return result


@router.get("/download/pdf")
async def download_pdf_report(
    db: AsyncSession = Depends(get_db)
):
    """
    Genera y descarga un reporte analítico completo en PDF con diseño premium.
    """
    # 1. Obtener rendimiento de hoy y promedio histórico
    averages = await get_weekday_averages(db)
    
    # 2. Agregar productos críticos a averages
    stmt_critical = select(Producto).where(
        Producto.cantidad_inicial < Producto.stock_minimo,
        Producto.activo == True
    )
    res_critical = await db.execute(stmt_critical)
    critical_products = res_critical.scalars().all()
    averages["critical_products"] = [
        {
            "id": str(p.id),
            "nombre": p.nombre,
            "sku": p.sku,
            "stock_minimo": p.stock_minimo,
            "cantidad_inicial": p.cantidad_inicial
        }
        for p in critical_products
    ]
    
    # 3. Obtener tendencias semanales
    trends = await get_weekly_trends(db)
    
    # 4. Obtener reportes analíticos avanzados de caché
    # HOLT_WINTERS
    stmt_hw = select(ReporteAvanzado).where(
        ReporteAvanzado.tipo == TipoReporteAvanzado.HOLT_WINTERS
    ).order_by(desc(ReporteAvanzado.fecha)).limit(1)
    res_hw = await db.execute(stmt_hw)
    report_hw = res_hw.scalar_one_or_none()
    holt_winters = {"datos": report_hw.datos} if report_hw else {
        "datos": {
            "fechas": [],
            "pronostico_total": [],
            "por_categoria": {},
            "mensaje_inteligente": "Sin datos predictivos."
        }
    }

    # K_MEANS
    stmt_km = select(ReporteAvanzado).where(
        ReporteAvanzado.tipo == TipoReporteAvanzado.K_MEANS
    ).order_by(desc(ReporteAvanzado.fecha)).limit(1)
    res_km = await db.execute(stmt_km)
    report_km = res_km.scalar_one_or_none()
    kmeans = {"datos": report_km.datos} if report_km else {
        "datos": {
            "clusters": [],
            "total_productos_analizados": 0,
            "mensaje_inteligente": "Sin datos de agrupación."
        }
    }
    
    # 5. Obtener datos de turnos para el mes actual
    shifts_data = await get_shifts_report(month=None, db=db)
    
    # 5b. Obtener datos de tasas de retorno y tiempos de tránsito
    return_rates = await get_products_return_rates(db)
    transit_times = await get_categories_transit_lead_times(db)
    
    # 6. Generar PDF
    pdf_generator = PDFReportGenerator()
    pdf_bytes = pdf_generator.generate_pdf(
        averages=averages,
        trends=trends,
        holt_winters=holt_winters,
        kmeans=kmeans,
        shifts_data=shifts_data,
        return_rates=return_rates,
        transit_times=transit_times
    )
    
    # 6. Retornar response binario
    headers = {
        "Content-Disposition": "attachment; filename=Reporte_Analitico_SmartStock.pdf"
    }
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers=headers
    )


@router.get("/products/return-rates")
async def get_products_return_rates(db: AsyncSession = Depends(get_db)):
    """
    Retorna la tasa de retorno de exhibición (Exhibition Return Rate) para todos los productos activos 
    basada en ciclos cerrados (pasados), evaluada frente al umbral crítico configurado (default: 80%).
    """
    from app.models.configuracion import Configuracion

    # 1. Obtener el umbral crítico configurado
    config_result = await db.execute(select(Configuracion).limit(1))
    config = config_result.scalar_one_or_none()
    umbral = config.umbral_retorno_critico if config else 80.0

    # 2. Query para obtener salidas y retornos por producto en ciclos cerrados
    stmt = select(
        Producto.id,
        Producto.nombre,
        Producto.sku,
        Producto.categoria,
        func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)).label("salidas"),
        func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)).label("retornos")
    ).outerjoin(
        Evento, (Evento.producto_id == Producto.id)
    ).outerjoin(
        Ciclo, (Ciclo.id == Evento.ciclo_id)
    ).where(
        Producto.activo == True,
        (Ciclo.estado == EstadoCiclo.CERRADO) | (Ciclo.id == None)
    ).group_by(Producto.id, Producto.nombre, Producto.sku, Producto.categoria)

    res = await db.execute(stmt)
    products_data = res.all()

    result = []
    for p_id, nombre, sku, categoria, salidas, retornos in products_data:
        salidas = salidas or 0
        retornos = retornos or 0
        rate = round((retornos / salidas) * 100, 1) if salidas > 0 else 0.0
        excede = rate > umbral
        result.append({
            "id": str(p_id),
            "nombre": nombre,
            "sku": sku,
            "categoria": categoria,
            "total_salidas": salidas,
            "total_retornos": retornos,
            "return_rate": rate,
            "umbral_retorno_critico": umbral,
            "excede_umbral": excede
        })

    result.sort(key=lambda x: x["return_rate"], reverse=True)
    return result


@router.get("/categories/transit-lead-times")
async def get_categories_transit_lead_times(db: AsyncSession = Depends(get_db)):
    """
    Retorna el promedio de tiempo de tránsito en la calle por categoría (en horas).
    """
    # 1. Obtener todos los eventos ordenados por epc y timestamp
    stmt = select(
        Evento.epc,
        Evento.tipo,
        Evento.timestamp_servidor,
        Producto.categoria
    ).join(
        Producto, Evento.producto_id == Producto.id
    ).join(
        Ciclo, Evento.ciclo_id == Ciclo.id
    ).where(
        Producto.activo == True
    ).order_by(Evento.epc, Evento.timestamp_servidor.asc())

    res = await db.execute(stmt)
    events = res.all()

    # 2. Agrupar eventos por EPC para emparejar
    epc_events = {}
    for epc, tipo, timestamp, categoria in events:
        if not categoria:
            continue
        if epc not in epc_events:
            epc_events[epc] = []
        epc_events[epc].append((tipo, timestamp, categoria))

    # 3. Emparejar e ir calculando duraciones por categoría
    category_durations = {}
    for epc, evs in epc_events.items():
        last_salida_time = None
        last_categoria = None
        for tipo, timestamp, categoria in evs:
            if tipo == TipoEvento.SALIDA:
                last_salida_time = timestamp
                last_categoria = categoria
            elif tipo == TipoEvento.RETORNO:
                if last_salida_time and last_categoria == categoria:
                    duration_hours = (timestamp - last_salida_time).total_seconds() / 3600.0
                    duration_hours = max(0.0, duration_hours)
                    if categoria not in category_durations:
                        category_durations[categoria] = []
                    category_durations[categoria].append(duration_hours)
                    last_salida_time = None

    # 4. Formatear el promedio por categoría
    result = []
    for cat, durations in category_durations.items():
        avg_hours = round(sum(durations) / len(durations), 1) if durations else 0.0
        result.append({
            "categoria": cat,
            "transit_lead_time_hours": avg_hours,
            "total_transitos_medidos": len(durations)
        })

    # Si hay categorías activas sin tránsitos, incluirlas con 0.0
    stmt_cats = select(Producto.categoria).where(Producto.activo == True).distinct()
    res_cats = await db.execute(stmt_cats)
    all_cats = res_cats.scalars().all()
    
    existing_cats = {r["categoria"] for r in result}
    for cat in all_cats:
        if cat and cat not in existing_cats:
            result.append({
                "categoria": cat,
                "transit_lead_time_hours": 0.0,
                "total_transitos_medidos": 0
            })

    result.sort(key=lambda x: x["transit_lead_time_hours"], reverse=True)
    return result


