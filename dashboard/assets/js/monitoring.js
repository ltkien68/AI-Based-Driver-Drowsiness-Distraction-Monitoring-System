/* ==========================================================================
   KSafe AI – Live Monitoring page
   Camera + số đo realtime + biểu đồ EAR / Head pose + gaze.
   Lịch sử biểu đồ chỉ giữ trong bộ nhớ trang (60 mẫu gần nhất).
   ========================================================================== */
(function () {
  'use strict';

  var KS = KSafe, UI = KUI, util = KS.util;
  var $ = function (s) { return document.querySelector(s); };

  var camera = UI.CameraView($('#camera'), { tall: true });
  var metrics = UI.MetricsPanel($('#metrics'));
  var safety = UI.SafetyPanel($('#safety'));
  KIcons.hydrate(document);

  var MAX = 60;
  var hist = { labels: [], ear: [], pitch: [], yaw: [], roll: [] };
  var gazeCount = { Center: 0, Left: 0, Right: 0, Up: 0, Down: 0, 'Eyes closed': 0 };
  var paused = false, lastSample = 0, lastMode = null;

  var earChart = KCharts.line($('#chart-ear'), { labels: [], series: [{ name: 'EAR', color: '#2563EB', data: [] }], height: 260, yMin: 0, yMax: 0.4, area: true,
    thresholds: [{ value: KS.settings.get().earThreshold, color: '#DC2626', label: 'Threshold' }], yFormat: function (v) { return v.toFixed(2); }, emptyText: 'Waiting for AI data…', ariaLabel: 'Eye aspect ratio over time' });
  var poseChart = KCharts.line($('#chart-pose'), { labels: [], series: [], height: 260, yMin: -45, yMax: 45, yFormat: function (v) { return Math.round(v) + '°'; }, unit: '°', emptyText: 'Waiting for AI data…', ariaLabel: 'Head pose over time' });

  function reset() {
    ['labels', 'ear', 'pitch', 'yaw', 'roll'].forEach(function (k) { hist[k] = []; });
    Object.keys(gazeCount).forEach(function (k) { gazeCount[k] = 0; });
    drawCharts();
  }

  function drawCharts() {
    var s = KS.settings.get();
    earChart.update({ labels: hist.labels, series: [{ name: 'EAR', color: '#2563EB', data: hist.ear }],
      thresholds: [{ value: s.earThreshold, color: '#DC2626', label: 'Threshold ' + s.earThreshold.toFixed(2) }] });
    poseChart.update({ labels: hist.labels, thresholds: [
      { value: s.distractionYaw, color: '#EAB308', label: '+' + s.distractionYaw + '°' }, { value: -s.distractionYaw, color: '#EAB308', label: '−' + s.distractionYaw + '°' }],
      series: [{ name: 'Pitch', color: '#2563EB', data: hist.pitch }, { name: 'Yaw', color: '#0F172A', data: hist.yaw }, { name: 'Roll', color: '#94A3B8', data: hist.roll }] });
  }

  function drawGaze(snap) {
    var ai = snap.ai, s = KS.settings.get(), card = $('#gaze-card'), dot = $('#gaze-dot'), badge = $('#gaze-badge');
    var gaze = ai.online ? (ai.gaze || (ai.yaw != null ? UI.gazeFromPose(ai, s) : null)) : null;
    card.setAttribute('data-state', snap.driver.state);
    if (!gaze || ai.yaw == null) {
      dot.hidden = true; badge.className = 'badge badge--off'; badge.textContent = 'No data';
    } else {
      dot.hidden = false;
      var x = 50 + util.clamp(ai.yaw / 45, -1, 1) * 40, y = 50 - util.clamp(ai.pitch / 45, -1, 1) * 40;
      dot.style.left = x + '%'; dot.style.top = y + '%';
      badge.className = 'badge badge--' + (gaze === 'Center' ? 'safe' : 'focus'); badge.textContent = gaze;
    }
    var total = Object.keys(gazeCount).reduce(function (a, k) { return a + gazeCount[k]; }, 0);
    var html = Object.keys(gazeCount).map(function (k) {
      var pct = total ? Math.round(gazeCount[k] / total * 100) : 0;
      return '<div class="dist-row"><span>' + k + '</span><div class="dist-bar"><i style="width:' + pct + '%' + (k === 'Center' ? '' : ';background:#EAB308') + '"></i></div><b>' + pct + '%</b></div>';
    }).join('');
    var box = $('#gaze-dist'); if (box._h !== html) { box.innerHTML = html; box._h = html; }
  }

  function render(snap) {
    if (lastMode && lastMode !== snap.mode) reset();
    lastMode = snap.mode;
    camera.update(snap); metrics.update(snap); safety.update(snap);

    var ai = snap.ai, ear = $('#ear-now'), eb = $('#ear-badge');
    if (ai.online && ai.ear != null) {
      ear.textContent = ai.ear.toFixed(2);
      var closed = snap.driver.eyesClosed;
      eb.className = 'badge badge--' + (snap.driver.drowsy ? 'danger' : closed ? 'focus' : 'safe');
      eb.textContent = snap.driver.drowsy ? 'Drowsy' : closed ? 'Eyes closed' : 'Eyes open';
    } else { ear.textContent = '—'; eb.className = 'badge badge--off'; eb.textContent = 'No data'; }

    [['pitch', ai.pitch], ['yaw', ai.yaw], ['roll', ai.roll]].forEach(function (p) {
      var el = document.querySelector('#pose-legend [data-v="' + p[0] + '"]');
      if (el) el.textContent = ai.online && p[1] != null ? UI.signed(p[1]) + '°' : '—';
    });

    if (ai.online && !paused && snap.ts - lastSample >= 900) {
      lastSample = snap.ts;
      var push = function (k, v) { hist[k].push(v); if (hist[k].length > MAX) hist[k].shift(); };
      push('labels', util.time(snap.ts)); push('ear', ai.ear); push('pitch', ai.pitch); push('yaw', ai.yaw); push('roll', ai.roll);
      var g = ai.gaze || (ai.yaw != null ? UI.gazeFromPose(ai, KS.settings.get()) : null);
      if (g && gazeCount[g] != null) gazeCount[g]++;
      drawCharts();
    }
    drawGaze(snap);
    UI.tagSources(document);
  }

  $('#btn-pause').addEventListener('click', function () {
    paused = !paused;
    this.setAttribute('aria-pressed', String(paused));
    this.querySelector('span').textContent = paused ? 'Resume charts' : 'Pause charts';
    var svg = this.querySelector('svg'); this.replaceChild(document.createRange().createContextualFragment(KIcons.svg(paused ? 'play' : 'pause', 14)), svg);
  });
  $('#btn-clear').addEventListener('click', function () { reset(); UI.toast('Chart history cleared', 'info'); });
  KS.bus.on('settings', drawCharts);
  KS.onSnapshot(render);
})();
