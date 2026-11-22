import time
from collections import deque


class StateManager:

    SAFE = "SAFE"
    MIRROR_CHECK = "MIRROR_CHECK"
    UNKNOWN = "UNKNOWN"
    FOCUS = "FOCUS"
    DANGER = "DANGER"

    def __init__(self):

        # ==========================================
        # CAC NGUONG THOI GIAN
        # ==========================================

        # Mat khuon mat 1.5 giay -> FOCUS
        self.unknown_threshold = 1.5

        # FOCUS lien tuc 3 giay -> DANGER
        self.focus_danger_threshold = 3.0

        # Nham mat lien tuc 2 giay -> DANGER
        self.danger_threshold = 2.0

        # ==========================================
        # FOCUS FREQUENCY
        # ==========================================

        # Cua so theo doi 10 phut
        self.focus_window = 10 * 60

        # Lan FOCUS thu 6 -> DANGER
        self.focus_frequency_threshold = 6

        # Luu thoi diem bat dau moi lan FOCUS
        self.focus_events = deque()

        # Danh dau dang trong mot lan FOCUS
        self.focus_active = False

        # ==========================================
        # THEO DOI THOI GIAN
        # ==========================================

        self.unknown_start_time = None
        self.focus_start_time = None

        # Danh dau UNKNOWN da chuyen thanh FOCUS
        self.unknown_escalated = False

        # ==========================================
        # TRANG THAI HE THONG
        # ==========================================

        self.current_state = self.SAFE

        # Nguong huong dau
        self.yaw_threshold = 20.0
        self.center_yaw = 2.0

        # Bien tuong thich voi logic cu
        self.distraction_threshold = 2.0
        self.distraction_start_time = None

    # ==================================================
    # XOA CAC SU KIEN FOCUS DA QUA 10 PHUT
    # ==================================================

    def remove_expired_focus_events(self, current_time):
        """Loai bo cac lan FOCUS da qua cua so 10 phut."""

        while self.focus_events:

            elapsed = current_time - self.focus_events[0]

            if elapsed > self.focus_window:
                self.focus_events.popleft()

            else:
                break

    # ==================================================
    # DEM SO LAN FOCUS TRONG 10 PHUT
    # ==================================================

    def get_focus_count(self):
        """Tra ve so lan FOCUS trong cua so hien tai."""

        current_time = time.monotonic()

        self.remove_expired_focus_events(current_time)

        return len(self.focus_events)

    # ==================================================
    # GHI NHAN MOT LAN FOCUS MOI
    # ==================================================

    def record_focus_event(self, current_time):
        """
        Chi ghi nhan khi bat dau mot lan FOCUS moi.
        Khong dem lap lai tren tung frame.
        """

        if self.focus_active:
            return

        self.focus_events.append(current_time)

        self.focus_active = True

        print(
            f"[FOCUS FREQUENCY] "
            f"{self.get_focus_count()}/"
            f"{self.focus_frequency_threshold} "
            f"lan trong 10 phut"
        )

    # ==================================================
    # KET THUC MOT LAN FOCUS
    # ==================================================

    def end_focus_event(self):
        """Ket thuc lan FOCUS hien tai."""

        self.focus_active = False
        self.focus_start_time = None

    # ==================================================
    # KIEM TRA MAT TAP TRUNG
    # ==================================================

    def is_distraction(self, yaw, eye_direction):

        if yaw is None:
            return False

        yaw_deviation = abs(yaw - self.center_yaw)

        return (
            yaw_deviation > self.yaw_threshold
            or eye_direction in ("LEFT", "RIGHT")
        )

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

        current_time = time.monotonic()

        # Cap nhat cua so FOCUS 10 phut
        self.remove_expired_focus_events(current_time)

        # ==========================================
        # 1. KIEM TRA NHAM MAT LIEN TUC
        # ==========================================

        if (
            eye_state == "CLOSED"
            and closed_duration >= self.danger_threshold
        ):

            self.current_state = self.DANGER

            self.end_focus_event()

            self.unknown_start_time = None
            self.unknown_escalated = False

            print(
                "[DANGER] EYES CLOSED: "
                f"{closed_duration:.2f} giay"
            )

            return self.current_state

        # ==========================================
        # 2. GIU DANGER CHO DEN KHI RESET
        # ==========================================

        if self.current_state == self.DANGER:
            return self.current_state

        # ==========================================
        # 3. TUONG THICH VOI LOGIC CU
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

            if self.unknown_start_time is None:

                self.unknown_start_time = current_time
                self.unknown_escalated = False

            unknown_duration = (
                current_time - self.unknown_start_time
            )

            # UNKNOWN chua du 1.5 giay
            if (
                unknown_duration < self.unknown_threshold
                and not self.unknown_escalated
            ):

                self.end_focus_event()

                self.current_state = self.UNKNOWN

                return self.current_state

            # UNKNOWN da keo dai du 1.5 giay
            # Chi chuyen sang FOCUS mot lan
            self.unknown_escalated = True

            attention = self.FOCUS

        else:

            # Ket thuc giai doan UNKNOWN
            self.unknown_start_time = None
            self.unknown_escalated = False

        # ==========================================
        # 5. XU LY MIRROR CHECK
        # ==========================================

        if attention == self.MIRROR_CHECK:

            self.end_focus_event()

            self.unknown_start_time = None
            self.unknown_escalated = False

            self.distraction_start_time = None

            self.current_state = self.SAFE

            return self.current_state

        # ==========================================
        # 6. XU LY FOCUS
        # ==========================================

        if attention == self.FOCUS:

            # Ghi nhan mot lan FOCUS moi
            self.record_focus_event(current_time)

            # Bat dau tinh thoi gian FOCUS lien tuc
            if self.focus_start_time is None:

                self.focus_start_time = current_time

            focus_duration = (
                current_time - self.focus_start_time
            )

            focus_count = self.get_focus_count()

            # --------------------------------------
            # DIEU KIEN 1:
            # FOCUS DU 6 LAN TRONG 10 PHUT
            # --------------------------------------

            if (
                focus_count >= self.focus_frequency_threshold
            ):

                print(
                    "[DANGER] FOCUS FREQUENCY EXCEEDED: "
                    f"{focus_count} lan trong 10 phut"
                )

                self.current_state = self.DANGER

                return self.current_state

            # --------------------------------------
            # DIEU KIEN 2:
            # FOCUS LIEN TUC 3 GIAY
            # --------------------------------------

            if (
                focus_duration >= self.focus_danger_threshold
            ):

                print(
                    "[DANGER] FOCUS CONTINUOUS: "
                    f"{focus_duration:.2f} giay"
                )

                self.current_state = self.DANGER

                return self.current_state

            self.current_state = self.FOCUS

            return self.current_state

        # ==========================================
        # 7. XU LY SAFE
        # ==========================================

        if attention == self.SAFE:

            self.end_focus_event()

            self.unknown_start_time = None
            self.unknown_escalated = False

            self.distraction_start_time = None

            self.current_state = self.SAFE

            return self.current_state

        # ==========================================
        # 8. TRANG THAI KHONG HOP LE
        # ==========================================

        self.end_focus_event()

        self.current_state = self.UNKNOWN

        return self.current_state

    # ==================================================
    # RESET DANGER
    # ==================================================

    def reset(self, yaw, eye_direction):
        """
        Chi reset khi tai xe nhin thang.
        Khong xoa lich su FOCUS trong 10 phut.
        """

        if self.current_state != self.DANGER:
            return False

        if yaw is None:
            return False

        yaw_deviation = abs(yaw - self.center_yaw)

        looking_forward = (
            yaw_deviation <= self.yaw_threshold
            and eye_direction == "CENTER"
        )

        if looking_forward:

            self.current_state = self.SAFE

            self.end_focus_event()

            self.unknown_start_time = None
            self.unknown_escalated = False

            self.distraction_start_time = None

            print(
                "[SYSTEM] Reset thanh cong. "
                f"Lich su FOCUS: {self.get_focus_count()}/"
                f"{self.focus_frequency_threshold}"
            )

            return True

        return False
