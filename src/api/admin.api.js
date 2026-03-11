import api from './axios';

const BASE = '/admin/control-room';

// ── Module Toggles ──────────────────────────────────────────────────────────
export const moduleToggleApi = {
  getAll:  () =>          api.get(`${BASE}/modules`).then((r) => r.data),
  toggle:  (id, data) =>  api.patch(`${BASE}/modules/${id}`, data).then((r) => r.data),
};

// ── Feature Toggles ─────────────────────────────────────────────────────────
export const featureToggleApi = {
  getAll:  () =>          api.get(`${BASE}/features`).then((r) => r.data),
  toggle:  (id, data) =>  api.patch(`${BASE}/features/${id}`, data).then((r) => r.data),
};

// ── Role Permission Grid ────────────────────────────────────────────────────
export const rolePermissionApi = {
  getRoles:  () =>              api.get(`${BASE}/roles`).then((r) => r.data),
  getGrid:   (roleId) =>        api.get(`${BASE}/role-permissions/${roleId}`).then((r) => r.data),
  update:    (roleId, data) =>  api.put(`${BASE}/role-permissions/${roleId}`, data).then((r) => r.data),
};

// ── User Overrides ──────────────────────────────────────────────────────────
export const userOverrideApi = {
  search:  (params = {}) => api.get(`${BASE}/user-overrides`, { params }).then((r) => r.data),
  getById: (userId) =>      api.get(`${BASE}/user-overrides/${userId}`).then((r) => r.data),
  update:  (userId, data) => api.put(`${BASE}/user-overrides/${userId}`, data).then((r) => r.data),
};

// ── AI Agent Toggles ────────────────────────────────────────────────────────
export const aiAgentToggleApi = {
  getAll:  () =>          api.get(`${BASE}/ai-agents`).then((r) => r.data),
  toggle:  (id, data) =>  api.patch(`${BASE}/ai-agents/${id}`, data).then((r) => r.data),
};

// ── Field Visibility ────────────────────────────────────────────────────────
export const fieldVisibilityApi = {
  getFeatures: () =>                api.get(`${BASE}/field-visibility/features`).then((r) => r.data),
  getGrid:     (featureId) =>       api.get(`${BASE}/field-visibility/${featureId}`).then((r) => r.data),
  update:      (featureId, data) => api.put(`${BASE}/field-visibility/${featureId}`, data).then((r) => r.data),
};

// ── Audit Log ───────────────────────────────────────────────────────────────
export const auditLogApi = {
  getAll: (params = {}) => api.get(`${BASE}/audit-log`, { params }).then((r) => r.data),
};
