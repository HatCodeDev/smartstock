import pytest
from app.services.cycle_service import cycle_service
from app.models.etiqueta import Etiqueta
from app.models.evento import TipoEvento
from app.models.ciclo import ModoPortal
from app.schemas.ciclo import CicloDashboard
from sqlalchemy import select

@pytest.mark.asyncio
async def test_get_dashboard_counters_includes_total_en_bodega(db_session):
    """
    Test para validar que el dashboard incluye el stock real (Total - Tránsito).
    GIVEN: 10 etiquetas activas.
    WHEN: 2 sábanas salieron (SALIDA).
    THEN: total_en_bodega debe ser 8.
    """
    # 1. Crear 10 etiquetas activas
    for i in range(10):
        tag = Etiqueta(epc=f"EPC{i:02d}", activa=True)
        db_session.add(tag)
    
    # 2. Crear un ciclo y 2 eventos de salida
    ciclo = await cycle_service.start_cycle(db_session)
    
    from app.models.evento import Evento
    for i in range(2):
        evento = Evento(
            epc=f"EPC{i:02d}",
            ciclo_id=ciclo.id,
            tipo=TipoEvento.SALIDA,
            timestamp_esp32=1000 + i
        )
        db_session.add(evento)
    
    await db_session.commit()
    
    # 3. Obtener contadores
    counters = await cycle_service.get_dashboard_counters(db_session)
    
    # 4. Validar
    assert hasattr(counters, "total_en_bodega"), "CicloDashboard debe tener total_en_bodega"
    assert counters.total_salidas == 2
    assert counters.articulos_en_transito == 2
    assert counters.total_en_bodega == 8, f"Esperado 8 en bodega, obtenido {counters.total_en_bodega}"
