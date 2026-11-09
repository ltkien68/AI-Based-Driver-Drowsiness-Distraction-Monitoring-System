/* ==========================================================================
   KSafe AI – Overview page logic
   Gắn các component dùng chung vào container và cập nhật 4 thẻ trạng thái.
   ========================================================================== */
(function () {
  'use strict';

  var KS = KSafe, util = KS.util, UI = KUI;
  var $ = function (sel) { return document.querySelector(sel); };
  var ref = function (card, k) { return card.querySelector('[data-ref="' + k + '"]'); };

  var camera = UI.CameraView($('#camera'));
  var metrics = UI.MetricsPanel($('#metrics'));
  var safety = UI.SafetyPanel($('#safety'));
  var devices = UI.DeviceGrid($('#devices'));
  UI.AlertsTable($('#alerts'), { limit: 6 });
  KIcons.hydrate(document);

  var cardAI = $('#card-ai'), cardEsp = $('#card-esp'), cardDriver = $('#card-driver'), cardAlerts = $('#card-alerts');

  function setOnline(card, on, pending, onText, offText) {
    ref(card, 'dot').className = 'dot ' + (pending ? 'dot--off' : on ? 'dot--safe dot--pulse' : 'dot--danger');
    ref(card, 'value').textContent = pending ? 'Checking…' : on ? onText : offText;
  }

  function render(snap) {
    var ai = snap.ai, esp = snap.esp32, d = snap.driver;

    /* 1. AI Monitoring */
    setOnline(cardAI, ai.online, snap.pending, 'Online', 'Offline');
    ref(cardAI, 'mp').textContent = ai.online ? (ai.mediapipe || 'Unknown') : 'No data';
    ref(cardAI, 'fps').textContent = ai.online && ai.fps != null ? ai.fps.toFixed(1) + ' fps' : '—';

    /* 2. ESP32 */
    setOnline(cardEsp, esp.connected, snap.pending, 'Connected', 'Disconnected');
    ref(cardEsp, 'wifi').textContent = esp.connected ? (esp.wifi.connected ? 'Connected' + (esp.wifi.rssi != null ? ' · ' + esp.wifi.rssi + ' dBm' : '') : 'Disconnected') : (snap.pending ? '—' : 'Unreachable');
    ref(cardEsp, 'ip').textContent = esp.ip || '—';

    /* 3. Driver status */
    var meta = UI.STATE_META[d.state] || UI.STATE_META.UNKNOWN;
    cardDriver.setAttribute('data-state', d.state);
    ref(cardDriver, 'valueWrap').setAttribute('data-state', d.state);
    ref(cardDriver, 'value').textContent = d.state === 'UNKNOWN' ? 'No data' : d.state;
    ref(cardDriver, 'dur').textContent = d.state === 'UNKNOWN' ? '—' : util.duration((snap.ts - d.since) / 1000);
    ref(cardDriver, 'upd').textContent = snap.pending ? '—' : util.time(snap.ts);

    /* 4. Alert counter */
    ref(cardAlerts, 'value').textContent = snap.alertsSession;
    var last = KS.alerts.list(snap.mode).filter(function (a) { return a.severity !== 'Normal' && a.ts >= KS.sessionStart(); })[0];
    ref(cardAlerts, 'last').textContent = last ? util.time(last.ts) + ' · ' + last.event : 'None yet';
    ref(cardAlerts, 'start').textContent = util.time(KS.sessionStart());

    camera.update(snap);
    metrics.update(snap);
    safety.update(snap);
    devices.update(snap);
    UI.tagSources(document);
  }

  KS.onSnapshot(render);
})();
