#include "../../include/devices/button.h"

Button::Button(uint8_t pin) {
    this->pin = pin;

    trangThaiDocTruoc = HIGH;
    trangThaiOnDinh = HIGH;
    thoiGianThayDoi = 0;
}

void Button::begin() {
    pinMode(pin, INPUT_PULLUP);

    trangThaiDocTruoc = digitalRead(pin);
    trangThaiOnDinh = trangThaiDocTruoc;
}

bool Button::vuaNhan() {
    bool trangThaiDoc = digitalRead(pin);

    if (trangThaiDoc != trangThaiDocTruoc) {
        thoiGianThayDoi = millis();
    }

    if (millis() - thoiGianThayDoi >= debounceDelay) {
        if (trangThaiDoc != trangThaiOnDinh) {
            trangThaiOnDinh = trangThaiDoc;

            if (trangThaiOnDinh == LOW) {
                trangThaiDocTruoc = trangThaiDoc;
                return true;
            }
        }
    }

    trangThaiDocTruoc = trangThaiDoc;

    return false;
}