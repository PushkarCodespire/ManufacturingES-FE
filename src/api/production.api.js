import api from './axios';

export const workOrderApi = {
  getAll:              (params)      => api.get('/work-orders', { params }),
  getById:             (id)          => api.get(`/work-orders/${id}`),
  create:              (data)        => api.post('/work-orders', data),
  update:              (id, d)       => api.patch(`/work-orders/${id}`, d),
  updateStatus:        (id, status)  => api.patch(`/work-orders/${id}/status`, { status }),
  delete:              (id)          => api.delete(`/work-orders/${id}`),
  getSubAssemblies:    (parentId)    => api.get(`/work-orders/${parentId}/sub-assemblies`),
  createSubAssembly:   (parentId, d) => api.post(`/work-orders/${parentId}/sub-assemblies`, d),
  generateSubFromBom:  (parentId)    => api.post(`/work-orders/${parentId}/generate-sub-assemblies`),
};

export const jobCardApi = {
  getAll:          (params) => api.get('/job-cards', { params }),
  getById:         (id)     => api.get(`/job-cards/${id}`),
  create:          (data)   => api.post('/job-cards', data),
  update:          (id, d)  => api.patch(`/job-cards/${id}`, d),
  close:           (id, d)  => api.patch(`/job-cards/${id}/close`, d),
  cancel:          (id)     => api.patch(`/job-cards/${id}/cancel`),
  delete:          (id)     => api.delete(`/job-cards/${id}`),
  getCapacityPlan: ()       => api.get('/job-cards/capacity-plan'),
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

// ── Batch 1A — Time Standards ────────────────────────────────────────────────
export const routingApi = {
  getAll:              (params)           => api.get('/routings', { params }),
  getById:             (id)              => api.get(`/routings/${id}`),
  create:              (data)            => api.post('/routings', data),
  update:              (id, d)           => api.patch(`/routings/${id}`, d),
  updateStatus:        (id, status)      => api.patch(`/routings/${id}/status`, { status }),
  delete:              (id)              => api.delete(`/routings/${id}`),
  getTimeAnalysis:     (params)          => api.get('/routings/steps/time-analysis', { params }),
  getStepJobHistory:   (stepId, params)  => api.get(`/routings/steps/${stepId}/job-card-history`, { params }),
};

// ── Batch 1B — Shift Planning ────────────────────────────────────────────────
export const shiftPlanningApi = {
  getAssignments:   (params) => api.get('/shift-assignments',          { params }),
  getCalendar:      (params) => api.get('/shift-assignments/calendar', { params }),
  createAssignment: (data)   => api.post('/shift-assignments',          data),
  updateAssignment: (id, d)  => api.put(`/shift-assignments/${id}`,    d),
  deleteAssignment: (id)     => api.delete(`/shift-assignments/${id}`),
  getCrew:          (params) => api.get('/shift-assignments/crew',     { params }),
  addCrewMember:    (data)   => api.post('/shift-assignments/crew',     data),
  removeCrewMember: (id)     => api.delete(`/shift-assignments/crew/${id}`),
};

// ── Batch 2A — Labor Tracking ─────────────────────────────────────────────────
export const laborApi = {
  getAll:     (params)   => api.get('/labor-logs',         { params }),
  getSummary: (params)   => api.get('/labor-logs/summary', { params }),
  getById:    (id)       => api.get(`/labor-logs/${id}`),
  create:     (data)     => api.post('/labor-logs',         data),
  update:     (id, data) => api.put(`/labor-logs/${id}`,   data),
  remove:     (id)       => api.delete(`/labor-logs/${id}`),
};

// ── Batch 6A — OEE ───────────────────────────────────────────────────────────
export const oeeApi = {
  getDashboard:    (params) => api.get('/oee/dashboard',           { params }),
  getMachineDetail: (id, p) => api.get(`/oee/machine/${id}`,       { params: p }),
};

// ── Batch 6B — Rework Vouchers ────────────────────────────────────────────────
export const reworkApi = {
  getAll:     (params)   => api.get('/rework-vouchers',             { params }),
  getById:    (id)       => api.get(`/rework-vouchers/${id}`),
  create:     (data)     => api.post('/rework-vouchers',             data),
  authorize:  (id)       => api.patch(`/rework-vouchers/${id}/authorize`),
  start:      (id)       => api.patch(`/rework-vouchers/${id}/start`),
  complete:   (id, data) => api.patch(`/rework-vouchers/${id}/complete`, data),
  addStep:    (id, data) => api.post(`/rework-vouchers/${id}/steps`, data),
  updateStep: (id, sid, data) => api.patch(`/rework-vouchers/${id}/steps/${sid}`, data),
  delete:     (id)       => api.delete(`/rework-vouchers/${id}`),
};

// ── Batch 6C — Tool Management ────────────────────────────────────────────────
export const toolLogApi = {
  getAll:     (params)  => api.get('/tool-logs',              { params }),
  getSummary: ()        => api.get('/tool-logs/summary'),
  getByTool:  (toolId)  => api.get(`/tool-logs/tool/${toolId}`),
  logUsage:   (data)    => api.post('/tool-logs',              data),
  delete:     (id)      => api.delete(`/tool-logs/${id}`),
};

// ── Batch 6D — Demand Forecast ────────────────────────────────────────────────
export const demandForecastApi = {
  getForecast:    (params) => api.get('/demand-forecast',            { params }),
  getMonthlySummary: (p)  => api.get('/demand-forecast/summary',    { params: p }),
  getOpenOrders:  ()       => api.get('/demand-forecast/open-orders'),
};

// ── Batch 2B — Operator Skill Matrix ─────────────────────────────────────────
export const skillMatrixApi = {
  // Skill definitions
  getAllSkills:   (params)   => api.get('/operator-skills',         { params }),
  createSkill:   (data)     => api.post('/operator-skills',         data),
  updateSkill:   (id, data) => api.put(`/operator-skills/${id}`,   data),
  deleteSkill:   (id)       => api.delete(`/operator-skills/${id}`),
  // Matrix (operator ↔ skill)
  getMatrix:       (params)   => api.get('/operator-skills/matrix',            { params }),
  assignSkill:     (data)     => api.post('/operator-skills/matrix',            data),
  updateMatrix:    (id, data) => api.put(`/operator-skills/matrix/${id}`,      data),
  removeMatrix:    (id)       => api.delete(`/operator-skills/matrix/${id}`),
  getByOperator:   (userId)   => api.get(`/operator-skills/matrix/by-operator/${userId}`),
};

// ── Sprint 1: Visibility — Scoreboard ────────────────────────────────────────
export const scoreboardApi = {
  get: () => api.get('/production/scoreboard'),
};

// ── Sprint 1: Visibility — Andon Board ───────────────────────────────────────
export const andonApi = {
  getBoard:         ()          => api.get('/production/andon/board'),
  getAlerts:        (params)    => api.get('/production/andon/alerts', { params }),
  raiseAlert:       (data)      => api.post('/production/andon/alerts', data),
  acknowledgeAlert: (id)        => api.patch(`/production/andon/alerts/${id}/acknowledge`),
  resolveAlert:     (id, data)  => api.patch(`/production/andon/alerts/${id}/resolve`, data),
};

// ── Sprint 1: Visibility — Shift Handover ────────────────────────────────────
export const shiftHandoverApi = {
  getAll:      (params)       => api.get('/production/shift-handovers', { params }),
  getById:     (id)           => api.get(`/production/shift-handovers/${id}`),
  create:      (data)         => api.post('/production/shift-handovers', data),
  update:      (id, data)     => api.patch(`/production/shift-handovers/${id}`, data),
  submit:      (id)           => api.patch(`/production/shift-handovers/${id}/submit`),
  acknowledge: (id)           => api.patch(`/production/shift-handovers/${id}/acknowledge`),
  addItem:     (id, data)     => api.post(`/production/shift-handovers/${id}/items`, data),
  updateItem:  (id, itemId, data) => api.patch(`/production/shift-handovers/${id}/items/${itemId}`, data),
};

// ── Job Cost Sheet ────────────────────────────────────────────────────────────
export const jobCostApi = {
  getAll:             (params) => api.get('/job-cost-sheets', { params }),
  calculate:          (data)   => api.post('/job-cost-sheets/calculate', data),
  getProfitability:   (params) => api.get('/job-cost-sheets/profitability', { params }),
  getRateCards:       ()       => api.get('/job-cost-sheets/rate-cards'),
  upsertLaborRate:    (data)   => api.post('/job-cost-sheets/rate-cards/labor', data),
  deleteLaborRate:    (id)     => api.delete(`/job-cost-sheets/rate-cards/labor/${id}`),
  upsertMachineRate:  (data)   => api.post('/job-cost-sheets/rate-cards/machine', data),
  deleteMachineRate:  (id)     => api.delete(`/job-cost-sheets/rate-cards/machine/${id}`),
  upsertOverheadRate: (data)   => api.post('/job-cost-sheets/rate-cards/overhead', data),
  deleteOverheadRate: (id)     => api.delete(`/job-cost-sheets/rate-cards/overhead/${id}`),
};

export const processRecipeApi = {
  getAll:           (params) => api.get('/process-recipes', { params }),
  getByItemMachine: (itemId, machineId) => api.get(`/process-recipes/item/${itemId}/machine/${machineId}`),
  create:           (data)   => api.post('/process-recipes', data),
  update:           (id, d)  => api.patch(`/process-recipes/${id}`, d),
  remove:           (id)     => api.delete(`/process-recipes/${id}`),
  recordReading:    (data)   => api.post('/process-recipes/readings', data),
  getReadings:      (jcId)   => api.get(`/process-recipes/readings/job-card/${jcId}`),
  getDeviations:    (params) => api.get('/process-recipes/readings/deviations', { params }),
};

export const capacitySchedulerApi = {
  getGantt:      (params) => api.get('/capacity-scheduler/gantt', { params }),
  autoSchedule:  ()       => api.post('/capacity-scheduler/auto-schedule'),
  reschedule:    (id, d)  => api.patch(`/capacity-scheduler/reschedule/${id}`, d),
  getOverloads:  (params) => api.get('/capacity-scheduler/overloads', { params }),
};

export const wipApi = {
  getBoard:   ()            => api.get('/wip/board'),
  checkIn:    (data)        => api.post('/wip/check-in', data),
  checkOut:   (data)        => api.post('/wip/check-out', data),
  getHistory: (workOrderId) => api.get(`/wip/history/${workOrderId}`),
};
