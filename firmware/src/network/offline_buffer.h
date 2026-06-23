#pragma once
#include <Arduino.h>
#include <deque>

class OfflineBuffer {
public:
    OfflineBuffer(size_t maxSize);
    bool push(String payload);
    String peek();
    void pop();
    bool isEmpty();
    size_t size();

private:
    size_t _maxSize;
    std::deque<String> _buffer;
};
