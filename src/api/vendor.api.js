import api from './axios';

export const vendorApi = {
  getAll:  (params = {}) => api.get('/vendors', { params }).then((r) => r.data),
  getById: (id)          => api.get(`/vendors/${id}`).then((r) => r.data),
  create:  (data)        => api.post('/vendors', data).then((r) => r.data),
  update:  (id, data)    => api.patch(`/vendors/${id}`, data).then((r) => r.data),
  delete:  (id)          => api.delete(`/vendors/${id}`).then((r) => r.data),
};
