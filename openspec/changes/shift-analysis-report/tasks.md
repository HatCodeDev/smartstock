# Implementation Checklist: Shift Analysis Reports (Turnos)

Below is the list of implementation tasks required to implement the Turnos analysis feature.

## Phase 1: Backend Implementation
- [ ] Create endpoint `GET /api/reports/shifts` in `app/routers/reports.py`.
  - [ ] Implement date parsing for `month` parameter with UTC month fallback.
  - [ ] Write optimized database queries to aggregate outputs (`SALIDA`), returns (`RETORNO`), and alerts per shift without N+1.
  - [ ] Compute shift durations and evaluate KPI compliance logic.
  - [ ] Map alerts inside responses for frontend audit visualization.
- [ ] Update PDF service in `app/services/pdf_service.py` and `app/routers/reports.py`.
  - [ ] Update `download_pdf_report` endpoint to fetch shift aggregates for the current month and pass them to PDF generator.
  - [ ] Implement `PDFReportGenerator.draw_section_header` and `draw_card` layout for the new section `"V. AUDITORÍA Y ANÁLISIS DE TURNOS (MENSUAL)"`.
  - [ ] Render a consolidated table matching premium slate-violet themes, formatting start/end times, durations, flows, and compliances.

## Phase 2: Frontend Implementation
- [ ] Update `frontend/js/pages/ReportsPage.js` tabs and handlers.
  - [ ] Add `"turnos"` tab to HTML layout and style highlights.
  - [ ] Add `selectedMonth`, `shiftsReport`, `selectedDayShifts`, `selectedDayDate` to page state.
  - [ ] Fetch shift data on month selection or tab selection from `/api/reports/shifts?month=YYYY-MM`.
- [ ] Add dynamic Heatmap Calendar to `ReportsPage.js`.
  - [ ] Compute month day offsets and total days dynamically.
  - [ ] Render 7-column Sun-Sat grid.
  - [ ] Map dates, evaluate styling class `.cell-success` (KPI compliant) and `.cell-warning` (auto-closed / warnings).
  - [ ] Render red count badges `.cell-alert-badge` for cells with alerts.
- [ ] Add Auditoría Detail Drawer.
  - [ ] Render a clean details card on day cell click.
  - [ ] Loop shifts of that day, show IDs, timings, flows, warnings, and compliant badges.
  - [ ] Renders sub-cards listing alert titles and descriptions.
- [ ] Add CSS Styling in `frontend/css/style.css`.
  - [ ] Add CSS Grid styling, cell aspect ratios, hover translations, shadows.
  - [ ] Add tailored, glowing color shades (`.cell-success`, `.cell-warning`) and round badge positions.

## Phase 3: Verification and Testing
- [ ] Write backend unit tests in `backend/tests/test_shift_reports.py` to verify endpoint outputs, KPI calculations, and FPDF builders.
- [ ] Manually verify Heatmap Month Picker and click interactions in browser.
- [ ] Verify PDF download contains the beautifully formatted turn audit section.
