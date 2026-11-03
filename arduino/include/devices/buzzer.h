#ifndef BUZZER_H
#define BUZZER_H

#include <Arduino.h>

class Buzzer {
private:
    uint8_t pin;

    unsigned long thoiGianThayDoi;

public:
    Buzzer(uint8_t pin);

    void begin();

    void capNhat(char trangThai, unsigned long thoiGianHienTai);

    void tat();
};

#endif