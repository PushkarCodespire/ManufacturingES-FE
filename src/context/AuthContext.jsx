import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { authApi }              from '../api/auth.api';
import { setToken, clearToken } from '../api/tokenStore';

const AuthContext = createContext(null);

const BASE_URL   = import.meta.env.VITE_API_URL || '/api';

// dt_token is NO LONGER stored in localStorage (security audit finding #2 fix).
// Only non-sensitive session metadata is persisted across page refreshes.
const STORAGE_USER = 'dt_user';
const STORAGE_TIME = 'dt_login_time';
const SESSION_MS   = 8 * 60 * 60 * 1000; // 8 hours — SYS-004

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async (callApi = true) => {
    // H-06: The refresh token lives in an httpOnly cookie — the backend revokes
    // the session by reading the cookie directly and then clearing it.
    if (callApi) {
      try { await authApi.logout(); } catch (_) { /* silent — still clear locally */ }
    }

    // Clear in-memory access token
    clearToken();

    // Clear persisted session metadata (NOT dt_token — it no longer exists there)
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_TIME);

    setUser(null);
  }, []);

  // ─── Bootstrap on page refresh ────────────────────────────────────────────────
  // Since the access token is no longer in localStorage, we use the httpOnly
  // refresh cookie (sent automatically) to silently obtain a new access token.
  useEffect(() => {
    let timer;

    const bootstrap = async () => {
      const stored  = localStorage.getItem(STORAGE_USER);
      const loginAt = localStorage.getItem(STORAGE_TIME);

      // No session metadata → not logged in
      if (!stored || !loginAt) {
        setLoading(false);
        return;
      }

      // Parse stored user safely
      let parsedUser;
      try { parsedUser = JSON.parse(stored); } catch { parsedUser = null; }

      const elapsed = Date.now() - parseInt(loginAt, 10);

      // Wall-clock 8h expired, stale session, or missing permissions array → force re-login
      if (!parsedUser || elapsed >= SESSION_MS || !Array.isArray(parsedUser.permissions)) {
        logout(false);
        setLoading(false);
        return;
      }

      try {
        // Silent refresh — httpOnly cookie is sent automatically by the browser.
        // Using raw axios (not the api instance) to avoid the response interceptor loop.
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newToken = data?.data?.token;
        if (!newToken) throw new Error('No token in refresh response');

        // Store new token in memory only — never in localStorage
        setToken(newToken);
        setUser(parsedUser);

        // Schedule auto-logout for remaining session time
        const remaining = SESSION_MS - elapsed;
        timer = setTimeout(() => logout(true), remaining);
      } catch {
        // Refresh cookie expired or revoked — force re-login
        logout(false);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
    return () => clearTimeout(timer);
  }, [logout]);

  // ─── Login ────────────────────────────────────────────────────────────────────
  const login = async (employee_id, password) => {
    const res = await authApi.login({ employee_id, password });
    // H-06: refresh_token is delivered via httpOnly cookie — not in the response body
    const { token, user: userData } = res.data;

    // Security fix #2: access token stored in memory only — NOT in localStorage.
    // This prevents any XSS script from stealing it via localStorage.getItem().
    setToken(token);

    // Only non-sensitive metadata is persisted (user profile + login timestamp)
    localStorage.setItem(STORAGE_USER, JSON.stringify(userData));
    localStorage.setItem(STORAGE_TIME, Date.now().toString());

    setUser(userData);

    // Schedule auto-logout at 8h wall-clock limit
    setTimeout(() => logout(true), SESSION_MS);

    return { is_first_login: userData.is_first_login };
  };

  // ─── Update local user state (e.g. after password change) ────────────────────
  // Only updates user profile data — never touches the access token.
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem(STORAGE_USER, JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
