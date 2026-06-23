---
skill: cycle
domain: daily cycle, counters, manual close, automatic close, scheduler
load_when: working on dashboard counters, cycle open/close, APScheduler, GET /api/dashboard
---

# Skill: Ciclo Diario

## Modelo relevante

```
ciclos: id | fecha | estado (ABIERTO/CERRADO) | modo_portal | cerrado_en | cierre_automatico
eventos: id | ciclo_id | epc | producto_id | tipo (SALIDA/RETORNO) | timestamp_esp32 | batch_id
```

## Ciclo activo

Solo puede haber un ciclo con `estado = ABIERTO` a la vez. Si no existe ciclo para la fecha actual, se crea automáticamente al recibir el primer batch MQTT con modo SALIDA o RETORNO.

El ciclo NO se crea al arrancar el servidor ni por el scheduler. Solo se crea por movimiento real.

## GET /api/dashboard

Calcula los contadores en tiempo de consulta a partir de los eventos del ciclo activo. No hay contadores precalculados en BD.

```
salidos_hoy    = COUNT(eventos WHERE ciclo_id=activo AND tipo=SALIDA)
retornados     = COUNT(eventos WHERE ciclo_id=activo AND tipo=RETORNO)
vendidos_est   = salidos_hoy - retornados  (artículos actualmente en tránsito)
en_bodega      = SUM(productos.cantidad_inicial) - vendidos_est
                 (ajustado por ventas de ciclos anteriores)
```

Incluir en la respuesta: `{ salidos, retornados, vendidos_estimado, en_bodega, estado_ciclo, modo_portal, fecha }`.

## Procesamiento de batch RFID (modo SALIDA o RETORNO)

```
1. Verificar batch_id en batches_procesados → si existe, retornar respuesta original
2. Verificar ciclo activo:
   - Si no existe ciclo hoy → crear ciclo nuevo (estado=ABIERTO)
   - Si ciclo existe y estado=CERRADO → rechazar batch, responder con error CICLO_CERRADO
3. Para cada EPC en el batch (dentro de una sola transacción):
   a. Buscar etiqueta → si no existe: generar alerta TAG_DESCONOCIDA, continuar
   b. Crear evento (tipo = modo del batch)
4. Insertar batch_id en batches_procesados
5. Commit transacción
6. Emitir UN evento WebSocket COUNTER_UPDATE con los nuevos contadores
7. Responder al ESP32 con patrones de buzzer por EPC
```

## POST /api/cycle/close (cierre manual)

```
1. Verificar ciclo activo existe y estado=ABIERTO
2. Transacción:
   a. ciclo.estado = CERRADO
   b. ciclo.cerrado_en = now()
   c. ciclo.cierre_automatico = false
3. Commit
4. Emitir WebSocket CYCLE_CLOSED con summary
5. Retornar summary (salidos, retornados, vendidos_final, alertas_del_dia)
```

`vendidos_final` = artículos que tenían estado En tránsito al momento del cierre.

## Cierre automático (APScheduler)

- El scheduler se configura en el arranque del servidor.
- **Lee `configuracion.hora_cierre_auto` en cada ejecución** (no cachear).
- Si existe ciclo ABIERTO para la fecha actual a la hora configurada:
  - Ejecuta el mismo proceso de cierre manual con `cierre_automatico = true`.
  - Emite WebSocket `CYCLE_CLOSED`.
- Si no existe ciclo abierto: no hace nada.

## GET /api/cycle/summary

Retorna el resumen del último ciclo cerrado:

```json
{
  "fecha": "date",
  "salidos": int,
  "retornados": int,
  "vendidos_final": int,
  "cierre_automatico": bool,
  "cerrado_en": "datetime",
  "alertas": [{ "tipo", "descripcion", "revisada" }]
}
```

## Reglas críticas

- RN-07: Si `ciclo.estado = CERRADO` y el día no ha cambiado → rechazar cualquier batch de SALIDA/RETORNO.
- RN-06: El ciclo del día siguiente se crea al primer movimiento, nunca antes.
- RN-11: Los batches con `mode = REGISTRO` no crean eventos de tipo SALIDA/RETORNO ni modifican el ciclo.
