import api from './axios';

export const packageApi = {
  getAll:  (params = {}) => api.get('/packages',      { params }).then((r) => r.data),
  getById: (id)           => api.get(`/packages/${id}`).then((r) => r.data),
  create:  (data)         => api.post('/packages',     data).then((r) => r.data),
  update:  (id, data)     => api.patch(`/packages/${id}`, data).then((r) => r.data),
  delete:  (id)           => api.delete(`/packages/${id}`).then((r) => r.data),
};
