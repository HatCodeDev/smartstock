from typing import List

class HoltWintersAdditive:
    """
    Implementación en Python puro del algoritmo de suavizado triple exponencial (Holt-Winters Aditivo).
    Se utiliza para predecir series de tiempo con tendencia y estacionalidad.
    """
    def __init__(self, alpha: float = 0.2, beta: float = 0.1, gamma: float = 0.3):
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma

    def forecast(self, y: List[float], L: int = 7, steps: int = 7) -> List[float]:
        """
        Calcula el pronóstico para los siguientes `steps` pasos dado el historial `y`.
        `L` es la longitud del periodo estacional (ej: 7 para una semana).
        
        Requiere un historial de al menos 2 periodos estacionales (2 * L).
        Si el historial es insuficiente, lanza ValueError.
        """
        n_obs = len(y)
        if n_obs < 2 * L:
            raise ValueError(f"El historial debe tener al menos {2 * L} observaciones, pero tiene {n_obs}.")

        # Inicialización de nivel a_0 (promedio del primer ciclo estacional)
        a_prev = sum(y[:L]) / L
        
        # Inicialización de tendencia b_0 (promedio de diferencias entre el segundo y el primer ciclo)
        b_prev = sum((y[i + L] - y[i]) / L for i in range(L)) / L
        
        # Inicialización de factores estacionales
        seasonal_factors = [y[i] - a_prev for i in range(L)]
        
        # Ciclo de actualización iterativo
        for t in range(L, n_obs):
            y_t = y[t]
            s_t_minus_L = seasonal_factors[t - L]
            
            # Nivel
            a_curr = self.alpha * (y_t - s_t_minus_L) + (1 - self.alpha) * (a_prev + b_prev)
            # Tendencia
            b_curr = self.beta * (a_curr - a_prev) + (1 - self.beta) * b_prev
            # Factor estacional
            s_curr = self.gamma * (y_t - a_curr) + (1 - self.gamma) * s_t_minus_L
            
            a_prev = a_curr
            b_prev = b_curr
            seasonal_factors.append(s_curr)
            
        # Proyección para los próximos `steps`
        predictions = []
        for m in range(1, steps + 1):
            s_idx = len(seasonal_factors) - L + (m - 1) % L
            val = a_prev + m * b_prev + seasonal_factors[s_idx]
            predictions.append(val)
            
        return predictions, b_prev # También retornamos la tendencia final para generar insights
