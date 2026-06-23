#include "batch_builder.h"
#include "../config.h"

BatchBuilder::BatchBuilder() : _windowStart(0) {}

void BatchBuilder::addTag(String epc) {
    unsigned long now = millis();
    
    // 1. Deduplicación (ignoramos si la leímos hace menos de 2 segundos)
    if (_lastSeen.find(epc) != _lastSeen.end()) {
        if (now - _lastSeen[epc] < DEDUP_WINDOW_MS) {
            return;
        }
    }
    
    _lastSeen[epc] = now;
    
    // 2. Acumulación (iniciar ventana de 500ms si es la primera etiqueta)
    if (_currentBatch.empty()) {
        _windowStart = now;
    }
    
    _currentBatch.push_back({epc, now});
}

bool BatchBuilder::isWindowReady() {
    if (_currentBatch.empty()) return false;
    // La ventana se cierra después de BATCH_WINDOW_MS (500ms)
    return (millis() - _windowStart >= BATCH_WINDOW_MS);
}

void BatchBuilder::resetWindow() {
    _currentBatch.clear();
    _windowStart = 0;
}

String BatchBuilder::generateUUIDv4() {
    // Generar un UUID v4 válido usando el RNG de hardware del ESP32
    char uuid[37];
    sprintf(uuid, "%08x-%04x-4%03x-%04x-%04x%08x",
            esp_random(),
            esp_random() & 0xFFFF,
            esp_random() & 0x0FFF,
            (esp_random() & 0x3FFF) | 0x8000,
            esp_random() & 0xFFFF,
            esp_random());
    return String(uuid);
}

String BatchBuilder::buildPayload(String deviceId, String modo, unsigned long ntpTime) {
    // ArduinoJson 7 maneja dinámicamente la memoria
    JsonDocument doc; 
    
    doc["batch_id"] = generateUUIDv4();
    doc["device_id"] = deviceId;
    doc["modo"] = modo;
    doc["timestamp"] = ntpTime;
    
    JsonArray tagsArray = doc["tags"].to<JsonArray>();
    for (const auto& tag : _currentBatch) {
        JsonObject tagObj = tagsArray.add<JsonObject>();
        tagObj["epc"] = tag.epc;
        tagObj["rssi"] = nullptr; // Aún no extraemos el RSSI del FM-505
        tagObj["timestamp_esp32"] = tag.timestamp_esp32;
    }
    
    String output;
    serializeJson(doc, output);
    return output;
}
