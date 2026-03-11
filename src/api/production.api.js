import api from './axios';

export const workOrderApi = {
  getAll:       (params) => api.get('/work-orders', { params }),
  getById:      (id)     => api.get(`/work-orders/${id}`),
  create:       (data)   => api.post('/work-orders', data),
  update:       (id, d)  => api.patch(`/work-orders/${id}`, d),
  updateStatus: (id, status) => api.patch(`/work-orders/${id}/status`, { status }),
  delete:       (id)     => api.delete(`/work-orders/${id}`),
};

export const jobCardApi = {
  getAll:  (params) => api.get('/job-cards', { params }),
  getById: (id)     => api.get(`/job-cards/${id}`),
  create:  (data)   => api.post('/job-cards', data),
  update:  (id, d)  => api.patch(`/job-cards/${id}`, d),
  close:   (id, d)  => api.patch(`/job-cards/${id}/close`, d),
  delete:  (id)     => api.delete(`/job-cards/${id}`),
};

export const iqcApi = {
  getAll:         (params) => api.get('/iqc-inspections', { params }),
  getById:        (id)     => api.get(`/iqc-inspections/${id}`),
  create:         (data)   => api.post('/iqc-inspections', data),
  updateResults:  (id, results) => api.put(`/iqc-inspections/${id}/results`, { results }),
  updateResult:   (id, result)  => api.patch(`/iqc-inspections/${id}/result`, { result }),
  setDisposition: (id, data)    => api.patch(`/iqc-inspections/${id}/disposition`, data),
  cascadeCapa:    (id)     => api.post(`/iqc-inspections/${id}/cascade-capa`),
  delete:         (id)     => api.delete(`/iqc-inspections/${id}`),
};

export const lqcApi = {
  getAll:           (params) => api.get('/lqc-inspections', { params }),
  getById:          (id)     => api.get(`/lqc-inspections/${id}`),
  create:           (data)   => api.post('/lqc-inspections', data),
  updateResult:     (id, result) => api.patch(`/lqc-inspections/${id}/result`, { result }),
  delete:           (id)     => api.delete(`/lqc-inspections/${id}`),
  getToolWearTrend: (params) => api.get('/lqc-inspections/tool-wear', { params }),
};

export const pqcApi = {
  getAll:       (params) => api.get('/pqc-inspections', { params }),
  getById:      (id)     => api.get(`/pqc-inspections/${id}`),
  create:       (data)   => api.post('/pqc-inspections', data),
  updateResult: (id, result) => api.patch(`/pqc-inspections/${id}/result`, { result }),
  delete:       (id)     => api.delete(`/pqc-inspections/${id}`),
};

export const oqcApi = {
  getAll:       (params) => api.get('/oqc-inspections', { params }),
  getById:      (id)     => api.get(`/oqc-inspections/${id}`),
  create:       (data)   => api.post('/oqc-inspections', data),
  updateResult: (id, result) => api.patch(`/oqc-inspections/${id}/result`, { result }),
  generateDoc:  (id, type)   => api.patch(`/oqc-inspections/${id}/generate-doc`, { type }),
  delete:       (id)     => api.delete(`/oqc-inspections/${id}`),
};

export const scheduleApi = {
  getAll:   (params) => api.get('/production-schedules', { params }),
  getById:  (id)     => api.get(`/production-schedules/${id}`),
  create:   (data)   => api.post('/production-schedules', data),
  update:   (id, d)  => api.patch(`/production-schedules/${id}`, d),
  publish:  (id)     => api.patch(`/production-schedules/${id}/publish`),
  delete:   (id)     => api.delete(`/production-schedules/${id}`),
};

export const scrapApi = {
  getAll:     (params) => api.get('/scrap-vouchers', { params }),
  getById:    (id)     => api.get(`/scrap-vouchers/${id}`),
  create:     (data)   => api.post('/scrap-vouchers', data),
  update:     (id, d)  => api.patch(`/scrap-vouchers/${id}`, d),
  authorize:  (id)     => api.patch(`/scrap-vouchers/${id}/authorize`),
  reject:     (id)     => api.patch(`/scrap-vouchers/${id}/reject`),
  delete:     (id)     => api.delete(`/scrap-vouchers/${id}`),
};
