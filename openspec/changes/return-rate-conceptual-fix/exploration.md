## Exploration: return-rate-conceptual-fix

### Current State
The return rate metric calculates the percentage of exhibition stock that returns to the warehouse because it wasn't sold. It is calculated as `(retornos / salidas) * 100`.
Currently:
1. It is incorrectly named "Tasa de Devoluciones (Return Rate)" or "devoluciones" (which conceptually implies customer returns of sold items).
2. It is flagged as CRITICAL if it exceeds a default threshold of 20%, which means any product that fails to sell 80%+ of its daily exhibition stock is flagged as critical. This incorrectly flags high-rotation products like 'Toalla de baño grande' (39.1% return rate, i.e., 60.9% sales) as critical.
3. The threshold of 20% is hardcoded in frontend UI, backend model defaults, API schemas, mock simulations, and test assertions.

### Affected Areas
- `backend/app/models/configuracion.py` — Holds the default value of the `umbral_retorno_critico` field in the database table and seed.
- `backend/app/schemas/configuracion.py` — Defines the default schema validation value for `umbral_retorno_critico`.
- `backend/app/routers/reports.py` — Calculates the return rates and uses the threshold fallback to evaluate the `excede_umbral` field in the `/products/return-rates` API endpoint.
- `backend/app/services/alert_service.py` — Evaluates critical return rates at cycle close to trigger `EXCESO_RETORNO` alerts.
- `backend/app/services/pdf_service.py` — Renders the Return Rates and Transit Lead Times section in generated PDF reports.
- `backend/scripts/simulate_history.py` — Seeds the DB with the default configuration including the critical return threshold.
- `backend/tests/test_new_metrics.py` — Test suite containing assertions for return rates and alert triggering.
- `frontend/js/components/ProductDetailModal.js` — Renders the product details modal with return rate widgets, using hardcoded thresholds and Spanish translations ("Tasa de Devoluciones").
- `frontend/js/pages/ReportsPage.js` — Renders the main reports page, with widgets for return rates using hardcoded labels and thresholds for color coding.

### Approaches
1. **Strict Rename & Threshold Adjustment (Recommended)**
   - **Description:** Adjust the default database default and fallback configuration value for `umbral_retorno_critico` to `80.0` (critical alert if >80% returned unsold). Rename all user-facing labels to "Tasa de Retorno de Exhibición" (Exhibition Return Rate) and "Retorno a bodega" (exhibition return) instead of "Devoluciones" (customer returns). Replace hardcoded frontend values with dynamic calculations based on the threshold returned from the API.
   - **Pros:** Corrects the business logic, eliminates false-positive critical alerts for high-rotation products, removes hardcoded values in frontend, and maintains database table and API schema backwards compatibility.
   - **Cons:** Requires updating several files across backend, frontend, scripts, and tests.
   - Effort: Medium

2. **Minimal Text Rename Only**
   - **Description:** Keep the 20% critical threshold but rename the labels in UI and PDF to match "Exhibition Return Rate".
   - **Pros:** Very low code changes.
   - **Cons:** Does not fix the logical issue (high-rotation products will still trigger critical alerts).
   - Effort: Low

### Recommendation
We recommend **Approach 1 (Strict Rename & Threshold Adjustment)**. It is the only way to resolve the underlying logical issue that incorrectly flags successful products as critical while clearing the terminology confusion across all user-facing components.

### Risks
- **Database seeding:** Existing installations with a `configuracion` row already set to `20.0` will need an SQL migration or direct update to avoid keeping the old default limit. But since the system uses an SQLite database `smartstock.db` that is populated via seeding scripts/simulations, we can update the seed script.
- **Test suites:** Updating the default threshold will break tests asserting specific threshold values (e.g. `test_get_products_return_rates` and `test_exceso_retorno_alert_on_cycle_close` in `tests/test_new_metrics.py`). We must adjust these test suites to use the updated values.

### Ready for Proposal
Yes — The system is ready to propose the changes.
