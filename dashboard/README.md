# KSafe AI – Driver Monitoring Dashboard

Giao diện web giám sát hệ thống **KSafe AI** (cảnh báo tài xế buồn ngủ / mất tập trung bằng AI).
Thuần HTML5 + CSS3 + JavaScript Vanilla, không framework, không cần build. Chạy bằng VS Code Live Server hoặc HTTP server. MQTT.js được tải qua CDN nên cần Internet khi mở Dashboard.

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
- Giữ nguyên thuật ngữ kỹ thuật: SAFE / FOCUS / DANGER, EAR, Pitch / Yaw / Roll, Arduino Uno, MQTT, MediaPipe, DEMO / REAL.

## DEMO và REAL

| | DEMO | REAL |
|---|---|---|
| Nguồn | Mô phỏng ngay trong trình duyệt (kịch bản lặp 120 giây) | Python AI Engine publish MQTT qua Mosquitto WebSocket |
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
        ├── api.js             tầng snapshot: DEMO/REAL, settings, cảnh báo, event bus
        ├── mqtt.js            MQTT.js client: WebSocket, xác thực, subscribe, heartbeat
        ├── charts.js          biểu đồ SVG (line, bar, donut)
        ├── components.js      khung trang + component dùng chung
        ├── main.js            khởi động
        └── dashboard.js · monitoring.js · devices.js · alerts.js · analytics.js · settings.js
```

## Nguồn dữ liệu REAL qua MQTT

Dashboard sử dụng MQTT.js trên trình duyệt, kết nối Mosquitto qua WebSocket:

- Broker: `ws://127.0.0.1:9001` (khi Dashboard và Mosquitto chạy cùng máy).
- Username: `ksafe`.
- Mật khẩu được nhập tại hộp thoại kết nối. Sau khi xác thực thành công, thông tin đăng nhập được lưu trong `sessionStorage` của tab hiện tại để các trang HTML trong cùng tab tự kết nối lại.
- Không ghi mật khẩu vào source code hoặc `localStorage`. Khi đóng tab, phiên `sessionStorage` kết thúc.
- Có thể xóa thông tin đăng nhập và ngắt MQTT tại **Cài đặt → MQTT session → Log out MQTT and clear saved credentials**.
- Khi triển khai từ máy khác trong LAN, thay `127.0.0.1` trong `assets/js/mqtt.js` bằng IP LAN của máy chạy Mosquitto.

### MQTT topics

| Topic | Payload | Ý nghĩa |
|---|---|---|
| `ksafe/driver/state` | `SAFE`, `FOCUS`, `DANGER`, `UNKNOWN` | Trạng thái do Python State Manager quyết định |
| `ksafe/driver/metrics` | JSON gồm `ear`, `head_pose.pitch/yaw/roll`, `eye_direction`, `timestamp` | Metrics AI thực tế |
| `ksafe/system/connection` | `ONLINE` / `OFFLINE` | Trạng thái kết nối Python |
| `ksafe/system/heartbeat` | JSON gồm `status`, `timestamp` | Heartbeat Python; quá 15 giây được xem là cũ |

`mqtt.js` chuyển payload thành snapshot rồi gọi `KSafe.ingest(snapshot)`. Các trang tiếp tục cập nhật qua `KSafe.onSnapshot()`; không polling HTTP thiết bị trong luồng REAL MQTT. Trạng thái Python ONLINE chỉ được xác nhận khi nhận heartbeat còn mới. Arduino Uno nhận lệnh từ Python AI Engine qua Serial. Dashboard hiện chưa có topic telemetry phản hồi Arduino nên hiển thị rõ trạng thái chưa có phản hồi, không suy ra Arduino Online từ kết nối MQTT.

**Lưu ý bảo mật:** `ws://` không mã hóa lưu lượng. Cấu hình hiện tại chỉ dành cho thử nghiệm trong LAN tin cậy; khi triển khai thực tế cần WSS/TLS, giới hạn ACL và đổi mật khẩu MQTT đã từng bị lộ.

## Phần cứng Arduino Uno\n\n- Arduino Uno nhận trạng thái SAFE / FOCUS / DANGER từ Python AI Engine qua Serial.\n- Các ngoại vi trong mô hình gồm LCD, LED RGB, buzzer, động cơ rung, cảm biến siêu âm và nút Reset.\n- Dashboard không gửi lệnh trực tiếp tới Arduino và không giả lập trạng thái phần cứng trong chế độ REAL.\n\n## Ghi chú

- Cảnh báo và thống kê lưu trong trình duyệt (`localStorage` / `sessionStorage`), có thể xóa ở *Cài đặt → Dữ liệu đã lưu*.
- Khung camera chỉ hiển thị video thật (luồng MJPEG hoặc webcam). Khi chưa có nguồn, đó là placeholder; không có video giả. Vùng khuôn mặt nét đứt ở chế độ DEMO chỉ mang tính minh họa và được ghi rõ.
- Webcam trình duyệt yêu cầu `https` hoặc `localhost`.
- Xuất CSV giữ tên sự kiện bằng tiếng Anh để dễ xử lý bằng máy.
