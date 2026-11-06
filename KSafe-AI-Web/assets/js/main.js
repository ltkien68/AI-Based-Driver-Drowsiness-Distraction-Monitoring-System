document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  const time = () => {
    const now = new Date();
    const dateEl = document.getElementById('currentDate');
    const timeEl = document.getElementById('currentTime');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('vi-VN', { day:'2-digit', month:'short', year:'numeric' });
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('vi-VN', { hour12:false });
  };
  time(); setInterval(time, 1000);
  const menu = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (menu && sidebar) menu.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.querySelectorAll('.nav-link').forEach(link => {
    const current = location.pathname.split('/').pop() || 'index.html';
    if (link.getAttribute('href')?.endsWith(current)) link.classList.add('active');
  });
  const refresh = document.getElementById('refreshButton');
  if (refresh) refresh.addEventListener('click', () => {
    refresh.querySelector('svg')?.classList.add('spin');
    window.KSafeDashboard?.refresh();
    setTimeout(() => refresh.querySelector('svg')?.classList.remove('spin'), 500);
  });
});
