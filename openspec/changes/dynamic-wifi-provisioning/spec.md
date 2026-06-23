# Especificación Técnica: Aprovisionamiento Dinámico de WiFi

Este documento detalla la especificación técnica formal para la refactorización del sistema de red en el firmware del ESP32.

---

## 1. Cambios en Dependencias (`platformio.ini`)

Se debe añadir la librería `WiFiManager` en la lista de dependencias:
- **Librería:** `https://github.com/tzapu/WiFiManager.git@^2.0.16-rc.2`
- **Razón:** Proveer el portal cautivo para ESP32 de forma nativa y estable.

---

## 2. Definiciones de Configuración (`config.h`)

Se deben eliminar las credenciales fijas de WiFi y añadir las constantes del punto de acceso (AP) temporal:
- **Remover:** `WIFI_SSID` y `WIFI_PASSWORD`.
- **Añadir:**
  ```cpp
  #define WIFI_AP_SSID "SmartStock_Setup"
  #define WIFI_AP_PASSWORD "smartstock123"
  #define WIFI_PORTAL_TIMEOUT_S 180 // 3 minutos de timeout para configurar
  ```

---

## 3. Módulo de WiFi (`wifi_manager.h` y `wifi_manager.cpp`)

### 3.1 Contrato del Gestor de WiFi

```cpp
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h> // Librería de portal cautivo

class WiFiManagerHelper {
public:
    WiFiManagerHelper();
    void begin();
    void tick();
    bool isConnected();
    void resetSettings();

private:
    unsigned long _lastReconnectAttempt;
};
```

*Nota: Renombramos internamente la clase o la interfaz para evitar colisión de nombres con la clase `WiFiManager` provista por la librería homónima.*

### 3.2 Lógica de Inicialización (`begin()`)

1. Crear instancia local: `WiFiManager wm;`
2. Configurar timeout del portal cautivo: `wm.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT_S);`
3. Intentar auto-conectar y, si no hay credenciales válidas guardadas, levantar la red WPA2:
   `bool success = wm.autoConnect(WIFI_AP_SSID, WIFI_AP_PASSWORD);`
4. Si `success` es falso (timeout alcanzado sin configuración):
   - Imprimir error en serial: `"[WiFi] Fallo en conexión y se alcanzó el timeout."`
   - Reiniciar el dispositivo: `ESP.restart();` para volver a intentar.
5. Si es exitoso, imprimir la IP obtenida por consola.

### 3.3 Lógica de Limpieza (`resetSettings()`)

1. Crear instancia local: `WiFiManager wm;`
2. Ejecutar borrado de credenciales: `wm.resetSettings();`
3. Forzar reinicio del ESP32: `ESP.restart();`

---

## 4. Módulo de Botón (`button.h` y `button.cpp`)

### 4.1 Modificaciones en `ButtonManager`

Añadir las siguientes propiedades privadas a la clase para el control del tiempo de pulsación:
```cpp
private:
    unsigned long _buttonPressStartTime;
    bool _isPressing;
    bool _resetTriggered;
```

### 4.2 Lógica de Detección de Pulsación Larga (`tick()`)

El método `tick()` en `button.cpp` se comportará de acuerdo a la siguiente máquina de estados basada en el tiempo:

1. **Flanco de bajada (Botón pasa de HIGH a LOW - Presionado):**
   - `_buttonPressStartTime = millis();`
   - `_isPressing = true;`
   - `_resetTriggered = false;`
2. **Durante la pulsación (Botón se mantiene en LOW):**
   - Si `_isPressing` es `true` y `_resetTriggered` es `false`:
     - Calcular tiempo transcurrido: `unsigned long pressDuration = millis() - _buttonPressStartTime;`
     - Si `pressDuration >= 5000` (5 segundos):
       - Poner `_resetTriggered = true;`
       - Reproducir un pitido continuo usando la clase `BuzzerManager` (o llamar a una secuencia de aviso acústico largo).
       - Llamar al método `wifi.resetSettings()` para borrar la configuración e iniciar el reinicio del sistema.
3. **Flanco de subida (Botón pasa de LOW a HIGH - Soltado):**
   - Si `_isPressing` es `true`:
     - Calcular la duración final de la pulsación.
     - Si la duración final fue menor a `5000` ms y `_resetTriggered` es `false`:
       - Ejecutar la máquina de estados existente de cambio de modo (SALIDA → RETORNO → APAGADO).
     - Resetear `_isPressing = false;`.

---

## 5. Ciclo de Vida y Watchdog (`main.cpp`)

El método `setup()` se reorganizará estrictamente para evitar que el Watchdog de 10 segundos se active durante el bloqueo interactivo del portal cautivo.

```cpp
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    // 1. Inicializar periféricos no bloqueantes de feedback y entrada
    led.begin();
    buzzer.begin();
    buzzer.play(BUZZ_MODE_APAGADO);
    button.begin();
    button.onChangeMode(onModeChanged);
    
    // 2. Intentar conectar a WiFi (Bloqueante solo si no hay credenciales guardadas)
    // El portal puede tomar minutos. El Watchdog aún no se ha inicializado.
    wifi.begin();
    
    // 3. Inicializar el Watchdog una vez que la conexión WiFi está establecida
    logMsg("SISTEMA", "Configurando Watchdog (10s)...");
    esp_task_wdt_init(WDT_TIMEOUT, true);
    esp_task_wdt_add(NULL); // Añadir el hilo del loop
    
    // 4. Inicializar servicios dependientes de red
    mqtt.begin();
    mqtt.getClient().setCallback(onMqttMessage);
    timeClient.begin();
    rfid.begin(onTagRead);
    
    logMsg("SISTEMA", "Portal listo. Modo actual: " + button.getCurrentMode());
}
```
