import api from './axios';

export const costingApi = {
  getAll:  (params = {}) => api.get('/vendor-costings', { params }).then((r) => r.data),
  create:  (data)        => api.post('/vendor-costings', data).then((r) => r.data),
  update:  (id, data)    => api.patch(`/vendor-costings/${id}`, data).then((r) => r.data),
  delete:  (id)          => api.delete(`/vendor-costings/${id}`).then((r) => r.data),
};
