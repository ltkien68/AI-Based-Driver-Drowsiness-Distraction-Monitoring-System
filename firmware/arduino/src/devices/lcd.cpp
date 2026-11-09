
#include "../../include/devices/lcd.h"

#define EYE_WIDTH 34
#define EYE_HEIGHT 28

#define LEFT_EYE_X 22
#define RIGHT_EYE_X 72
#define EYE_Y 4

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

    trangThaiOLED = 'S';
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
        coOLED = oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
    }
    else if (kiemTraI2C(0x3D)) {
        coOLED = oled.begin(SSD1306_SWITCHCAPVCC, 0x3D);
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

// Ve mot mat robot
void LCD::veMat(
    int x,
    int y,
    int offsetX,
    int offsetY,
    int eyeHeight
) {
    int viTriY = y + (EYE_HEIGHT - eyeHeight) / 2;
    int banKinh = min(9, eyeHeight / 2);

    // Ve mat trang voi hinh dang bo tron
    oled.fillRoundRect(
        x,
        viTriY,
        EYE_WIDTH,
        eyeHeight,
        banKinh,
        SSD1306_WHITE
    );
}

// Ve hai mat va trang thai
void LCD::veHaiMat(
    int offsetX,
    int offsetY,
    int eyeHeight
) {
    oled.clearDisplay();

    // Ve mat trai
    veMat(
        LEFT_EYE_X,
        EYE_Y,
        offsetX,
        offsetY,
        eyeHeight
    );

    // Ve mat phai
    veMat(
        RIGHT_EYE_X,
        EYE_Y,
        offsetX,
        offsetY,
        eyeHeight
    );

    // Hien thi trang thai ben duoi mat
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);
    oled.setTextWrap(false);

    const char* noiDung;

    if (trangThaiOLED == 'S') {
        noiDung = "SAFE";
    }
    else if (trangThaiOLED == 'F') {
        noiDung = "FOCUS!";
    }
    else {
        noiDung = "DANGER!!";
    }

    // Can giua dong trang thai
    int chieuRong = strlen(noiDung) * 6;
    int viTriX = (OLED_WIDTH - chieuRong) / 2;

    oled.setCursor(viTriX, 42);
    oled.print(noiDung);

    oled.display();
}

void LCD::hienThiTrangThai(char trangThai) {

    trangThaiOLED = trangThai;

    if (coLCD) {
        hienThiLCD(trangThai);
    }

    if (coOLED) {
        veHaiMat(
            pupilOffsetX,
            0,
            eyeHeight
        );
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

    // Bat dau chop mat
    if (!dangChopMat &&
        hienTai >= thoiGianChopTiepTheo) {

        dangChopMat = true;
        giaiDoanChop = 1;

        lanCapNhatMat = hienTai;
    }

    // Cap nhat animation chop mat
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

    // Ve lai OLED khi co thay doi
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
