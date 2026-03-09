import api from './axios';

export const machineApi = {
  /** List all machines (optionally filtered) */
  getAll:   (params = {}) => api.get('/machines',        { params }).then((r) => r.data),
  /** Single machine by ID */
  getById:  (id)          => api.get(`/machines/${id}`).then((r) => r.data),
  /** Create a new machine */
  create:   (data)        => api.post('/machines', data).then((r) => r.data),
  /** Bulk create machines with hierarchy */
  bulkCreate: (data)      => api.post('/machines/bulk', data).then((r) => r.data),
  /** Update machine fields */
  update:   (id, data)    => api.patch(`/machines/${id}`, data).then((r) => r.data),
  /** Update machine parameter assignments */
  updateParameters: (id, data) => api.patch(`/machines/${id}/parameters`, data).then((r) => r.data),
  /** Delete machine */
  delete:   (id)          => api.delete(`/machines/${id}`).then((r) => r.data),
};
