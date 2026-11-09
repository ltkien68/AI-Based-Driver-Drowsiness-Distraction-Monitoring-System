/* ==========================================================================
   KSafe AI – Mini chart library (SVG thuần, không phụ thuộc thư viện ngoài)
   KCharts.line(el, opts)   – biểu đồ đường (có ngưỡng, vùng tô, tooltip)
   KCharts.bars(el, opts)   – cột nhóm / cột chồng
   KCharts.donut(el, opts)  – biểu đồ tròn rỗng
   Mỗi hàm trả về { update(newOpts) }; biểu đồ tự vẽ lại khi container đổi kích thước.
   ========================================================================== */
(function (global) {
  'use strict';

  var C = { grid: '#E2E8F0', axis: '#94A3B8', text: '#64748B' };
  var tipEl = null;

  function tip() {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'chart-tip'; tipEl.hidden = true; document.body.appendChild(tipEl); }
    return tipEl;
  }
  function showTip(evt, title, rows) {
    var t = tip();
    t.innerHTML = '<div class="chart-tip__title">' + esc(title) + '</div>' + rows.map(function (r) {
      return '<div class="chart-tip__row"><i style="background:' + r.color + '"></i>' + esc(r.name) + '<b>' + esc(r.value) + '</b></div>';
    }).join('');
    t.hidden = false;
    var x = evt.clientX + 14, y = evt.clientY + 14, w = t.offsetWidth, h = t.offsetHeight;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = evt.clientY - h - 14;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* Tạo chart có tự vẽ lại khi resize */
  function make(el, opts, draw) {
    var api = {
      opts: opts,
      render: function () { draw(el, api.opts); },
      update: function (patch) { api.opts = Object.assign({}, api.opts, patch); api.render(); }
    };
    if (!el._kchart) {
      el._kchart = true;
      if ('ResizeObserver' in window) {
        var w = el.clientWidth;
        new ResizeObserver(function () { if (el.clientWidth !== w) { w = el.clientWidth; el._api && el._api.render(); } }).observe(el);
      }
    }
    el._api = api;
    el.classList.add('chart');
    api.render();
    return api;
  }

  function emptyMsg(el, text) {
    var d = document.createElement('div'); d.className = 'chart__empty'; d.textContent = text; el.appendChild(d);
  }
  function niceTicks(min, max, n) {
    var out = [], step = (max - min) / n;
    for (var i = 0; i <= n; i++) out.push(min + step * i);
    return out;
  }
  function path(points) { // points: [[x,y] | null] – null ngắt đường
    var d = '', open = false;
    points.forEach(function (p) {
      if (!p) { open = false; return; }
      d += (open ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); open = true;
    });
    return d;
  }

  /* ---------------------------------------------------------------- */
  function drawLine(el, o) {
    el.innerHTML = '';
    var W = el.clientWidth || 600, H = o.height || 220;
    var m = { l: 44, r: 14, t: 12, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var n = o.labels.length;
    var all = [];
    o.series.forEach(function (s) { s.data.forEach(function (v) { if (v != null) all.push(v); }); });
    (o.thresholds || []).forEach(function (t) { all.push(t.value); });
    if (!all.length) { el.style.height = H + 'px'; emptyMsg(el, o.emptyText || 'No data'); return; }
    var yMin = o.yMin != null ? o.yMin : Math.min.apply(null, all);
    var yMax = o.yMax != null ? o.yMax : Math.max.apply(null, all);
    if (yMax === yMin) { yMax += 1; yMin -= 1; }
    if (o.yMin == null) yMin -= (yMax - yMin) * .08;
    if (o.yMax == null) yMax += (yMax - yMin) * .08;
    var fmt = o.yFormat || function (v) { return (Math.round(v * 100) / 100).toString(); };
    var X = function (i) { return m.l + (n <= 1 ? pw / 2 : pw * i / (n - 1)); };
    var Y = function (v) { return m.t + ph - ph * (v - yMin) / (yMax - yMin); };

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.ariaLabel || 'Line chart') + '">';
    niceTicks(yMin, yMax, 4).forEach(function (v) {
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + C.grid + '"/>' +
        '<text x="' + (m.l - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + esc(fmt(v)) + '</text>';
    });
    var step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 64))));
    o.labels.forEach(function (l, i) {
      if (i % step === 0 || (o.xLabelLast && i === n - 1)) s += '<text x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(l) + '</text>';
    });
    (o.thresholds || []).forEach(function (t) {
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t.value) + '" y2="' + Y(t.value) + '" stroke="' + t.color + '" stroke-dasharray="5 4" stroke-width="1.5"/>' +
        '<text x="' + (W - m.r - 2) + '" y="' + (Y(t.value) - 5) + '" text-anchor="end" style="fill:' + t.color + ';font-weight:600">' + esc(t.label) + '</text>';
    });
    o.series.forEach(function (ser, si) {
      var pts = ser.data.map(function (v, i) { return v == null ? null : [X(i), Y(v)]; });
      if (o.area && si === 0) {
        var first = pts.findIndex(function (p) { return p; }), last = pts.length - 1;
        while (last >= 0 && !pts[last]) last--;
        if (first >= 0) s += '<path d="' + path(pts) + 'L' + pts[last][0].toFixed(1) + ' ' + (m.t + ph) + 'L' + pts[first][0].toFixed(1) + ' ' + (m.t + ph) + 'Z" fill="' + ser.color + '" fill-opacity=".08"/>';
      }
      s += '<path d="' + path(pts) + '" fill="none" stroke="' + ser.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' + (ser.dashed ? ' stroke-dasharray="4 3"' : '') + '/>';
      if (o.dots) pts.forEach(function (p) { if (p) s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#fff" stroke="' + ser.color + '" stroke-width="2"/>'; });
    });
    s += '<line class="hair" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ph) + '" stroke="' + C.axis + '" stroke-dasharray="3 3" visibility="hidden"/>' +
      '<rect class="hit" x="' + m.l + '" y="' + m.t + '" width="' + pw + '" height="' + ph + '" fill="transparent"/></svg>';
    el.style.height = '';
    el.innerHTML = s;

    var svg = el.querySelector('svg'), hit = svg.querySelector('.hit'), hair = svg.querySelector('.hair');
    hit.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width);
      var i = n <= 1 ? 0 : util(Math.round((x - m.l) / pw * (n - 1)), 0, n - 1);
      hair.setAttribute('x1', X(i)); hair.setAttribute('x2', X(i)); hair.setAttribute('visibility', 'visible');
      showTip(e, o.labels[i], o.series.map(function (ser) {
        return { name: ser.name, color: ser.color, value: ser.data[i] == null ? '—' : fmt(ser.data[i]) + (o.unit || '') };
      }));
    });
    hit.addEventListener('mouseleave', function () { hair.setAttribute('visibility', 'hidden'); hideTip(); });
  }
  function util(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------------------------------------------------------------- */
  function drawBars(el, o) {
    el.innerHTML = '';
    var W = el.clientWidth || 600, H = o.height || 240;
    var m = { l: 36, r: 8, t: 12, b: 26 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    var n = o.labels.length, stacked = o.stacked !== false;
    var totals = o.labels.map(function (_, i) {
      return stacked ? o.series.reduce(function (a, s) { return a + (s.data[i] || 0); }, 0)
        : Math.max.apply(null, o.series.map(function (s) { return s.data[i] || 0; }));
    });
    var max = Math.max.apply(null, totals);
    if (!(max > 0) && !o.allowZero) { el.style.height = H + 'px'; emptyMsg(el, o.emptyText || 'No data in this range'); return; }
    var yMax = o.integer === false ? max * 1.1 : Math.max(4, Math.ceil(max / 4) * 4);
    var fmt = o.yFormat || function (v) { return String(Math.round(v * 10) / 10); };
    var Y = function (v) { return m.t + ph - ph * v / yMax; };
    var slot = pw / n, bw = Math.min(40, slot * .62);

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.ariaLabel || 'Bar chart') + '">';
    niceTicks(0, yMax, 4).forEach(function (v) {
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + C.grid + '"/>' +
        '<text x="' + (m.l - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + esc(fmt(v)) + '</text>';
    });
    var step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 44))));
    o.labels.forEach(function (l, i) {
      var cx = m.l + slot * i + slot / 2;
      if (i % step === 0) s += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(l) + '</text>';
      var acc = 0;
      if (stacked) {
        o.series.forEach(function (ser, si) {
          var v = ser.data[i] || 0; if (!v) return;
          var y1 = Y(acc + v), y0 = Y(acc), h = y0 - y1; acc += v;
          s += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, h - (si ? 1 : 0)).toFixed(1) + '" rx="3" fill="' + ser.color + '"/>';
        });
      } else {
        var gw = bw / o.series.length;
        o.series.forEach(function (ser, si) {
          var v = ser.data[i] || 0, h = ph * v / yMax;
          s += '<rect x="' + (cx - bw / 2 + si * gw).toFixed(1) + '" y="' + (m.t + ph - h).toFixed(1) + '" width="' + (gw - 1).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + ser.color + '"/>';
        });
      }
      s += '<rect class="hit" data-i="' + i + '" x="' + (m.l + slot * i) + '" y="' + m.t + '" width="' + slot + '" height="' + ph + '" fill="transparent"/>';
    });
    s += '</svg>';
    el.style.height = '';
    el.innerHTML = s;
    el.querySelectorAll('.hit').forEach(function (r) {
      r.addEventListener('mousemove', function (e) {
        var i = +r.getAttribute('data-i');
        showTip(e, o.tooltipTitles ? o.tooltipTitles[i] : o.labels[i], o.series.map(function (ser) {
          return { name: ser.name, color: ser.color, value: fmt(ser.data[i] || 0) + (o.unit || '') };
        }));
      });
      r.addEventListener('mouseleave', hideTip);
    });
  }

  /* ---------------------------------------------------------------- */
  function drawDonut(el, o) {
    el.innerHTML = '';
    var size = o.size || 180, r = size * .36, sw = size * .13, cx = size / 2, circ = 2 * Math.PI * r;
    var total = o.segments.reduce(function (a, s) { return a + s.value; }, 0);
    var s = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(o.ariaLabel || 'Donut chart') + '" style="max-width:100%">' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="' + C.grid + '" stroke-width="' + sw + '"/>';
    if (total > 0) {
      var off = 0;
      o.segments.forEach(function (seg, i) {
        var len = circ * seg.value / total;
        if (len <= 0) return;
        s += '<circle class="seg" data-i="' + i + '" cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="' + seg.color + '" stroke-width="' + sw + '" stroke-dasharray="' + Math.max(0, len - 1.5).toFixed(2) + ' ' + (circ - Math.max(0, len - 1.5)).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cx + ')"/>';
        off += len;
      });
    }
    s += '<text x="' + cx + '" y="' + (cx + 2) + '" text-anchor="middle" style="font-size:' + size * .15 + 'px;font-weight:700;fill:#0F172A">' + esc(o.centerTop || '') + '</text>' +
      '<text x="' + cx + '" y="' + (cx + size * .11) + '" text-anchor="middle" style="font-size:' + size * .06 + 'px">' + esc(o.centerBottom || '') + '</text></svg>';
    el.innerHTML = s;
    el.style.display = 'flex'; el.style.justifyContent = 'center';
    el.querySelectorAll('.seg').forEach(function (c) {
      c.addEventListener('mousemove', function (e) {
        var seg = o.segments[+c.getAttribute('data-i')];
        showTip(e, seg.label, [{ name: 'Share', color: seg.color, value: (seg.value / total * 100).toFixed(1) + '%' }]);
      });
      c.addEventListener('mouseleave', hideTip);
    });
  }

  global.KCharts = {
    line: function (el, opts) { return make(el, opts, drawLine); },
    bars: function (el, opts) { return make(el, opts, drawBars); },
    donut: function (el, opts) { return make(el, opts, drawDonut); }
  };
})(window);
