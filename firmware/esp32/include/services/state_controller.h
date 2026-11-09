#ifndef STATE_CONTROLLER_H
#define STATE_CONTROLLER_H

#include <Arduino.h>

#include "../devices/lcd.h"
#include "../devices/rgb_led.h"
#include "../devices/buzzer.h"

class StateController {
private:
    LCD& lcd;
    RGBLed& rgbLed;
    Buzzer& buzzer;

    char trangThaiHienTai;

public:
    StateController(
        LCD& lcd,
        RGBLed& rgbLed,
        Buzzer& buzzer
    );

    void capNhatTrangThai(char trangThai);

    void capNhatBuzzer(unsigned long thoiGianHienTai);

    char layTrangThai();
};

#endif