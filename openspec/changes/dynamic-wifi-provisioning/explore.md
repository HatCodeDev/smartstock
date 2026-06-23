# Exploration Report: Aprovisionamiento Dinámico de WiFi

## Objetivo
Implementar una solución dinámica para aprovisionar las credenciales WiFi (SSID y Contraseña) en el firmware del ESP32 de SmartStock, eliminando las credenciales hardcodeadas en `config.h` y `wifi_manager.cpp`.

### Requisitos Clave
1. **Seguridad**: El punto de acceso de configuración (AP) debe estar protegido por contraseña (WPA2) para evitar que terceros no autorizados accedan al portal de configuración.
2. **Cambio de Red Dinámico**: 
   - El ESP32 debe entrar automáticamente en modo configuración si no logra conectarse a la red almacenada en un intervalo de tiempo prudencial (ej. 30 segundos).
   - Debe existir un mecanismo de "reset de fábrica/configuración" por hardware. Se utilizará el botón físico existente `BTN_MODE_PIN` (pin 26) para que, al ser presionado durante más de 5 segundos, borre las credenciales guardadas y fuerce el portal cautivo.

---

## Análisis Técnico y Viabilidad del Firmware
El firmware actualmente utiliza la clase `WiFi` nativa del framework de Arduino. 

### Dependencias actuales (`platformio.ini`)
- `knolleary/PubSubClient@^2.8`
- `bblanchon/ArduinoJson@^7`
- `arduino-libraries/NTPClient@^3.2`

### Viabilidad de la librería WiFiManager
La librería `tzapu/WiFiManager` es 100% compatible con el ESP32 y se puede declarar en PlatformIO. 
`WiFiManager` automatiza todo el flujo del portal cautivo:
1. Crea el servidor web interno en el puerto 80 del ESP32.
2. Maneja el Captive Portal DNS redireccionando cualquier petición HTTP a la página de configuración del WiFi.
3. Almacena automáticamente las credenciales WiFi exitosas en la memoria no volátil (NVS) del ESP32 mediante la API de `Preferences` o similar.
4. Soporta la encriptación WPA2 para la red del AP temporal.
5. Permite inyectar parámetros de configuración adicionales si fuera necesario en el futuro (ej. host del broker MQTT).

---

## Modificaciones Propuestas

1. **`platformio.ini`**:
   - Agregar `tzapu/WiFiManager@^2.0.16-rc.2` a `lib_deps`.

2. **`firmware/src/network/wifi_manager.h` y `wifi_manager.cpp`**:
   - Refactorizar para usar la instancia de `WiFiManager` de la librería.
   - Configurar la contraseña del AP de configuración (ej. SSID: `SmartStock_Setup`, Pass: `smartstock123`).
   - Implementar un método público para reiniciar la configuración (borrar credenciales y reiniciar) que pueda ser llamado desde el botón.

3. **`firmware/src/button/button.cpp` y `button.h`**:
   - Modificar la lógica de `tick()` para detectar pulsaciones largas (Long Press) del `BTN_MODE_PIN` (más de 5 segundos).
   - Cuando se detecte una pulsación larga:
     - Emitir una indicación sonora con el buzzer (un tono largo).
     - Llamar al reset de WiFi en el `WiFiManager`.
     - Reiniciar el microcontrolador.

---

## Tradeoffs y Alternativas
- **Uso de Memoria Flash/RAM**: `WiFiManager` incrementa ligeramente el tamaño del binario compilado debido a que incluye un servidor web y un servidor DNS. Sin embargo, el ESP32 dev tiene suficiente almacenamiento (4MB flash) por lo que no compromete el proyecto.
- **Bloqueo del Loop**: Por defecto, `wifiManager.autoConnect()` es bloqueante mientras el portal está activo. Esto es deseable al inicio, ya que el dispositivo no puede operar sin WiFi.
