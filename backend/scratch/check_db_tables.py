import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    load_dotenv()
    url = os.getenv("DATABASE_URL")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://")
    print("URL:", url)
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [r[0] for r in res.fetchall()]
        print("Tables:", tables)
        for t in tables:
            c = (await conn.execute(text(f'SELECT count(*) FROM "{t}"'))).scalar()
            print(f"{t}: {c}")

if __name__ == "__main__":
    asyncio.run(main())
