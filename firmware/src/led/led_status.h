#pragma once
#include <Arduino.h>

enum LedState {
    LED_SOLID_ON,    // Conectado y operativo
    LED_BLINK_SLOW,  // Sin conexión (1s)
    LED_BLINK_FAST   // Reconectando (200ms)
};

class LedManager {
public:
    LedManager();
    void begin();
    void tick();
    void setState(LedState state);

private:
    LedState _currentState;
    unsigned long _lastToggleTime;
    bool _ledIsOn;
};
