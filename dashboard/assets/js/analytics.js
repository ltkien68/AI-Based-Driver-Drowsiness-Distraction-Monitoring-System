/* ==========================================================================
   KSafe AI – Analytics page
   Thống kê từ KS.alerts + KS.stats theo khoảng thời gian chọn (Today / 7 / 14 ngày).
   ========================================================================== */
(function () {
  'use strict';

  var KS = KSafe, UI = KUI, util = KS.util;
  var $ = function (s) { return document.querySelector(s); };
  var range = 7;
  KIcons.hydrate(document);

  var COLORS = { drowsy: '#2563EB', distract: '#0F172A', SAFE: '#16A34A', FOCUS: '#EAB308', DANGER: '#DC2626' };
  var alertsChart = KCharts.bars($('#chart-alerts'), { labels: [], series: [], height: 260 });
  var activeChart = KCharts.bars($('#chart-active'), { labels: [], series: [], height: 220 });
  var donut = KCharts.donut($('#chart-donut'), { segments: [], size: 160 });

  function render() {
    var mode = KS.mode(), now = Date.now(), today = util.midnight(now), start = today - (range - 1) * 86400000;
    var alerts = KS.alerts.list(mode).filter(function (a) { return a.ts >= start && a.severity !== 'Normal'; });
    var days = KS.stats.days(mode, range);
    var drowsy = alerts.filter(function (a) { return a.category === 'drowsiness'; });
    var distract = alerts.filter(function (a) { return a.category === 'distraction'; });

    $('#k-drowsy').textContent = drowsy.length;
    $('#k-distract').textContent = distract.length;

    var active = days.reduce(function (a, d) { return a + d.active; }, 0);
    var tot = { SAFE: 0, FOCUS: 0, DANGER: 0 };
    days.forEach(function (d) { tot.SAFE += d.SAFE; tot.FOCUS += d.FOCUS; tot.DANGER += d.DANGER; });
    var sum = tot.SAFE + tot.FOCUS + tot.DANGER;
    $('#k-active').innerHTML = util.hours(active) + '<small> h</small>';
    $('#k-active-note').textContent = range === 1 ? 'Today' : 'Last ' + range + ' days';
    $('#k-safe').textContent = sum ? Math.round(tot.SAFE / sum * 100) + '%' : '—';

    /* Alerts over time */
    var labels, d1, d2, titles = null;
    if (range === 1) {
      labels = []; d1 = []; d2 = [];
      for (var h = 0; h < 24; h++) { labels.push(util.pad(h)); d1.push(0); d2.push(0); }
      alerts.forEach(function (a) { var h2 = new Date(a.ts).getHours(); (a.category === 'drowsiness' ? d1 : d2)[h2]++; });
      titles = labels.map(function (l) { return l + ':00 – ' + l + ':59'; });
    } else {
      labels = days.map(function (d) { return util.shortDate(d.ts); });
      d1 = days.map(function (d) { return drowsy.filter(function (a) { return util.dateKey(a.ts) === d.key; }).length; });
      d2 = days.map(function (d) { return distract.filter(function (a) { return util.dateKey(a.ts) === d.key; }).length; });
    }
    alertsChart.update({ labels: labels, tooltipTitles: titles, emptyText: mode === 'real' ? 'No alerts recorded in REAL mode in this range' : 'No alerts in this range',
      series: [{ name: 'Drowsiness', color: COLORS.drowsy, data: d1 }, { name: 'Distraction', color: COLORS.distract, data: d2 }], ariaLabel: 'Alerts over time' });

    /* Active hours */
    activeChart.update({ labels: days.map(function (d) { return util.shortDate(d.ts); }), integer: false, unit: ' h', yFormat: function (v) { return v.toFixed(1); },
      emptyText: 'No activity recorded in this range', series: [{ name: 'Active', color: '#2563EB', data: days.map(function (d) { return +(d.active / 3600).toFixed(2); }) }], ariaLabel: 'Active hours per day' });
    $('#active-sub').textContent = range === 1 ? 'today' : 'last ' + range + ' days';

    /* Donut + legend */
    var segs = ['SAFE', 'FOCUS', 'DANGER'].map(function (k) { return { label: k, value: tot[k], color: COLORS[k] }; });
    donut.update({ segments: segs, centerTop: sum ? Math.round(tot.SAFE / sum * 100) + '%' : '—', centerBottom: sum ? 'SAFE' : 'no data' });
    $('#donut-legend').innerHTML = segs.map(function (s) {
      return '<div class="donut-legend__item"><i style="background:' + s.color + '"></i><div>' + s.label + '<small>' + (sum ? util.duration(s.value) : '—') + '</small></div><b>' + (sum ? (s.value / sum * 100).toFixed(1) + '%' : '—') + '</b></div>';
    }).join('');

    /* Uptime stats */
    var snap = KS.snapshot(), withData = days.filter(function (d) { return d.active > 0; }).length;
    var todayRec = days[days.length - 1];
    var rows = [
      ['Dashboard session', util.duration((now - KS.sessionStart()) / 1000)],
      ['Active time today', util.duration(todayRec.active)],
      ['Active time (' + (range === 1 ? 'today' : 'last ' + range + ' days') + ')', util.duration(active)],
      ['Average per active day', withData ? util.duration(active / withData) : '—'],
      ['Days with recorded activity', withData + ' / ' + range],
      ['Arduino Uno', 'Điều khiển qua Serial'],
      ['Data source', mode.toUpperCase()]
    ];
    $('#uptime-stats').innerHTML = rows.map(function (r) { return '<div class="kv"><span>' + r[0] + '</span><strong class="mono">' + r[1] + '</strong></div>'; }).join('');
    UI.tagSources(document);
  }

  $('#range').addEventListener('click', function (e) {
    var b = e.target.closest('[data-range]'); if (!b) return;
    range = +b.getAttribute('data-range');
    this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });

  var last = 0;
  KS.onSnapshot(function () { var n = Date.now(); if (n - last > 2000) { last = n; render(); } });
  KS.bus.on('settings', render); KS.bus.on('alerts', render);
  render();
})();
