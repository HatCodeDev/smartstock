# Tasks: Correct Return Rates and KMeans Logic

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | ~40 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |

### Suggested Work Units
- **Single Work Unit**: Refactor `_calcular_kmeans` query and verify with existing tests.

## Phase 1: Infrastructure / Foundation
- [x] 1.1 Verify pytest environment is clean and all current tests pass.

## Phase 2: Core Implementation
- [x] 2.1 Define subquery grouping by `Evento.producto_id` and `Evento.ciclo_id` where `Ciclo.estado == EstadoCiclo.CERRADO` and events are SALIDA/RETORNO, calculating `venta_neta = salidas - retornos` and exposing `ciclo_fecha`.
- [x] 2.2 Refactor main query `stmt_rfv` in `_calcular_kmeans` to select from this subquery, filter by `venta_neta > 0`, and calculate RFV metrics (max `ciclo_fecha` for Recency, count of cycles for Frequency, and sum of `venta_neta` for Volume).
- [x] 2.3 Ensure volume calculation logic in Python scaling logic correctly handles the query result.

## Phase 3: Testing / Verification
- [x] 3.1 Run tests `pytest backend/tests/test_advanced_reports.py` to verify that Holt-Winters and K-Means segmentation works correctly with the refactored queries.
- [x] 3.2 Add a specific test case (or modify an existing one) in `backend/tests/test_advanced_reports.py` to ensure return rates are correctly discounted at cycle level and K-Means handles it as expected.

## Phase 4: Cleanup / Documentation
- [x] 4.1 Remove any debug prints or unused imports from `backend/app/services/advanced_report_service.py`.
- [x] 4.2 Validate style and formatting constraints.
