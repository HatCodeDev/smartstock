import pytest
import uuid
from app.models.etiqueta import Etiqueta


@pytest.mark.asyncio
async def test_auth_login(client):
    response = await client.post(
        "/api/auth/login", data={"username": "admin", "password": "admin"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_get_config(client):
    login_response = await client.post(
        "/api/auth/login", data={"username": "admin", "password": "admin"}
    )
    token = login_response.json()["access_token"]

    response = await client.get(
        "/api/config", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    # Verificamos que el Seed se haya ejecutado
    assert data["hora_cierre_auto"] == "23:00"


@pytest.mark.asyncio
async def test_create_product(client):
    login_response = await client.post(
        "/api/auth/login", data={"username": "admin", "password": "admin"}
    )
    token = login_response.json()["access_token"]

    product_data = {
        "nombre": "Remera Estampada",
        "categoria": "Remeras",
        "cantidad_inicial": 20,
        "activo": True,
    }

    response = await client.post(
        "/api/products",
        json=product_data,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Remera Estampada"
    assert data["cantidad_inicial"] == 20
    assert "id" in data


@pytest.mark.asyncio
async def test_delete_product_inactivates_tags(client, db_session):
    login_response = await client.post(
        "/api/auth/login", data={"username": "admin", "password": "admin"}
    )
    token = login_response.json()["access_token"]

    # 1. Crear producto
    product_data = {
        "nombre": "Pantalón de Jean",
        "categoria": "Pantalones",
        "cantidad_inicial": 5,
    }
    create_response = await client.post(
        "/api/products",
        json=product_data,
        headers={"Authorization": f"Bearer {token}"},
    )
    product_id = create_response.json()["id"]

    # 2. Asociar etiqueta mock directamente en BD
    etiqueta_mock = Etiqueta(
        epc="E200001A2345678901234567", producto_id=uuid.UUID(product_id), activa=True
    )
    db_session.add(etiqueta_mock)
    await db_session.commit()

    # 3. Eliminar producto (baja lógica)
    delete_response = await client.delete(
        f"/api/products/{product_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert delete_response.status_code == 204

    # 4. Verificar que la etiqueta quedó inactiva en la BD
    await db_session.refresh(etiqueta_mock)
    assert etiqueta_mock.activa is False
