import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// H-06: withCredentials sends the httpOnly refresh-token cookie on every request,
// which is required for the /auth/refresh and /auth/logout endpoints to work.
const api = axios.create({ baseURL: BASE_URL, timeout: 15000, withCredentials: true });

// ─── Request: attach access token ────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── SYS-004: Response — auto-refresh on 401 ─────────────────────────────────
let isRefreshing = false;
let refreshQueue = []; // queued requests waiting for the new access token

const processQueue = (error, token = null) => {
  refreshQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  refreshQueue = [];
};

api.interceptors.response.use(
  // Unwrap response body (all successful responses return { success, data, message })
  (res) => res.data,

  async (err) => {
    const original = err.config;

    const is401       = err.response?.status === 401;
    const isRetry     = original._retry;
    const isAuthRoute = original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh');

    if (is401 && !isRetry && !isAuthRoute) {
      original._retry = true;

      // If another refresh is in progress, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        });
      }

      isRefreshing = true;

      try {
        // H-06: The refresh token is in an httpOnly cookie — no localStorage read.
        // withCredentials ensures the cookie is included in this cross-origin request.
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newToken = data.data.token;
        // H-06: new refresh token arrives as an httpOnly cookie — not in the body.

        localStorage.setItem('dt_token', newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // Unrecoverable 401 (retry already failed) — hard logout
    if (is401) {
      localStorage.clear();
      window.location.href = '/login';
    }

    return Promise.reject(err.response?.data || { message: 'Network error. Please try again.' });
  }
);

export default api;
