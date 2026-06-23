---
skill: cpp-esp32
domain: C++, ESP32 Firmware, PlatformIO
load_when: working on C++ firmware, compiling, uploading code to ESP32, or configuring VSCode C++ environment
---

# Skill: C++ y ESP32 (Firmware M4)

## Flujo de Trabajo con PlatformIO

Para compilar, subir código y debugear en el ESP32, utilizamos **PlatformIO CLI** (en lugar de Arduino IDE).
Todos los comandos deben ejecutarse ubicando la terminal dentro de la carpeta `firmware/`.

### 1. Comandos de Compilación y Flasheo

| Tarea | Comando a ejecutar en la terminal (`cd firmware`) |
|-------|---------------------------------------------------|
| **Verificar sintaxis** (Compilar sin subir) | `python -m platformio run` |
| **Subir código al ESP32** | `python -m platformio run --target upload` |
| **Limpiar compilación** (si hay errores raros) | `python -m platformio run --target clean` |
| **Abrir Monitor Serial** (ver logs a 115200) | `python -m platformio device monitor --baud 115200` |

> ⚠️ **Importante:** Recuerda cerrar el Monitor Serial (`Ctrl + C`) ANTES de intentar subir un nuevo código, o el puerto serial estará bloqueado (Access Denied).

## Configuración del Editor (VS Code y errores de `#include <Arduino.h>`)

Si VSCode marca errores en rojo diciendo `Arduino.h no encontrado` (clang/Intellisense), es porque no sabe dónde PlatformIO descargó las librerías del framework de Arduino.

### ¿Cómo solucionarlo?
1. Ejecuta este comando dentro de la carpeta `firmware/`:
   `python -m platformio init --ide vscode`
2. Esto generará la carpeta `.vscode/` dentro de `firmware/` con el archivo `c_cpp_properties.json`.
3. **Requisito del Workspace:** Para que la extensión C/C++ detecte la configuración automáticamente, **es recomendable abrir la carpeta `firmware` directamente en VSCode**, o agregarla al Workspace actual (`File -> Add Folder to Workspace...`).
4. **Extensión recomendada:** Asegúrate de tener instalada la extensión oficial de Microsoft: **C/C++ (ms-vscode.cpptools)**.

## Mejores Prácticas de Memoria y Ciclos (Non-Blocking)

- **No uses `delay()`**: Nunca bloquees el flujo principal en `loop()`. Usa variables `unsigned long` combinadas con `millis()` para medir intervalos.
- **Memoria Dinámica**: Prefiere `std::vector` y `String` controlados. Evita usar arreglos de C con `malloc`/`free` a menos que sea estrictamente necesario.
- **Interrupciones**: Mantén las rutinas de servicio de interrupción (ISR) extremadamente cortas (cambiar una bandera booleana) y procesa el evento en el `loop()`.
- **JSON**: Al construir JSON para MQTT, usa `JsonDocument doc;` de ArduinoJson 7, el cual maneja la memoria elásticamente de forma transparente, previniendo fugas de memoria (Memory Leaks).
