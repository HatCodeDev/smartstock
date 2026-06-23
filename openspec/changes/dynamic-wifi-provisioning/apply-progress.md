# Apply Progress: Aprovisionamiento Dinámico de WiFi

Este documento registra el progreso de implementación del aprovisionamiento dinámico de WiFi en el firmware.

## Tareas de Implementación

- [x] Configuración y Dependencias:
  - [x] Añadir dependencia de `WiFiManager` en `platformio.ini`.
  - [x] Eliminar credenciales fijas y definir AP `SmartStock_Setup` y clave en `config.h`.
- [x] Refactorización de WiFi (`WiFiManagerHelper`):
  - [x] Crear clase envolvente `WiFiManagerHelper` para evitar conflictos de nombres.
  - [x] Implementar inicialización con `autoConnect` y timeout de 180s en `wifi_manager.cpp`.
  - [x] Implementar borrado de credenciales y reinicio en `resetSettings()`.
- [x] Detección de Pulsación Larga (`ButtonManager`):
  - [x] Añadir propiedades de control de tiempo en `button.h`.
  - [x] Implementar detección de 5s para disparar reset en `button.cpp`.
- [x] Integración en `main.cpp`:
  - [x] Renombrar declaración a `WiFiManagerHelper`.
  - [x] Reordenar inicialización de Watchdog después de que se establece WiFi.

## Resumen del Estado de Implementación
Todos los componentes de firmware requeridos han sido editados e implementados exitosamente de acuerdo con las especificaciones y el diseño aprobados.
