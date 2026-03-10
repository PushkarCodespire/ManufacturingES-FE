import api from './axios';

export const roleRequirementApi = {
  getAll:          ()       => api.get('/hr/role-requirements').then((r) => r.data),
  getByRole:       (roleId) => api.get(`/hr/role-requirements/role/${roleId}`).then((r) => r.data),
  bulkSaveForRole: (data)   => api.post('/hr/role-requirements/bulk', data).then((r) => r.data),
  delete:          (id)     => api.delete(`/hr/role-requirements/${id}`).then((r) => r.data),
};
