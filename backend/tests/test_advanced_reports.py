import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, date, timedelta
from unittest.mock import patch
from tests.conftest import async_session_maker_test
from app.dependencies import get_current_user
from app.main import app
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.evento import Evento, TipoEvento
from app.models.producto import Producto
from app.models.reporte_avanzado import ReporteAvanzado, TipoReporteAvanzado
from app.services.advanced_report_service import advanced_report_service
from app.scheduler.jobs import advanced_analytics_pipeline_job


# Sobrescribimos get_current_user para saltar la autenticación en estas pruebas
async def override_get_current_user():
    return {"id": 1, "username": "admin"}

app.dependency_overrides[get_current_user] = override_get_current_user

@pytest.mark.asyncio
async def test_create_reporte_avanzado_db(db_session: AsyncSession):
    """Prueba la inserción y consulta directa del modelo ReporteAvanzado."""
    hoy = date.today()
    datos_test = {"clusters": [{"nombre": "Alta Rotación", "productos": []}]}
    
    reporte = ReporteAvanzado(
        tipo=TipoReporteAvanzado.K_MEANS,
        fecha=hoy,
        datos=datos_test
    )
    db_session.add(reporte)
    await db_session.commit()

    # Buscar en la BD
    stmt = select(ReporteAvanzado).where(
        ReporteAvanzado.tipo == TipoReporteAvanzado.K_MEANS,
        ReporteAvanzado.fecha == hoy
    )
    res = await db_session.execute(stmt)
    db_reporte = res.scalar_one_or_none()

    assert db_reporte is not None
    assert db_reporte.tipo == TipoReporteAvanzado.K_MEANS
    assert db_reporte.datos == datos_test
    assert db_reporte.fecha == hoy

@pytest.mark.asyncio
async def test_advanced_report_service_calculates_all(db_session: AsyncSession):
    """Prueba que el AdvancedReportService calcula y persiste los tres tipos de análisis."""
    # 1. Crear un ciclo activo/cerrado
    hoy = date.today()
    ciclo = Ciclo(
        estado=EstadoCiclo.CERRADO,
        fecha=hoy,
        modo_portal=ModoPortal.APAGADO,
        cerrado_en=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db_session.add(ciclo)
    
    # 2. Agregar productos
    p1 = Producto(nombre="Sábana de cajón matrimonial", sku="SAB01", categoria="Sábanas", cantidad_inicial=10)
    p2 = Producto(nombre="Sábana plana matrimonial", sku="SAB02", categoria="Sábanas", cantidad_inicial=8)
    db_session.add(p1)
    db_session.add(p2)
    await db_session.flush()

    # Agregar eventos para simular ventas y rotación
    db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC1", producto_id=p1.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))
    db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC2", producto_id=p2.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))
    await db_session.commit()

    # 3. Ejecutar el pipeline de analítica
    await advanced_report_service.generar_reportes_avanzados_ciclo(ciclo.id, db_session)
    await db_session.commit()

    # 4. Verificar que se persistieron los 2 reportes
    stmt = select(ReporteAvanzado).where(ReporteAvanzado.fecha == hoy)
    res = await db_session.execute(stmt)
    reportes = res.scalars().all()

    assert len(reportes) == 2
    tipos = {r.tipo for r in reportes}
    assert TipoReporteAvanzado.HOLT_WINTERS in tipos
    assert TipoReporteAvanzado.K_MEANS in tipos

    reporte_hw = next(r for r in reportes if r.tipo == TipoReporteAvanzado.HOLT_WINTERS)
    assert "fechas" in reporte_hw.datos
    assert "pronostico_total" in reporte_hw.datos
    assert "por_categoria" in reporte_hw.datos

    reporte_km = next(r for r in reportes if r.tipo == TipoReporteAvanzado.K_MEANS)
    assert "clusters" in reporte_km.datos
    assert len(reporte_km.datos["clusters"]) == 3

@pytest.mark.asyncio
async def test_get_advanced_report_endpoint_404(client: AsyncClient, db_session: AsyncSession):
    """Valida que responda 404 cuando no existe reporte en caché."""
    response = await client.get("/api/reports/advanced?tipo=K_MEANS")
    assert response.status_code == 404
    assert "No se encontró" in response.json()["detail"]

@pytest.mark.asyncio
async def test_get_advanced_report_endpoint_success(client: AsyncClient, db_session: AsyncSession):
    """Valida el retorno exitoso de un reporte avanzado en caché."""
    hoy = date.today()
    datos_test = {
        "clusters": [{"nombre": "Alta Rotación", "productos": []}],
        "total_productos_analizados": 12
    }
    
    reporte = ReporteAvanzado(
        tipo=TipoReporteAvanzado.K_MEANS,
        fecha=hoy,
        datos=datos_test
    )
    db_session.add(reporte)
    await db_session.commit()

    response = await client.get("/api/reports/advanced?tipo=K_MEANS")
    assert response.status_code == 200
    
    data = response.json()
    assert data["tipo"] == "K_MEANS"
    assert data["fecha"] == hoy.strftime("%Y-%m-%d")
    assert data["datos"] == datos_test

@pytest.mark.asyncio
async def test_advanced_analytics_pipeline_job(db_session: AsyncSession):
    """Prueba que el job asíncrono ejecuta el pipeline correctamente."""
    # 1. Crear un ciclo
    hoy = date.today()
    ciclo = Ciclo(
        estado=EstadoCiclo.CERRADO,
        fecha=hoy,
        modo_portal=ModoPortal.APAGADO,
        cerrado_en=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db_session.add(ciclo)
    await db_session.commit()

    # 2. Ejecutar el job directamente de forma asíncrona usando la sesión de test
    with patch("app.scheduler.jobs.async_session_maker", async_session_maker_test):
        await advanced_analytics_pipeline_job(ciclo.id)

    # 3. Verificar en la base de datos de test si se crearon los reportes
    stmt = select(ReporteAvanzado).where(ReporteAvanzado.fecha == hoy)
    res = await db_session.execute(stmt)
    reportes = res.scalars().all()
    assert len(reportes) == 2


@pytest.mark.asyncio
async def test_kmeans_discount_returns_at_cycle_level(db_session: AsyncSession):
    """
    Verifica que KMeans descuente correctamente los retornos a nivel de ciclo
    y agrupe la frecuencia y el volumen en base a las ventas netas reales.
    """
    from sqlalchemy import func, case
    hoy = date.today()
    ayer = hoy - timedelta(days=1)
    
    # 1. Crear ciclos cerrados
    ciclo_ayer = Ciclo(
        estado=EstadoCiclo.CERRADO,
        fecha=ayer,
        modo_portal=ModoPortal.APAGADO,
        cerrado_en=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    ciclo_hoy = Ciclo(
        estado=EstadoCiclo.CERRADO,
        fecha=hoy,
        modo_portal=ModoPortal.APAGADO,
        cerrado_en=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db_session.add(ciclo_ayer)
    db_session.add(ciclo_hoy)
    
    # 2. Agregar un producto
    p = Producto(nombre="Producto Test KMeans", sku="TESTKM01", categoria="Test", cantidad_inicial=10)
    db_session.add(p)
    await db_session.flush()
    
    # 3. Registrar eventos
    # Ciclo Ayer: 2 salidas y 2 retornos (venta neta = 0).
    db_session.add(Evento(ciclo_id=ciclo_ayer.id, epc="EPC1", producto_id=p.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))
    db_session.add(Evento(ciclo_id=ciclo_ayer.id, epc="EPC2", producto_id=p.id, tipo=TipoEvento.SALIDA, timestamp_esp32=2))
    db_session.add(Evento(ciclo_id=ciclo_ayer.id, epc="EPC1", producto_id=p.id, tipo=TipoEvento.RETORNO, timestamp_esp32=3))
    db_session.add(Evento(ciclo_id=ciclo_ayer.id, epc="EPC2", producto_id=p.id, tipo=TipoEvento.RETORNO, timestamp_esp32=4))
    
    # Ciclo Hoy: 1 salida (venta neta = 1).
    db_session.add(Evento(ciclo_id=ciclo_hoy.id, epc="EPC3", producto_id=p.id, tipo=TipoEvento.SALIDA, timestamp_esp32=5))
    await db_session.commit()
    
    # 4. Consultar las métricas mediante la subquery refactorizada
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
    
    res = await db_session.execute(stmt_rfv)
    fila = res.first()
    
    assert fila is not None
    assert fila.producto_id == p.id
    # La última fecha con ventas netas reales > 0 debe ser hoy
    assert fila.ultima_fecha == hoy
    # La frecuencia de ciclos con ventas netas > 0 debe ser 1 (solo hoy, ayer neto fue 0)
    assert fila.frecuencia == 1
    # El volumen acumulado neto de ventas debe ser 1
    assert fila.volumen == 1
    
    # 5. También verificar que el servicio _calcular_kmeans retorne el volumen de 1 en el cluster
    datos_km = await advanced_report_service._calcular_kmeans(db_session)
    encontrado = None
    for cluster in datos_km["clusters"]:
        for prod in cluster["productos"]:
            if prod["sku"] == "TESTKM01":
                encontrado = prod
                break
                
    assert encontrado is not None
    assert encontrado["ventas"] == 1



