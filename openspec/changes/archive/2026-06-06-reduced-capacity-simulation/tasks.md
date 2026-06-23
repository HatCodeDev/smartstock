# Tasks: Reduced Capacity Simulation

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | 30 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |

## Phase 1: Infrastructure / Foundation
- [x] 1.1 Load Python virtual environment and verify existing test suite passes before modifications.

## Phase 2: Core Implementation
- [x] 2.1 Edit `backend/scripts/simulate_history.py` to change `UNIDADES_INICIALES_MIN` to 6 and `UNIDADES_INICIALES_MAX` to 12.
- [x] 2.2 Change `REPOSICION_UNIDADES_MIN` to 3 and `REPOSICION_UNIDADES_MAX` to 7 in `backend/scripts/simulate_history.py`.
- [x] 2.3 Modify the `PATRONES_SALIDA` dictionary constant values to target a 30-80 daily items range:
  - Lunes (0): (0.12, 0.20)
  - Martes (1): (0.12, 0.20)
  - Miércoles (2): (0.20, 0.30)
  - Jueves (3): (0.15, 0.25)
  - Viernes (4): (0.20, 0.30)
  - Sábado (5): (0.30, 0.40)
  - Domingo (6): (0.30, 0.40)

## Phase 3: Testing / Verification
- [x] 3.1 Run `python backend/scripts/simulate_history.py` inside the backend directory.
- [x] 3.2 Verify generated database outputs: confirm daily portal outflow counts average between 30 and 80 events on weekdays, and up to ~90 on weekends.
- [x] 3.3 Run existing Pytest suite `pytest` inside backend virtual environment to ensure all report and analytics tests pass with the scaled-down dataset.

## Phase 4: Cleanup / Documentation
- [x] 4.1 Clean up any temporary files or terminal logs.
