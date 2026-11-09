#include "../../include/devices/rgb_led.h"

RGBLed::RGBLed(
    uint8_t chanDo,
    uint8_t chanXanhDuong,
    uint8_t chanXanhLa
) {
    this->chanDo = chanDo;
    this->chanXanhDuong = chanXanhDuong;
    this->chanXanhLa = chanXanhLa;
}

void RGBLed::begin() {
    pinMode(chanDo, OUTPUT);
    pinMode(chanXanhDuong, OUTPUT);
    pinMode(chanXanhLa, OUTPUT);

    digitalWrite(chanDo, LOW);
    digitalWrite(chanXanhDuong, LOW);
    digitalWrite(chanXanhLa, HIGH);
}

void RGBLed::hienThiTrangThai(char trangThai) {
    if (trangThai == 'S') {
        // SAFE: xanh lá
        digitalWrite(chanDo, LOW);
        digitalWrite(chanXanhDuong, LOW);
        digitalWrite(chanXanhLa, HIGH);
    }
    else if (trangThai == 'F') {
        // FOCUS: vàng = đỏ + xanh lá
        digitalWrite(chanDo, HIGH);
        digitalWrite(chanXanhDuong, LOW);
        digitalWrite(chanXanhLa, HIGH);
    }
    else if (trangThai == 'D') {
        // DANGER: đỏ
        digitalWrite(chanDo, HIGH);
        digitalWrite(chanXanhDuong, LOW);
        digitalWrite(chanXanhLa, LOW);
    }
}