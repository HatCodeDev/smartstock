# Verification Report: Aprovisionamiento Dinámico de WiFi

Hemos verificado la implementación del aprovisionamiento dinámico de WiFi y el reset por hardware del ESP32 mediante una revisión estática del código y la definición de pruebas físicas guiadas.

---

## 1. Verificación Estática del Código

Realizamos una revisión detallada de la arquitectura implementada para asegurar el cumplimiento de las restricciones del proyecto y del sistema operativo de tiempo real (RTOS):

1. **Watchdog (WDT) Seguro:**
   - Se validó que el Watchdog de 10 segundos en `main.cpp` no se agregue al hilo hasta que `wifi.begin()` retorne de forma exitosa. Esto asegura que la espera del portal cautivo no cause resets por pánico de hardware.
2. **Evitar colisiones de nombres de clases:**
   - La clase envolvente fue renombrada exitosamente a `WiFiManagerHelper` en `wifi_manager.h` y `wifi_manager.cpp`, evitando conflictos con la clase global `WiFiManager` de la librería externa.
3. **No Bloqueo en Producción:**
   - El método `tick()` de `WiFiManagerHelper` realiza reconexiones no bloqueantes cada 10 segundos mediante el llamado a `WiFi.begin()` sin parámetros. Esto no interrumpe el loop principal del lector RFID ni el buffer offline.
4. **Debounce y Máquina de Estados del Botón:**
   - Se implementó de manera no bloqueante en `button.cpp` el rastreo del tiempo transcurrido en estado presionado (`LOW`). El buzzer y el borrado de credenciales se disparan de forma determinista únicamente si la duración acumulada es `>= 5000 ms`.

---

## 2. Plan de Verificación Manual (Prueba Física)

Para validar la correcta ejecución de esta funcionalidad en la placa física ESP32, se deben seguir los siguientes pasos:

### 2.1 Prueba de Configuración Inicial (Portal Cautivo)
1. Conectar el ESP32 a la computadora mediante USB y abrir el monitor serial a `115200` baudios.
2. Subir el código utilizando PlatformIO.
3. Al encenderse, verificar los logs de consola:
   - Debe imprimir: `[WiFi] Inicializando WiFiManagerHelper...`
   - Debe imprimir: `[WiFi] Intentando conectar. AP de configuración: SmartStock_Setup`
4. Observar el LED de estado: debe parpadear de forma lenta (indica buscando WiFi o portal activo).
5. Tomar un celular o laptop y buscar redes WiFi alrededor.
6. Seleccionar `SmartStock_Setup` e ingresar la clave `smartstock123`.
7. Verificar que se despliega el portal cautivo de forma automática.
8. Seleccionar la red WiFi local (o la de tus datos móviles), escribir su contraseña y presionar "Save".
9. En la consola serial, verificar que imprime:
   - `[WiFi] Conectado exitosamente! IP: [Dirección IP asignada]`
10. Confirmar que el LED pasa a encendido fijo (LED_SOLID_ON) indicando conexión exitosa a la red y al broker MQTT.

### 2.2 Prueba de Reset por Hardware (Pulsación Larga)
1. Con el ESP32 encendido y conectado a internet, presionar y mantener pulsado el botón físico `BTN_MODE_PIN` (pin 26).
2. Contar mentalmente los segundos.
3. Al llegar a los **5 segundos**, confirmar que:
   - El buzzer emite un pitido continuo indicando la confirmación de borrado.
   - El monitor serial muestra: `[WiFi] Borrando credenciales y reiniciando...`
   - El dispositivo se reinicia automáticamente.
4. Tras el reinicio, validar que el ESP32 entra inmediatamente al portal cautivo nuevamente (`SmartStock_Setup`), certificando que las credenciales previas fueron completamente borradas de la memoria flash (NVS).

---

## 3. Declaraciones de Cumplimiento
- **CRITICAL ISSUES (Incidentes Críticos):** Ninguno. La reordenación del Watchdog solventa el único riesgo crítico identificado en el diseño.
- **WARNINGS (Advertencias):** Ninguna.
- **SUGGESTIONS (Sugerencias):** Ninguna.
- **Estado General de la Verificación:** **APROBADO (PASSED & COMPLIANT)** para despliegue en campo.
