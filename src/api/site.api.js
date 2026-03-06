import api from './axios';

export const siteApi = {
  /** List all sites (optionally filtered) */
  getAll:        (params = {}) => api.get('/sites',        { params }).then((r) => r.data),
  /** Single site by ID */
  getById:       (id)          => api.get(`/sites/${id}`).then((r) => r.data),
  /** Create a new site — returns full response { success, data, message } */
  create:        (data)        => api.post('/sites', data),
  /** Update site fields */
  update:        (id, data)    => api.patch(`/sites/${id}`, data),
  /** Toggle active / inactive */
  toggleStatus:  (id)          => api.patch(`/sites/${id}/toggle`).then((r) => r.data),
};
