---
spec_type: agent_context
component: firmware
language: cpp
framework: arduino
board: esp32dev
tool: platformio
---

# firmware/AGENT.md

## Responsabilidad de este componente
Todo lo que corre en el ESP32 físico dentro de la bodega.
Leer etiquetas RFID, filtrarlas, agruparlas en un batch y enviarlo al backend.
Dar feedback de audio al operario mediante el buzzer.

## Restricción fundamental
**Este componente no contiene lógica de negocio.**
No sabe qué es una "venta", un "ciclo" o una "alerta". Solo conoce:
EPCs, modos (SALIDA/RETORNO), patrones de buzzer y una URL de endpoint.

## Mapa de módulos

| Carpeta | Responsabilidad |
|---------|----------------|
| src/rfid/ | Parsear tramas UART del FM-505, extraer EPCs de 96 bits |
| src/buzzer/ | Generar patrones PWM. Nunca bloquear el loop principal (non-blocking) |
| src/network/ | Construir batch JSON, HTTP POST, cola de retry FIFO en RAM |
| src/storage/ | Persistir modo actual y config en flash usando Preferences.h |

## Parámetros de hardware
| Pin / Recurso | Uso |
|--------------|-----|
| GPIO 16 (RX2) | Recibir datos UART del FM-505 |
| GPIO 17 (TX2) | Transmitir comandos al FM-505 (si aplica) |
| GPIO 2 | LED integrado — indicador de estado WiFi |
| GPIO definido en config | Buzzer pasivo 5V — control por PWM (LEDC) |
| GPIO definido en config | Botón físico — cambio de modo con debounce |
| UART baud rate | 115200 bps (verificar con datasheet FM-505) |

## Comportamiento del batch
- Ventana de acumulación: **500 ms** desde la primera lectura del barrido.
- Deduplicación: mismo EPC dentro de ventana de **2 s** → descartar.
- Un `batch_id` UUID se genera en el ESP32 por cada batch antes de enviarlo.
- Si el POST falla: encolar batch completo en RAM (máx. 10 batches), retry cada 30 s.
- El `batch_id` garantiza idempotencia — el backend ignorará duplicados.

## Patrones de buzzer (non-blocking obligatorio)
| Constante | Descripción | Patrón |
|-----------|-------------|--------|
| BUZZ_OK_SALIDA | Artículo registrado como salida | 1 pitido 200 ms |
| BUZZ_OK_RETORNO | Artículo registrado como retorno | 2 pitidos 200 ms |
| BUZZ_UNKNOWN_TAG | EPC no reconocido por el backend | 1 pitido 800 ms |
| BUZZ_NO_NETWORK | Sin conexión al backend | 3 pitidos rápidos |
| BUZZ_MODE_SALIDA | Modo cambiado a SALIDA | 2 pitidos medianos |
| BUZZ_MODE_RETORNO | Modo cambiado a RETORNO | 3 pitidos medianos |

## Reglas de este componente
- Usar `Serial2` para el FM-505. `Serial` (USB) queda libre para debug.
- Buzzer con `ledcWrite` (LEDC API de ESP32). No usar `tone()` — es bloqueante.
- El botón físico debe tener debounce de mínimo 50 ms.
- No usar `delay()` en el loop principal. Toda espera con `millis()`.
- El modo (SALIDA/RETORNO) se guarda en Preferences.h para sobrevivir reinicios.
- La URL del backend se define en un archivo `config.h` — nunca hardcodeada en lógica.

## Archivo de configuración esperado
`src/config.h` debe existir (no se versiona, se crea desde `config.h.example`):
```
BACKEND_URL    → "http://192.168.x.x:8000"
WIFI_SSID      → "nombre_red"
WIFI_PASSWORD  → "clave_red"
DEVICE_ID      → "MAC o ID único del ESP32"
BUZZER_PIN     → GPIO del buzzer
BUTTON_PIN     → GPIO del botón de modo
```
