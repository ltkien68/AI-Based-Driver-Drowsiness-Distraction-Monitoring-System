import cv2
import mediapipe as mp
import time
import serial
import threading

from video_server import chay_video_server, update_frame
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from drowsiness_detector import DrowsinessDetector
from distraction_detector import DistractionDetector
from state_manager import StateManager
from mqtt_client import KSafeMQTTClient


# ==========================================
# CAU HINH HE THONG
# ==========================================

MODEL_PATH = "models/face_landmarker.task"

ARDUINO_PORT = "COM9"
ARDUINO_BAUDRATE = 9600

HEARTBEAT_INTERVAL = 5.0
METRICS_INTERVAL = 1.0


# ==========================================
# KHOI TAO MEDIAPIPE
# ==========================================

BaseOptions = python.BaseOptions
FaceLandmarker = vision.FaceLandmarker
FaceLandmarkerOptions = vision.FaceLandmarkerOptions
VisionRunningMode = vision.RunningMode

options = FaceLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path=MODEL_PATH
    ),
    num_faces=1,
    running_mode=VisionRunningMode.VIDEO
)


# ==========================================
# KHOI TAO CAMERA
# ==========================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("[ERROR] Khong mo duoc camera")
    exit()


# ==========================================
# KHOI TAO ARDUINO
# ==========================================

arduino = serial.Serial(
    ARDUINO_PORT,
    ARDUINO_BAUDRATE,
    timeout=0.01
)

arduino.reset_input_buffer()


# ==========================================
# KHOI TAO MQTT
# ==========================================

mqtt_client = KSafeMQTTClient()
mqtt_client.connect()


# ==========================================
# KHOI TAO CAC MODULE AI
# ==========================================

drowsiness_detector = DrowsinessDetector()
distraction_detector = DistractionDetector()
state_manager = StateManager()


# ==========================================
# BIEN QUAN LY HE THONG
# ==========================================

start_time = time.monotonic()

reset_requested = False

last_sent_state = None
last_mqtt_state = None

last_heartbeat_time = 0
last_metrics_time = 0


# ==========================================
# KHOI DONG VIDEO SERVER
# ==========================================

video_thread = threading.Thread(
    target=chay_video_server,
    daemon=True
)

video_thread.start()


# ==========================================
# HAM HIEN THI TRANG THAI
# ==========================================

def get_state_display(system_state):

    if system_state == state_manager.SAFE:
        return "SAFE", (0, 255, 0)

    elif system_state == state_manager.UNKNOWN:
        return "UNKNOWN", (255, 165, 0)

    elif system_state == state_manager.FOCUS:
        return "FOCUS", (0, 255, 255)

    elif system_state == state_manager.DANGER:
        return "DANGER", (0, 0, 255)

    return "UNKNOWN", (255, 165, 0)


# ==========================================
# HAM GUI LENH XUONG ARDUINO
# ==========================================

def send_arduino_command(system_state):

    global last_sent_state

    if system_state == state_manager.SAFE:
        arduino_state = "S"

    elif system_state == state_manager.FOCUS:
        arduino_state = "F"

    elif system_state == state_manager.DANGER:
        arduino_state = "D"

    else:
        # UNKNOWN khong gui lenh moi
        arduino_state = None

    if (
        arduino_state is not None
        and arduino_state != last_sent_state
    ):

        arduino.write(
            (arduino_state + "\n").encode()
        )

        last_sent_state = arduino_state

        print(f"[ARDUINO] Gui lenh: {arduino_state}")


# ==========================================
# HAM GUI TRANG THAI LEN MQTT
# ==========================================

def publish_mqtt_state(system_state):

    global last_mqtt_state

    if not mqtt_client.da_ket_noi:
        return

    if system_state != last_mqtt_state:

        mqtt_client.publish_state(system_state)

        last_mqtt_state = system_state

        print(f"[MQTT] Driver state: {system_state}")


# ==========================================
# CHAY HE THONG
# ==========================================

try:

    with FaceLandmarker.create_from_options(options) as landmarker:

        while True:

            # ==================================
            # 1. DOC TIN HIEU RESET TU ARDUINO
            # ==================================

            if arduino.in_waiting > 0:

                tin_hieu = arduino.readline().decode(
                    "utf-8",
                    errors="ignore"
                ).strip()

                if tin_hieu == "R":

                    reset_requested = True

                    print("[ARDUINO] Nhan nut RESET")


            # ==================================
            # 2. DOC CAMERA
            # ==================================

            ret, frame = cap.read()

            if not ret:

                print("[ERROR] Khong doc duoc hinh anh")

                break

            # Lat anh de hien thi nhu guong
            frame = cv2.flip(frame, 1)

            current_time = time.monotonic()


            # ==================================
            # 3. MQTT HEARTBEAT
            # ==================================

            if (
                current_time - last_heartbeat_time
                >= HEARTBEAT_INTERVAL
            ):

                mqtt_client.publish_heartbeat()

                last_heartbeat_time = current_time


            # Neu MQTT ket noi lai,
            # cho phep gui lai trang thai hien tai

            if not mqtt_client.da_ket_noi:

                last_mqtt_state = None


            # ==================================
            # 4. XU LY HINH ANH
            # ==================================

            rgb_frame = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )

            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb_frame
            )

            timestamp_ms = int(
                (current_time - start_time) * 1000
            )

            result = landmarker.detect_for_video(
                mp_image,
                timestamp_ms
            )


            # ==================================
            # 5. CO NHAN DIEN DUOC KHUON MAT
            # ==================================

            if result.face_landmarks:

                face = result.face_landmarks[0]


                # ----------------------------------
                # 5.1. PHAN TICH TRANG THAI MAT
                # ----------------------------------

                ear = drowsiness_detector.get_ear(face)

                eye_state, closed_duration = (
                    drowsiness_detector.get_eye_state(ear)
                )


                # ----------------------------------
                # 5.2. PHAN TICH HUONG DAU VA HUONG MAT
                # ----------------------------------

                attention_result = (
                    distraction_detector.analyze_attention(
                        face,
                        frame,
                        current_time
                    )
                )

                attention = attention_result["attention"]
                # Mat lim duong cung duoc xem la mat tap trung kem
                if eye_state == "DROWSY":
                    attention = "FOCUS"

                eye_direction = attention_result["eye_direction"]

                head_pose = attention_result["head_pose"]


                # ----------------------------------
                # 5.3. LAY CAC GOC DAU
                # ----------------------------------

                pitch = None
                yaw = None
                roll = None

                if head_pose is not None:

                    pitch = head_pose["pitch"]
                    yaw = head_pose["yaw"]
                    roll = head_pose["roll"]


                # ----------------------------------
                # 5.4. CAP NHAT STATE MANAGER
                # ----------------------------------

                system_state = state_manager.update(
                    eye_state,
                    closed_duration,
                    yaw,
                    eye_direction,
                    attention=attention
                )


                # ----------------------------------
                # 5.5. XU LY NUT RESET
                # ----------------------------------

                if reset_requested:

                    if (
                        system_state == state_manager.DANGER
                        and yaw is not None
                    ):

                        reset_success = state_manager.reset(
                            yaw,
                            eye_direction
                        )

                        if reset_success:

                            print(
                                "[SYSTEM] Reset thanh cong - SAFE"
                            )

                        else:

                            print(
                                "[SYSTEM] Reset that bai - Hay nhin thang"
                            )

                    elif system_state != state_manager.DANGER:

                        print(
                            "[SYSTEM] Khong can reset - "
                            "He thong khong o DANGER"
                        )

                    else:

                        print(
                            "[SYSTEM] Khong the reset - "
                            "Khong du du lieu huong dau"
                        )

                    reset_requested = False


                # ----------------------------------
                # 5.6. HIEN THI THONG SO AI
                # ----------------------------------

                cv2.putText(
                    frame,
                    f"EAR: {ear:.3f}",
                    (20, 320),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 0),
                    2
                )

                cv2.putText(
                    frame,
                    f"EYE: {eye_state}",
                    (20, 350),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 0),
                    2
                )

                cv2.putText(
                    frame,
                    f"LOOK: {eye_direction}",
                    (20, 280),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 0),
                    2
                )

                cv2.putText(
                    frame,
                    f"ATTENTION: {attention}",
                    (20, 390),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (255, 255, 0),
                    2
                )

                if head_pose is not None:

                    cv2.putText(
                        frame,
                        f"Pitch: {pitch:.1f}",
                        (20, 420),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.65,
                        (255, 255, 0),
                        2
                    )

                    cv2.putText(
                        frame,
                        f"Yaw: {yaw:.1f}",
                        (20, 240),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.65,
                        (255, 255, 0),
                        2
                    )

                    cv2.putText(
                        frame,
                        f"Roll: {roll:.1f}",
                        (20, 450),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.65,
                        (255, 255, 0),
                        2
                    )


                # ----------------------------------
                # 5.7. MQTT METRICS
                # ----------------------------------

                if (
                    current_time - last_metrics_time
                    >= METRICS_INTERVAL
                ):

                    metrics_head_pose = None

                    if head_pose is not None:

                        metrics_head_pose = {
                            "pitch": pitch,
                            "yaw": yaw,
                            "roll": roll
                        }

                    mqtt_client.publish_metrics(
                        ear,
                        metrics_head_pose,
                        eye_direction
                    )

                    last_metrics_time = current_time


                # ----------------------------------
                # 5.8. MQTT STATE
                # ----------------------------------

                publish_mqtt_state(system_state)


                # ----------------------------------
                # 5.9. GUI LENH ARDUINO
                # ----------------------------------

                send_arduino_command(system_state)


                # ----------------------------------
                # 5.10. HIEN THI TRANG THAI HE THONG
                # ----------------------------------

                state_text, state_color = get_state_display(
                    system_state
                )

                cv2.putText(
                    frame,
                    f"STATE: {state_text}",
                    (20, 200),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    state_color,
                    2
                )

                if system_state == state_manager.DANGER:

                    cv2.putText(
                        frame,
                        "DANGER! WAKE UP",
                        (20, 160),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        1,
                        (0, 0, 255),
                        2
                    )


                # ----------------------------------
                # 5.11. VE LANDMARK
                # ----------------------------------

                for landmark in face:

                    x = int(
                        landmark.x * frame.shape[1]
                    )

                    y = int(
                        landmark.y * frame.shape[0]
                    )

                    cv2.circle(
                        frame,
                        (x, y),
                        1,
                        (0, 255, 0),
                        -1
                    )


            # ==================================
            # 6. KHONG NHAN DIEN DUOC KHUON MAT
            # ==================================

            else:

                # Xoa lich su chuyen dong dau
                distraction_detector.reset_tracking()

                # Khong de thoi gian nham mat cu bi tinh tiep
                drowsiness_detector.closed_start_time = None

                # Cap nhat UNKNOWN vao StateManager
                # De bat dau bo dem UNKNOWN 1.5 giay

                system_state = state_manager.update(
                    "UNKNOWN",
                    0.0,
                    None,
                    "UNKNOWN",
                    attention=state_manager.UNKNOWN
                )

                # Khong cho phep reset khi khong co khuon mat
                reset_requested = False

                # Gui trang thai len MQTT
                publish_mqtt_state(system_state)

                # Gui lenh Arduino neu UNKNOWN da chuyen FOCUS
                send_arduino_command(system_state)

                # Hien thi thong bao
                cv2.putText(
                    frame,
                    "NO FACE DETECTED",
                    (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    (0, 0, 255),
                    2
                )

                state_text, state_color = get_state_display(
                    system_state
                )

                cv2.putText(
                    frame,
                    f"STATE: {state_text}",
                    (20, 100),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    state_color,
                    2
                )


            # ==================================
            # 7. CAP NHAT VIDEO SERVER
            # ==================================

            update_frame(frame)

            cv2.imshow(
                "KSafe AI - Camera",
                frame
            )


            # ==================================
            # 8. THOAT CHUONG TRINH
            # ==================================

            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                break


except KeyboardInterrupt:

    print("\n[SYSTEM] Dung chuong trinh!")


finally:

    # ==========================================
    # GIAI PHONG TAI NGUYEN
    # ==========================================

    cap.release()

    if arduino.is_open:
        arduino.close()

    mqtt_client.disconnect()

    cv2.destroyAllWindows()

    print("[SYSTEM] Da dung KSafe AI!")
