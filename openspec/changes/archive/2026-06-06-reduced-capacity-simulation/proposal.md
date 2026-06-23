# Proposal: Reduced Capacity Simulation

## Intent

Scale down the historical inventory simulator parameters to represent a low-capacity small warehouse/business rather than a large retail store. This aligns the simulated history data with realistic small business behavior and limits daily portal events.

## Scope

### In Scope
- Modify initial stock limits in `backend/scripts/simulate_history.py` to 6-12 units per SKU.
- Modify weekly supplier replenishment quantities to 3-7 units per SKU.
- Scale down daily portal outflow ratios (`PATRONES_SALIDA`) in the simulator for all weekdays to target 30-80 daily items in transit.
- Verify simulated database outputs remain consistent and valid.

### Out of Scope
- Changes to the actual DB schema or models.
- Changes to the real RFID tag lists.
- Changes to the core simulation engine loop or analytical report generation logic.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None

## Approach

Use Option 1 from the exploration. Modify constants and daily ratio dictionaries in `backend/scripts/simulate_history.py` to match the target smaller stock scale and reduced portal throughput. Sales conversion rates (`PATRONES_VENTA`) are left unchanged since the reduced outflow scale naturally yields realistic sales counts.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/scripts/simulate_history.py` | Modified | Update initial stock limits, replenishment limits, and daily outflow patterns. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Out of stock bottlenecks for high-demand items | Medium | Weekday replenishment and proportional sales ratios minimize runouts. |
| Anomalies represent a higher percentage of total daily events | Low | Acceptable as it makes anomalies more prominent for testing. |

## Rollback Plan

Revert the modified variables in `backend/scripts/simulate_history.py` back to their original values via git:
`git checkout -- backend/scripts/simulate_history.py`

## Dependencies

- None

## Success Criteria

- [ ] Initial stocks set to 6-12 units and replenishments to 3-7 units.
- [ ] Portal outflow ranges scale daily to produce 30-80 outflows (up to 90 on weekends).
- [ ] Historical simulator runs to completion without SQL errors.
