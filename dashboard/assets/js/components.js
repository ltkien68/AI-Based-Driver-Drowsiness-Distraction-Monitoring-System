/* ==========================================================================
   KSafe AI – Shared UI components
   • KLayout  : sidebar + header + banner dùng chung cho mọi trang (chèn bằng JS để không lặp HTML)
   • KUI      : toast, badge, SafetyPanel, MetricsPanel, DeviceGrid, AlertsTable, CameraView
   Mọi component nhận "snapshot" từ KSafe (api.js) và tự cập nhật – trang chỉ cần gắn vào container.
   ========================================================================== */
(function (global) {
  'use strict';

  var KS = global.KSafe, util = KS.util, esc = util.esc;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var icon = function (n, s, c) { return global.KIcons.svg(n, s, c); };

  /* ------------------------------------------------------------------ */
  /* Metadata trạng thái tài xế                                          */
  /* ------------------------------------------------------------------ */
  var STATE_META = {
    SAFE:    { icon: 'shield-check',   badge: 'safe',   title: 'Driver is Safe',
               desc: 'Eyes open and head pose within the normal range. No action required.' },
    FOCUS:   { icon: 'alert-triangle', badge: 'focus',  title: 'Driver Needs Attention',
               desc: 'Early warning: eyes are closing or attention is drifting. Monitoring closely.' },
    DANGER:  { icon: 'siren',          badge: 'danger', title: 'Drowsiness / Distraction Detected',
               desc: 'Alarm condition. Arduino Uno activates the buzzer and vibration motor until the driver acknowledges the alarm.' },
    UNKNOWN: { icon: 'eye-off',        badge: 'off',    title: 'No Driver Data',
               desc: 'Waiting for the Python AI Engine and its MQTT heartbeat.' }
  };

  var pageLinks = {};
  function href(id) {
    return pageLinks[id] || '#';
  }

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */
  var toastBox = null;
  function toast(msg, type, ms) {
    type = type || 'info';
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite'); document.body.appendChild(toastBox); }
    var el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('data-type', type);
    el.innerHTML = icon(type === 'success' ? 'circle-check' : type === 'error' ? 'alert-circle' : type === 'warn' ? 'alert-triangle' : 'info', 18) + '<span>' + esc(msg) + '</span>';
    toastBox.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(function () { el.remove(); }, 260); }, ms || 3600);
  }

  /* ------------------------------------------------------------------ */
  /* Badge helpers                                                       */
  /* ------------------------------------------------------------------ */
  function badge(tone, text, withDot) {
    return '<span class="badge badge--' + tone + '">' + (withDot ? '<span class="dot dot--' + (tone === 'info' ? 'off' : tone) + '"></span>' : '') + esc(text) + '</span>';
  }
  function severityBadge(sev) {
    return badge(sev === 'Critical' ? 'danger' : sev === 'Warning' ? 'focus' : 'safe', sev);
  }
  function statusBadge(st) {
    return st === 'Detected'
      ? '<span class="badge badge--info">' + icon('activity', 12) + 'Detected</span>'
      : '<span class="badge badge--off">' + icon('check', 12) + 'Resolved</span>';
  }
  function tagSources(root) {
    var mode = KS.mode();
    (root || document).querySelectorAll('[data-source-tag]').forEach(function (el) {
      el.textContent = mode.toUpperCase(); el.setAttribute('data-source', mode); el.classList.add('tag-source');
      el.title = mode === 'demo' ? 'Simulated data – not from hardware' : 'Live data from Python AI via MQTT';
    });
  }
  var signed = function (v, d) { return v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(d == null ? 1 : d); };

  /* ================================================================== */
  /* KLayout                                                             */
  /* ================================================================== */
  var NAV = [
    { group: 'Monitor' },
    { id: 'overview',   label: 'Overview',          icon: 'layout-dashboard', file: 'index.html' },
    { id: 'monitoring', label: 'Live Monitoring',   icon: 'video',            file: 'monitoring.html' },
    { id: 'devices',    label: 'Device Management', icon: 'cpu',              file: 'devices.html' },
    { group: 'Insights' },
    { id: 'alerts',     label: 'Alert History',     icon: 'history',          file: 'alerts.html', badge: true },
    { id: 'analytics',  label: 'Analytics',         icon: 'bar-chart',        file: 'analytics.html' },
    { group: 'System' },
    { id: 'settings',   label: 'Settings',          icon: 'settings',         file: 'settings.html' }
  ];

  function mountLayout() {
    var body = document.body, page = document.getElementById('page');
    var cfg = { page: body.getAttribute('data-page'), title: body.getAttribute('data-title') || 'KSafe AI', base: body.getAttribute('data-base') || '' };
    var inRoot = cfg.base === '';
    NAV.forEach(function (n) { if (n.id) pageLinks[n.id] = n.id === 'overview' ? cfg.base + 'index.html' : (inRoot ? 'pages/' : '') + n.file; });

    var crumbs = '<a href="' + href('overview') + '">KSafe AI</a>' + icon('chevron-right', 12) +
      (cfg.page === 'overview' ? '<span aria-current="page">Overview</span>'
        : '<a href="' + href('overview') + '">Dashboard</a>' + icon('chevron-right', 12) + '<span aria-current="page">' + esc(cfg.title) + '</span>');

    var nav = NAV.map(function (n) {
      if (n.group) return '<div class="nav__label">' + n.group + '</div>';
      return '<a class="nav__item' + (n.id === cfg.page ? ' is-active' : '') + '" href="' + href(n.id) + '"' + (n.id === cfg.page ? ' aria-current="page"' : '') + '>' +
        icon(n.icon, 18) + '<span>' + n.label + '</span>' + (n.badge ? '<span class="nav__badge" id="nav-alert-badge" hidden>0</span>' : '') + '</a>';
    }).join('');

    var app = document.createElement('div');
    app.className = 'app';
    app.innerHTML =
      '<aside class="sidebar" id="sidebar" aria-label="Main navigation">' +
        '<div class="sidebar__brand">' +
          '<div class="brand__logo">' + icon('shield-check', 22) + '</div>' +
          '<div><div class="brand__name">KSafe AI</div><div class="brand__sub">Driver Monitoring System</div></div>' +
          '<button class="btn btn--ghost btn--icon btn--sm sidebar__close" type="button" aria-label="Close menu" data-act="close-nav">' + icon('x', 18) + '</button>' +
        '</div>' +
        '<nav class="sidebar__nav">' + nav + '</nav>' +
        '<div class="sidebar__status" aria-live="polite">' +
          '<div class="sidebar__status-row">' + icon('radio-tower', 14) + 'MQTT Broker<strong id="sb-mqtt"><span class="dot dot--off"></span></strong></div>' +
          '<div class="sidebar__status-row">' + icon('scan-face', 14) + 'Python AI<strong id="sb-ai"><span class="dot dot--off"></span></strong></div>' +
          '<div class="sidebar__status-row">' + icon('cpu', 14) + 'Arduino Uno<strong id="sb-arduino">Chưa có telemetry</strong></div>' +
          '<div class="sidebar__version"><span>Website</span><span>v' + KS.version + '</span></div>' +
        '</div>' +
      '</aside>' +
      '<div class="sidebar-backdrop" data-act="close-nav"></div>' +
      '<div class="main">' +
        '<header class="topbar">' +
          '<button class="btn btn--ghost btn--icon topbar__menu" type="button" aria-label="Open menu" aria-controls="sidebar" data-act="open-nav">' + icon('menu', 20) + '</button>' +
          '<div class="topbar__titles"><h1 class="topbar__title">' + esc(cfg.title) + '</h1><nav class="breadcrumb" aria-label="Breadcrumb">' + crumbs + '</nav></div>' +
          '<div class="topbar__right">' +
            '<div class="sys-pill" id="sys-pill" data-level="offline" title="Overall system status"><span class="dot dot--off" id="sys-dot"></span><span class="sys-pill__text" id="sys-text">Offline</span></div>' +
            '<div class="segmented segmented--sm lang-switch" role="group" aria-label="Language" id="lang-switch"><button type="button" data-lang="vi" aria-pressed="true" title="Tiếng Việt">VI</button><button type="button" data-lang="en" aria-pressed="false" title="English">EN</button></div>' +
            '<div class="clock" aria-label="Current time"><div class="clock__time" id="clock-time">--:--:--</div><div class="clock__date" id="clock-date"></div></div>' +
            '<div class="avatar-wrap">' +
              '<button class="avatar" type="button" id="avatar-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">' + icon('user', 18) + '</button>' +
              '<div class="menu" id="avatar-menu" role="menu" hidden>' +
                '<div class="menu__head"><strong>Operator</strong><span>Local session · LAN dashboard</span></div>' +
                '<div class="menu__label">Data source</div>' +
                '<button class="menu__item" role="menuitemradio" data-mode="demo" type="button">' + icon('activity', 16) + 'DEMO data' + icon('check', 16, 'check') + '</button>' +
                '<button class="menu__item" role="menuitemradio" data-mode="real" type="button">' + icon('cpu', 16) + 'REAL data (Python AI + Arduino Uno)' + icon('check', 16, 'check') + '</button>' +
                '<div class="menu__label">Go to</div>' +
                '<a class="menu__item" role="menuitem" href="' + href('settings') + '">' + icon('settings', 16) + 'Settings</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</header>' +
        '<div class="databanner" id="databanner" data-mode="demo"></div>' +
      '</div>';

    body.insertBefore(app, body.firstChild);
    app.querySelector('.main').appendChild(page);
    page.classList.add('content');
    global.KIcons.hydrate(app);

    /* --- mobile nav --- */
    var setNav = function (open) { document.body.classList.toggle('nav-open', open); };
    app.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]'); if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'open-nav') setNav(true);
      if (act === 'close-nav') setNav(false);
      if (act === 'switch-mode') { KS.setMode(KS.mode() === 'demo' ? 'real' : 'demo'); }
    });
    app.querySelectorAll('.nav__item').forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });

    /* --- avatar menu --- */
    var btn = $('#avatar-btn'), menu = $('#avatar-menu');
    var closeMenu = function () { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); setNav(false); } });
    menu.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.getAttribute('data-mode');
        if (m !== KS.mode()) { KS.setMode(m); toast('Switched to ' + m.toUpperCase() + ' data', 'info'); }
        closeMenu();
      });
    });

    /* --- clock --- */
    var tickClock = function () {
      var d = new Date();
      $('#clock-time').textContent = util.pad(d.getHours()) + ':' + util.pad(d.getMinutes()) + ':' + util.pad(d.getSeconds());
      $('#clock-date').textContent = d.toLocaleDateString(KI18n.lang() === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    };
    tickClock(); setInterval(tickClock, 1000);

    /* --- language switch (VI / EN) --- */
    var langBtns = app.querySelectorAll('#lang-switch [data-lang]');
    var paintLang = function () {
      langBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === KI18n.lang())); });
      tickClock();
    };
    langBtns.forEach(function (b) { b.addEventListener('click', function () { KI18n.setLang(b.getAttribute('data-lang')); }); });
    KI18n.onChange(paintLang); paintLang();

    /* --- reactive chrome (sidebar status, pill, banner, badges) --- */
    var update = function (snap) {
      var mode = snap.mode, a = snap.ai, tag = mode === 'demo' ? ' (demo)' : '';
      var brokerOn = !!(snap.mqtt && snap.mqtt.connected);
      var mqttTxt = mode === 'demo' ? 'Demo' : brokerOn ? 'Connected' : 'Disconnected';
      var aiTxt = snap.pending ? 'Checking…' : a.online ? 'Online' + tag : 'Offline';
      $('#sb-mqtt').innerHTML = '<span class="dot dot--' + (mode === 'demo' || brokerOn ? 'safe' : 'off') + '" style="display:inline-block;margin-right:6px"></span>' + mqttTxt;
      $('#sb-arduino').textContent = mode === 'demo' ? 'DEMO' : 'Qua Serial';
      $('#sb-ai').innerHTML = '<span class="dot dot--' + (a.online ? 'safe' : 'off') + '" style="display:inline-block;margin-right:6px"></span>' + aiTxt;

      var up = (mode === 'demo' ? 1 : brokerOn ? 1 : 0) + (a.online ? 1 : 0);
      var level = snap.pending ? 'degraded' : up === 2 ? 'online' : up === 1 ? 'degraded' : 'offline';
      var pill = $('#sys-pill'); pill.setAttribute('data-level', level);
      $('#sys-text').textContent = snap.pending ? 'Connecting…' : level === 'online' ? 'System Online' : level === 'degraded' ? 'Degraded' : 'System Offline';
      $('#sys-dot').className = 'dot dot--' + (level === 'online' ? 'safe dot--pulse' : level === 'degraded' ? 'focus' : 'danger');

      var s = KS.settings.get(), bn = $('#databanner');
      bn.setAttribute('data-mode', mode);
      var msg;
      if (mode === 'demo') {
        msg = '<strong>DEMO DATA</strong><span>Values are simulated in your browser to preview the UI. No hardware is being read.</span>' +
          '<button class="btn btn--sm" type="button" data-act="switch-mode">Switch to REAL</button>';
      } else {
        var errs = [];
        if (snap.errors && snap.errors.mqtt) errs.push('MQTT: ' + snap.errors.mqtt);
        if (snap.errors && snap.errors.ai) errs.push('Python AI: ' + snap.errors.ai);
        msg = '<strong>REAL DATA · MQTT</strong><span>' + (snap.pending ? 'Đang kết nối Mosquitto WebSocket…'
          : errs.length ? esc(errs.join(' · ')) : 'Đang nhận dữ liệu trực tiếp từ Python AI Engine qua MQTT') + '</span>' +
          '<button class="btn btn--sm" type="button" data-act="switch-mode">Switch to DEMO</button>';
      }
      if (bn._last !== msg) { bn.innerHTML = '<span aria-hidden="true">' + icon(mode === 'demo' ? 'info' : 'activity', 16) + '</span>' + msg; bn._last = msg; }

      menu.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-mode') === mode)); });
      var nb = $('#nav-alert-badge');
      if (nb) { var c = snap.alertsSession || 0; nb.hidden = c === 0; nb.textContent = c > 99 ? '99+' : c; nb.title = c + ' alerts this session'; }
      tagSources(document);
    };
    KS.onSnapshot(update);
    return cfg;
  }

  /* ================================================================== */
  /* Safety panel (Driver Safety Status)                                 */
  /* ================================================================== */
  function SafetyPanel(root) {
    root.classList.add('card', 'safety');
    root.setAttribute('data-state', 'UNKNOWN');
    root.innerHTML =
      '<div class="card__header"><h3 class="card__title">' + icon('shield-check', 18) + 'Driver Safety Status</h3><div class="card__actions"><span data-source-tag></span></div></div>' +
      '<div class="safety__hero" aria-live="polite">' +
        '<div class="safety__icon" data-ref="icon"></div>' +
        '<div><div class="safety__state" data-ref="state">—</div><h3 class="safety__title" data-ref="title"></h3><p class="safety__desc" data-ref="desc"></p></div>' +
      '</div>' +
      '<div class="safety__foot">' +
        '<div class="state-rail" aria-hidden="true"><span data-s="SAFE">SAFE</span><span data-s="FOCUS">FOCUS</span><span data-s="DANGER">DANGER</span></div>' +
        '<div style="display:grid;gap:8px;font-size:13px">' +
          '<div class="kv"><span>In this state for</span><strong class="mono" data-ref="dur">—</strong></div>' +
          '<div class="kv"><span>Trigger</span><strong data-ref="cause">—</strong></div>' +
          '<div class="kv"><span>Last update</span><strong class="mono" data-ref="upd">—</strong></div>' +
        '</div>' +
      '</div>';
    var ref = function (k) { return root.querySelector('[data-ref="' + k + '"]'); };
    var last = null;
    return {
      update: function (snap) {
        var st = snap.driver.state, meta = STATE_META[st] || STATE_META.UNKNOWN;
        root.setAttribute('data-state', st);
        if (last !== st) {
          last = st;
          ref('icon').innerHTML = icon(meta.icon, 44);
          ref('state').textContent = st === 'UNKNOWN' ? 'NO DATA' : st;
          ref('title').textContent = meta.title; ref('desc').textContent = meta.desc;
          root.querySelectorAll('.state-rail span').forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-s') === st); });
        }
        var d = snap.driver, ai = snap.ai, cause = '—';
        if (st === 'FOCUS' || st === 'DANGER') {
          cause = d.cause === 'drowsiness' ? 'Eyes closed · EAR ' + (ai.ear != null ? ai.ear.toFixed(2) : '—')
            : d.cause === 'distraction' ? 'Head turned · yaw ' + signed(ai.yaw, 0) + '°, pitch ' + signed(ai.pitch, 0) + '°'
            : d.cause === 'noface' ? 'Face not detected' : 'Reported by AI service';
        } else if (st === 'SAFE') cause = 'None';
        ref('dur').textContent = st === 'UNKNOWN' ? '—' : util.duration((snap.ts - d.since) / 1000);
        ref('cause').textContent = cause;
        ref('upd').textContent = snap.pending ? '—' : util.time(snap.ts);
        tagSources(root);
      }
    };
  }

  /* ================================================================== */
  /* Metrics panel (AI information)                                      */
  /* ================================================================== */
  function MetricsPanel(root) {
    root.classList.add('metrics');
    var rows = [
      { k: 'ear',   name: 'Eye Aspect Ratio',   sub: 'EAR · eye openness' },
      { k: 'pitch', name: 'Head Pitch',         sub: 'Up / down tilt' },
      { k: 'yaw',   name: 'Head Yaw',           sub: 'Left / right turn' },
      { k: 'roll',  name: 'Head Roll',          sub: 'Sideways tilt' },
      { k: 'gaze',  name: 'Eye Direction',      sub: 'Estimated gaze' },
      { k: 'drow',  name: 'Drowsiness Status',  sub: 'Eyes-closed duration' },
      { k: 'dist',  name: 'Distraction Status', sub: 'Head-away duration' }
    ];
    root.innerHTML = '<div class="metrics__head">' + icon('cpu', 14) + 'AI Metrics<span data-source-tag></span></div>' + rows.map(function (r) {
      return '<div class="metric"><div class="metric__name"><strong>' + r.name + '</strong><span data-sub="' + r.k + '">' + r.sub + '</span></div><div class="metric__value" data-v="' + r.k + '">—</div></div>';
    }).join('');
    var v = function (k) { return root.querySelector('[data-v="' + k + '"]'); };
    var setv = function (k, html, tone) { var el = v(k); if (el._h !== html) { el.innerHTML = html; el._h = html; } el.setAttribute('data-tone', tone || ''); };
    return {
      update: function (snap) {
        var ai = snap.ai, d = snap.driver, s = KS.settings.get(), on = ai.online;
        var unit = function (x) { return '<small>' + x + '</small>'; };
        root.querySelector('[data-sub="ear"]').textContent = 'EAR · threshold ' + s.earThreshold.toFixed(2);
        root.querySelector('[data-sub="yaw"]').textContent = 'Left / right · limit ±' + s.distractionYaw + '°';
        root.querySelector('[data-sub="pitch"]').textContent = 'Up / down · limit ±' + s.distractionPitch + '°';
        var none = function (k) { setv(k, '—', 'none'); };
        if (!on || ai.ear == null) none('ear'); else setv('ear', ai.ear.toFixed(2) + unit('ratio'), d.drowsy ? 'danger' : d.eyesClosed ? 'warn' : '');
        if (!on || ai.pitch == null) none('pitch'); else setv('pitch', signed(ai.pitch) + unit('°'), Math.abs(ai.pitch) > s.distractionPitch ? 'warn' : '');
        if (!on || ai.yaw == null) none('yaw'); else setv('yaw', signed(ai.yaw) + unit('°'), Math.abs(ai.yaw) > s.distractionYaw ? (d.distracted ? 'danger' : 'warn') : '');
        if (!on || ai.roll == null) none('roll'); else setv('roll', signed(ai.roll) + unit('°'), '');
        var gaze = ai.gaze || (on && ai.yaw != null ? gazeFromPose(ai, s) : null);
        if (!on || !gaze) none('gaze'); else setv('gaze', '<span style="font-family:var(--font-sans)">' + esc(gaze) + '</span>', gaze === 'Center' ? '' : 'warn');
        if (!on) { setv('drow', '—', 'none'); setv('dist', '—', 'none'); }
        else {
          setv('drow', d.drowsy ? badge('danger', 'Detected') : d.eyesClosed ? badge('focus', 'Eyes closing') : badge('safe', 'Normal'), '');
          setv('dist', d.distracted ? badge('danger', 'Detected') : d.lookingAway ? badge('focus', 'Looking away') : badge('safe', 'Attentive'), '');
        }
        tagSources(root);
      }
    };
  }
  function gazeFromPose(ai, s) {
    if (ai.ear != null && ai.ear < s.earThreshold) return 'Eyes closed';
    if (Math.abs(ai.yaw) > s.distractionYaw) return ai.yaw < 0 ? 'Left' : 'Right';
    if (ai.pitch != null && Math.abs(ai.pitch) > s.distractionPitch) return ai.pitch > 0 ? 'Up' : 'Down';
    return 'Center';
  }

  /* ================================================================== */
  /* Device grid                                                         */
  /* ================================================================== */
  function deviceItems(snap) {
    var demo = snap.mode === 'demo';
    var state = snap.driver && snap.driver.state;
    var led = state === 'SAFE' ? ['safe', 'Xanh lá'] : state === 'FOCUS' ? ['focus', 'Vàng'] : state === 'DANGER' ? ['danger', 'Đỏ'] : null;
    var items = [
      { name: 'Arduino Uno', icon: 'cpu', tone: '', badge: badge(demo ? 'info' : 'off', demo ? 'Mô phỏng DEMO' : 'Chưa có telemetry'),
        desc: 'Bộ điều khiển phần cứng · nhận lệnh từ Python AI Engine qua Serial' },
      { name: 'LED RGB', icon: 'lightbulb', tone: led ? led[0] : '', badge: demo && led ? badge(led[0], led[1], true) : badge('off', 'Chưa có phản hồi'),
        desc: 'Đèn báo trạng thái SAFE / FOCUS / DANGER' },
      { name: 'Buzzer', icon: 'volume', tone: demo && state === 'DANGER' ? 'danger' : '', badge: demo ? badge(state === 'DANGER' ? 'danger' : 'safe', state === 'DANGER' ? 'Đang mô phỏng báo động' : 'Im lặng') : badge('off', 'Chưa có phản hồi'),
        desc: 'Phát âm báo khi hệ thống xác định DANGER' },
      { name: 'Động cơ rung', icon: 'vibrate', tone: demo && state === 'DANGER' ? 'danger' : '', badge: demo ? badge(state === 'DANGER' ? 'danger' : 'safe', state === 'DANGER' ? 'Đang mô phỏng rung' : 'Không hoạt động') : badge('off', 'Chưa có phản hồi'),
        desc: 'Rung cảnh báo khi phát hiện nguy cơ ngủ gật' },
      { name: 'LCD Display', icon: 'monitor', tone: '', badge: demo ? badge('info', 'Mô phỏng DEMO') : badge('off', 'Chưa có phản hồi'),
        desc: demo ? 'KSAFE AI | ' + (state || 'UNKNOWN') : 'Hiển thị trạng thái và cảnh báo từ Python AI' },
      { name: 'Cảm biến siêu âm', icon: 'radio', tone: '', badge: demo ? badge('info', 'Mô phỏng DEMO') : badge('off', 'Chưa có phản hồi'),
        desc: 'Cảm biến khoảng cách trong mô hình phần cứng' },
      { name: 'Nút Reset', icon: 'circle-dot', tone: '', badge: demo ? badge('info', 'Mô phỏng DEMO') : badge('off', 'Chưa có phản hồi'),
        desc: 'Tài xế nhấn nút vật lý để xác nhận sau cảnh báo' }
    ];
    return items;
  }

  function DeviceGrid(root, opts) {
    root.classList.add('devices'); if (opts && opts.wide) root.classList.add('devices--wide');
    return {
      update: function (snap) {
        var html = deviceItems(snap).map(function (d) {
          return '<div class="device"><div class="device__icon"' + (d.tone ? ' data-tone="' + d.tone + '"' : '') + '>' + icon(d.icon, 18) + '</div>' +
            '<div class="device__body"><div class="device__row"><strong>' + d.name + '</strong>' + d.badge + '</div><div class="device__desc">' + esc(d.desc) + '</div></div></div>';
        }).join('');
        if (root._h !== html) { root.innerHTML = html; root._h = html; }
      }
    };
  }

  /* ================================================================== */
  /* Alerts table (compact – dùng cho Overview)                          */
  /* ================================================================== */
  function timeCell(ts) {
    var today = util.midnight(Date.now()) === util.midnight(ts);
    return '<span class="mono">' + util.time(ts) + '</span>' + (today ? '' : ' <small class="muted">' + util.shortDate(ts) + '</small>');
  }
  function AlertsTable(root, opts) {
    var limit = (opts && opts.limit) || 6;
    function render() {
      var list = KS.alerts.list(KS.mode()).slice(0, limit);
      if (!list.length) {
        root.innerHTML = '<div class="empty">' + icon('bell', 28) + '<strong>No alerts recorded</strong>' +
          (KS.mode() === 'real' ? 'Alerts appear here when the AI service reports a FOCUS or DANGER state.' : 'Alerts will appear as the demo scenario runs.') + '</div>';
        return;
      }
      root.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Event</th><th>Severity</th><th>Status</th></tr></thead><tbody>' +
        list.map(function (a) {
          return '<tr><td class="col-time">' + timeCell(a.ts) + '</td><td><strong>' + esc(a.event) + '</strong></td><td>' + severityBadge(a.severity) + '</td><td>' + statusBadge(a.status) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    KS.bus.on('alerts', render); KS.bus.on('settings', render);
    render();
    return { render: render };
  }

  /* ================================================================== */
  /* Camera view                                                         */
  /* ================================================================== */
  function CameraView(root, opts) {
    opts = opts || {};
    root.classList.add('camera'); if (opts.tall) root.classList.add('camera--tall');
    root.setAttribute('data-state', 'UNKNOWN');
    root.innerHTML =
      '<div class="camera__media"><video muted playsinline autoplay hidden></video><img alt="Live camera stream from the AI service" hidden></div>' +
      '<div class="camera__placeholder" data-ref="ph"></div>' +
      '<svg class="camera__overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" data-ref="ov"></svg>' +
      '<div class="camera__boxlabel" data-ref="boxlbl" hidden></div>' +
      '<div class="camera__tl"><span class="live-tag" data-ref="live">NO SIGNAL</span><span class="chip">FPS <b data-ref="fps">—</b></span></div>' +
      '<div class="camera__tr"><span data-source-tag></span></div>' +
      '<div class="camera__bl"><span class="chip">Camera <b data-ref="cam">—</b></span><span class="chip">Face <b data-ref="face">—</b></span></div>';
    var ref = function (k) { return root.querySelector('[data-ref="' + k + '"]'); };
    var video = root.querySelector('video'), img = root.querySelector('img');
    var view = { status: 'none', message: '', _key: null, _stream: null };

    function stop() {
      if (view._stream) { view._stream.getTracks().forEach(function (t) { t.stop(); }); view._stream = null; }
      video.srcObject = null; video.hidden = true;
      img.onload = img.onerror = null; img.removeAttribute('src'); img.hidden = true;
    }
    function set(status, msg) { view.status = status; view.message = msg || ''; draw(KS.snapshot()); }

    function apply() {
      var s = KS.settings.get();
      root.classList.toggle('is-mirrored', !!s.cameraMirror);
      var key = [s.cameraSource, s.cameraStreamUrl, s.cameraResolution, s.cameraFps].join('|');
      if (key === view._key) return;
      view._key = key; stop();
      if (s.cameraSource === 'stream' && s.cameraStreamUrl) {
        view.status = 'connecting';
        img.hidden = false;
        img.onload = function () { set('live'); };
        img.onerror = function () { stop(); set('error', 'Cannot load the stream at ' + s.cameraStreamUrl + '. Check that the Python service is running and allows this origin.'); };
        img.src = s.cameraStreamUrl;
      } else if (s.cameraSource === 'webcam') {
        if (!navigator.mediaDevices || !global.isSecureContext) {
          view.status = 'error'; view.message = 'Browser webcam needs HTTPS or localhost. Open the dashboard from http://localhost, or use the MJPEG stream option for LAN access.';
        } else {
          view.status = 'connecting';
          var wh = s.cameraResolution.split('x').map(Number);
          navigator.mediaDevices.getUserMedia({ video: { width: { ideal: wh[0] }, height: { ideal: wh[1] }, frameRate: { ideal: +s.cameraFps } }, audio: false })
            .then(function (stream) {
              if (view._key !== key) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
              view._stream = stream; video.srcObject = stream; video.hidden = false; set('live');
            })
            .catch(function (err) { set('error', err && err.name === 'NotAllowedError' ? 'Camera permission was denied in the browser.' : 'Webcam unavailable (' + (err && err.name || 'unknown error') + ').'); });
        }
      } else { view.status = 'none'; view.message = ''; }
    }

    function placeholder(snap) {
      var s = KS.settings.get(), html;
      if (view.status === 'live') html = '';
      else if (view.status === 'connecting') html = icon('camera', 40) + '<strong>Connecting to camera…</strong>';
      else if (view.status === 'error') html = icon('eye-off', 40) + '<strong>Camera unavailable</strong><p>' + esc(view.message) + '</p><a class="btn btn--sm" href="' + href('settings') + '">Camera settings</a>';
      else if (snap && snap.mode === 'demo') html = '<strong>No camera feed</strong><p>Demo preview – no video is captured; the dashed face region is illustrative. <a class="link" href="' + href('settings') + '">Configure camera</a></p>';
      else html = icon('video', 44) + '<strong>Camera source not configured</strong><p>Choose the MJPEG stream from the Python service, or the browser webcam, in Settings → Camera.</p><a class="btn btn--sm" href="' + href('settings') + '">Configure camera</a>';
      var ph = ref('ph');
      if (ph._h !== html) { ph.innerHTML = html; ph._h = html; }
      ph.hidden = html === '';
      ph.classList.toggle('is-demo', view.status !== 'live' && view.status !== 'connecting' && view.status !== 'error' && !!snap && snap.mode === 'demo');
    }

    function overlay(snap) {
      var ov = ref('ov'), lbl = ref('boxlbl'), box = null, label = '';
      if (snap && snap.ai.faceBox) { box = { x: snap.ai.faceBox.x * 100, y: snap.ai.faceBox.y * 100, w: snap.ai.faceBox.w * 100, h: snap.ai.faceBox.h * 100 }; label = 'Face'; }
      else if (snap && snap.mode === 'demo' && snap.ai.online && view.status !== 'live') { box = { x: 37, y: 21, w: 26, h: 45 }; label = (snap.driver.state) + ' · illustrative'; }
      var html = '';
      if (box) {
        var x2 = box.x + box.w, y2 = box.y + box.h, cl = Math.min(6, box.w * .22), cv = Math.min(9, box.h * .16);
        html = '<rect class="box" x="' + box.x + '" y="' + box.y + '" width="' + box.w + '" height="' + box.h + '" rx="2"/>' +
          '<path class="corner" d="M' + box.x + ' ' + (box.y + cv) + 'V' + box.y + 'H' + (box.x + cl) + 'M' + (x2 - cl) + ' ' + box.y + 'H' + x2 + 'V' + (box.y + cv) +
          'M' + x2 + ' ' + (y2 - cv) + 'V' + y2 + 'H' + (x2 - cl) + 'M' + (box.x + cl) + ' ' + y2 + 'H' + box.x + 'V' + (y2 - cv) + '"/>';
        if (snap.mode === 'demo' && !snap.ai.faceBox) { // vùng mắt minh hoạ
          var ey = box.y + box.h * .30, eh = box.h * .1;
          html += '<rect class="zone" x="' + (box.x + box.w * .16) + '" y="' + ey + '" width="' + box.w * .27 + '" height="' + eh + '" rx="2"/>' +
            '<rect class="zone" x="' + (box.x + box.w * .57) + '" y="' + ey + '" width="' + box.w * .27 + '" height="' + eh + '" rx="2"/>';
        }
        lbl.hidden = false; lbl.textContent = label; lbl.style.left = box.x + '%'; lbl.style.top = box.y + '%';
      } else lbl.hidden = true;
      if (ov._h !== html) { ov.innerHTML = html; ov._h = html; }
    }

    function draw(snap) {
      if (!snap) return;
      root.setAttribute('data-state', snap.driver ? snap.driver.state : 'UNKNOWN');
      var live = ref('live');
      live.className = 'live-tag' + (view.status === 'live' ? ' is-live' : '');
      live.textContent = view.status === 'live' ? 'LIVE' : view.status === 'connecting' ? 'CONNECTING' : view.status === 'error' ? 'ERROR' : 'NO SIGNAL';
      ref('fps').textContent = snap.ai.fps != null ? snap.ai.fps.toFixed(1) : '—';
      ref('cam').textContent = view.status === 'live' ? (KS.settings.get().cameraSource === 'webcam' ? 'Webcam active' : 'Streaming') : view.status === 'connecting' ? 'Connecting' : view.status === 'error' ? 'Error' : 'No source';
      ref('face').textContent = snap.ai.faceDetected == null ? '—' : snap.ai.faceDetected ? 'Detected' : 'Not detected';
      placeholder(snap); overlay(snap); tagSources(root);
    }

    KS.bus.on('settings', apply);
    global.addEventListener('pagehide', stop);
    apply();
    return { update: draw, stop: stop };
  }

  /* ------------------------------------------------------------------ */
  global.KLayout = { mount: mountLayout, href: href };
  global.KUI = {
    STATE_META: STATE_META, toast: toast, badge: badge, severityBadge: severityBadge, statusBadge: statusBadge, tagSources: tagSources,
    signed: signed, timeCell: timeCell, gazeFromPose: gazeFromPose, deviceItems: deviceItems,
    SafetyPanel: SafetyPanel, MetricsPanel: MetricsPanel, DeviceGrid: DeviceGrid, AlertsTable: AlertsTable, CameraView: CameraView
  };
})(window);
