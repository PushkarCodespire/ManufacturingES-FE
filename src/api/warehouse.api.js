import api from './axios';

export const warehouseApi = {
  /** List all warehouses (optionally filtered) */
  getAll:   (params = {}) => api.get('/warehouses',        { params }).then((r) => r.data),
  /** Single warehouse by ID */
  getById:  (id)          => api.get(`/warehouses/${id}`).then((r) => r.data),
  /** Create a new warehouse */
  create:   (data)        => api.post('/warehouses', data).then((r) => r.data),
  /** Update warehouse fields */
  update:   (id, data)    => api.patch(`/warehouses/${id}`, data).then((r) => r.data),
  /** Delete warehouse */
  delete:   (id)          => api.delete(`/warehouses/${id}`).then((r) => r.data),
};
