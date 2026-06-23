# Proposal: Realistic Simulation History

## Intent
Stabilize the daily sales simulation in `backend/scripts/simulate_history.py`. The current compounding of low/high rates causes an unrealistic 19x Saturday-to-Monday sales variance, depleting inventory and distorting Holt-Winters forecasting and K-Means clustering.

## Scope

### In Scope
- Adjust `PATRONES_SALIDA` and `PATRONES_VENTA` daily rates in `backend/scripts/simulate_history.py`.
- Lower holiday sales conversion rates in `_calcular_porcentaje_venta` to prevent extreme stock depletion.
- Keep Sunday/Saturday-to-Monday sales ratio around ~3.6x.

### Out of Scope
- Modifying database schemas or models.
- Changing the simulation flow logic (portal-first architecture).
- Modifying frontend views or reports.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None

## Approach
Implement Option 1 from exploration:
1. Re-scale `PATRONES_SALIDA` and `PATRONES_VENTA` to reflect a stable, realistic weekly pattern.
2. Limit holiday conversion spikes to 40-50% max in `_calcular_porcentaje_venta`.
3. Settle inventory turnover at ~40% weekly to match standard replenishment.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/scripts/simulate_history.py` | Modified | Update daily patterns, holiday rates, and sales percentages. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Seasonality too weak for Holt-Winters | Low | Retain a clear 3.6x weekend-to-weekday ratio to keep trend patterns distinct. |
| Simulation run fails | Low | Keep script logic unchanged; verify by running script and checking DB logs. |

## Rollback Plan
Discard script changes and restore original version using Git:
```bash
git checkout -- backend/scripts/simulate_history.py
```
Re-run simulation script to reconstruct database tables.

## Dependencies
- None

## Success Criteria
- [ ] Daily Saturday-to-Monday sales ratio is within 3.3x to 3.8x range.
- [ ] Peak holiday sales conversion rates do not exceed 50%.
- [ ] Successful execution of `backend/scripts/simulate_history.py` without errors, regenerating the DB.

## Proposal question round
1. Should holiday sales patterns still have minor relative variance (e.g., Mother's Day at 50%, Battle of Puebla at 40%), or should they all be capped at exactly 50%?
2. Are there any other high-sales seasonal dates (like late December) that we should configure now?
3. Assumption: The Holt-Winters parameters in the reports service do not need calibration to handle this new stabilized data. Is this correct?
