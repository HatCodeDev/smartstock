# SmartStock — Backend Agent Rules

> **Source of truth**: `ARCH.md` (architecture) + `PRD.md` (business rules).  
> Read the relevant skill **before** writing any domain code.  
> Max scope: `backend/` directory only.

---

## 1. Tech Stack

| Layer | Technology | Note |
|-------|-----------|------|
| Runtime | Python 3.10+, FastAPI (async) | `async/await` everywhere |
| ORM | SQLAlchemy async | `AsyncSession` + `asyncpg` / `aiosqlite` |
| Auth | JWT — `python-jose` | Stateless; all endpoints except `/api/auth/login` |
| MQTT | `aiomqtt` | Subscribe at startup; runs in background task |
| Scheduler | APScheduler | Auto-close cycle at `configuracion.hora_cierre_auto` |
| DB dev | SQLite (`aiosqlite`) | `DATABASE_URL=sqlite+aiosqlite:///./smartstock.db` |
| DB prod | PostgreSQL (Railway) | Only `DATABASE_URL` changes — zero code changes |
| WebSocket | FastAPI native | `/ws/dashboard` — one connection per dashboard client |

---

## 2. Directory Structure — `app/`

```
app/
├── main.py              # FastAPI app, lifespan, StaticFiles, WS router
├── config.py            # Settings via pydantic-settings (env vars)
├── database.py          # AsyncEngine, AsyncSession factory
├── mqtt/
│   ├── client.py        # aiomqtt subscriber loop (background task)
│   └── publisher.py     # publish commands to ESP32
├── websocket/
│   └── manager.py       # ConnectionManager — broadcast to all clients
├── scheduler/
│   └── tasks.py         # APScheduler jobs (auto-close cycle)
├── models/              # SQLAlchemy ORM models (one file per table)
│   ├── producto.py
│   ├── etiqueta.py
│   ├── ciclo.py
│   ├── evento.py
│   ├── batch_procesado.py
│   ├── alerta.py
│   └── configuracion.py
├── schemas/             # Pydantic request/response schemas
├── services/            # Business logic (one file per domain)
│   ├── batch_service.py
│   ├── cycle_service.py
│   ├── tag_service.py
│   └── alert_service.py
└── routers/             # FastAPI routers (one file per resource)
    ├── auth.py
    ├── dashboard.py
    ├── cycle.py
    ├── portal.py
    ├── products.py
    ├── tags.py
    ├── alerts.py
    └── config.py
```

---

## 3. Environment Variables

```
DATABASE_URL        # sqlite+aiosqlite:///./smartstock.db | postgresql+asyncpg://...
JWT_SECRET          # random secret, min 32 chars
MQTT_BROKER_URL     # HiveMQ Cloud host
MQTT_USERNAME
MQTT_PASSWORD
MQTT_DEVICE_ID      # device_id of the ESP32 (never hardcoded)
```

**NEVER** hardcode these values. Read them from `app/config.py` (pydantic-settings).

---

## 4. Critical Rules

### ALWAYS

- `ALWAYS` use `async/await` for every DB query, MQTT call, and I/O operation.
- `ALWAYS` process an MQTT batch inside a **single atomic `AsyncSession` transaction**. One commit or full rollback — nothing in between.
- `ALWAYS` check `batches_procesados.batch_id` **before** processing. If found, return early without touching the DB (idempotency).
- `ALWAYS` emit WebSocket events **once**, after the transaction commits successfully. Never emit inside a per-EPC loop.
- `ALWAYS` send MQTT buzzer commands **after** the transaction is confirmed — not before.
- `ALWAYS` re-read `configuracion.hora_cierre_auto` at each scheduler job execution. Never cache it at startup.
- `ALWAYS` enforce cycle state before registering any movement: if `ciclo.estado == CERRADO`, reject the batch (RN-07).
- `ALWAYS` auto-open a new cycle when the first movement of the next day arrives and the current cycle is closed (RN-06).
- `ALWAYS` use PEP 8 + type hints on every function signature.
- `ALWAYS` use UUIDs (not integers) as primary keys for all tables.

### NEVER

- `NEVER` emit a WebSocket message or MQTT publish inside a per-EPC for-loop within a batch.
- `NEVER` put business logic in routers. Routers call services; services contain all logic.
- `NEVER` hardcode `device_id`, secrets, or broker URLs in source code.
- `NEVER` use blocking calls (`time.sleep`, `requests`, synchronous SQLAlchemy) in the async event loop.
- `NEVER` cache `configuracion` in memory. Always query the DB.
- `NEVER` alter the DB schema based solely on deployment environment. Only `DATABASE_URL` changes.
- `NEVER` process a batch partially. All-or-nothing (RN-01 through RN-15 depend on atomic state).
- `NEVER` register an inventory movement when `ciclo.modo_portal == REGISTRO` (RN-11).
- `NEVER` auto-reassign a tag that already belongs to another product. Raise a conflict — require admin confirmation (RN-12).

---

## 5. MQTT Batch Decision Tree

```
RECEIVE batch payload
│
├─ batch_id in batches_procesados?
│   └─ YES → Return 200 (idempotent, no-op). STOP.
│
├─ BEGIN TRANSACTION
│
├─ ciclo activo exists?
│   └─ NO → Auto-create ciclo (estado=ABIERTO, fecha=today, contadores=0)
│
├─ ciclo.estado == CERRADO?
│   └─ YES → ROLLBACK
│            Send MQTT buzzer: ERROR pattern
│            Return 409. STOP.
│
├─ mode == REGISTRO?
│   └─ YES → Log read, no inventory change (RN-11)
│            Insert batch_id in batches_procesados
│            COMMIT
│            Emit WS: REGISTRO_UPDATE. STOP.
│
├─ FOR EACH epc IN batch.events:
│   │
│   ├─ etiqueta exists AND activa == True?
│   │   └─ NO → Create alerta(TAG_DESCONOCIDA) — continue loop (RN-08)
│   │
│   ├─ mode == SALIDA:
│   │   ├─ etiqueta.estado == EN_BODEGA?
│   │   │   └─ YES → Insert evento(SALIDA), set estado=EN_TRANSITO
│   │   │            counter salidos += 1
│   │   └─ already EN_TRANSITO → skip (dedup)
│   │
│   └─ mode == RETORNO:
│       ├─ etiqueta.estado == EN_TRANSITO?
│       │   └─ YES → Insert evento(RETORNO), set estado=EN_BODEGA
│       │            counter retornados += 1
│       └─ already EN_BODEGA → skip (dedup)
│
├─ Insert batch_id in batches_procesados
│
├─ COMMIT
│
├─ Emit WS: COUNTER_UPDATE  ← ONE message, after commit
├─ Emit WS: NEW_ALERT (if any alerts were generated)
└─ Send MQTT buzzer command to ESP32 ← after commit
```

---

## 6. Naming Conventions — Pydantic Schemas

All schemas live in `app/schemas/`. Follow this pattern:

| Suffix | Purpose | Example |
|--------|---------|---------|
| `Base` | Shared fields (no ID, no timestamps) | `ProductoBase` |
| `Create` | Inherits Base; used for POST body | `ProductoCreate` |
| `Update` | All fields optional; used for PUT/PATCH | `ProductoUpdate` |
| `Response` | Full model returned to client | `ProductoResponse` |
| `Summary` | Subset for list views | `ProductoSummary` |
| `BatchPayload` | MQTT inbound payload | `BatchPayload` |
| `EventItem` | Nested inside BatchPayload | `EventItem` |

**Rules:**
- Use `model_config = ConfigDict(from_attributes=True)` on all `Response` schemas.
- Use `datetime` (not `str`) for all timestamp fields. FastAPI serializes to ISO 8601 automatically.
- Enum fields use Python `enum.Enum` mirroring the DB column enums.
- No schema inherits from an ORM model directly.

```python
# Example — correct pattern
class ProductoBase(BaseModel):
    nombre: str
    categoria: str | None = None
    cantidad_inicial: int

class ProductoCreate(ProductoBase):
    pass

class ProductoResponse(ProductoBase):
    id: UUID
    creado_en: datetime
    model_config = ConfigDict(from_attributes=True)
```

---

## 7. Business Rules — Quick Reference (PRD § 5)

| Rule | Trigger | Backend Action |
|------|---------|---------------|
| RN-01 | SALIDA scan | estado → EN_TRANSITO; salidos += 1 |
| RN-02 | RETORNO scan | estado → EN_BODEGA; retornados += 1 |
| RN-03 | Cycle close | EN_TRANSITO → VENDIDO; descuenta inventario |
| RN-04 | (Removido) | El tiempo excedido fue removido por requerimiento de negocio |
| RN-05 | hora == hora_cierre_auto | APScheduler closes cycle |
| RN-06 | First movement next day | Auto-open new cycle, counters = 0 |
| RN-07 | Movement on CLOSED cycle | Reject; buzzer ERROR |
| RN-08 | Unknown EPC | Create alerta(TAG_DESCONOCIDA); continue |
| RN-11 | mode == REGISTRO | No inventory change |
| RN-12 | Tag owned by other product | Raise conflict; await admin |
| RN-13 | EN_TRANSITO tag reassigned | Original closes as VENDIDO at cycle end |
| RN-14 | Product with no tags | Cannot generate movements |

---

## 8. Skill Loading — Lazy (Load Only When Needed)

| When you are working on… | Load this skill FIRST |
|--------------------------|----------------------|
| MQTT processing, ESP32 modes, buzzer | `skills/portal/SKILL.md` |
| Tag registration, reassignment, conflicts | `skills/tags/SKILL.md` |
| Cycle open/close, counters, APScheduler | `skills/cycle/SKILL.md` |
| Alert generation, types, resolution | `skills/alerts/SKILL.md` |

**Do NOT load all skills at once.** Load only the one matching the current task.

---

## 9. Commit Convention

```
feat: add MQTT batch idempotency check
fix: rollback on partial batch failure
chore: clean up TIEMPO_EXCEDIDO alert logic
```

Format: `type(scope?): description` — lowercase, imperative, English, no period.
