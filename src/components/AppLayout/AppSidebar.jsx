import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Avatar, Tag, Typography, Button, Tooltip,
} from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  CarOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  TeamOutlined,
  DollarOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  KeyOutlined,
  ControlOutlined,
  UsergroupAddOutlined,
  CalendarOutlined,
  ApiOutlined,
  DollarCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const { Sider } = Layout;
const { Text }  = Typography;

// Department accent colors
const DEPT_COLORS = {
  10: '#1d4ed8', 11: '#16a34a', 12: '#b45309', 13: '#7c3aed',
  14: '#dc2626', 15: '#0d9488', 16: '#1d4ed8', 17: '#92400e',
};

// ── Navigation items ────────────────────────────────────────────────────────
const buildNavItems = () => [
  {
    key:   'dashboard',
    label: 'Dashboard',
    icon:  <AppstoreOutlined />,
  },

  // ── Masters (ADM module — employee & config management) ──────────────────
  {
    key:   'masters',
    label: 'Masters',
    icon:  <ControlOutlined />,
    children: [
      { key: 'configuration', label: 'Configuration',    icon: <SettingOutlined /> },
      { key: 'employees',     label: 'Employees & Access', icon: <UsergroupAddOutlined /> },
      { key: 'shifts',        label: 'Shifts & Leaves',  icon: <CalendarOutlined /> },
      { key: 'integrations',  label: 'Integrations',     icon: <ApiOutlined />,         disabled: true },
      { key: 'costing',       label: 'Costing',          icon: <DollarCircleOutlined />, disabled: true },
    ],
  },

  {
    key:      'quality',
    label:    'Quality',
    icon:     <CheckCircleOutlined />,
    disabled: true,
    children: [
      { key: 'iqc',  label: 'Incoming QC (IQC)'    },
      { key: 'lqc',  label: 'Line QC (LQC)'         },
      { key: 'pqc',  label: 'Pre-Dispatch QC (PQC)' },
      { key: 'oqc',  label: 'Outgoing QC (OQC)'     },
      { key: 'capa', label: 'CAPA'                   },
    ],
  },
  { key: 'procurement', label: 'Procurement', icon: <ShoppingCartOutlined />, disabled: true },
  { key: 'store',       label: 'Store',       icon: <DatabaseOutlined />,    disabled: true },
  { key: 'production',  label: 'Production',  icon: <ToolOutlined />,        disabled: true },
  { key: 'dispatch',    label: 'Dispatch',    icon: <CarOutlined />,         disabled: true },
  { key: 'accounts',    label: 'Accounts',    icon: <DollarOutlined />,      disabled: true },
  { key: 'hr',          label: 'HR',          icon: <TeamOutlined />,        disabled: true },
  { key: 'reports',     label: 'Reports',     icon: <BarChartOutlined />,    disabled: true },
];

// ── Derive selected key + open keys from pathname ────────────────────────────
const getNavState = (pathname) => {
  if (pathname.startsWith('/masters/employees'))     return { selected: 'employees',     open: ['masters'] };
  if (pathname.startsWith('/masters/configuration')) return { selected: 'configuration', open: ['masters'] };
  if (pathname.startsWith('/masters/shifts'))        return { selected: 'shifts',        open: ['masters'] };
  if (pathname.startsWith('/masters'))               return { selected: 'masters',       open: ['masters'] };
  if (pathname.startsWith('/dashboard'))             return { selected: 'dashboard',     open: [] };
  return { selected: 'dashboard', open: [] };
};

/**
 * AppSidebar — collapsible left sidebar.
 *
 * Expanded (220 px):  Avatar + Name + Employee ID + Role tag + Dept | Nav items | My Profile | Sign Out | Collapse btn
 * Collapsed  (64 px): Avatar icon only                              | Nav icons | Icon btns  | Expand btn
 */
const AppSidebar = ({ collapsed, onCollapse }) => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();

  const { selected, open: initialOpen } = getNavState(location.pathname);
  const [openKeys, setOpenKeys] = useState(initialOpen);

  // Sync open keys when route changes
  useEffect(() => {
    const { open } = getNavState(location.pathname);
    setOpenKeys(open);
  }, [location.pathname]);

  const deptColor = DEPT_COLORS[user?.department?.code] || '#1d4ed8';
  const initials  = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleMenuClick = ({ key }) => {
    const routes = {
      dashboard:     '/dashboard',
      employees:     '/masters/employees',
      configuration: '/masters/configuration',
      shifts:        '/masters/shifts',
    };
    if (routes[key]) navigate(routes[key]);
  };

  return (
    <Sider
      width={220}
      collapsedWidth={64}
      collapsed={collapsed}
      style={{
        background:   '#ffffff',
        borderRight:  '1px solid #e8eaed',
        position:     'fixed',
        top:          52,    // sits below the 52px header
        left:         0,
        bottom:       0,
        zIndex:       100,
        overflow:     'hidden',
        boxShadow:    '2px 0 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Full-height flex column ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── USER PANEL ─────────────────────────────────────────────────── */}
        <div
          style={{
            padding:       collapsed ? '16px 0' : '20px 16px 16px',
            borderBottom:  '1px solid #f3f4f6',
            flexShrink:    0,
            display:       'flex',
            flexDirection: 'column',
            alignItems:    collapsed ? 'center' : 'flex-start',
            transition:    'padding 0.2s ease',
          }}
        >
          {/* Avatar — always visible */}
          <Tooltip title={collapsed ? user?.name : ''} placement="right">
            <Avatar
              size={collapsed ? 36 : 46}
              style={{
                background:  deptColor,
                fontWeight:  700,
                fontSize:    collapsed ? 14 : 18,
                cursor:      'pointer',
                flexShrink:  0,
                boxShadow:   `0 2px 8px ${deptColor}40`,
                transition:  'all 0.2s ease',
              }}
              onClick={() => navigate('/profile')}
            >
              {initials}
            </Avatar>
          </Tooltip>

          {/* Expanded: name, employee ID, role tag, dept */}
          {!collapsed && (
            <div style={{ marginTop: 12, width: '100%' }}>
              <Text
                style={{
                  color:         '#111827',
                  fontWeight:    600,
                  fontSize:      13,
                  display:       'block',
                  whiteSpace:    'nowrap',
                  overflow:      'hidden',
                  textOverflow:  'ellipsis',
                }}
              >
                {user?.name}
              </Text>

              <Text style={{ color: '#6b7280', fontSize: 11, display: 'block', marginBottom: 8 }}>
                {user?.employee_id}
              </Text>

              <Tag
                style={{
                  background:  `${deptColor}12`,
                  border:      `1px solid ${deptColor}40`,
                  color:       deptColor,
                  borderRadius: 20,
                  fontSize:    11,
                  padding:     '1px 10px',
                  fontWeight:  500,
                  marginBottom: 4,
                }}
              >
                {user?.role?.label}
              </Tag>

              <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block' }}>
                {user?.department?.name}
              </Text>
            </div>
          )}
        </div>

        {/* ── NAVIGATION MENU ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[selected]}
            openKeys={collapsed ? [] : openKeys}
            onOpenChange={(keys) => setOpenKeys(keys)}
            items={buildNavItems()}
            style={{
              border:     'none',
              background: 'transparent',
              paddingTop: 6,
            }}
            onClick={handleMenuClick}
          />
        </div>

        {/* ── BOTTOM ACTIONS ─────────────────────────────────────────────── */}
        <div
          style={{
            flexShrink:  0,
            borderTop:   '1px solid #f3f4f6',
            padding:     '8px',
          }}
        >
          {collapsed ? (
            /* ── Collapsed: icon-only buttons ── */
            <>
              <Tooltip title="My Profile" placement="right">
                <Button
                  type="text"
                  icon={<UserOutlined />}
                  style={{ width: '100%', color: '#374151', marginBottom: 2 }}
                  onClick={() => navigate('/profile')}
                />
              </Tooltip>
              {['it_admin', 'plant_head'].includes(user?.role?.name) && (
                <Tooltip title="Reset Password (Admin)" placement="right">
                  <Button
                    type="text"
                    icon={<KeyOutlined />}
                    style={{ width: '100%', color: '#dc2626', marginBottom: 2 }}
                    onClick={() => navigate('/admin/reset-password')}
                  />
                </Tooltip>
              )}
              <Tooltip title="Sign Out" placement="right">
                <Button
                  type="text"
                  danger
                  icon={<LogoutOutlined />}
                  style={{ width: '100%', marginBottom: 2 }}
                  onClick={handleLogout}
                />
              </Tooltip>
            </>
          ) : (
            /* ── Expanded: full-text buttons ── */
            <>
              <Button
                type="text"
                icon={<UserOutlined />}
                block
                style={{
                  textAlign:     'left',
                  justifyContent:'flex-start',
                  color:         '#374151',
                  fontWeight:    500,
                  fontSize:      13,
                  height:        36,
                  paddingInline: 12,
                  marginBottom:  2,
                  borderRadius:  6,
                  display:       'flex',
                  alignItems:    'center',
                }}
                onClick={() => navigate('/profile')}
              >
                My Profile
              </Button>

              {['it_admin', 'plant_head'].includes(user?.role?.name) && (
                <Button
                  type="text"
                  icon={<KeyOutlined />}
                  block
                  style={{
                    textAlign:     'left',
                    justifyContent:'flex-start',
                    color:         '#dc2626',
                    fontWeight:    500,
                    fontSize:      13,
                    height:        36,
                    paddingInline: 12,
                    marginBottom:  2,
                    borderRadius:  6,
                    display:       'flex',
                    alignItems:    'center',
                  }}
                  onClick={() => navigate('/admin/reset-password')}
                >
                  Reset Password
                </Button>
              )}

              <Button
                type="text"
                danger
                icon={<LogoutOutlined />}
                block
                style={{
                  textAlign:     'left',
                  justifyContent:'flex-start',
                  fontWeight:    500,
                  fontSize:      13,
                  height:        36,
                  paddingInline: 12,
                  marginBottom:  2,
                  borderRadius:  6,
                  display:       'flex',
                  alignItems:    'center',
                }}
                onClick={handleLogout}
              >
                Sign Out
              </Button>
            </>
          )}

          {/* ── Collapse / Expand toggle ── */}
          <div
            style={{
              borderTop:      '1px solid #f3f4f6',
              paddingTop:     8,
              marginTop:      4,
              display:        'flex',
              justifyContent: collapsed ? 'center' : 'flex-end',
            }}
          >
            <Tooltip
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              placement="right"
            >
              <Button
                type="text"
                size="small"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={onCollapse}
                style={{ color: '#9ca3af', borderRadius: 6 }}
              />
            </Tooltip>
          </div>
        </div>

      </div>
    </Sider>
  );
};

export default AppSidebar;
