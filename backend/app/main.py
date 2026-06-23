import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import engine, Base
from app import models  # noqa: F401 Forzar registro de modelos
from app.routers import products_router, portal_router, config_router, auth_router, ws_router, dashboard_router, cycle_router, tags_router, alerts_router, reports_router
from app.dependencies import get_db
from app.mqtt.client import mqtt_listener
from app.scheduler.scheduler import scheduler, setup_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP ---
    # 1. Crear tablas si no existen en su propia transacción
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Migración manual para la columna stock_minimo en una transacción separada
    # Esto evita abortar toda la transacción si la columna ya existe (comportamiento de PostgreSQL/Supabase)
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE productos ADD COLUMN stock_minimo INTEGER DEFAULT 5"))
    except Exception:
        pass

    # 3. Ejecutar el Seed de la tabla configuracion en otra transacción independiente
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT COUNT(id) FROM configuracion"))
        if result.scalar() == 0:
            await conn.execute(
                text(
                    "INSERT INTO configuracion (hora_cierre_auto, cierre_auto_habilitado, umbral_retorno_critico) VALUES ('23:00', 1, 80.0)"
                )
            )

    # Configurar logger de MQTT para que propague al root (uvicorn)
    logging.getLogger("app.mqtt").setLevel(logging.INFO)

    # Configurar y arrancar Scheduler
    setup_scheduler()
    scheduler.start()

    # Arrancar subscriber MQTT como background task
    print(">>> [DEBUG] Creando tarea de fondo para MQTT...")
    mqtt_task = asyncio.create_task(mqtt_listener())
    
    # Inyectar el publisher de MQTT real al portal_service
    from app.services.portal_service import portal_service
    from app.mqtt.client import PahoMQTTPublisher
    portal_service.mqtt_publisher = PahoMQTTPublisher()

    # Agregar la tarea a la aplicación para que no se cierre
    app.state.mqtt_task = mqtt_task

    yield

    # --- SHUTDOWN ---
    scheduler.shutdown()
    
    # Cancelar MQTT task solo si existe
    if 'mqtt_task' in locals():
        mqtt_task.cancel()
        await asyncio.gather(mqtt_task, return_exceptions=True)
    
    await engine.dispose()


app = FastAPI(title="SmartStock API", lifespan=lifespan)

# CORS: Habilitar para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],  # En prod debería ser restringido a los dominios frontends permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health Check para validar conexión a DB
@app.get("/api/health", tags=["system"])
async def health_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "healthy"}
    except Exception as e:
        return {"status": "error", "database": "unhealthy", "detail": str(e)}


# Inclusión de Routers
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(portal_router)
app.include_router(config_router)
app.include_router(ws_router)
app.include_router(dashboard_router)
app.include_router(cycle_router)
app.include_router(tags_router)
app.include_router(alerts_router)
app.include_router(reports_router)

# Servir archivos estáticos del frontend (Atomic Vanilla App)
from fastapi.staticfiles import StaticFiles
import os

# Obtener ruta absoluta de la carpeta frontend
current_dir = os.path.dirname(os.path.abspath(__file__)) # .../backend/app
backend_dir = os.path.dirname(current_dir)             # .../backend
root_dir = os.path.dirname(backend_dir)                 # .../ (root del proyecto)
frontend_dir = os.path.join(root_dir, "frontend")

if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    print(f"⚠️ [WARN] Carpeta frontend no encontrada en {frontend_dir}")
