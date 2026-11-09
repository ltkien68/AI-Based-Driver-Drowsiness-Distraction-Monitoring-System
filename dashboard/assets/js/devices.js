/* ==========================================================================
   KSafe AI – Device Management page
   Thông tin ESP32, cấu hình kết nối, trạng thái ngoại vi, gọi thử API.
   ========================================================================== */
(function () {
  'use strict';

  var KS = KSafe, UI = KUI, util = KS.util, esc = util.esc;
  var $ = function (s) { return document.querySelector(s); };

  var grid = UI.DeviceGrid($('#dev-grid'), { wide: true });
  KIcons.hydrate(document);

  /* ---------- Info list ---------- */
  function render(snap) {
    var e = snap.esp32, s = KS.settings.get();
    var dash = '—';
    var rows = [
      ['Device ID', e.deviceId || dash, true],
      ['IP address', e.ip || s.esp32Ip || dash, true],
      ['Wi-Fi status', e.connected ? (e.wifi.connected ? 'Connected' : 'Disconnected') : (snap.pending ? 'Checking…' : 'Unreachable')],
      ['Wi-Fi network', e.wifi.ssid || dash],
      ['Signal strength', e.wifi.rssi != null ? e.wifi.rssi + ' dBm' : dash, true],
      ['Uptime', e.uptimeSec != null ? util.duration(e.uptimeSec) : dash, true],
      ['Firmware version', e.firmware || dash, true],
      ['Response time', e.responseMs != null ? e.responseMs + ' ms' : dash, true],
      ['Driver state on device', e.state || dash]
    ];
    var html = rows.map(function (r) { return '<div class="kv"><span>' + r[0] + '</span><strong' + (r[2] ? ' class="mono"' : '') + '>' + esc(r[1]) + '</strong></div>'; }).join('');
    var info = $('#dev-info'); if (info._h !== html) { info.innerHTML = html; info._h = html; }
    $('#dev-conn-badge').innerHTML = snap.pending ? UI.badge('off', 'Checking…') : e.connected ? UI.badge('safe', 'Connected', true) : UI.badge('danger', 'Disconnected', true);
    var err = snap.errors && snap.errors.esp32;
    if (!info.nextElementSibling || !info.nextElementSibling.classList.contains('card__body')) {
      var holder = document.createElement('div'); holder.className = 'card__body'; holder.style.paddingTop = '0'; holder.id = 'dev-err'; info.after(holder);
    }
    $('#dev-err').innerHTML = err ? '<div class="test-result" data-ok="false">' + KIcons.svg('alert-circle', 16) + '<span>' + esc(err) + '</span></div>' : '';
    grid.update(snap);
    UI.tagSources(document);
  }

  /* ---------- Connection form ---------- */
  var f = { ip: $('#f-ip'), poll: $('#f-poll'), timeout: $('#f-timeout') };
  function load() { var s = KS.settings.get(); f.ip.value = s.esp32Ip; f.poll.value = String(s.pollIntervalMs); f.timeout.value = s.requestTimeoutMs; }
  load();

  var HOST_RE = /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?(\/)?$/i;
  function showErr(id, msg, input) { var el = $(id); el.hidden = !msg; el.textContent = msg || ''; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); return !msg; }
  function validate() {
    var ok = showErr('#err-ip', !f.ip.value.trim() ? 'Enter the ESP32 IP address' : !HOST_RE.test(f.ip.value.trim()) ? 'Not a valid IP address or hostname' : '', f.ip);
    var t = +f.timeout.value;
    ok = showErr('#err-timeout', !(t >= 500 && t <= 10000) ? 'Enter 500 – 10000 ms' : '', f.timeout) && ok;
    return ok;
  }

  $('#conn-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    KS.settings.set({ esp32Ip: f.ip.value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, ''), pollIntervalMs: +f.poll.value, requestTimeoutMs: +f.timeout.value });
    UI.toast('Connection settings saved' + (KS.mode() === 'demo' ? ' (DEMO mode is active – switch to REAL to use them)' : ''), 'success');
  });

  function showResult(ok, html) {
    var r = $('#test-result'); r.hidden = false; r.setAttribute('data-ok', String(ok));
    r.innerHTML = KIcons.svg(ok ? 'circle-check' : 'alert-circle', 16) + '<span>' + html + '</span>';
  }
  $('#btn-test').addEventListener('click', function () {
    if (!validate()) return;
    var btn = this; btn.disabled = true; showResult(null, 'Contacting ' + esc(f.ip.value.trim()) + '…');
    $('#test-result').setAttribute('data-ok', '');
    KS.api.testEsp32(f.ip.value.trim()).then(function (r) {
      btn.disabled = false;
      if (r.ok) showResult(true, esc('Connected in ' + r.ms + ' ms' + (r.device && r.device.deviceId ? ' · device ' + r.device.deviceId : '') + (r.device && r.device.firmware ? ' · firmware ' + r.device.firmware : '')));
      else showResult(false, esc(r.error));
    });
  });

  /* ---------- Manual API calls ---------- */
  function logCmd() {
    var list = KS.commands.list(), box = $('#cmd-log');
    if (!list.length) { box.innerHTML = '<div class="empty">' + KIcons.svg('file-text', 28) + '<strong>No commands sent</strong>Requests you send from the ESP32 API card appear here.</div>'; return; }
    box.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Request</th><th>Result</th></tr></thead><tbody>' + list.slice(0, 8).map(function (c) {
      return '<tr><td class="col-time">' + util.time(c.ts) + '</td><td><span class="mono">' + c.method + ' ' + esc(c.path) + '</span>' + (c.body && c.body.state ? ' <small class="muted">' + esc(c.body.state) + '</small>' : '') + '</td>' +
        '<td>' + UI.badge(c.ok ? (c.mode === 'demo' ? 'info' : 'safe') : 'danger', c.mode === 'demo' ? 'DEMO' : c.ok ? 'OK' : 'Failed') + ' <small class="muted">' + esc(c.message) + '</small></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function runCmd(p) { p.then(function (r) { UI.toast(r.mode === 'demo' ? 'DEMO – nothing was sent to the device' : r.ok ? 'Request succeeded' : 'Request failed: ' + r.message, r.mode === 'demo' ? 'info' : r.ok ? 'success' : 'error'); }); }
  $('#btn-state').addEventListener('click', function () { runCmd(KS.api.sendState($('#sel-state').value)); });
  $('#btn-ack').addEventListener('click', function () { runCmd(KS.api.ackReset()); });
  $('#btn-fetch').addEventListener('click', function () {
    var s = KS.settings.get();
    if (KS.mode() === 'demo') { UI.toast('DEMO – no request was made. Switch to REAL data, or use "Test connection".', 'info'); return; }
    KS.api.testEsp32(s.esp32Ip).then(function (r) { UI.toast(r.ok ? 'GET /api/status OK · ' + r.ms + ' ms' : 'GET /api/status failed: ' + r.error, r.ok ? 'success' : 'error'); });
  });
  $('#btn-refresh').addEventListener('click', function () { KS.settings.set({}); UI.toast('Refreshing…', 'info', 1200); });

  KS.bus.on('commands', logCmd);
  KS.bus.on('settings', load);
  logCmd();
  KS.onSnapshot(render);
})();
