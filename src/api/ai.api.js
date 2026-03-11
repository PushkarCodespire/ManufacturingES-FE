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

  // CAPA: Root Cause AI Suggestion (5-Why + Fishbone)
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
};

export default aiApi;
