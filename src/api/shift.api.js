import api from './axios';

export const shiftApi = {
  getAll:   ()         => api.get('/shifts').then((r) => r.data),
  getById:  (id)       => api.get(`/shifts/${id}`).then((r) => r.data),
  create:   (data)     => api.post('/shifts', data).then((r) => r.data),
  update:   (id, data) => api.patch(`/shifts/${id}`, data).then((r) => r.data),
  delete:   (id)       => api.delete(`/shifts/${id}`).then((r) => r.data),
};
