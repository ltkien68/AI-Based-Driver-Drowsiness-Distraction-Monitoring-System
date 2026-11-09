/* ==========================================================================
   KSafe AI – Data layer
   --------------------------------------------------------------------------
   Mọi trang đọc dữ liệu qua một "snapshot" duy nhất, nên đổi nguồn dữ liệu chỉ cần sửa file này.

   Có 2 nguồn dữ liệu, KHÔNG BAO GIỜ trộn lẫn:
     • DEMO : dữ liệu mô phỏng tạo ngay trên trình duyệt, chỉ để hoàn thiện UI.
              Mọi màn hình đều gắn nhãn DEMO khi đang dùng nguồn này.
     • REAL : đọc từ thiết bị thật. Nếu không kết nối được thì hiển thị Offline / "—",
              tuyệt đối không bịa số liệu.

   Hợp đồng API cho giai đoạn tích hợp (xem README.md để biết đầy đủ):
     ESP32 (HTTP server trong LAN):
        GET  http://<esp32-ip>/api/status        → trạng thái thiết bị (xem normalizeEsp32)
        POST http://<esp32-ip>/api/state         → { "state": "SAFE|FOCUS|DANGER" }
        POST http://<esp32-ip>/api/reset/ack     → xác nhận đã reset cảnh báo
     Python AI (OpenCV + MediaPipe):
        GET  <apiEndpoint>/api/ai/status         → số đo realtime (xem normalizeAI)
        GET  <apiEndpoint>/video_feed            → MJPEG stream (tuỳ chọn, dùng cho camera)

   Muốn thêm WebSocket: viết một source mới có cùng giao diện { start(), stop() } rồi
   gọi KSafe.ingest(snapshot) mỗi khi có dữ liệu — phần UI không cần thay đổi.
   ========================================================================== */
(function (global) {
  'use strict';

  var KS = (global.KSafe = global.KSafe || {});
  KS.version = '0.1.0';

  /* ------------------------------------------------------------------ */
  /* Event bus                                                           */
  /* ------------------------------------------------------------------ */
  var handlers = {};
  KS.bus = {
    on: function (evt, fn) {
      (handlers[evt] = handlers[evt] || []).push(fn);
      return function () { handlers[evt] = (handlers[evt] || []).filter(function (f) { return f !== fn; }); };
    },
    emit: function (evt, data) {
      (handlers[evt] || []).slice().forEach(function (fn) {
        try { fn(data); } catch (e) { console.error('[KSafe] handler error on "' + evt + '"', e); }
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Utilities                                                           */
  /* ------------------------------------------------------------------ */
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var util = KS.util = {
    pad: pad,
    clamp: function (v, a, b) { return Math.min(b, Math.max(a, v)); },
    lerp: function (a, b, k) { return a + (b - a) * k; },
    time: function (ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); },
    dateKey: function (ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    dateLabel: function (ts) { var d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); },
    shortDate: function (ts) { var d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); },
    midnight: function (ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); },
    duration: function (sec) {
      sec = Math.max(0, Math.floor(sec));
      var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      return h ? h + 'h ' + pad(m) + 'm ' + pad(s) + 's' : m ? m + 'm ' + pad(s) + 's' : s + 's';
    },
    hours: function (sec) { return (sec / 3600).toFixed(1); },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    load: function (storage, key, fallback) {
      try { var v = storage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    save: function (storage, key, val) { try { storage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage đầy/bị chặn: bỏ qua */ } },
    prng: function (seed) { // mulberry32 – ngẫu nhiên có seed, để dữ liệu demo lịch sử ổn định giữa các lần tải
      var a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  };

  /* ------------------------------------------------------------------ */
  /* Settings (localStorage)                                             */
  /* ------------------------------------------------------------------ */
  var SETTINGS_KEY = 'ksafe.settings.v1';
  var DEFAULTS = {
    mode: 'demo',                       // 'demo' | 'real'
    esp32Ip: '192.168.1.50',
    apiEndpoint: 'http://localhost:8000',
    pollIntervalMs: 1000,
    requestTimeoutMs: 2500,
    cameraSource: 'none',               // 'none' | 'stream' | 'webcam'
    cameraStreamUrl: 'http://localhost:8000/video_feed',
    cameraResolution: '640x480',
    cameraFps: 30,
    cameraMirror: true,
    earThreshold: 0.21,                 // EAR < ngưỡng ⇒ mắt nhắm
    drowsySeconds: 2,                   // mắt nhắm liên tục ≥ N giây ⇒ buồn ngủ (DANGER)
    distractionYaw: 25,                 // |yaw| > N° ⇒ nhìn lệch hướng
    distractionPitch: 20,               // |pitch| > N° ⇒ nhìn lên/xuống
    distractionSeconds: 3               // lệch hướng liên tục ≥ N giây ⇒ mất tập trung (DANGER)
  };
  var settingsCache = null;
  KS.settings = {
    defaults: DEFAULTS,
    get: function () {
      if (!settingsCache) settingsCache = Object.assign({}, DEFAULTS, util.load(localStorage, SETTINGS_KEY, {}));
      return settingsCache;
    },
    set: function (patch) {
      settingsCache = Object.assign({}, KS.settings.get(), patch);
      util.save(localStorage, SETTINGS_KEY, settingsCache);
      KS.bus.emit('settings', settingsCache);
      return settingsCache;
    },
    reset: function () {
      var mode = KS.settings.get().mode;
      settingsCache = Object.assign({}, DEFAULTS, { mode: mode });
      util.save(localStorage, SETTINGS_KEY, settingsCache);
      KS.bus.emit('settings', settingsCache);
      return settingsCache;
    }
  };
  KS.mode = function () { return KS.settings.get().mode === 'real' ? 'real' : 'demo'; };
  KS.setMode = function (mode) { KS.settings.set({ mode: mode === 'real' ? 'real' : 'demo' }); };

  /* ------------------------------------------------------------------ */
  /* Session (mỗi tab trình duyệt = 1 phiên hoạt động)                   */
  /* ------------------------------------------------------------------ */
  function session() {
    var s = util.load(sessionStorage, 'ksafe.session', null);
    if (!s || !s.start) { s = { start: Date.now() }; util.save(sessionStorage, 'ksafe.session', s); }
    return s;
  }
  KS.sessionStart = function () { return session().start; };

  /* ------------------------------------------------------------------ */
  /* Alerts store                                                        */
  /* ------------------------------------------------------------------ */
  var EVENT_META = {
    'Eye Closure':         { category: 'drowsiness',  severity: 'Warning' },
    'Drowsiness':          { category: 'drowsiness',  severity: 'Critical' },
    'Distraction':         { category: 'distraction', severity: 'Warning' },
    'Head Pose Deviation': { category: 'distraction', severity: 'Warning' },
    'Driver Safe':         { category: 'safe',        severity: 'Normal' }
  };
  KS.EVENT_META = EVENT_META;

  var ALERT_KEYS = { demo: 'ksafe.alerts.demo.live', real: 'ksafe.alerts.real' };
  var alertStore = {
    demo: function () { return util.load(sessionStorage, ALERT_KEYS.demo, []); },
    real: function () { return util.load(localStorage, ALERT_KEYS.real, []); }
  };
  function saveAlerts(mode, list) {
    if (list.length > 1000) list = list.slice(-1000);
    util.save(mode === 'demo' ? sessionStorage : localStorage, ALERT_KEYS[mode], list);
  }

  /* Lịch sử DEMO (các ngày trước): sinh ngẫu nhiên có seed, ổn định giữa các lần tải. */
  var demoSeedCache = null;
  function demoSeedAlerts() {
    var today = util.midnight(Date.now());
    if (demoSeedCache && demoSeedCache.today === today) return demoSeedCache.list;
    var list = [], DAY = 86400000;
    var types = [['Eye Closure', .25], ['Drowsiness', .2], ['Distraction', .35], ['Head Pose Deviation', .2]];
    for (var d = 1; d <= 13; d++) {
      var rng = util.prng(d * 7919 + 13);
      var n = Math.floor(rng() * 6);
      var lo = 7 * 3600, hi = (d === 1 ? 14 : 20) * 3600 - 1800; // hôm qua: để dành khung 14:25–14:30 cho 4 dòng demo theo đặc tả
      for (var i = 0; i < n; i++) {
        var r = rng(), acc = 0, type = types[0][0];
        for (var k = 0; k < types.length; k++) { acc += types[k][1]; if (r <= acc) { type = types[k][0]; break; } }
        var ts = today - d * DAY + (lo + Math.floor(rng() * (hi - lo))) * 1000;
        list.push({ id: 'seed-' + d + '-' + i, ts: ts, event: type, category: EVENT_META[type].category,
          severity: EVENT_META[type].severity, status: 'Resolved', source: 'demo',
          detail: 'Seeded demo history' });
      }
    }
    // 4 dòng demo đúng như đặc tả (dữ liệu DEMO, đặt vào ngày hôm qua)
    var y = today - DAY;
    [['14:30:05', 'Driver Safe', 'Resolved'], ['14:29:42', 'Eye Closure', 'Detected'],
     ['14:28:16', 'Drowsiness', 'Detected'], ['14:25:10', 'Distraction', 'Resolved']].forEach(function (row, idx) {
      var p = row[0].split(':').map(Number);
      list.push({ id: 'seed-spec-' + idx, ts: y + (p[0] * 3600 + p[1] * 60 + p[2]) * 1000, event: row[1],
        category: EVENT_META[row[1]].category, severity: EVENT_META[row[1]].severity, status: row[2],
        source: 'demo', detail: 'Seeded demo history' });
    });
    demoSeedCache = { today: today, list: list };
    return list;
  }

  KS.alerts = {
    /** Trả về danh sách cảnh báo của nguồn `mode`, mới nhất trước. */
    list: function (mode) {
      mode = mode || KS.mode();
      var live = alertStore[mode]();
      var all = mode === 'demo' ? demoSeedAlerts().concat(live) : live;
      return all.slice().sort(function (a, b) { return b.ts - a.ts; });
    },
    add: function (mode, event, detail) {
      var meta = EVENT_META[event] || { category: 'distraction', severity: 'Warning' };
      var list = alertStore[mode]();
      var a = { id: mode + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e4), ts: Date.now(), event: event,
        category: meta.category, severity: meta.severity, status: meta.severity === 'Normal' ? 'Resolved' : 'Detected',
        source: mode, detail: detail || '' };
      list.push(a);
      saveAlerts(mode, list);
      KS.bus.emit('alerts', a);
      return a;
    },
    /** Đánh dấu Resolved cho các cảnh báo đang mở (do phiên hiện tại tạo ra). */
    resolveOpen: function (mode) {
      var list = alertStore[mode](), changed = false;
      list.forEach(function (a) { if (a.status === 'Detected') { a.status = 'Resolved'; changed = true; } });
      if (changed) { saveAlerts(mode, list); KS.bus.emit('alerts'); }
    },
    clear: function (mode) {
      (mode === 'demo' ? sessionStorage : localStorage).removeItem(ALERT_KEYS[mode]);
      KS.bus.emit('alerts');
    },
    /** Số cảnh báo (Warning/Critical) phát sinh trong phiên hiện tại. */
    sessionCount: function (mode) {
      var start = KS.sessionStart();
      return alertStore[mode || KS.mode()]().filter(function (a) { return a.severity !== 'Normal' && a.ts >= start; }).length;
    }
  };

  /* ------------------------------------------------------------------ */
  /* Stats store (thời gian hoạt động / thời gian theo trạng thái)       */
  /* ------------------------------------------------------------------ */
  var STATS_KEYS = { demo: 'ksafe.stats.demo.live', real: 'ksafe.stats.real' };
  var statsStore = {
    demo: function () { return util.load(sessionStorage, STATS_KEYS.demo, {}); },
    real: function () { return util.load(localStorage, STATS_KEYS.real, {}); }
  };
  function demoSeedStats(dayIndex) {
    var rng = util.prng(dayIndex * 104729 + 7);
    var active = 9000 + rng() * 16000;
    var danger = active * (0.008 + rng() * 0.02);
    var focus = active * (0.04 + rng() * 0.05);
    return { active: active, SAFE: active - danger - focus, FOCUS: focus, DANGER: danger };
  }
  var zero = function () { return { active: 0, SAFE: 0, FOCUS: 0, DANGER: 0 }; };

  KS.stats = {
    add: function (mode, state, dt) {
      if (state !== 'SAFE' && state !== 'FOCUS' && state !== 'DANGER') return;
      var s = statsStore[mode](), key = util.dateKey(Date.now());
      var day = s[key] || zero();
      day.active += dt; day[state] += dt;
      s[key] = day;
      util.save(mode === 'demo' ? sessionStorage : localStorage, STATS_KEYS[mode], s);
    },
    /** Mảng `n` ngày gần nhất (cũ → mới), mỗi phần tử { key, ts, active, SAFE, FOCUS, DANGER } (giây). */
    days: function (mode, n) {
      mode = mode || KS.mode();
      var live = statsStore[mode](), out = [], today = util.midnight(Date.now());
      for (var i = n - 1; i >= 0; i--) {
        var ts = today - i * 86400000, key = util.dateKey(ts);
        var v = live[key] || (mode === 'demo' && i > 0 ? demoSeedStats(i) : zero());
        out.push({ key: key, ts: ts, active: v.active, SAFE: v.SAFE, FOCUS: v.FOCUS, DANGER: v.DANGER });
      }
      return out;
    },
    clear: function (mode) {
      (mode === 'demo' ? sessionStorage : localStorage).removeItem(STATS_KEYS[mode]);
    }
  };

  /* ------------------------------------------------------------------ */
  /* HTTP helper                                                         */
  /* ------------------------------------------------------------------ */
  function baseUrl(host) {
    host = String(host || '').trim().replace(/\/+$/, '');
    if (!host) return '';
    return /^https?:\/\//i.test(host) ? host : 'http://' + host;
  }
  function http(url, opts) {
    opts = opts || {};
    var timeout = opts.timeout || KS.settings.get().requestTimeoutMs;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeout);
    var t0 = performance.now();
    return fetch(url, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal, cache: 'no-store'
    }).then(function (res) {
      var ms = Math.round(performance.now() - t0);
      if (!res.ok) return { ok: false, status: res.status, ms: ms, error: 'HTTP ' + res.status };
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
        return { ok: true, status: res.status, ms: ms, data: data };
      });
    }).catch(function (err) {
      var aborted = err && err.name === 'AbortError';
      return { ok: false, ms: Math.round(performance.now() - t0),
        error: aborted ? 'Timeout after ' + timeout + ' ms' : 'Network error – device offline, wrong address, or CORS not enabled on the device' };
    }).then(function (r) { clearTimeout(timer); return r; });
  }

  /* ------------------------------------------------------------------ */
  /* Snapshot shape                                                      */
  /* ------------------------------------------------------------------ */
  function emptyAI() {
    return { online: false, mediapipe: null, fps: null, camera: null, faceDetected: null, faceBox: null,
      ear: null, pitch: null, yaw: null, roll: null, gaze: null, state: null, drowsy: null, distracted: null };
  }
  function emptyESP() {
    return { connected: false, ip: null, deviceId: null, firmware: null, uptimeSec: null, responseMs: null, state: null,
      wifi: { connected: null, ssid: null, rssi: null },
      led: { color: null }, buzzer: { active: null }, oled: { ok: null, text: null }, lcd: { ok: null, text: null },
      button: { resetPending: null } };
  }
  function emptySnapshot(mode) {
    return { mode: mode, ts: Date.now(), pending: true, ai: emptyAI(), esp32: emptyESP(), errors: {}, driver: null };
  }

  /* ------------------------------------------------------------------ */
  /* DEMO source – mô phỏng, chỉ phục vụ hoàn thiện giao diện            */
  /* Kịch bản lặp 120 giây, là hàm thuần của thời gian ⇒ các trang khác   */
  /* nhau vẫn hiển thị liên tục khi chuyển trang trong cùng một phiên.   */
  /* ------------------------------------------------------------------ */
  var Demo = (function () {
    var CYCLE = 120;
    // Mỗi phase: khoảng thời gian (giây trong chu kỳ) và các giá trị đo mục tiêu.
    var PHASES = [
      { from: 0,    to: 25,   ear: .31, yaw: 2,   pitch: 3,   roll: 1, gaze: 'Center' },
      { from: 25,   to: 26.6, ear: .15, yaw: 1,   pitch: 5,   roll: 1, gaze: 'Eyes closed' },     // chớp mắt dài → FOCUS
      { from: 26.6, to: 45,   ear: .31, yaw: -2,  pitch: 2,   roll: 0, gaze: 'Center' },
      { from: 45,   to: 47.6, ear: .30, yaw: -32, pitch: 4,   roll: 3, gaze: 'Left' },            // nhìn lệch → FOCUS
      { from: 47.6, to: 70,   ear: .31, yaw: 3,   pitch: 2,   roll: 0, gaze: 'Center' },
      { from: 70,   to: 72,   ear: .14, yaw: 0,   pitch: -8,  roll: 2, gaze: 'Eyes closed' },     // mắt nhắm → FOCUS
      { from: 72,   to: 78,   ear: .09, yaw: 0,   pitch: -19, roll: 6, gaze: 'Eyes closed' },     // kéo dài → DANGER
      { from: 78,   to: 120,  ear: .31, yaw: 1,   pitch: 3,   roll: 1, gaze: 'Center' }
    ];
    var noise = function (t, f) { return Math.sin(t * f) * 0.6 + Math.sin(t * f * 2.3 + 1.7) * 0.4; };

    function metricsAt(now) {
      var t = ((now - KS.sessionStart()) / 1000) % CYCLE, i = 0;
      for (var k = 0; k < PHASES.length; k++) { if (t >= PHASES[k].from && t < PHASES[k].to) { i = k; break; } }
      var cur = PHASES[i], prev = PHASES[(i + PHASES.length - 1) % PHASES.length];
      var kk = util.clamp((t - cur.from) / 0.5, 0, 1);       // chuyển pha mượt trong 0.5s
      var mix = function (key) { return util.lerp(prev[key], cur[key], kk); };
      var closed = mix('ear') < .2;
      return {
        ear: +(mix('ear') + noise(t, 3.1) * (closed ? .004 : .011)).toFixed(3),
        yaw: +(mix('yaw') + noise(t, 1.3) * 1.8).toFixed(1),
        pitch: +(mix('pitch') + noise(t, 1.7) * 1.4).toFixed(1),
        roll: +(mix('roll') + noise(t, 1.1) * 1.2).toFixed(1),
        gaze: cur.gaze,
        fps: +(29.4 + noise(t, 2.2) * .9).toFixed(1)
      };
    }

    return {
      snapshot: function (now) {
        var m = metricsAt(now);
        var snap = emptySnapshot('demo');
        snap.ts = now; snap.pending = false;
        snap.ai = Object.assign(emptyAI(), { online: true, mediapipe: 'Tracking', fps: m.fps, camera: 'demo', faceDetected: true,
          ear: m.ear, pitch: m.pitch, yaw: m.yaw, roll: m.roll, gaze: m.gaze });
        var up = 5025 + (now - KS.sessionStart()) / 1000;
        snap.esp32 = Object.assign(emptyESP(), { connected: true, ip: '192.168.1.50', deviceId: 'KSAFE-ESP32-DEMO', firmware: 'v0.1.0-demo',
          uptimeSec: up, responseMs: 18 + Math.round(noise(now / 1000, 2) * 5),
          wifi: { connected: true, ssid: 'KSafe-LAN', rssi: Math.round(-58 + noise(now / 1000, .4) * 3) } });
        return snap;
      },
      /* Trạng thái thiết bị ngoại vi mô phỏng suy ra từ trạng thái tài xế */
      fillDevices: function (snap) {
        var s = snap.driver.state, e = snap.esp32;
        e.state = s;
        e.led = { color: s === 'SAFE' ? 'green' : s === 'FOCUS' ? 'yellow' : 'red' };
        e.buzzer = { active: s === 'DANGER' };
        e.oled = { ok: true, text: s };
        e.lcd = { ok: true, text: 'KSAFE AI | ' + s };
        e.button = { resetPending: s === 'DANGER' };
      }
    };
  })();

  /* ------------------------------------------------------------------ */
  /* REAL source – ESP32 + Python AI                                     */
  /* ------------------------------------------------------------------ */
  function dig(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function firstOf(obj, paths) {
    for (var i = 0; i < paths.length; i++) { var v = dig(obj, paths[i]); if (v !== undefined && v !== null) return v; }
    return null;
  }
  var num = function (v) { return v == null || v === '' || isNaN(+v) ? null : +v; };

  /* Chuẩn hoá JSON của ESP32 /api/status. Chấp nhận nhiều cách đặt tên field;
     field nào thiết bị không gửi sẽ là null và UI hiển thị "Unknown", không bịa. */
  KS.normalizeEsp32 = function (j, base) {
    var e = emptyESP();
    j = j || {};
    e.connected = true;
    e.deviceId = firstOf(j, ['device_id', 'deviceId', 'id']);
    e.firmware = firstOf(j, ['firmware', 'firmware_version', 'fw', 'version']);
    e.ip = firstOf(j, ['ip', 'ip_address', 'wifi.ip']) || String(base || '').replace(/^https?:\/\//, '');
    e.uptimeSec = num(firstOf(j, ['uptime_s', 'uptime', 'uptimeSec']));
    e.state = firstOf(j, ['state', 'driver_state']);
    var wc = firstOf(j, ['wifi.connected', 'wifi_connected']);
    e.wifi = { connected: wc === null ? true : !!wc, // nhận được phản hồi qua mạng ⇒ thiết bị đang có mạng
      ssid: firstOf(j, ['wifi.ssid', 'ssid']), rssi: num(firstOf(j, ['wifi.rssi', 'rssi'])) };
    var led = firstOf(j, ['led.color', 'led_color', 'led']);
    e.led = { color: typeof led === 'string' ? led.toLowerCase() : null };
    var bz = firstOf(j, ['buzzer.active', 'buzzer_on', 'buzzer']);
    e.buzzer = { active: bz === null ? null : !!bz };
    var oledOk = firstOf(j, ['oled.ok', 'oled_ok']), lcdOk = firstOf(j, ['lcd.ok', 'lcd_ok']);
    e.oled = { ok: oledOk === null ? null : !!oledOk, text: firstOf(j, ['oled.text', 'oled_text']) };
    e.lcd = { ok: lcdOk === null ? null : !!lcdOk, text: firstOf(j, ['lcd.text', 'lcd_text']) };
    var rp = firstOf(j, ['button.reset_pending', 'reset_pending', 'button.pressed']);
    e.button = { resetPending: rp === null ? null : !!rp };
    return e;
  };

  /* Chuẩn hoá JSON của Python AI /api/ai/status */
  KS.normalizeAI = function (j) {
    var a = emptyAI();
    j = j || {};
    var online = firstOf(j, ['online', 'running']);
    a.online = online === null ? true : !!online;
    a.fps = num(firstOf(j, ['fps']));
    a.camera = firstOf(j, ['camera', 'camera_status']);
    var fd = firstOf(j, ['face_detected', 'faceDetected']);
    a.faceDetected = fd === null ? null : !!fd;
    a.mediapipe = firstOf(j, ['mediapipe', 'mediapipe_status']) || (fd === null ? null : fd ? 'Tracking' : 'No face');
    a.ear = num(firstOf(j, ['ear', 'metrics.ear']));
    a.pitch = num(firstOf(j, ['pitch', 'head.pitch', 'metrics.pitch']));
    a.yaw = num(firstOf(j, ['yaw', 'head.yaw', 'metrics.yaw']));
    a.roll = num(firstOf(j, ['roll', 'head.roll', 'metrics.roll']));
    a.gaze = firstOf(j, ['gaze', 'eye_direction', 'metrics.gaze']);
    var st = firstOf(j, ['state', 'driver_state']);
    a.state = typeof st === 'string' ? st.toUpperCase() : null;
    var dr = firstOf(j, ['drowsy', 'drowsiness']), di = firstOf(j, ['distracted', 'distraction']);
    a.drowsy = dr === null ? null : !!dr;
    a.distracted = di === null ? null : !!di;
    var fb = j.face_box || j.faceBox;
    if (fb && num(fb.x) !== null) a.faceBox = { x: +fb.x, y: +fb.y, w: +fb.w, h: +fb.h }; // toạ độ chuẩn hoá 0..1
    return a;
  };

  var Real = {
    poll: function () {
      var s = KS.settings.get();
      var espBase = baseUrl(s.esp32Ip), aiBase = baseUrl(s.apiEndpoint);
      var pEsp = espBase ? http(espBase + '/api/status') : Promise.resolve({ ok: false, error: 'ESP32 IP address not configured' });
      var pAi = aiBase ? http(aiBase + '/api/ai/status') : Promise.resolve({ ok: false, error: 'API endpoint not configured' });
      return Promise.all([pEsp, pAi]).then(function (res) {
        var snap = emptySnapshot('real');
        snap.pending = false;
        if (res[0].ok) { snap.esp32 = KS.normalizeEsp32(res[0].data, espBase); snap.esp32.responseMs = res[0].ms; }
        else { snap.errors.esp32 = res[0].error; if (espBase) snap.esp32.ip = espBase.replace(/^https?:\/\//, ''); }
        if (res[1].ok) snap.ai = KS.normalizeAI(res[1].data);
        else snap.errors.ai = res[1].error;
        return snap;
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Phân loại trạng thái tài xế + ghi cảnh báo khi trạng thái đổi       */
  /* ------------------------------------------------------------------ */
  function trackerKey(mode) { return 'ksafe.tracker.' + mode; }

  function deriveDriver(snap, now) {
    var s = KS.settings.get(), ai = snap.ai, mode = snap.mode;
    var tr = util.load(sessionStorage, trackerKey(mode), {});
    var d = { state: 'UNKNOWN', since: now, cause: null, eyesClosed: false, lookingAway: false, drowsy: false, distracted: false,
      closedFor: 0, awayFor: 0 };

    if (ai.online) {
      d.eyesClosed = ai.ear !== null && ai.ear < s.earThreshold;
      d.lookingAway = (ai.yaw !== null && Math.abs(ai.yaw) > s.distractionYaw) || (ai.pitch !== null && Math.abs(ai.pitch) > s.distractionPitch);
      tr.closedSince = d.eyesClosed ? (tr.closedSince || now) : null;
      tr.awaySince = d.lookingAway ? (tr.awaySince || now) : null;
      d.closedFor = tr.closedSince ? (now - tr.closedSince) / 1000 : 0;
      d.awayFor = tr.awaySince ? (now - tr.awaySince) / 1000 : 0;
      d.drowsy = ai.drowsy !== null ? ai.drowsy : d.closedFor >= s.drowsySeconds;
      d.distracted = ai.distracted !== null ? ai.distracted : d.awayFor >= s.distractionSeconds;

      var noFace = ai.faceDetected === false;
      if (ai.state === 'SAFE' || ai.state === 'FOCUS' || ai.state === 'DANGER') d.state = ai.state; // Python quyết định → ưu tiên
      else d.state = (d.drowsy || d.distracted) ? 'DANGER' : (d.eyesClosed || d.lookingAway || noFace) ? 'FOCUS' : 'SAFE';
      d.cause = (d.drowsy || d.eyesClosed) ? 'drowsiness' : (d.distracted || d.lookingAway) ? 'distraction' : noFace ? 'noface' : null;
    } else {
      tr.closedSince = null; tr.awaySince = null;
    }

    var prev = tr.state;
    if (prev === d.state && tr.since) d.since = tr.since; else d.since = now;

    // Ghi cảnh báo khi trạng thái chuyển đổi (không ghi lần đầu, không ghi khi mất kết nối)
    if (prev && prev !== d.state && d.state !== 'UNKNOWN' && prev !== 'UNKNOWN') {
      if (d.state === 'FOCUS' && prev === 'SAFE') {
        KS.alerts.add(mode, d.cause === 'drowsiness' ? 'Eye Closure' : 'Distraction',
          d.cause === 'drowsiness' ? 'EAR below threshold' : d.cause === 'noface' ? 'Face not detected' : 'Head pose outside normal range');
      } else if (d.state === 'DANGER') {
        KS.alerts.add(mode, d.cause === 'drowsiness' ? 'Drowsiness' : 'Distraction',
          d.cause === 'drowsiness' ? 'Eyes closed beyond allowed duration' : 'Looking away beyond allowed duration');
      } else if (d.state === 'SAFE') {
        KS.alerts.resolveOpen(mode);
        KS.alerts.add(mode, 'Driver Safe', 'Driver returned to normal state');
      }
    }
    tr.state = d.state; tr.since = d.since;
    util.save(sessionStorage, trackerKey(mode), tr);
    return d;
  }

  /* ------------------------------------------------------------------ */
  /* Engine                                                              */
  /* ------------------------------------------------------------------ */
  var latest = null, timer = null, busy = false, lastTick = 0, started = false, epoch = 0;

  function finalize(snap) {
    var now = Date.now();
    snap.driver = deriveDriver(snap, now);
    if (snap.mode === 'demo') Demo.fillDevices(snap);
    snap.alertsSession = KS.alerts.sessionCount(snap.mode);
    var dt = lastTick ? Math.min(2, (now - lastTick) / 1000) : 0;
    lastTick = now;
    if (dt > 0) KS.stats.add(snap.mode, snap.driver.state, dt);
    return snap;
  }

  /** Nhận một snapshot từ bất kỳ nguồn nào (polling, WebSocket…) rồi phát cho UI. */
  KS.ingest = function (snap) {
    latest = finalize(snap);
    KS.bus.emit('snapshot', latest);
  };

  function tick(myEpoch) {
    if (myEpoch !== epoch) return;
    var s = KS.settings.get();
    var next = function () { if (myEpoch === epoch) timer = setTimeout(function () { tick(myEpoch); }, Math.max(500, s.pollIntervalMs)); };
    if (s.mode === 'demo') { KS.ingest(Demo.snapshot(Date.now())); next(); return; }
    if (busy) { next(); return; }
    busy = true;
    Real.poll().then(function (snap) { if (myEpoch === epoch) KS.ingest(snap); })
      .catch(function (e) { console.error('[KSafe] poll error', e); })
      .then(function () { busy = false; next(); });
  }

  KS.start = function () {
    if (started) return;
    started = true;
    var restart = function () {
      epoch++; clearTimeout(timer); busy = false; lastTick = 0;
      latest = null;
      if (KS.mode() === 'real') { latest = finalize(emptySnapshot('real')); KS.bus.emit('snapshot', latest); }
      tick(epoch);
    };
    KS.bus.on('settings', restart);
    if (KS.mode() === 'real') { latest = finalize(emptySnapshot('real')); }
    tick(epoch);
  };
  KS.snapshot = function () { return latest; };
  KS.onSnapshot = function (fn) { if (latest) fn(latest); return KS.bus.on('snapshot', fn); };

  /* ------------------------------------------------------------------ */
  /* Commands gửi tới ESP32 (POST /api/state, POST /api/reset/ack)       */
  /* ------------------------------------------------------------------ */
  var CMD_KEY = 'ksafe.commands';
  KS.commands = {
    list: function () { return util.load(sessionStorage, CMD_KEY, []); },
    push: function (entry) {
      var l = KS.commands.list(); l.unshift(entry);
      util.save(sessionStorage, CMD_KEY, l.slice(0, 30));
      KS.bus.emit('commands', entry);
    }
  };

  function runCommand(method, path, body) {
    var mode = KS.mode(), s = KS.settings.get(), t = Date.now();
    var finish = function (r) {
      var entry = { ts: t, method: method, path: path, body: body || null, mode: mode, ok: r.ok, message: r.message };
      KS.commands.push(entry);
      return entry;
    };
    if (mode === 'demo') {
      return Promise.resolve(finish({ ok: true, message: 'DEMO – not sent to hardware' }));
    }
    var base = baseUrl(s.esp32Ip);
    if (!base) return Promise.resolve(finish({ ok: false, message: 'ESP32 IP address not configured' }));
    return http(base + path, { method: method, body: body }).then(function (r) {
      return finish({ ok: r.ok, message: r.ok ? 'HTTP ' + r.status + ' · ' + r.ms + ' ms' : r.error });
    });
  }

  KS.api = {
    sendState: function (state) { return runCommand('POST', '/api/state', { state: state }); },
    ackReset: function () { return runCommand('POST', '/api/reset/ack', {}); },
    /* Kiểm tra kết nối thật (dùng cả khi đang ở chế độ DEMO để người dùng thử trước khi chuyển sang REAL) */
    testEsp32: function (host) {
      var base = baseUrl(host);
      if (!base) return Promise.resolve({ ok: false, error: 'Enter an IP address first' });
      return http(base + '/api/status').then(function (r) {
        if (r.ok) r.device = KS.normalizeEsp32(r.data, base);
        return r;
      });
    },
    testAI: function (endpoint) {
      var base = baseUrl(endpoint);
      if (!base) return Promise.resolve({ ok: false, error: 'Enter an API endpoint first' });
      return http(base + '/api/ai/status');
    }
  };
})(window);
