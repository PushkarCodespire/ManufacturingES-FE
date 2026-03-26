import api from './axios';

export const purchaseOrderApi = {
  getAll:             (params) => api.get('/purchase-orders', { params }),
  getById:            (id)     => api.get(`/purchase-orders/${id}`),
  create:             (data)   => api.post('/purchase-orders', data),
  update:             (id, d)  => api.patch(`/purchase-orders/${id}`, d),
  submitForApproval:  (id)     => api.patch(`/purchase-orders/${id}/submit-approval`),
  approve:            (id, d)  => api.patch(`/purchase-orders/${id}/approve`, d || {}),
  reject:             (id, d)  => api.patch(`/purchase-orders/${id}/reject`, d),
  send:               (id)     => api.patch(`/purchase-orders/${id}/send`),
  receive:            (id, d)  => api.patch(`/purchase-orders/${id}/receive`, d),
  cancel:             (id, d)  => api.patch(`/purchase-orders/${id}/cancel`, d),
  delete:             (id)     => api.delete(`/purchase-orders/${id}`),
};
export const prApi = {
  getAll:      (params) => api.get('/purchase-requisitions', { params }),
  getById:     (id)     => api.get(`/purchase-requisitions/${id}`),
  create:      (data)   => api.post('/purchase-requisitions', data),
  update:      (id, d)  => api.patch(`/purchase-requisitions/${id}`, d),
  submit:      (id)     => api.patch(`/purchase-requisitions/${id}/submit`),
  approve:     (id)     => api.patch(`/purchase-requisitions/${id}/approve`),
  reject:      (id, d)  => api.patch(`/purchase-requisitions/${id}/reject`, d),
  convertToPo: (id, d)  => api.post(`/purchase-requisitions/${id}/convert-to-po`, d),
  delete:      (id)     => api.delete(`/purchase-requisitions/${id}`),
};

export const vendorRfqApi = {
  getAll:     (params) => api.get('/vendor-rfqs', { params }),
  getById:    (id)     => api.get(`/vendor-rfqs/${id}`),
  create:     (data)   => api.post('/vendor-rfqs', data),
  update:     (id, d)  => api.patch(`/vendor-rfqs/${id}`, d),
  send:       (id)     => api.patch(`/vendor-rfqs/${id}/send`),
  close:      (id)     => api.patch(`/vendor-rfqs/${id}/close`),
  saveQuotes: (id, d)  => api.post(`/vendor-rfqs/${id}/quotes`, d),
  award:      (id, d)  => api.post(`/vendor-rfqs/${id}/award`, d),
  delete:     (id)     => api.delete(`/vendor-rfqs/${id}`),
};

export const vendorInvoiceApi = {
  getAll:    (params) => api.get('/vendor-invoices', { params }),
  getById:   (id)     => api.get(`/vendor-invoices/${id}`),
  create:    (data)   => api.post('/vendor-invoices', data),
  rematch:   (id)     => api.post(`/vendor-invoices/${id}/rematch`),
  approve:   (id)     => api.patch(`/vendor-invoices/${id}/approve`),
  dispute:   (id, d)  => api.patch(`/vendor-invoices/${id}/dispute`, d),
  markPaid:  (id)     => api.patch(`/vendor-invoices/${id}/mark-paid`),
  cancel:    (id)     => api.patch(`/vendor-invoices/${id}/cancel`),
};

export const budgetApi = {
  getAll:     (params) => api.get('/procurement-budgets', { params }),
  getById:    (id)     => api.get(`/procurement-budgets/${id}`),
  getSummary: ()       => api.get('/procurement-budgets/summary'),
  create:     (data)   => api.post('/procurement-budgets', data),
  update:     (id, d)  => api.patch(`/procurement-budgets/${id}`, d),
  close:      (id)     => api.patch(`/procurement-budgets/${id}/close`),
  delete:     (id)     => api.delete(`/procurement-budgets/${id}`),
};

export const procurementAnalyticsApi = {
  getSummary:           (params) => api.get('/procurement-analytics/summary',         { params }),
  getPoStatus:          (params) => api.get('/procurement-analytics/po-status',        { params }),
  getSpendByVendor:     (params) => api.get('/procurement-analytics/spend-by-vendor',  { params }),
  getMonthlySpend:      (params) => api.get('/procurement-analytics/monthly-spend',    { params }),
  getFunnel:            (params) => api.get('/procurement-analytics/funnel',           { params }),
  getTopItems:          (params) => api.get('/procurement-analytics/top-items',        { params }),
  getOverduePOs:        ()       => api.get('/procurement-analytics/overdue-pos'),
  getApprovalAgeing:    ()       => api.get('/procurement-analytics/approval-ageing'),
};

export const purchaseReturnApi = {
  getAll:      (params) => api.get('/purchase-returns', { params }),
  getById:     (id)     => api.get(`/purchase-returns/${id}`),
  getPoGrnItems:(poId)  => api.get(`/purchase-returns/po/${poId}/grn-items`),
  create:      (data)   => api.post('/purchase-returns', data),
  update:      (id, d)  => api.patch(`/purchase-returns/${id}`, d),
  send:        (id)     => api.patch(`/purchase-returns/${id}/send`),
  acknowledge: (id)     => api.patch(`/purchase-returns/${id}/acknowledge`),
  close:       (id)     => api.patch(`/purchase-returns/${id}/close`),
  delete:      (id)     => api.delete(`/purchase-returns/${id}`),
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
  trend:      (id)     => api.get('/vendors/' + id + '/scorecard/trend'),
  avl:        ()       => api.get('/vendors/scorecard/avl'),
};
