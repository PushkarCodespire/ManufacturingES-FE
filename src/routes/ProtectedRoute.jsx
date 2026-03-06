import React from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../context/AuthContext';

// NOTE: The login response maps associations to lowercase keys:
//   user.role       → { id, name, label }   (from user.Role in DB)
//   user.department → { id, code, name }     (from user.Department in DB)
//   user.permissions → string[]             (flat permission keys)
const ADMIN_ROLES = ['plant_head', 'it_admin'];

/**
 * ProtectedRoute
 *
 * Props:
 *   roles      {string[]}  – STRICT role whitelist (user.role.name must be in list)
 *   permission {string}    – permission key: allows access if user is admin OR has this key
 *
 * Access rules:
 *   - No props             → any authenticated user
 *   - roles only           → only those exact roles (strict)
 *   - permission only      → admins always pass; others need the key in user.permissions
 *   - both                 → roles OR permission (either is sufficient)
 */
const ProtectedRoute = ({ children, roles, permission }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f4f6f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // SYS-002: Redirect to change-password if first login
  if (user.is_first_login && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // ── Access check ──────────────────────────────────────────────────────────
  // Login response sends associations as lowercase: user.role (not user.Role)
  const roleName = user.role?.name;
  const isAdmin  = ADMIN_ROLES.includes(roleName);
  const perms    = user.permissions ?? [];

  if (roles || permission) {
    const roleOk = roles      ? roles.includes(roleName)               : false;
    const permOk = permission ? (isAdmin || perms.includes(permission)) : false;

    if (!roleOk && !permOk) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
