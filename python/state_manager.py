import time


class StateManager:
    # Các trạng thái chính của hệ thống
    SAFE = "SAFE"
    FOCUS = "FOCUS"
    DANGER = "DANGER"

    def __init__(self):
        # Ngưỡng quay đầu để xác định mất tập trung
        # Yaw khoảng 13-15 độ vẫn có thể là liếc gương
        self.yaw_threshold = 20.0

        # Thời gian phải duy trì trạng thái mất tập trung
        # để tránh cảnh báo khi chỉ liếc nhanh
        self.distraction_threshold = 2.0

        # Ngưỡng ngủ gật
        self.danger_threshold = 2.0

        # Yaw chuẩn khi nhìn thẳng
        self.center_yaw = 2.0

        # Thời điểm bắt đầu mất tập trung
        self.distraction_start_time = None

        # Trạng thái hiện tại
        self.current_state = self.SAFE

    def is_distraction(self, yaw, eye_direction):
        """
        Xác định tài xế có đang mất tập trung hay không.

        Yaw là điều kiện chính.
        Eye direction chỉ dùng để tham khảo vì khi quay đầu mạnh,
        vị trí đồng tử có thể bị nhận sai thành CENTER.
        """

        yaw_deviation = abs(yaw - self.center_yaw)

        # Đầu quay đủ xa khỏi hướng nhìn thẳng
        if yaw_deviation > self.yaw_threshold:
            return True

        return False

    def update(self, eye_state, closed_duration, yaw, eye_direction):
        """
        Cập nhật trạng thái hệ thống.

        Ưu tiên:
        DANGER > FOCUS > SAFE
        """

        # DANGER do nhắm mắt quá lâu
        if (
            eye_state == "CLOSED"
            and closed_duration >= self.danger_threshold
        ):
            self.current_state = self.DANGER

            # Xóa bộ đếm distraction
            self.distraction_start_time = None

            return self.current_state

        # Nếu đã vào DANGER thì giữ nguyên
        # Cho đến khi có cơ chế reset riêng
        if self.current_state == self.DANGER:
            return self.current_state

        # Kiểm tra mất tập trung
        distraction = self.is_distraction(
            yaw,
            eye_direction
        )

        if distraction:

            # Bắt đầu tính thời gian mất tập trung
            if self.distraction_start_time is None:
                self.distraction_start_time = time.time()

            distraction_duration = (
                time.time() - self.distraction_start_time
            )

            # Duy trì đủ lâu → FOCUS
            if distraction_duration >= self.distraction_threshold:
                self.current_state = self.FOCUS

        else:
            # Quay lại nhìn đường → reset bộ đếm
            self.distraction_start_time = None
            self.current_state = self.SAFE

        return self.current_state

    def reset(self, yaw, eye_direction):
        """
        Reset DANGER khi tài xế nhìn thẳng và nhấn nút reset.

        Điều kiện:
        - Đầu nhìn gần hướng thẳng
        - Mắt nhìn CENTER
        """

        yaw_deviation = abs(yaw - self.center_yaw)

        looking_forward = (
            yaw_deviation <= self.yaw_threshold
            and eye_direction == "CENTER"
        )

        if looking_forward:
            self.current_state = self.SAFE
            self.distraction_start_time = None
            return True

        return False