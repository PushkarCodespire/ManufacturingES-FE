import api from './axios';

export const downtimeReasonApi = {
  /** List all downtime reasons (optionally filtered by category, search, is_active) */
  getAll:   (params = {}) => api.get('/downtime-reasons',        { params }).then((r) => r.data),
  /** Single downtime reason by ID */
  getById:  (id)          => api.get(`/downtime-reasons/${id}`).then((r) => r.data),
  /** Create a new downtime reason */
  create:   (data)        => api.post('/downtime-reasons', data).then((r) => r.data),
  /** Update downtime reason fields */
  update:   (id, data)    => api.patch(`/downtime-reasons/${id}`, data).then((r) => r.data),
  /** Delete downtime reason */
  delete:   (id)          => api.delete(`/downtime-reasons/${id}`).then((r) => r.data),
};
