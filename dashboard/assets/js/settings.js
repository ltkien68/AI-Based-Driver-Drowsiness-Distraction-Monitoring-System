/* ==========================================================================
   KSafe AI – Settings page
   Luu cau hinh camera va nguong hien thi trong trinh duyet.
   Ket noi REAL su dung MQTT; Arduino Uno duoc Python dieu khien qua Serial.
   ========================================================================== */
(function () {
  'use strict';

  var KS = KSafe, UI = KUI;
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#settings-form');
  KIcons.hydrate(document);

  var FIELDS = ['cameraSource', 'cameraStreamUrl', 'cameraResolution', 'cameraFps',
    'cameraMirror', 'earThreshold', 'drowsySeconds', 'distractionYaw', 'distractionPitch', 'distractionSeconds'];
  var NUMERIC = ['cameraFps', 'earThreshold', 'drowsySeconds', 'distractionYaw', 'distractionPitch', 'distractionSeconds'];
  var input = function (k) { return document.getElementById(k); };
  var URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
  var RULES = {
    cameraStreamUrl: function (v) { return input('cameraSource').value === 'stream' && !URL_RE.test(v) ? 'Nhập URL stream bắt đầu bằng http:// hoặc https://' : ''; },
    earThreshold: function (v) { return !(v >= .1 && v <= .4) ? 'Nhập giá trị từ 0.10 đến 0.40' : ''; },
    drowsySeconds: function (v) { return !(v >= .5 && v <= 5) ? 'Nhập từ 0.5 đến 5 giây' : ''; },
    distractionYaw: function (v) { return !(v >= 10 && v <= 60) ? 'Nhập từ 10 đến 60°' : ''; },
    distractionPitch: function (v) { return !(v >= 10 && v <= 60) ? 'Nhập từ 10 đến 60°' : ''; },
    distractionSeconds: function (v) { return !(v >= 1 && v <= 10) ? 'Nhập từ 1 đến 10 giây' : ''; }
  };

  function read() {
    var o = {};
    FIELDS.forEach(function (k) {
      var el = input(k);
      o[k] = el.type === 'checkbox' ? el.checked : NUMERIC.indexOf(k) >= 0 ? (el.value === '' ? NaN : +el.value) : el.value.trim();
    });
    return o;
  }
  function write(s) {
    FIELDS.forEach(function (k) { var el = input(k); if (el.type === 'checkbox') el.checked = !!s[k]; else el.value = s[k]; });
    syncSliders(); toggleRows(); clearErrors();
  }
  function syncSliders() {
    form.querySelectorAll('input[type=range]').forEach(function (r) {
      var target = input(r.getAttribute('data-key')); if (target) r.value = target.value;
    });
  }
  function toggleRows() { $('#row-stream').hidden = input('cameraSource').value !== 'stream'; }
  function clearErrors() {
    form.querySelectorAll('[data-err]').forEach(function (e) { e.hidden = true; });
    form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
  }
  function validate() {
    var vals = read(), ok = true, first = null;
    Object.keys(RULES).forEach(function (k) {
      var msg = RULES[k](vals[k]), el = input(k), err = form.querySelector('[data-err="' + k + '"]');
      if (err) { err.hidden = !msg; err.textContent = msg; }
      if (msg) { el.setAttribute('aria-invalid', 'true'); ok = false; first = first || el; }
      else el.removeAttribute('aria-invalid');
    });
    if (first) first.focus();
    return ok;
  }
  function normalize(v) {
    v.cameraStreamUrl = v.cameraStreamUrl.replace(/\s+$/, '');
    return v;
  }
  function isDirty() {
    var cur = read(), saved = KS.settings.get();
    return FIELDS.some(function (k) { return String(cur[k]) !== String(saved[k]); });
  }
  function refreshDirty() {
    var d = isDirty(), st = $('#save-state');
    st.setAttribute('data-dirty', String(d));
    st.innerHTML = '<span class="dot dot--' + (d ? 'focus' : 'safe') + '"></span><span>' + (d ? 'Có thay đổi chưa lưu' : 'Đã lưu mọi thay đổi') + '</span>';
    $('#btn-discard').disabled = !d;
  }

  form.addEventListener('input', function (e) {
    var t = e.target;
    if (t.type === 'range') input(t.getAttribute('data-key')).value = t.value;
    else if (t.hasAttribute && t.hasAttribute('data-key')) {
      var r = form.querySelector('input[type=range][data-key="' + t.getAttribute('data-key') + '"]');
      if (r) r.value = t.value;
    }
    if (t.id === 'cameraSource') toggleRows();
    refreshDirty();
  });
  form.addEventListener('change', refreshDirty);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) { UI.toast('Vui lòng kiểm tra các trường được đánh dấu', 'error'); return; }
    KS.settings.set(normalize(read()));
    write(KS.settings.get()); refreshDirty();
    UI.toast('Đã lưu cài đặt', 'success');
  });
  $('#btn-discard').addEventListener('click', function () { write(KS.settings.get()); refreshDirty(); });
  $('#btn-defaults').addEventListener('click', function () {
    if (!confirm('Khôi phục cài đặt camera và ngưỡng về mặc định?')) return;
    KS.settings.reset(); write(KS.settings.get()); refreshDirty(); UI.toast('Đã khôi phục mặc định', 'info');
  });

  function paintMode() {
    var m = KS.mode();
    document.querySelectorAll('#seg-mode button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === m));
    });
    $('#mode-hint').textContent = m === 'demo'
      ? 'DEMO: dữ liệu mô phỏng trong trình duyệt, không đọc phần cứng.'
      : 'REAL: Dashboard nhận trạng thái và metrics từ Python AI Engine qua Mosquitto MQTT WebSocket. Arduino Uno được Python điều khiển qua Serial.';
  }
  $('#seg-mode').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]'); if (!b) return;
    KS.setMode(b.getAttribute('data-mode')); paintMode();
    UI.toast('Đã chuyển sang dữ liệu ' + b.getAttribute('data-mode').toUpperCase(), 'info');
  });

  $('#btn-clear-real').addEventListener('click', function () {
    if (!confirm('Xóa toàn bộ lịch sử cảnh báo và thống kê REAL trong trình duyệt?')) return;
    KS.alerts.clear('real'); KS.stats.clear('real'); UI.toast('Đã xóa lịch sử REAL', 'success');
  });
  $('#btn-clear-demo').addEventListener('click', function () {
    KS.alerts.clear('demo'); KS.stats.clear('demo'); UI.toast('Đã xóa lịch sử DEMO', 'success');
  });
  $('#btn-mqtt-logout').addEventListener('click', function () {
    if (!confirm('Ngắt MQTT và xóa mật khẩu đã lưu trong phiên tab này?')) return;
    if (KS.mqtt) KS.mqtt.logout();
    UI.toast('Đã xóa phiên MQTT. Chuyển sang REAL hoặc tải lại để đăng nhập lại.', 'success');
  });

  KS.bus.on('settings', function () { paintMode(); });
  write(KS.settings.get()); paintMode(); refreshDirty();
  window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  KS.onSnapshot(function () {});
})();
