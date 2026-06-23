## Exploration: mobile-responsiveness-reports

### Current State
The Reports section of SmartStock has three primary analytical tabs (Planificación de Compras, Salud de Inventario, Auditoría de Turnos). The page styling relies on high-quality desktop-first inline styles in `ReportsPage.js` and a shared stylesheet `style.css`.
Currently, under mobile viewports (< 768px and down to 320px), multiple components experience clipping, text overlaps, horizontal scrolls, and visual layout degradation due to hardcoded inline column grids, absolute badges, and non-responsive container paddings.

### Affected Areas
- `frontend/js/pages/ReportsPage.js` — Contains inline CSS values for layout containers, paddings, and grids (`supply-grid`, `clusters-container`, `.shift-audit-card` sub-grids) that must be refactored into classes or styled responsively.
- `frontend/css/style.css` — Needs addition of mobile-first and responsive overrides for the reports containers, grids, charts, cells, and drawer components.

### Approaches
1. **Move Inline Styles to CSS Classes & Media Queries (Recommended)**
   - Pros:
     - Maintains clean separation of concerns (HTML content structure in JS, visual presentation in CSS).
     - Allows complete use of CSS media queries without complex JavaScript layout math.
     - Better performance and cleaner code structure.
   - Cons:
     - Requires modifying both `ReportsPage.js` and `style.css`.
   - Effort: Medium

2. **Dynamic JS Viewport States & Dynamic Style Calculation**
   - Pros:
     - Keeps all logic inside the single `ReportsPage.js` file.
   - Cons:
     - Increases complexity with dynamic resize event listeners and state management.
     - Prone to layout lag and recalculation performance bottlenecks on mobile devices.
   - Effort: High

### Recommendation
Implement **Approach 1**. Moving inline grid, spacing, and width parameters to class-based definitions in `style.css` will enable us to write clean media queries for portrait viewports. This ensures that:
1. Paddings decrease from `2rem` to `1rem` on mobile.
2. The supply layout stacks vertically on screens <= 768px.
3. K-Means columns adjust fluidly down to 100% width on 320px screens instead of overflowing via `min-width: 260px`.
4. Heatmap cells scale appropriately and the warning badges resize to a clean top-right dot (`6px` diameter) rather than obscuring numbers.
5. Metrics boxes stack or adjust to prevent overlaps.

### Risks
- **Testing viewports**: Some devices/browsers handle viewport safe areas (e.g. notches) differently, which might cause small paddings at the bottom.
- **Mock data length**: If backend returns very long names or large integers, layout elements might wrap. We must use `text-overflow: ellipsis` and `word-break` safety rules.

### Ready for Proposal
Yes
