# Propuesta Arquitectónica: Aprovisionamiento Dinámico de WiFi

Proponemos refactorizar el manejo de conexión WiFi en el firmware del ESP32 para usar un Portal Cautivo dinámico (`WiFiManager`). Esto elimina la necesidad de hardcodear credenciales y permite la configuración remota mediante cualquier dispositivo móvil.

---

## User Review Required

> [!IMPORTANT]
> **Compatibilidad con el Watchdog (WDT):**
> Dado que el portal cautivo bloquea la ejecución de forma interactiva esperando a que el usuario introduzca las credenciales, el Watchdog Timer (WDT) de 10 segundos configurado en `main.cpp` se activará y reiniciará la placa constantemente durante la configuración.
> **Solución propuesta:** 
> Modificaremos el orden de inicialización en `main.cpp` para que el WDT se inicialice y registre la tarea **después** de que `wifi.begin()` se haya completado con éxito. De esta forma, el portal puede tardar minutos en configurarse sin riesgo de resets por watchdog.

> [!WARNING]
> **Seguridad de la Red Temporal (AP):**
> La red WiFi temporal del portal cautivo se llamará `SmartStock_Setup` y estará protegida por la contraseña WPA2: `smartstock123`. Esto evita que terceras personas en el almacén alteren la configuración del dispositivo.

---

## Proposed Changes

### 1. Firmware Components

#### [MODIFY] [platformio.ini](file:///c:/Users/misae/smartstock/firmware/platformio.ini)
- Agregar la dependencia de `WiFiManager`:
  ```ini
  lib_deps =
      knolleary/PubSubClient@^2.8
      bblanchon/ArduinoJson@^7
      arduino-libraries/NTPClient@^3.2
      https://github.com/tzapu/WiFiManager.git@^2.0.16-rc.2
  ```

#### [MODIFY] [config.h](file:///c:/Users/misae/smartstock/firmware/src/config.h)
- Eliminar o comentar `#define WIFI_SSID` y `#define WIFI_PASSWORD`.
- Agregar las definiciones de seguridad para el punto de acceso:
  ```cpp
  #define WIFI_AP_SSID "SmartStock_Setup"
  #define WIFI_AP_PASSWORD "smartstock123"
  ```

#### [MODIFY] [wifi_manager.h](file:///c:/Users/misae/smartstock/firmware/src/network/wifi_manager.h)
- Declarar el método público `resetSettings()` para poder borrar las credenciales cuando se solicite por hardware.
- Declarar una bandera interna o método para validar el estado de conexión sin bloqueos.

#### [MODIFY] [wifi_manager.cpp](file:///c:/Users/misae/smartstock/firmware/src/network/wifi_manager.cpp)
- Reemplazar el uso directo de `WiFi.begin()` por el flujo de `WiFiManager`.
- En `begin()`, inicializar `WiFiManager`, configurar un timeout de conexión para el portal (ej. 180 segundos) para que no se quede bloqueado indefinidamente si nadie se conecta, y llamar a `autoConnect(WIFI_AP_SSID, WIFI_AP_PASSWORD)`.
- Implementar `resetSettings()` que llame a `wifiManager.resetSettings()` y luego ejecute `ESP.restart()`.
- En `tick()`, usar el comportamiento no bloqueante. Como `WiFiManager` guarda la configuración en la flash, la reconexión de fondo la realiza el stack nativo de ESP32. Mantendremos un tick ligero que valide si la conexión cayó y ejecute intentos no bloqueantes en caso de desconexión prolongada.

#### [MODIFY] [button.h](file:///c:/Users/misae/smartstock/firmware/src/button/button.h)
- Agregar variables de seguimiento de tiempo de pulsación del botón:
  ```cpp
  unsigned long _buttonPressStartTime;
  bool _isPressing;
  ```

#### [MODIFY] [button.cpp](file:///c:/Users/misae/smartstock/firmware/src/button/button.cpp)
- Modificar el método `tick()` para soportar detección de pulsación larga:
  - Cuando el botón pasa a `LOW` (presionado), registrar `_buttonPressStartTime = millis()` y poner `_isPressing = true`.
  - Mientras el botón siga en `LOW` y `_isPressing` sea verdadero:
    - Si `millis() - _buttonPressStartTime > 5000` (5 segundos):
      - Ejecutar el sonido largo de reset en el buzzer.
      - Llamar a la función de reset de WiFi en `wifi`.
  - Cuando el botón pase a `HIGH` (soltado), resetear `_isPressing = false`. Si el tiempo presionado fue menor a 5 segundos, ejecutar la lógica existente de cambio de modo (SALIDA → RETORNO → APAGADO).

#### [MODIFY] [main.cpp](file:///c:/Users/misae/smartstock/firmware/src/main.cpp)
- Mover el bloque de inicialización del Watchdog (`esp_task_wdt_init` y `esp_task_wdt_add`) al final de `setup()`, justo después de `wifi.begin()`.

---

## Verification Plan

### Manual Verification
1. **Conexión Inicial (Sin clave guardada):**
   - Borrar la flash del ESP32 o forzar el reset de fábrica.
   - Encender el dispositivo. El LED de estado debe parpadear lento (LED_BLINK_SLOW) indicando que no hay WiFi.
   - Escanear redes WiFi desde el celular y verificar la presencia de `SmartStock_Setup` (debe requerir contraseña `smartstock123`).
   - Conectarse y verificar que se despliega el portal cautivo.
   - Configurar una red WiFi local válida (o datos compartidos del celular).
   - Confirmar que el dispositivo se conecta, el LED pasa a encendido fijo (LED_SOLID_ON) y los mensajes de logs muestran la conexión exitosa.
2. **Reset de Fábrica (Pulsación Larga):**
   - Con el ESP32 ya conectado a internet, mantener presionado el botón de modo por más de 5 segundos.
   - Verificar acústicamente el pitido continuo del buzzer y el posterior reinicio del dispositivo.
   - Validar que al iniciar nuevamente, levanta el portal cautivo `SmartStock_Setup` de forma inmediata.
