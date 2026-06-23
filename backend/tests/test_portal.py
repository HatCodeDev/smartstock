import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.ciclo import ModoPortal
from app.dependencies import get_current_user
from app.main import app

# Sobrescribimos get_current_user
async def override_get_current_user():
    return {"id": 1, "username": "admin"}

app.dependency_overrides[get_current_user] = override_get_current_user

@pytest.mark.asyncio
async def test_set_portal_mode(client: AsyncClient, db_session: AsyncSession):
    from app.services.cycle_service import cycle_service
    await cycle_service.start_cycle(db_session)
    await db_session.commit()

    # Enviar request para cambiar modo
    response = await client.post(
        "/api/portal/mode",
        json={"mode": "REGISTRO", "device_id": "ESP32_001"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["mode"] == "REGISTRO"
    assert data["device_id"] == "ESP32_001"
    
    # Verificar get status
    status_response = await client.get("/api/portal/status")
    assert status_response.status_code == 200
    assert status_response.json()["modo_portal"] == "REGISTRO"
