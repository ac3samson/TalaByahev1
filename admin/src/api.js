const BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) return null;

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
  health: () => request('/health'),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  verifyPassword: (password) =>
    request('/auth/verify-password', { method: 'POST', body: JSON.stringify({ password }) }),
  dashboard: () => request('/dashboard'),
  employees: {
    list: () => request('/employees'),
    create: (body) => request('/employees', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id, password) =>
      request(`/employees/${id}`, { method: 'DELETE', body: JSON.stringify({ password }) }),
  },
  routes: {
    list: () => request('/routes'),
    create: (body) => request('/routes', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/routes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id, password) =>
      request(`/routes/${id}`, { method: 'DELETE', body: JSON.stringify({ password }) }),
  },
  fares: {
    list: () => request('/fares'),
    create: (body) => request('/fares', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/fares/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id, password) =>
      request(`/fares/${id}`, { method: 'DELETE', body: JSON.stringify({ password }) }),
  },
  buses: {
    list: () => request('/buses'),
    update: (id, body) => request(`/buses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id, password) =>
      request(`/buses/${id}`, { method: 'DELETE', body: JSON.stringify({ password }) }),
  },
  trips: {
    list: (date) =>
      request(date ? `/trips?date=${encodeURIComponent(date)}` : '/trips'),
    pending: () => request('/trips/pending'),
    approve: (id) => request(`/trips/${encodeURIComponent(id)}/approve`, { method: 'POST', body: '{}' }),
    reject: (id) => request(`/trips/${encodeURIComponent(id)}/reject`, { method: 'POST', body: '{}' }),
  },
  tickets: {
    list: (date) =>
      request(date ? `/tickets?date=${encodeURIComponent(date)}` : '/tickets'),
  },
  reports: {
    summary: (date, type = 'daily') =>
      request(
        `/reports/summary?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`,
      ),
  },
  issueReports: {
    list: (date) =>
      request(date ? `/issue-reports?date=${encodeURIComponent(date)}` : '/issue-reports'),
  },
};
