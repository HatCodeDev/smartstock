#pragma once
#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

class MQTTClientManager {
public:
    MQTTClientManager();
    void begin();
    void tick();
    bool isConnected();
    bool publish(const char* topic, const char* payload);
    PubSubClient& getClient() { return _mqtt; }

private:
    WiFiClientSecure _secureClient;
    PubSubClient _mqtt;
    unsigned long _lastReconnectAttempt;
    unsigned long _lastHeartbeat;
    
    void reconnect();
};
