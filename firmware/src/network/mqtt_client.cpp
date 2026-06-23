#include "mqtt_client.h"
#include "../config.h"

MQTTClientManager::MQTTClientManager() : _mqtt(_secureClient), _lastReconnectAttempt(0), _lastHeartbeat(0) {}

void MQTTClientManager::begin() {
    // HiveMQ Cloud requiere TLS, usamos setInsecure() en desarrollo para no validar el CA
    _secureClient.setInsecure();
    
    _mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    // El tamaño máximo del payload MQTT en PubSubClient por defecto es 256 bytes.
    // Lo aumentamos a 1024 para soportar nuestros batches JSON.
    _mqtt.setBufferSize(1024);
}

void MQTTClientManager::tick() {
    if (!_mqtt.connected()) {
        unsigned long now = millis();
        if (now - _lastReconnectAttempt > 5000) {
            _lastReconnectAttempt = now;
            reconnect();
        }
    } else {
        _mqtt.loop();
        unsigned long now = millis();
        if (now - _lastHeartbeat > 30000) {
            _lastHeartbeat = now;
            String hbTopic = "smartstock/" + String(DEVICE_ID) + "/heartbeat";
            String hbPayload = "{\"status\":\"heartbeat\",\"device_id\":\"" + String(DEVICE_ID) + "\"}";
            _mqtt.publish(hbTopic.c_str(), hbPayload.c_str());
        }
    }
}

bool MQTTClientManager::isConnected() {
    return _mqtt.connected();
}

void MQTTClientManager::reconnect() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    Serial.print("[MQTT] Conectando a HiveMQ...");
    
    String clientId = "ESP32-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    String statusTopic = "smartstock/" + String(DEVICE_ID) + "/status";
    String lwtPayload = "{\"status\":\"offline\",\"device_id\":\"" + String(DEVICE_ID) + "\"}";
    
    if (_mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD, statusTopic.c_str(), 1, true, lwtPayload.c_str())) {
        Serial.println(" conectado!");
        // Publicar estado online con retain=true
        String onlinePayload = "{\"status\":\"online\",\"device_id\":\"" + String(DEVICE_ID) + "\"}";
        _mqtt.publish(statusTopic.c_str(), onlinePayload.c_str(), true);
        
        // Suscribirse al topic de comandos
        String cmdTopic = "smartstock/" + String(DEVICE_ID) + "/commands";
        _mqtt.subscribe(cmdTopic.c_str(), 1); // QoS 1
    } else {
        Serial.print(" falló, rc=");
        Serial.println(_mqtt.state());
    }
}

bool MQTTClientManager::publish(const char* topic, const char* payload) {
    if (isConnected()) {
        return _mqtt.publish(topic, payload);
    }
    return false;
}
