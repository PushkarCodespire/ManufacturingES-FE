import api from './axios';

export const productionParameterApi = {
  /** List all active production parameters */
  getAll:       (params = {}) => api.get('/production-parameters', { params }).then((r) => r.data),
  /** Create a single parameter */
  create:       (data)        => api.post('/production-parameters', data).then((r) => r.data),
  /** Bulk create parameters */
  bulkCreate:   (data)        => api.post('/production-parameters/bulk', data).then((r) => r.data),
  /** Soft-delete a parameter */
  delete:       (id)          => api.delete(`/production-parameters/${id}`).then((r) => r.data),
};
