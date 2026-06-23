#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>

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
