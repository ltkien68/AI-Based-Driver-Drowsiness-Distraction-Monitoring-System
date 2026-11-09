/* ==========================================================================
   KSafe AI – Settings page
   Form có kiểm tra hợp lệ, theo dõi thay đổi chưa lưu, khôi phục mặc định, kiểm tra kết nối.
   Lưu vào localStorage qua KSafe.settings.
   ========================================================================== */
(function () {
  'use strict';

  var KS = KSafe, UI = KUI;
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#settings-form');
  KIcons.hydrate(document);

  var FIELDS = ['esp32Ip', 'apiEndpoint', 'pollIntervalMs', 'requestTimeoutMs', 'cameraSource', 'cameraStreamUrl', 'cameraResolution', 'cameraFps',
    'cameraMirror', 'earThreshold', 'drowsySeconds', 'distractionYaw', 'distractionPitch', 'distractionSeconds'];
  var NUMERIC = ['pollIntervalMs', 'requestTimeoutMs', 'cameraFps', 'earThreshold', 'drowsySeconds', 'distractionYaw', 'distractionPitch', 'distractionSeconds'];
  var input = function (k) { return document.getElementById(k); };

  var HOST_RE = /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?\/?$/i;
  var URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
  var RULES = {
    esp32Ip: function (v) { return !v ? 'Enter the ESP32 IP address' : !HOST_RE.test(v) ? 'Not a valid IP address or hostname' : ''; },
    apiEndpoint: function (v) { return !v ? 'Enter the API endpoint' : !URL_RE.test(v) ? 'Must start with http:// or https://' : ''; },
    requestTimeoutMs: function (v) { return !(v >= 500 && v <= 10000) ? 'Enter 500 – 10000 ms' : ''; },
    cameraStreamUrl: function (v) { return input('cameraSource').value === 'stream' && !URL_RE.test(v) ? 'Enter a stream URL starting with http:// or https://' : ''; },
    earThreshold: function (v) { return !(v >= .1 && v <= .4) ? 'Enter a value between 0.10 and 0.40' : ''; },
    drowsySeconds: function (v) { return !(v >= .5 && v <= 5) ? 'Enter 0.5 – 5 seconds' : ''; },
    distractionYaw: function (v) { return !(v >= 10 && v <= 60) ? 'Enter 10 – 60°' : ''; },
    distractionPitch: function (v) { return !(v >= 10 && v <= 60) ? 'Enter 10 – 60°' : ''; },
    distractionSeconds: function (v) { return !(v >= 1 && v <= 10) ? 'Enter 1 – 10 seconds' : ''; }
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
  function syncSliders() { form.querySelectorAll('input[type=range]').forEach(function (r) { r.value = input(r.getAttribute('data-key')).value; }); }
  function toggleRows() { $('#row-stream').hidden = input('cameraSource').value !== 'stream'; }
  function clearErrors() { form.querySelectorAll('[data-err]').forEach(function (e) { e.hidden = true; }); form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); }); }

  function validate() {
    var vals = read(), ok = true, first = null;
    Object.keys(RULES).forEach(function (k) {
      var msg = RULES[k](vals[k]), el = input(k), err = form.querySelector('[data-err="' + k + '"]');
      if (err) { err.hidden = !msg; err.textContent = msg; }
      if (msg) { el.setAttribute('aria-invalid', 'true'); ok = false; first = first || el; } else el.removeAttribute('aria-invalid');
    });
    if (first) first.focus();
    return ok;
  }

  function normalize(v) {
    v.esp32Ip = v.esp32Ip.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    v.apiEndpoint = v.apiEndpoint.replace(/\/+$/, '');
    return v;
  }
  function isDirty() {
    var cur = read(), saved = KS.settings.get();
    return FIELDS.some(function (k) { return String(cur[k]) !== String(saved[k]); });
  }
  function refreshDirty() {
    var d = isDirty(), st = $('#save-state');
    st.setAttribute('data-dirty', String(d));
    st.innerHTML = '<span class="dot dot--' + (d ? 'focus' : 'safe') + '"></span><span>' + (d ? 'Unsaved changes' : 'All changes saved') + '</span>';
    $('#btn-discard').disabled = !d;
  }

  /* number <-> slider */
  form.addEventListener('input', function (e) {
    var t = e.target;
    if (t.type === 'range') input(t.getAttribute('data-key')).value = t.value;
    else if (t.hasAttribute && t.hasAttribute('data-key')) { var r = form.querySelector('input[type=range][data-key="' + t.getAttribute('data-key') + '"]'); if (r) r.value = t.value; }
    if (t.id === 'cameraSource') toggleRows();
    refreshDirty();
  });
  form.addEventListener('change', refreshDirty);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) { UI.toast('Please fix the highlighted fields', 'error'); return; }
    KS.settings.set(normalize(read()));
    write(KS.settings.get()); refreshDirty();
    UI.toast('Settings saved', 'success');
  });
  $('#btn-discard').addEventListener('click', function () { write(KS.settings.get()); refreshDirty(); });
  $('#btn-defaults').addEventListener('click', function () {
    if (!confirm(KI18n.t('Restore all connection, camera and threshold settings to their defaults?'))) return;
    KS.settings.reset(); write(KS.settings.get()); refreshDirty(); UI.toast('Defaults restored', 'info');
  });

  /* mode switch – áp dụng ngay vì là công tắc toàn cục */
  function paintMode() {
    var m = KS.mode();
    document.querySelectorAll('#seg-mode button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === m)); });
    $('#mode-hint').textContent = m === 'demo'
      ? 'DEMO: values are simulated in the browser to preview the interface. No hardware is contacted. Applies immediately.'
      : 'REAL: the dashboard polls the ESP32 and the Python AI service using the addresses below. Anything unreachable is shown as offline – nothing is simulated. Applies immediately.';
  }
  $('#seg-mode').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]'); if (!b) return;
    KS.setMode(b.getAttribute('data-mode')); paintMode(); UI.toast('Switched to ' + b.getAttribute('data-mode').toUpperCase() + ' data', 'info');
  });

  /* connection tests */
  function result(state, html) {
    var r = $('#test-result'); r.hidden = false; r.setAttribute('data-ok', state === null ? '' : String(state));
    r.innerHTML = KIcons.svg(state === true ? 'circle-check' : state === false ? 'alert-circle' : 'info', 16) + '<span>' + html + '</span>';
  }
  function test(btn, key, fn, label) {
    var msg = RULES[key](read()[key]);
    var err = form.querySelector('[data-err="' + key + '"]'); err.hidden = !msg; err.textContent = msg;
    if (msg) { input(key).focus(); return; }
    var v = read()[key]; btn.disabled = true; result(null, 'Contacting ' + UI_esc(v) + '…');
    fn(v).then(function (r) {
      btn.disabled = false;
      result(r.ok, r.ok ? label + ' reachable · ' + r.ms + ' ms' : label + ': ' + UI_esc(r.error));
    });
  }
  var UI_esc = KS.util.esc;
  $('#btn-test-esp').addEventListener('click', function () { test(this, 'esp32Ip', KS.api.testEsp32, 'ESP32'); });
  $('#btn-test-ai').addEventListener('click', function () { test(this, 'apiEndpoint', KS.api.testAI, 'AI service'); });

  /* stored data */
  $('#btn-clear-real').addEventListener('click', function () {
    if (!confirm(KI18n.t('Delete all REAL alert history and statistics stored in this browser?'))) return;
    KS.alerts.clear('real'); KS.stats.clear('real'); UI.toast('REAL history cleared', 'success');
  });
  $('#btn-clear-demo').addEventListener('click', function () {
    KS.alerts.clear('demo'); KS.stats.clear('demo'); UI.toast('DEMO session alerts cleared', 'success');
  });

  KS.bus.on('settings', function () { paintMode(); });
  write(KS.settings.get()); paintMode(); refreshDirty();
  window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  KS.onSnapshot(function () {});
})();
