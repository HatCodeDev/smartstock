#include "led_status.h"
#include "../config.h"

LedManager::LedManager() : _currentState(LED_BLINK_SLOW), _lastToggleTime(0), _ledIsOn(false) {}

void LedManager::begin() {
    pinMode(LED_STATUS_PIN, OUTPUT);
    digitalWrite(LED_STATUS_PIN, LOW);
}

void LedManager::setState(LedState state) {
    if (_currentState == state) return;
    _currentState = state;
    
    if (_currentState == LED_SOLID_ON) {
        digitalWrite(LED_STATUS_PIN, HIGH);
        _ledIsOn = true;
    }
}

void LedManager::tick() {
    if (_currentState == LED_SOLID_ON) return;
    
    unsigned long interval = (_currentState == LED_BLINK_SLOW) ? 1000 : 200;
    
    if (millis() - _lastToggleTime >= interval) {
        _lastToggleTime = millis();
        _ledIsOn = !_ledIsOn;
        digitalWrite(LED_STATUS_PIN, _ledIsOn ? HIGH : LOW);
    }
}
