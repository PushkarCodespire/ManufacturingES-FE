import api from './axios';

export const trainingEffectivenessApi = {
  getPending: ()            => api.get('/hr/training-effectiveness/pending').then((r) => r.data),
  getHistory: (params = {}) => api.get('/hr/training-effectiveness/history', { params }).then((r) => r.data),
  evaluate:   (id, data)    => api.patch(`/hr/training-effectiveness/${id}/evaluate`, data).then((r) => r.data),
};
