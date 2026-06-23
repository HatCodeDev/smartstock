import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from app.config import settings
from app.dependencies import get_current_user
from app.main import app
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.evento import Evento, TipoEvento
from app.models.producto import Producto
from app.models.alerta import Alerta, TipoAlerta
from app.services.alert_service import alert_service

# Sobrescribimos get_current_user para saltar la autenticación en estas pruebas
async def override_get_current_user():
    return {"id": 1, "username": "admin"}

app.dependency_overrides[get_current_user] = override_get_current_user


@pytest.mark.asyncio
async def test_get_weekday_averages(client: AsyncClient, db_session: AsyncSession):
    # 1. Crear un ciclo histórico CERRADO el mismo día de la semana que hoy.
    hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()
    dia_semana_hoy = hoy.weekday()
    
    # Restar 7 días para obtener el mismo día de la semana de la semana pasada
    fecha_semana_pasada = hoy - timedelta(days=7)
    
    ciclo_historico = Ciclo(
        estado=EstadoCiclo.CERRADO,
        modo_portal=ModoPortal.SALIDA,
        fecha=fecha_semana_pasada,
        cerrado_en=datetime.now(ZoneInfo(settings.TIMEZONE)).replace(tzinfo=None)
    )
    db_session.add(ciclo_historico)
    await db_session.flush()

    prod = Producto(nombre="Producto Averages", categoria="Ropa", cantidad_inicial=10, stock_minimo=2)
    db_session.add(prod)
    await db_session.flush()

    # Añadir eventos en el ciclo histórico (10 salidas y 2 retornos -> ventas netas = 8)
    for _ in range(10):
        db_session.add(Evento(ciclo_id=ciclo_historico.id, epc="EPC1", producto_id=prod.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))
    for _ in range(2):
        db_session.add(Evento(ciclo_id=ciclo_historico.id, epc="EPC1", producto_id=prod.id, tipo=TipoEvento.RETORNO, timestamp_esp32=1))
    
    # 2. Crear el ciclo ABIERTO de hoy
    ciclo_hoy = Ciclo(
        estado=EstadoCiclo.ABIERTO,
        modo_portal=ModoPortal.SALIDA,
        fecha=hoy
    )
    db_session.add(ciclo_hoy)
    await db_session.flush()

    # Añadir eventos hoy (4 salidas y 0 retornos -> ventas netas = 4)
    for _ in range(4):
        db_session.add(Evento(ciclo_id=ciclo_hoy.id, epc="EPC1", producto_id=prod.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))
    
    await db_session.commit()

    # Consultar endpoint
    response = await client.get("/api/reports/averages")
    assert response.status_code == 200
    
    data = response.json()
    assert data["promedio_historico"] == 8.0
    assert data["ventas_hoy"] == 4
    # Diferencia entre 4 y 8 es -50%
    assert data["diferencia_pct"] == -50.0


@pytest.mark.asyncio
async def test_get_weekly_trends(client: AsyncClient, db_session: AsyncSession):
    # Crear productos de diferentes categorías
    prod_ropa = Producto(nombre="Camisa Ropa", categoria="Ropa", cantidad_inicial=20)
    prod_textil = Producto(nombre="Sábana Textil", categoria="Blanco", cantidad_inicial=30)
    db_session.add(prod_ropa)
    db_session.add(prod_textil)
    await db_session.flush()

    hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()
    
    # Período actual (últimos 7 días):
    # Ciclo de hace 2 días con ventas de Ropa (5 netas)
    ciclo_act = Ciclo(estado=EstadoCiclo.CERRADO, fecha=hoy - timedelta(days=2))
    db_session.add(ciclo_act)
    await db_session.flush()
    for i in range(5):
        db_session.add(Evento(ciclo_id=ciclo_act.id, epc=f"EPC_ROPA_{i}", producto_id=prod_ropa.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))

    # Período anterior (días -14 a -7):
    # Ciclo de hace 10 días con ventas de Blanco (10 netas) y ventas de Ropa (1 neta)
    ciclo_ant = Ciclo(estado=EstadoCiclo.CERRADO, fecha=hoy - timedelta(days=10))
    db_session.add(ciclo_ant)
    await db_session.flush()
    for i in range(10):
        db_session.add(Evento(ciclo_id=ciclo_ant.id, epc=f"EPC_TEXTIL_{i}", producto_id=prod_textil.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))
    db_session.add(Evento(ciclo_id=ciclo_ant.id, epc="EPC_ROPA_ANT", producto_id=prod_ropa.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))

    await db_session.commit()

    # Consultar tendencias
    response = await client.get("/api/reports/trends")
    assert response.status_code == 200
    trends = response.json()
    
    # Debería haber datos para "Ropa" y "Blanco"
    trends_map = {t["categoria"]: t for t in trends}
    
    assert "Ropa" in trends_map
    assert "Blanco" in trends_map
    
    # Ropa: actual = 5, anterior = 1. Cambio de +400% -> UP
    assert trends_map["Ropa"]["ventas_actual"] == 5
    assert trends_map["Ropa"]["ventas_anterior"] == 1
    assert trends_map["Ropa"]["cambio_pct"] == 400.0
    assert trends_map["Ropa"]["tendencia"] == "UP"

    # Blanco: actual = 0, anterior = 10. Cambio de -100% -> DOWN
    assert trends_map["Blanco"]["ventas_actual"] == 0
    assert trends_map["Blanco"]["ventas_anterior"] == 10
    assert trends_map["Blanco"]["cambio_pct"] == -100.0
    assert trends_map["Blanco"]["tendencia"] == "DOWN"


@pytest.mark.asyncio
async def test_list_critical_products(client: AsyncClient, db_session: AsyncSession):
    # Crear un producto crítico (cantidad_inicial < stock_minimo) y uno normal
    prod_critico = Producto(
        nombre="Sábana Crítica",
        categoria="Blanco",
        cantidad_inicial=3,
        stock_minimo=5,
        activo=True
    )
    prod_normal = Producto(
        nombre="Sábana Normal",
        categoria="Blanco",
        cantidad_inicial=10,
        stock_minimo=5,
        activo=True
    )
    prod_inactivo = Producto(
        nombre="Sábana Inactiva Crítica",
        categoria="Blanco",
        cantidad_inicial=2,
        stock_minimo=5,
        activo=False
    )
    db_session.add(prod_critico)
    db_session.add(prod_normal)
    db_session.add(prod_inactivo)
    await db_session.commit()

    # Consultar productos críticos
    response = await client.get("/api/products/critical")
    assert response.status_code == 200
    critical_list = response.json()
    
    # Solo el prod_critico debe estar en la lista
    assert len(critical_list) == 1
    assert critical_list[0]["nombre"] == "Sábana Crítica"


@pytest.mark.asyncio
async def test_outliers_evaluation(db_session: AsyncSession):
    # Crear un producto
    prod = Producto(nombre="Producto Outlier", categoria="Blanco", cantidad_inicial=20)
    db_session.add(prod)
    await db_session.flush()

    # Crear ciclo abierto
    ciclo = Ciclo(estado=EstadoCiclo.ABIERTO, modo_portal=ModoPortal.SALIDA)
    db_session.add(ciclo)
    await db_session.flush()

    # Crear 10 eventos de salida y 0 retornos para el producto
    for i in range(10):
        db_session.add(Evento(
            ciclo_id=ciclo.id,
            producto_id=prod.id,
            epc=f"EPC_OUT_{i}",
            tipo=TipoEvento.SALIDA,
            timestamp_esp32=1
        ))
    
    await db_session.commit()

    # Evaluar outliers
    await alert_service.evaluar_outliers_ciclo(ciclo.id, db_session)
    await db_session.commit()

    # Verificar que se creó la alerta OUTLIER_VENTA
    stmt = select(Alerta).where(Alerta.tipo == TipoAlertas_alias if False else Alerta.tipo == TipoAlerta.OUTLIER_VENTA)
    res = await db_session.execute(stmt)
    alertas = res.scalars().all()
    
    assert len(alertas) == 1
    assert "Desvío de venta" in alertas[0].descripcion
    assert "Producto Outlier" in alertas[0].descripcion
