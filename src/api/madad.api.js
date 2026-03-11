import api from './axios';

const madadApi = {
  sendMessage: (data) =>
    api.post('/madad/chat', data).then((r) => r.data),

  getHistory: (params = {}) =>
    api.get('/madad/history', { params }).then((r) => r.data),
};

export default madadApi;
