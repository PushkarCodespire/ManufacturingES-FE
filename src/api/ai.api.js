import api from './axios';

const aiApi = {
  // MGT-001: RFQ Auto-Fill
  suggestRfqFill: (data) =>
    api.post('/rfqs/ai/suggest-fill', data).then((r) => r.data),

  // MGT-002: Price Suggestion
  suggestPrice: (data) =>
    api.post('/quotations/ai/suggest-price', data).then((r) => r.data),

  // MGT-003: PO PDF Extraction
  extractPo: (formData) =>
    api.post('/customer-orders/ai/extract-po', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }).then((r) => r.data),

  // MGT-004: Delivery Risk
  getDeliveryRisk: () =>
    api.get('/customer-orders/ai/delivery-risk').then((r) => r.data),

  // MGT-005: Health Summary
  getHealthSummary: (orderId) =>
    api.get(`/customer-orders/${orderId}/ai/health-summary`).then((r) => r.data),

  // OQC-001: Priority Queue
  getOqcPriority: () =>
    api.get('/oqc-inspections/ai/priority-queue').then((r) => r.data),

  // OQC-002: IQC Comparison
  getIqcComparison: (inspectionId) =>
    api.get(`/oqc-inspections/${inspectionId}/ai/iqc-comparison`).then((r) => r.data),

  // OQC-004: Standards Detection
  detectStandards: (data) =>
    api.post('/oqc-inspections/ai/detect-standards', data).then((r) => r.data),

  // PQC-001: Defect Patterns
  getDefectPatterns: (params = {}) =>
    api.get('/pqc-inspections/ai/defect-patterns', { params }).then((r) => r.data),

  // PRD-001: Material Shortage Prediction
  getShortagePrediction: (params = {}) =>
    api.get('/production-schedules/ai/shortage-prediction', { params }).then((r) => r.data),

  // PRD-002: Production Bottleneck Detection
  getBottleneckDetection: (params = {}) =>
    api.get('/production-schedules/ai/bottleneck-detection', { params }).then((r) => r.data),

  // ── Part 1: Quality AI ────────────────────────────────────────────────────

  // NCR: Root-cause suggestion
  getNcrAiSuggestion: (ncrId) =>
    api.get(`/quality/ncr/${ncrId}/ai-suggestion`).then((r) => r.data),

  // Complaint: Closure summary
  getComplaintAiSummary: (complaintId) =>
    api.get(`/quality/complaints/${complaintId}/ai-summary`).then((r) => r.data),

  // LQC: Defect spike alert (per-inspection — compare fail rate vs rolling average)
  getLqcAiSpikeAlert: (inspectionId) =>
    api.get(`/lqc-inspections/${inspectionId}/ai-spike-alert`).then((r) => r.data),

  // ── CAPA: Root Cause AI Suggestion (5-Why + Fishbone)
  getRootCauseSuggestion: (capaId) =>
    api.post(`/quality/capa/${capaId}/ai/root-cause`).then((r) => r.data),

  // CAPA: Effectiveness Prediction
  getEffectivenessPrediction: (capaId) =>
    api.post(`/quality/capa/${capaId}/ai/effectiveness-prediction`).then((r) => r.data),

  // Check Sheet: Dimension Extraction from Drawing (Vision)
  getDimensionExtraction: (formData) =>
    api.post('/npd/check-sheets/ai/dimension-extraction', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then((r) => r.data),

  // PFMEA: Failure Mode Suggestion
  getFailureModeSuggestion: (pfmeaId, data = {}) =>
    api.post(`/npd/pfmea/${pfmeaId}/ai/failure-mode-suggestion`, data).then((r) => r.data),

  // ── Part 2: Procurement & Finance AI ─────────────────────────────────────

  // SCAR: AI draft (professional issue statement + suggested actions)
  getScarAiDraft: (scarId) =>
    api.get(`/scars/${scarId}/ai-draft`).then((r) => r.data),

  // PO: AI risk flag (delivery risk, cost risk, recommended actions)
  getPoAiRiskFlag: (poId) =>
    api.get(`/purchase-orders/${poId}/ai-risk-flag`).then((r) => r.data),

  // GRN: AI quality flag (quality risk, concerns, recommended actions)
  getGrnAiQualityFlag: (grnId) =>
    api.get(`/grns/${grnId}/ai-quality-flag`).then((r) => r.data),

  // COPQ: AI narrative (fleet-wide, date range params: from, to)
  getCopqAiNarrative: (params = {}) =>
    api.get('/copq-entries/ai-narrative', { params }).then((r) => r.data),

  // ── Part 3: Production & Quality Operations AI ────────────────────────────

  // WO: Delay risk analysis (per work order)
  getWoAiDelayRisk: (woId) =>
    api.get(`/work-orders/${woId}/ai-delay-risk`).then((r) => r.data),

  // Job Card: ETA prediction (per job card)
  getJobCardAiEta: (jobCardId) =>
    api.get(`/job-cards/${jobCardId}/ai-eta`).then((r) => r.data),

  // Instruments: Fleet-wide calibration forecast
  getCalibrationForecast: () =>
    api.get('/quality/instruments/ai-calibration-forecast').then((r) => r.data),

  // Training: Skill gap analysis (fleet-wide)
  getSkillGapAnalysis: () =>
    api.get('/hr/training-records/ai-skill-gap').then((r) => r.data),

  // ── Part 4: Vision AI ─────────────────────────────────────────────────────

  // IQC: Photo defect tagging (vision — upload inspection photo)
  iqcPhotoAnalyze: (formData) =>
    api.post('/iqc-inspections/ai-photo-analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then((r) => r.data),

  // Mold Return: Photo condition analysis (vision — upload mold photo)
  moldPhotoAnalyze: (formData) =>
    api.post('/mold/issue-return/ai-photo-analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then((r) => r.data),
};

export default aiApi;
