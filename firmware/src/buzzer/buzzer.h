#pragma once
#include <Arduino.h>

enum BuzzerPattern {
    BUZZ_NONE,
    BUZZ_OK_SALIDA,
    BUZZ_OK_RETORNO,
    BUZZ_UNKNOWN_TAG,
    BUZZ_NO_NETWORK,
    BUZZ_MODE_SALIDA,
    BUZZ_MODE_RETORNO,
    BUZZ_MODE_REGISTRO,
    BUZZ_MODE_APAGADO,
    BUZZ_EXIT_REGISTRO,
    BUZZ_REG_NEW,
    BUZZ_REG_CONFLICT,
    BUZZ_CYCLE_CLOSED,
    BUZZ_TICK          // Micro-tick 20ms — efecto Geiger para captura multi-tag
};

class BuzzerManager {
public:
    BuzzerManager();
    void begin();
    void tick();
    void play(BuzzerPattern pattern);
    void playBlocking(BuzzerPattern pattern); // Reproducción bloqueante (útil en setup/reset)
    void playIfLow(BuzzerPattern pattern); // Descarta si ya reproduce (anti-saturación)
    void stop();

private:
    bool _isPlaying;
    BuzzerPattern _currentPattern;
    int _currentStep;
    unsigned long _lastStepTime;
    
    void executeStep();
};
