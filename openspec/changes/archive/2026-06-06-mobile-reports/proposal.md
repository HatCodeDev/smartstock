# Proposal: Mobile Reports Improvements

## Intent
Improve reports page mobile UX by preventing overflow, overlapping elements, and horizontal scroll while fixing timezone issues on backend/frontend.

## Scope
* **In Scope**:
  * Responsive mobile layouts (collapsible cards for tables, touch slider for charts, detail modals for truncated text, floating filter overlay).
  * Fixing grid overflows: `.supply-grid` single-column wrap, `.clusters-container` column layout, `.cluster-col` shrinking.
  * Date/Timezone settings: `TIMEZONE` config in backend, timezone-aware localized datetime queries, and timezone-aware frontend reporting months.
* **Out of Scope**:
  * Design changes to non-report pages.
  * Backend modifications unrelated to reports or timezone logic.

## Capabilities
* **New**: None.
* **Modified**: `reports-page`.

## Approach
1. **Responsive Layouts**: Replace report tables with responsive card/accordion elements on mobile. Add touch-scroll containers for bar charts.
2. **Details Modal**: Truncate long text and display a modal on click.
3. **Floating Filters**: Toggle filter options using a mobile floating action button and overlay.
4. **Grid Fixes**: Wrap `.supply-grid` to 1 column on screens <= 768px. Force `.clusters-container` to column layout and allow `.cluster-col` to shrink below 260px. Limit `overflow-x` on `.reports-page` and `.reports-tab-content`.
5. **Timezone/Date Fixes**:
   * Add `TIMEZONE` ('America/Mexico_City') to backend `config.py`.
   * Update backend datetime calls in `cycle_service.py`, `reports.py`, and `jobs.py` using `ZoneInfo(settings.TIMEZONE)`.
   * Update `selectedMonth` in `ReportsPage.js` to compute based on local time instead of UTC.

## Affected Areas
| Component | File Path |
|---|---|
| Backend Config | `backend/app/config.py` |
| Backend Services | `backend/app/services/cycle_service.py` |
| Backend API | `backend/app/routers/reports.py` |
| Scheduler | `backend/app/scheduler/jobs.py` |
| Frontend JS | `frontend/js/pages/ReportsPage.js` |
| Frontend CSS | `frontend/css/style.css` |

## Rollback Plan
Perform a Git revert of the implementation commit or restore files from the backup branch.

## Success Criteria
* No horizontal scroll or overflow on mobile viewports (320px–768px).
* Cards collapse/expand correctly. CSS bar charts scrollable via touch.
* Filters function correctly using the floating overlay.
* All backend/frontend reports use the configured local timezone instead of UTC.
