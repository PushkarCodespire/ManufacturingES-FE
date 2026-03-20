import api from './axios';

// ── Instruments (Calibration) ────────────────────────────────────────────────
export const instrumentApi = {
  getAll:               (params = {}) => api.get('/quality/instruments',                { params }).then((r) => r.data),
  getById:              (id)          => api.get(`/quality/instruments/${id}`).then((r) => r.data),
  create:               (data)        => api.post('/quality/instruments',               data).then((r) => r.data),
  update:               (id, data)    => api.patch(`/quality/instruments/${id}`,        data).then((r) => r.data),
  delete:               (id)          => api.delete(`/quality/instruments/${id}`).then((r) => r.data),
  verify:               (id, data)    => api.post(`/quality/instruments/${id}/verify`,  data).then((r) => r.data),
  getVerificationStatus: ()           => api.get('/quality/instruments/verification-status').then((r) => r.data),
};

// ── CAPA / 8D ────────────────────────────────────────────────────────────────
export const capaApi = {
  getAll:            (params = {}) => api.get('/quality/capa',                    { params }).then((r) => r.data),
  getById:           (id)          => api.get(`/quality/capa/${id}`).then((r) => r.data),
  create:            (data)        => api.post('/quality/capa',                   data).then((r) => r.data),
  update:            (id, data)    => api.patch(`/quality/capa/${id}`,            data).then((r) => r.data),
  updateD4:          (id, data)    => api.put(`/quality/capa/${id}/d4`,           data).then((r) => r.data),
  updateD5D6:        (id, data)    => api.put(`/quality/capa/${id}/d5d6`,         data).then((r) => r.data),
  addEffectiveness:  (id, data)    => api.post(`/quality/capa/${id}/effectiveness`,data).then((r) => r.data),
  close:             (id)          => api.patch(`/quality/capa/${id}/close`,      {}).then((r) => r.data),
  delete:            (id)          => api.delete(`/quality/capa/${id}`).then((r) => r.data),
  getOverdueEffectiveness: (params = {}) => api.get('/quality/capa/effectiveness/overdue', { params }).then((r) => r.data),
};

// ── Internal NCR ──────────────────────────────────────────────────────────────
export const ncrApi = {
  getAll:         (params = {}) => api.get('/quality/ncr',                 { params }).then((r) => r.data),
  getById:        (id)          => api.get(`/quality/ncr/${id}`).then((r) => r.data),
  create:         (data)        => api.post('/quality/ncr',                data).then((r) => r.data),
  update:         (id, data)    => api.patch(`/quality/ncr/${id}`,         data).then((r) => r.data),
  addDisposition: (id, data)    => api.post(`/quality/ncr/${id}/disposition`, data).then((r) => r.data),
  close:          (id)          => api.patch(`/quality/ncr/${id}/close`,   {}).then((r) => r.data),
  delete:         (id)          => api.delete(`/quality/ncr/${id}`).then((r) => r.data),
};

// ── Customer Complaints ───────────────────────────────────────────────────────
export const complaintApi = {
  getAll:      (params = {}) => api.get('/quality/complaints',               { params }).then((r) => r.data),
  getById:     (id)          => api.get(`/quality/complaints/${id}`).then((r) => r.data),
  create:      (data)        => api.post('/quality/complaints',              data).then((r) => r.data),
  update:      (id, data)    => api.patch(`/quality/complaints/${id}`,       data).then((r) => r.data),
  acknowledge: (id, data)    => api.patch(`/quality/complaints/${id}/acknowledge`, data).then((r) => r.data),
  delete:      (id)          => api.delete(`/quality/complaints/${id}`).then((r) => r.data),
};

// ── PPAP ─────────────────────────────────────────────────────────────────────
export const ppapApi = {
  getAll:         (params = {}) => api.get('/quality/ppap',                      { params }).then((r) => r.data),
  getById:        (id)          => api.get(`/quality/ppap/${id}`).then((r) => r.data),
  create:         (data)        => api.post('/quality/ppap',                     data).then((r) => r.data),
  updateElement:  (id, elId, data) => api.patch(`/quality/ppap/${id}/element/${elId}`, data).then((r) => r.data),
  signPsw:        (id)          => api.patch(`/quality/ppap/${id}/sign-psw`,     {}).then((r) => r.data),
  approve:        (id)          => api.patch(`/quality/ppap/${id}/approve`,      {}).then((r) => r.data),
  reject:         (id, data)    => api.patch(`/quality/ppap/${id}/reject`,       data).then((r) => r.data),
  delete:         (id)          => api.delete(`/quality/ppap/${id}`).then((r) => r.data),
};

// ── Audit Plans ───────────────────────────────────────────────────────────────
export const auditPlanApi = {
  getAll:       (params = {}) => api.get('/quality/audit-plans',                    { params }).then((r) => r.data),
  getById:      (id)          => api.get(`/quality/audit-plans/${id}`).then((r) => r.data),
  create:       (data)        => api.post('/quality/audit-plans',                   data).then((r) => r.data),
  approve:      (id)          => api.patch(`/quality/audit-plans/${id}/approve`,    {}).then((r) => r.data),
  delete:       (id)          => api.delete(`/quality/audit-plans/${id}`).then((r) => r.data),
  addItem:      (id, data)    => api.post(`/quality/audit-plans/${id}/items`,       data).then((r) => r.data),
  executeItem:  (itemId, data) => api.patch(`/quality/audit-plans/items/${itemId}/execute`, data).then((r) => r.data),
  addFinding:   (itemId, data) => api.post(`/quality/audit-plans/items/${itemId}/findings`, data).then((r) => r.data),
};

// ── Calibration Failures ──────────────────────────────────────────────────────
export const calibrationFailureApi = {
  getByInstrument: (instrId)    => api.get(`/quality/instruments/${instrId}/failures`).then((r) => r.data),
  log:             (instrId, data) => api.post(`/quality/instruments/${instrId}/failures`, data).then((r) => r.data),
  close:           (failureId, data) => api.patch(`/quality/instruments/failures/${failureId}/close`, data).then((r) => r.data),
};

// ── Engineering Drawings ──────────────────────────────────────────────────────
export const drawingApi = {
  getAll:     (params = {}) => api.get('/npd/drawings',               { params }).then((r) => r.data),
  getById:    (id)          => api.get(`/npd/drawings/${id}`).then((r) => r.data),
  create:     (data)        => api.post('/npd/drawings',              data).then((r) => r.data),
  addVersion: (id, data)    => api.post(`/npd/drawings/${id}/versions`, data).then((r) => r.data),
  update:     (id, data)    => api.patch(`/npd/drawings/${id}`,       data).then((r) => r.data),
  approve:    (id, data)    => api.patch(`/npd/drawings/${id}/approve`, data).then((r) => r.data),
  obsolete:   (id)          => api.patch(`/npd/drawings/${id}/obsolete`, {}).then((r) => r.data),
  delete:       (id)          => api.delete(`/npd/drawings/${id}`).then((r) => r.data),
  checkCascade: (id)          => api.get(`/npd/drawings/${id}/cascade-check`).then((r) => r.data),
};

// ── Check Sheet Templates ─────────────────────────────────────────────────────
export const checkSheetApi = {
  getAll:            (params = {}) => api.get('/npd/check-sheets',                     { params }).then((r) => r.data),
  getById:           (id)          => api.get(`/npd/check-sheets/${id}`).then((r) => r.data),
  create:            (data)        => api.post('/npd/check-sheets',                    data).then((r) => r.data),
  update:            (id, data)    => api.patch(`/npd/check-sheets/${id}`,             data).then((r) => r.data),
  updateDimensions:  (id, data)    => api.put(`/npd/check-sheets/${id}/dimensions`,    data).then((r) => r.data),
  delete:            (id)          => api.delete(`/npd/check-sheets/${id}`).then((r) => r.data),
  revalidate:        (id)          => api.patch(`/npd/check-sheets/${id}/revalidate`).then((r) => r.data),
};

// ── PFMEA ─────────────────────────────────────────────────────────────────────
export const pfmeaApi = {
  getAll:        (params = {}) => api.get('/npd/pfmea',                       { params }).then((r) => r.data),
  getById:       (id)          => api.get(`/npd/pfmea/${id}`).then((r) => r.data),
  create:        (data)        => api.post('/npd/pfmea',                      data).then((r) => r.data),
  update:        (id, data)    => api.patch(`/npd/pfmea/${id}`,               data).then((r) => r.data),
  addItem:       (id, data)    => api.post(`/npd/pfmea/${id}/items`,          data).then((r) => r.data),
  updateItem:    (id, itemId, data) => api.patch(`/npd/pfmea/${id}/items/${itemId}`, data).then((r) => r.data),
  deleteItem:    (id, itemId)  => api.delete(`/npd/pfmea/${id}/items/${itemId}`).then((r) => r.data),
  addAction:     (id, itemId, data) => api.post(`/npd/pfmea/${id}/items/${itemId}/actions`, data).then((r) => r.data),
  updateAction:  (id, itemId, actionId, data) => api.patch(`/npd/pfmea/${id}/items/${itemId}/actions/${actionId}`, data).then((r) => r.data),
  delete:        (id)          => api.delete(`/npd/pfmea/${id}`).then((r) => r.data),
};
