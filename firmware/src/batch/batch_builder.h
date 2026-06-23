#pragma once
#include <Arduino.h>
#include <vector>
#include <map>
#include <ArduinoJson.h>

struct TagRead {
    String epc;
    unsigned long timestamp_esp32;
};

class BatchBuilder {
public:
    BatchBuilder();
    void addTag(String epc);
    bool isWindowReady();
    String buildPayload(String deviceId, String modo, unsigned long ntpTime);
    void resetWindow();

private:
    std::vector<TagRead> _currentBatch;
    std::map<String, unsigned long> _lastSeen;
    unsigned long _windowStart;
    
    String generateUUIDv4();
};
