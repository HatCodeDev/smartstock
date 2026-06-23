# Proposal: Correct Return Rates and K-Means Logic

## Intent

Refactor K-Means clustering RFV (Recency, Frequency, Volume) calculations to align with the core business rule that sales metrics must be evaluated at the cycle level and only count active net sales cycles (sales - returns > 0).

## Scope

### In Scope
- Refactor `_calcular_kmeans` in `backend/app/services/advanced_report_service.py` to use a SQL subquery.
- Aggregate daily events by product and cycle to find net sales (`salidas - retornos`).
- Filter metrics calculations (Recency, Frequency, Volume) to only include cycles with positive net sales.
- Ensure proper fallback values for products without active sales.

### Out of Scope
- Modifying return rate thresholds or related schemas.
- Modifying the clustering algorithm logic or the number of clusters.
- Modifying other reports or services.

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.
> Research `openspec/specs/` before filling this in.

### New Capabilities
None

### Modified Capabilities
None

## Approach

Use a SQL subquery (Approach A) in SQLAlchemy to first group events by product, cycle, and date, computing `venta_neta` as `salidas - retornos`. Then query this subquery in the outer SELECT, filtering `venta_neta > 0` to compute:
- Recency: Max cycle date where `venta_neta > 0`.
- Frequency: Count of cycles where `venta_neta > 0`.
- Volume: Sum of `venta_neta` where `venta_neta > 0`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/app/services/advanced_report_service.py` | Modified | Refactor `_calcular_kmeans` database query to use SQL subquery aggregation. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Database query performance degradation | Low | DB is indexed by `producto_id`, `ciclo_id`, and `Ciclo.estado`. Data volume is small-medium. |
| Test failures on analytics test cases | Medium | Run existing unit/integration tests and update assertions/mocks to reflect the new logic. |

## Rollback Plan

Revert the changes in `backend/app/services/advanced_report_service.py` using git:
`git checkout HEAD -- backend/app/services/advanced_report_service.py`

## Dependencies

None

## Success Criteria

- [ ] Refactored K-Means logic aggregates metrics only using cycles with positive net sales.
- [ ] Products with net sales <= 0 in a cycle do not count towards Recency or Frequency.
- [ ] Volume correctly reflects sum of positive cycle net sales.
- [ ] All existing backend tests pass.
