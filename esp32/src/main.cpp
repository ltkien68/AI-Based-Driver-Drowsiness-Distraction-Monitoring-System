#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

#include "../include/devices/button.h"
#include "../include/devices/lcd.h"
#include "../include/devices/rgb_led.h"
#include "../include/devices/buzzer.h"
#include "../include/services/state_controller.h"

// ================= PIN ESP32 =================

#define LED_RED 25
#define LED_BLUE 26
#define LED_GREEN 27

#define BUZZER_PIN 14
#define BUTTON_PIN 13

// ================= WIFI =================
const char* WIFI_SSID = "TEN_WIFI";
const char* WIFI_PASSWORD = "MAT_KHAU_WIFI";

// ================= OBJECT =================

LCD lcd(0x27, 16, 2);

RGBLed rgbLed(
    LED_RED,
    LED_BLUE,
    LED_GREEN
);

Buzzer buzzer(BUZZER_PIN);

Button button(BUTTON_PIN);

StateController stateController(
    lcd,
    rgbLed,
    buzzer
);

// HTTP Server
WebServer server(80);

// ================= SYSTEM STATE =================

char trangThaiHienTai = 'S';

bool yeuCauReset = false;

unsigned long thoiGianHienTai = 0;

// ================= WIFI =================

void ketNoiWiFi() {
    Serial.println();
    Serial.println("Dang ket noi WiFi...");

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long batDau = millis();

    while (
        WiFi.status() != WL_CONNECTED &&
        millis() - batDau < 20000
    ) {
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.println("WiFi connected!");

        Serial.print("ESP32 IP: ");
        Serial.println(WiFi.localIP());
    }
    else {
        Serial.println();
        Serial.println("Khong the ket noi WiFi!");
    }
}

// ================= CORS =================

void themCORS() {
    server.sendHeader(
        "Access-Control-Allow-Origin",
        "*"
    );

    server.sendHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );

    server.sendHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );
}

// ================= HTTP API =================

// OPTIONS: Cho phep website goi API
void xuLyOptions() {
    themCORS();
    server.send(204);
}

// GET /api/status
void layTrangThai() {
    themCORS();

    String json = "{";

    json += "\"state\":\"";
    json += trangThaiHienTai;
    json += "\",";

    json += "\"wifi\":true,";

    json += "\"resetRequested\":";
    json += yeuCauReset ? "true" : "false";

    json += "}";

    server.send(
        200,
        "application/json",
        json
    );
}

// POST /api/state
// Body: S hoặc F hoặc D
void capNhatTrangThai() {
    themCORS();

    String duLieu = server.arg("plain");

    duLieu.trim();

    if (duLieu.length() == 0) {
        server.send(
            400,
            "application/json",
            "{\"error\":\"Empty state\"}"
        );

        return;
    }

    // Ho tro JSON: {"state":"D"}
    if (duLieu.startsWith("{")) {
        int viTri = duLieu.indexOf("\"state\"");

        if (viTri >= 0) {
            int dauHaiCham = duLieu.indexOf(
                ':',
                viTri
            );

            int dauNgoac = duLieu.indexOf(
                '"',
                dauHaiCham
            );

            int dauNgoacDong = duLieu.indexOf(
                '"',
                dauNgoac + 1
            );

            if (
                dauHaiCham >= 0 &&
                dauNgoac >= 0 &&
                dauNgoacDong > dauNgoac
            ) {
                duLieu = duLieu.substring(
                    dauNgoac + 1,
                    dauNgoacDong
                );
            }
        }
    }

    if (duLieu.length() == 0) {
        server.send(
            400,
            "application/json",
            "{\"error\":\"Invalid state\"}"
        );

        return;
    }

    char trangThai = duLieu.charAt(0);

    if (
        trangThai != 'S' &&
        trangThai != 'F' &&
        trangThai != 'D'
    ) {
        server.send(
            400,
            "application/json",
            "{\"error\":\"Invalid state\"}"
        );

        return;
    }

    trangThaiHienTai = trangThai;

    stateController.capNhatTrangThai(
        trangThaiHienTai
    );

    Serial.print("Trang thai moi: ");
    Serial.println(trangThaiHienTai);

    server.send(
        200,
        "application/json",
        "{\"success\":true}"
    );
}

// POST /api/reset/ack
// Python goi sau khi da xu ly yeu cau reset
void xacNhanReset() {
    themCORS();

    yeuCauReset = false;

    server.send(
        200,
        "application/json",
        "{\"success\":true}"
    );
}

// Dang ky cac API
void khoiTaoHTTP() {
    server.on(
        "/api/status",
        HTTP_GET,
        layTrangThai
    );

    server.on(
        "/api/status",
        HTTP_OPTIONS,
        xuLyOptions
    );

    server.on(
        "/api/state",
        HTTP_POST,
        capNhatTrangThai
    );

    server.on(
        "/api/state",
        HTTP_OPTIONS,
        xuLyOptions
    );

    server.on(
        "/api/reset/ack",
        HTTP_POST,
        xacNhanReset
    );

    server.on(
        "/api/reset/ack",
        HTTP_OPTIONS,
        xuLyOptions
    );

    server.begin();

    Serial.println("HTTP Server started!");
}

// ================= BUTTON =================

void xuLyButton() {
    if (button.vuaNhan()) {
        yeuCauReset = true;

        Serial.println("RESET REQUESTED");
    }
}

// ================= SETUP =================

void setup() {
    Serial.begin(115200);

    // Khoi tao thiet bi
    lcd.begin();

    rgbLed.begin();

    buzzer.begin();

    button.begin();

    // Trang thai mac dinh
    trangThaiHienTai = 'S';

    stateController.capNhatTrangThai('S');

    // Ket noi WiFi
    ketNoiWiFi();

    // Khoi tao HTTP Server
    if (WiFi.status() == WL_CONNECTED) {
        khoiTaoHTTP();
    }
}

// ================= LOOP =================

void loop() {
    thoiGianHienTai = millis();

    // Xu ly HTTP
    if (WiFi.status() == WL_CONNECTED) {
        server.handleClient();
    }

    // Cap nhat buzzer
    stateController.capNhatBuzzer(
        thoiGianHienTai
    );

    // Xu ly button
    xuLyButton();
}
