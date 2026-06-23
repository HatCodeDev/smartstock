import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from app.dependencies import get_current_user
from app.main import app
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.evento import Evento, TipoEvento
from app.models.producto import Producto
from app.models.alerta import Alerta, TipoAlerta

# Sobrescribimos get_current_user para saltar la autenticación en estas pruebas
async def override_get_current_user():
    return {"id": 1, "username": "admin"}

app.dependency_overrides[get_current_user] = override_get_current_user


@pytest.mark.asyncio
async def test_get_shifts_report_empty(client: AsyncClient, db_session: AsyncSession):
    # Sin ciclos en BD
    response = await client.get("/api/reports/shifts")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_get_shifts_report_calculations(client: AsyncClient, db_session: AsyncSession):
    # 1. Crear un producto
    prod = Producto(nombre="Producto Test", categoria="Ropa", cantidad_inicial=20, stock_minimo=2)
    db_session.add(prod)
    await db_session.flush()

    hoy = datetime.now(timezone.utc).date()
    
    # 2. Crear un ciclo CERRADO y CUMPLIDO (duración < 12h, cierre manual)
    creado_en_c1 = datetime.now(timezone.utc) - timedelta(hours=6)
    cerrado_en_c1 = datetime.now(timezone.utc) - timedelta(hours=1)
    c1 = Ciclo(
        estado=EstadoCiclo.CERRADO,
        modo_portal=ModoPortal.SALIDA,
        fecha=hoy,
        creado_en=creado_en_c1.replace(tzinfo=None),
        cerrado_en=cerrado_en_c1.replace(tzinfo=None),
        cierre_automatico=False
    )
    db_session.add(c1)
    await db_session.flush()

    # Agregar eventos para c1 (3 salidas, 1 retorno)
    for _ in range(3):
        db_session.add(Evento(ciclo_id=c1.id, epc="EPC1", producto_id=prod.id, tipo=TipoEvento.SALIDA, timestamp_esp32=1))
    db_session.add(Evento(ciclo_id=c1.id, epc="EPC1", producto_id=prod.id, tipo=TipoEvento.RETORNO, timestamp_esp32=1))

    # Agregar una alerta (debe listarse pero no fallar el KPI)
    alerta_c1 = Alerta(
        ciclo_id=c1.id,
        tipo=TipoAlerta.TAG_DESCONOCIDA,
        descripcion="Etiqueta desconocida",
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db_session.add(alerta_c1)
    await db_session.flush()

    # 3. Crear un ciclo CERRADO por LÍMITE DE TIEMPO / AUTO-CERRADO (no cumple KPI)
    creado_en_c2 = datetime.now(timezone.utc) - timedelta(hours=14)
    cerrado_en_c2 = datetime.now(timezone.utc) - timedelta(hours=1)
    c2 = Ciclo(
        estado=EstadoCiclo.CERRADO,
        modo_portal=ModoPortal.SALIDA,
        fecha=hoy,
        creado_en=creado_en_c2.replace(tzinfo=None),
        cerrado_en=cerrado_en_c2.replace(tzinfo=None),
        cierre_automatico=True
    )
    db_session.add(c2)
    await db_session.flush()

    await db_session.commit()

    # Consultar endpoint para el mes actual
    month_str = hoy.strftime("%Y-%m")
    response = await client.get(f"/api/reports/shifts?month={month_str}")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) == 2

    # El primer elemento (orden descendente por fecha/creado_en)
    # c2 fue creado hace 14 horas, c1 hace 6 horas.
    # El orden descendente debería poner a c1 primero o c2 primero según creado_en desc.
    # c1 es más reciente (creado_en hace 6 horas) que c2 (creado_en hace 14 horas), por lo que c1 debe estar primero.
    item_c1 = data[0] if data[0]["id"] == c1.id else data[1]
    item_c2 = data[1] if data[0]["id"] == c1.id else data[0]

    # Verificar c1
    assert item_c1["estado"] == "CERRADO"
    assert item_c1["salidas"] == 3
    assert item_c1["retornos"] == 1
    assert item_c1["alertas_count"] == 1
    assert len(item_c1["alertas"]) == 1
    assert item_c1["alertas"][0]["tipo"] == "TAG_DESCONOCIDA"
    assert item_c1["kpi_cumplido"] is True  # Las alertas ya no anulan el cumplimiento del KPI

    # Verificar c2
    assert item_c2["cierre_automatico"] is True
    assert item_c2["kpi_cumplido"] is False  # Falla por cierre_automatico o duración > 12h
