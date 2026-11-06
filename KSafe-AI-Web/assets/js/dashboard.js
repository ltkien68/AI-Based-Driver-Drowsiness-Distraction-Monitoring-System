const KSafeDashboard = (() => {
  const $ = id => document.getElementById(id);
  let toastTimer;
  let pollingTimer = null;
  let daBaoLoi = false;

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function capNhatKetNoi(online, data = null) {
    const badge = $('dataModeBadge');
    if (badge) badge.innerHTML = online ? '<i data-lucide="radio-tower"></i> ESP32 LIVE' : '<i data-lucide="flask-conical"></i> DEMO / OFFLINE';
    if (window.lucide) lucide.createIcons();
    if ($('espStatus')) $('espStatus').textContent = online ? 'ONLINE' : 'OFFLINE';
    $('espDot')?.classList.toggle('offline', !online);
    $('sidebarEspDot')?.classList.toggle('offline', !online);
    if ($('sidebarEspStatus')) $('sidebarEspStatus').textContent = online ? 'Connected' : 'Disconnected';
    if ($('espIp')) $('espIp').textContent = online ? KSafeAPI.config.baseUrl : 'No response';
    if ($('wifiStatus')) $('wifiStatus').textContent = online && data?.wifi ? 'Connected' : 'Not connected';
  }

  async function refresh(showMessage = true) {
    try {
      const data = await KSafeAPI.getStatus();
      if (!data || !['S', 'F', 'D'].includes(data.state)) {
        throw new Error('ESP32 returned invalid status data');
      }

      capNhatKetNoi(true, data);
      setState(data.state);
      if ($('driverDescription')) $('driverDescription').textContent = 'Live state · ESP32';

      if (data.resetRequested && $('driverDescription')) {
        $('driverDescription').textContent = 'Reset button pressed · Awaiting Python AI confirmation';
      }

      if (showMessage && daBaoLoi) toast('ESP32 connection restored.');
      daBaoLoi = false;
      return data;
    } catch (error) {
      capNhatKetNoi(false);
      if ($('driverDescription')) $('driverDescription').textContent = 'ESP32 unavailable · Displaying last known state';
      if (showMessage && !daBaoLoi) toast('Cannot connect to ESP32. Check Wi-Fi and IP address.');
      daBaoLoi = true;
      return null;
    }
  }

  function setState(state) {
    const states = {
      S: { label: 'SAFE', title: 'Driver is Safe', text: 'No drowsiness or distraction indicators detected.', cls: 'safe-banner', icon: 'shield-check', color: 'state-safe' },
      F: { label: 'FOCUS', title: 'Driver Needs Attention', text: 'A potential distraction or attention warning was detected.', cls: 'focus-banner', icon: 'alert-triangle', color: '' },
      D: { label: 'DANGER', title: 'Drowsiness / Distraction Detected', text: 'Critical driver safety condition. Immediate attention is required.', cls: 'danger-banner', icon: 'siren', color: '' }
    };
    const s = states[state] || states.S;
    if ($('driverState')) {
      $('driverState').textContent = s.label;
      $('driverState').className = `metric-value ${s.color}`;
    }
    if ($('safetyBanner')) $('safetyBanner').className = `safety-banner ${s.cls}`;
    if ($('safetyTitle')) $('safetyTitle').textContent = s.title;
    if ($('safetyText')) $('safetyText').textContent = s.text;
    if ($('safetyState')) $('safetyState').textContent = s.label;
    const symbol = document.querySelector('.safety-symbol');
    if (symbol) symbol.innerHTML = `<i data-lucide="${s.icon}"></i>`;
    if (window.lucide) lucide.createIcons();
  }

  function startPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
    refresh(false);
    pollingTimer = setInterval(() => refresh(false), 2500);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if ($('refreshButton')) startPolling();
  });

  return { refresh, setState, toast, startPolling };
})();
window.KSafeDashboard = KSafeDashboard;
