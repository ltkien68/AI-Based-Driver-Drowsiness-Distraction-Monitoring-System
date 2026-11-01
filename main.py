import cv2
import mediapipe as mp
import time

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_PATH = "models/face_landmarker.task"

# chỉ định model AI sẽ dùng
BaseOptions = python.BaseOptions
# bộ xử lý facial landmarks
FaceLandmarker = vision.FaceLandmarker
# chứa các tùy chọn cấu hình
FaceLandmarkerOptions = vision.FaceLandmarkerOptions
# xác định cách xử lý dữ liệu
VisionRunningMode = vision.RunningMode

options = FaceLandmarkerOptions(
    base_options = BaseOptions(model_asset_path = MODEL_PATH),
    num_faces = 1,
    running_mode = VisionRunningMode.VIDEO
)

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Khong mo duoc cam")
    exit()

start_time = time.time()

with FaceLandmarker.create_from_options(options) as landmarker:
    while True:
        ret, frame = cap.read()

        if not ret:
            print("Khong doc duoc hinh anh")
            break
        # openCV dùng bgr, mediapipe dùng rgb -> phải chuyển màu
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        # chuyển rgb thành đối tượng Image để mediapipe có thể xử lý
        mp_image = mp.Image(
            image_format = mp.ImageFormat.SRGB,
            data = rgb_frame
        )
        # tính thời gian đã chạy của chương trình
        timestamp_ms = int(
            (time.time() - start_time) * 1000
        )

        # face landmarker nhận frame và trả về các facial landmarks
        result = landmarker.detect_for_video(mp_image, timestamp_ms)

        if result.face_landmarks:
            face = result.face_landmarks[0]

            for landmark in face:
                # chuyển dạng từ 0.0 -> 1.0 sang tọa độ pixel
                x = int(landmark.x * frame.shape[1])
                y = int(landmark.y * frame.shape[0])

                # vẽ các điểm landmarks lên mặt
                # cv2.circle(image, center, radius, color, thickness)
                cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)


        cv2.imshow("KSafe AI - Camera", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break



cap.release()
cv2.destroyAllWindows()