import api from './axios';

export const productionFormApi = {
  getAll:  (params = {}) => api.get('/production-forms', { params }).then((r) => r.data),
  getById: (id)           => api.get(`/production-forms/${id}`).then((r) => r.data),
  create:  (data)         => api.post('/production-forms', data).then((r) => r.data),
  update:  (id, data)     => api.patch(`/production-forms/${id}`, data).then((r) => r.data),
  delete:  (id)           => api.delete(`/production-forms/${id}`).then((r) => r.data),
};
