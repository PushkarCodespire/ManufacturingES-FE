import api from './axios';

export const traceabilityApi = {
  search:   (q)           => api.get('/traceability/search', { params: { q } }),
  lot:      (lot_no)      => api.get(`/traceability/lot/${encodeURIComponent(lot_no)}`),
  grn:      (grn_no)      => api.get(`/traceability/grn/${encodeURIComponent(grn_no)}`),
  wo:       (wo_no)       => api.get(`/traceability/wo/${encodeURIComponent(wo_no)}`),
  dispatch: (dispatch_no) => api.get(`/traceability/dispatch/${encodeURIComponent(dispatch_no)}`),
};
