import api from './axios';

export const trainingTopicApi = {
  getAll:  (params = {}) => api.get('/hr/training-topics',         { params }).then((r) => r.data),
  create:  (data)        => api.post('/hr/training-topics', data).then((r) => r.data),
  update:  (id, data)    => api.patch(`/hr/training-topics/${id}`, data).then((r) => r.data),
  delete:  (id)          => api.delete(`/hr/training-topics/${id}`).then((r) => r.data),
};
