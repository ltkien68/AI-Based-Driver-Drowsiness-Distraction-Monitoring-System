#include "../../include/devices/buzzer.h"

Buzzer::Buzzer(uint8_t pin) {
    this->pin = pin;
    thoiGianThayDoi = 0;
}

void Buzzer::begin() {
    pinMode(pin, OUTPUT);
    noTone(pin);
}

void Buzzer::capNhat(char trangThai, unsigned long thoiGianHienTai) {
    if (trangThai == 'F') {
        if (thoiGianHienTai - thoiGianThayDoi >= 1000) {
            thoiGianThayDoi = thoiGianHienTai;

            tone(pin, 2000, 100);
        }
    }
    else if (trangThai == 'D') {
        tone(pin, 4000);
    }
    else {
        noTone(pin);
    }
}

void Buzzer::tat() {
    noTone(pin);
}