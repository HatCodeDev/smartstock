import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.services.cycle_service import cycle_service
from datetime import datetime, timezone
from app.dependencies import get_current_user
from app.main import app

# Sobrescribimos get_current_user para saltar la autenticación en estas pruebas
async def override_get_current_user():
    return {"id": 1, "username": "admin"}


app.dependency_overrides[get_current_user] = override_get_current_user

@pytest.mark.asyncio
async def test_get_dashboard_no_active_cycle(client: AsyncClient, db_session: AsyncSession):
    # Sin ciclo activo, debería devolver 404
    response = await client.get("/api/dashboard")
    assert response.status_code == 404
    assert response.json()["detail"] == "No hay ciclo activo en este momento"

@pytest.mark.asyncio
async def test_get_dashboard_active_cycle(client: AsyncClient, db_session: AsyncSession):
    # Creamos un ciclo activo
    hoy = datetime.now(timezone.utc).date()
    nuevo_ciclo = Ciclo(
        estado=EstadoCiclo.ABIERTO,
        modo_portal=ModoPortal.SALIDA,
        fecha=hoy,
    )
    db_session.add(nuevo_ciclo)
    await db_session.commit()

    response = await client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["fecha"] == hoy.isoformat()
    assert data["modo_portal"] == "SALIDA"
    assert data["total_salidas"] == 0
    assert data["total_retornos"] == 0
    assert data["articulos_en_transito"] == 0
    assert data["alertas_activas"] == 0
