# SmartStock - AI Agent Ruleset

## Cómo usar esta guía
- Comienza aquí para las normas generales del proyecto monolítico.
- SmartStock está dividido en componentes (`backend/`, `firmware/`, `frontend/`). Cada componente tiene su propio `agents.md` con reglas específicas (max 500 líneas).
- Los documentos `PRD.md` (Producto) y `ARCH.md` (Arquitectura) son la fuente de la verdad absoluta. Nunca los contradigas.

## Project Overview

SmartStock es un sistema IoT para control de inventario textil usando un lector RFID UHF (FM-505), un ESP32, un backend FastAPI y un dashboard web[cite: 7, 8].

| Componente | Directorio | Tech Stack |
|-----------|----------|------------|
| Backend | `backend/` | Python 3.10+, FastAPI, SQLAlchemy, aiomqtt[cite: 7] |
| Firmware | `firmware/` | C++, Arduino Framework, ESP32[cite: 7] |
| Frontend | `frontend/` | HTML, CSS, Vanilla JS (Sin frameworks)[cite: 7] |

## Available Skills (Lazy Loading)

Utiliza estas habilidades (skills) **solamente** cuando estés trabajando en su dominio específico. No cargues todas al mismo tiempo para no saturar el contexto[cite: 7].

### Habilidades de Dominio
| Skill | Descripción | Archivo |
|-------|-------------|---------|
| `cycle` | Ciclo diario, contadores, cierre manual y automático (APScheduler) | [SKILL.md](skills/cycle/SKILL.md) |
| `tags` | Modo REGISTRO, reasignación, resolución de conflictos de EPC | [SKILL.md](skills/tags/SKILL.md) |
| `portal` | Firmware ESP32, MQTT, patrones de buzzer, control de modos | [SKILL.md](skills/portal/SKILL.md) |
| `alerts` | Generación de alertas (TAG_DESCONOCIDA, MODO_REGISTRO_ACTIVO, MOVIMIENTO_DUPLICADO) | [SKILL.md](skills/alerts/SKILL.md) |

### Habilidades de Utilidad (A implementar)
| Skill | Descripción | Archivo |
|-------|-------------|---------|
| `tdd` | Test-Driven Development (pytest, mocks para backend) | [SKILL.md](skills/utils/tdd.md) |
| `fastapi` | Inyección de dependencias, Pydantic schemas, Async SQL | [SKILL.md](skills/utils/fastapi.md) |
| `cpp-esp32` | Manejo de memoria, non-blocking loops, interrupciones | [SKILL.md](skills/utils/cpp-esp32.md) |

## Auto-invoke Skills

Cuando se te pida realizar una de estas acciones, **SIEMPRE invoca y lee la habilidad correspondiente PRIMERO** antes de escribir código:

| Acción | Skill a invocar |
|--------|-------|
| Trabajar con contadores en el Dashboard o el cierre del día | `cycle` |
| Desarrollar lógica de `APScheduler` para cierre automático | `cycle` |
| Implementar endpoints de lectura, escaneo o reasignación de etiquetas | `tags` |
| Escribir o debugear código C++ para el ESP32 | `portal` |
| Integrar o definir payloads de HiveMQ (MQTT) en Python o C++ | `portal` |
| Configurar patrones de sonido (Buzzer) en hardware | `portal` |
| Implementar deduplicación de lectura RFID en el ESP32 | `portal` |
| Trabajar con alertas de inventario | `alerts` |

## Core Constraints (No-Negociables)
- **Frontend:** Cero frameworks JS. Usa Vanilla JS. Nunca uses polling HTTP, todo evento en tiempo real usa WebSockets[cite: 7].
- **Backend:** Las actualizaciones de BD por un batch MQTT deben estar en **una sola transacción atómica**. Si falla, se hace rollback completo[cite: 7].
- **Firmware:** El ESP32 empaqueta (batching) las lecturas en ventanas de 500ms; nunca emite un MQTT por cada etiqueta individual para evitar data storms[cite: 6].
- **Calidad de Código y Buenas Prácticas:** Queda terminantemente prohibido usar parches rápidos (hacks), atajos temporales o hardcodear lógica/valores. Si se detecta una limitación técnica o de diseño, se debe consultar primero al usuario antes de proceder. Siempre se debe optar por implementar la mejor práctica de arquitectura aplicable.