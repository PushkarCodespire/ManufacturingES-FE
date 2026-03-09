import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth.api';

const AuthContext = createContext(null);

const STORAGE_TOKEN   = 'dt_token';
const STORAGE_REFRESH = 'dt_refresh_token';
const STORAGE_USER    = 'dt_user';
const STORAGE_TIME    = 'dt_login_time';
const SESSION_MS      = 8 * 60 * 60 * 1000; // 8 hours — SYS-004

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Logout ──────────────────────────────────────────────────────────────
  const logout = useCallback(async (callApi = true) => {
    const refreshToken = localStorage.getItem(STORAGE_REFRESH);

    // Tell the backend to revoke the session (best-effort)
    if (callApi && refreshToken) {
      try {
        await authApi.logout({ refresh_token: refreshToken });
      } catch (_) { /* silent — we still clear locally */ }
    }

    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_REFRESH);
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_TIME);
    setUser(null);
  }, []);

  // ─── Bootstrap from localStorage ─────────────────────────────────────────
  useEffect(() => {
    const token     = localStorage.getItem(STORAGE_TOKEN);
    const stored    = localStorage.getItem(STORAGE_USER);
    const loginAt   = localStorage.getItem(STORAGE_TIME);

    if (token && stored && loginAt) {
      const elapsed    = Date.now() - parseInt(loginAt, 10);
      const parsedUser = JSON.parse(stored);

      if (elapsed >= SESSION_MS) {
        // Local 8-hour wall-clock expired — do a silent logout (no API call)
        logout(false);
      } else if (!Array.isArray(parsedUser.permissions)) {
        // Stale session — stored user pre-dates the permissions field; force re-login
        logout(false);
      } else {
        setUser(parsedUser);
        // Schedule auto-logout for remaining time
        const remaining = SESSION_MS - elapsed;
        const timer = setTimeout(() => logout(true), remaining);
        setLoading(false);
        return () => clearTimeout(timer);
      }
    }
    setLoading(false);
  }, [logout]);

  // ─── Login ───────────────────────────────────────────────────────────────
  const login = async (employee_id, password) => {
    const res = await authApi.login({ employee_id, password });
    const { token, refresh_token, user: userData } = res.data;

    localStorage.setItem(STORAGE_TOKEN,   token);
    localStorage.setItem(STORAGE_REFRESH, refresh_token);
    localStorage.setItem(STORAGE_USER,    JSON.stringify(userData));
    localStorage.setItem(STORAGE_TIME,    Date.now().toString());

    setUser(userData);

    // Schedule auto-logout at 8h wall-clock limit
    setTimeout(() => logout(true), SESSION_MS);

    return { is_first_login: userData.is_first_login };
  };

  // ─── Update local user state (e.g. after password change) ────────────────
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
