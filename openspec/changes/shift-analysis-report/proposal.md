# Architectural Proposal: Shift Analysis Reports (Turnos)

We propose adding a comprehensive, monthly Shift Analysis (Turnos) report. It enables business owners to verify shift active hours, item flow (outputs/returns), and security alerts, evaluating if they complied with standard business operational KPIs.

---

## User Review Required

> [!IMPORTANT]
> **Operational KPIs Defined for Shift Auditing (Revised):**
> To mark a shift/cycle as "Cumplió KPI" (compliant), we define the following rules:
> 1. **Shift Duration KPI**: Shift active duration must be less than 12 hours. Shifts exceeding this or auto-closed due to a daily midnight timeout are marked as forced close warnings.
> 2. **Alert Listing**: Detections of alerts (like `TAG_DESCONOCIDA` or `MOVIMIENTO_DUPLICADO`) will be *listed* and *linked* directly to the shift details for auditor awareness, but they **will NOT** fail the shift compliance. The shift remains marked as "Cumplido / Completado" unless it violates the duration limits.
> 3. **Active Status**: Shift must be closed (`EstadoCiclo.CERRADO`).

---

## Proposed Changes

### 1. Backend Components

#### [MODIFY] [reports.py](file:///c:/Users/misae/smartstock/backend/app/routers/reports.py)
- **New API Route**: `GET /api/reports/shifts`
  - Query parameter: `month` (format `YYYY-MM`, optional, defaults to current UTC month).
  - Fetches all cycles (`Ciclo` table) in that calendar month.
  - Queries aggregate counts of `SALIDA` and `RETORNO` events for each cycle.
  - Queries alert counts and list of alerts.
  - Returns a clean JSON array with cycles and their aggregated stats:
    ```json
    [
      {
        "id": 1,
        "fecha": "2026-05-23",
        "creado_en": "2026-05-23T08:00:00",
        "cerrado_en": "2026-05-23T18:00:00",
        "estado": "CERRADO",
        "cierre_automatico": false,
        "salidas": 45,
        "retornos": 5,
        "alertas_count": 2,
        "kpi_cumplido": true,
        "duracion_segundos": 36000
      }
    ]
    ```
- **PDF Download Integration**:
  - Update `download_pdf_report` route to fetch shift audit data for the current month and pass it to the PDF service.

#### [MODIFY] [pdf_service.py](file:///c:/Users/misae/smartstock/backend/app/services/pdf_service.py)
- Update `PDFReportGenerator` to accept `shifts_data` list.
- Append a new section **"V. AUDITORÍA Y ANÁLISIS DE TURNOS"** at the end.
- Render a premium consolidated summary (Total shifts, average shift hours, number of failed audits) followed by an elegant FPDF table showing:
  - **Date & Shift ID**
  - **Hours** (Start / End / Duration)
  - **Item Flow** (Out / In / Balance)
  - **Auditoría / Status** (Compliant vs Warnings / Forced Close).

---

### 2. Frontend Components

#### [MODIFY] [ReportsPage.js](file:///c:/Users/misae/smartstock/frontend/js/pages/ReportsPage.js)
- **Add "Turnos" Tab**: Insert a new tab option in `reports-tabs-container`.
- **Render State & Handler**:
  - State: `shiftsReport: []`, `selectedMonth: "YYYY-MM"`, `selectedDayShifts: null`, `selectedDayDate: null`.
  - On tab click, load shift data from `/api/reports/shifts?month=YYYY-MM`.
  - Include an interactive Month Picker (`<input type="month">`) to dynamically reload the calendar.
- **Calendar Layout (Heatmap Grid)**:
  - Responsive monthly grid based on `CSS Grid` (7-column layout).
  - Calculates start day offset and total days in month.
  - Color-codes each calendar cell depending on daily shifts:
    - **Grey background**: No shift recorded.
    - **Soft green glow / green border**: All shifts on that day complied with KPIs (normal manual close and duration < 12h).
    - **Soft orange glow / orange border**: Shift was auto-closed / timed out (duration > 12h or forced close).
    - **Badge Indicator for Alerts**: Display a small warning badge or count in the calendar day if shifts triggered alerts, alerting the user to click and inspect them.
- **Auditoría Detail Drawer / Card**:
  - When clicking a day with shifts, displays a clean side-by-side or lower details drawer showing the list of shifts for that day.
  - Displays: start time, end time, active duration, items moved, and a list of specific alerts (e.g. unknown tag IDs) triggered during that shift.
  - Displays a badge stating **"Auditoría: COMPLETADO"** or **"Auditoría: FUERA DE HORA / FORZADO"**.

#### [MODIFY] [style.css](file:///c:/Users/misae/smartstock/frontend/css/style.css)
- Add premium styles for the Heatmap Calendar:
  - `.heatmap-grid`: 7-column grid layout with mobile fallback.
  - `.heatmap-day-header`: Header fonts.
  - `.heatmap-cell`: Base styling for cells (aspect-ratio 1:1, flexbox center, border-radius, transition effects, glow shadows).
  - `.cell-none`, `.cell-success`, `.cell-warning` color classes with elegant, tailored premium colors (violet/slate theme).
  - `.shift-detail-drawer`: Detail card layout.

---

## Verification Plan

### Automated Tests
- Create unit tests in backend (`backend/tests/test_shift_reports.py`) to verify:
  - API endpoint returns correct aggregations (duration, event counts, alert counts) for various database scenarios.
  - Correct KPI calculations for compliant and non-compliant shifts (alerts listed but not failing the compliance).
  - PDF generation builds successfully when shifts data is supplied.

### Manual Verification
- Deploy and open the web app to choose the "Turnos" tab.
- Change the month picker and verify that the Heatmap Grid redraws correctly.
- Click a day and verify the Drawer details render correctly with its warnings/alerts listed.
- Download the PDF and verify the new table prints cleanly across letter boundaries.
