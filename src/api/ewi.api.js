import api from './axios';

export const ewiApi = {
  getAll:        (params)           => api.get('/ewi', { params }),
  getById:       (id)               => api.get(`/ewi/${id}`),
  create:        (data)             => api.post('/ewi', data),
  update:        (id, data)         => api.put(`/ewi/${id}`, data),
  updateStatus:  (id, status)       => api.patch(`/ewi/${id}/status`, { status }),
  addStep:       (id, data)         => api.post(`/ewi/${id}/steps`, data),
  updateStep:    (id, stepId, data) => api.put(`/ewi/${id}/steps/${stepId}`, data),
  deleteStep:    (id, stepId)       => api.delete(`/ewi/${id}/steps/${stepId}`),
  getForJob:     (jobCardId)        => api.get(`/ewi/for-job/${jobCardId}`),
  acknowledge:   (id, data)         => api.post(`/ewi/${id}/acknowledge`, data),
};
