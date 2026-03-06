import api from './axios';

export const itemApi = {
  /** List all items (optionally filtered) */
  getAll:   (params = {}) => api.get('/items',        { params }).then((r) => r.data),
  /** Single item by ID */
  getById:  (id)          => api.get(`/items/${id}`).then((r) => r.data),
  /** Create a new item */
  create:   (data)        => api.post('/items', data).then((r) => r.data),
  /** Update item fields */
  update:   (id, data)    => api.patch(`/items/${id}`, data).then((r) => r.data),
  /** Delete item */
  delete:   (id)          => api.delete(`/items/${id}`).then((r) => r.data),
};
