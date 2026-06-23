import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from app.dependencies import get_current_user
from app.main import app
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.evento import Evento, TipoEvento
from app.models.producto import Producto
from app.models.configuracion import Configuracion
from app.models.alerta import Alerta, TipoAlerta
from app.services.cycle_service import cycle_service

# Saltamos la autenticación
async def override_get_current_user():
    return {"id": 1, "username": "admin"}

app.dependency_overrides[get_current_user] = override_get_current_user


@pytest.mark.asyncio
async def test_get_products_return_rates(client: AsyncClient, db_session: AsyncSession):
    # 1. Crear productos
    prod_a = Producto(nombre="Blusa Premium", sku="BLU-01", categoria="Vestidos", cantidad_inicial=10)
    prod_b = Producto(nombre="Remera Básica", sku="REM-02", categoria="Remeras", cantidad_inicial=15)
    db_session.add(prod_a)
    db_session.add(prod_b)
    await db_session.flush()

    # 2. Configurar umbral en 80%
    config_result = await db_session.execute(select(Configuracion).limit(1))
    config = config_result.scalar_one_or_none()
    if config:
        config.umbral_retorno_critico = 80.0
    else:
        config = Configuracion(umbral_retorno_critico=80.0)
        db_session.add(config)
    await db_session.flush()

    # 3. Crear ciclo cerrado
    ciclo = Ciclo(estado=EstadoCiclo.CERRADO, fecha=datetime.now(timezone.utc).date() - timedelta(days=1))
    db_session.add(ciclo)
    await db_session.flush()

    # Prod A: 10 salidas, 9 retornos -> 90.0% (Excede umbral de 80.0%)
    for _ in range(10):
        db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC1", producto_id=prod_a.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))
    for _ in range(9):
        db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC1", producto_id=prod_a.id, tipo=TipoEvento.RETORNO, timestamp_esp32=2))

    # Prod B: 10 salidas, 7 retorno -> 70.0% (No excede)
    for _ in range(10):
        db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC2", producto_id=prod_b.id, tipo=TipoEvento.SALIDA, timestamp_esp32=3))
    for _ in range(7):
        db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC2", producto_id=prod_b.id, tipo=TipoEvento.RETORNO, timestamp_esp32=4))

    await db_session.commit()

    # Consultar endpoint
    response = await client.get("/api/reports/products/return-rates")
    assert response.status_code == 200
    data = response.json()

    # Ordenado desc por return_rate: Prod A (90.0%) primero
    assert len(data) >= 2
    assert data[0]["nombre"] == "Blusa Premium"
    assert data[0]["return_rate"] == 90.0
    assert data[0]["excede_umbral"] is True

    assert data[1]["nombre"] == "Remera Básica"
    assert data[1]["return_rate"] == 70.0
    assert data[1]["excede_umbral"] is False


@pytest.mark.asyncio
async def test_get_categories_transit_lead_times(client: AsyncClient, db_session: AsyncSession):
    # 1. Crear producto con categoría
    prod = Producto(nombre="Pantalón Gabardina", sku="PAN-03", categoria="Pantalones", cantidad_inicial=5)
    db_session.add(prod)
    await db_session.flush()

    # 2. Crear ciclo
    ciclo = Ciclo(estado=EstadoCiclo.CERRADO, fecha=datetime.now(timezone.utc).date() - timedelta(days=2))
    db_session.add(ciclo)
    await db_session.flush()

    # 3. Crear eventos emparejados
    # Tránsito 1: Salida a las 10:00, Retorno a las 14:00 (4.0 horas)
    t1 = datetime(2026, 5, 26, 10, 0, 0)
    t2 = datetime(2026, 5, 26, 14, 0, 0)
    db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC_P1", producto_id=prod.id, tipo=TipoEvento.SALIDA, timestamp_servidor=t1, timestamp_esp32=1))
    db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC_P1", producto_id=prod.id, tipo=TipoEvento.RETORNO, timestamp_servidor=t2, timestamp_esp32=2))

    # Tránsito 2: Salida a las 11:00, Retorno a las 17:00 (6.0 horas)
    t3 = datetime(2026, 5, 26, 11, 0, 0)
    t4 = datetime(2026, 5, 26, 17, 0, 0)
    db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC_P2", producto_id=prod.id, tipo=TipoEvento.SALIDA, timestamp_servidor=t3, timestamp_esp32=3))
    db_session.add(Evento(ciclo_id=ciclo.id, epc="EPC_P2", producto_id=prod.id, tipo=TipoEvento.RETORNO, timestamp_servidor=t4, timestamp_esp32=4))

    await db_session.commit()

    # Consultar endpoint
    response = await client.get("/api/reports/categories/transit-lead-times")
    assert response.status_code == 200
    data = response.json()

    # Promedio de 4.0 y 6.0 es 5.0 horas
    pantalones_cat = next(c for c in data if c["categoria"] == "Pantalones")
    assert pantalones_cat["transit_lead_time_hours"] == 5.0
    assert pantalones_cat["total_transitos_medidos"] == 2


@pytest.mark.asyncio
async def test_exceso_retorno_alert_on_cycle_close(db_session: AsyncSession):
    # 1. Crear producto
    prod = Producto(nombre="Vestido Flores", sku="VES-05", categoria="Vestidos", cantidad_inicial=20)
    db_session.add(prod)
    await db_session.flush()

    # 2. Configurar umbral al 10%
    config_result = await db_session.execute(select(Configuracion).limit(1))
    config = config_result.scalar_one_or_none()
    if config:
        config.umbral_retorno_critico = 10.0
    else:
        config = Configuracion(umbral_retorno_critico=10.0)
        db_session.add(config)
    await db_session.flush()

    # 3. Iniciar un ciclo abierto
    ciclo = await cycle_service.start_cycle(db_session)
    await db_session.flush()

    # Agregar 10 salidas y 3 retornos (30% de retorno -> supera 10% de umbral)
    for i in range(10):
        db_session.add(Evento(ciclo_id=ciclo.id, epc=f"EPC_V_{i}", producto_id=prod.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))
    for i in range(3):
        db_session.add(Evento(ciclo_id=ciclo.id, epc=f"EPC_V_{i}", producto_id=prod.id, tipo=TipoEvento.RETORNO, timestamp_esp32=2))

    await db_session.commit()

    # 4. Cerrar el ciclo (esto dispara la auditoría y alertas)
    summary = await cycle_service.close_active_cycle(db_session)
    await db_session.commit()

    # 5. Verificar que se creó la alerta EXCESO_RETORNO para "Vestido Flores"
    stmt = select(Alerta).where(Alerta.tipo == TipoAlerta.EXCESO_RETORNO)
    res = await db_session.execute(stmt)
    alertas = res.scalars().all()

    assert len(alertas) == 1
    assert "Tasa de retorno de exhibición crítica" in alertas[0].descripcion
    assert "Vestido Flores" in alertas[0].descripcion
    assert "30.0%" in alertas[0].descripcion


@pytest.mark.asyncio
async def test_list_product_tags(client: AsyncClient, db_session: AsyncSession):
    from app.models.etiqueta import Etiqueta

    # 1. Crear producto
    prod = Producto(nombre="Jean Premium", sku="JEA-01", categoria="Pantalones", cantidad_inicial=2)
    db_session.add(prod)
    await db_session.flush()

    # 2. Crear etiquetas
    tag_active = Etiqueta(epc="EPC_ACTIVE_01", producto_id=prod.id, activa=True)
    tag_inactive = Etiqueta(epc="EPC_INACTIVE_01", producto_id=prod.id, activa=False)
    db_session.add(tag_active)
    db_session.add(tag_inactive)
    await db_session.commit()

    # 3. Consultar endpoint
    response = await client.get(f"/api/products/{prod.id}/tags")
    assert response.status_code == 200
    data = response.json()

    # Solo debe retornar la etiqueta activa
    assert len(data) == 1
    assert data[0]["epc"] == "EPC_ACTIVE_01"
    assert data[0]["activa"] is True

