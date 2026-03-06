import api from './axios';

export const notificationApi = {
  /** Paginated list of my notifications */
  getAll:       (params = {}) => api.get('/notifications',           { params }).then((r) => r.data),
  /** Bell badge count */
  getUnread:    ()             => api.get('/notifications/unread-count').then((r) => r.data),
  /** Mark one as read */
  markRead:     (id)           => api.patch(`/notifications/${id}/read`),
  /** Mark all as read */
  markAllRead:  ()             => api.patch('/notifications/read-all'),
};
