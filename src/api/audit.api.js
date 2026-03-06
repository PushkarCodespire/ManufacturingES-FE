import api from './axios';

export const auditApi = {
  /** My own audit trail — paginated */
  getMyLogs: (params = {}) =>
    api.get('/audit/my', { params }).then((r) => r.data),

  /** Quick summary stats (total logins, failed logins, last login) */
  getSummary: () =>
    api.get('/audit/summary').then((r) => r.data),

  /** All users' audit logs — IT Admin / Plant Head only */
  getAllLogs: (params = {}) =>
    api.get('/audit/all', { params }).then((r) => r.data),
};
