import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import select

sys.path.append(str(Path(__file__).parent.parent))
load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.reporte_avanzado import ReporteAvanzado, TipoReporteAvanzado

async def main():
    database_url = os.getenv("DATABASE_URL")
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    
    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        stmt = select(ReporteAvanzado).where(ReporteAvanzado.tipo == TipoReporteAvanzado.FP_GROWTH).order_by(ReporteAvanzado.fecha.desc()).limit(5)
        res = await session.execute(stmt)
        reports = res.scalars().all()
        
        print(f"Encontrados {len(reports)} reportes de FP-Growth:")
        for r in reports:
            print(f"Fecha: {r.fecha}")
            print(f"Datos: {r.datos}")
            print("-" * 50)
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
