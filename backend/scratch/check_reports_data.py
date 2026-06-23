import os
import asyncio
import json
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    load_dotenv()
    url = os.getenv("DATABASE_URL")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, tipo, fecha, creado_en, datos FROM reportes_avanzados"))
        for row in res.fetchall():
            print("ID:", row[0])
            print("Tipo:", row[1])
            print("Fecha:", row[2])
            print("Creado En:", row[3])
            print("Datos:", json.dumps(json.loads(row[4]) if isinstance(row[4], str) else row[4], indent=2, ensure_ascii=False))
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())
