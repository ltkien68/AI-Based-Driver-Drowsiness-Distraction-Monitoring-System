/* ==========================================================================
   KSafe AI – Gói ngôn ngữ Tiếng Việt
   dict     : "English gốc" → "Tiếng Việt" (khớp nguyên chuỗi, đã gộp khoảng trắng)
   patterns : [regex, mẫu] cho chuỗi có số liệu động. Mẫu là chuỗi dùng $1, $2… hoặc
              hàm (match, t) trong đó t() dịch tiếp phần con.
   Giữ nguyên các thuật ngữ kỹ thuật: SAFE / FOCUS / DANGER, EAR, Pitch/Yaw/Roll,
   Arduino Uno, Wi-Fi, MediaPipe, DEMO / REAL.
   ========================================================================== */
(function () {
  'use strict';

  var dict = {
    /* ---- Điều hướng / khung ---- */
    'Monitor': 'Giám sát', 'Insights': 'Thống kê', 'System': 'Hệ thống',
    'Overview': 'Tổng quan', 'Live Monitoring': 'Giám sát trực tiếp', 'Device Management': 'Quản lý thiết bị',
    'Alert History': 'Lịch sử cảnh báo', 'Analytics': 'Phân tích', 'Settings': 'Cài đặt',
    'Driver Monitoring System': 'Hệ thống giám sát tài xế', 'Main navigation': 'Điều hướng chính',
    'Close menu': 'Đóng menu', 'Open menu': 'Mở menu', 'Dashboard': 'Bảng điều khiển', 'Breadcrumb': 'Đường dẫn',
    'Language': 'Ngôn ngữ', 'Current time': 'Thời gian hiện tại', 'Account menu': 'Menu tài khoản',
    'Overall system status': 'Trạng thái chung của hệ thống',
    'System Online': 'Hệ thống hoạt động', 'System Offline': 'Hệ thống ngoại tuyến', 'Degraded': 'Hoạt động một phần',
    'Connecting…': 'Đang kết nối…', 'Checking…': 'Đang kiểm tra…',
    'Operator': 'Người vận hành', 'Local session': 'Phiên cục bộ', 'LAN dashboard': 'Bảng điều khiển LAN',
    'Data source': 'Nguồn dữ liệu', 'DEMO data': 'Dữ liệu DEMO', 'REAL data': 'Dữ liệu REAL',
    'REAL data (Arduino Uno + AI)': 'Dữ liệu REAL (Arduino Uno + AI)', 'Go to': 'Đi tới',
    'DEMO DATA': 'DỮ LIỆU DEMO', 'REAL DATA': 'DỮ LIỆU REAL',
    'Values are simulated in your browser to preview the UI. No hardware is being read.':
      'Số liệu được mô phỏng ngay trong trình duyệt để xem trước giao diện. Hệ thống không đọc dữ liệu từ phần cứng.',
    'Switch to REAL': 'Chuyển sang REAL', 'Switch to DEMO': 'Chuyển sang DEMO',
    'Simulated data – not from hardware': 'Dữ liệu mô phỏng – không lấy từ phần cứng',
    'Live data from Arduino Uno / Python AI': 'Dữ liệu trực tiếp từ Arduino Uno / Python AI',

    /* ---- Trạng thái chung ---- */
    'Online': 'Trực tuyến', 'Offline': 'Ngoại tuyến', 'Connected': 'Đã kết nối', 'Disconnected': 'Mất kết nối',
    'Unreachable': 'Không truy cập được', 'No data': 'Không có dữ liệu', 'NO DATA': 'KHÔNG CÓ DỮ LIỆU', 'None': 'Không',
    'None yet': 'Chưa có', 'Unknown': 'Không rõ', 'Tracking': 'Đang theo dõi', 'No face': 'Không thấy mặt',
    'Detected': 'Đã phát hiện', 'Not detected': 'Không phát hiện', 'Resolved': 'Đã xử lý',
    'Normal': 'Bình thường', 'Warning': 'Cảnh báo', 'Critical': 'Nghiêm trọng',
    'Not reported': 'Chưa báo cáo', 'Ready': 'Sẵn sàng', 'Silent': 'Im lặng', 'Fault': 'Lỗi',
    'Center': 'Giữa', 'Left': 'Trái', 'Right': 'Phải', 'Up': 'Lên', 'Down': 'Xuống', 'Eyes closed': 'Mắt nhắm',
    'Eyes open': 'Mắt mở', 'Eyes closing': 'Đang nhắm mắt', 'Drowsy': 'Buồn ngủ', 'Looking away': 'Đang nhìn đi chỗ khác',
    'Attentive': 'Tập trung', 'Green': 'Xanh lá', 'Yellow': 'Vàng', 'Red': 'Đỏ',
    'Today': 'Hôm nay', 'today': 'hôm nay', '7 days': '7 ngày', '14 days': '14 ngày', 'this session': 'trong phiên này',
    'h': 'giờ', 's': 'giây', 'ratio': 'tỷ lệ', 'degrees': 'độ',

    /* ---- Trạng thái an toàn tài xế ---- */
    'Driver Safety Status': 'Trạng thái an toàn tài xế', 'Driver safety status': 'Trạng thái an toàn tài xế',
    'Driver is Safe': 'Tài xế an toàn', 'Driver Safe': 'Tài xế an toàn',
    'Driver Needs Attention': 'Tài xế cần chú ý',
    'Drowsiness / Distraction Detected': 'Phát hiện buồn ngủ / mất tập trung',
    'No Driver Data': 'Chưa có dữ liệu tài xế',
    'Eyes open and head pose within the normal range. No action required.':
      'Mắt mở và tư thế đầu trong giới hạn bình thường. Không cần xử lý.',
    'Early warning: eyes are closing or attention is drifting. Monitoring closely.':
      'Cảnh báo sớm: mắt đang nhắm dần hoặc sự chú ý đang giảm. Hệ thống đang theo dõi sát.',
    'Alarm condition. Arduino Uno should sound the buzzer and show a red LED until reset.':
      'Tình trạng báo động. Arduino Uno sẽ bật còi và đèn LED đỏ cho đến khi được reset.',
    'Waiting for the Python AI service. Check the connection in Device Management.':
      'Đang chờ dịch vụ Python AI. Hãy kiểm tra kết nối trong mục Quản lý thiết bị.',
    'In this state for': 'Thời gian ở trạng thái này', 'Trigger': 'Nguyên nhân', 'Last update': 'Cập nhật lần cuối',
    'Head turned': 'Đầu quay đi', 'Face not detected': 'Không phát hiện khuôn mặt', 'Reported by AI service': 'Do dịch vụ AI báo cáo',

    /* ---- Thẻ trạng thái / Overview ---- */
    'System status': 'Trạng thái hệ thống', 'Live monitoring': 'Giám sát trực tiếp',
    'AI Monitoring': 'Giám sát AI', 'Arduino Uno Device': 'Thiết bị Arduino Uno', 'Driver Status': 'Trạng thái tài xế', 'Alert Counter': 'Số cảnh báo',
    'Frame rate': 'Tốc độ khung hình', 'IP address': 'Địa chỉ IP', 'Last alert': 'Cảnh báo gần nhất', 'Session started': 'Bắt đầu phiên',
    'Open full view': 'Xem toàn màn hình', 'Device Monitoring': 'Giám sát thiết bị', 'Manage': 'Quản lý',
    'Recent Alerts': 'Cảnh báo gần đây', 'View all': 'Xem tất cả',

    /* ---- Camera ---- */
    'Camera View': 'Khung hình camera', 'Camera settings': 'Cài đặt camera', 'Configure camera': 'Cấu hình camera',
    'NO SIGNAL': 'KHÔNG CÓ TÍN HIỆU', 'CONNECTING': 'ĐANG KẾT NỐI', 'ERROR': 'LỖI', 'Face': 'Khuôn mặt',
    'Webcam active': 'Webcam đang bật', 'Streaming': 'Đang phát', 'Connecting': 'Đang kết nối', 'Error': 'Lỗi', 'No source': 'Chưa có nguồn',
    'Connecting to camera…': 'Đang kết nối camera…', 'Camera unavailable': 'Camera không khả dụng',
    'No camera feed': 'Chưa có hình ảnh camera', 'Camera source not configured': 'Chưa cấu hình nguồn camera',
    'Demo preview – no video is captured; the dashed face region is illustrative.':
      'Xem trước demo – không ghi hình; vùng khuôn mặt nét đứt chỉ mang tính minh họa.',
    'Choose the MJPEG stream from the Python service, or the browser webcam, in Settings → Camera.':
      'Chọn luồng MJPEG từ dịch vụ Python hoặc webcam của trình duyệt tại Cài đặt → Camera.',
    'Browser webcam needs HTTPS or localhost. Open the dashboard from http://localhost, or use the MJPEG stream option for LAN access.':
      'Webcam trình duyệt cần HTTPS hoặc localhost. Hãy mở dashboard từ http://localhost, hoặc dùng luồng MJPEG khi truy cập qua LAN.',
    'Camera permission was denied in the browser.': 'Trình duyệt đã từ chối quyền truy cập camera.',
    'Live camera stream from the AI service': 'Luồng camera trực tiếp từ dịch vụ AI', 'illustrative': 'minh họa',

    /* ---- Chỉ số AI ---- */
    'AI Metrics': 'Chỉ số AI', 'Eye Aspect Ratio': 'Tỷ lệ khung mắt', 'Head Pitch': 'Góc Pitch (cúi/ngẩng)',
    'Head Yaw': 'Góc Yaw (quay trái/phải)', 'Head Roll': 'Góc Roll (nghiêng đầu)', 'Eye Direction': 'Hướng mắt',
    'Drowsiness Status': 'Trạng thái buồn ngủ', 'Distraction Status': 'Trạng thái mất tập trung',
    'eye openness': 'độ mở mắt', 'Up / down tilt': 'Nghiêng lên / xuống', 'Left / right turn': 'Quay trái / phải',
    'Sideways tilt': 'Nghiêng sang bên', 'Estimated gaze': 'Hướng nhìn ước tính',
    'Eyes-closed duration': 'Thời gian nhắm mắt', 'Head-away duration': 'Thời gian quay đầu đi',
    'Left / right': 'Trái / phải', 'Up / down': 'Lên / xuống',

    /* ---- Thiết bị ---- */
    'Buzzer': 'Còi buzzer', 'OLED Display': 'Màn hình OLED', 'LCD Display': 'Màn hình LCD', 'Reset Button': 'Nút Reset',
    'Waiting for first response': 'Đang chờ phản hồi đầu tiên', 'Driver state indicator': 'Đèn báo trạng thái tài xế',
    'Alarm active': 'Đang báo động', 'Sounding until the reset button is pressed': 'Kêu cho đến khi nhấn nút reset',
    'Sounds only in DANGER state': 'Chỉ kêu ở trạng thái DANGER', 'Status display': 'Màn hình trạng thái',
    'Reset pending': 'Chờ reset',
    'Press on the device to acknowledge an alarm': 'Nhấn trên thiết bị để xác nhận báo động',

    /* ---- Bảng cảnh báo ---- */
    'Time': 'Thời gian', 'Event': 'Sự kiện', 'Severity': 'Mức độ', 'Status': 'Trạng thái',
    'Eye Closure': 'Nhắm mắt', 'Drowsiness': 'Buồn ngủ', 'Distraction': 'Mất tập trung', 'Head Pose Deviation': 'Lệch tư thế đầu',
    'No alerts recorded': 'Chưa có cảnh báo nào',
    'Alerts appear here when the AI service reports a FOCUS or DANGER state.':
      'Cảnh báo sẽ xuất hiện ở đây khi dịch vụ AI báo trạng thái FOCUS hoặc DANGER.',
    'Alerts will appear as the demo scenario runs.': 'Cảnh báo sẽ xuất hiện khi kịch bản demo chạy.',
    'Seeded demo history': 'Lịch sử demo có sẵn', 'EAR below threshold': 'EAR thấp hơn ngưỡng',
    'Head pose outside normal range': 'Tư thế đầu ngoài phạm vi bình thường',
    'Eyes closed beyond allowed duration': 'Nhắm mắt quá thời gian cho phép',
    'Looking away beyond allowed duration': 'Nhìn đi chỗ khác quá thời gian cho phép',
    'Driver returned to normal state': 'Tài xế đã trở lại trạng thái bình thường',

    /* ---- Giám sát trực tiếp ---- */
    'Camera feed and real-time measurements from the Python AI service (OpenCV + MediaPipe).':
      'Hình ảnh camera và số đo thời gian thực từ dịch vụ Python AI (OpenCV + MediaPipe).',
    'Pause charts': 'Tạm dừng biểu đồ', 'Resume charts': 'Tiếp tục biểu đồ', 'Clear history': 'Xóa lịch sử',
    'Chart history cleared': 'Đã xóa lịch sử biểu đồ',
    'EAR Monitoring': 'Theo dõi EAR', 'last 60 samples': '60 mẫu gần nhất', 'Head Pose Monitoring': 'Theo dõi tư thế đầu',
    'Eye Gaze Monitoring': 'Theo dõi hướng nhìn', 'UP': 'LÊN', 'DOWN': 'XUỐNG', 'LEFT': 'TRÁI', 'RIGHT': 'PHẢI',
    'Gaze direction indicator': 'Chỉ báo hướng nhìn', 'Waiting for AI data…': 'Đang chờ dữ liệu AI…',
    'Eye aspect ratio over time': 'Chỉ số EAR theo thời gian', 'Head pose over time': 'Tư thế đầu theo thời gian',

    /* ---- Lịch sử cảnh báo ---- */
    'Every drowsiness and distraction event detected by the system.': 'Mọi sự kiện buồn ngủ và mất tập trung do hệ thống phát hiện.',
    'Export CSV': 'Xuất CSV', 'Alert summary': 'Tóm tắt cảnh báo', 'Matching alerts': 'Cảnh báo phù hợp',
    'Drowsiness / prolonged distraction': 'Buồn ngủ / mất tập trung kéo dài', 'Early warnings': 'Cảnh báo sớm',
    'Unresolved': 'Chưa xử lý', 'Status still “Detected”': 'Trạng thái vẫn là “Đã phát hiện”',
    'All recorded alerts': 'Tất cả cảnh báo đã ghi', 'Search': 'Tìm kiếm', 'Event, severity, details…': 'Sự kiện, mức độ, chi tiết…',
    'From date': 'Từ ngày', 'To date': 'Đến ngày', 'All statuses': 'Mọi trạng thái', 'All severities': 'Mọi mức độ', 'Reset': 'Đặt lại',
    'Date / time': 'Ngày / giờ', 'Details': 'Chi tiết',
    'No alerts match your filters': 'Không có cảnh báo nào khớp bộ lọc',
    'Try a different search or widen the date range.': 'Hãy thử từ khóa khác hoặc mở rộng khoảng ngày.',
    'No alerts recorded yet': 'Chưa có cảnh báo nào được ghi',
    'Alerts appear when the Python AI service reports FOCUS or DANGER while in REAL mode.':
      'Cảnh báo sẽ xuất hiện khi dịch vụ Python AI báo trạng thái FOCUS hoặc DANGER ở chế độ REAL.',
    'Alerts are generated as the demo scenario runs.': 'Cảnh báo được tạo ra khi kịch bản demo chạy.',
    'Previous page': 'Trang trước', 'Next page': 'Trang sau',
    'Nothing to export – no alerts match the filters': 'Không có gì để xuất – không có cảnh báo nào khớp bộ lọc',

    /* ---- Phân tích ---- */
    'Detection counts, uptime and the share of time spent in each driver state.':
      'Số lần phát hiện, thời gian hoạt động và tỷ lệ thời gian ở từng trạng thái của tài xế.',
    'Time range': 'Khoảng thời gian', 'Key figures': 'Số liệu chính',
    'Drowsiness detections': 'Lần phát hiện buồn ngủ', 'Eye closure + drowsiness events': 'Sự kiện nhắm mắt + buồn ngủ',
    'Distraction detections': 'Lần phát hiện mất tập trung', 'Distraction + head pose events': 'Sự kiện mất tập trung + lệch tư thế đầu',
    'Active time': 'Thời gian hoạt động', 'Safe ratio': 'Tỷ lệ an toàn', 'Share of active time in SAFE': 'Tỷ lệ thời gian hoạt động ở trạng thái SAFE',
    'Alerts over time': 'Cảnh báo theo thời gian', 'State distribution': 'Phân bố trạng thái', 'no data': 'không có dữ liệu',
    'Active hours per day': 'Giờ hoạt động mỗi ngày', 'Uptime statistics': 'Thống kê thời gian hoạt động',
    'Dashboard session': 'Phiên dashboard', 'Active time today': 'Thời gian hoạt động hôm nay',
    'Average per active day': 'Trung bình mỗi ngày hoạt động', 'Days with recorded activity': 'Số ngày có ghi nhận hoạt động',
    'Arduino Uno uptime': 'Thời gian hoạt động Arduino Uno', 'Share': 'Tỷ lệ', 'Threshold': 'Ngưỡng', 'Active': 'Hoạt động',
    'No alerts recorded in REAL mode in this range': 'Không có cảnh báo REAL nào trong khoảng này',
    'No alerts in this range': 'Không có cảnh báo trong khoảng này', 'No activity recorded in this range': 'Không ghi nhận hoạt động trong khoảng này',
    'No data in this range': 'Không có dữ liệu trong khoảng này', 'Bar chart': 'Biểu đồ cột', 'Line chart': 'Biểu đồ đường', 'Donut chart': 'Biểu đồ tròn',
    'Alerts over time ': 'Cảnh báo theo thời gian', 'Active hours per day ': 'Giờ hoạt động mỗi ngày',

    /* ---- Cài đặt ---- */
    'Connection addresses, camera source and detection thresholds. Saved in this browser.':
      'Địa chỉ kết nối, nguồn camera và ngưỡng nhận diện. Được lưu trong trình duyệt này.',
    'Connection': 'Kết nối', 'API endpoint (Python AI service)': 'API endpoint (dịch vụ Python AI)',
    'Test Arduino Uno': 'Kiểm tra Arduino Uno', 'Test AI service': 'Kiểm tra dịch vụ AI',
    'DEMO: values are simulated in the browser to preview the interface. No hardware is contacted. Applies immediately.':
      'DEMO: số liệu được mô phỏng trong trình duyệt để xem trước giao diện, không kết nối phần cứng. Áp dụng ngay.',
    'REAL: the dashboard polls the Arduino Uno and the Python AI service using the addresses below. Anything unreachable is shown as offline – nothing is simulated. Applies immediately.':
      'REAL: dashboard đọc dữ liệu từ Arduino Uno và dịch vụ Python AI theo địa chỉ bên dưới. Thiết bị nào không kết nối được sẽ hiển thị là ngoại tuyến – không có gì bị mô phỏng. Áp dụng ngay.',
    'Camera configuration': 'Cấu hình camera', 'Camera source': 'Nguồn camera',
    'None (placeholder)': 'Không có (hiển thị khung chờ)', 'MJPEG stream from Python service': 'Luồng MJPEG từ dịch vụ Python',
    'Browser webcam (localhost / HTTPS only)': 'Webcam trình duyệt (chỉ localhost / HTTPS)',
    'Stream URL': 'URL luồng video', 'Resolution': 'Độ phân giải', 'Used for the browser webcam.': 'Dùng cho webcam của trình duyệt.',
    'Target frame rate': 'Tốc độ khung hình mục tiêu', 'Mirror video': 'Lật gương video',
    'Flip horizontally, like a rear-view mirror.': 'Lật ngang như gương chiếu hậu.',
    'Detection thresholds': 'Ngưỡng nhận diện', 'EAR threshold': 'Ngưỡng EAR', 'EAR threshold slider': 'Thanh trượt ngưỡng EAR',
    'Eyes count as closed when the Eye Aspect Ratio drops below this value. Typical range 0.18 – 0.25.':
      'Mắt được coi là nhắm khi chỉ số EAR thấp hơn giá trị này. Khoảng thường dùng 0.18 – 0.25.',
    'Drowsiness detection duration': 'Thời gian phát hiện buồn ngủ', 'Drowsiness duration slider': 'Thanh trượt thời gian buồn ngủ',
    'Eyes closed continuously for this long raises DANGER.': 'Mắt nhắm liên tục trong khoảng thời gian này sẽ kích hoạt DANGER.',
    'Distraction threshold – yaw': 'Ngưỡng mất tập trung – yaw', 'Head turned left / right beyond this angle.': 'Đầu quay trái / phải vượt quá góc này.',
    'Distraction threshold – pitch': 'Ngưỡng mất tập trung – pitch', 'Head tilted up / down beyond this angle.': 'Đầu ngẩng / cúi vượt quá góc này.',
    'Distraction duration': 'Thời gian mất tập trung', 'Distraction duration slider': 'Thanh trượt thời gian mất tập trung',
    'Looking away continuously for this long raises DANGER.': 'Nhìn đi chỗ khác liên tục trong khoảng thời gian này sẽ kích hoạt DANGER.',
    'All changes saved': 'Đã lưu mọi thay đổi', 'Unsaved changes': 'Có thay đổi chưa lưu', 'Save settings': 'Lưu cài đặt',
    'Discard changes': 'Hủy thay đổi', 'Restore defaults': 'Khôi phục mặc định',
    'The dashboard uses these thresholds to classify driver state whenever the Python service does not send its own':
      'Dashboard dùng các ngưỡng này để phân loại trạng thái tài xế khi dịch vụ Python không tự gửi',
    '. Keep them in sync with your Python configuration.': '. Hãy giữ chúng đồng bộ với cấu hình Python của bạn.',
    'Stored data': 'Dữ liệu đã lưu', 'Alerts and statistics are kept in this browser only.': 'Cảnh báo và thống kê chỉ được lưu trong trình duyệt này.',
    'Clear REAL alert history': 'Xóa lịch sử cảnh báo REAL', 'Clear DEMO session alerts': 'Xóa cảnh báo phiên DEMO',
    'Enter the API endpoint': 'Hãy nhập API endpoint', 'Must start with http:// or https://': 'Phải bắt đầu bằng http:// hoặc https://',
    'Enter a stream URL starting with http:// or https://': 'Hãy nhập URL luồng bắt đầu bằng http:// hoặc https://',
    'Enter a value between 0.10 and 0.40': 'Nhập giá trị từ 0.10 đến 0.40', 'Enter 0.5 – 5 seconds': 'Nhập từ 0.5 – 5 giây',
    'Enter 10 – 60°': 'Nhập từ 10 – 60°', 'Enter 1 – 10 seconds': 'Nhập từ 1 – 10 giây',
    'Please fix the highlighted fields': 'Vui lòng sửa các trường được đánh dấu', 'Settings saved': 'Đã lưu cài đặt',
    'Defaults restored': 'Đã khôi phục mặc định', 'REAL history cleared': 'Đã xóa lịch sử REAL', 'DEMO session alerts cleared': 'Đã xóa cảnh báo phiên DEMO',
    'Restore all connection, camera and threshold settings to their defaults?': 'Khôi phục toàn bộ cài đặt kết nối, camera và ngưỡng về mặc định?',
    'Delete all REAL alert history and statistics stored in this browser?': 'Xóa toàn bộ lịch sử cảnh báo và thống kê REAL đã lưu trong trình duyệt này?'
  };

  var patterns = [
    [/^(.+) \(demo\)$/, function (m, t) { return t(m[1]) + ' (demo)'; }],
    [/^Connecting to (.+) and (.+)…$/, 'Đang kết nối tới $1 và $2…'],
    [/^Receiving live data from (.+) and (.+)$/, 'Đang nhận dữ liệu trực tiếp từ $1 và $2'],
    [/^(Arduino Uno|AI|AI service): (.+)$/, function (m, t) { return t(m[1]) + ': ' + t(m[2]); }],
    [/^Timeout after (\d+) ms$/, 'Hết thời gian chờ sau $1 ms'],
    [/^Switched to (DEMO|REAL) data$/, 'Đã chuyển sang dữ liệu $1'],
    [/^(\d+) alerts this session$/, '$1 cảnh báo trong phiên này'],
    [/^[Tt]hreshold (.+)$/, 'Ngưỡng $1'],
    [/^limit (.+)$/, 'giới hạn $1'],
    [/^Showing: (.+)$/, 'Đang hiển thị: $1'],
    [/^Message: (.+)$/, 'Nội dung: $1'],
    [/^Showing (\d+)–(\d+) of (\d+)$/, 'Hiển thị $1–$2 / $3'],
    [/^of (\d+) recorded$/, 'trong tổng số $1 cảnh báo'],
    [/^Exported (\d+) alerts$/, 'Đã xuất $1 cảnh báo'],
    [/^[Ll]ast (\d+) days$/, '$1 ngày qua'],
    [/^Active time \((.+)\)$/, function (m, t) { return 'Thời gian hoạt động (' + t(m[1]) + ')'; }],
    [/^Contacting (.+)…$/, 'Đang kết nối tới $1…'],
    [/^Connected in (\d+) ms$/, 'Kết nối thành công sau $1 ms'],
    [/^device (.+)$/, 'thiết bị $1'],
    [/^firmware (.+)$/, 'firmware $1'],
    [/^Request failed: (.+)$/, function (m, t) { return 'Yêu cầu thất bại: ' + t(m[1]); }],
    [/^Cannot load the stream at (.+)\. Check that the Python service is running and allows this origin\.$/,
      'Không tải được luồng video tại $1. Hãy kiểm tra dịch vụ Python đang chạy và cho phép truy cập từ địa chỉ này.'],
    [/^Webcam unavailable \((.+)\)\.$/, 'Không dùng được webcam ($1).'],
    [/^Connection settings saved \(DEMO mode is active – switch to REAL to use them\)$/,
      'Đã lưu cấu hình kết nối (đang ở chế độ DEMO – hãy chuyển sang REAL để sử dụng)'],
    [/^([\d.]+) h$/, '$1 giờ'],
    [/^yaw (.+), pitch (.+)$/, 'yaw $1, pitch $2']
  ];

  KI18n.register('vi', { dict: dict, patterns: patterns });
})();
