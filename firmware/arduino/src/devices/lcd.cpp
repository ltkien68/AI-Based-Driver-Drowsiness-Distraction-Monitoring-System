
#include "../../include/devices/lcd.h"

#define EYE_WIDTH 42
#define EYE_HEIGHT 38

#define LEFT_EYE_X 17
#define RIGHT_EYE_X 69
#define EYE_Y 13

LCD::LCD(uint8_t diaChi, uint8_t soCot, uint8_t soDong)
    : lcd(diaChi, soCot, soDong),
      oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1) {

    coLCD = false;
    coOLED = false;

    pupilOffsetX = 0;
    huongMat = 0;
    eyeHeight = EYE_HEIGHT;

    dangChopMat = false;
    giaiDoanChop = 0;

    lanCapNhatMat = 0;
    lanCapNhatHuong = 0;
    thoiGianChopTiepTheo = 0;
}

bool LCD::kiemTraI2C(uint8_t diaChi) {
    Wire.beginTransmission(diaChi);
    return Wire.endTransmission() == 0;
}

void LCD::begin() {
    Wire.begin();

    // Khoi tao LCD 16x2
    if (kiemTraI2C(0x27)) {
        lcd.init();
        lcd.backlight();
        lcd.clear();

        coLCD = true;
    }

    // Khoi tao OLED
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

    // Khoi tao animation
    randomSeed(micros());

    thoiGianChopTiepTheo = millis() + random(2500, 5500);

    if (coOLED) {
        oled.clearDisplay();
        veHaiMat(0, 0, EYE_HEIGHT);
    }

    hienThiTrangThai('S');
}



void LCD::veMat(
    int x,
    int y,
    int offsetX,
    int offsetY,
    int eyeHeight
) {
    int viTriY = y + (EYE_HEIGHT - eyeHeight) / 2;
    int banKinh = min(12, eyeHeight / 2);

    // Ve mat trang, khong co dong tu
    oled.fillRoundRect(
        x,
        viTriY,
        EYE_WIDTH,
        eyeHeight,
        banKinh,
        SSD1306_WHITE
    );
}


void LCD::veHaiMat(
    int offsetX,
    int offsetY,
    int eyeHeight
) {
    oled.clearDisplay();

    veMat(
        LEFT_EYE_X,
        EYE_Y,
        offsetX,
        offsetY,
        eyeHeight
    );

    veMat(
        RIGHT_EYE_X,
        EYE_Y,
        offsetX,
        offsetY,
        eyeHeight
    );

    oled.display();
}

void LCD::hienThiTrangThai(char trangThai) {
    if (coLCD) {
        hienThiLCD(trangThai);
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

void LCD::capNhatOLED() {
    if (!coOLED) {
        return;
    }

    unsigned long hienTai = millis();

    bool canVeLai = false;

    if (!dangChopMat &&
        hienTai - lanCapNhatHuong >= 35) {

        lanCapNhatHuong = hienTai;

        // Thay doi huong nhin ngau nhien
        if (hienTai >= thoiGianChopTiepTheo - 2000 &&
            huongMat == 0) {

            huongMat = random(-6, 7);
        }

        // Di chuyen dong tu muot den huong dich
        if (pupilOffsetX < huongMat) {
            pupilOffsetX++;
            canVeLai = true;
        }
        else if (pupilOffsetX > huongMat) {
            pupilOffsetX--;
            canVeLai = true;
        }

        // Doi huong nhin sau mot khoang thoi gian
        static unsigned long lanDoiHuong = 0;

        if (hienTai - lanDoiHuong >= random(1200, 2800)) {
            lanDoiHuong = hienTai;
            huongMat = random(-6, 7);
        }
    }

    if (!dangChopMat &&
        hienTai >= thoiGianChopTiepTheo) {

        dangChopMat = true;
        giaiDoanChop = 1;

        lanCapNhatMat = hienTai;
    }

    if (dangChopMat &&
        hienTai - lanCapNhatMat >= 18) {

        lanCapNhatMat = hienTai;

        if (giaiDoanChop == 1) {

            // Dong mat
            eyeHeight -= 6;

            if (eyeHeight <= 4) {
                eyeHeight = 4;
                giaiDoanChop = 2;
            }

        }
        else if (giaiDoanChop == 2) {

            // Mo mat
            eyeHeight += 6;

            if (eyeHeight >= EYE_HEIGHT) {
                eyeHeight = EYE_HEIGHT;

                dangChopMat = false;
                giaiDoanChop = 0;

                // Lan chop tiep theo
                thoiGianChopTiepTheo =
                    hienTai + random(2500, 5500);
            }
        }

        canVeLai = true;
    }

    if (canVeLai) {
        veHaiMat(
            pupilOffsetX,
            0,
            eyeHeight
        );
    }
}

void LCD::capNhat() {
    capNhatOLED();
}
