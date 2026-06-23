---
skill: portal
domain: ESP32 firmware, MQTT, buzzer, portal modes
load_when: working on ESP32 firmware, MQTT integration, buzzer patterns, mode switching
---

# Skill: Portal (ESP32 + MQTT)

## Pinout

| Pin | Uso |
|-----|-----|
| GPIO 16 (RX2) | UART RX ← FM-505 TX |
| GPIO 17 (TX2) | UART TX → FM-505 RX |
| GPIO 25 | Buzzer pasivo (LEDC canal 0, 2kHz) |
| GPIO 26 | Botón físico SALIDA↔RETORNO (INPUT_PULLUP) |
| GPIO 2 | LED integrado estado WiFi/MQTT |

## Flujo de lectura y deduplicación

```
1. FM-505 en modo request-response (polling) → protocolo ASCII por UART a 38400 bps, 8N1
   - ESP32 envía comando: Q\r\n (bytes: 51 0D 0A)
   - FM-505 responde con tag: \nQ[EPC 24 chars][8 chars varianza]\r\n
   - FM-505 responde sin tag: \nQ\r\n (solo Q, sin EPC)
2. ESP32 parsea trama ASCII → verifica que empiece con Q → extrae EPC con substring(1, 25)
3. Deduplicación: si el mismo EPC se vio en los últimos 2 s → descartar
4. Ventana de barrido: acumular EPCs enviando Q rápidos por 500 ms desde la primera lectura nueva
5. Al cerrar ventana → publicar 1 mensaje MQTT con el batch completo
```

> ⚠️ **BAUD RATE CRÍTICO: 38400 bps** — Validado empíricamente en M3 con `fm505_test.py`.
> El lector devuelve **1 EPC por comando Q** (anti-colisión simple). Para capturar múltiples
> tags simultáneos, el ESP32 debe enviar múltiples Q rápidos durante la ventana de 500 ms.

**Resultado:** N etiquetas simultáneas = N comandos Q en 500 ms = 1 mensaje MQTT con el batch. Sin data storm.

## Modos del portal

```cpp
enum PortalMode { SALIDA, RETORNO, REGISTRO };
```

- El modo activo se persiste en `Preferences` (flash). Sobrevive reinicios.
- El botón físico (MVP) alterna únicamente SALIDA ↔ RETORNO.
- El backend puede establecer cualquiera de los 3 modos vía MQTT comando `SET_MODE`.
- Al cambiar de modo → reproducir patrón de buzzer de confirmación → publicar ACK.

## Diseño sonoro Zero Friction

El sistema usa **dos fases de sonido** separadas para evitar saturación:

### Fase 1 — Micro-Tick de Captura (por EPC nuevo)
- Patrón `BUZZ_TICK`: 20ms ON, 30ms OFF (`{20, -30, 0}`)
- Se dispara en `onTagRead()` **solo si el EPC es nuevo** en la ventana actual (no en duplicados)
- Da feedback "Geiger": 1 tag → 1 tick, 5 tags → 5 ticks rápidos
- El usuario puede contar a oído sin mirar la pantalla

### Fase 2 — Confirmación de Lote (al cerrar ventana + ACK del backend)
- El firmware NO reproduce el sonido de éxito al publicar el MQTT
- Espera la respuesta `BUZZER_BATCH` del backend (ver payload abajo)
- Si no llega ACK en 3s → reproduce `BUZZ_UNKNOWN_TAG` como fallback

### Modo REGISTRO (sin cambios)
- Un `BUZZ_REG_NEW` (200ms) por etiqueta nueva — este modo ya tiene su propio flujo, no usa micro-ticks

## Patrones de buzzer

| Evento | Patrón | Enum |
|--------|--------|------|
| Micro-tick de captura (EPC nuevo en SALIDA/RETORNO) | 1 tick 20 ms | `BUZZ_TICK` |
| Lote SALIDA procesado OK por backend | 2 pitidos cortos 150 ms c/u | `BUZZ_OK_SALIDA` |
| Lote RETORNO procesado OK por backend | 3 pitidos cortos 100 ms c/u | `BUZZ_OK_RETORNO` |
| Error en lote (tag desconocida) | 1 pitido largo 800 ms | `BUZZ_UNKNOWN_TAG` |
| Sin conexión al broker (1 vez) | 3 pitidos 100 ms c/u | `BUZZ_NO_NETWORK` |
| Cambio a modo SALIDA | 2 pitidos 400 ms | `BUZZ_MODE_SALIDA` |
| Cambio a modo RETORNO | 3 pitidos 400 ms | `BUZZ_MODE_RETORNO` |
| Cambio a modo REGISTRO | 3 pitidos 400 ms + pausa 300 ms + 1 pitido 200 ms | `BUZZ_MODE_REGISTRO` |
| Salida de modo REGISTRO | 2 pitidos 400 ms | `BUZZ_EXIT_REGISTRO` |
| Nueva etiqueta en REGISTRO | 1 pitido corto 200 ms | `BUZZ_REG_NEW` |
| Etiqueta conflicto en REGISTRO | 1 pitido largo 800 ms | `BUZZ_REG_CONFLICT` |
| Ciclo cerrado (movimiento rechazado) | 1 pitido largo 800 ms | `BUZZ_CYCLE_CLOSED` |
| Modo apagado / inicio | 1 pitido 100 ms | `BUZZ_MODE_APAGADO` |

> ⚠️ **REGLA CRÍTICA**: `BUZZ_TICK` solo se reproduce en modos `SALIDA` y `RETORNO`. En modo `REGISTRO` se usa `BUZZ_REG_NEW`. En modo `APAGADO` no se reproduce nada.

> ⚠️ **REGLA ANTI-SATURACIÓN**: El `BuzzerManager` tiene una cola de capacidad 1. Si ya está reproduciendo, un nuevo `play()` de `BUZZ_TICK` se descarta (no se encola). El sonido de confirmación de lote (`BUZZ_OK_*`) siempre interrumpe y tiene prioridad.

## Payload MQTT — eventos

Topic: `smartstock/{device_id}/events` | QoS 1

```json
{
  "batch_id": "uuid-v4",
  "mode": "SALIDA",
  "device_id": "MAC_ADDRESS",
  "events": [
    { "epc": "E28011606000020012345678", "timestamp": "2025-01-15T08:30:00Z" }
  ]
}
```

## Payload MQTT — comandos recibidos

Topic: `smartstock/{device_id}/commands` | QoS 1

```json
{ "command": "SET_MODE", "mode": "REGISTRO" }
```

Respuesta en `smartstock/{device_id}/ack`:
```json
{ "command": "SET_MODE", "mode": "REGISTRO", "status": "ok" }
```

El backend también puede incluir patrones de buzzer en la respuesta a un batch:
```json
{
  "command": "BUZZER_BATCH",
  "results": [
    { "epc": "...", "status": "ok", "buzzer": "SALIDA_OK" },
    { "epc": "...", "status": "unknown_tag", "buzzer": "ERROR" }
  ]
}
```

## LED de estado

| Estado | Patrón LED |
|--------|-----------|
| Conectado y operativo | Fijo encendido |
| Sin conexión, sesión persistente activa | Parpadeo lento 1 s |
| Intentando reconectar | Parpadeo rápido 200 ms |

## Buffer offline

El broker HiveMQ Cloud con QoS 1 y `cleanSession: false` retiene mensajes mientras el ESP32 está offline. Al reconectar, el broker entrega los mensajes pendientes automáticamente. No se implementa buffer manual en RAM para eventos normales.

Excepción: si el broker mismo no es alcanzable (sin WiFi), el ESP32 acumula batches en memoria RAM (máx. 10 batches) y los reenvía en orden FIFO al reconectar.
