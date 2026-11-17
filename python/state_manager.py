import time


class StateManager:

    # Các trạng thái của hệ thống
    SAFE = "SAFE"
    MIRROR_CHECK = "MIRROR_CHECK"
    UNKNOWN = "UNKNOWN"
    FOCUS = "FOCUS"
    DANGER = "DANGER"

    def __init__(self):

        # ==========================================
        # NGUONG THOI GIAN
        # ==========================================

        # UNKNOWN kéo dài bao lâu thì chuyển FOCUS
        self.unknown_threshold = 1.5

        # FOCUS liên tục bao lâu thì chuyển DANGER
        self.focus_danger_threshold = 3.0

        # Nhắm mắt liên tục bao lâu thì chuyển DANGER
        self.danger_threshold = 2.0

        # ==========================================
        # NGUONG QUAY DAU CU
        # Chi dung khi chua truyen attention
        # tu DistractionDetector
        # ==========================================

        self.yaw_threshold = 20.0
        self.center_yaw = 2.0

        # ==========================================
        # BO DEM THOI GIAN
        # ==========================================

        self.unknown_start_time = None
        self.focus_start_time = None

        # Trạng thái hiện tại
        self.current_state = self.SAFE

    # ==================================================
    # KIEM TRA MAT TAP TRUNG CU
    # ==================================================

    def is_distraction(self, yaw, eye_direction):
        """
        Logic tương thích với cách gọi cũ.
        Khi tích hợp DistractionDetector mới,
        ưu tiên sử dụng attention được truyền vào.
        """

        if yaw is None:
            return False

        yaw_deviation = abs(yaw - self.center_yaw)

        return yaw_deviation > self.yaw_threshold

    # ==================================================
    # RESET BO DEM
    # ==================================================

    def reset_timers(self):
        """Xóa các bộ đếm thời gian."""

        self.unknown_start_time = None
        self.focus_start_time = None

    # ==================================================
    # CAP NHAT TRANG THAI
    # ==================================================

    def update(
        self,
        eye_state,
        closed_duration,
        yaw=None,
        eye_direction="UNKNOWN",
        attention=None
    ):
        """
        Cập nhật trạng thái hệ thống.

        attention nhận từ DistractionDetector:
            SAFE
            MIRROR_CHECK
            FOCUS
            UNKNOWN

        Ưu tiên:
            DANGER > FOCUS > UNKNOWN
            MIRROR_CHECK không tính FOCUS.
        """

        current_time = time.monotonic()

        # ==========================================
        # 1. DANGER DO NHAM MAT
        # ==========================================

        if (
            eye_state == "CLOSED"
            and closed_duration >= self.danger_threshold
        ):
            self.current_state = self.DANGER
            self.reset_timers()

            return self.current_state

        # ==========================================
        # 2. DA DANGER THI GIU NGUYEN
        # ==========================================

        if self.current_state == self.DANGER:
            return self.current_state

        # ==========================================
        # 3. NEU KHONG TRUYEN ATTENTION
        # SU DUNG LOGIC CU DE TUONG THICH
        # ==========================================

        if attention is None:

            if self.is_distraction(yaw, eye_direction):
                attention = self.FOCUS
            else:
                attention = self.SAFE

        # ==========================================
        # 4. XU LY UNKNOWN
        # ==========================================

        if attention == self.UNKNOWN:

            self.focus_start_time = None

            if self.unknown_start_time is None:
                self.unknown_start_time = current_time

            unknown_duration = (
                current_time - self.unknown_start_time
            )

            if unknown_duration >= self.unknown_threshold:
                attention = self.FOCUS
            else:
                self.current_state = self.UNKNOWN
                return self.current_state

        else:
            # Có dữ liệu trở lại
            self.unknown_start_time = None

        # ==========================================
        # 5. XU LY MIRROR_CHECK
        # ==========================================

        if attention == self.MIRROR_CHECK:

            # Nhìn gương hợp lệ không tính FOCUS
            self.focus_start_time = None

            self.current_state = self.SAFE

            return self.current_state

        # ==========================================
        # 6. XU LY FOCUS
        # ==========================================

        if attention == self.FOCUS:

            if self.focus_start_time is None:
                self.focus_start_time = current_time

            focus_duration = (
                current_time - self.focus_start_time
            )

            # FOCUS liên tục quá 3 giây
            if focus_duration >= self.focus_danger_threshold:
                self.current_state = self.DANGER
                self.reset_timers()

                return self.current_state

            self.current_state = self.FOCUS

            return self.current_state

        # ==========================================
        # 7. TRO LAI SAFE
        # ==========================================

        if attention == self.SAFE:

            self.focus_start_time = None
            self.unknown_start_time = None

            self.current_state = self.SAFE

            return self.current_state

        # ==========================================
        # 8. DU LIEU KHONG HOP LE
        # ==========================================

        self.current_state = self.UNKNOWN

        return self.current_state

    # ==================================================
    # RESET DANGER
    # ==================================================

    def reset(self, yaw, eye_direction):
        """
        Reset DANGER khi tài xế nhìn thẳng
        và nhấn nút reset.

        Điều kiện:
        - Đầu gần hướng chính diện.
        - Mắt nhìn CENTER.
        """

        if yaw is None:
            return False

        yaw_deviation = abs(yaw - self.center_yaw)

        looking_forward = (
            yaw_deviation <= self.yaw_threshold
            and eye_direction == "CENTER"
        )

        if looking_forward:

            self.current_state = self.SAFE

            self.reset_timers()

            return True

        return False
