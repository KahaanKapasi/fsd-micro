const TOKEN_KEY = 'chatspace_token';

// Empty in dev (Vite proxies to :4000). Set VITE_BACKEND_URL when the API is hosted on another origin.
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
export const assetUrl = (u) => (u?.startsWith('/') ? `${BACKEND_URL}${u}` : u);

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t) => {
  try {
    t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the HTTP-only cookie still authenticates */
  }
};

async function request(method, path, body) {
  const headers = { 'ngrok-skip-browser-warning': '1' }; // skips ngrok's free-tier interstitial page
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers, credentials: 'include' };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BACKEND_URL}/api/v1${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};
