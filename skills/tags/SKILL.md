---
skill: tags
domain: tag registration, reassignment, conflict resolution, REGISTRO mode
load_when: working on tag association, scan-batch endpoint, conflict resolution, tag reuse
---

# Skill: Etiquetas (Registro y Reasignación)

## Modelo relevante

```
etiquetas: epc (PK) | producto_id (FK nullable) | activa (bool) | asignada_en
productos: id | nombre | cantidad_inicial | ...
```

## Endpoint: POST /api/tags/scan-batch

Inicia una sesión de registro. El administrador selecciona el producto destino antes de pasar etiquetas.

```json
Request:  { "product_id": "uuid" }
Response: { "session_id": "uuid", "product_name": "string" }
```

La sesión se mantiene en memoria del servidor (no en BD) mientras el modo REGISTRO está activo. Se invalida cuando el administrador finaliza o cambia el modo del portal.

## Procesamiento de batch en modo REGISTRO

Cuando el backend recibe un batch MQTT con `mode: "REGISTRO"`:

```
Para cada EPC en el batch:
  CASO A — epc no existe en tabla etiquetas:
    → Insertar etiqueta con producto_id = session.product_id
    → status: "new"
    → buzzer: REGISTRO_NUEVA

  CASO B — epc existe, producto_id = session.product_id:
    → Ignorar silenciosamente
    → status: "duplicate"
    → buzzer: ninguno

  CASO C — epc existe, producto_id ≠ session.product_id:
    → NO modificar la BD todavía
    → Acumular en lista de conflictos de la sesión
    → status: "conflict"
    → buzzer: ERROR
```

Emitir WebSocket `REGISTRO_UPDATE` al finalizar el procesamiento del batch (una sola vez).

## Endpoint: POST /api/tags/resolve-conflicts

El administrador confirma qué hacer con los conflictos detectados.

```json
Request: {
  "session_id": "uuid",
  "action": "reassign_all" | "cancel",
  "decisions": [
    {
      "epc": "string",
      "deduct_from_original": true | false
    }
  ]
}
```

Procesamiento (transacción atómica):
```
Para cada epc con action = "reassign_all":
  1. Actualizar etiqueta.producto_id = session.product_id
  2. Si deduct_from_original = true Y etiqueta estaba En bodega del producto original:
     → Decrementar producto_original.cantidad en BD
     → Crear evento de ajuste en historial
  3. Si etiqueta estaba En tránsito:
     → No modificar el ciclo activo (RN-13)
     → Registrar nota en historial de la etiqueta
```

Todo ocurre en una sola transacción. Si algo falla, se revierte todo.

## Endpoint: DELETE /api/tags/{epc}

Desvincula una etiqueta de su producto (producto_id = null, activa = false). No elimina el historial de eventos asociado a ese EPC.

## Validaciones

- No se puede iniciar una sesión de registro si el portal no está en modo REGISTRO.
- No se puede procesar un batch de REGISTRO si no hay sesión activa con `product_id`.
- Un EPC no puede estar vinculado a dos productos al mismo tiempo.
- La resolución de conflictos debe completarse antes de finalizar la sesión. Si el admin cambia el modo sin resolver, los conflictos pendientes se descartan (no se reasignan).

## Estado de una etiqueta

El estado de una etiqueta se deriva del último evento del ciclo activo, no es un campo almacenado:

| Condición | Estado derivado |
|-----------|----------------|
| Sin eventos hoy | En bodega |
| Último evento = SALIDA | En tránsito |
| Último evento = RETORNO | En bodega |
| Ciclo cerrado + último evento = SALIDA | Vendido |
