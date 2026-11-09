// Lop giao tiep HTTP voi ESP32
const KSafeAPI = (() => {
  const config = {
    baseUrl: (localStorage.getItem('ksafe_esp32_url') || 'http://192.168.1.50').replace(/\/$/, '')
  };

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const headers = { ...(options.headers || {}) };
      if (options.body) headers['Content-Type'] = 'application/json';

      const response = await fetch(`${config.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    config,

    setBaseUrl(url) {
      config.baseUrl = url.trim().replace(/\/$/, '');
      localStorage.setItem('ksafe_esp32_url', config.baseUrl);
    },

    async getStatus() {
      return request('/api/status');
    },

    async setState(state) {
      if (!['S', 'F', 'D'].includes(state)) throw new Error('Invalid state');
      return request('/api/state', {
        method: 'POST',
        body: JSON.stringify({ state })
      });
    },

    async acknowledgeReset() {
      return request('/api/reset/ack', { method: 'POST', body: '{}' });
    }
  };
})();
