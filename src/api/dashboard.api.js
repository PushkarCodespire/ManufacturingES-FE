import api from './axios';

const dashboardApi = {
  getKpis: () =>
    api.get('/dashboard/kpis').then((r) => r.data),

  getRoleStats: (role) =>
    api.get(`/dashboard/role-stats/${role}`).then((r) => r.data),
};

export default dashboardApi;
