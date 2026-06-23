# Proposal: Return Rate Conceptual Fix

## Intent

Correct the terminology and logical definition of the return rate metric from "Tasa de Devoluciones" (implying customer returns) to "Tasa de Retorno de Exhibición" (unsold merchandise returning to warehouse) and adjust the critical alarm threshold from 20% to 80% to eliminate false positives.

## Scope

### In Scope
- Update DB default and seeding threshold to 80.0.
- Rename UI/report labels and variable strings to "Tasa de Retorno de Exhibición".
- Feed threshold dynamically to frontend to color code rows based on the API response.
- Update tests and simulation history to match new default and logic.

### Out of Scope
- Architectural changes to DB tables or API field names.
- Creating a separate customer returns metric.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `reports-page`: Renamed the returns section to Exhibition Return Rate and changed the color status threshold logic to be dynamic and default to 80% (alarm if return rate > 80%).
- `product-detail-modal`: Renamed return rate label and corrected status calculation.

## Approach

1. **Backend Update**: Modify database defaults, schemas, alert logic, report calculations, PDF generation, and historical data simulator to use a default critical threshold of 80.0% instead of 20.0%, and use "Tasa de Retorno de Exhibición".
2. **Frontend Update**: Replace hardcoded "Tasa de Devoluciones" names. Replace hardcoded 20% threshold with the dynamic `umbral_retorno_critico` value returned by the configurations API.
3. **Verification**: Update unit/integration tests that assert return rate alerts and thresholds.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/models/configuracion.py` | Modified | Change DB schema and DDL default to 80.0 |
| `backend/app/schemas/configuracion.py` | Modified | Update Pydantic schemas default to 80.0 |
| `backend/app/routers/reports.py` | Modified | Rename Spanish labels/descriptions, update fallback threshold |
| `backend/app/services/alert_service.py` | Modified | Rename alert descriptions and check values |
| `backend/app/services/pdf_service.py` | Modified | Rename PDF layout sections |
| `backend/scripts/simulate_history.py` | Modified | Seed the DB configurations table with 80.0 |
| `backend/tests/test_new_metrics.py` | Modified | Adjust tests to assert new labels and 80.0 threshold |
| `frontend/js/components/ProductDetailModal.js` | Modified | Rename label and fetch dynamic threshold for styling |
| `frontend/js/pages/ReportsPage.js` | Modified | Rename label and check status dynamically using API threshold |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| DB out-of-sync | Low | Re-run database seeding/simulations for local development |
| Test failures | Low | Update test suite assertions to match 80.0 threshold |

## Rollback Plan

Revert git changes to return database default to 20.0, UI text to "Tasa de Devoluciones", and hardcoded threshold styling in frontend.

## Dependencies

- None

## Success Criteria

- [ ] Metric name is displayed as "Tasa de Retorno de Exhibición" in frontend and PDFs.
- [ ] Products with return rates <= 80% do not trigger critical alerts.
- [ ] Frontend styling dynamically uses the API configuration threshold instead of hardcoded 20%.
- [ ] All backend test suites pass with new threshold assertions.
