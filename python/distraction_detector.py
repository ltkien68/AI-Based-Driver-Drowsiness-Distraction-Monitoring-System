import cv2
import numpy as np


class DistractionDetector:
    LANDMARK_IDS = {
        "nose": 1,
        "chin": 152,
        "left_eye": 33,
        "right_eye": 263,
        "left_mouth": 61,
        "right_mouth": 291
    }

    def __init__(self):
        # Mô hình 3D khuôn mặt tương đối
        self.model_points = np.array([
            (0.0, 0.0, 0.0),          # Mũi
            (0.0, -330.0, -65.0),      # Cằm
            (-225.0, 170.0, -135.0),   # Mắt trái
            (225.0, 170.0, -135.0),    # Mắt phải
            (-150.0, -150.0, -125.0), # Miệng trái
            (150.0, -150.0, -125.0)   # Miệng phải
        ], dtype=np.float64)

    def get_image_points(self, face_landmarks, frame):
        """Lấy tọa độ pixel của các landmark cần thiết."""

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

    def get_head_pose(self, face_landmarks, frame):
        """Tính góc quay đầu theo Yaw, Pitch, Roll."""

        height, width = frame.shape[:2]

        image_points = self.get_image_points(
            face_landmarks,
            frame
        )

        # Ma trận camera xấp xỉ
        focal_length = width

        camera_matrix = np.array([
            [focal_length, 0, width / 2],
            [0, focal_length, height / 2],
            [0, 0, 1]
        ], dtype=np.float64)

        # Giả sử không có méo ống kính
        distortion_coeffs = np.zeros((4, 1))

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

        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rotation_matrix)

        pitch = angles[0]
        yaw = angles[1]
        roll = angles[2]

        return pitch, yaw, roll

    def get_eye_direction(self, face_landmarks):
                """Xác định hướng nhìn cơ bản của hai mắt."""
    
                # Landmark mắt trái
                left_inner = face_landmarks[133]
                left_outer = face_landmarks[33]
                left_iris = face_landmarks[468]
    
                # Landmark mắt phải
                right_inner = face_landmarks[362]
                right_outer = face_landmarks[263]
                right_iris = face_landmarks[473]
    
                # Vị trí tương đối của đồng tử trong mắt trái
                left_ratio = (
                    left_iris.x - left_outer.x
                ) / (
                    left_inner.x - left_outer.x
                )
    
                # Vị trí tương đối của đồng tử trong mắt phải
                right_ratio = (
                    right_iris.x - right_inner.x
                ) / (
                    right_outer.x - right_inner.x
                )
    
                # Trung bình hai mắt
                eye_ratio = (left_ratio + right_ratio) / 2
    
                # Phân loại hướng nhìn
                if eye_ratio < 0.40:
                    return "LEFT"
    
                if eye_ratio > 0.60:
                    return "RIGHT"
    
                return "CENTER"