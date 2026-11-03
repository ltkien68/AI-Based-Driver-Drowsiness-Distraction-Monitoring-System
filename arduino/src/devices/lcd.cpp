#include "../../include/devices/lcd.h"

LCD::LCD(uint8_t diaChi, uint8_t soCot, uint8_t soDong)
    : lcd(diaChi, soCot, soDong) {
}

void LCD::begin() {
    lcd.init();
    lcd.backlight();

    lcd.clear();

    lcd.setCursor(0, 0);
    lcd.print("KSafe AI");

    lcd.setCursor(0, 1);
    lcd.print("Safe");
}

void LCD::hienThiTrangThai(char trangThai) {
    lcd.setCursor(0, 1);
    lcd.print("                ");

    lcd.setCursor(0, 1);

    if (trangThai == 'S') {
        lcd.print("Safe");
    }
    else if (trangThai == 'F') {
        lcd.print("Focus!");
    }
    else if (trangThai == 'D') {
        lcd.print("Danger!!");
    }
}