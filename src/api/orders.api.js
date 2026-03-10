import api from './axios';

// ── Upload (documents / drawings) ─────────────────────────────────────────────
// POST /api/upload/document — accepts PDF, JPG, PNG up to 10MB
// Pass a FormData with field name "file".
export const uploadApi = {
  uploadDrawing: (formData) =>
    api.post('/upload/document', formData).then((r) => r.data),
};

// ── RFQ ──────────────────────────────────────────────────────────────────────
export const rfqApi = {
  getAll:  (params = {}) => api.get('/rfqs',        { params }).then((r) => r.data),
  getById: (id)          => api.get(`/rfqs/${id}`).then((r) => r.data),
  create:  (data)        => api.post('/rfqs',        data).then((r) => r.data),
  update:  (id, data)    => api.patch(`/rfqs/${id}`, data).then((r) => r.data),
  delete:  (id)          => api.delete(`/rfqs/${id}`).then((r) => r.data),
};

// ── Quotation ─────────────────────────────────────────────────────────────────
export const quotationApi = {
  getAll:  (params = {}) => api.get('/quotations',        { params }).then((r) => r.data),
  getById: (id)          => api.get(`/quotations/${id}`).then((r) => r.data),
  create:  (data)        => api.post('/quotations',        data).then((r) => r.data),
  update:  (id, data)    => api.patch(`/quotations/${id}`, data).then((r) => r.data),
  delete:  (id)          => api.delete(`/quotations/${id}`).then((r) => r.data),
};

// ── Customer Orders ───────────────────────────────────────────────────────────
export const customerOrderApi = {
  getAll:       (params = {}) => api.get('/customer-orders',          { params }).then((r) => r.data),
  getById:      (id)          => api.get(`/customer-orders/${id}`).then((r) => r.data),
  getTracking:  ()            => api.get('/customer-orders/tracking').then((r) => r.data),
  create:       (data)        => api.post('/customer-orders',          data).then((r) => r.data),
  update:       (id, data)    => api.patch(`/customer-orders/${id}`,   data).then((r) => r.data),
  delete:       (id)          => api.delete(`/customer-orders/${id}`).then((r) => r.data),
};
