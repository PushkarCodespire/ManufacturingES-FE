import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth.api';

const AuthContext = createContext(null);

const STORAGE_TOKEN = 'dt_token';
// H-06: refresh token is now stored in an httpOnly cookie by the server.
// It is never written to or read from localStorage — removing it from JS scope
// prevents exfiltration via XSS.
const STORAGE_USER  = 'dt_user';
const STORAGE_TIME  = 'dt_login_time';
const SESSION_MS      = 8 * 60 * 60 * 1000; // 8 hours — SYS-004

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Logout ──────────────────────────────────────────────────────────────
  const logout = useCallback(async (callApi = true) => {
    // H-06: The refresh token lives in an httpOnly cookie — we don't read it
    // from localStorage. The backend revokes the session by reading the cookie
    // directly (sent automatically by the browser) and then clears it.
    if (callApi) {
      try {
        await authApi.logout();
      } catch (_) { /* silent — we still clear locally */ }
    }

    localStorage.removeItem(STORAGE_TOKEN);
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
    // H-06: refresh_token is delivered via httpOnly cookie — not in the response body
    const { token, user: userData } = res.data;

    // H-06: Only the access token is stored in localStorage.
    // The refresh token is in an httpOnly cookie set by the server.
    localStorage.setItem(STORAGE_TOKEN, token);
    localStorage.setItem(STORAGE_USER,  JSON.stringify(userData));
    localStorage.setItem(STORAGE_TIME,  Date.now().toString());

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
