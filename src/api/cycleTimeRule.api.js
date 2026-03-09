import api from './axios';

export const cycleTimeRuleApi = {
  /** List all cycle-time rules */
  getAll:    () => api.get('/cycle-time-rules').then((r) => r.data),
  /** Get single rule by ID */
  getById:   (id) => api.get(`/cycle-time-rules/${id}`).then((r) => r.data),
  /** Create a single rule */
  create:    (data) => api.post('/cycle-time-rules', data).then((r) => r.data),
  /** Update a rule */
  update:    (id, data) => api.patch(`/cycle-time-rules/${id}`, data).then((r) => r.data),
  /** Delete a single rule */
  delete:    (id) => api.delete(`/cycle-time-rules/${id}`).then((r) => r.data),
  /** Set daily target for a rule */
  setDailyTarget: (id, data) => api.post(`/cycle-time-rules/${id}/daily-target`, data).then((r) => r.data),
  /** Bulk save (full replace) all rules */
  bulkSave:  (rules) => api.post('/cycle-time-rules/bulk', { rules }).then((r) => r.data),
};
