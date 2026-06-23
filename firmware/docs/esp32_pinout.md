# ESP32 DevKitC — Pinout Final para M4

> **Hardware validado:** ESP32-WROOM-32 | DevKitC | USB-C | 38 pines
> **Fecha:** 2026-05-05 | **Fase:** Preparación M4

---

## 1. Resumen de Asignación de GPIOs

| GPIO | Nombre lógico | Dirección | Conectado a | Notas |
|------|--------------|:---------:|-------------|-------|
| **GPIO16** | `UART2_RX` | INPUT | FM-505 **TX** | UART2 del ESP32, 3.3V TTL directo |
| **GPIO17** | `UART2_TX` | OUTPUT | FM-505 **RX** | UART2 del ESP32, 3.3V TTL directo |
| **GPIO25** | `BUZZER_PIN` | OUTPUT | Buzzer pasivo | PWM via LEDC (canal 0), también DAC1 |
| **GPIO26** | `BTN_MODE_PIN` | INPUT | Botón físico | `INPUT_PULLUP`, activo en LOW |
| **GPIO2** | `LED_STATUS` | OUTPUT | LED integrado | Azul en la mayoría de DevKitC |

---

## 2. Pines de Alimentación

| Pin ESP32 | Conectado a | Voltaje | Notas |
|-----------|-------------|:-------:|-------|
| **VIN** | FM-505 **VCC** | 5 V | Sourcea desde USB a través del regulador; máx ~500 mA desde USB 2.0 |
| **3V3** | FM-505 **EN** | 3.3 V | Mantiene EN en HIGH permanente (modo activo) |
| **GND** | FM-505 **GND** + Buzzer **GND** | 0 V | Tierra común obligatoria |

> [!IMPORTANT]
> El FM-505 requiere 5V en VCC para el amplificador RF. Sin embargo, sus líneas UART (TX/RX) operan a 3.3V TTL.
> La conexión ESP32 ↔ FM-505 es directa: **NO se necesita level shifter ni divisor de voltaje.**

---

## 3. Diagrama de Conexión

```
                    ┌─────────────────────────────────────┐
                    │        ESP32 DevKitC (WROOM-32)     │
              USB-C │  [BOOT]              [EN/RST]       │
                    │                                     │
        3V3 ────────┤ 3V3                        GND ─────┼──── FM-505 GND
        GND ────────┤ GND                        VIN ─────┼──── FM-505 VCC (5V)
                    │                                     │
                    │ GPIO25 ──── Buzzer (+)              │
                    │ GPIO26 ──── Botón físico            │
                    │ GPIO2  ──── LED integrado           │
                    │                                     │
                    │ GPIO16 (RX2) ────────── FM-505 TX   │  ← datos del lector
                    │ GPIO17 (TX2) ────────── FM-505 RX   │  → comandos al lector
                    │                                     │
        3V3 ────────┤ 3V3  ───────────────── FM-505 EN   │  (enable = HIGH)
                    └─────────────────────────────────────┘

Buzzer pasivo:
    ESP32 GPIO25 ──── Buzzer (+)
    ESP32 GND    ──── Buzzer (-)

Botón modo:
    ESP32 GPIO26 ──── Botón ──── GND
    (INPUT_PULLUP: HIGH en reposo, LOW al presionar)
```

---

## 4. Justificación de Elección de GPIOs

### GPIO16 / GPIO17 — UART2 (FM-505)
- UART2 es la UART secundaria del ESP32, no interfiere con la UART0 (USB/debug).
- Pines libres de boot-strapping (sin restricciones al inicio).
- Ya validados en M3: FM-505 opera a **38400 bps, 8N1** (protocolo ASCII).

> [!WARNING]
> **El skill portal/SKILL.md indica 115200 bps** — este dato es INCORRECTO.
> Las pruebas físicas de M3 (fm505_test.py) confirman **38400 bps**.
> Usar 115200 resultará en basura en el buffer UART.

### GPIO25 — Buzzer
- **LEDC-capable** (PWM por hardware): genera tonos sin bloquear el loop.
- También es **DAC1** — opción de generar ondas analógicas si se requiere.
- Libre de boot-strapping (no afecta el arranque).
- Alternativa: GPIO26, GPIO27, GPIO32 — cualquiera sirve si GPIO25 se necesitara.

### GPIO26 — Botón físico
- Pin normal, sin restricciones.
- Configurado como `INPUT_PULLUP`: no requiere resistencia externa.
- Función: alternar SALIDA ↔ RETORNO (el backend puede hacer lo mismo vía MQTT `SET_MODE`).

### GPIO2 — LED de estado
- LED azul integrado en la mayoría de las placas ESP32 DevKitC.
- Patrones de estado (definidos en portal/SKILL.md):
  - Fijo: conectado y operativo
  - Parpadeo lento (1s): sin conexión, sesión persistente activa
  - Parpadeo rápido (200ms): intentando reconectar

---

## 5. Pines NO disponibles / Evitar

| GPIO | Por qué evitar |
|------|---------------|
| GPIO0 | Boot mode — debe estar HIGH al inicio |
| GPIO12 | Boot strapping — determina voltaje del flash; LOW requerido al inicio |
| GPIO15 | Boot strapping — logging JTAG en arranque |
| GPIO6–11 | Conectados a la flash SPI interna — **NO TOCAR** |
| GPIO34, 35, 36, 39 | **Solo entrada** — no pueden ser OUTPUT |

---

## 6. Tabla de Constantes para el Firmware

```cpp
// firmware/src/config.h — Constantes de hardware para M4

// UART FM-505
#define FM505_UART       Serial2
#define FM505_BAUD_RATE  38400          // Validado en M3 (NO es 115200)
#define FM505_RX_PIN     16
#define FM505_TX_PIN     17

// Buzzer
#define BUZZER_PIN       25
#define BUZZER_CHANNEL   0              // LEDC canal 0
#define BUZZER_FREQ_HZ   2000           // Frecuencia base de tonos (2 kHz)
#define BUZZER_RESOLUTION 8            // 8-bit PWM (0–255)

// Botón de modo
#define BTN_MODE_PIN     26
#define BTN_DEBOUNCE_MS  50

// LED de estado
#define LED_STATUS_PIN   2

// MQTT / WiFi (vienen de NVS o credenciales compiladas)
#define MQTT_PORT        8883           // TLS
#define MQTT_QOS         1
```

---

## 7. Checklist de Conexión (Pre-M4)

Antes de encender por primera vez en M4:

- [ ] Antena del FM-505 conectada ANTES de energizar
- [ ] GND común entre ESP32 y FM-505 verificado con continuidad
- [ ] VIN (5V) del ESP32 medido con multímetro → ~4.7–5V ✅
- [ ] TX/RX no invertidos (FM-505 TX → ESP32 RX, FM-505 RX → ESP32 TX)
- [ ] EN del FM-505 conectado a 3.3V (HIGH = activo)
- [ ] Buzzer con polaridad correcta (si es polarizado)
- [ ] Botón conectado entre GPIO26 y GND (sin resistencia — usa PULLUP interno)
