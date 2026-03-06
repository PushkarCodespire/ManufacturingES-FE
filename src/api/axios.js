import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

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
        const storedRefresh = localStorage.getItem('dt_refresh_token');
        if (!storedRefresh) throw new Error('No refresh token stored');

        // Use raw axios (not `api`) to bypass the interceptors on this call
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: storedRefresh,
        });

        const newToken        = data.data.token;
        const newRefreshToken = data.data.refresh_token;

        localStorage.setItem('dt_token',         newToken);
        localStorage.setItem('dt_refresh_token', newRefreshToken);
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
