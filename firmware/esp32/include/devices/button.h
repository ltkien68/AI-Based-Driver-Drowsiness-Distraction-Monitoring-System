#ifndef BUTTON_H
#define BUTTON_H

#include <Arduino.h>

class Button {
private:
    uint8_t pin;

    bool trangThaiDocTruoc;
    bool trangThaiOnDinh;

    unsigned long thoiGianThayDoi;
    const unsigned long debounceDelay = 50;

public:
    Button(uint8_t pin);

    void begin();

    bool vuaNhan();
};

#endif