import api from './axios';

export const ctqIssueApi = {
  /** List all CTQ issues (optionally filtered by department, severity, search) */
  getAll:   (params = {}) => api.get('/ctq-issues',        { params }).then((r) => r.data),
  /** Single CTQ issue by ID */
  getById:  (id)          => api.get(`/ctq-issues/${id}`).then((r) => r.data),
  /** Create a new CTQ issue */
  create:   (data)        => api.post('/ctq-issues', data).then((r) => r.data),
  /** Update CTQ issue fields */
  update:   (id, data)    => api.patch(`/ctq-issues/${id}`, data).then((r) => r.data),
  /** Delete CTQ issue */
  delete:   (id)          => api.delete(`/ctq-issues/${id}`).then((r) => r.data),
};
