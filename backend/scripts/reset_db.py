#!/usr/bin/env python3
"""
SmartStock - Script para Limpiar y Restablecer la Base de Datos (Blank Slate)
=============================================================================

Borra absolutamente todas las tablas de la base de datos configurada en el `.env`
y las vuelve a crear totalmente vacías. Ideal para iniciar pruebas reales de producción.

Uso:
    python backend/scripts/reset_db.py
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Agregar el directorio backend al path para imports
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from app.database import Base
from app.models import *  # Cargar todos los modelos para metadata

async def reset_database():
    load_dotenv()
    
    database_url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ ERROR: DATABASE_URL o DIRECT_URL no encontrada en el archivo .env")
        return
    
    # Convertir a async driver
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    elif database_url.startswith("sqlite://"):
        database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")
        
    print(f"📡 Conectando a la base de datos para limpieza...")
    engine = create_async_engine(database_url, echo=False)
    
    print("🗑️  Borrando todas las tablas existentes en Supabase...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        
    print("🏗️  Creando esquema de tablas totalmente limpio...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    await engine.dispose()
    print("✨ Base de datos restablecida con éxito. ¡Está totalmente vacía y lista!")

if __name__ == "__main__":
    asyncio.run(reset_database())
