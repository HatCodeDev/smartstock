## Exploration: Align Return Rates and K-Means Logic with Real SmartStock Business Rules

### Current State
1. **Return Rates Threshold**: The default threshold for critical return rates (`umbral_retorno_critico`) is set to `80.0` across model defaults, Pydantic schemas, database seeds, route fallbacks, and frontend components. This is aligned with the business rule that a return rate > 80% is critical (unsold items).
2. **K-Means RFV Metrics**:
   - **Recency**: Calculated using `func.max(case((Evento.tipo == TipoEvento.SALIDA, Ciclo.fecha), else_=None))`. This counts the date of the last exhibition/salida, even if all items returned (meaning no net sales happened).
   - **Frequency**: Calculated using `func.count(func.distinct(case((Evento.tipo == TipoEvento.SALIDA, Evento.ciclo_id), else_=None)))`. This counts any cycle with a SALIDA, even if all items returned.
   - **Volume**: Calculated using global sum subtraction `(func.sum(case((Evento.tipo == TipoEvento.SALIDA, 1), else_=0)) - func.sum(case((Evento.tipo == TipoEvento.RETORNO, 1), else_=0)))` instead of summing daily net sales of closed cycles.

### Affected Areas
- `backend/app/services/advanced_report_service.py` — The `_calcular_kmeans` function contains the database query that calculates Recency, Frequency, and Volume (RFV) metrics.
- `backend/app/routers/reports.py` — The `get_products_return_rates` function retrieves the return rate threshold and calculates it. (Confirmed: already uses the correct `80.0` default threshold and fallback value).
- `backend/scripts/simulate_history.py` — Confirmed: already seeds configuration with `umbral_retorno_critico=80.0`. No action needed.
- `backend/app/main.py` and `backend/tests/conftest.py` — Seed SQL inserts on the `configuracion` table are missing non-nullable columns (`cierre_auto_habilitado` and `umbral_retorno_critico`), causing `IntegrityError` crashes in tests and runtime. These must be updated to complete raw INSERT statements.

### Approaches
1. **Approach A: SQL CTE / Subquery Aggregation** — Compute outputs (salidas) and returns (retornos) grouped by product and cycle first in a subquery, then perform the RFV metrics calculations on the aggregated values in the outer select statement.
   - Pros:
     - 100% database-side calculation, which scales efficiently.
     - Strictly aligns database metrics with the business rules by evaluating `salidas - retornos > 0` at the cycle level.
   - Cons:
     - Slightly more complex SQLAlchemy code compared to a flat query.
   - Effort: Low

2. **Approach B: Python-Side Loop Aggregation** — Query all raw events from the database and calculate RFV metrics in memory using Python loops or dictionary mapping.
   - Pros:
     - Simple initial database query.
   - Cons:
     - Inefficient; does not scale as the transaction/event history grows.
     - Violates standard backend practices of delegating aggregations to the DB.
   - Effort: Medium

### Recommendation
**Approach A (SQL CTE / Subquery Aggregation)** is recommended. Implementing the metrics logic directly in the database ensures scalability, data consistency, and follows the project's architecture guidelines.

### Risks
- **SQL Performance**: A subquery grouping events by product and cycle could potentially cause performance hits if the database grows very large without proper indices. However, since the database already has indices on foreign keys and `Ciclo.estado`, and the volume of events is small to medium, the impact is minimal.
- **SQLite Seed Integrity Errors**: The raw SQL `INSERT` commands for the `configuracion` table in `main.py` and `conftest.py` lack the `cierre_auto_habilitado` and `umbral_retorno_critico` columns, resulting in `IntegrityError` failures. Resolving these seed commands is a prerequisite to running tests or startup tasks successfully.

### Ready for Proposal
Yes — the exploration has successfully mapped the current state and proposed a clear database query refactoring plan. The orchestrator can proceed to `sdd-propose` to create the proposal.
