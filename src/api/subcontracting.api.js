import api from './axios';

export const subcontractApi = {
  getAll:   (params) => api.get('/subcontract-challans', { params }),
  getById:  (id)     => api.get(`/subcontract-challans/${id}`),
  create:   (data)   => api.post('/subcontract-challans', data),
  receive:  (id)     => api.patch(`/subcontract-challans/${id}/receive`),
  cancel:   (id)     => api.patch(`/subcontract-challans/${id}/cancel`),
  delete:   (id)     => api.delete(`/subcontract-challans/${id}`),
};
