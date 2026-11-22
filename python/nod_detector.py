import statistics


class NodDetector:
    """
    Phat hien hanh vi:
    1. Dau cui xuong du mot goc nhat dinh.
    2. Sau do giat nguoc len nhanh.
    3. Chi xac nhan mot lan cho moi chu ky cui - ngẩng.
    """

    def __init__(
        self,
        calibration_frames=30,
        down_threshold=18.0,
        recovery_threshold=10.0,
        min_up_speed=60.0,
        max_nod_duration=1.5
    ):
        self.calibration_frames = calibration_frames

        # Nguong phat hien cui va ngang dau
        self.down_threshold = down_threshold
        self.recovery_threshold = recovery_threshold

        # Toc do ngang dau toi thieu (do/giay)
        self.min_up_speed = min_up_speed

        # Thoi gian toi da cho mot chu ky cui - ngang
        self.max_nod_duration = max_nod_duration

        self.calibration_values = []
        self.baseline_pitch = None

        self.previous_pitch = None
        self.previous_time = None

        self.is_head_down = False
        self.down_start_time = None
        self.down_peak_deviation = 0.0

    def update(self, pitch, current_time):
        """
        Tra ve True khi phat hien mot chu ky cui dau roi giat len.
        pitch: goc Pitch tu MediaPipe/OpenCV.
        current_time: time.monotonic().
        """

        if pitch is None:
            self.reset_tracking()
            return False

        pitch = float(pitch)

        # ==========================================
        # 1. HIEU CHUAN TU THE DAU BAN DAU
        # ==========================================

        if self.baseline_pitch is None:
            self.calibration_values.append(pitch)

            if len(self.calibration_values) >= self.calibration_frames:
                self.baseline_pitch = statistics.median(
                    self.calibration_values
                )

                print(
                    f"[NOD] Hieu chuan hoan tat. "
                    f"Pitch goc: {self.baseline_pitch:.1f}"
                )

            self.previous_pitch = pitch
            self.previous_time = current_time

            return False

        # ==========================================
        # 2. TINH DO LECH VA VAN TOC PITCH
        # ==========================================

        deviation = pitch - self.baseline_pitch

        if self.previous_pitch is None or self.previous_time is None:
            self.previous_pitch = pitch
            self.previous_time = current_time
            return False

        delta_time = current_time - self.previous_time

        if delta_time <= 0:
            return False

        pitch_speed = (pitch - self.previous_pitch) / delta_time

        # ==========================================
        # 3. PHAT HIEN DAU CUI DU SAU
        # ==========================================

        if not self.is_head_down:

            if abs(deviation) >= self.down_threshold:
                self.is_head_down = True
                self.down_start_time = current_time
                self.down_peak_deviation = deviation

                print(
                    f"[NOD] Phat hien dau cui: "
                    f"{deviation:.1f} do"
                )

        else:

            # Cap nhat muc cui sau nhat
            if abs(deviation) > abs(self.down_peak_deviation):
                self.down_peak_deviation = deviation

            duration = current_time - self.down_start_time

            # ======================================
            # 4. KIEM TRA DAU GIAT NGUOC LEN
            # ======================================

            # Dau phai quay ve gan tu the ban dau
            recovered = (
                abs(deviation)
                <= abs(self.down_peak_deviation)
                - self.recovery_threshold
            )

            # Toc do phai di nguoc lai huong cui
            moving_up = (
                pitch_speed * self.down_peak_deviation < 0
                and abs(pitch_speed) >= self.min_up_speed
            )

            if recovered and moving_up:
                print(
                    f"[NOD] XAC NHAN GAT DAU! "
                    f"Toc do: {abs(pitch_speed):.1f} do/s"
                )

                self._reset_nod_cycle()
                self._save_previous(pitch, current_time)

                return True

            # Qua thoi gian cho phep ma chua giat len
            if duration > self.max_nod_duration:
                print("[NOD] Huy chu ky - qua thoi gian")

                self._reset_nod_cycle()

        # ==========================================
        # 5. CAP NHAT DU LIEU FRAME
        # ==========================================

        self._save_previous(pitch, current_time)

        return False

    def _save_previous(self, pitch, current_time):
        self.previous_pitch = pitch
        self.previous_time = current_time

    def _reset_nod_cycle(self):
        self.is_head_down = False
        self.down_start_time = None
        self.down_peak_deviation = 0.0

    def reset_tracking(self):
        """
        Xoa chu ky dang theo doi khi mat khuon mat.
        Giu lai Pitch baseline da hieu chuan.
        """
        self._reset_nod_cycle()
        self.previous_pitch = None
        self.previous_time = None
