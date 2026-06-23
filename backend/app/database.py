from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.config import settings

# Configuración de pooling para cargas IoT
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    # Pool configuration for IoT burst handling
    pool_size=10,           # Maximum number of connections in pool
    max_overflow=5,          # Additional connections beyond pool_size
    pool_pre_ping=True,      # Verify connection before use
    pool_recycle=3600,       # Recycle connections after 1 hour
)

async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()
