import asyncio
import os
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.reporte_avanzado import ReporteAvanzado, TipoReporteAvanzado

async def main():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not found")
        return
    
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    elif database_url.startswith("sqlite://"):
        database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        stmt = select(ReporteAvanzado).where(ReporteAvanzado.tipo == TipoReporteAvanzado.HOLT_WINTERS).order_by(ReporteAvanzado.fecha.desc()).limit(1)
        res = await session.execute(stmt)
        report = res.scalars().first()
        if report:
            print("Fecha:", report.fecha)
            print("Datos:", json.dumps(report.datos, indent=2, ensure_ascii=False))
        else:
            print("No report found")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
