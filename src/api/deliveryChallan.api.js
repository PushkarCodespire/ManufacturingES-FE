import api from './axios';

export const deliveryChallanApi = {
  getAll:  (params)   => api.get('/dispatch/challans', { params }).then((r) => r.data),
  create:  (data)     => api.post('/dispatch/challans', data).then((r) => r.data),
  update:  (id, data) => api.patch(`/dispatch/challans/${id}`, data).then((r) => r.data),
  delete:  (id)       => api.delete(`/dispatch/challans/${id}`).then((r) => r.data),
};
