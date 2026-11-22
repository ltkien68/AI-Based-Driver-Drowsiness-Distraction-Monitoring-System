import math
import time


class DrowsinessDetector:
    # Thứ tự: góc ngoài, góc trên ngoài, góc trên trong,
    # góc trong, góc dưới trong, góc dưới ngoài

    LEFT_EYE = [33, 160, 158, 133, 153, 144]
    RIGHT_EYE = [362, 385, 387, 263, 373, 380]

    def __init__(self):
        # Thời điểm bắt đầu nhắm mắt
        self.closed_start_time = None

        # Ngưỡng phân loại EAR
        self.blink_threshold = 0.25
        self.eye_closed_threshold = 0.15
        self.eye_drowsy_threshold = 0.22

        self.drowsy_start_time = None
        self.drowsy_threshold = 0.5

        # Thời gian nhắm mắt để xác định nguy hiểm
        self.danger_threshold = 2.0

    def distance(self, p1, p2):
        """Tính khoảng cách giữa hai điểm landmark."""

        return math.sqrt(
            (p1.x - p2.x) ** 2 +
            (p1.y - p2.y) ** 2
        )

    def calculate_ear(self, face_landmarks, eye_indices):
        """Tính EAR của một mắt."""

        p1 = face_landmarks[eye_indices[0]]
        p2 = face_landmarks[eye_indices[1]]
        p3 = face_landmarks[eye_indices[2]]
        p4 = face_landmarks[eye_indices[3]]
        p5 = face_landmarks[eye_indices[4]]
        p6 = face_landmarks[eye_indices[5]]

        horizontal = self.distance(p1, p4)

        if horizontal <= 1e-6:
            return 0.0

        vertical_1 = self.distance(p2, p6)
        vertical_2 = self.distance(p3, p5)

        ear = (vertical_1 + vertical_2) / (2 * horizontal)

        return ear

    def get_ear(self, face_landmarks):
        """Tính EAR trung bình của hai mắt."""

        if len(face_landmarks) <= max(
            max(self.LEFT_EYE),
            max(self.RIGHT_EYE)
        ):
            return 0.0

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

    def get_eye_state(self, ear, current_time=None):
        """
        OPEN   : Mat mo hoac chop mat ngan.
        DROWSY : Mat lim dim lien tuc >= 0.5 giay.
        CLOSED : Mat nham lien tuc >= 0.25 giay.
        """

        if current_time is None:
            current_time = time.monotonic()

        # Mat mo binh thuong
        if ear > self.eye_drowsy_threshold:
            self.closed_start_time = None
            self.drowsy_start_time = None

            return "OPEN", 0.0

        # Mat nham
        if ear <= self.eye_closed_threshold:

            self.drowsy_start_time = None

            if self.closed_start_time is None:
                self.closed_start_time = current_time

            closed_duration = (
                current_time - self.closed_start_time
            )

            if closed_duration < self.blink_threshold:
                return "OPEN", closed_duration

            return "CLOSED", closed_duration

        # Mat lim dim
        self.closed_start_time = None

        if self.drowsy_start_time is None:
            self.drowsy_start_time = current_time

        drowsy_duration = (
            current_time - self.drowsy_start_time
        )

        if drowsy_duration >= self.drowsy_threshold:
            return "DROWSY", 0.0

        # Chua du thoi gian xac nhan lim dim
        return "OPEN", 0.0

    def is_eye_closed(self, ear, current_time=None):
        """Kiểm tra mắt đã nhắm lâu hơn thời gian chớp mắt chưa."""

        if current_time is None:
            current_time = time.monotonic()

        if ear <= self.eye_closed_threshold:

            if self.closed_start_time is None:
                self.closed_start_time = current_time

            closed_duration = (
                current_time - self.closed_start_time
            )

            return closed_duration >= self.blink_threshold

        self.closed_start_time = None
        return False

    def is_dangerous_closed(self, closed_duration):
        """Kiểm tra mắt đã nhắm liên tục đủ thời gian nguy hiểm chưa."""

        return closed_duration >= self.danger_threshold
