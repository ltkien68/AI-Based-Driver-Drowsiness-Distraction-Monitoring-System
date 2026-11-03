#include "../../include/services/state_controller.h"

StateController::StateController(
    LCD& lcd,
    RGBLed& rgbLed,
    Buzzer& buzzer
) : lcd(lcd), rgbLed(rgbLed), buzzer(buzzer) {
    trangThaiHienTai = 'S';
}

void StateController::capNhatTrangThai(char trangThai) {
    if (
        trangThai != 'S' &&
        trangThai != 'F' &&
        trangThai != 'D'
    ) {
        return;
    }

    trangThaiHienTai = trangThai;

    lcd.hienThiTrangThai(trangThaiHienTai);
    rgbLed.hienThiTrangThai(trangThaiHienTai);

    if (trangThaiHienTai == 'S') {
        buzzer.tat();
    }
}

void StateController::capNhatBuzzer(
    unsigned long thoiGianHienTai
) {
    buzzer.capNhat(
        trangThaiHienTai,
        thoiGianHienTai
    );
}

char StateController::layTrangThai() {
    return trangThaiHienTai;
}