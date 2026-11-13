/* ==========================================================================
   KSafe AI – Arduino Uno device overview
   Arduino Uno nhan lenh tu Python AI Engine qua Serial.
   Chua co telemetry doc lap tu Arduino, vi vay khong hien thi Online gia.
   ========================================================================== */
(function () {
  'use strict';

  var KS = KSafe, UI = KUI, util = KS.util, esc = util.esc;
  var $ = function (s) { return document.querySelector(s); };
  var grid = UI.DeviceGrid($('#dev-grid'), { wide: true });
  KIcons.hydrate(document);

  function render(snap) {
    var demo = snap.mode === 'demo';
    var arduino = snap.arduino || {};
    var rows = [
      ['Bo dieu khien', 'Arduino Uno'],
      ['Giao tiep', 'Serial tu Python AI Engine'],
      ['Nguon trang thai', demo ? 'Du lieu mo phong DEMO' : 'Chua co telemetry rieng'],
      ['Trang thai tai xe gui xuong', demo ? (snap.driver.state || 'UNKNOWN') : 'Python xu ly va gui qua Serial'],
      ['MQTT Broker', snap.mqtt && snap.mqtt.connected ? 'Connected' : demo ? 'DEMO' : 'Khong lien quan den ket noi Arduino'],
      ['Python AI', snap.ai && snap.ai.online ? 'Online' : 'Offline']
    ];
    var html = rows.map(function (r) {
      return '<div class="kv"><span>' + esc(r[0]) + '</span><strong>' + esc(r[1]) + '</strong></div>';
    }).join('');
    var info = $('#dev-info');
    if (info._h !== html) { info.innerHTML = html; info._h = html; }

    $('#dev-conn-badge').innerHTML = demo
      ? UI.badge('info', 'DEMO')
      : UI.badge('off', 'Chua co telemetry Arduino');
    grid.update(snap);
    UI.tagSources(document);
  }

  $('#btn-refresh') && $('#btn-refresh').addEventListener('click', function () {
    var snap = KS.snapshot();
    if (snap) render(snap);
    UI.toast('Da cap nhat thong tin tu snapshot hien tai', 'info');
  });

  KS.onSnapshot(render);
})();
