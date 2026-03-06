import api from './axios';

export const userApi = {
  /** Paginated / filtered employee list — returns array */
  getAll:         (params = {}) => api.get('/users',             { params }).then((r) => r.data),
  /** Single employee by ID — returns user object */
  getById:        (id)          => api.get(`/users/${id}`).then((r) => r.data),
  /**
   * Create a new employee.
   * Returns the FULL response body: { success, data: user, temp_password, message }
   * so the UI can show the temp password in the success modal.
   */
  create:         (data)        => api.post('/users', data),
  /** Update employee fields and access — returns updated user */
  update:         (id, data)    => api.patch(`/users/${id}`, data).then((r) => r.data),
  /** Toggle active/inactive — returns { is_active } */
  toggleStatus:   (id)          => api.patch(`/users/${id}/toggle`).then((r) => r.data),
  /** All departments (for form dropdowns) — returns array */
  getDepartments: ()            => api.get('/users/departments').then((r) => r.data),
  /** Roles (optionally filtered by department_id) — returns array */
  getRoles:       (params = {}) => api.get('/users/roles', { params }).then((r) => r.data),
  /** All active sites — returns array */
  getSites:       ()            => api.get('/users/sites').then((r) => r.data),
  /** Warehouses (optionally filtered by site_id) — returns array */
  getWarehouses:  (params = {}) => api.get('/users/warehouses', { params }).then((r) => r.data),
  /** Admin reset password */
  resetPassword:  (employee_id) => api.post('/users/reset-password', { employee_id }),
};
