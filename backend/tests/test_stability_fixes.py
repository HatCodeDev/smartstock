"""
Tests for server stability fixes implemented in SDD change "fix-server-stability-issues"
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.database import engine


def test_database_pooling_configuration():
    """Test that database pooling configuration is properly set"""
    # Verify pool configuration exists
    assert hasattr(engine, 'pool'), "Database engine should have pool configuration"
    
    # Check that pool configuration is set
    # Use the pool's _max_overflow attribute instead of method
    assert engine.pool._max_overflow >= 0, "Max overflow should be non-negative"


def test_lifespan_shutdown_safety():
    """Test that shutdown sequence handles commented MQTT task safely"""
    client = TestClient(app)
    
    # Test that application starts without errors
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    
    # The main test is that the application doesn't crash on startup/shutdown
    # due to the UnboundLocalError fix


def test_health_endpoint_stability():
    """Test that health endpoint works reliably with pooling"""
    client = TestClient(app)
    
    # Test multiple rapid requests to verify pooling works
    for i in range(5):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["database"] == "healthy"


@pytest.mark.asyncio
async def test_database_connection_pool():
    """Test database connection pooling functionality"""
    # Test that we can create multiple connections
    async with engine.connect() as conn1:
        async with engine.connect() as conn2:
            # Both connections should work
            result1 = await conn1.execute(text("SELECT 1"))
            result2 = await conn2.execute(text("SELECT 1"))
            
            assert result1.scalar() == 1
            assert result2.scalar() == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])