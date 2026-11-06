#include "../../include/devices/lcd.h"

LCD::LCD(uint8_t diaChi, uint8_t soCot, uint8_t soDong)
    : lcd(diaChi, soCot, soDong),
      oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1) {

    coLCD = false;
    coOLED = false;
}

bool LCD::kiemTraI2C(uint8_t diaChi) {
    Wire.beginTransmission(diaChi);

    return Wire.endTransmission() == 0;
}

void LCD::begin() {
    Wire.begin();

    if (kiemTraI2C(0x27)) {
        lcd.init();
        lcd.backlight();
        lcd.clear();

        coLCD = true;
    }

    if (kiemTraI2C(0x3C)) {
        coOLED = oled.begin(
            SSD1306_SWITCHCAPVCC,
            0x3C
        );
    }
    else if (kiemTraI2C(0x3D)) {
        coOLED = oled.begin(
            SSD1306_SWITCHCAPVCC,
            0x3D
        );
    }

    hienThiTrangThai('S');
}

void LCD::hienThiTrangThai(char trangThai) {
    if (coLCD) {
        hienThiLCD(trangThai);
    }

    if (coOLED) {
        hienThiOLED(trangThai);
    }
}

void LCD::hienThiLCD(char trangThai) {
    lcd.setCursor(0, 0);
    lcd.print("KSafe AI        ");

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

void LCD::hienThiOLED(char trangThai) {
    oled.clearDisplay();

    oled.setTextColor(SSD1306_WHITE);

    oled.setTextSize(2);
    oled.setCursor(10, 5);
    oled.println("KSafe AI");

    oled.drawLine(0, 30, 127, 30, SSD1306_WHITE);

    // Trạng thái
    oled.setTextSize(2);
    oled.setCursor(10, 40);

    if (trangThai == 'S') {
        oled.println("SAFE");
    }
    else if (trangThai == 'F') {
        oled.println("FOCUS!");
    }
    else if (trangThai == 'D') {
        oled.println("DANGER!");
    }

    oled.display();
}