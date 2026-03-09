import api from './axios';

export const tagApi = {
  /** List all tags (optionally filtered by tag_type or search) */
  getAll:   (params = {}) => api.get('/tags',        { params }).then((r) => r.data),
  /** Single tag by ID */
  getById:  (id)          => api.get(`/tags/${id}`).then((r) => r.data),
  /** Create a new tag */
  create:   (data)        => api.post('/tags', data).then((r) => r.data),
  /** Update tag fields */
  update:   (id, data)    => api.patch(`/tags/${id}`, data).then((r) => r.data),
  /** Delete tag */
  delete:   (id)          => api.delete(`/tags/${id}`).then((r) => r.data),
};
