import api from './axios';

export const templateApi = {
  getAll:  (params = {}) => api.get('/templates', { params }).then((r) => r.data),
  getById: (id)          => api.get(`/templates/${id}`).then((r) => r.data),
  create:  (data)        => api.post('/templates', data).then((r) => r.data),
  update:  (id, data)    => api.patch(`/templates/${id}`, data).then((r) => r.data),
  delete:  (id)          => api.delete(`/templates/${id}`).then((r) => r.data),
};
