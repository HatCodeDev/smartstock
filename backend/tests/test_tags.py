import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.models.producto import Producto
from app.models.etiqueta import Etiqueta
from app.dependencies import get_current_user
from app.main import app

async def override_get_current_user():
    return {"id": 1, "username": "admin"}

app.dependency_overrides[get_current_user] = override_get_current_user

@pytest.mark.asyncio
async def test_tags_endpoints(client: AsyncClient, db_session: AsyncSession):
    # 1. Crear producto
    prod_id = uuid.uuid4()
    prod = Producto(id=prod_id, nombre="Remera", categoria="Ropa", cantidad_inicial=10)
    db_session.add(prod)
    await db_session.commit()

    # 2. Iniciar sesión de registro
    response_scan = await client.post(
        "/api/tags/scan-batch",
        json={"product_id": str(prod_id)}
    )
    assert response_scan.status_code == 200
    data_scan = response_scan.json()
    assert "session_id" in data_scan
    assert data_scan["product_name"] == "Remera"
    session_id = data_scan["session_id"]

    # 3. Resolver conflictos (cancelando)
    response_resolve = await client.post(
        "/api/tags/resolve-conflicts",
        json={
            "session_id": session_id,
            "action": "cancel",
            "decisions": []
        }
    )
    assert response_resolve.status_code == 200

    # 4. Eliminar etiqueta
    epc_test = "E28011606000020012345678"
    etiqueta = Etiqueta(
        epc=epc_test,
        producto_id=prod_id,
        activa=True,
        asignada_en=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db_session.add(etiqueta)
    await db_session.commit()

    response_delete = await client.delete(f"/api/tags/{epc_test}")
    assert response_delete.status_code == 200

    await db_session.refresh(etiqueta)
    assert etiqueta.producto_id is None
    assert etiqueta.activa is False
