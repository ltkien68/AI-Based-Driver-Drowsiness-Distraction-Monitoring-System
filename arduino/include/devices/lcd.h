#ifndef LCD_H
#define LCD_H

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define OLED_WIDTH 128
#define OLED_HEIGHT 64

class LCD {
private:
    LiquidCrystal_I2C lcd;

    Adafruit_SSD1306 oled;

    bool coLCD;
    bool coOLED;

    bool kiemTraI2C(uint8_t diaChi);

    void hienThiLCD(char trangThai);
    void hienThiOLED(char trangThai);

public:
    LCD(uint8_t diaChi, uint8_t soCot, uint8_t soDong);

    void begin();

    void hienThiTrangThai(char trangThai);
};

#endif