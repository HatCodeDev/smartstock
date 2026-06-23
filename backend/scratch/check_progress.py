import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from app.models.ciclo import Ciclo, EstadoCiclo

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
        stmt = select(func.count(Ciclo.id))
        res = await session.execute(stmt)
        total_ciclos = res.scalar()
        
        stmt_closed = select(func.count(Ciclo.id)).where(Ciclo.estado == EstadoCiclo.CERRADO)
        res_closed = await session.execute(stmt_closed)
        closed_ciclos = res_closed.scalar()
        
        print(f"PROGRESS - Total Ciclos: {total_ciclos} | Ciclos Cerrados: {closed_ciclos}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
