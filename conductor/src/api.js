import Constants from 'expo-constants';

function resolveApiBase() {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    const host = String(hostUri).split('/')[0];
    return `http://${host}`;
  }

  return 'http://127.0.0.1:43124';
}

const BASE = resolveApiBase();

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  baseUrl: BASE,
  conductorLogin: (body) =>
    request('/api/auth/conductor-login', { method: 'POST', body: JSON.stringify(body) }),
  conductorPresence: (employeeId, online = true) =>
    request('/api/auth/conductor-presence', {
      method: 'POST',
      body: JSON.stringify({ employeeId, online }),
    }),
  routes: {
    list: () => request('/api/routes'),
  },
  buses: {
    list: () => request('/api/buses'),
  },
  fares: {
    lookup: (routeId, from, to) =>
      request(
        `/api/fares/lookup?routeId=${encodeURIComponent(routeId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
  },
  trips: {
    start: (body) => request('/api/trips', { method: 'POST', body: JSON.stringify(body) }),
    get: (id) => request(`/api/trips/${encodeURIComponent(id)}`),
    current: (conductorId) =>
      request(`/api/trips/current?conductorId=${encodeURIComponent(conductorId)}`),
    end: (id) => request(`/api/trips/${id}/end`, { method: 'POST', body: JSON.stringify({}) }),
  },
  tickets: {
    create: (body) => request('/api/tickets', { method: 'POST', body: JSON.stringify(body) }),
  },
  issueReports: {
    create: (body) =>
      request('/api/issue-reports', { method: 'POST', body: JSON.stringify(body) }),
  },
};
