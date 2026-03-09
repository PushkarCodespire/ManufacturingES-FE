import api from './axios';

export const itemApi = {
  /** List items — returns FULL response { data, meta } for pagination */
  getAll:   (params = {}) => api.get('/items', { params }),
  /** Single item by ID */
  getById:  (id)          => api.get(`/items/${id}`).then((r) => r.data),
  /** Create a new item */
  create:   (data)        => api.post('/items', data).then((r) => r.data),
  /** Update item fields */
  update:   (id, data)    => api.patch(`/items/${id}`, data).then((r) => r.data),
  /** Delete item */
  delete:   (id)          => api.delete(`/items/${id}`).then((r) => r.data),
  /** Upload image — multipart/form-data */
  upload:   (formData)    => api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};
