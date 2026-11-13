/* ========================================================================
   KSafe AI - MQTT WebSocket client
   Nhan du lieu thuc tu Python AI Engine qua Mosquitto.
   Mat khau duoc luu trong sessionStorage de dung lai khi chuyen trang cung tab.
   ======================================================================== */
(function (global) {
  'use strict';

  var KS = global.KSafe;
  var MQTT_URL = 'ws://127.0.0.1:9001';
  var SESSION_KEY = 'ksafe.mqtt.credentials';
  var TOPICS = [
    'ksafe/driver/state',
    'ksafe/driver/metrics',
    'ksafe/system/connection',
    'ksafe/system/heartbeat'
  ];
  var client = null;
  var password = null;
  var connected = false;
  var started = false;
  var timer = null;
  var pythonConnection = null;
  var driverState = null;
  var metrics = null;
  var heartbeat = null;
  var lastError = null;
  var dialog = null;

  function emptyAI() {
    return { online: false, mediapipe: null, fps: null, camera: null, faceDetected: null,
      faceBox: null, ear: null, pitch: null, yaw: null, roll: null, gaze: null,
      state: null, drowsy: null, distracted: null };
  }

  function emptyArduino() {
    return { board: 'Arduino Uno', transport: 'Serial qua Python AI Engine',
      telemetry: false, status: 'NOT_REPORTED' };
  }

  function heartbeatIsFresh() {
    if (!heartbeat || !heartbeat.timestamp) return false;
    var age = Date.now() - heartbeat.timestamp * 1000;
    return age >= -300000 && age <= 15000;
  }

  function normalizeGaze(value) {
    if (!value) return null;
    var map = { CENTER: 'Center', LEFT: 'Left', RIGHT: 'Right', UP: 'Up', DOWN: 'Down',
      EYES_CLOSED: 'Eyes closed', 'EYES CLOSED': 'Eyes closed' };
    var key = String(value).trim().toUpperCase();
    return map[key] || String(value);
  }

  function buildSnapshot() {
    var online = connected && pythonConnection === 'ONLINE' && heartbeatIsFresh();
    var ai = emptyAI();
    ai.online = online;
    if (online && metrics) {
      ai.ear = finite(metrics.ear);
      ai.pitch = finite(metrics.head_pose && metrics.head_pose.pitch);
      ai.yaw = finite(metrics.head_pose && metrics.head_pose.yaw);
      ai.roll = finite(metrics.head_pose && metrics.head_pose.roll);
      ai.gaze = normalizeGaze(metrics.eye_direction);
    }
    ai.state = online ? (['SAFE', 'FOCUS', 'DANGER', 'UNKNOWN'].indexOf(driverState) >= 0 ? driverState : 'UNKNOWN') : null;

    var errors = {};
    if (!connected) errors.mqtt = lastError || 'Chua ket noi Mosquitto qua WebSocket';
    else if (!online) errors.ai = pythonConnection !== 'ONLINE' ? 'Python AI dang OFFLINE' : 'Heartbeat da qua han hoac chua nhan duoc';

    return {
      mode: 'real',
      ts: Date.now(),
      pending: !connected,
      ai: ai,
      arduino: emptyArduino(),
      errors: errors,
      driver: null,
      mqtt: { connected: connected, pythonConnection: pythonConnection,
        heartbeat: heartbeat, heartbeatFresh: heartbeatIsFresh(), url: MQTT_URL }
    };
  }

  function publishSnapshot() {
    if (KS.mode() === 'real') KS.ingest(buildSnapshot());
  }

  function finite(value) {
    return value === null || value === undefined || value === '' || !isFinite(Number(value)) ? null : Number(value);
  }

  function log(message) {
    console.info('[KSafe MQTT] ' + message);
  }

  function removeDialog() {
    if (dialog && dialog.parentNode) dialog.parentNode.removeChild(dialog);
    dialog = null;
  }

  function showPasswordDialog() {
    if (dialog) return;
    dialog = document.createElement('div');
    dialog.className = 'ks-mqtt-overlay';
    dialog.innerHTML =
      '<form class="ks-mqtt-dialog" autocomplete="off">' +
        '<h2>Kết nối KSafe AI</h2>' +
        '<p>Nhập mật khẩu MQTT để nhận dữ liệu trực tiếp từ Python AI Engine.</p>' +
        '<label>Tài khoản MQTT</label>' +
        '<input type="text" value="ksafe" readonly>' +
        '<label for="ks-mqtt-password">Mật khẩu MQTT</label>' +
        '<input id="ks-mqtt-password" type="password" autocomplete="current-password" required>' +
        '<div class="ks-mqtt-error" role="alert"></div>' +
        '<div class="ks-mqtt-actions">' +
          '<button type="button" class="ks-mqtt-cancel">Để sau</button>' +
          '<button type="submit" class="ks-mqtt-submit">Kết nối</button>' +
        '</div>' +
        '<small>Mật khẩu được lưu trong sessionStorage của tab hiện tại để không phải nhập lại khi chuyển trang. Đóng tab sẽ kết thúc phiên.</small>' +
      '</form>';
    var style = document.createElement('style');
    style.textContent =
      '.ks-mqtt-overlay{position:fixed;inset:0;z-index:99999;background:rgba(8,15,28,.72);display:grid;place-items:center;padding:20px}' +
      '.ks-mqtt-dialog{width:min(420px,100%);background:#fff;color:#172033;border-radius:16px;padding:26px;box-shadow:0 24px 70px rgba(0,0,0,.3);font-family:inherit}' +
      '.ks-mqtt-dialog h2{margin:0 0 8px;font-size:21px}.ks-mqtt-dialog p{margin:0 0 20px;color:#64748b;line-height:1.5}' +
      '.ks-mqtt-dialog label{display:block;font-size:13px;font-weight:600;margin:12px 0 6px}' +
      '.ks-mqtt-dialog input{box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}' +
      '.ks-mqtt-actions{display:flex;justify-content:flex-end;gap:8px;margin:18px 0 12px}' +
      '.ks-mqtt-actions button{border:0;border-radius:8px;padding:10px 16px;cursor:pointer;font:inherit}' +
      '.ks-mqtt-cancel{background:#e2e8f0;color:#334155}.ks-mqtt-submit{background:#1877f2;color:#fff}' +
      '.ks-mqtt-error{color:#dc2626;font-size:13px;margin-top:8px;min-height:18px}' +
      '.ks-mqtt-dialog small{color:#64748b;line-height:1.4;display:block}';
    document.head.appendChild(style);
    document.body.appendChild(dialog);
    var form = dialog.querySelector('form');
    var input = dialog.querySelector('#ks-mqtt-password');
    var error = dialog.querySelector('.ks-mqtt-error');
    dialog.querySelector('.ks-mqtt-cancel').addEventListener('click', function () {
      removeDialog(); lastError = 'Chua nhap mat khau MQTT'; publishSnapshot();
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!input.value) { error.textContent = 'Vui lòng nhập mật khẩu.'; input.focus(); return; }
      password = input.value;
      removeDialog();
      connect();
    });
    input.focus();
  }

  function connect() {
    if (!global.mqtt || typeof global.mqtt.connect !== 'function') {
      lastError = 'Khong tai duoc thu vien MQTT.js. Kiem tra ket noi Internet/CDN.';
      publishSnapshot();
      log(lastError);
      return;
    }
    if (client) { try { client.end(true); } catch (e) {} client = null; }
    connected = false;
    lastError = null;
    client = global.mqtt.connect(MQTT_URL, {
      username: 'ksafe',
      password: password,
      clientId: 'ksafe-dashboard-' + Math.random().toString(16).slice(2, 10),
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 3000,
      keepalive: 30
    });

    client.on('connect', function () {
      connected = true; lastError = null;
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: 'ksafe', password: password }));
      } catch (storageError) {
        log('Khong the luu phien MQTT trong sessionStorage: ' + storageError.message);
      }
      log('Da ket noi Mosquitto qua WebSocket.');
      client.subscribe(TOPICS, { qos: 1 }, function (error) {
        if (error) { lastError = 'Subscribe that bai: ' + error.message; log(lastError); }
        publishSnapshot();
      });
    });
    client.on('message', function (topic, payload) {
      var value = payload.toString();
      try {
        if (topic === 'ksafe/driver/state') driverState = value.trim().toUpperCase();
        else if (topic === 'ksafe/system/connection') pythonConnection = value.trim().toUpperCase();
        else if (topic === 'ksafe/driver/metrics') metrics = JSON.parse(value);
        else if (topic === 'ksafe/system/heartbeat') heartbeat = JSON.parse(value);
      } catch (error) {
        log('Payload khong hop le tai ' + topic + ': ' + error.message);
      }
      publishSnapshot();
    });
    client.on('reconnect', function () {
      connected = false; log('Dang ket noi lai Broker...'); publishSnapshot();
    });
    client.on('offline', function () {
      connected = false; lastError = 'MQTT client offline'; publishSnapshot();
    });
    client.on('close', function () {
      connected = false; publishSnapshot();
    });
    client.on('error', function (error) {
      lastError = error && error.message ? error.message : 'MQTT connection error';
      log(lastError); publishSnapshot();
      if (/not authorized|bad user name|password/i.test(lastError)) {
        try { client.end(true); } catch (e) {}
        client = null; connected = false; password = null;
        try { sessionStorage.removeItem(SESSION_KEY); } catch (storageError) {}
        showPasswordDialog();
      }
    });
  }

  function start() {
    if (started) return;
    started = true;
    if (timer) clearInterval(timer);
    timer = setInterval(publishSnapshot, 1000);

    // Tai lai thong tin dang nhap cua cung tab neu da ket noi thanh cong truoc do.
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) {}
    if (saved && saved.username === 'ksafe' && saved.password) {
      password = saved.password;
      connect();
    } else {
      showPasswordDialog();
    }
    publishSnapshot();
  }

  function logout() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    removeDialog();
    if (client) { try { client.end(true); } catch (e) {} client = null; }
    password = null;
    connected = false;
    pythonConnection = null;
    driverState = null;
    metrics = null;
    heartbeat = null;
    lastError = 'Da dang xuat MQTT';
    publishSnapshot();
    log('Da xoa phien dang nhap MQTT.');
  }

  function stop() {
    started = false;
    removeDialog();
    if (timer) { clearInterval(timer); timer = null; }
    if (client) { try { client.end(true); } catch (e) {} client = null; }
    connected = false;
    password = null;
    pythonConnection = null;
    driverState = null;
    metrics = null;
    heartbeat = null;
    lastError = null;
  }

  KS.mqtt = { start: start, stop: stop, logout: logout, status: function () {
    return { connected: connected, pythonConnection: pythonConnection, heartbeat: heartbeat,
      heartbeatFresh: heartbeatIsFresh() };
  } };
})(window);
