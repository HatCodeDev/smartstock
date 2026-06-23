---
skill: alerts
domain: alert generation, types, resolution, dashboard display
load_when: working on alert creation, PUT /api/alerts, alert evaluation after batches
---

# Skill: Alertas

## Modelo relevante

```
alertas: id | ciclo_id | tipo | descripcion | revisada | creada_en
```

## Tipos de alerta

| Tipo | Cuándo se genera |
|------|-----------------|
| `TAG_DESCONOCIDA` | El portal lee un EPC que no existe en la tabla `etiquetas` |
| `MODO_REGISTRO_ACTIVO` | El portal cambia a modo REGISTRO (alerta informativa, no de error) |
| `MOVIMIENTO_DUPLICADO` | Se detecta un movimiento duplicado en el mismo lote |

## TAG_DESCONOCIDA

Se genera dentro de la transacción del batch, una por EPC desconocido.

```
descripcion = "Etiqueta no reconocida: {epc} detectada en portal a las {timestamp}"
```

Si el mismo EPC desconocido aparece múltiples veces en el día, solo se crea una alerta (verificar si ya existe `TAG_DESCONOCIDA` con ese EPC en el ciclo activo antes de insertar).

## TIEMPO_EXCEDIDO (Removido)

Esta alerta fue eliminada para evitar alertas falsas durante las ventas normales.

## MODO_REGISTRO_ACTIVO

Se crea cuando el backend recibe el comando `SET_MODE: REGISTRO` y lo confirma.

```
descripcion = "El portal está en modo Registro. Los movimientos de inventario están pausados."
revisada = false
```

Se marca automáticamente como revisada cuando el portal sale del modo REGISTRO.

## GET /api/alerts

Retorna alertas del ciclo activo donde `revisada = false`, ordenadas por `creada_en` DESC.

## PUT /api/alerts/{id}/review

```
alerta.revisada = true
```

La alerta desaparece del dashboard pero permanece en BD para el historial del día (visible en `GET /api/cycle/summary`).

## WebSocket NEW_ALERT

Se emite cada vez que se inserta una nueva alerta en BD (incluidas TAG_DESCONOCIDA dentro de un batch). Payload:

```json
{ "type": "NEW_ALERT", "data": { "id", "tipo", "descripcion", "creada_en" } }
```

## Regla de deduplicación

Antes de insertar cualquier alerta, verificar si ya existe una alerta del mismo tipo, para el mismo `ciclo_id` y el mismo `epc` o `producto_id` (según el tipo). Si existe y no está revisada, no insertar duplicado.
