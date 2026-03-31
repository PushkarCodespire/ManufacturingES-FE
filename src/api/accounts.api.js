import api from './axios';

export const salesInvoiceApi = {
  getAll:   (params = {}) => api.get('/sales-invoices', { params }).then((r) => r.data),
  getById:  (id)          => api.get(`/sales-invoices/${id}`).then((r) => r.data),
  create:   (data)        => api.post('/sales-invoices', data).then((r) => r.data),
  update:   (id, data)    => api.patch(`/sales-invoices/${id}`, data).then((r) => r.data),
  approve:  (id)          => api.patch(`/sales-invoices/${id}/approve`, {}).then((r) => r.data),
  delete:   (id)          => api.delete(`/sales-invoices/${id}`).then((r) => r.data),
};

export const debitCreditNoteApi = {
  getAll:   (params = {}) => api.get('/debit-credit-notes', { params }).then((r) => r.data),
  getById:  (id)          => api.get(`/debit-credit-notes/${id}`).then((r) => r.data),
  create:   (data)        => api.post('/debit-credit-notes', data).then((r) => r.data),
  update:   (id, data)    => api.patch(`/debit-credit-notes/${id}`, data).then((r) => r.data),
  approve:  (id)          => api.patch(`/debit-credit-notes/${id}/approve`, {}).then((r) => r.data),
  delete:   (id)          => api.delete(`/debit-credit-notes/${id}`).then((r) => r.data),
};

export const paymentApi = {
  getAll:   (params = {}) => api.get('/payments', { params }).then((r) => r.data),
  getById:  (id)          => api.get(`/payments/${id}`).then((r) => r.data),
  create:   (data)        => api.post('/payments', data).then((r) => r.data),
  update:   (id, data)    => api.patch(`/payments/${id}`, data).then((r) => r.data),
  delete:   (id)          => api.delete(`/payments/${id}`).then((r) => r.data),
};

export const copqEntryApi = {
  getAll:     (params = {}) => api.get('/copq-entries', { params }).then((r) => r.data),
  getById:    (id)          => api.get(`/copq-entries/${id}`).then((r) => r.data),
  create:     (data)        => api.post('/copq-entries', data).then((r) => r.data),
  update:     (id, data)    => api.patch(`/copq-entries/${id}`, data).then((r) => r.data),
  delete:     (id)          => api.delete(`/copq-entries/${id}`).then((r) => r.data),
  getSummary: (params = {}) => api.get('/copq-entries/summary', { params }).then((r) => r.data),
};

export const tallySyncApi = {
  getDashboard:   ()              => api.get('/tally-sync/dashboard').then((r) => r.data),
  getLogs:        (params = {})   => api.get('/tally-sync/logs', { params }).then((r) => r.data),
  triggerSync:    (sync_type)     => api.post('/tally-sync/trigger', { sync_type }).then((r) => r.data),
  testConnection: ()             => api.post('/tally-sync/test-connection').then((r) => r.data),
  previewXml:    (sync_type)     => api.post('/tally-sync/preview', { sync_type }).then((r) => r.data),
  retryFailed:   (sync_type)     => api.post('/tally-sync/retry', { sync_type }).then((r) => r.data),
  getFailedRecords: ()           => api.get('/tally-sync/failed').then((r) => r.data),
};
