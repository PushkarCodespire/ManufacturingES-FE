import api from './axios';

export const stickerTemplateApi = {
  getAll:  (params = {}) => api.get('/sticker-templates', { params }).then((r) => r.data),
  getById: (id)          => api.get(`/sticker-templates/${id}`).then((r) => r.data),
  create:  (data)        => api.post('/sticker-templates', data).then((r) => r.data),
  update:  (id, data)    => api.patch(`/sticker-templates/${id}`, data).then((r) => r.data),
  delete:  (id)          => api.delete(`/sticker-templates/${id}`).then((r) => r.data),
};
