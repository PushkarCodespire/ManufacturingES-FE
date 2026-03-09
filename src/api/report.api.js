import api from './axios';

export const reportApi = {
  getAll:  (params = {}) => api.get('/reports',       { params }).then((r) => r.data),
  getById: (id)           => api.get(`/reports/${id}`).then((r) => r.data),
  create:  (data)         => api.post('/reports',      data).then((r) => r.data),
  update:  (id, data)     => api.patch(`/reports/${id}`, data).then((r) => r.data),
  delete:  (id)           => api.delete(`/reports/${id}`).then((r) => r.data),
};
