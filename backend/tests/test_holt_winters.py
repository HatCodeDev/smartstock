import pytest
from app.services.holt_winters import HoltWintersAdditive

def test_holt_winters_forecast():
    # Creamos un patrón estacional simple (L=7) con tendencia al alza
    # Día 1-7: 10, 12, 15, 14, 18, 25, 20
    # Día 8-14 (Trend + 5): 15, 17, 20, 19, 23, 30, 25
    # Día 15-21 (Trend + 5): 20, 22, 25, 24, 28, 35, 30
    
    y = [
        10, 12, 15, 14, 18, 25, 20,
        15, 17, 20, 19, 23, 30, 25,
        20, 22, 25, 24, 28, 35, 30
    ]
    
    hw = HoltWintersAdditive(alpha=0.2, beta=0.1, gamma=0.3)
    predictions, trend = hw.forecast(y, L=7, steps=7)
    
    assert len(predictions) == 7
    # Como la tendencia es positiva, el último 'trend' debe ser mayor a 0
    assert trend > 0
    # Esperamos que las predicciones mantengan el patrón estacional y la tendencia al alza
    # El día 6 del patrón suele ser el más alto (25 -> 30 -> 35 -> aprox 40)
    assert max(predictions) > 35
    assert predictions[5] == max(predictions) # El 6to elemento (índice 5)

def test_holt_winters_insufficient_data():
    hw = HoltWintersAdditive()
    y = [10, 12, 15, 14] # Solo 4 días, L=7
    
    with pytest.raises(ValueError, match="El historial debe tener al menos 14 observaciones"):
        hw.forecast(y, L=7, steps=7)
