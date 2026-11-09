
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

    // Bien dieu khien mat robot
    int pupilOffsetX;
    int huongMat;
    int eyeHeight;

    // Trang thai animation chop mat
    int giaiDoanChop;
    bool dangChopMat;

    // Thoi gian animation
    unsigned long lanCapNhatMat;
    unsigned long lanCapNhatHuong;
    unsigned long thoiGianChopTiepTheo;

    bool kiemTraI2C(uint8_t diaChi);

    void veMat(int x, int y, int offsetX, int offsetY, int eyeHeight);
    void veHaiMat(int offsetX, int offsetY, int eyeHeight);

    void hienThiLCD(char trangThai);
    void capNhatOLED();

public:
    LCD(uint8_t diaChi, uint8_t soCot, uint8_t soDong);

    void begin();

    void hienThiTrangThai(char trangThai);

    // Goi lien tuc trong loop de chay animation
    void capNhat();
};

#endif
