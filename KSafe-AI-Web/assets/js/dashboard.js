const KSafeDashboard = (() => {
  const $ = id => document.getElementById(id);
  let toastTimer;
  function toast(message) {
    const el = $('toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  async function refresh() {
    // Never label the device online unless a real ESP32 response is received.
    try {
      const data = await KSafeAPI.getStatus();
      $('espStatus') && ($('espStatus').textContent = 'ONLINE');
      $('espDot')?.classList.remove('offline');
      $('sidebarEspDot')?.classList.remove('offline');
      $('sidebarEspStatus') && ($('sidebarEspStatus').textContent = 'Connected');
      $('espIp') && ($('espIp').textContent = KSafeAPI.config.baseUrl);
      $('wifiStatus') && ($('wifiStatus').textContent = 'Connected');
      $('driverState') && setState(data.state || 'S');
      toast('ESP32 connected successfully.');
    } catch {
      $('espStatus') && ($('espStatus').textContent = 'OFFLINE');
      $('espDot')?.classList.add('offline');
      $('sidebarEspDot')?.classList.add('offline');
      $('sidebarEspStatus') && ($('sidebarEspStatus').textContent = 'Demo mode');
      $('espIp') && ($('espIp').textContent = 'No response · Demo data');
      $('wifiStatus') && ($('wifiStatus').textContent = 'Not connected');
      toast('ESP32 is not reachable. Showing demo data.');
    }
  }
  function setState(state) {
    const states = {
      S: { label:'SAFE', title:'Driver is Safe', text:'No drowsiness or distraction indicators detected.', cls:'safe-banner', icon:'shield-check', color:'state-safe' },
      F: { label:'FOCUS', title:'Driver Needs Attention', text:'A potential distraction or attention warning was detected.', cls:'focus-banner', icon:'alert-triangle', color:'' },
      D: { label:'DANGER', title:'Drowsiness / Distraction Detected', text:'Critical driver safety condition. Immediate attention is required.', cls:'danger-banner', icon:'siren', color:'' }
    };
    const s = states[state] || states.S;
    if ($('driverState')) { $('driverState').textContent = s.label; $('driverState').className = `metric-value ${s.color}`; }
    if ($('safetyBanner')) { $('safetyBanner').className = `safety-banner ${s.cls}`; }
    if ($('safetyTitle')) $('safetyTitle').textContent = s.title;
    if ($('safetyText')) $('safetyText').textContent = s.text;
    if ($('safetyState')) $('safetyState').textContent = s.label;
    const symbol = document.querySelector('.safety-symbol');
    if (symbol) symbol.innerHTML = `<i data-lucide="${s.icon}"></i>`;
    if (window.lucide) lucide.createIcons();
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('refreshButton') && refresh();
  });
  return { refresh, setState, toast };
})();
window.KSafeDashboard = KSafeDashboard;
