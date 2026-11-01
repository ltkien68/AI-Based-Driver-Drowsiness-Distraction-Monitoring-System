# 🚗 DriveGuard AI
### AI-Based Driver Drowsiness & Distraction Monitoring System

**DriveGuard AI** là hệ thống giám sát và cảnh báo tài xế ngủ gật, buồn ngủ và mất tập trung khi lái xe. Hệ thống kết hợp **Computer Vision / AI** trên máy tính với **Arduino UNO** để phân tích trạng thái tài xế và đưa ra cảnh báo theo từng mức độ nguy hiểm.

Camera trên máy tính liên tục ghi hình khuôn mặt tài xế. Mô hình AI sử dụng **Facial Landmarks** để phân tích trạng thái mắt và hướng đầu, từ đó xác định tài xế đang lái xe bình thường, mất tập trung hoặc có dấu hiệu ngủ gật.

Kết quả phân tích được gửi từ máy tính xuống Arduino UNO thông qua **giao tiếp Serial**. Arduino đóng vai trò điều khiển các thiết bị cảnh báo như **LCD, LED RGB, Buzzer và động cơ DC**.

---

## 🎯 Mục tiêu

- Phát hiện tình trạng **nhắm mắt kéo dài / ngủ gật**.
- Phát hiện tình trạng **quay mặt, nhìn sang hướng khác / mất tập trung**.
- Cảnh báo tài xế theo nhiều mức độ.
- Kết hợp **AI, Computer Vision và hệ thống nhúng** trong một hệ thống IoT hoàn chỉnh.
- Thực hiện giao tiếp giữa máy tính chạy AI và Arduino thông qua **Serial Communication**.

---

## ⚙️ Cơ chế hoạt động

```text
                 CAMERA
                    │
                    ▼
        ┌─────────────────────┐
        │   Computer / PC     │
        │                     │
        │ OpenCV + AI         │
        │ Facial Landmarks    │
        └──────────┬──────────┘
                   │
              Serial UART
                   │
                   ▼
        ┌─────────────────────┐
        │     Arduino UNO     │
        └──────────┬──────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
       LCD      RGB LED     Buzzer
                              │
                              ▼
                          DC Motor
```

### Trạng thái hệ thống

| Trạng thái | Điều kiện | LED RGB | LCD | Buzzer | DC Motor |
|---|---|---|---|---|---|
| 🟢 **Safe Driving** | Tài xế tỉnh táo, nhìn bình thường | Xanh | `Safe Driving` | Tắt | Tắt |
| 🟡 **Stay Focused** | Tài xế nhìn sang hướng khác | Vàng | `Stay Focused` | Tít tít ngắn | Tắt |
| 🔴 **Danger** | Nhắm mắt quá 2 giây / phát hiện ngủ gật | Đỏ chớp | `DANGER! WAKE UP` | Cảnh báo lớn | Quay mạnh |

Khi hệ thống phát hiện trạng thái **Danger**, cảnh báo sẽ được duy trì cho đến khi tài xế nhìn thẳng lại camera và nhấn nút **Reset** trên mạch.

---

## 🧠 Công nghệ sử dụng

### Computer Vision & AI

- **Python**
- **OpenCV**
- **MediaPipe**
- **Facial Landmarks**
- Face Detection
- Eye State Detection
- Head Pose / Head Direction Detection

### Embedded System

- **Arduino UNO**
- **C/C++**
- Digital I/O
- PWM
- Serial Communication

### Communication

- **UART / Serial Communication**
- Giao tiếp giữa máy tính chạy AI và Arduino UNO

---

## 🔌 Thiết bị sử dụng

> Phần này sẽ được bổ sung sau.

### Danh sách thiết bị

- Arduino UNO
- Cảm biến khoảng cách Sonar
- Động cơ DC
- LCD
- Buzzer
- LED RGB
- Nút nhấn Reset
- Camera
- Các linh kiện phụ trợ

---

## 🔧 Sơ đồ mạch

> **TODO:** Bổ sung sơ đồ mạch sau khi hoàn thành đấu nối phần cứng.

```text
[ SƠ ĐỒ MẠCH SẼ ĐƯỢC BỔ SUNG TẠI ĐÂY ]
```

---

## 💻 Cấu trúc dự án

```text
DriveGuard_AI/
│
├── main.py
│
├── ai/
│   └── ...
│
├── arduino/
│   └── ...
│
├── hardware/
│   └── ...
│
└── README.md
```

> Cấu trúc thư mục sẽ được cập nhật trong quá trình phát triển dự án.

---


## 👨‍💻 Project

**Project:** KSafe AI  
**Type:** IoT / Embedded / Computer Vision / Edge AI  
**Platform:** Python + Arduino UNO  
**Status:** 🚧 In Development

