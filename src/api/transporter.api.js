import api from './axios';

export const transporterApi = {
  getAll:  (params) => api.get('/dispatch/transporters', { params }).then((r) => r.data),
  create:  (data)   => api.post('/dispatch/transporters', data).then((r) => r.data),
  update:  (id, data) => api.patch(`/dispatch/transporters/${id}`, data).then((r) => r.data),
  delete:  (id)     => api.delete(`/dispatch/transporters/${id}`).then((r) => r.data),
};
