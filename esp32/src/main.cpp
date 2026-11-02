#include <Arduino.h>

#define BUTTON_PIN 18

bool trangThaiNutTruoc = HIGH;
unsigned long thoiGianBamTruoc = 0;
const unsigned long debounceDelay = 50;

void setup() {
    Serial.begin(115200);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
    bool trangThaiNutHienTai = digitalRead(BUTTON_PIN);
    unsigned long thoiGianHienTai = millis();

    if (trangThaiNutTruoc == HIGH && trangThaiNutHienTai == LOW) {
        if (millis() - thoiGianBamTruoc >= debounceDelay) {
            Serial.println("S");
            thoiGianBamTruoc = millis();
        }
    }
    
    trangThaiNutTruoc = trangThaiNutHienTai;
}