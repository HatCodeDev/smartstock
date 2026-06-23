# Tasks: Exhibition Return Rate Conceptual Fix

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |

## Phase 1: Infrastructure / Foundation
- [x] 1.1 Update backend database models: `backend/app/models/configuracion.py` (change default `umbral_retorno_critico` to 80.0).
- [x] 1.2 Update Pydantic schemas: `backend/app/schemas/configuracion.py` (change default validator value to 80.0).
- [x] 1.3 Update seed data scripts: `backend/scripts/simulate_history.py` (seed `umbral_retorno_critico` as 80.0 by default).

## Phase 2: Core Implementation
- [x] 2.1 Adjust reports logic fallback: `backend/app/routers/reports.py` (change fallback threshold for return rate evaluation to 80.0).
- [x] 2.2 Update alert evaluation: `backend/app/services/alert_service.py` (change fallback to 80.0 and description to 'Tasa de retorno de exhibición crítica...').
- [x] 2.3 Update PDF reports text labels: `backend/app/services/pdf_service.py` (rename 'Tasa de Devoluciones' to 'Tasa de Retorno de Exhibición').
- [x] 2.4 Update product detail modal: `frontend/js/components/ProductDetailModal.js` (update text labels and style status colors dynamically from API value instead of hardcoded 20%).
- [x] 2.5 Update reports dashboard page: `frontend/js/pages/ReportsPage.js` (rename labels and implement dynamic styling based on API values).

## Phase 3: Testing / Verification
- [x] 3.1 Adjust backend tests: `backend/tests/test_new_metrics.py` (update assertions for the critical threshold and new return rate labels).
- [x] 3.2 Verify backend test suite execution.
- [x] 3.3 Manually verify that frontend component rendering and styling respond dynamically to configuration API changes.

## Phase 4: Cleanup / Documentation
- [x] 4.1 Perform clean-up, review code styles and resolve any remaining lint issues.
- [x] 4.2 Document configuration and label changes in PR notes.
