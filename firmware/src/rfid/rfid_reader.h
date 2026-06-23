#pragma once
#include <Arduino.h>
#include <functional>

class RFIDReader {
public:
    using TagCallback = std::function<void(String epc)>;

    RFIDReader();
    void begin(TagCallback callback);
    void poll();

private:
    TagCallback        _onTagRead;
    unsigned long      _lastPollTime;
    String             _rxBuffer;          // Acumulador no-bloqueante de bytes UART

    void               processLine(const String& line);
    static uint16_t    crc16(const String& hexFrame);
};
