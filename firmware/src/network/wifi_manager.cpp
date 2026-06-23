#include "wifi_manager.h"
#include "../config.h"

WiFiManagerHelper::WiFiManagerHelper() : _lastReconnectAttempt(0) {}

void WiFiManagerHelper::begin() {
    Serial.println("[WiFi] Inicializando WiFiManagerHelper...");
    
    // Crear instancia de la librería WiFiManager
    WiFiManager wm;
    
    // Configurar timeout del portal cautivo
    wm.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT_S);
    
    // Intentar auto-conectar. Si no hay credenciales o falla, levanta el portal
    Serial.printf("[WiFi] Intentando conectar. AP de configuración: %s\n", WIFI_AP_SSID);
    bool success = wm.autoConnect(WIFI_AP_SSID, WIFI_AP_PASSWORD);
    
    if (!success) {
        Serial.println("[WiFi] Falló la conexión y se alcanzó el timeout del portal. Reiniciando...");
        delay(1000);
        ESP.restart();
    }
    
    Serial.print("[WiFi] Conectado exitosamente! IP: ");
    Serial.println(WiFi.localIP());
}

void WiFiManagerHelper::tick() {
    if (!isConnected()) {
        unsigned long now = millis();
        // Intentar reconectar cada 10 segundos de forma no bloqueante usando credenciales guardadas
        if (now - _lastReconnectAttempt > 10000) {
            _lastReconnectAttempt = now;
            Serial.println("[WiFi] Reconectando de forma no bloqueante...");
            WiFi.disconnect();
            WiFi.begin(); // Conecta usando las últimas credenciales NVS guardadas por WiFiManager
        }
    }
}

bool WiFiManagerHelper::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void WiFiManagerHelper::resetSettings() {
    Serial.println("[WiFi] Borrando credenciales y reiniciando...");
    WiFiManager wm;
    wm.resetSettings();
    delay(1000);
    ESP.restart();
}
