import api from './axios';

// ── Equipment Master (MNT-001) ───────────────────────────────────────────────
export const equipmentApi = {
  getAll:           (params = {}) => api.get('/maintenance/equipment',                           { params }).then((r) => r.data),
  getById:          (id)          => api.get(`/maintenance/equipment/${id}`).then((r) => r.data),
  create:           (data)        => api.post('/maintenance/equipment',                           data).then((r) => r.data),
  update:           (id, data)    => api.patch(`/maintenance/equipment/${id}`,                   data).then((r) => r.data),
  delete:           (id)          => api.delete(`/maintenance/equipment/${id}`).then((r) => r.data),
  getHierarchy:     ()            => api.get('/maintenance/equipment/hierarchy').then((r) => r.data),
  addDocument:      (id, data)    => api.post(`/maintenance/equipment/${id}/documents`,           data).then((r) => r.data),
  getCategories:    ()            => api.get('/maintenance/equipment/categories').then((r) => r.data),
  createCategory:   (data)        => api.post('/maintenance/equipment/categories',                data).then((r) => r.data),
  getFailureCodes:  ()            => api.get('/maintenance/equipment/failure-codes').then((r) => r.data),
  createFailureCode:(data)        => api.post('/maintenance/equipment/failure-codes',             data).then((r) => r.data),
  getPriorities:    ()            => api.get('/maintenance/equipment/priorities').then((r) => r.data),
};

// ── Equipment Health Dashboard (MNT-002) ─────────────────────────────────────
export const equipmentHealthApi = {
  getDashboard:         ()   => api.get('/maintenance/health/dashboard').then((r) => r.data),
  getHealthScore:       (id) => api.get(`/maintenance/health/${id}/score`).then((r) => r.data),
  calculateHealthScore: (id) => api.post(`/maintenance/health/${id}/calculate`, {}).then((r) => r.data),
};

// ── Breakdown & Corrective WO (MNT-006, MNT-007) ────────────────────────────
export const breakdownApi = {
  createBreakdown:  (data)        => api.post('/maintenance/breakdown',                                   data).then((r) => r.data),
  getBreakdowns:    (params = {}) => api.get('/maintenance/breakdown',                                    { params }).then((r) => r.data),
  getBreakdownById: (id)          => api.get(`/maintenance/breakdown/${id}`).then((r) => r.data),
  openCorrectiveWO: (id, data)    => api.post(`/maintenance/breakdown/${id}/open-wo`,                     data).then((r) => r.data),
  getWorkOrders:    (params = {}) => api.get('/maintenance/breakdown/work-orders',                        { params }).then((r) => r.data),
  getWOById:        (id)          => api.get(`/maintenance/breakdown/work-orders/${id}`).then((r) => r.data),
  assignWO:         (id, data)    => api.patch(`/maintenance/breakdown/work-orders/${id}/assign`,         data).then((r) => r.data),
  startWO:          (id)          => api.patch(`/maintenance/breakdown/work-orders/${id}/start`,          {}).then((r) => r.data),
  saveDiagnosis:    (id, data)    => api.post(`/maintenance/breakdown/work-orders/${id}/diagnosis`,       data).then((r) => r.data),
  addTask:          (id, data)    => api.post(`/maintenance/breakdown/work-orders/${id}/tasks`,           data).then((r) => r.data),
  completeTask:     (id, taskId, data) => api.patch(`/maintenance/breakdown/work-orders/${id}/tasks/${taskId}/complete`, data).then((r) => r.data),
  completeWO:       (id, data)    => api.patch(`/maintenance/breakdown/work-orders/${id}/complete`,       data).then((r) => r.data),
};

// ── Downtime Log (MNT-008) ───────────────────────────────────────────────────
export const downtimeApi = {
  getLog:       (params = {}) => api.get('/maintenance/downtime',                 { params }).then((r) => r.data),
  logManual:    (data)        => api.post('/maintenance/downtime',                 data).then((r) => r.data),
  closeDowntime:(id, data)    => api.patch(`/maintenance/downtime/${id}/close`,    data).then((r) => r.data),
  getPareto:    (params = {}) => api.get('/maintenance/downtime/pareto',           { params }).then((r) => r.data),
  getReasons:   ()            => api.get('/maintenance/downtime/reasons').then((r) => r.data),
  createReason: (data)        => api.post('/maintenance/downtime/reasons',         data).then((r) => r.data),
};

// ── PM Schedule (MNT-003, MNT-004, MNT-005) — Sprint 5 ──────────────────────
export const maintenancePmApi = {
  getTemplates:         (params = {}) => api.get('/maintenance/pm/templates',                                { params }).then((r) => r.data),
  createTemplate:       (data)        => api.post('/maintenance/pm/templates',                               data).then((r) => r.data),
  getSchedules:         (params = {}) => api.get('/maintenance/pm/schedules',                                { params }).then((r) => r.data),
  scheduleFor:          (equipId, data) => api.post('/maintenance/pm/schedules',                             data).then((r) => r.data),
  autoGenerateWOs:      ()            => api.post('/maintenance/pm/auto-generate',                           {}).then((r) => r.data),
  getWorkOrders:        (params = {}) => api.get('/maintenance/pm/work-orders',                              { params }).then((r) => r.data),
  getWorkOrder:         (woId)        => api.get(`/maintenance/pm/work-orders/${woId}`).then((r) => r.data),
  startWorkOrder:       (woId)        => api.patch(`/maintenance/pm/work-orders/${woId}/start`,              {}).then((r) => r.data),
  updateChecklistItem:  (woId, itemId, data) => api.patch(`/maintenance/pm/work-orders/${woId}/checklist/${itemId}`, data).then((r) => r.data),
  completeWorkOrder:    (woId, data)  => api.patch(`/maintenance/pm/work-orders/${woId}/complete`,           data).then((r) => r.data),
};

// ── Spare Parts (MNT-009, MNT-010) — Sprint 5 ────────────────────────────────
export const sparePartsApi = {
  getSpareParts:          (params = {}) => api.get('/maintenance/spare-parts',                              { params }).then((r) => r.data),
  createSparePart:        (data)        => api.post('/maintenance/spare-parts',                              data).then((r) => r.data),
  updateSparePart:        (id, data)    => api.patch(`/maintenance/spare-parts/${id}`,                      data).then((r) => r.data),
  getBomFor:              (equipId)     => api.get(`/maintenance/spare-parts/bom/${equipId}`).then((r) => r.data),
  addBomItem:             (equipId, data) => api.post(`/maintenance/spare-parts/bom/${equipId}`,            data).then((r) => r.data),
  removeBomItem:          (equipId, bomId) => api.delete(`/maintenance/spare-parts/bom/${equipId}/${bomId}`).then((r) => r.data),
  consumePart:            (data)        => api.post('/maintenance/spare-parts/consume',                      data).then((r) => r.data),
  getConsumptionHistory:  (partId)      => api.get(`/maintenance/spare-parts/consumption/${partId}`).then((r) => r.data),
};

// ── LOTO & Safety (MNT-011) — Sprint 5 ───────────────────────────────────────
export const lotoApi = {
  getProcedures:   (params = {}) => api.get('/maintenance/loto/procedures',                         { params }).then((r) => r.data),
  createProcedure: (data)        => api.post('/maintenance/loto/procedures',                         data).then((r) => r.data),
  getExecutions:   (params = {}) => api.get('/maintenance/loto/executions',                         { params }).then((r) => r.data),
  startLoto:       (woId, data)  => api.post('/maintenance/loto/executions',                         data).then((r) => r.data),
  lockLoto:        (id, data)    => api.patch(`/maintenance/loto/executions/${id}/lock`,             data).then((r) => r.data),
  completeLoto:    (id, data)    => api.patch(`/maintenance/loto/executions/${id}/complete`,         data).then((r) => r.data),
  getPermits:      (params = {}) => api.get('/maintenance/loto/permits',                            { params }).then((r) => r.data),
  createPermit:    (data)        => api.post('/maintenance/loto/permits',                            data).then((r) => r.data),
};

// ── Maintenance KPI (MNT-012) — Sprint 5 ─────────────────────────────────────
export const maintenanceKpiApi = {
  getDashboard:    (params = {}) => api.get('/maintenance/kpi/dashboard',                           { params }).then((r) => r.data),
  getMtbf:         (params = {}) => api.get('/maintenance/kpi/mtbf',                                { params }).then((r) => r.data),
  getMttr:         (params = {}) => api.get('/maintenance/kpi/mttr',                                { params }).then((r) => r.data),
  getPmCompliance: (params = {}) => api.get('/maintenance/kpi/pm-compliance',                        { params }).then((r) => r.data),
  // NOTE: returns full body { data: rows[], summary: [...] } — do NOT strip .data here or summary is lost
  getCostReport:   (params = {}) => api.get('/maintenance/kpi/cost-report',                          { params }),
  logCost:         (data)        => api.post('/maintenance/kpi/costs',                               data).then((r) => r.data),
};

// ── AI Features (MNT-013, 014, 015) — Sprint 6 ───────────────────────────────
export const maintenanceAiApi = {
  getPredictions:          (params = {}) => api.get('/maintenance/ai/predictions',                  { params }).then((r) => r.data),
  getPrediction:           (equipId)     => api.get(`/maintenance/ai/predictions/${equipId}`).then((r) => r.data),
  submitFeedback:          (equipId, data) => api.post(`/maintenance/ai/predictions/${equipId}/feedback`, data).then((r) => r.data),
  getRootCauseSuggestions: (woId)        => api.get(`/maintenance/ai/root-cause/${woId}`).then((r) => r.data),
  getOptimizedSchedule:    (params = {}) => api.get('/maintenance/ai/schedule-optimizer',           { params }).then((r) => r.data),
};
