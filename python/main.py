import cv2
import mediapipe as mp
import time
import serial

from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from drowsiness_detector import DrowsinessDetector
from distraction_detector import DistractionDetector
from state_manager import StateManager
from mqtt_client import KSafeMQTTClient


MODEL_PATH = "models/face_landmarker.task"

# Chu ky gui du lieu MQTT
HEARTBEAT_INTERVAL = 5.0
METRICS_INTERVAL = 1.0


# Cau hinh MediaPipe Face Landmarker
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


# Mo camera
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Khong mo duoc camera")
    exit()

# Ket noi ARDUINO
arduino = serial.Serial(
    "COM9",
    9600,
    timeout=0.01
)

# Xoa du lieu rac trong buffer khi ARDUINO vua ket noi
arduino.reset_input_buffer()

# Khoi tao MQTT Client
mqtt_client = KSafeMQTTClient()
mqtt_client.connect()

# Khoi tao he thong AI
start_time = time.time()

drowsiness_detector = DrowsinessDetector()
distraction_detector = DistractionDetector()
state_manager = StateManager()

# Bien quan ly trang thai
reset_requested = False
last_sent_state = None
last_mqtt_state = None

# Bien quan ly thoi gian gui MQTT
last_heartbeat_time = 0
last_metrics_time = 0

try:
    with FaceLandmarker.create_from_options(options) as landmarker:
        while True:

            # ==================================
            # NHAN TIN HIEU RESET TU ARDUINO
            # ==================================

            if arduino.in_waiting > 0:
                tin_hieu = arduino.readline().decode(
                    "utf-8",
                    errors="ignore"
                ).strip()

                if tin_hieu == "R":
                    reset_requested = True
                    print("Nhan nut RESET tu arduino")

            # ==================================
            # DOC CAMERA
            # ==================================

            ret, frame = cap.read()

            if not ret:
                print("Khong doc duoc hinh anh")
                break

            frame = cv2.flip(frame, 1)

            # ==================================
            # HEARTBEAT MQTT
            # ==================================

            current_time = time.monotonic()

            if current_time - last_heartbeat_time >= HEARTBEAT_INTERVAL:

                mqtt_client.publish_heartbeat()

                last_heartbeat_time = current_time

            # Neu mat ket noi, cho phep gui lai state sau reconnect
            if not mqtt_client.da_ket_noi:
                last_mqtt_state = None

            # ==================================
            # XU LY HINH ANH
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
                (time.time() - start_time) * 1000
            )

            result = landmarker.detect_for_video(
                mp_image,
                timestamp_ms
            )

            if result.face_landmarks:

                face = result.face_landmarks[0]

                # =========================
                # PHAT HIEN BUON NGU
                # =========================

                ear = drowsiness_detector.get_ear(face)

                eye_state, closed_duration = (
                    drowsiness_detector.get_eye_state(ear)
                )

                # =========================
                # PHAT HIEN MAT TAP TRUNG
                # =========================

                head_pose = distraction_detector.get_head_pose(
                    face,
                    frame
                )

                eye_direction = (
                    distraction_detector.get_eye_direction(face)
                )

                if head_pose is not None:

                    pitch, yaw, roll = head_pose

                    # =========================
                    # CAP NHAT TRANG THAI
                    # =========================

                    system_state = state_manager.update(
                        eye_state,
                        closed_duration,
                        yaw,
                        eye_direction
                    )

                    # =========================
                    # RESET DANGER BANG BUTTON
                    # =========================

                    if reset_requested:

                        if system_state == state_manager.DANGER:

                            reset_success = state_manager.reset(
                                yaw,
                                eye_direction
                            )

                            if reset_success:
                                print("Reset thanh cong - SAFE")
                            else:
                                print(
                                    "Reset that bai - Hay nhin thang vao camera"
                                )

                        else:
                            print(
                                "Khong can reset - He thong khong o DANGER"
                            )

                        reset_requested = False

                    # Hien thi Yaw
                    cv2.putText(
                        frame,
                        f"Yaw: {yaw:.1f}",
                        (20, 240),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (255, 255, 0),
                        2
                    )

                    # Hien thi huong mat
                    cv2.putText(
                        frame,
                        f"LOOK: {eye_direction}",
                        (20, 280),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (255, 255, 0),
                        2
                    )

                else:

                    system_state = "UNKNOWN"

                    reset_requested = False

                # ==================================
                # MQTT: GUI TRANG THAI TAI XE
                # ==================================

                if mqtt_client.da_ket_noi:

                    if system_state != last_mqtt_state:

                        mqtt_client.publish_state(system_state)
                        last_mqtt_state = system_state

                # ==================================
                # MQTT: GUI CHI SO AI
                # ==================================

                current_time = time.monotonic()

                if current_time - last_metrics_time >= METRICS_INTERVAL:

                    if head_pose is not None:

                        metrics_head_pose = {
                            "pitch": pitch,
                            "yaw": yaw,
                            "roll": roll
                        }

                    else:
                        metrics_head_pose = None

                    mqtt_client.publish_metrics(
                        ear,
                        metrics_head_pose,
                        eye_direction
                    )

                    last_metrics_time = current_time

                # ==================================
                # HIEN THI TRANG THAI
                # ==================================

                if system_state == state_manager.SAFE:
                    state_text = "SAFE"
                    state_color = (0, 255, 0)

                elif system_state == state_manager.FOCUS:
                    state_text = "FOCUS"
                    state_color = (0, 255, 255)

                else:
                    state_text = "DANGER"
                    state_color = (0, 0, 255)

                # ==================================
                # GUI TRANG THAI XUONG ARDUINO
                # ==================================

                if system_state == state_manager.SAFE:
                    arduino_state = "S"

                elif system_state == state_manager.FOCUS:
                    arduino_state = "F"

                elif system_state == state_manager.DANGER:
                    arduino_state = "D"

                else:
                    # UNKNOWN: khong gui lenh moi xuong Arduino
                    arduino_state = None

                if (
                    arduino_state is not None
                    and arduino_state != last_sent_state
                ):

                    arduino.write(
                        (arduino_state + "\n").encode()
                    )

                    last_sent_state = arduino_state

                    print(f"Gui Arduino: {arduino_state}")

                cv2.putText(
                    frame,
                    f"STATE: {state_text}",
                    (20, 200),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    state_color,
                    2
                )

                # Hien thi canh bao DANGER
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

                # Ve landmark khuon mat
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

            else:

                # Khong tim thay khuon mat
                system_state = "UNKNOWN"

                # Gui UNKNOWN neu trang thai thay doi
                if (
                    mqtt_client.da_ket_noi
                    and system_state != last_mqtt_state
                ):

                    mqtt_client.publish_state(system_state)

                    last_mqtt_state = system_state

                cv2.putText(
                    frame,
                    "NO FACE DETECTED",
                    (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    (0, 0, 255),
                    2
                )

                # Huy yeu cau reset neu khong co khuon mat
                reset_requested = False

            # ==================================
            # HIEN THI CAMERA
            # ==================================

            cv2.imshow(
                "KSafe AI - Camera",
                frame
            )

            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                break


except KeyboardInterrupt:
    print("\nDung chuong trinh!")

finally:

    # Giai phong camera
    cap.release()

    # Ngat ket noi Arduino
    if arduino.is_open:
        arduino.close()

    # Ngat ket noi MQTT
    mqtt_client.disconnect()

    # Dong cua so OpenCV
    cv2.destroyAllWindows()

    print("[SYSTEM] Da dung KSafe AI!")
