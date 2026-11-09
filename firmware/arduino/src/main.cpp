#include <Arduino.h>

#include "../include/devices/button.h"
#include "../include/devices/lcd.h"
#include "../include/devices/rgb_led.h"
#include "../include/devices/buzzer.h"
#include "../include/services/state_controller.h"

#define LED_RED 10
#define LED_BLUE 9
#define LED_GREEN 8
#define BUZZER_PIN 7
#define BUTTON_PIN 6

LCD lcd(0x27, 16, 2);
RGBLed rgbLed(LED_RED, LED_BLUE, LED_GREEN);
Buzzer buzzer(BUZZER_PIN);
Button button(BUTTON_PIN);

StateController stateController(
    lcd,
    rgbLed,
    buzzer
);

void setup() {
    Serial.begin(9600);

    lcd.begin();
    rgbLed.begin();
    buzzer.begin();
    button.begin();

    stateController.capNhatTrangThai('S');
}

void loop() {
    unsigned long thoiGianHienTai = millis();

    // Doc trang thai tu Python
    if (Serial.available() > 0) {
        char trangThai = Serial.read();

        if (
            trangThai == 'S' ||
            trangThai == 'F' ||
            trangThai == 'D'
        ) {
            stateController.capNhatTrangThai(trangThai);
        }
    }

    // Cap nhat animation mat OLED
    lcd.capNhat();

    // Cap nhat am thanh canh bao
    stateController.capNhatBuzzer(thoiGianHienTai);

    // Xu ly nut nhan reset
    if (button.vuaNhan()) {
        Serial.println("R");
    }
}