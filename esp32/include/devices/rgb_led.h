#ifndef RGB_LED_H
#define RGB_LED_H

#include <Arduino.h>

class RGBLed {
private:
    uint8_t chanDo;
    uint8_t chanXanhDuong;
    uint8_t chanXanhLa;

public:
    RGBLed(
        uint8_t chanDo,
        uint8_t chanXanhDuong,
        uint8_t chanXanhLa
    );

    void begin();

    void hienThiTrangThai(char trangThai);
};

#endif