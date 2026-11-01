import math
import time

class DrowsinessDetector:
    # Thứ tự: góc ngoài, góc trên ngoài, góc trên trong, góc trong, góc dưới trong, góc dưới ngoài
    LEFT_EYE = [33, 160, 158, 133, 153, 144]
    RIGHT_EYE = [362, 385, 387, 263, 373, 380]

    def __init__(self):
        # ngưỡng ban đầu
        self.ear_threshold = 0.15
        self.closed_start_time = None
        self.blink_threshold = 0.25

    def distance(self, p1, p2):
        return math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)

    def calculate_ear(self, face_landmarks, eye_indices):
        """Tính EAR của 1 mắt"""

        p1 = face_landmarks[eye_indices[0]]
        p2 = face_landmarks[eye_indices[1]]
        p3 = face_landmarks[eye_indices[2]]
        p4 = face_landmarks[eye_indices[3]]
        p5 = face_landmarks[eye_indices[4]]
        p6 = face_landmarks[eye_indices[5]]

        horizontal = self.distance(p1, p4)

        vertical_1 = self.distance(p2, p6)
        vertical_2 = self.distance(p3, p5)

        ear = (vertical_1 + vertical_2) / (2 * horizontal)

        return ear

    def get_ear(self, face_landmarks):
        """Tính EAR trung bình của 2 mắt"""

        left_ear = self.calculate_ear(
            face_landmarks,
            self.LEFT_EYE
        )

        right_ear = self.calculate_ear(
            face_landmarks,
            self.RIGHT_EYE
        )

        average_ear = (left_ear + right_ear) / 2

        return average_ear

    def is_eye_closed(self, ear):
        """Kiểm tra mắt đang nhắm hay mở"""

        if ear < self.ear_threshold:
            if self.closed_start_time is None:
                self.closed_start_time = time.time()

            closed_duration = time.time() - self.closed_start_time

            return closed_duration >= self.blink_threshold

        self.closed_start_time = None

        return False