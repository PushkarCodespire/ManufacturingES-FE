import api from './axios';

export const workCenterApi = {
  getAll:       (params) => api.get('/work-centers', { params }),
  getById:      (id)     => api.get(`/work-centers/${id}`),
  create:       (data)   => api.post('/work-centers', data),
  update:       (id, data) => api.patch(`/work-centers/${id}`, data),
  toggleActive: (id)     => api.patch(`/work-centers/${id}/toggle`),
  remove:       (id)     => api.delete(`/work-centers/${id}`),
};
