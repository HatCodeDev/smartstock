# Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

# Implementation Checklist: Mobile Reports (mobile-reports)

This tasks file outlines the implementation steps to optimize the business analytics dashboard for mobile responsiveness and fix timezone alignment.

## Phase 1: CSS & Mobile Layout Fixes
- [x] Update `frontend/css/style.css` to add media queries and overrides:
  - [x] Add rules for `.supply-grid` to stack grids on smaller screens.
  - [x] Style `.clusters-container` and `.cluster-col` to transition from columns to stacked lists.
  - [x] Configure container `overflow-x` rules to prevent layout breaking and enable horizontal scrolling on small viewports.

## Phase 2: Timezone Fixes
- [x] Update config:
  - [x] Add `Settings.TIMEZONE` parameter in `backend/app/config.py`.
- [x] Update cycle service:
  - [x] Update `hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()` in `backend/app/services/cycle_service.py` within `start_cycle` and `get_active_cycle_or_fail`.
- [x] Update backend report endpoints:
  - [x] Refactor averages, trends, and shifts endpoints in `backend/app/routers/reports.py` to calculate local date/month via `ZoneInfo`.
- [x] Update background scheduler jobs:
  - [x] Update `auto_close_job` time string calculations in `backend/app/scheduler/jobs.py` using `ZoneInfo` time.
- [x] Update frontend initialization:
  - [x] Modify the month constructor initialization in `frontend/js/pages/ReportsPage.js` to rely on local Date getters.

## Phase 3: Manual Testing & Verification
- [x] Layout Verification:
  - [x] Verify responsive CSS styles on viewports down to 320px in DevTools (e.g. iPhone SE).
- [x] Timezone Verification:
  - [x] Validate that local dates, shifts, and cycle closures display correctly on timezone boundaries.
