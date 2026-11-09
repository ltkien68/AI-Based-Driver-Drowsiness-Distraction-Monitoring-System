# KSafe AI – Driver Monitoring Dashboard

Giao diện web giám sát hệ thống **KSafe AI** (cảnh báo tài xế buồn ngủ / mất tập trung bằng AI).
Thuần HTML5 + CSS3 + JavaScript Vanilla, không framework, không cần build. Chạy được trong mạng LAN không có Internet.

## Chạy thử

Cách nhanh nhất: mở `index.html` bằng trình duyệt (Chrome/Edge).
Khuyến nghị chạy qua một HTTP server nhỏ để dùng được webcam trình duyệt:

```bash
cd KSafe-AI-Web
python -m http.server 8080      # rồi mở http://localhost:8080
```

## Ngôn ngữ (Tiếng Việt / English)

- Mặc định **Tiếng Việt**. Bấm **VI | EN** ở góc phải thanh header để đổi; lựa chọn được lưu trong trình duyệt.
- Toàn bộ nội dung (menu, thẻ, bảng, biểu đồ, thông báo, form, lỗi) đều được dịch.
- Cơ chế: HTML/JS giữ chuỗi tiếng Anh làm khoá gốc; `assets/js/lang/vi.js` chứa từ điển và các mẫu regex;
  `assets/js/i18n.js` dịch DOM và tự dịch cả nội dung do JS render sau đó (MutationObserver).
- **Thêm / sửa bản dịch:** sửa `dict` hoặc `patterns` trong `lang/vi.js`. Mở console và gọi `KI18n.misses()` để xem chuỗi nào còn chưa được dịch.
- **Thêm ngôn ngữ khác:** tạo `lang/xx.js` gọi `KI18n.register('xx', {...})`, nạp trước `main.js`, thêm nút trong `components.js`.
- Giữ nguyên thuật ngữ kỹ thuật: SAFE / FOCUS / DANGER, EAR, Pitch / Yaw / Roll, ESP32, Wi-Fi, MediaPipe, DEMO / REAL.

## DEMO và REAL

| | DEMO | REAL |
|---|---|---|
| Nguồn | Mô phỏng ngay trong trình duyệt (kịch bản lặp 120 giây) | Đọc từ ESP32 và dịch vụ Python AI |
| Khi mất kết nối | – | Hiển thị Offline / "—", **không bịa số liệu** |
| Nhận biết | Banner vàng + nhãn `DEMO` trên mọi khối | Banner xanh + nhãn `REAL` |

Đổi ở **Cài đặt → Nguồn dữ liệu** hoặc menu avatar. Lịch sử cảnh báo của hai nguồn được lưu tách biệt.

## Cấu trúc

```
KSafe-AI-Web/
├── index.html                 Overview
├── pages/                     monitoring · devices · alerts · analytics · settings
└── assets/
    ├── css/
    │   ├── variables.css      màu, bo góc, shadow (design tokens)
    │   ├── style.css          reset, sidebar, header, component dùng chung
    │   ├── dashboard.css      thẻ trạng thái, camera, chỉ số AI, safety, thiết bị
    │   ├── pages.css          riêng từng trang chức năng
    │   └── responsive.css     1280 / 1024 / 640 px
    └── js/
        ├── icons.js           bộ icon Lucide nhúng sẵn (chạy offline)
        ├── i18n.js            engine đa ngôn ngữ
        ├── lang/vi.js         từ điển tiếng Việt
        ├── api.js             tầng dữ liệu: DEMO/REAL, settings, cảnh báo, gọi ESP32
        ├── charts.js          biểu đồ SVG (line, bar, donut)
        ├── components.js      khung trang + component dùng chung
        ├── main.js            khởi động
        └── dashboard.js · monitoring.js · devices.js · alerts.js · analytics.js · settings.js
```

## Tích hợp phần cứng (giai đoạn tiếp theo)

Mọi trang chỉ đọc một "snapshot" từ `KSafe.onSnapshot()`, nên đổi nguồn dữ liệu chỉ cần sửa `api.js`.

**ESP32 (HTTP server trong LAN)**

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/status` | Trạng thái thiết bị |
| POST | `/api/state` | Body `{"state":"SAFE\|FOCUS\|DANGER"}` |
| POST | `/api/reset/ack` | Xác nhận reset sau DANGER |

`/api/status` nên trả JSON, ví dụ (field nào thiếu sẽ hiển thị "Chưa báo cáo", không bịa):

```json
{ "device_id": "KSAFE-01", "firmware": "1.0.0", "uptime_s": 5025, "state": "SAFE",
  "wifi": { "connected": true, "ssid": "MyLAN", "rssi": -58 },
  "led": { "color": "green" }, "buzzer": { "active": false },
  "oled": { "ok": true, "text": "SAFE" }, "lcd": { "ok": true, "text": "KSAFE AI" },
  "button": { "reset_pending": false } }
```

**Python AI** (địa chỉ cấu hình ở *API endpoint*)

- `GET /api/ai/status` → `{ "online": true, "fps": 29.8, "face_detected": true, "ear": 0.31, "pitch": 2, "yaw": -3, "roll": 1, "gaze": "Center", "state": "SAFE", "face_box": {"x":0.35,"y":0.15,"w":0.3,"h":0.6} }`
  Nếu không gửi `state`, dashboard tự phân loại theo ngưỡng trong Cài đặt.
- `GET /video_feed` → luồng MJPEG cho khung camera (chọn *Nguồn camera = MJPEG*).

**Bắt buộc:** ESP32 và dịch vụ Python phải trả header `Access-Control-Allow-Origin: *` (và xử lý `OPTIONS` cho các lệnh POST), nếu không trình duyệt sẽ chặn do CORS.

**WebSocket:** viết một nguồn mới rồi gọi `KSafe.ingest(snapshot)` mỗi khi có dữ liệu; phần giao diện không cần thay đổi.

## Ghi chú

- Cảnh báo và thống kê lưu trong trình duyệt (`localStorage` / `sessionStorage`), có thể xóa ở *Cài đặt → Dữ liệu đã lưu*.
- Khung camera chỉ hiển thị video thật (luồng MJPEG hoặc webcam). Khi chưa có nguồn, đó là placeholder; không có video giả. Vùng khuôn mặt nét đứt ở chế độ DEMO chỉ mang tính minh họa và được ghi rõ.
- Webcam trình duyệt yêu cầu `https` hoặc `localhost`.
- Xuất CSV giữ tên sự kiện bằng tiếng Anh để dễ xử lý bằng máy.
