import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.dependencies import get_current_user
from app.main import app

async def override_get_current_user():
    return {"id": 1, "username": "admin"}

app.dependency_overrides[get_current_user] = override_get_current_user

@pytest.mark.asyncio
async def test_close_cycle_and_get_summary(client: AsyncClient, db_session: AsyncSession):
    # 1. Intentar cerrar ciclo cuando no hay ninguno (error)
    response = await client.post("/api/cycle/close")
    assert response.status_code == 400
    assert response.json()["detail"] == "No hay ciclo abierto para cerrar."

    # 2. Crear un ciclo activo
    hoy = datetime.now(timezone.utc).date()
    nuevo_ciclo = Ciclo(
        estado=EstadoCiclo.ABIERTO,
        modo_portal=ModoPortal.SALIDA,
        fecha=hoy,
    )
    db_session.add(nuevo_ciclo)
    await db_session.commit()

    # 3. Cerrar ciclo activo
    response_close = await client.post("/api/cycle/close")
    assert response_close.status_code == 200
    data_close = response_close.json()
    assert data_close["fecha"] == hoy.isoformat()
    assert data_close["cierre_automatico"] is False
    assert data_close["salidos"] == 0

    # 4. Obtener summary
    response_summary = await client.get("/api/cycle/summary")
    assert response_summary.status_code == 200
    data_summary = response_summary.json()
    assert data_summary["fecha"] == hoy.isoformat()
    assert data_summary["cierre_automatico"] is False
    assert data_summary["salidos"] == 0
    
    # 5. Intentar obtener summary cuando no hay ciclos cerrados
    # Limpiar BD
    await db_session.delete(nuevo_ciclo)
    await db_session.commit()
    
    response_summary_empty = await client.get("/api/cycle/summary")
    assert response_summary_empty.status_code == 404

@pytest.mark.asyncio
async def test_get_cycle_status_api(client: AsyncClient, db_session: AsyncSession):
    # 1. Sin ciclo
    response = await client.get("/api/cycle/status")
    assert response.status_code == 200
    assert response.json()["estado"] == "SIN_CICLO"

    # 2. Con ciclo abierto
    hoy = datetime.now(timezone.utc).date()
    nuevo_ciclo = Ciclo(estado=EstadoCiclo.ABIERTO, modo_portal=ModoPortal.SALIDA, fecha=hoy)
    db_session.add(nuevo_ciclo)
    await db_session.commit()

    response2 = await client.get("/api/cycle/status")
    assert response2.status_code == 200
    assert response2.json()["estado"] == "ABIERTO"
