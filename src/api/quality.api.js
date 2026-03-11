import api from './axios';

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

// ── Engineering Drawings ──────────────────────────────────────────────────────
export const drawingApi = {
  getAll:     (params = {}) => api.get('/npd/drawings',               { params }).then((r) => r.data),
  getById:    (id)          => api.get(`/npd/drawings/${id}`).then((r) => r.data),
  create:     (data)        => api.post('/npd/drawings',              data).then((r) => r.data),
  addVersion: (id, data)    => api.post(`/npd/drawings/${id}/versions`, data).then((r) => r.data),
  update:     (id, data)    => api.patch(`/npd/drawings/${id}`,       data).then((r) => r.data),
  approve:    (id, data)    => api.patch(`/npd/drawings/${id}/approve`, data).then((r) => r.data),
  obsolete:   (id)          => api.patch(`/npd/drawings/${id}/obsolete`, {}).then((r) => r.data),
  delete:     (id)          => api.delete(`/npd/drawings/${id}`).then((r) => r.data),
};

// ── Check Sheet Templates ─────────────────────────────────────────────────────
export const checkSheetApi = {
  getAll:            (params = {}) => api.get('/npd/check-sheets',                     { params }).then((r) => r.data),
  getById:           (id)          => api.get(`/npd/check-sheets/${id}`).then((r) => r.data),
  create:            (data)        => api.post('/npd/check-sheets',                    data).then((r) => r.data),
  update:            (id, data)    => api.patch(`/npd/check-sheets/${id}`,             data).then((r) => r.data),
  updateDimensions:  (id, data)    => api.put(`/npd/check-sheets/${id}/dimensions`,    data).then((r) => r.data),
  delete:            (id)          => api.delete(`/npd/check-sheets/${id}`).then((r) => r.data),
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
