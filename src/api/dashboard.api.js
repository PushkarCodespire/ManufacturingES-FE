import api from './axios';

const dashboardApi = {
  getFullDashboard: (params) =>
    api.get('/dashboard/full', { params }).then((r) => r.data),

  getKpis: (params) =>
    api.get('/dashboard/kpis', { params }).then((r) => r.data),

  getRoleStats: (role, params) =>
    api.get(`/dashboard/role-stats/${role}`, { params }).then((r) => r.data),
};

export default dashboardApi;
