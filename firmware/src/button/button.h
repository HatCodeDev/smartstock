#pragma once
#include <Arduino.h>
#include <Preferences.h>

class ButtonManager {
public:
    ButtonManager();
    void begin();
    void tick();
    String getCurrentMode();
    void setMode(String newMode);
    
    void onChangeMode(void (*callback)(String));
    
    void lock();
    void unlock();
    bool isLocked();

private:
    Preferences _prefs;
    String _currentMode;
    int _lastReading;
    int _buttonState;
    unsigned long _lastDebounceTime;
    void (*_onChangeCallback)(String);
    
    // Control de tiempo para reset físico (WiFiManager reset)
    unsigned long _buttonPressStartTime;
    bool _isPressing;
    bool _resetTriggered;
    
    // Estado de bloqueo remoto (turno cerrado)
    bool _isLocked;
};
