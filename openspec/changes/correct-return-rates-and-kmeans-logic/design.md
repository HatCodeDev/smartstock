# Design: Correct Return Rates and KMeans Logic

## Technical Approach

Refactor the database queries inside `_calcular_kmeans` in `backend/app/services/advanced_report_service.py` to correctly calculate RFV metrics at the cycle level. Instead of querying events directly at the individual level (which can cause incorrect frequency/recency measurements when returns are present), we will use a subquery/CTE that aggregates events per product per cycle, computes net sales (`venta_neta = salidas - retornos`), and then aggregates these cycle-level metrics in an outer query filtering for positive net sales.

## Architecture Decisions

| Decision | Option | Tradeoff | Rationale |
|----------|--------|----------|-----------|
| Subquery/CTE structure | SQLAlchemy `subquery()` | Slight syntax verbosity in Python | Keeps the query execution fully on the database side and maps cleanly to the outer grouping. |
| Net sales definition | `venta_neta = salidas - retornos` | Products with equal/more returns than sales are excluded from active frequency/volume calculations | Aligns with the business requirement that only positive net sales cycles constitute an active frequency event. |

## Data Flow

```mermaid
graph TD
    A[Eventos & Ciclos DB] --> B[Subquery: Group by product_id & ciclo_id]
    B --> C[Sum SALIDA - Sum RETORNO = venta_neta]
    C --> D[Filter: Ciclo.estado == CERRADO]
    D --> E[Outer Query: Group by product_id]
    E --> F[Filter: venta_neta > 0]
    F --> G[Calculate: max(ciclo_fecha) Recency, count(ciclo_id) Frequency, sum(venta_neta) Volume]
    G --> H[Min-Max Scaling & KMeans 3D Segmenter]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/app/services/advanced_report_service.py` | Modify | Refactor the query inside `_calcular_kmeans` to use the subquery approach for calculating RFV metrics. |

## Interfaces / Contracts

No changes to the external REST API inputs or response contracts. The generated data schema for the `K_MEANS` type under `ReporteAvanzadoResponse` is preserved.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit/Integration | `test_advanced_report_service_calculates_all` | Verify that advanced report service generates both Holt-Winters and K-Means reports correctly using the new query logic. |
| Regression | Existing tests in `backend/tests/test_advanced_reports.py` | Execute `pytest backend/tests/test_advanced_reports.py` to verify no regressions. |

## Migration / Rollout

No migration required.

## Open Questions

None.
