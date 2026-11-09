# KSafe AI Dashboard

Giao dien Dashboard HTML, CSS va JavaScript thuần.

## Chay local

Mo thu muc `web` bang VS Code, cai extension Live Server, sau do mo `index.html` bang Live Server.

## Ket noi ESP32

1. Nap firmware ESP32 co cac API:
   - `GET /api/status`
   - `POST /api/state` voi JSON `{"state":"S"}`, `{"state":"F"}` hoac `{"state":"D"}`
   - `POST /api/reset/ack`
2. Ket noi may tinh va ESP32 vao cung mang Wi-Fi.
3. Mo trang Settings, nhap dia chi ESP32, vi du `http://192.168.1.123`.
4. Chon **Test connection**. Khi API tra ve JSON hop le, Dashboard moi bao da ket noi.
5. Trang Overview tu dong doc `/api/status` moi 2.5 giay.

## Luong du lieu

- Python AI la ben quyet dinh trang thai SAFE / FOCUS / DANGER va gui `POST /api/state` den ESP32.
- ESP32 dieu khien LED, buzzer, LCD/OLED va tra trang thai hien tai cho Web.
- Web chi doc trang thai tu ESP32; khong tu gia lap trang thai AI khi ESP32 offline.
- Nut reset tren ESP32 tao `resetRequested=true`. Python can doc co nay, tu xac minh dieu kien an toan, sau do moi gui `POST /api/reset/ack`.

## Luu y

- Dia chi IP trong Settings duoc luu trong localStorage cua trinh duyet.
- Neu trinh duyet bao loi CORS, kiem tra ESP32 da xu ly OPTIONS va gui cac header `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`.
- Day la frontend local; chua co Node.js backend, database, camera stream hoac ket noi WebSocket.
