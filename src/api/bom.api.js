import api from './axios';

export const bomApi = {
  /** List all BOMs with lines */
  getAll:         (params = {}) => api.get('/boms', { params }).then((r) => r.data),
  /** Get BOM for a specific item */
  getByItemId:    (itemId)      => api.get(`/boms/item/${itemId}`).then((r) => r.data),
  /** Create or update a draft BOM */
  createOrUpdate: (data)        => api.post('/boms', data).then((r) => r.data),
  /** Finalize a BOM (lock it) */
  finalize:       (id)          => api.post(`/boms/${id}/finalize`).then((r) => r.data),
  /** Delete a draft BOM */
  delete:         (id)          => api.delete(`/boms/${id}`).then((r) => r.data),
  explode:        (data)        => api.post('/boms/explode', data).then((r) => r.data),
};
