import api from './axios';

export const dispatchOrderApi = {
  getAll:   (params)   => api.get('/dispatch/orders', { params }).then((r) => r.data),
  getById:  (id)       => api.get(`/dispatch/orders/${id}`).then((r) => r.data),
  create:   (data)     => api.post('/dispatch/orders', data).then((r) => r.data),
  update:   (id, data) => api.patch(`/dispatch/orders/${id}`, data).then((r) => r.data),
  delete:           (id)       => api.delete(`/dispatch/orders/${id}`).then((r) => r.data),
  getDocumentsData: (id)       => api.get(`/dispatch/orders/${id}/documents-data`).then((r) => r.data),
};
