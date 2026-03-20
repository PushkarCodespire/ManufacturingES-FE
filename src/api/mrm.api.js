import api from './axios';

export const mrmApi = {
  getAll:        (params = {}) => api.get('/mrm/meetings',                { params }).then((r) => r.data),
  getById:       (id)          => api.get(`/mrm/meetings/${id}`).then((r) => r.data),
  create:        (data)        => api.post('/mrm/meetings',               data).then((r) => r.data),
  startMeeting:  (id)          => api.patch(`/mrm/meetings/${id}/start`,  {}).then((r) => r.data),
  draftMinutes:  (id)          => api.patch(`/mrm/meetings/${id}/draft-minutes`, {}).then((r) => r.data),
  sign:          (id)          => api.patch(`/mrm/meetings/${id}/sign`,   {}).then((r) => r.data),
  captureMinute: (id, data)    => api.post(`/mrm/meetings/${id}/capture`, data).then((r) => r.data),
  addAction:     (id, data)    => api.post(`/mrm/meetings/${id}/actions`, data).then((r) => r.data),
  compile:       (quarter)     => api.get(`/mrm/compile/${quarter}`).then((r) => r.data),
  getAllActions:  (params = {}) => api.get('/mrm/actions',                { params }).then((r) => r.data),
  updateAction:  (id, data)    => api.patch(`/mrm/actions/${id}`,        data).then((r) => r.data),
};
