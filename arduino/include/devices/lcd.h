#ifndef LCD_H
#define LCD_H

#include <Arduino.h>
#include <LiquidCrystal_I2C.h>

class LCD {
private:
    LiquidCrystal_I2C lcd;

public:
    LCD(uint8_t diaChi, uint8_t soCot, uint8_t soDong);

    void begin();

    void hienThiTrangThai(char trangThai);
};

#endif