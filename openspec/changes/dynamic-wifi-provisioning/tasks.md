# Implementation Checklist: Aprovisionamiento Dinámico de WiFi

Este documento detalla la lista de tareas específicas para la implementación y verificación del portal cautivo y el reset por hardware en el firmware del ESP32.

## Fase 1: Configuración y Dependencias
- [ ] Modificar [platformio.ini](file:///c:/Users/misae/smartstock/firmware/platformio.ini) para incluir la dependencia `https://github.com/tzapu/WiFiManager.git@^2.0.16-rc.2`.
- [ ] Modificar [config.h](file:///c:/Users/misae/smartstock/firmware/src/config.h):
  - [ ] Comentar o eliminar `#define WIFI_SSID` y `#define WIFI_PASSWORD`.
  - [ ] Añadir `#define WIFI_AP_SSID "SmartStock_Setup"`.
  - [ ] Añadir `#define WIFI_AP_PASSWORD "smartstock123"`.
  - [ ] Añadir `#define WIFI_PORTAL_TIMEOUT_S 180`.

## Fase 2: Refactorización de WiFi (`WiFiManagerHelper`)
- [ ] Modificar [wifi_manager.h](file:///c:/Users/misae/smartstock/firmware/src/network/wifi_manager.h):
  - [ ] Incluir la librería `<WiFiManager.h>`.
  - [ ] Declarar el método público `resetSettings()`.
- [ ] Modificar [wifi_manager.cpp](file:///c:/Users/misae/smartstock/firmware/src/network/wifi_manager.cpp):
  - [ ] Reemplazar la lógica de `begin()` para utilizar la clase `WiFiManager` de la librería.
  - [ ] Configurar el timeout del portal y llamar a `autoConnect(WIFI_AP_SSID, WIFI_AP_PASSWORD)`.
  - [ ] Implementar el método `resetSettings()` que borra credenciales en NVS y llama a `ESP.restart()`.
  - [ ] Ajustar `tick()` para mantener la comprobación de estado de forma no bloqueante.

## Fase 3: Lógica de Botón de Reset (`ButtonManager`)
- [ ] Modificar [button.h](file:///c:/Users/misae/smartstock/firmware/src/button/button.h) para añadir las propiedades de control de tiempo:
  - [ ] `_buttonPressStartTime`
  - [ ] `_isPressing`
  - [ ] `_resetTriggered`
- [ ] Modificar [button.cpp](file:///c:/Users/misae/smartstock/firmware/src/button/button.cpp):
  - [ ] En `tick()`, inicializar el tiempo al presionar el botón (`LOW`).
  - [ ] En `tick()`, comprobar si se alcanzan los 5 segundos continuo en `LOW`. Si se alcanzan, disparar el aviso acústico (buzzer), llamar a `wifi.resetSettings()` y activar la bandera de reset disparado.
  - [ ] En `tick()`, al soltar el botón (`HIGH`), evaluar la duración final. Si es menor a 5 segundos, ejecutar el cambio de modo tradicional.

## Fase 4: Reorganización del Watchdog
- [ ] Modificar [main.cpp](file:///c:/Users/misae/smartstock/firmware/src/main.cpp):
  - [ ] Mover la inicialización y el registro del Watchdog (`esp_task_wdt_init` y `esp_task_wdt_add`) para que ocurra **inmediatamente después** de completar con éxito `wifi.begin()`.

## Fase 5: Verificación y Pruebas Manuales
- [ ] Compilar y subir el firmware al ESP32.
- [ ] Confirmar que, al no encontrar redes, levanta el portal `SmartStock_Setup`.
- [ ] Conectarse al portal cautivo, ingresar la clave del WiFi de prueba y confirmar que el dispositivo se conecta a internet correctamente.
- [ ] Con el dispositivo conectado, mantener pulsado el botón de modo por 5 segundos. Confirmar la señal acústica y el reinicio de fábrica (vuelta al portal).
