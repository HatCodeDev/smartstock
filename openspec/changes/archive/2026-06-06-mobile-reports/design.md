# Technical Design - Mobile Reports Layout and Timezone Dates

This design document outlines the implementation plan for enhancing the mobile responsiveness of the reports page and fixing timezone/date alignment issues.

## 1. Technical Approach

### CSS Responsive Grids
To optimize the Reports UI for mobile viewports (widths $\le$ 768px), we will introduce responsive CSS overrides inside `frontend/css/style.css`. Because many grid layout attributes are injected via inline styles in `ReportsPage.js`, we will use `!important` declarations to override them.
- **Supply Grid**: Override `.supply-grid` to stack items (`grid-template-columns: 1fr`) with standard gap (`1.5rem`).
- **Clusters Layout**: Configure `.clusters-container` to stack vertically (`flex-direction: column`) and set `.cluster-col` to full width (`width: 100%`) while allowing it to shrink (`min-width: 0`).
- **Overflow Prevention**: Apply `max-width: 100%` and `overflow-x: hidden` to `.reports-page` and `.reports-tab-content` to prevent horizontal scrolling.

### Timezone Dates alignment
To avoid discrepancy where actions performed late in the evening appear on the wrong calendar day (due to UTC vs local offset), the system will use a centralized timezone setting (`America/Mexico_City`).
- **Backend Configuration**: A new config parameter `TIMEZONE` will be introduced in the `Settings` class.
- **Service & Routers**: Update date logic to utilize python's `zoneinfo.ZoneInfo` for retrieving local date and time representations.
- **Frontend Initialization**: Set the default selected month in the `ReportsPage` constructor using local timezone methods rather than a UTC-based ISO string representation.

---

## 2. Architecture Decisions

- **Decision 1: Native Timezone Handling (`zoneinfo`)**
  * *Rationale*: `zoneinfo` is part of Python 3.9+ standard library, reducing external dependency complexity (like `pytz` or `dateutil`).
- **Decision 2: Strict Overrides (`!important`)**
  * *Rationale*: Since inline styles are used in `ReportsPage.js` for grids, media queries in `style.css` require `!important` to take precedence.
- **Decision 3: Local Date Construction**
  * *Rationale*: Constructing the month string in Javascript using local Date getters (`getFullYear()`, `getMonth()`) ensures client-side timezone offset matches backend local date.

---

## 3. File Changes

### Backend

#### `backend/app/config.py`
Add `TIMEZONE` parameter to Settings.
```python
class Settings(BaseSettings):
    # ...
    TIMEZONE: str = "America/Mexico_City"
```

#### `backend/app/services/cycle_service.py`
Import `ZoneInfo` and update current date checking.
```python
from zoneinfo import ZoneInfo
# settings is already imported

# In start_cycle:
hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()

# In get_active_cycle_or_fail:
hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()
```

#### `backend/app/routers/reports.py`
Use `ZoneInfo` for local dates/months.
```python
from zoneinfo import ZoneInfo
from app.config import settings

# In get_weekday_averages:
hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()

# In get_weekly_trends:
hoy = datetime.now(ZoneInfo(settings.TIMEZONE)).date()

# In get_shifts_report:
if not month:
    month = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m")
```

#### `backend/app/scheduler/jobs.py`
Update current local time extraction in the automatic closing scheduler task.
```python
from zoneinfo import ZoneInfo
from app.config import settings

# In auto_close_job:
current_time_str = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%H:%M")
```

### Frontend

#### `frontend/js/pages/ReportsPage.js`
Update the `selectedMonth` initialization to build the "YYYY-MM" string using local Date getters.
```javascript
const localDate = new Date();
const localYear = localDate.getFullYear();
const localMonth = String(localDate.getMonth() + 1).padStart(2, '0');
this.state = {
  // ...
  selectedMonth: `${localYear}-${localMonth}`, // "YYYY-MM"
  // ...
};
```

#### `frontend/css/style.css`
Append media query overrides inside the mobile reports section.
```css
@media (max-width: 768px) {
  .supply-grid {
    grid-template-columns: 1fr !important;
    gap: 1.5rem !important;
  }
  .clusters-container {
    flex-direction: column !important;
  }
  .cluster-col {
    min-width: 0 !important;
    width: 100% !important;
  }
}

.reports-page,
.reports-tab-content {
  max-width: 100%;
  overflow-x: hidden;
}
```

---

## 4. Testing Strategy

- **CSS Layout Tests**: Emulate screen widths $< 768px$ in Chrome DevTools to verify that `.supply-grid` and `.clusters-container` correctly collapse into a single-column layout without causing overflow.
- **Timezone Boundary Tests**:
  * Set backend system clock close to midnight in Mexico City timezone.
  * Trigger cycle creation and validation to verify they register on the correct calendar date.
  * Verify shifts reports aggregate events on local date boundaries instead of UTC date boundaries.
