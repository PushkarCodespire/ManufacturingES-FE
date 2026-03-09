import api from './axios';

export const customFieldApi = {
  getAll:  (params = {}) => api.get('/custom-field-groups', { params }).then((r) => r.data),
  getById: (id)          => api.get(`/custom-field-groups/${id}`).then((r) => r.data),
  create:  (data)        => api.post('/custom-field-groups', data).then((r) => r.data),
  update:  (id, data)    => api.patch(`/custom-field-groups/${id}`, data).then((r) => r.data),
  delete:  (id)          => api.delete(`/custom-field-groups/${id}`).then((r) => r.data),
};
