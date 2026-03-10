import api from './axios';

export const trainingRecordApi = {
  getAll:    (params = {}) => api.get('/hr/training-records',           { params }).then((r) => r.data),
  getMatrix: ()            => api.get('/hr/training-records/matrix').then((r) => r.data),
  create:    (data)        => api.post('/hr/training-records', data).then((r) => r.data),
  update:    (id, data)    => api.patch(`/hr/training-records/${id}`, data).then((r) => r.data),
  delete:    (id)          => api.delete(`/hr/training-records/${id}`).then((r) => r.data),
};
