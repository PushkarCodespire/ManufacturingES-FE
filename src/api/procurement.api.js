import api from './axios';

export const purchaseOrderApi = {
  getAll:   (params) => api.get('/purchase-orders', { params }),
  getById:  (id)     => api.get(`/purchase-orders/${id}`),
  create:   (data)   => api.post('/purchase-orders', data),
  update:   (id, d)  => api.patch(`/purchase-orders/${id}`, d),
  send:     (id)     => api.patch(`/purchase-orders/${id}/send`),
  receive:  (id, d)  => api.patch(`/purchase-orders/${id}/receive`, d),
  delete:   (id)     => api.delete(`/purchase-orders/${id}`),
};
