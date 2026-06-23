## Exploration: realistic-simulation-history

### Current State
In the current implementation of `backend/scripts/simulate_history.py`, daily sales (non-returning items) are calculated as:
`n_vendidos = int(n_salidas * porcentaje_venta)`
where:
- `n_salidas` depends on the active stock size and `PATRONES_SALIDA` for the day of the week.
- `porcentaje_venta` is obtained from `PATRONES_VENTA` for the day of the week.

Because both `PATRONES_SALIDA` and `PATRONES_VENTA` are very low on weekdays (Mon: ~16% salidas, 15% venta) and very high on weekends (Sat: ~58% salidas, 45% venta), their multiplicative combination results in a highly erratic sales pattern:
- Saturday Sales: ~26% of active stock (e.g., ~189 units sold for a stock of 700).
- Monday Sales: ~2.4% of active stock (e.g., ~10 units sold for a stock of 450).

This results in a ~19x drop in sales from Saturday to Monday, depleting up to 50% of the entire inventory over a single weekend. This extreme volatility is unrealistic for a tianguis textiles business and causes excessive stockouts, which negatively impacts advanced analytics like Holt-Winters (highly unstable time-series trend/seasonality) and K-Means (skewed metrics for SKU rotación).

### Affected Areas
- `backend/scripts/simulate_history.py` — Needs updates to `PATRONES_SALIDA` and `PATRONES_VENTA` to scale down the weekly sales volatility and keep inventory levels realistic.
- `backend/app/services/advanced_report_service.py` — No direct code changes required in this file, but the quality, reliability, and stability of the generated Holt-Winters and K-Means reports will improve significantly as a direct consequence of cleaner and more realistic input time-series data.

### Approaches
1. **Adjusting daily rates (`PATRONES_SALIDA` and `PATRONES_VENTA`)** — Re-scale both patterns to reflect a more stable baseline. Even on slow days, a business displays at least 30-40% of their stock, and their sales conversion rate should be less volatile (e.g., 8% on weekdays, 18% on weekends).
   - Pros: Simple to implement (pure configuration change), maintains the existing code structure, prevents complete inventory depletion, and provides a stable weekly seasonal pattern (ratio Saturday/Monday of ~3.6x) that is perfect for Holt-Winters and K-Means.
   - Cons: Still uses a multiplicative factor, but with balanced inputs, this is no longer an issue.
   - Effort: Low

2. **Decoupled target sales volume generation** — Directly specify target daily sales volume per day of the week (with small random variation) and derive `n_salidas` and `n_retornos` accordingly.
   - Pros: Maximum control over the exact sales numbers, completely decoupling sales from stock levels.
   - Cons: Over-complicates the simulator script, changing the logical flow of the physical portal simulation where salidas and retornos are simulated first.
   - Effort: Medium

### Recommendation
Option 1 is recommended. It retains the simulator's physical-first logic (simulating the movements through the portal first, then determining sales) while scaling the percentages to highly realistic values. This results in stable, healthy inventory levels (~40% weekly turnover) matching supplier replenishment, and generates a clean weekly seasonal trend suitable for Holt-Winters forecasting and robust K-Means clustering.

### Risks
- If the weekend sales percentages are set too low, the Holt-Winters algorithm might not detect strong weekly seasonality. However, the proposed 3.6x ratio (Saturday to Monday) is clear enough for the triple exponential smoothing to capture and forecast beautifully.
- If replenishment rules are too rigid, products could still run out if a sales spike occurs on holiday dates. This is mitigated by slightly moderating the holiday sale conversion rates (to ~40-50% max) rather than allowing 96% depletions.

### Ready for Proposal
Yes — The proposed modifications to `PATRONES_SALIDA`, `PATRONES_VENTA` and holiday conversion rates in `backend/scripts/simulate_history.py` will stabilize the historical simulation, resulting in realistic inventory behavior and robust time-series inputs for advanced reports.
