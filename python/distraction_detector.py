
import cv2
import numpy as np
import time
from collections import deque


class DistractionDetector:

    # Landmark khuôn mặt dùng để tính Head Pose
    LANDMARK_IDS = {
        "nose": 1,
        "chin": 152,
        "left_eye": 33,
        "right_eye": 263,
        "left_mouth": 61,
        "right_mouth": 291
    }

    def __init__(self):

        # ==========================================
        # MO HINH 3D KHUON MAT
        # ==========================================

        self.model_points = np.array([
            (0.0, 0.0, 0.0),
            (0.0, -330.0, -65.0),
            (-225.0, 170.0, -135.0),
            (225.0, 170.0, -135.0),
            (-150.0, -150.0, -125.0),
            (150.0, -150.0, -125.0)
        ], dtype=np.float64)

        # ==========================================
        # NGUONG HUONG DAU
        # ==========================================

        self.mirror_yaw_min = 12.0
        self.mirror_yaw_max = 38.0

        self.distraction_yaw_threshold = 20.0

        # Nguong Pitch tuong doi sau hieu chuan
        self.distraction_pitch_threshold = 5.0

        self.distraction_roll_threshold = 20.0

        # ==========================================
        # HIEU CHUAN PITCH
        # ==========================================

        # Thu thap 30 mau khi nguoi dung nhin thang
        self.pitch_calibration_samples = deque(maxlen=30)

        self.pitch_reference = None

        # Dieu kien lay mau hieu chuan
        self.calibration_yaw_threshold = 15.0
        self.calibration_roll_threshold = 15.0

        # ==========================================
        # NGUONG HUONG MAT
        # ==========================================

        self.eye_left_threshold = 0.40
        self.eye_right_threshold = 0.60

        self.eye_up_threshold = 0.35
        self.eye_down_threshold = 0.65

        # ==========================================
        # THOI GIAN XAC NHAN
        # ==========================================

        self.distraction_confirm_duration = 0.8

        self.distraction_start_time = None

        # ==========================================
        # HUONG YAW
        # ==========================================

        # -1: Yaw am la trai, Yaw duong la phai
        # 1: Dao nguoc hai huong
        self.yaw_left_sign = -1

        # ==========================================
        # LICH SU CHUYEN DONG DAU
        # ==========================================

        self.history_duration = 2.0

        self.head_history = deque()

        self.nod_pitch_change_threshold = 12.0
        self.nod_roll_change_threshold = 12.0

        self.head_tilt_confirm_duration = 0.8

        self.head_tilt_start_time = None

        self.previous_attention = "UNKNOWN"

    # ==================================================
    # TINH DO LECH GOC
    # ==================================================

    def calculate_angle_difference(self, angle, reference):
        """
        Tinh do lech goc trong khoang -180 den 180.
        Tranh loi khi goc di qua moc +/-180 do.
        """

        return (
            (angle - reference + 180.0) % 360.0
        ) - 180.0

    # ==================================================
    # HIEU CHUAN PITCH
    # ==================================================

    def calibrate_pitch(
        self,
        pitch,
        yaw,
        roll,
        eye_direction,
        vertical_direction
    ):
        """
        Hieu chuan Pitch khi nguoi dung nhin thang.

        Thu thap 30 mau va lay trung binh goc theo
        phuong phap circular mean.
        """

        if self.pitch_reference is None:

            looking_forward = (
                eye_direction == "CENTER"
                and vertical_direction == "CENTER"
                and abs(yaw) < self.calibration_yaw_threshold
                and abs(roll) < self.calibration_roll_threshold
            )

            if looking_forward:

                self.pitch_calibration_samples.append(pitch)

                if len(self.pitch_calibration_samples) == 30:

                    angles = np.radians(
                        list(self.pitch_calibration_samples)
                    )

                    sin_mean = np.mean(np.sin(angles))
                    cos_mean = np.mean(np.cos(angles))

                    self.pitch_reference = float(
                        np.degrees(
                            np.arctan2(sin_mean, cos_mean)
                        )
                    )

                    print(
                        "[AI] Pitch calibrated: "
                        f"{self.pitch_reference:.2f} degrees"
                    )

        if self.pitch_reference is None:
            return None

        pitch_relative = self.calculate_angle_difference(
            pitch,
            self.pitch_reference
        )

        return pitch_relative

    # ==================================================
    # LAY TOA DO LANDMARK
    # ==================================================

    def get_image_points(self, face_landmarks, frame):
        """Chuyen toa do landmark chuan hoa thanh pixel."""

        height, width = frame.shape[:2]

        image_points = np.array([
            (
                face_landmarks[self.LANDMARK_IDS["nose"]].x * width,
                face_landmarks[self.LANDMARK_IDS["nose"]].y * height
            ),
            (
                face_landmarks[self.LANDMARK_IDS["chin"]].x * width,
                face_landmarks[self.LANDMARK_IDS["chin"]].y * height
            ),
            (
                face_landmarks[self.LANDMARK_IDS["left_eye"]].x * width,
                face_landmarks[self.LANDMARK_IDS["left_eye"]].y * height
            ),
            (
                face_landmarks[self.LANDMARK_IDS["right_eye"]].x * width,
                face_landmarks[self.LANDMARK_IDS["right_eye"]].y * height
            ),
            (
                face_landmarks[self.LANDMARK_IDS["left_mouth"]].x * width,
                face_landmarks[self.LANDMARK_IDS["left_mouth"]].y * height
            ),
            (
                face_landmarks[self.LANDMARK_IDS["right_mouth"]].x * width,
                face_landmarks[self.LANDMARK_IDS["right_mouth"]].y * height
            )
        ], dtype=np.float64)

        return image_points

    # ==================================================
    # TINH HEAD POSE
    # ==================================================

    def get_head_pose(self, face_landmarks, frame):
        """Tinh Pitch, Yaw, Roll bang solvePnP."""

        height, width = frame.shape[:2]

        image_points = self.get_image_points(
            face_landmarks,
            frame
        )

        focal_length = width

        camera_matrix = np.array([
            [focal_length, 0, width / 2],
            [0, focal_length, height / 2],
            [0, 0, 1]
        ], dtype=np.float64)

        distortion_coeffs = np.zeros((4, 1), dtype=np.float64)

        try:

            success, rotation_vector, translation_vector = cv2.solvePnP(
                self.model_points,
                image_points,
                camera_matrix,
                distortion_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE
            )

            if not success:
                return None

            rotation_matrix, _ = cv2.Rodrigues(rotation_vector)

            angles, _, _, _, _, _ = cv2.RQDecomp3x3(
                rotation_matrix
            )

            pitch = float(angles[0])
            yaw = float(angles[1])
            roll = float(angles[2])

            return pitch, yaw, roll

        except (cv2.error, ValueError, TypeError):
            return None

    # ==================================================
    # TINH HUONG LIET MAT NGANG
    # ==================================================

    def get_eye_direction(self, face_landmarks):
        """Phan loai huong mat LEFT, CENTER, RIGHT."""

        try:

            left_inner = face_landmarks[133]
            left_outer = face_landmarks[33]
            left_iris = face_landmarks[468]

            right_inner = face_landmarks[362]
            right_outer = face_landmarks[263]
            right_iris = face_landmarks[473]

            left_denominator = (
                left_inner.x - left_outer.x
            )

            right_denominator = (
                right_outer.x - right_inner.x
            )

            if (
                abs(left_denominator) < 1e-6
                or abs(right_denominator) < 1e-6
            ):
                return "UNKNOWN"

            left_ratio = (
                (left_iris.x - left_outer.x)
                / left_denominator
            )

            right_ratio = (
                (right_iris.x - right_inner.x)
                / right_denominator
            )

            eye_ratio = (
                left_ratio + right_ratio
            ) / 2

            if eye_ratio < self.eye_left_threshold:
                return "LEFT"

            if eye_ratio > self.eye_right_threshold:
                return "RIGHT"

            return "CENTER"

        except (IndexError, AttributeError, ZeroDivisionError):
            return "UNKNOWN"

    # ==================================================
    # TINH HUONG LIET MAT DOC
    # ==================================================

    def get_vertical_eye_direction(self, face_landmarks):
        """Phan loai huong mat UP, CENTER, DOWN."""

        try:

            # Mat trai
            left_upper = face_landmarks[159]
            left_lower = face_landmarks[145]
            left_iris = face_landmarks[468]

            # Mat phai
            right_upper = face_landmarks[386]
            right_lower = face_landmarks[374]
            right_iris = face_landmarks[473]

            left_denominator = (
                left_lower.y - left_upper.y
            )

            right_denominator = (
                right_lower.y - right_upper.y
            )

            if (
                abs(left_denominator) < 1e-6
                or abs(right_denominator) < 1e-6
            ):
                return "UNKNOWN"

            left_ratio = (
                (left_iris.y - left_upper.y)
                / left_denominator
            )

            right_ratio = (
                (right_iris.y - right_upper.y)
                / right_denominator
            )

            eye_ratio = (
                left_ratio + right_ratio
            ) / 2

            if eye_ratio < self.eye_up_threshold:
                return "UP"

            if eye_ratio > self.eye_down_threshold:
                return "DOWN"

            return "CENTER"

        except (IndexError, AttributeError, ZeroDivisionError):
            return "UNKNOWN"

    # ==================================================
    # XAC DINH HUONG QUAY DAU
    # ==================================================

    def get_head_direction(self, yaw):
        """Xac dinh huong quay dau."""

        yaw_left = yaw * self.yaw_left_sign

        if yaw_left > self.mirror_yaw_min:
            return "LEFT"

        if yaw_left < -self.mirror_yaw_min:
            return "RIGHT"

        return "CENTER"

    # ==================================================
    # NHAN DIEN NHIN GUONG
    # ==================================================

    def detect_mirror_check(
        self,
        yaw,
        eye_direction,
        vertical_direction
    ):
        """
        Nhan dien quan sat guong.

        Khong gioi han thoi gian nhin guong.
        Huong dau va huong mat phai phu hop.
        """

        yaw_left = yaw * self.yaw_left_sign

        # Nhin guong trai
        if (
            self.mirror_yaw_min <= yaw_left <= self.mirror_yaw_max
            and eye_direction == "LEFT"
        ):
            return "MIRROR_LEFT"

        # Nhin guong phai
        if (
            -self.mirror_yaw_max <= yaw_left <= -self.mirror_yaw_min
            and eye_direction == "RIGHT"
        ):
            return "MIRROR_RIGHT"

        # Nhin guong trong
        if (
            abs(yaw) < self.mirror_yaw_min
            and vertical_direction == "UP"
        ):
            return "MIRROR_REAR"

        return None

    # ==================================================
    # LUU LICH SU CHUYEN DONG DAU
    # ==================================================

    def update_head_history(
        self,
        pitch,
        yaw,
        roll,
        current_time
    ):
        """Luu goc dau theo thoi gian."""

        self.head_history.append({
            "time": current_time,
            "pitch": pitch,
            "yaw": yaw,
            "roll": roll
        })

        while (
            self.head_history
            and current_time - self.head_history[0]["time"]
            > self.history_duration
        ):
            self.head_history.popleft()

    # ==================================================
    # PHAT HIEN CHUYEN DONG GAT DAU
    # ==================================================

    def detect_head_nodding(self):
        """
        Phat hien bien thien Pitch/Roll bat thuong.

        Day la tin hieu chuyen dong dau so bo,
        chua phai thuat toan xac nhan ngu gat.
        """

        if len(self.head_history) < 2:
            return False

        first = self.head_history[0]
        last = self.head_history[-1]

        pitch_change = abs(
            self.calculate_angle_difference(
                last["pitch"],
                first["pitch"]
            )
        )

        roll_change = abs(
            self.calculate_angle_difference(
                last["roll"],
                first["roll"]
            )
        )

        return (
            pitch_change >= self.nod_pitch_change_threshold
            or roll_change >= self.nod_roll_change_threshold
        )

    # ==================================================
    # PHAT HIEN NGHIENG DAU
    # ==================================================

    def detect_head_tilt(self, pitch, roll):
        """Kiem tra dau cui/ngang va nghieng bat thuong."""

        pitch_abnormal = (
            abs(pitch) >= self.distraction_pitch_threshold
        )

        roll_abnormal = (
            abs(roll) >= self.distraction_roll_threshold
        )

        return pitch_abnormal or roll_abnormal

    # ==================================================
    # PHAN TICH HANH VI
    # ==================================================

    def analyze_attention(
        self,
        face_landmarks,
        frame,
        current_time=None
    ):
        """
        Phan tich trang thai chu y.

        Ket qua:
            SAFE
            MIRROR_CHECK
            FOCUS
            UNKNOWN

        UNKNOWN duoc StateManager quan ly thoi gian.
        """

        if current_time is None:
            current_time = time.monotonic()

        # Kiem tra du lieu khuon mat
        if face_landmarks is None or len(face_landmarks) < 474:

            self.reset_tracking()

            return self.create_result(
                "UNKNOWN",
                "FACE_LANDMARK_INVALID"
            )

        # Tinh Head Pose
        head_pose = self.get_head_pose(
            face_landmarks,
            frame
        )

        if head_pose is None:

            self.reset_tracking()

            return self.create_result(
                "UNKNOWN",
                "HEAD_POSE_INVALID"
            )

        raw_pitch, yaw, roll = head_pose

        # Tinh huong mat
        eye_direction = self.get_eye_direction(
            face_landmarks
        )

        vertical_direction = self.get_vertical_eye_direction(
            face_landmarks
        )

        if (
            eye_direction == "UNKNOWN"
            or vertical_direction == "UNKNOWN"
        ):

            self.reset_tracking()

            return self.create_result(
                "UNKNOWN",
                "EYE_DIRECTION_INVALID",
                head_pose=head_pose,
                eye_direction=eye_direction,
                vertical_direction=vertical_direction
            )

        # ==========================================
        # HIEU CHUAN VA TINH PITCH TUONG DOI
        # ==========================================

        pitch_relative = self.calibrate_pitch(
            raw_pitch,
            yaw,
            roll,
            eye_direction,
            vertical_direction
        )

        # Chua hieu chuan thi khong danh gia Pitch
        if pitch_relative is None:
            pitch_relative = 0.0

        # Tao Head Pose da hieu chuan
        calibrated_head_pose = (
            pitch_relative,
            yaw,
            roll
        )

        # ==========================================
        # CAP NHAT LICH SU DAU
        # ==========================================

        self.update_head_history(
            pitch_relative,
            yaw,
            roll,
            current_time
        )

        # ==========================================
        # PHAN LOAI HUONG DAU
        # ==========================================

        head_direction = self.get_head_direction(yaw)

        # ==========================================
        # KIEM TRA NHIN GUONG
        # ==========================================

        mirror_type = self.detect_mirror_check(
            yaw,
            eye_direction,
            vertical_direction
        )

        # ==========================================
        # UU TIEN NHAN DIEN GUONG
        # ==========================================

        if mirror_type is not None:

            self.distraction_start_time = None
            self.head_tilt_start_time = None

            self.previous_attention = "MIRROR_CHECK"

            return self.create_result(
                "MIRROR_CHECK",
                mirror_type,
                calibrated_head_pose,
                eye_direction,
                vertical_direction,
                head_direction,
                mirror_type,
                self.detect_head_nodding(),
                0.0
            )

        # ==========================================
        # KIEM TRA HANH VI BAT THUONG
        # ==========================================

        abnormal = False
        reason = "NORMAL_OBSERVATION"

        # Dau quay trai nhung mat nhin phai
        if (
            head_direction == "LEFT"
            and eye_direction == "RIGHT"
        ):

            abnormal = True
            reason = "HEAD_EYE_DIRECTION_MISMATCH"

        # Dau quay phai nhung mat nhin trai
        elif (
            head_direction == "RIGHT"
            and eye_direction == "LEFT"
        ):

            abnormal = True
            reason = "HEAD_EYE_DIRECTION_MISMATCH"

        # Dau quay qua muc
        elif abs(yaw) >= self.distraction_yaw_threshold:

            abnormal = True
            reason = "HEAD_TURN_TOO_FAR"

        # Mat liet ngang nhung dau khong quay theo
        elif eye_direction in ("LEFT", "RIGHT"):

            abnormal = True
            reason = "LOOKING_SIDEWAYS"

        # Nhin xuong
        elif vertical_direction == "DOWN":

            abnormal = True
            reason = "LOOKING_DOWN"

        # Dau cui/ngang hoac nghieng bat thuong
        elif self.detect_head_tilt(pitch_relative, roll):

            abnormal = True
            reason = "HEAD_TILT_ABNORMAL"

        # Tin hieu chuyen dong dau
        head_movement_abnormal = self.detect_head_nodding()

        # ==========================================
        # QUAN LY THOI GIAN FOCUS
        # ==========================================

        if abnormal:

            if self.distraction_start_time is None:
                self.distraction_start_time = current_time

            distraction_duration = (
                current_time - self.distraction_start_time
            )

            if (
                distraction_duration
                >= self.distraction_confirm_duration
            ):
                attention = "FOCUS"

            else:
                attention = "SAFE"

        else:

            self.distraction_start_time = None

            distraction_duration = 0.0

            attention = "SAFE"

        # ==========================================
        # KET QUA
        # ==========================================

        self.previous_attention = attention

        return self.create_result(
            attention,
            reason,
            calibrated_head_pose,
            eye_direction,
            vertical_direction,
            head_direction,
            mirror_type,
            head_movement_abnormal,
            distraction_duration
        )

    # ==================================================
    # TAO KET QUA
    # ==================================================

    def create_result(
        self,
        attention,
        reason,
        head_pose=None,
        eye_direction="UNKNOWN",
        vertical_direction="UNKNOWN",
        head_direction="UNKNOWN",
        mirror_type=None,
        head_movement_abnormal=False,
        distraction_duration=0.0
    ):
        """Dong goi ket qua phan tich."""

        pose_data = None

        if head_pose is not None:

            pose_data = {
                "pitch": round(head_pose[0], 2),
                "yaw": round(head_pose[1], 2),
                "roll": round(head_pose[2], 2)
            }

        return {
            "attention": attention,
            "reason": reason,
            "head_pose": pose_data,
            "eye_direction": eye_direction,
            "vertical_direction": vertical_direction,
            "head_direction": head_direction,
            "mirror_type": mirror_type,
            "head_movement_abnormal": head_movement_abnormal,
            "distraction_duration": round(
                distraction_duration,
                2
            )
        }

    # ==================================================
    # RESET DU LIEU THEO DOI
    # ==================================================

    def reset_tracking(self):
        """
        Xoa lich su chuyen dong khi mat khuon mat.

        Khong xoa pitch_reference de tranh phai
        hieu chuan lai sau moi lan mat khuon mat.
        """

        self.head_history.clear()

        self.distraction_start_time = None
        self.head_tilt_start_time = None

        self.previous_attention = "UNKNOWN"
