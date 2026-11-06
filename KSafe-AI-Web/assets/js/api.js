// API layer: demo-first. ESP32 integration can be enabled in Settings.
const KSafeAPI = (() => {
  const config = { baseUrl: localStorage.getItem('ksafe_esp32_url') || 'http://192.168.1.50', mode: 'demo' };
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        ...options, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  return {
    config,
    setBaseUrl(url) { config.baseUrl = url.replace(/\/$/, ''); localStorage.setItem('ksafe_esp32_url', config.baseUrl); },
    async getStatus() { return request('/api/status'); },
    async setState(state) { return request('/api/state', { method: 'POST', body: JSON.stringify({ state }) }); }
  };
})();
