import api from './axios';

export const routingApi = {
  getAll:        (params) => api.get('/routings', { params }),
  getById:       (id)     => api.get(`/routings/${id}`),
  create:        (data)   => api.post('/routings', data),
  update:        (id, data) => api.patch(`/routings/${id}`, data),
  updateStatus:  (id, status) => api.patch(`/routings/${id}/status`, { status }),
  remove:        (id)     => api.delete(`/routings/${id}`),
  generateJobCards: (woId) => api.post(`/work-orders/${woId}/generate-job-cards`),
};
