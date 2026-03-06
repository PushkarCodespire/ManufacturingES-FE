import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antTheme } from 'antd';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/Login';
import ChangePasswordPage from './pages/ChangePassword';
import DashboardPage from './pages/Dashboard';
import ProfilePage from './pages/Profile';
import ResetPasswordPage from './pages/Admin/ResetPassword';
import EmployeesPage      from './pages/Masters/Employees';
import EmployeeDetailPage from './pages/Masters/Employees/EmployeeDetail';
import ConfigurationPage  from './pages/Masters/Configuration';
import AddSitePage        from './pages/Masters/Configuration/AddSite';
import EditSitePage       from './pages/Masters/Configuration/EditSite';
import ShiftsPage         from './pages/Masters/Shifts';

// Dynatech ONE — Enterprise White Theme (no linear gradients)
const theme = {
  algorithm: antTheme.defaultAlgorithm,
  token: {
    colorPrimary:    '#1d4ed8',
    colorSuccess:    '#16a34a',
    colorWarning:    '#d97706',
    colorError:      '#dc2626',
    colorBgBase:     '#ffffff',
    colorTextBase:   '#111827',
    colorBgLayout:   '#f4f6f9',
    colorBorder:     '#d1d5db',
    borderRadius:    6,
    fontFamily:      "'Inter', 'Segoe UI', Arial, sans-serif",
    boxShadow:       '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
    colorBgContainer:'#ffffff',
  },
  components: {
    Button: {
      colorPrimary:      '#1d4ed8',
      colorPrimaryHover: '#1e40af',
      algorithm: true,
    },
    Menu: {
      colorItemBg:          'transparent',
      colorItemBgSelected:  '#eff6ff',
      colorItemTextSelected:'#1d4ed8',
      colorItemTextHover:   '#1d4ed8',
      colorItemBgHover:     '#f8fafc',
      borderRadius:          6,
    },
    Layout: {
      siderBg:  '#ffffff',
      headerBg: '#ffffff',
      bodyBg:   '#f4f6f9',
      triggerBg:'#f4f6f9',
    },
    Card: {
      colorBgContainer: '#ffffff',
    },
  },
};

function App() {
  return (
    <ConfigProvider theme={theme}>
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <ChangePasswordPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* SYS-003: Admin password reset — IT Admin / Plant Head only */}
              <Route
                path="/admin/reset-password"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']}>
                    <ResetPasswordPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Employees & Access */}
              <Route
                path="/masters/employees"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']}>
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masters/employees/:id"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']}>
                    <EmployeeDetailPage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Configuration (Sites) */}
              <Route
                path="/masters/configuration"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']}>
                    <ConfigurationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masters/configuration/sites/add"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']}>
                    <AddSitePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/masters/configuration/sites/:id"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']}>
                    <EditSitePage />
                  </ProtectedRoute>
                }
              />

              {/* Masters — Shifts & Leaves */}
              <Route
                path="/masters/shifts"
                element={
                  <ProtectedRoute roles={['it_admin', 'plant_head']}>
                    <ShiftsPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
