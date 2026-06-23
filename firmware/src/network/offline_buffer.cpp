#include "offline_buffer.h"

OfflineBuffer::OfflineBuffer(size_t maxSize) : _maxSize(maxSize) {}

bool OfflineBuffer::push(String payload) {
    if (_buffer.size() >= _maxSize) {
        // Si el buffer está lleno, eliminamos el más viejo (FIFO)
        _buffer.pop_front();
    }
    _buffer.push_back(payload);
    return true;
}

String OfflineBuffer::peek() {
    if (_buffer.empty()) return "";
    return _buffer.front();
}

void OfflineBuffer::pop() {
    if (!_buffer.empty()) {
        _buffer.pop_front();
    }
}

bool OfflineBuffer::isEmpty() {
    return _buffer.empty();
}

size_t OfflineBuffer::size() {
    return _buffer.size();
}
