import os
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

from app.database import Base
from app.main import app as fastapi_app
from app.dependencies import get_db
# Importamos todos los modelos para asegurar que estén registrados en Base.metadata
import app.models

# Base de datos en archivo temporal para estabilidad en pruebas asíncronas concurrentes
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///test_temp.db"

engine_test = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False}
)
async_session_maker_test = async_sessionmaker(
    engine_test, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with async_session_maker_test() as session:
        yield session


# Reemplazamos la dependencia original para que use la DB temporal
fastapi_app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print(f"\n>>> [TEST DB SETUP] Tablas registradas en Base: {list(Base.metadata.tables.keys())}")

        # Seed configuracion
        result = await conn.execute(text("SELECT COUNT(id) FROM configuracion"))
        if result.scalar() == 0:
            await conn.execute(
                text(
                    "INSERT INTO configuracion (hora_cierre_auto, cierre_auto_habilitado, umbral_retorno_critico) VALUES ('23:00', 1, 80.0)"
                )
            )

    yield

    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    # Cerramos todas las conexiones del pool para liberar el archivo test_temp.db
    await engine_test.dispose()
    if os.path.exists("test_temp.db"):
        try:
            os.remove("test_temp.db")
        except Exception:
            pass


@pytest_asyncio.fixture()
async def client():
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture()
async def db_session():
    async with async_session_maker_test() as session:
        yield session


