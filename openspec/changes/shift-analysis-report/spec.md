# Technical Specification: Shift Analysis Reports (Turnos)

This document provides the formal technical specification for the monthly Shift Analysis and Auditoría reports.

---

## 1. Backend Specifications

### 1.1 API Endpoint: `GET /api/reports/shifts`

- **Endpoint**: `/api/reports/shifts`
- **Method**: `GET`
- **Authentication**: Required (JWT Bearer Token via `Depends(get_current_user)`).
- **Query Parameters**:
  - `month` (string, optional): Format `YYYY-MM` (e.g., `"2026-05"`). Defaults to current UTC month.
- **SQL Aggregation and Logic**:
  - Resolve the calendar month date range:
    ```python
    start_date = datetime.strptime(f"{month}-01", "%Y-%m-%d").date()
    # next month start minus 1 day
    if start_date.month == 12:
        end_date = date(start_date.year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(start_date.year, start_date.month + 1, 1) - timedelta(days=1)
    ```
  - Query all `Ciclo` objects where `Ciclo.fecha` falls between `start_date` and `end_date` (inclusive).
  - To prevent performance degradation, perform eager loading or structured group-by queries to fetch:
    1. Count of `Evento` where `tipo == TipoEvento.SALIDA`.
    2. Count of `Evento` where `tipo == TipoEvento.RETORNO`.
    3. Count of `Alerta` linked to the cycle.
    4. Full list of alerts linked to the cycle (types and descriptions) for frontend audit drawer rendering.
- **KPI Compliance Logic**:
  - `duracion_segundos = (cerrado_en - creado_en).total_seconds()` if `cerrado_en` else `None`.
  - `kpi_cumplido` is `True` if and only if:
    1. `estado == EstadoCiclo.CERRADO`.
    2. `cierre_automatico == False`.
    3. `duracion_segundos` is not `None` and is strictly less than 12 hours (`43200` seconds).
- **Pydantic Response Schema**:
  ```python
  class AlertaDetailSchema(BaseModel):
      tipo: str
      descripcion: str
      timestamp: datetime

  class ShiftReportItemSchema(BaseModel):
      id: int
      fecha: date
      creado_en: datetime
      cerrado_en: datetime | None
      estado: str
      cierre_automatico: bool
      salidas: int
      retornos: int
      alertas_count: int
      alertas: List[AlertaDetailSchema]
      kpi_cumplido: bool
      duracion_segundos: float | None
  ```

---

### 1.2 PDF Service Specification

- **Module**: `app/services/pdf_service.py` -> `PDFReportGenerator`
- **Method**: `generate_pdf` signature update:
  - Add optional keyword argument: `shifts_data: List[dict] = None`.
- **Layout Specification**:
  - Add page break if `self.get_y() > 180` to keep rendering aligned.
  - Draw standard section header: `"V. AUDITORÍA Y ANÁLISIS DE TURNOS (MENSUAL)"`.
  - Draw 2 summary cards or banners horizontally:
    - **Card 1 (Horas Operativas)**: Average shift duration and total shifts in month.
    - **Card 2 (Cumplimiento de Horarios)**: Number of forced closures / auto-closed shifts (KPI failures).
  - Draw Table:
    - **Header Row**: Date (25mm) | ID (15mm) | Horario (45mm) | Salidas (20mm) | Retornos (20mm) | Alertas (20mm) | Auditoría (40mm).
    - **Fonts**: Helvetica 8pt for body, Bold for headers.
    - **Colors**: Slate background for headers, slate text for rows.
    - **KPI Audit Status Badge**:
      - If `kpi_cumplido` is `True`, print `"CUMPLIDO"` in green text (`34, 197, 94`).
      - If `kpi_cumplido` is `False`, print `"CIERRE FORZADO"` or `"ABIERTO"` in amber text (`245, 158, 11`).

---

## 2. Frontend Specifications

### 2.1 Tab and Route Integration
- **`ReportsPage.js`**:
  - Add tab button with `data-tab="turnos"`.
  - Render an interactive calendar and detail cards under `activeTab === "turnos"`.

### 2.2 Heatmap Calendar layout
- **Month Selector**: An `<input type="month">` control. Defaults to current month `YYYY-MM`. Changing this triggers a new fetch.
- **Calendar Grid Generation**:
  - Calculate:
    - Days in the selected month: `new Date(year, month, 0).getDate()`.
    - Starting day of week offset: `new Date(year, month - 1, 1).getDay()` (adjust for Monday or Sunday start).
  - Render a grid of `heatmap-cell` elements.
  - For each day cell, check the shifts fetched for that date:
    - **No shifts**: Render cell with `.cell-none` (neutral dark background).
    - **Shifts exist & all complied**: Render cell with `.cell-success` (soft green glow, dark green background).
    - **Shifts exist & any failed (forced closed / auto-closed)**: Render cell with `.cell-warning` (soft orange glow, dark amber background).
    - **Alert Badge**: If the shifts on that day triggered any alerts, display a small red dot/badge with the count in the top-right corner of the cell.

### 2.3 Auditoría Detail Drawer
- Rendered side-by-side on desktop or stacked below the calendar on mobile.
- Shows details for the selected calendar day:
  - **Header**: "Auditoría de Turnos - [Fecha]"
  - **Content**: Iterate through all shifts of that day. For each shift:
    - Title: **Turno #[ID]**
    - Timestamps: Start / End (formatted in local time).
    - Duration: Displayed as `Xh Ym` or "Activo" if still open.
    - Flows: Output count, Return count, Net balance.
    - Status Badge: `CUMPLIDO` (Green) or `CIERRE FORZADO / NO CUMPLIDO` (Amber).
    - Alerts: If alerts are present, list them inside an informational card `⚠️ [Alerta Tipo]: [Descripción]`.

---

## 3. Styling Specifications (`style.css`)
We define dedicated, premium visual classes matching the existing SmartStock palette (dark mode, glassmorphism, glowing accents):

```css
/* Heatmap Calendar layout */
.heatmap-container {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 2rem;
}
@media (max-width: 900px) {
  .heatmap-container {
    grid-template-columns: 1fr;
  }
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
  margin-top: 1rem;
}

.heatmap-day-header {
  text-align: center;
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  padding-bottom: 0.5rem;
}

.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.heatmap-cell:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(108, 92, 231, 0.15);
}

.heatmap-cell .cell-number {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text);
}

/* Colors and Glows */
.cell-none {
  opacity: 0.5;
}

.cell-success {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  box-shadow: inset 0 0 12px rgba(34, 197, 94, 0.05);
}
.cell-success:hover {
  border-color: var(--success);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);
}

.cell-warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  box-shadow: inset 0 0 12px rgba(245, 158, 11, 0.05);
}
.cell-warning:hover {
  border-color: var(--warning);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
}

/* Alerts Dot Badge */
.cell-alert-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--danger);
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
}
```
