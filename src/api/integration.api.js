import api from './axios';

export const integrationApi = {
  // Returns the integrations array directly
  getAll:    ()         => api.get('/integrations').then((r) => r.data),

  // Returns a single integration object
  getById:   (id)       => api.get(`/integrations/${id}`).then((r) => r.data),

  // Returns the updated integration object
  update:    (id, data) => api.patch(`/integrations/${id}`, data).then((r) => r.data),

  // Returns full { success, message, data } — callers need success + message
  test:      (id)       => api.post(`/integrations/${id}/test`),

  // Returns logs array for a specific integration
  getLogs:   (id)       => api.get(`/integrations/${id}/logs`).then((r) => r.data),

  // Returns logs array across all integrations
  getAllLogs: ()         => api.get('/integrations/logs').then((r) => r.data),
};
