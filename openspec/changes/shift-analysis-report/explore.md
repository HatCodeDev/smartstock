# Exploration Report: Shift Analysis (Turnos)

## Objective
The objective is to introduce a Shift Analysis ("Análisis de Turnos") subsection inside the Reports section, both on the web dashboard and in the exported PDF report.
- **Web UI**: An interactive, responsive Heatmap Calendar (using CSS Grid and Vanilla JS) allowing the user to select a month and visualize daily turn outcomes at a glance. Clicking a day opens a slide-over/panel with details (KPIs met, audits, shift times, outputs, returns, and alerts).
- **PDF Report**: A clean, consolidated table or list presenting monthly shifts, duration, and incidents, matching the premium aesthetic.

---

## Technical Feasibility & Backend Analysis
The backend database schema in SmartStock already has all the building blocks to implement this feature elegantly:

1. **`Ciclo` Model (`ciclos` table)**:
   - `id`: Unique identifier for each shift/cycle.
   - `creado_en`: Timestamp of shift opening.
   - `cerrado_en`: Timestamp of shift closing.
   - `fecha`: Date of the shift.
   - `cierre_automatico`: Flag indicating if it closed due to schedule timeout.
   - Relationships with `eventos` and `alertas`.

2. **`Evento` Model (`eventos` table)**:
   - `ciclo_id`: Links events to their respective shift.
   - `tipo`: Either `SALIDA` or `RETORNO`.
   - Used to count total items processed.

3. **`Alerta` Model (`alertas` table)**:
   - `ciclo_id`: Links alerts to their respective shift.
   - `tipo`: Types of alerts (`TAG_DESCONOCIDA`, `MODO_REGISTRO_ACTIVO`, `MOVIMIENTO_DUPLICADO`).

### Required Backend Enhancements
- **New API Endpoint**: `GET /api/reports/shifts?month=YYYY-MM`
  - Fetches all closed and open cycles for the given month.
  - Efficiently groups and aggregates details using SQL `GROUP BY` to retrieve:
    - Shift duration (`cerrado_en - creado_en` in seconds).
    - Total inputs and outputs.
    - Counts of different types of alerts.
    - KPI evaluation:
      - **KPI 1: Shift Duration** (e.g., standard tianguis/shift duration < 12 hours. Shifts exceeding this or auto-closed indicate potential audit issues).
      - **KPI 2: Alert Threshold** (e.g., zero critical alerts, or <= 2 alerts per shift).
      - **KPI 3: Return Balance** (whether the flow of items aligns with normal daily limits).

---

## Web Frontend Design (Vanilla JS & Heatmap Calendar)
The current frontend is a modern SPA written in modular **Vanilla JS** (using `BaseComponent` classes) with maximum focus on low overhead and rich visuals.

### Web Architecture Enhancements
1. **Interactive Heatmap Calendar**:
   - Built dynamically using Vanilla JS inside `ReportsPage.js` using a custom `CSS Grid` layout.
   - Fits any screen width (mobile-friendly).
   - Monthly grid (Sun-Sat headers followed by day squares).
   - Cell color grading:
     - **Grey / Clear**: No shifts recorded.
     - **Glow Green**: Shifts completed with zero alerts and closed normally.
     - **Glow Amber**: Shifts closed automatically or with low-priority alerts.
     - **Glow Red**: Shifts with critical alerts (e.g. unknown tag detections or duplicate movements) or audit failures.
2. **Details Drawer (Slide-Over Panel / Lower Section)**:
   - Tapping any calendar day updates the state and opens a dedicated detail card.
   - Shows a list of all shifts in that day, duration, audit status (whether KPIs were met), and clickable alert badges.

---

## PDF Report Design
The premium PDF report generator (`pdf_service.py` using `FPDF` in Python) will be extended to include:
- A new section **"V. AUDITORÍA Y ANÁLISIS DE TURNOS (MENSUAL)"**.
- Consolidated metrics (total shifts, total duration, total unresolved alerts).
- A clean, beautiful table displaying each shift, date, active hours, item balance, and flagged warnings/alerts, matching the existing palette (violet accent, slate text).

---

## Technical Tradeoffs & Architectural Alignment
- **Vanilla JS Components**: Keeps the bundle light without heavy calendar libraries. Perfect alignment with the frontend architecture.
- **SQL Aggregations**: Moving aggregations to SQL rather than loading raw events in memory avoids huge query overhead and limits memory consumption during monthly scale.
