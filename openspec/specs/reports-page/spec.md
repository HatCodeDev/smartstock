# Specification: Mobile Reports Responsive Layouts

## 1. Purpose
This document specifies the responsive and mobile-friendly behaviors for the SmartStock reports page (planning, health, and audit views) on viewports below or equal to 768px width, and local timezone handling.

## 2. Requirements and Scenarios

### Requirement 1: Mobile Table Collapsible Cards
On viewports < 768px, report tables MUST collapse into vertical accordion cards. 
- The card header MUST display key summary columns (e.g., product name/EPC, status).
- Secondary details MUST be hidden by default and toggle visible upon tapping the header.
- On viewports >= 768px, data MUST render as standard tabular grids.

#### Scenario 1.1: Responsive Viewport Switch
- **GIVEN** a reports page with planning, health, or audit tables loaded
- **WHEN** the viewport width is resized below 768px
- **THEN** standard table grids MUST be hidden
- **AND** a vertical stack of accordion cards MUST be rendered in their place.

#### Scenario 1.2: Expand and Collapse Card Details
- **GIVEN** a collapsed accordion card on a viewport < 768px
- **WHEN** the user taps the card header
- **THEN** the card details section MUST expand and become visible.
- **WHEN** the user taps the header of an expanded card
- **THEN** the card details section MUST collapse and become hidden.

---

### Requirement 2: Touch-Scrollable CSS Charts
Projections and transit charts MUST NOT cause the main viewport to scroll horizontally. They MUST overflow horizontally inside a dedicated touch-scrollable container.

#### Scenario 2.1: Horizontal Chart Touch Scrolling
- **GIVEN** a report chart on a viewport < 768px
- **WHEN** the user touch-drags horizontally over the chart area
- **THEN** the chart container MUST scroll horizontally to reveal hidden chart areas
- **AND** the parent reports page viewport MUST NOT scroll horizontally.

---

### Requirement 3: Long Product Name Truncation & Modal Detail
Product list names longer than 20 characters MUST be truncated with an ellipsis (...) on mobile viewports. The full name MUST be accessible via a modal dialog on tap.

#### Scenario 3.1: Text Truncation on Mobile Viewports
- **GIVEN** a product item with a name longer than 20 characters (e.g., "Premium RFID Denim Jacket") on a viewport < 768px
- **WHEN** the item renders in the list or card view
- **THEN** the name MUST be truncated to 20 characters and appended with "..." (e.g., "Premium RFID Denim J...")
- **AND** the full product name MUST NOT wrap or overflow the line bounds.

#### Scenario 3.2: Modal Detail Trigger on Tap
- **GIVEN** a truncated product name on a viewport < 768px
- **WHEN** the user taps the truncated text
- **THEN** a modal dialog displaying the full product name and details MUST open in the center of the screen
- **AND** standard interaction behind the modal MUST be disabled.
- **WHEN** the user taps the close button or the modal backdrop
- **THEN** the modal dialog MUST close.

---

### Requirement 4: Mobile Filter Floating Action Button (FAB) & Overlay
In viewports < 768px, default filter controls MUST NOT be displayed directly on the page layout. Instead, a Floating Action Button (FAB) MUST render fixed at the bottom-right. Tapping this FAB MUST launch a full-screen overlay modal containing all filters.

#### Scenario 4.1: FAB Visibility by Viewport
- **GIVEN** the reports page on a viewport < 768px
- **WHEN** the page loads
- **THEN** desktop inline filters MUST be hidden
- **AND** a Floating Action Button (FAB) MUST render fixed at the bottom-right corner.

#### Scenario 4.2: Filter Selection and Application
- **GIVEN** the filter FAB is visible on a viewport < 768px
- **WHEN** the user taps the FAB
- **THEN** a full-screen overlay modal with all filter selectors MUST open.
- **WHEN** the user adjusts selectors and taps the "Apply" button inside the modal
- **THEN** the overlay modal MUST close
- **AND** the reports page data MUST update with the selected filters.
- **WHEN** the user taps the "Close" button without selecting "Apply"
- **THEN** the overlay modal MUST close without changing current active filters.

---

### Requirement 5: Mobile Grid Layout
On viewports <= 768px, page layout grids and containers MUST stack vertically to ensure readability on small screens.

#### Scenario 5.1: Responsive Column Grid Wrap
- **GIVEN** a reports page with a supply-grid container (`.supply-grid`)
- **WHEN** the viewport width is <= 768px
- **THEN** the grid columns MUST wrap so that `.supply-grid` is displayed in a single-column layout.

#### Scenario 5.2: Stacked Cluster Cards
- **GIVEN** a clusters container containing cluster cards
- **WHEN** the viewport width is <= 768px
- **THEN** the cluster cards MUST stack vertically.

---

### Requirement 6: Timezone-Aware Date Handling
All report cycles and date selections MUST run in the local timezone ('America/Mexico_City') to avoid midnight roll-over discrepancies caused by UTC.

#### Scenario 6.1: Backend Cycle Creation and Closure Timezone
- **GIVEN** a request to start or close an inventory cycle
- **WHEN** the backend processes the lifecycle event
- **THEN** the cycle dates and times MUST be computed and stored in the database in the local timezone ('America/Mexico_City') instead of UTC.

#### Scenario 6.2: Initial Frontend Month Selection Timezone
- **GIVEN** the reports page loading on the frontend
- **WHEN** the initial `selectedMonth` is computed for the filter input
- **THEN** the initial month and year values MUST correspond to the local date in the 'America/Mexico_City' timezone.
