#include "rfid_reader.h"
#include "../config.h"

// ---------------------------------------------------------------------------
// Constructor e inicialización
// ---------------------------------------------------------------------------

RFIDReader::RFIDReader() : _onTagRead(nullptr), _lastPollTime(0) {}

void RFIDReader::begin(TagCallback callback) {
    _onTagRead = callback;
    Serial2.begin(FM505_BAUD, SERIAL_8N1, FM505_RX_PIN, FM505_TX_PIN);
    Serial.println("[RFID] FM-505 inicializado a " + String(FM505_BAUD) +
                   " bps. Modo multi-tag (comando U).");
}

// ---------------------------------------------------------------------------
// poll() — se llama en cada iteración del loop principal
// ---------------------------------------------------------------------------

void RFIDReader::poll() {
    // 1. Enviar comando U con framing correcto según doc FM-505:
    //    Host → Sensor: <LF> + 'U' + <CR>  (0x0A 0x55 0x0D)
    if (millis() - _lastPollTime >= RFID_POLL_MS) {
        _lastPollTime = millis();
        Serial2.write(0x0A);  // <LF> — inicio de comando
        Serial2.write('U');   // Comando multi-tag anti-colisión
        Serial2.write(0x0D);  // <CR> — fin de comando
    }

    // 2. Lectura no-bloqueante: acumular todos los bytes disponibles
    //    El sensor puede responder con N líneas (una por tag en el campo RF)
    while (Serial2.available()) {
        _rxBuffer += (char)Serial2.read();

        // Guardia de overflow: trama corrupta o ruido eléctrico sostenido
        if (_rxBuffer.length() > 256) {
            Serial.println("[RFID] WARN: buffer desbordado, limpiando.");
            _rxBuffer = "";
            return;
        }
    }

    // 3. Extraer y procesar todas las tramas completas presentes en el buffer.
    //    El protocolo FM-505 termina cada respuesta con <CR><LF> (0x0D 0x0A).
    //    Una trama puede llegar fragmentada en múltiples ticks — esperamos \r\n.
    int crlfIdx;
    while ((crlfIdx = _rxBuffer.indexOf("\r\n")) != -1) {
        // Extraer contenido antes del delimitador (incluye \n inicial del sensor)
        String raw = _rxBuffer.substring(0, crlfIdx);

        // Consumir esta trama del buffer (incluyendo el \r\n final)
        _rxBuffer = _rxBuffer.substring(crlfIdx + 2);

        // trim() elimina el \n (0x0A) inicial que el sensor antepone a cada línea
        raw.trim();
        if (raw.length() > 0) {
            processLine(raw);
        }
    }
}

// ---------------------------------------------------------------------------
// processLine() — parsea una trama ya aislada y limpia del buffer
// ---------------------------------------------------------------------------

void RFIDReader::processLine(const String& line) {
    // Formato de respuesta del comando U (doc FM-505):
    //   Con tags  : U<PC:4><EPC:24><CRC:4>   → 1 + 32 = 33 chars mínimo
    //   Sin tags  : U                          → 1 char, ignorar silenciosamente
    //   Error cmd : X                          → loggear como desconocida

    if (!line.startsWith("U")) {
        Serial.println("[RFID] Trama desconocida: " + line);
        return;
    }

    // Respuesta vacía = no hay etiquetas en el campo RF en este ciclo
    if (line.length() < 1 + FM505_FRAME_HEX_LEN) {
        return;
    }

    // Extraer los 32 chars de payload: PC(4) + EPC(24) + CRC(4)
    String hexFrame = line.substring(1, 1 + FM505_FRAME_HEX_LEN);

    // Validar integridad: CRC16-CCITT sobre los 16 bytes del frame completo.
    // Para una trama válida el residuo es FM505_CRC_RESIDUE (0x1D0F).
    if (crc16(hexFrame) != FM505_CRC_RESIDUE) {
        Serial.println("[RFID] CRC inválido, trama descartada: " + hexFrame);
        return;
    }

    // Extraer EPC: chars [PC_LEN, PC_LEN + EPC_LEN) dentro del hexFrame
    String epc = hexFrame.substring(FM505_PC_HEX_LEN,
                                    FM505_PC_HEX_LEN + FM505_EPC_HEX_LEN);

    if (_onTagRead) {
        _onTagRead(epc);
    }
}

// ---------------------------------------------------------------------------
// crc16() — CRC16-CCITT (polinomio 0x1021, init 0xFFFF)
// ---------------------------------------------------------------------------
//
// Se calcula sobre los bytes binarios del hexFrame (PC + EPC + CRC = 16 bytes).
// Incluir los bytes del CRC en el cálculo es intencional: para una trama
// sin errores, el residuo final siempre es 0x1D0F (FM505_CRC_RESIDUE).
//
uint16_t RFIDReader::crc16(const String& hexFrame) {
    uint16_t crc       = 0xFFFF;
    const int byteCount = hexFrame.length() / 2;

    // Convertir par de chars hex → nibbles → byte binario
    auto nibble = [](char c) -> uint8_t {
        if (c >= '0' && c <= '9') return static_cast<uint8_t>(c - '0');
        if (c >= 'A' && c <= 'F') return static_cast<uint8_t>(c - 'A' + 10);
        return static_cast<uint8_t>(c - 'a' + 10);  // 'a'–'f'
    };

    for (int i = 0; i < byteCount; i++) {
        uint8_t rawByte = static_cast<uint8_t>(
            (nibble(hexFrame.charAt(i * 2)) << 4) |
             nibble(hexFrame.charAt(i * 2 + 1))
        );

        crc ^= (static_cast<uint16_t>(rawByte) << 8);
        for (int bit = 0; bit < 8; bit++) {
            crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : (crc << 1);
        }
    }

    return crc;
}
