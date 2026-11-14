from flask import Flask, Response

import cv2
import threading

# Bien luu frame moi nhat
frame_moi_nhat = None

# Khoa bao ve frame
frame_lock = threading.Lock()


# Cap nhat frame
def update_frame(frame):
    global frame_moi_nhat

    with frame_lock:
        frame_moi_nhat = frame.copy()


# Lay frame moi nhat
def get_frame():
    with frame_lock:
        if frame_moi_nhat is None:
            return None

        return frame_moi_nhat.copy()

# Ma hoa frame thanh JPEG
def ma_hoa_frame(frame):
    if frame is None:
        return None

    # Ma hoa frame thanh JPEG
    thanh_cong, buffer = cv2.imencode(".jpg", frame)

    if not thanh_cong:
        return None

    # Chuyen du lieu NumPy thanh bytes
    return buffer.tobytes()


# Tao luong MJPEG
def tao_luong_video():
    while True:
        # Lay frame moi nhat
        frame = get_frame()

        if frame is None:
            continue

        # Ma hoa frame thanh JPEG
        jpeg = ma_hoa_frame(frame)

        if jpeg is None:
            continue

        # Gui frame theo dinh dang MJPEG
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" +
            jpeg +
            b"\r\n"
        )

app = Flask(__name__)

# Route phat video MJPEG
@app.route("/video_feed")
def video_feed():
    return Response(
        tao_luong_video(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )

@app.route("/")
def trang_chu():
    return "KSafe AI Video Server đang chạy!"

# Khoi chay Flask Server
def chay_video_server():
    app.run(
        host="0.0.0.0",
        port=8000,
        debug=False,
        use_reloader=False
    )

