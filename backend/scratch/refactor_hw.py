import re

file_path = r'c:\Users\misae\smartstock\backend\app\services\advanced_report_service.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import for HoltWintersAdditive
content = content.replace(
    'from app.services.fp_growth import FPGrowth',
    'from app.services.fp_growth import FPGrowth\nfrom app.services.holt_winters import HoltWintersAdditive'
)

# 2. Refactor Holt Winters body
old_hw_block = """        # Lógica de cálculo o fallback si el historial es menor a dos temporadas completas (14 observaciones)
        if n_obs >= 14:
            # Algoritmo Holt-Winters Triple Exponencial Aditivo
            alpha = 0.2
            beta = 0.1
            gamma = 0.3
            
            # Inicialización de nivel a_0 (promedio de la primera semana)
            a_prev = sum(y[:L]) / L
            
            # Inicialización de tendencia b_0 (promedio de diferencias entre la segunda y la primera semana)
            b_prev = sum((y[i + L] - y[i]) / L for i in range(L)) / L
            
            # Inicialización de factores estacionales
            seasonal_factors = [y[i] - a_prev for i in range(L)]
            
            # Ciclo de actualización iterativo
            for t in range(L, n_obs):
                y_t = y[t]
                s_t_minus_L = seasonal_factors[t - L]
                
                # Nivel
                a_curr = alpha * (y_t - s_t_minus_L) + (1 - alpha) * (a_prev + b_prev)
                # Tendencia
                b_curr = beta * (a_curr - a_prev) + (1 - beta) * b_prev
                # Factor estacional
                s_curr = gamma * (y_t - a_curr) + (1 - gamma) * s_t_minus_L
                
                a_prev = a_curr
                b_prev = b_curr
                seasonal_factors.append(s_curr)
                
            # Proyección para los próximos 7 días (m = 1 a 7)
            pronostico_total = []
            for m in range(1, 8):
                dia_futuro = fecha + timedelta(days=m)
                dia_semana = dia_futuro.weekday()
                s_idx = len(seasonal_factors) - L + (m - 1) % L
                val = a_prev + m * b_prev + seasonal_factors[s_idx]
                val_lim = max(0, int(round(val)))
                pronostico_total.append(val_lim)
        else:
            # Fallback dinámico si no hay historial suficiente: promedio simple
            promedio_diario = sum(y) / n_obs if n_obs > 0 else 0.0
            
            pronostico_total = []
            for m in range(1, 8):
                # Mantener una proyección plana conservadora sin estacionalidad irreal
                pronostico_total.append(int(round(promedio_diario)))"""

new_hw_block = """        # Lógica de cálculo o fallback si el historial es menor a dos temporadas completas (14 observaciones)
        if n_obs >= 14:
            # Utilizar el motor Holt-Winters nativo
            hw_model = HoltWintersAdditive(alpha=0.2, beta=0.1, gamma=0.3)
            raw_predictions, _ = hw_model.forecast(y, L=7, steps=7)
            pronostico_total = [max(0, int(round(val))) for val in raw_predictions]
        else:
            # Fallback dinámico si no hay historial suficiente: promedio simple
            promedio_diario = sum(y) / n_obs if n_obs > 0 else 0.0
            
            pronostico_total = []
            for m in range(1, 8):
                # Mantener una proyección plana conservadora sin estacionalidad irreal
                pronostico_total.append(int(round(promedio_diario)))"""

content = content.replace(old_hw_block, new_hw_block)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactor completed")
