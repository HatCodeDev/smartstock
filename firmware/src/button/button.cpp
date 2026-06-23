#include "button.h"
#include "../config.h"
#include "../buzzer/buzzer.h"
#include "../network/wifi_manager.h"

extern BuzzerManager buzzer;
extern WiFiManagerHelper wifi;

ButtonManager::ButtonManager() : _currentMode("APAGADO"), _lastReading(HIGH), _buttonState(HIGH), _lastDebounceTime(0), _onChangeCallback(nullptr),
                                 _buttonPressStartTime(0), _isPressing(false), _resetTriggered(false), _isLocked(false) {}

void ButtonManager::begin() {
    pinMode(BTN_MODE_PIN, INPUT_PULLUP);
    
    // Leer el estado inicial real para evitar falsos flancos al arrancar
    int initialReading = digitalRead(BTN_MODE_PIN);
    _lastReading = initialReading;
    _buttonState = initialReading;
    
    _prefs.begin("smartstock", false);
    _currentMode = _prefs.getString("mode", "APAGADO");
}

void ButtonManager::onChangeMode(void (*callback)(String)) {
    _onChangeCallback = callback;
}

String ButtonManager::getCurrentMode() {
    return _currentMode;
}

void ButtonManager::setMode(String newMode) {
    if (newMode == "SALIDA" || newMode == "RETORNO" || newMode == "REGISTRO" || newMode == "APAGADO") {
        _currentMode = newMode;
        _prefs.putString("mode", _currentMode);
        
        if (_onChangeCallback) {
            _onChangeCallback(_currentMode);
        }
    }
}

void ButtonManager::tick() {
    int reading = digitalRead(BTN_MODE_PIN);
    
    if (reading != _lastReading) {
        _lastDebounceTime = millis();
    }
    
    if ((millis() - _lastDebounceTime) > 50) {
        if (reading != _buttonState) {
            _buttonState = reading;
            
            // Reaccionar al presionar (flanco de bajada)
            if (_buttonState == LOW) {
                _buttonPressStartTime = millis();
                _isPressing = true;
                _resetTriggered = false;
            } else {
                // FLANCO DE SUBIDA (Soltado)
                if (_isPressing) {
                    unsigned long duration = millis() - _buttonPressStartTime;
                    
                    // Si se soltó antes de los 5 segundos y no se ejecutó el reset
                    if (duration < 5000 && !_resetTriggered) {
                        if (_isLocked) {
                            buzzer.play(BUZZ_CYCLE_CLOSED);
                            Serial.println("[BOTON] Intento de alternar modo ignorado: Botón bloqueado (turno cerrado).");
                        } else {
                            // Botón físico alterna entre SALIDA → RETORNO → APAGADO
                            if (_currentMode == "SALIDA") {
                                setMode("RETORNO");
                            } else if (_currentMode == "RETORNO") {
                                setMode("APAGADO");
                            } else {
                                setMode("SALIDA");
                            }
                        }
                    }
                    _isPressing = false;
                }
            }
        }
    }
    
    // Monitorear continuamente si se mantiene presionado para el reset físico
    if (_isPressing && !_resetTriggered) {
        if ((millis() - _buttonPressStartTime) >= 5000) {
            _resetTriggered = true;
            
            // Sonido de alerta e inicio de reset
            buzzer.playBlocking(BUZZ_UNKNOWN_TAG); // Pitido indicativo de alerta bloqueante
            wifi.resetSettings(); // Esto borra credenciales de la NVS y reinicia el ESP32
        }
    }
    
    _lastReading = reading;
}

void ButtonManager::lock() {
    _isLocked = true;
    Serial.println("[BOTON] Botón físico BLOQUEADO (turno cerrado).");
}

void ButtonManager::unlock() {
    _isLocked = false;
    Serial.println("[BOTON] Botón físico DESBLOQUEADO.");
}

bool ButtonManager::isLocked() {
    return _isLocked;
}

