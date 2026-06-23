#include "buzzer.h"
#include "../config.h"

// Definimos los patrones: números positivos son ON (ms), negativos son OFF (ms). 0 termina.
struct PatternDef {
    int steps[10];
};

PatternDef patterns[] = {
    {{0}}, // BUZZ_NONE
    {{150, -100, 150, 0}}, // BUZZ_OK_SALIDA — 2 pitidos 150ms (confirmación lote)
    {{100, -80, 100, -80, 100, 0}}, // BUZZ_OK_RETORNO — 3 pitidos 100ms
    {{800, 0}}, // BUZZ_UNKNOWN_TAG
    {{100, -100, 100, -100, 100, 0}}, // BUZZ_NO_NETWORK
    {{400, -400, 400, 0}}, // BUZZ_MODE_SALIDA
    {{400, -400, 400, -400, 400, 0}}, // BUZZ_MODE_RETORNO
    {{400, -400, 400, -400, 400, -300, 200, 0}}, // BUZZ_MODE_REGISTRO
    {{100, 0}}, // BUZZ_MODE_APAGADO
    {{400, -400, 400, 0}}, // BUZZ_EXIT_REGISTRO
    {{200, 0}}, // BUZZ_REG_NEW
    {{800, 0}}, // BUZZ_REG_CONFLICT
    {{800, 0}},  // BUZZ_CYCLE_CLOSED
    {{20, -30, 0}} // BUZZ_TICK — micro-tick de captura (no usar con play(), solo playIfLow())
};

BuzzerManager::BuzzerManager() : _isPlaying(false), _currentPattern(BUZZ_NONE), _currentStep(0), _lastStepTime(0) {}

void BuzzerManager::begin() {
    ledcSetup(BUZZER_CHANNEL, BUZZER_FREQ, 8); // 8-bit resolution
    ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
    stop();
}

void BuzzerManager::play(BuzzerPattern pattern) {
    _currentPattern = pattern;
    _currentStep = 0;
    _isPlaying = true;
    _lastStepTime = millis();
    executeStep();
}

void BuzzerManager::playBlocking(BuzzerPattern pattern) {
    play(pattern);
    while (_isPlaying) {
        tick();
        delay(1);
    }
}

void BuzzerManager::stop() {
    ledcWriteTone(BUZZER_CHANNEL, 0); // Apagar
    _isPlaying = false;
    _currentPattern = BUZZ_NONE;
}

void BuzzerManager::playIfLow(BuzzerPattern pattern) {
    // Si el buzzer ya está reproduciendo, descartar silenciosamente.
    // Esto evita saturar con BUZZ_TICK cuando llegan múltiples tags.
    if (!_isPlaying) {
        play(pattern);
    }
}

void BuzzerManager::executeStep() {
    if (_currentPattern == BUZZ_NONE) return;
    
    int duration = patterns[_currentPattern].steps[_currentStep];
    if (duration == 0) {
        stop();
        return;
    }
    
    if (duration > 0) {
        // ON
        ledcWriteTone(BUZZER_CHANNEL, BUZZER_FREQ);
    } else {
        // OFF
        ledcWriteTone(BUZZER_CHANNEL, 0);
    }
}

void BuzzerManager::tick() {
    if (!_isPlaying) return;
    
    int duration = patterns[_currentPattern].steps[_currentStep];
    int absDuration = duration > 0 ? duration : -duration;
    
    if (millis() - _lastStepTime >= absDuration) {
        _lastStepTime = millis();
        _currentStep++;
        executeStep();
    }
}
