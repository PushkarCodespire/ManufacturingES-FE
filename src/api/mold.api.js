import api from './axios';

// ── Mold Master (MOL-001) ───────────────────────────────────────────────────
export const moldMasterApi = {
  getAll:             (params = {}) => api.get('/mold/masters',                          { params }).then((r) => r.data),
  getById:            (id)          => api.get(`/mold/masters/${id}`).then((r) => r.data),
  create:             (data)        => api.post('/mold/masters',                          data).then((r) => r.data),
  update:             (id, data)    => api.patch(`/mold/masters/${id}`,                   data).then((r) => r.data),
  delete:             (id)          => api.delete(`/mold/masters/${id}`).then((r) => r.data),
  getByQrCode:        (qrCode)      => api.get(`/mold/masters/scan/${encodeURIComponent(qrCode)}`).then((r) => r.data),
  addPartMapping:     (id, data)    => api.post(`/mold/masters/${id}/part-mappings`,      data).then((r) => r.data),
  removePartMapping:  (id, mapId)   => api.delete(`/mold/masters/${id}/part-mappings/${mapId}`).then((r) => r.data),
  addMachineCompat:   (id, data)    => api.post(`/mold/masters/${id}/machine-compat`,     data).then((r) => r.data),
  uploadDocument:     (id, data)    => api.post(`/mold/masters/${id}/documents`,           data).then((r) => r.data),
};

// ── Cavity Tracking (MOL-002) ───────────────────────────────────────────────
export const moldCavityApi = {
  getCavities:    (moldId)            => api.get(`/mold/cavities/${moldId}/cavities`).then((r) => r.data),
  createCavity:   (moldId, data)      => api.post(`/mold/cavities/${moldId}/cavities`,               data).then((r) => r.data),
  blockCavity:    (moldId, cavId, data) => api.post(`/mold/cavities/${moldId}/cavities/${cavId}/block`,   data).then((r) => r.data),
  unblockCavity:  (moldId, cavId, data) => api.post(`/mold/cavities/${moldId}/cavities/${cavId}/unblock`, data).then((r) => r.data),
  getHeatmap:     (moldId)            => api.get(`/mold/cavities/${moldId}/cavity-heatmap`).then((r) => r.data),
};

// ── Shot Count (MOL-003) ────────────────────────────────────────────────────
export const moldShotCountApi = {
  getDashboard:    (params = {}) => api.get('/mold/shot-count/dashboard',                       { params }).then((r) => r.data),
  getShotHistory:  (moldId, params = {}) => api.get(`/mold/shot-count/${moldId}/history`,       { params }).then((r) => r.data),
  calculateShots:  (jobCardId)   => api.post(`/mold/shot-count/calculate/${jobCardId}`,         {}).then((r) => r.data),
  adjustShotCount: (moldId, data) => api.post(`/mold/shot-count/${moldId}/adjust`,              data).then((r) => r.data),
};

// ── Life Management (MOL-004) ───────────────────────────────────────────────
export const moldLifeApi = {
  getDashboard:         (params = {}) => api.get('/mold/life/dashboard',                                  { params }).then((r) => r.data),
  getAlerts:            (params = {}) => api.get('/mold/life/alerts',                                     { params }).then((r) => r.data),
  acknowledgeAlert:     (alertId)     => api.post(`/mold/life/alerts/${alertId}/acknowledge`,              {}).then((r) => r.data),
  approveLifeExtension: (extId, data) => api.post(`/mold/life/extensions/${extId}/approve`,               data).then((r) => r.data),
  getLifeStatus:        (moldId)      => api.get(`/mold/life/${moldId}/status`).then((r) => r.data),
  updateLifeConfig:     (moldId, data) => api.put(`/mold/life/${moldId}/config`,                          data).then((r) => r.data),
  requestLifeExtension: (moldId, data) => api.post(`/mold/life/${moldId}/extend`,                         data).then((r) => r.data),
};

// ── Issue / Return (MOL-005 & MOL-006) ──────────────────────────────────────
export const moldIssueReturnApi = {
  verifyForIssue:   (moldId, woId, machineId) => api.get(`/mold/issue-return/${moldId}/verify/${woId}/${machineId}`).then((r) => r.data),
  issueMold:        (moldId, data)    => api.post(`/mold/issue-return/${moldId}/issue`,            data).then((r) => r.data),
  issueWithOverride:(moldId, data)    => api.post(`/mold/issue-return/${moldId}/issue/override`,   data).then((r) => r.data),
  returnMold:       (moldId, data)    => api.post(`/mold/issue-return/${moldId}/return`,            data).then((r) => r.data),
  inspectReturn:    (issueReturnId, data) => api.post(`/mold/issue-return/inspect/${issueReturnId}`, data).then((r) => r.data),
  getHistory:       (moldId, params = {}) => api.get(`/mold/issue-return/${moldId}/history`,       { params }).then((r) => r.data),
};

// ── Mold Store Dashboard (MOL-007) ──────────────────────────────────────────
export const moldStoreApi = {
  getDashboard:       (params = {}) => api.get('/mold/store/dashboard',         { params }).then((r) => r.data),
  getRackMap:         ()            => api.get('/mold/store/rack-map').then((r) => r.data),
  getMovementForecast:()            => api.get('/mold/store/movement-forecast').then((r) => r.data),
  updateLocation:     (moldId, data) => api.patch(`/mold/store/${moldId}/location`, data).then((r) => r.data),
};

// ── PM Schedules (MOL-008) ───────────────────────────────────────────────────
export const moldPmApi = {
  getTemplates:      (params = {}) => api.get('/mold/pm/templates',                      { params }).then((r) => r.data),
  createTemplate:    (data)        => api.post('/mold/pm/templates',                       data).then((r) => r.data),
  getSchedules:      (params = {}) => api.get('/mold/pm/schedules',                       { params }).then((r) => r.data),
  schedulePm:        (moldId, data)=> api.post(`/mold/pm/${moldId}/schedule`,              data).then((r) => r.data),
  getWorkOrder:      (woId)        => api.get(`/mold/pm/work-orders/${woId}`).then((r) => r.data),
  openWorkOrder:     (scheduleId)  => api.post(`/mold/pm/schedules/${scheduleId}/open`,    {}).then((r) => r.data),
  completeWorkOrder: (woId, data)  => api.post(`/mold/pm/work-orders/${woId}/complete`,    data).then((r) => r.data),
};

// ── Repair & Sub-Contracting (MOL-009) ───────────────────────────────────────
export const moldRepairApi = {
  getRepairTypes:   (params = {})   => api.get('/mold/repair/types',                      { params }).then((r) => r.data),
  createRepairType: (data)          => api.post('/mold/repair/types',                       data).then((r) => r.data),
  getRequests:      (params = {})   => api.get('/mold/repair/requests',                    { params }).then((r) => r.data),
  getById:          (id)            => api.get(`/mold/repair/requests/${id}`).then((r) => r.data),
  createRequest:    (moldId, data)  => api.post(`/mold/repair/${moldId}/request`,           data).then((r) => r.data),
  approve:          (id, data)      => api.patch(`/mold/repair/requests/${id}/approve`,     data).then((r) => r.data),
  addTracking:      (id, data)      => api.post(`/mold/repair/requests/${id}/track`,        data).then((r) => r.data),
  addCost:          (id, data)      => api.post(`/mold/repair/requests/${id}/costs`,        data).then((r) => r.data),
  complete:         (id, data)      => api.patch(`/mold/repair/requests/${id}/complete`,    data).then((r) => r.data),
};

// ── Trial Management (MOL-010) ───────────────────────────────────────────────
export const moldTrialApi = {
  getProtocols:   (params = {})   => api.get('/mold/trial/protocols',                     { params }).then((r) => r.data),
  createProtocol: (data)          => api.post('/mold/trial/protocols',                     data).then((r) => r.data),
  getTrials:      (params = {})   => api.get('/mold/trial/runs',                           { params }).then((r) => r.data),
  getById:        (id)            => api.get(`/mold/trial/runs/${id}`).then((r) => r.data),
  startTrial:     (moldId, data)  => api.post(`/mold/trial/${moldId}/start`,               data).then((r) => r.data),
  updateTrial:    (id, data)      => api.patch(`/mold/trial/runs/${id}`,                   data).then((r) => r.data),
  addParameter:   (id, data)      => api.post(`/mold/trial/runs/${id}/parameters`,         data).then((r) => r.data),
};

// ── Cost Tracking (MOL-011) ───────────────────────────────────────────────────
export const moldCostApi = {
  getDashboard:   ()                  => api.get('/mold/cost/dashboard').then((r) => r.data),
  getMoldCosts:   (moldId, params={}) => api.get(`/mold/cost/${moldId}`,                   { params }).then((r) => r.data),
  getCostPerShot: (moldId)            => api.get(`/mold/cost/${moldId}/cost-per-shot`).then((r) => r.data),
  addCost:        (moldId, data)      => api.post(`/mold/cost/${moldId}`,                   data).then((r) => r.data),
};

// ── Document Generation (MOL-012) ────────────────────────────────────────────
export const moldDocumentsApi = {
  getHistoryCard:       (moldId)      => api.get(`/mold/documents/${moldId}/history-card`).then((r) => r.data),
  getStatusCertificate: (moldId)      => api.get(`/mold/documents/${moldId}/status-certificate`).then((r) => r.data),
  generateReport:       (params = {}) => api.get('/mold/documents/report',                 { params }).then((r) => r.data),
};
