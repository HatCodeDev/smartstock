# Exploration: Reduced Capacity Simulation

## Current State
The historical simulator (`backend/scripts/simulate_history.py`) models a medium-sized market setup ("tianguis de blancos") with 26 unique SKUs and substantial inventory capacity:
- **Initial Stock**: 20 to 40 units per SKU (`UNIDADES_INICIALES_MIN` & `UNIDADES_INICIALES_MAX`), resulting in a total initial stock of ~780 physical units.
- **Replenishments**: 10 to 20 units added per week for low-stock SKUs (`REPOSICION_UNIDADES_MIN` & `REPOSICION_UNIDADES_MAX`).
- **Portal Throughput**: 20% to 55% of active stock moves daily, yielding ~195 to 390 units crossing the portal daily (e.g., ~366 outflows / 275 returns).
- **Daily Sales (Ventas)**: 10% to 25% of the outgoing units do not return (sold), resulting in high daily transaction volumes that deplete stock quickly without large replenishments.

---

## Affected Areas
- `backend/scripts/simulate_history.py`
  - Constants: `UNIDADES_INICIALES_MIN`, `UNIDADES_INICIALES_MAX`, `REPOSICION_UNIDADES_MIN`, `REPOSICION_UNIDADES_MAX`, and `STOCK_MINIMO_DEFAULT`.
  - Constants/Dictionaries: `PATRONES_VENTA` and `PATRONES_SALIDA`.
  - Conditional overrides: Mexican holiday overrides inside `_calcular_porcentaje_venta` (lines 278-293).

---

## Approaches

### Option 1: Uniform Low Stock with Scaled Sales (Simplest & Consistent)
Retain the uniform stock distribution model but scale down all limits, replenishments, and transaction ratios proportionally.

- **Proposed Values**:
  - `UNIDADES_INICIALES_MIN = 4`
  - `UNIDADES_INICIALES_MAX = 8` (Average stock: 6 units/SKU, Total initial stock: ~156 units)
  - `STOCK_MINIMO_DEFAULT = 2`
  - `REPOSICION_UNIDADES_MIN = 2`
  - `REPOSICION_UNIDADES_MAX = 4`
  - `PATRONES_SALIDA`: Keep as is (ranges from 20% to 55% of active stock). This results in **31 to 85 daily portal movements**, fitting the "30-80 units in transit daily" target.
  - `PATRONES_VENTA`: Halve all values to prevent high-rotation SKUs from completely running out of stock mid-week:
    ```python
    PATRONES_VENTA = {
        0: 0.07,  # Lunes - 7%
        1: 0.05,  # Martes - 5%
        2: 0.10,  # Miércoles - 10%
        3: 0.06,  # Jueves - 6%
        4: 0.10,  # Viernes - 10%
        5: 0.12,  # Sábado - 12%
        6: 0.12,  # Domingo - 12%
    }
    ```
  - Adjust holiday/special day overrides in `_calcular_porcentaje_venta` proportionally (e.g., Mother's Day peak sales ratio at 25% instead of 50%).
- **Pros**:
  - Code changes are restricted strictly to constants and a few local numbers.
  - Keeps the overall simulator simple, maintaining the same structure.
  - Daily throughput naturally scales down to 30-85 units.
- **Cons**:
  - Sales volume becomes very low (about 3-10 transactions daily), which might make statistical trend graphs look slightly sparse.
- **Effort**: Low

### Option 2: Tiered Rotation-Based Stock & Replenishments (High Realism)
Instead of uniform limits across all SKUs, differentiate stock capacity and replenishment quantities based on SKU rotation speed (`SKUS_ALTA_ROTACION`, `SKUS_ROTACION_MEDIA`, etc.).

- **Proposed Setup**:
  - **High Rotation (6 SKUs)**: Initial stock 10-15 units (average 12.5), replenishment 6-10 units, minimum stock 4.
  - **Medium Rotation (12 SKUs)**: Initial stock 5-8 units (average 6.5), replenishment 3-5 units, minimum stock 2.
  - **Low Rotation (8 SKUs)**: Initial stock 3-5 units (average 4), replenishment 1-3 units, minimum stock 1.
  - Total initial stock: ~185 units.
  - Keep existing `PATRONES_SALIDA` and `PATRONES_VENTA` close to current values.
- **Pros**:
  - Highly realistic; high-demand products have more depth, preventing out-of-stock bottlenecks without artificially deflating sales ratios.
  - Maintains slightly higher, more interesting transaction counts for analytics.
- **Cons**:
  - Requires writing custom logic in `crear_inventario_inicial` and `reponer_stock` to map SKUs to their rotation categories.
  - Higher code complexity.
- **Effort**: Medium

---

## Recommendation
We recommend **Option 1 (Uniform Low Stock with Scaled Sales)**. It achieves the exact target throughput requested (30-80 units in transit daily) and scales down stock sizes/replenishments with minimal code complexity. It respects the original codebase design where limits are global constants.

---

## Risks
- **Zero Stock Bottlenecks**: Even with halved sales ratios, high-rotation items might occasionally hit 0 stock on high-traffic days (Friday-Sunday) before the Monday replenishment. This is realistic for a small business but means weekend sales for those specific items will plateau.
- **Anomalies Impact**: Because stock levels are smaller, anomalies (like unrecognized tags or duplicate movements) will represent a larger percentage of daily events, making them stand out more in reports.

---

## Ready for Proposal
Yes. The orchestrator is ready to propose Option 1 to the user.
