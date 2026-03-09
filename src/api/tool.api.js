import api from './axios';

export const toolApi = {
  /** List all tools (optionally filtered by search) */
  getAll:   (params = {}) => api.get('/tools',        { params }).then((r) => r.data),
  /** Single tool by ID */
  getById:  (id)          => api.get(`/tools/${id}`).then((r) => r.data),
  /** Create a new tool */
  create:   (data)        => api.post('/tools', data).then((r) => r.data),
  /** Update tool fields */
  update:   (id, data)    => api.patch(`/tools/${id}`, data).then((r) => r.data),
  /** Delete tool */
  delete:   (id)          => api.delete(`/tools/${id}`).then((r) => r.data),
};
