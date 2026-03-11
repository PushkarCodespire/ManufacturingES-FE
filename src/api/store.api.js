import api from './axios';

// ── GRN ───────────────────────────────────────────────────────────────────────
export const grnApi = {
  getAll:   (params = {}) => api.get('/grns',              { params }).then((r) => r.data),
  getById:  (id)          => api.get(`/grns/${id}`).then((r) => r.data),
  create:   (data)        => api.post('/grns',              data).then((r) => r.data),
  update:   (id, data)    => api.patch(`/grns/${id}`,       data).then((r) => r.data),
  approve:  (id)          => api.patch(`/grns/${id}/approve`, {}).then((r) => r.data),
  delete:   (id)          => api.delete(`/grns/${id}`).then((r) => r.data),
};

// ── Inventory ─────────────────────────────────────────────────────────────────
export const inventoryApi = {
  getStock:     (params = {}) => api.get('/inventory/stock',     { params }).then((r) => r.data),
  getLedger:    (params = {}) => api.get('/inventory/ledger',    { params }).then((r) => r.data),
  getDashboard: ()            => api.get('/inventory/dashboard').then((r) => r.data),
  getStockAge:  (params = {}) => api.get('/inventory/stock-age', { params }).then((r) => r.data),
  getDeadStock: (params = {}) => api.get('/inventory/dead-stock',{ params }).then((r) => r.data),
};

// ── Material Request ──────────────────────────────────────────────────────────
export const materialRequestApi = {
  getAll:   (params = {}) => api.get('/material-requests',                { params }).then((r) => r.data),
  getById:  (id)          => api.get(`/material-requests/${id}`).then((r) => r.data),
  create:   (data)        => api.post('/material-requests',                data).then((r) => r.data),
  update:   (id, data)    => api.patch(`/material-requests/${id}`,         data).then((r) => r.data),
  approve:  (id)          => api.patch(`/material-requests/${id}/approve`, {}).then((r) => r.data),
  delete:   (id)          => api.delete(`/material-requests/${id}`).then((r) => r.data),
};

// ── Issue Slip ────────────────────────────────────────────────────────────────
export const issueSlipApi = {
  getAll:   (params = {}) => api.get('/issue-slips',           { params }).then((r) => r.data),
  getById:  (id)          => api.get(`/issue-slips/${id}`).then((r) => r.data),
  create:   (data)        => api.post('/issue-slips',           data).then((r) => r.data),
  delete:   (id)          => api.delete(`/issue-slips/${id}`).then((r) => r.data),
};

// ── Stock Adjustment ──────────────────────────────────────────────────────────
export const stockAdjustmentApi = {
  getAll:   (params = {}) => api.get('/stock-adjustments',                { params }).then((r) => r.data),
  getById:  (id)          => api.get(`/stock-adjustments/${id}`).then((r) => r.data),
  create:   (data)        => api.post('/stock-adjustments',                data).then((r) => r.data),
  update:   (id, data)    => api.patch(`/stock-adjustments/${id}`,         data).then((r) => r.data),
  approve:  (id)          => api.patch(`/stock-adjustments/${id}/approve`, {}).then((r) => r.data),
  delete:   (id)          => api.delete(`/stock-adjustments/${id}`).then((r) => r.data),
};
