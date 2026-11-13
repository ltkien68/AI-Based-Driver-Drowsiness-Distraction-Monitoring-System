/* ==========================================================================
   KSafe AI – Boot
   Thứ tự nạp script trên mỗi trang:
     icons.js → i18n.js → lang/vi.js → api.js → charts.js → components.js → main.js → <trang>.js
   main.js dựng khung (sidebar/header), nạp icon, rồi khởi động engine dữ liệu.
   Script riêng của từng trang chạy SAU main.js và đăng ký nhận snapshot qua KSafe.onSnapshot().
   ========================================================================== */
(function () {
  'use strict';
  KI18n.init();             // dịch nội dung tĩnh + bật quan sát để dịch nội dung JS render
  KLayout.mount();          // sidebar + header + banner
  KIcons.hydrate(document); // thay <i data-icon> trong nội dung trang
  KUI.tagSources(document); // gắn nhãn DEMO/REAL
  KSafe.start();            // bat dau MQTT (REAL) hoac mo phong (DEMO)
})();
