import api from './axios';

export const authApi = {
  login:          (data) => api.post('/auth/login',           data), // SYS-001
  refresh:        (data) => api.post('/auth/refresh',         data), // SYS-004
  changePassword: (data) => api.post('/auth/change-password', data), // SYS-002
  resetPassword:  (data) => api.post('/auth/reset-password',  data), // SYS-003 (IT Admin / Plant Head)
  getMe:          ()     => api.get ('/auth/me'),
  logout:         (data) => api.post('/auth/logout',          data),
  register:       (data) => api.post('/auth/register',        data),
};
