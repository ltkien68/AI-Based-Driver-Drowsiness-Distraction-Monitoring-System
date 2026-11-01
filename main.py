import cv2
import mediapipe as mp
import time

from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from drowsiness_detector import DrowsinessDetector
from distraction_detector import DistractionDetector
from state_manager import StateManager


MODEL_PATH = "models/face_landmarker.task"


# Cấu hình MediaPipe Face Landmarker
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


# Mở camera
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Khong mo duoc camera")
    exit()


# Khởi tạo hệ thống
start_time = time.time()

drowsiness_detector = DrowsinessDetector()
distraction_detector = DistractionDetector()
state_manager = StateManager()


with FaceLandmarker.create_from_options(options) as landmarker:

    while True:
        ret, frame = cap.read()

        if not ret:
            print("Khong doc duoc hinh anh")
            break

        # Lật camera giống camera selfie
        frame = cv2.flip(frame, 1)

        # OpenCV dùng BGR, MediaPipe dùng RGB
        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        # Chuyển frame thành MediaPipe Image
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
            ear = drowsiness_detector.get_ear(face)
            
            eye_state, closed_duration = (
                drowsiness_detector.get_eye_state(ear)
            )

            head_pose = distraction_detector.get_head_pose(
                face,
                frame
            )

            eye_direction = (
                distraction_detector.get_eye_direction(face)
            )

            if head_pose is not None:
                pitch, yaw, roll = head_pose

                system_state = state_manager.update(
                    eye_state,
                    closed_duration,
                    yaw,
                    eye_direction
                )

                cv2.putText(
                    frame,
                    f"Yaw: {yaw:.1f}",
                    (20, 240),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (255, 255, 0),
                    2
                )

                # Hiển thị hướng mắt
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
                system_state = state_manager.SAFE

            if system_state == state_manager.SAFE:
                state_text = "SAFE"
                state_color = (0, 255, 0)

            elif system_state == state_manager.FOCUS:
                state_text = "FOCUS"
                state_color = (0, 255, 255)

            else:
                state_text = "DANGER"
                state_color = (0, 0, 255)

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

            for landmark in face:
                x = int(landmark.x * frame.shape[1])
                y = int(landmark.y * frame.shape[0])

                cv2.circle(
                    frame,
                    (x, y),
                    1,
                    (0, 255, 0),
                    -1
                )

        else:
            cv2.putText(
                frame,
                "NO FACE DETECTED",
                (20, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 0, 255),
                2
            )

        cv2.imshow(
            "KSafe AI - Camera",
            frame
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

cap.release()
cv2.destroyAllWindows()