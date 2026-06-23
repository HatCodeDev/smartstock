# Protocolo Lector UHF Fonkan FM-505 (Resultados Finales M3)

> **Importante:** Este documento anula la suposición inicial de que el lector utilizaba el protocolo binario (Genibus con header `0xA0`). El lector se comunica mediante texto plano (ASCII).
> **Corrección Fase 4:** El lector NO opera en Auto-Read. Funciona en modo **request-response (Polling)**. Requiere el envío activo del comando `Q`.

## Parámetros Seriales
* **Baud Rate:** 38400 bps
* **Data Bits:** 8
* **Stop Bits:** 1
* **Paridad:** Ninguna (8N1)

## Estructura de Trama (Lectura Activa)

El módulo envía las lecturas de forma asíncrona como líneas de texto.

### Ejemplo de trama recibida
**Cadena ASCII:** `\nQ3000E28069150000401CFAE60A1ECDA5\r\n`

**Desglose Hexadecimal:**
`0A 51 33 30 30 30 45 32 38 30 36 39 31 35 30 30 30 30 34 30 31 43 46 41 45 36 30 41 31 45 43 44 41 35 0D 0A`

| Segmento ASCII | Representación Hex | Función Identificada |
| :--- | :--- | :--- |
| `\nQ` | `0A 51` | Inicio de trama e identificador de comando/reporte. |
| `3000` | `33 30 30 30` | **PC (Protocol Control).** 4 caracteres. Indica la longitud del EPC (ej. 3000 = 96 bits). |
| `E28069150000401CFAE6` | `45 32 ... 45 36` | **EPC de la etiqueta (TRUNCADO).** Longitud: 20 caracteres ASCII. El hardware recorta los últimos 4 caracteres del EPC estándar de 24 caracteres. |
| `0A1ECDA5` | `30 41 31 ... 41 35` | **Carga Útil Dinámica (Varianza).** 8 caracteres. Ruido de radio, RSSI o timestamp interno. |
| `\r\n` | `0D 0A` | Fin de trama (Carriage Return + Line Feed). |

## Varianza Matemática (Análisis Fase 3)
La carga útil de 8 caracteres varía en cada lectura continua del mismo tag:
1. `0A1ECDA5`
2. `C61E9E9C`
3. `D21E512B`

**Conclusión:**
Tras ejecutar análisis de sumas de verificación (checksum ASCII/Hex) y cálculos de CRC estándar (CRC16-CCITT, CRC16-Modbus, CRC16-Gen2), se concluye que estos 8 caracteres **no son un CRC estándar del mensaje**. 
Dado que los valores fluctúan rápidamente (ej: `CDA5`, `9E9C`, `512B`), es altamente probable que representen una combinación propietaria de:
* Indicador de antena (`1E` se mantiene constante en nuestras pruebas)
* RSSI (Nivel de señal)
* Contador de iteraciones o Timestamp interno del lector.

### ✅ Capacidad de Lectura Completa (96-bit EPC)
Se ha confirmado empíricamente que el hardware **SÍ puede leer los 24 caracteres del EPC** (96 bits). La limitación anterior era de software en la extracción de la cadena ASCII.

**Configuración Correcta:**
- PC: 4 caracteres (índices 1-4)
- EPC: 24 caracteres (índices 5-28)
- Varianza/MetaData: 8 caracteres (índices 29-36)

Ejemplo de EPC completo para UCODE U9: `E28069150000501CFAE6B61E` (los últimos 4 caracteres son los que garantizan unicidad).
## Implicaciones para el Firmware ESP32
Este descubrimiento simplifica drásticamente el firmware del microcontrolador. En lugar de leer bytes uno por uno manejando un buffer circular para máquinas de estado binarias, se utilizará lectura delimitada por saltos de línea (String ASCII).

### Parseo (C++)
```cpp
if (Serial2.available()) {
    String trama = Serial2.readStringUntil('\n');
    trama.trim(); // Elimina \r y otros espacios
    if (trama.startsWith("Q") && trama.length() >= 25) {
        // Ignoramos la 'Q' (idx 0) y el PC "3000" (idx 1 a 4). 
        // Extraemos estrictamente los 20 caracteres garantizados del EPC.
        String epc = trama.substring(5, 25); 
        // La varianza y el ruido se descartan automáticamente.
        
        // Agregar a la cola/batch para envío por MQTT
    }
}
```

### Formato de Salida (MQTT)
El ESP32 acumulará los EPCs en ventanas de tiempo (ej. 500ms) y emitirá un JSON hacia el broker MQTT (`smartstock/{device_id}/events`):

```json
{
  "device_id": "PORTAL_01",
  "timestamp": "2026-05-05T14:30:00Z",
  "epcs": [
    "3000E28069150000401CFAE6"
  ]
}
```
Esto alinea directamente al lector RFID con el servicio `BatchProcessor` desarrollado en el backend durante M2.

## Comando de Inventario (Confirmado en Fase 4)

El lector opera en modo **request-response**. Para obtener una lectura se debe enviar el comando:

| Formato | Bytes | Descripción |
|---------|-------|-------------|
| ASCII | `Q\r\n` | Enviar la letra Q seguida de CR+LF |
| HEX | `0A 51 0D` | Equivalente hexadecimal |

- Si **hay etiqueta** en campo: responde `Q` + EPC + Varianza + `\r\n`
- Si **no hay etiqueta**: responde solo `Q`

## Hallazgos de Validación (Fase 4)

| # | Hallazgo | Implicación para Firmware ESP32 |
|---|----------|---------------------------------|
| 1 | **Anti-colisión simple**: Devuelve **1 EPC por comando `Q`**. | Enviar múltiples `Q` rápidos en la ventana de 500ms para capturar varios tags. |
| 2 | **Tag fatigue**: Una etiqueta estática se queda "dormida" después de N lecturas. Es comportamiento EPC Gen2 estándar. | El BatchProcessor ya implementa deduplicación por ventana. No tratar "sin lectura" como "tag ausente" inmediato. |
| 3 | **Prioridad RSSI**: Con múltiples tags, el de mayor señal domina las respuestas. | El portal físico debe estar a distancia óptima para equilibrar la señal entre tags. |

## Decisión Arquitectónica: Polling vs Auto-Read

> **Decisión: Polling es la estrategia principal. Auto-Read es Plan B.**

### Plan A — Polling activo (implementado)

El ESP32 envía el comando `Q\r\n` de forma activa en un loop controlado.

| Parámetro | Script de validación (M3) | Firmware ESP32 (M4) |
|-----------|:-------------------------:|:-------------------:|
| Intervalo de polling | 500ms | **50ms** |
| Queries por segundo | 2 | 20 |
| Tags capturados / ventana 500ms | ~1-2 | ~5-10 (rotación anti-colisión) |

**Por qué es suficiente para SmartStock:**
- El caso de uso es un portal físico: las prendas pasan en 1-3 segundos.
- A 20 queries/seg, en 1 segundo se emiten 20 `Q` → alta probabilidad de rotar entre varios tags.
- La limitación de anti-colisión (1 tag por `Q`) es **del chip RFID**, no del modo de operación. Auto-Read no la resuelve.
- El ESP32 controla exactamente cuándo escanear (ej: activar solo cuando un sensor detecta movimiento).

### Plan B — Auto-Read / Modo Continuo (a investigar si Plan A falla)

La herramienta del fabricante tiene un botón **"Pause Read Cycle"**, lo que implica que existe un modo continuo donde el lector escanea sin recibir comandos. El comando para activarlo es **desconocido** (no está en el datasheet disponible).

**Condición de activación del Plan B:**
> Solo investigar si, en M4 con 50ms de polling, el portal no captura suficientes tags distintos en una pasada real de prendas.

**Riesgos del Plan B:**
- El comando de activación no está documentado → riesgo de tiempo invertido sin resultado.
- El algoritmo de anti-colisión interno del lector es propietario → comportamiento no predecible.
- Perdemos control del timing de escaneo desde el ESP32.

## Guía de Despliegue y Validación (Post-Corrección)

Para aplicar la corrección de truncamiento de EPC y validar la lectura, seguí estos pasos:

### 1. Flashear el ESP32
Desde la raíz de la carpeta `firmware/`, ejecutá el siguiente comando usando PlatformIO CLI:

```bash
pio run --target upload
```

### 2. Monitorear Lectura Cruda
Una vez flasheado, podés abrir el monitor serial para ver los EPCs ya purificados (sin el `3000` y con los 20 caracteres reales):

```bash
pio device monitor --baud 115200
```

### 3. Validación de Unicidad
1. Pasá una etiqueta "Left-Aligned" (codificada manualmente).
2. Verificá que el log diga `[RFID] EPC capturado: <20 caracteres>`.
3. Verificá que si pasás dos etiquetas distintas, los 20 caracteres sean diferentes.

> **Nota:** Con el ajuste de software a 24 caracteres, las etiquetas se identifican correctamente. Ya no es necesario usar la estrategia "Left-Aligned" si las etiquetas traen su serie único al final.

---

## Pendientes de Lógica (Frontend/UX)

1. **Diferenciación de Duplicados vs Conflictos:**
   - **Lectura Repetida (Diferente):** Si una etiqueta que estoy registrando se lee múltiples veces en la misma sesión, la UI debe mostrar que es la *misma* instancia para no confundir al usuario.
   - **Conflicto de Asignación:** Si una etiqueta leída ya pertenece a *otro* producto en la base de datos, debe saltar una alerta de conflicto clara.
