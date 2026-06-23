# Reporte de Progreso: Firmware M4 (Fases 0 a 3)

Este documento resume los hallazgos, la arquitectura implementada y las instrucciones operativas de las primeras tres fases del desarrollo del firmware en M4.

## 1. Estado de Implementación

Hemos completado exitosamente las siguientes fases del plan original (`m4_planning.md`):

- **Fase 0 (Entorno):** Configuración de `PlatformIO` y toolchain del ESP32.
- **Fase 1 (RFID UART):** Implementación del polling al FM-505 a 38400 bps.
- **Fase 2 (Conectividad):** Conexión WiFi, sincronización de hora mundial (NTP) y conexión segura (TLS) a HiveMQ Cloud.
- **Fase 3 (Batching):** Lógica de agrupación de lecturas en ventanas de 500ms, deduplicación de 2s y envío en formato JSON estandarizado con UUIDs v4 únicos.

## 2. Hallazgos Técnicos (Descubrimientos)

1. **Memoria y TLS:** Se incluyeron las librerías `WiFiClientSecure` y `PubSubClient` para HiveMQ (puerto 8883). La compilación de los certificados SSL usa bastante flash, pero el ESP32 (DevKit v1) tiene 4MB, así que actualmente estamos en **~68% de la memoria Flash** y solo **~14% de la RAM**. Tenemos margen de sobra.
2. **Generación de UUIDv4:** Para crear el `batch_id` único exigido por el backend, el Arduino framework tiene una pequeña discrepancia: la clase `ESP.random()` no compila, la función correcta del core de Espressif es `esp_random()`.
3. **Comunicación Hardware:** Se corroboró definitivamente que los pines TX/RX del lector FM-505 operan a 3.3V y se pueden conectar directo a los GPIO 16 (RX2) y 17 (TX2) del ESP32 sin necesidad de un adaptador de nivel (*level shifter*).

## 3. Instrucciones de Operación (PlatformIO)

El proyecto abandonó el IDE de Arduino tradicional en favor de **PlatformIO**.

### ¿Cómo compilar y subir código?
Desde una terminal situada en la carpeta `firmware/` del proyecto:

1. **Solo compilar (verificar sintaxis):**
   ```bash
   python -m platformio run
   ```
2. **Compilar y flashear (subir al ESP32):**
   ```bash
   python -m platformio run --target upload
   ```
   *(El ESP32 debe estar conectado por USB)*
3. **Abrir el monitor serial (ver logs de la placa):**
   ```bash
   python -m platformio device monitor --baud 115200
   ```
   *(Para salir del monitor serial, presionar `Ctrl + C`)*

### Credenciales y Secretos
Los secretos de WiFi y MQTT **NO** se suben a Git. Viven en `src/config.h` (ignorado en `.gitignore`). Existe un `src/config.h.example` que sirve como plantilla si clonas el repositorio en otra PC.

## 4. El Payload MQTT (Contrato Backend)

La clase `BatchBuilder` genera exactamente la estructura JSON esperada por el backend en el topic `smartstock/smartstock-portal-01/events`. 

**Ejemplo capturado real:**
```json
{
  "batch_id": "0ad32cf9-b21f-42e1-85e8-55444b70c3ba",
  "device_id": "smartstock-portal-01",
  "modo": "SALIDA",
  "timestamp": 1746473130,
  "tags": [
    {
      "epc": "3000E28069150000401CFAE6",
      "rssi": null,
      "timestamp_esp32": 15430
    }
  ]
}
```

## 5. Próximos Pasos (Pendientes)

La prueba End-to-End (E2E) física demostró que el flujo Lector -> ESP32 -> HiveMQ está funcionando perfectamente.
Lo siguiente por abordar es:
- **Fase 4:** Implementar el buzzer no bloqueante (pitidos de confirmación según eventos MQTT o acciones físicas).
- **Fase 5:** Implementar el botón físico para cambiar de modo SALIDA a RETORNO sin necesidad del panel web, manejando el debounce e interactuando con el buzzer.
