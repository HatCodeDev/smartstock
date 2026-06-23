import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.models.ciclo import Ciclo, EstadoCiclo, ModoPortal
from app.models.alerta import Alerta, TipoAlerta
from app.dependencies import get_current_user
from app.main import app

async def override_get_current_user():
    return {"id": 1, "username": "admin"}

app.dependency_overrides[get_current_user] = override_get_current_user

@pytest.mark.asyncio
async def test_alerts_endpoints(client: AsyncClient, db_session: AsyncSession):
    # 1. Crear ciclo
    hoy = datetime.now(timezone.utc).date()
    nuevo_ciclo = Ciclo(estado=EstadoCiclo.ABIERTO, modo_portal=ModoPortal.SALIDA, fecha=hoy)
    db_session.add(nuevo_ciclo)
    await db_session.flush()

    # 2. Crear alerta no revisada
    alerta = Alerta(
        tipo=TipoAlerta.MODO_REGISTRO_ACTIVO,
        descripcion="Test Alerta",
        ciclo_id=nuevo_ciclo.id,
        revisada=False
    )
    db_session.add(alerta)
    await db_session.commit()

    # 3. GET /api/alerts
    response_get = await client.get("/api/alerts")
    assert response_get.status_code == 200
    data = response_get.json()
    assert len(data) == 1
    alerta_id = data[0]["id"]
    assert data[0]["descripcion"] == "Test Alerta"
    assert data[0]["revisada"] is False

    # 4. PUT /api/alerts/{id}/review
    response_put = await client.put(f"/api/alerts/{alerta_id}/review")
    assert response_put.status_code == 200
    
    # 5. GET /api/alerts de nuevo (debe estar vacio porque ya fue revisada)
    response_get2 = await client.get("/api/alerts")
    assert response_get2.status_code == 200
    assert len(response_get2.json()) == 0

    # Verificar BD
    await db_session.refresh(alerta)
    assert alerta.revisada is True
