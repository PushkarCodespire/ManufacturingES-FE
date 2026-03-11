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
export const scarApi = {
  getAll:     (params) => api.get('/scars', { params }),
  getById:    (id)     => api.get('/scars/' + id),
  create:     (data)   => api.post('/scars', data),
  update:     (id, d)  => api.patch('/scars/' + id, d),
  respond:    (id, d)  => api.patch('/scars/' + id + '/respond', d),
  close:      (id)     => api.patch('/scars/' + id + '/close'),
  getOverdue: ()       => api.get('/scars/overdue'),
  delete:     (id)     => api.delete('/scars/' + id),
};

export const vendorApi = {
  getAll:     (params) => api.get('/vendors', { params }),
  getById:    (id)     => api.get('/vendors/' + id),
  create:     (data)   => api.post('/vendors', data),
  update:     (id, d)  => api.patch('/vendors/' + id, d),
  delete:     (id)     => api.delete('/vendors/' + id),
  scorecard:  (id)     => api.get('/vendors/' + id + '/scorecard'),
};
