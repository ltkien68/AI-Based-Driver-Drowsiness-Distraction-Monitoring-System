/* ==========================================================================
   KSafe AI – Đa ngôn ngữ (Tiếng Việt / English)
   --------------------------------------------------------------------------
   Cách hoạt động:
     • HTML và JS vẫn viết bằng tiếng Anh (làm "khoá gốc").
     • Gói ngôn ngữ (assets/js/lang/vi.js) chứa từ điển  "English" → "Tiếng Việt"
       và các mẫu (regex) cho chuỗi có số liệu động.
     • Engine dịch mọi text node + thuộc tính (placeholder, title, aria-label, alt)
       và dùng MutationObserver để dịch luôn nội dung do JS render sau đó.
     • Chuyển ngôn ngữ chỉ khôi phục / dịch lại các node đã ghi nhớ bản gốc.
   Thêm ngôn ngữ mới: tạo assets/js/lang/xx.js gọi KI18n.register('xx', {...}),
   nạp trước main.js, rồi thêm nút trong components.js.
   Thêm chuỗi mới: thêm một dòng vào dict của gói ngôn ngữ. Chuỗi thiếu sẽ được
   liệt kê ở console khi gọi KI18n.misses().
   ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'ksafe.lang', DEFAULT = 'vi';
  var packs = {}, lang = DEFAULT, started = false, listeners = [], missed = {};
  try { var saved = localStorage.getItem(KEY); if (saved === 'vi' || saved === 'en') lang = saved; } catch (e) { /* bỏ qua */ }

  var textRec = new WeakMap(), attrRec = new WeakMap();
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, NOSCRIPT: 1 };
  var NO_MISS = /^[^a-z]*$|^(https?:|GET \/|POST \/|v\d|KSafe-LAN|English)|^(KSafe AI|Wi-Fi|MediaPipe|Python AI|OpenCV|Arduino Uno|Website|Camera|Firmware|Pitch|Yaw|Roll|EAR|FPS|Webcam|DEMO|REAL|LIVE|OK|HTTP)\b/;

  /* ---------------- Dịch một chuỗi ---------------- */
  function lookup(pack, key, depth) {
    if (Object.prototype.hasOwnProperty.call(pack.dict, key)) return pack.dict[key];
    var t = function (x) { var r = lookup(pack, x, depth + 1); return r == null ? x : r; };
    var pats = pack.patterns || [];
    for (var i = 0; i < pats.length; i++) {
      var m = key.match(pats[i][0]);
      if (m) return typeof pats[i][1] === 'function' ? pats[i][1](m, t) : pats[i][1].replace(/\$(\d)/g, function (_, n) { return m[+n]; });
    }
    if (depth < 3 && key.indexOf(' · ') > -1) { // "A · B · C": dịch từng đoạn
      var changed = false, parts = key.split(' · ').map(function (seg) {
        var r = lookup(pack, seg, depth + 1);
        if (r != null) { changed = true; return r; }
        return seg;
      });
      if (changed) return parts.join(' · ');
    }
    return null;
  }
  function tr(s) {
    var pack = packs[lang];
    if (!pack) return s;
    var lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    var key = s.replace(/\s+/g, ' ').trim();
    if (!key) return s;
    var out = lookup(pack, key, 0);
    if (out == null) {
      if (/[A-Za-z]{4,}/.test(key) && !NO_MISS.test(key)) missed[key] = 1;
      return s;
    }
    return lead + out + trail;
  }

  /* ---------------- Text node ---------------- */
  function skipNode(n) {
    var p = n.parentNode;
    if (!p || p.nodeType !== 1) return false;
    return !!SKIP[p.nodeName] || (p.closest && !!p.closest('[data-no-i18n]'));
  }
  function syncText(node, force) {
    if (lang === 'en' && !force) return;
    var val = node.nodeValue, rec = textRec.get(node), en;
    if (rec && val === rec.cur) { if (!force) return; en = rec.en; } else en = val;
    if (!/\S/.test(en) || skipNode(node)) return;
    var out = lang === 'en' ? en : tr(en);
    if (out !== val) node.nodeValue = out;
    if (out !== en || rec) textRec.set(node, { en: en, cur: out });
  }

  /* ---------------- Thuộc tính ---------------- */
  function syncAttr(el, name, force) {
    if (lang === 'en' && !force) return;
    var val = el.getAttribute(name);
    if (val == null) return;
    var map = attrRec.get(el) || {}, rec = map[name], en;
    if (rec && val === rec.cur) { if (!force) return; en = rec.en; } else en = val;
    if (!/\S/.test(en) || (el.closest && el.closest('[data-no-i18n]'))) return;
    var out = lang === 'en' ? en : tr(en);
    if (out !== val) el.setAttribute(name, out);
    if (out !== en || rec) { map[name] = { en: en, cur: out }; attrRec.set(el, map); }
  }
  function syncElAttrs(el, force) { for (var i = 0; i < ATTRS.length; i++) if (el.hasAttribute(ATTRS[i])) syncAttr(el, ATTRS[i], force); }

  function translateTree(root, force) {
    if (root.nodeType === 3) { syncText(root, force); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    syncElAttrs(root, force);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) syncText(n, force);
      else if (!SKIP[n.nodeName]) syncElAttrs(n, force);
    }
  }

  /* ---------------- Observer ---------------- */
  var observer = null;
  function onMutations(records) {
    if (lang === 'en') return;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === 'childList') { for (var j = 0; j < r.addedNodes.length; j++) translateTree(r.addedNodes[j], false); }
      else if (r.type === 'characterData') syncText(r.target, false);
      else if (r.type === 'attributes') syncAttr(r.target, r.attributeName, false);
    }
  }

  /* ---------------- API công khai ---------------- */
  var API = {
    register: function (code, pack) { packs[code] = pack; },
    lang: function () { return lang; },
    t: function (s) { return lang === 'en' ? s : tr(s); },
    onChange: function (fn) { listeners.push(fn); },
    misses: function () { return Object.keys(missed); },
    setLang: function (code) {
      if (code !== 'vi' && code !== 'en') return;
      if (code === lang) return;
      lang = code;
      try { localStorage.setItem(KEY, lang); } catch (e) { /* bỏ qua */ }
      document.documentElement.lang = lang;
      translateTree(document.documentElement, true);
      listeners.forEach(function (fn) { try { fn(lang); } catch (e) { console.error(e); } });
    },
    init: function () {
      if (started) return; started = true;
      document.documentElement.lang = lang;
      translateTree(document.documentElement, false);
      observer = new MutationObserver(onMutations);
      observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
  };
  global.KI18n = API;
})(window);
