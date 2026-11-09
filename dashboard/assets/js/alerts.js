/* ==========================================================================
   KSafe AI – Alert History page
   Tìm kiếm, lọc theo ngày / trạng thái / mức độ, sắp xếp, phân trang, xuất CSV.
   ========================================================================== */
(function () {
  'use strict';

  var KS = KSafe, UI = KUI, util = KS.util, esc = util.esc;
  var $ = function (s) { return document.querySelector(s); };
  var PAGE = 10;
  var state = { page: 1, sortKey: 'ts', sortDir: 'desc' };
  var els = { q: $('#q'), from: $('#f-from'), to: $('#f-to'), status: $('#f-status'), sev: $('#f-sev') };
  var SEV_ORDER = { Critical: 3, Warning: 2, Normal: 1 };
  KIcons.hydrate(document);

  function filtered() {
    var q = els.q.value.trim().toLowerCase(), from = els.from.value, to = els.to.value;
    var list = KS.alerts.list(KS.mode()).filter(function (a) {
      if (els.status.value && a.status !== els.status.value) return false;
      if (els.sev.value && a.severity !== els.sev.value) return false;
      var dk = util.dateKey(a.ts);
      if (from && dk < from) return false;
      if (to && dk > to) return false;
      if (q && ([a.event, a.severity, a.status, a.detail || ''].map(function (x) { return x + ' ' + KI18n.t(x); }).join(' ') + ' ' + util.time(a.ts)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var dir = state.sortDir === 'asc' ? 1 : -1, k = state.sortKey;
    list.sort(function (a, b) {
      var va = k === 'severity' ? SEV_ORDER[a.severity] : k === 'ts' ? a.ts : String(a[k]).toLowerCase();
      var vb = k === 'severity' ? SEV_ORDER[b.severity] : k === 'ts' ? b.ts : String(b[k]).toLowerCase();
      return (va < vb ? -1 : va > vb ? 1 : b.ts - a.ts) * dir;
    });
    return list;
  }

  function th(key, label, cls) {
    var active = state.sortKey === key;
    return '<th' + (cls ? ' class="' + cls + '"' : '') + ' aria-sort="' + (active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none') + '">' +
      '<button type="button" class="table-sort" data-sort="' + key + '">' + label + (active ? KIcons.svg(state.sortDir === 'asc' ? 'chevron-up' : 'chevron-down', 12) : '') + '</button></th>';
  }

  function render() {
    var list = filtered(), total = list.length, pages = Math.max(1, Math.ceil(total / PAGE));
    state.page = util.clamp(state.page, 1, pages);
    var slice = list.slice((state.page - 1) * PAGE, state.page * PAGE), mode = KS.mode();

    $('#k-total').textContent = total;
    $('#k-crit').textContent = list.filter(function (a) { return a.severity === 'Critical'; }).length;
    $('#k-warn').textContent = list.filter(function (a) { return a.severity === 'Warning'; }).length;
    $('#k-open').textContent = list.filter(function (a) { return a.status === 'Detected'; }).length;
    var all = KS.alerts.list(mode).length;
    $('#k-total-note').textContent = total === all ? 'All recorded alerts' : 'of ' + all + ' recorded';

    var tbl = $('#alert-table');
    if (!total) {
      tbl.innerHTML = '<div class="empty">' + KIcons.svg(all ? 'search' : 'bell', 30) + '<strong>' + (all ? 'No alerts match your filters' : 'No alerts recorded yet') + '</strong>' +
        (all ? 'Try a different search or widen the date range.' : mode === 'real' ? 'Alerts appear when the Python AI service reports FOCUS or DANGER while in REAL mode.' : 'Alerts are generated as the demo scenario runs.') + '</div>';
    } else {
      tbl.innerHTML = '<table class="table"><thead><tr>' + th('ts', 'Date / time') + th('event', 'Event') + th('severity', 'Severity') + th('status', 'Status') + '<th class="hide-sm">Details</th></tr></thead><tbody>' +
        slice.map(function (a) {
          return '<tr><td class="col-time">' + util.dateLabel(a.ts) + ' &nbsp;<span style="color:var(--color-text)">' + util.time(a.ts) + '</span></td><td><strong>' + esc(a.event) + '</strong></td><td>' +
            UI.severityBadge(a.severity) + '</td><td>' + UI.statusBadge(a.status) + '</td><td class="hide-sm muted">' + esc(a.detail || '—') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    var from = total ? (state.page - 1) * PAGE + 1 : 0, to = Math.min(total, state.page * PAGE);
    var nums = '';
    for (var p = 1; p <= pages; p++) {
      if (pages > 7 && p !== 1 && p !== pages && Math.abs(p - state.page) > 1) { if (nums.slice(-3) !== '…') nums += '<span aria-hidden="true">…</span>'; continue; }
      nums += '<button class="btn btn--sm btn--icon" type="button" data-page="' + p + '"' + (p === state.page ? ' aria-current="page"' : '') + '>' + p + '</button>';
    }
    $('#pager').innerHTML = '<span>Showing ' + from + '–' + to + ' of ' + total + '</span><div class="pager__nav">' +
      '<button class="btn btn--sm btn--icon" type="button" data-page="' + (state.page - 1) + '" aria-label="Previous page"' + (state.page === 1 ? ' disabled' : '') + '>' + KIcons.svg('chevron-left', 16) + '</button>' + nums +
      '<button class="btn btn--sm btn--icon" type="button" data-page="' + (state.page + 1) + '" aria-label="Next page"' + (state.page === pages ? ' disabled' : '') + '>' + KIcons.svg('chevron-right', 16) + '</button></div>';
    UI.tagSources(document);
  }

  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-sort]'), p = e.target.closest('.pager [data-page]'); // không dùng '[data-page]' trần: <body data-page> cũng khớp
    if (s) { var k = s.getAttribute('data-sort'); state.sortDir = state.sortKey === k && state.sortDir === 'desc' ? 'asc' : 'desc'; state.sortKey = k; state.page = 1; render(); }
    if (p && !p.disabled) { state.page = +p.getAttribute('data-page'); render(); }
  });
  Object.keys(els).forEach(function (k) { els[k].addEventListener(k === 'q' ? 'input' : 'change', function () { state.page = 1; render(); }); });
  $('#filters').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#btn-reset-filters').addEventListener('click', function () { Object.keys(els).forEach(function (k) { els[k].value = ''; }); state.page = 1; render(); });

  $('#btn-export').addEventListener('click', function () {
    var list = filtered();
    if (!list.length) { UI.toast('Nothing to export – no alerts match the filters', 'warn'); return; }
    var csvCell = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }; // chống CSV/formula injection
    var rows = [['Date', 'Time', 'Event', 'Severity', 'Status', 'Details', 'Source']].concat(list.map(function (a) {
      return [util.dateKey(a.ts), util.time(a.ts), a.event, a.severity, a.status, a.detail || '', a.source.toUpperCase()];
    }));
    var blob = new Blob(['﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ksafe-alerts-' + KS.mode() + '-' + util.dateKey(Date.now()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    UI.toast('Exported ' + list.length + ' alerts', 'success');
  });

  KS.bus.on('alerts', render); KS.bus.on('settings', render);
  KS.onSnapshot(function () { /* đảm bảo engine đã chạy; bảng tự cập nhật qua sự kiện 'alerts' */ });
  render();
})();
