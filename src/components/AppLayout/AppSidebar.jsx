import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout, Menu, Avatar, Typography, Button, Tooltip,
} from 'antd';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  CarOutlined,
  DatabaseOutlined,
  TeamOutlined,
  DollarOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  KeyOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth }        from '../../context/AuthContext';
import usePermissions from '../../hooks/usePermissions';

const { Sider } = Layout;
const { Text }  = Typography;

// Department accent colors
const DEPT_COLORS = {
  10: '#1d4ed8', 11: '#16a34a', 12: '#b45309', 13: '#7c3aed',
  14: '#dc2626', 15: '#0d9488', 16: '#1d4ed8', 17: '#92400e',
};

// ── Navigation definition ──────────────────────────────────────────────────────
// permission  : string → visible if user has this permission key (admins always pass)
// permission  : null   → always visible
// adminOnly   : true   → visible only to plant_head / it_admin (disabled/coming-soon)
//
// Sub-categories under Masters are collapsible SubMenus (dropdowns).
// Add new routes here as pages are built — the sidebar filters automatically.
const NAV_ITEMS_DEF = [
  {
    key:        'dashboard',
    label:      'Dashboard',
    icon:       <AppstoreOutlined />,
    permission: null,             // always show
  },

  // ── Masters ──────────────────────────────────────────────────────────────────
  {
    key:   'masters',
    label: 'Masters',
    icon:  <ControlOutlined />,
    children: [
      // ── Sites (SubMenu) ────────────────────────────
      {
        key:   'grp-sites',
        label: 'Sites',
        children: [
          { key: 'configuration', label: 'Configuration',      permission: 'sites-configuration-read' },
          { key: 'employees',     label: 'Employees & Access', permission: 'sites-employees___access-read' },
          { key: 'shifts',        label: 'Shifts & Leaves',    permission: 'sites-shifts___leaves-read' },
          { key: 'integrations',  label: 'Integrations',       disabled: true, adminOnly: true },
          { key: 'costing',       label: 'Costing',            disabled: true, adminOnly: true },
        ],
      },
      // ── Production (SubMenu) ───────────────────────
      {
        key:   'grp-production',
        label: 'Production',
        children: [
          { key: 'm-machines',         label: 'Machines',            permission: 'production-machines-read' },
          { key: 'm-items',            label: 'Items',               permission: 'production-items-read' },
          { key: 'm-cycle-time',       label: 'Cycle Time Rules',    permission: 'production-items-read' },
          { key: 'm-tools',            label: 'Tools',               disabled: true, adminOnly: true },
          { key: 'm-downtime',         label: 'Downtime',            permission: 'production-downtime-read' },
          { key: 'm-quality',          label: 'Quality',             permission: 'production-quality-read' },
          { key: 'm-production-forms', label: 'Production Forms',    disabled: true, adminOnly: true },
          { key: 'm-set-sampling',     label: 'Set Sampling',        disabled: true, adminOnly: true },
          { key: 'm-ctq',              label: 'Critical To Quality', disabled: true, adminOnly: true },
        ],
      },
      // ── Planning (SubMenu) ─────────────────────────
      {
        key:   'grp-planning',
        label: 'Planning',
        children: [
          { key: 'm-customers',         label: 'Customers',         disabled: true, adminOnly: true },
          { key: 'm-vendors',           label: 'Vendors',           disabled: true, adminOnly: true },
          { key: 'm-sticker-templates', label: 'Sticker Templates', disabled: true, adminOnly: true },
        ],
      },
      // ── Inventory (SubMenu) ────────────────────────
      {
        key:   'grp-inventory',
        label: 'Inventory',
        children: [
          { key: 'm-warehouses',    label: 'Warehouses',    permission: 'inventory-warehouses-read' },
          { key: 'm-packages',      label: 'Packages',      disabled: true, adminOnly: true },
          { key: 'm-custom-fields', label: 'Custom Fields', disabled: true, adminOnly: true },
        ],
      },
      // ── Other (SubMenu) ────────────────────────────
      {
        key:   'grp-other',
        label: 'Other',
        children: [
          { key: 'm-reports',        label: 'Reports',        disabled: true, adminOnly: true },
          { key: 'm-tag-management', label: 'Tag Management', permission: 'other-tag_management-read' },
          { key: 'm-templates',      label: 'Templates',      disabled: true, adminOnly: true },
          { key: 'm-automation',     label: 'Automation',     disabled: true, adminOnly: true },
          { key: 'm-onboarding',     label: 'Onboarding',     disabled: true, adminOnly: true },
        ],
      },
    ],
  },

  // ── Future top-level modules — shown disabled to admins only ────────────────
  { key: 'quality',     label: 'Quality',     icon: <CheckCircleOutlined />,  disabled: true, adminOnly: true },
  { key: 'procurement', label: 'Procurement', icon: <ShoppingCartOutlined />, disabled: true, adminOnly: true },
  { key: 'store',       label: 'Store',       icon: <DatabaseOutlined />,     disabled: true, adminOnly: true },
  { key: 'production',  label: 'Production',  icon: <ToolOutlined />,         disabled: true, adminOnly: true },
  { key: 'dispatch',    label: 'Dispatch',    icon: <CarOutlined />,          disabled: true, adminOnly: true },
  { key: 'accounts',    label: 'Accounts',    icon: <DollarOutlined />,       disabled: true, adminOnly: true },
  { key: 'hr',          label: 'HR',          icon: <TeamOutlined />,         disabled: true, adminOnly: true },
];

// key → route path (for items that navigate)
const KEY_TO_PATH = {
  dashboard:       '/dashboard',
  configuration:   '/masters/configuration',
  employees:       '/masters/employees',
  shifts:          '/masters/shifts',
  'm-machines':    '/masters/production/machines',
  'm-items':       '/masters/production/items',
  'm-cycle-time':  '/masters/production/cycle-time-rules',
  'm-downtime':    '/masters/production/downtime',
  'm-quality':     '/masters/production/quality',
  'm-warehouses':      '/masters/inventory/warehouses',
  'm-tag-management':  '/masters/other/tag-management',
};

// ── Derive selected key + open keys from current pathname ────────────────────
// Both parent SubMenu (masters) AND child SubMenu (grp-sites etc.) are tracked
const getNavState = (pathname) => {
  // Sites sub-group
  if (pathname.startsWith('/masters/employees'))     return { selected: 'employees',     open: ['masters', 'grp-sites'] };
  if (pathname.startsWith('/masters/configuration')) return { selected: 'configuration', open: ['masters', 'grp-sites'] };
  if (pathname.startsWith('/masters/shifts'))        return { selected: 'shifts',        open: ['masters', 'grp-sites'] };
  // Production sub-group
  if (pathname.startsWith('/masters/production/machines')) return { selected: 'm-machines', open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/items'))           return { selected: 'm-items',      open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/cycle-time-rules')) return { selected: 'm-cycle-time', open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/downtime'))        return { selected: 'm-downtime',   open: ['masters', 'grp-production'] };
  if (pathname.startsWith('/masters/production/quality'))        return { selected: 'm-quality',    open: ['masters', 'grp-production'] };
  // Inventory sub-group
  if (pathname.startsWith('/masters/inventory/warehouses')) return { selected: 'm-warehouses', open: ['masters', 'grp-inventory'] };
  // Other sub-group
  if (pathname.startsWith('/masters/other/tag-management')) return { selected: 'm-tag-management', open: ['masters', 'grp-other'] };
  // Generic masters fallback
  if (pathname.startsWith('/masters'))               return { selected: 'masters',       open: ['masters'] };
  return { selected: 'dashboard', open: [] };
};

// ── Strip orphan dividers (leading, trailing, consecutive) ───────────────────
const cleanDividers = (items) =>
  items.filter((item, i, arr) => {
    if (item?.type !== 'divider') return true;
    if (i === 0 || i === arr.length - 1) return false;
    if (arr[i - 1]?.type === 'divider') return false;
    return true;
  });

// ── Component ────────────────────────────────────────────────────────────────
const AppSidebar = ({ collapsed, onCollapse }) => {
  const { user, logout } = useAuth();
  const { can, isAdmin } = usePermissions();
  const navigate         = useNavigate();
  const location         = useLocation();

  const { selected, open: initialOpen } = getNavState(location.pathname);
  const [openKeys, setOpenKeys] = useState(initialOpen);

  // Sync open keys when route changes (e.g. programmatic navigation)
  // Merge required keys so manually-opened sub-groups stay open
  useEffect(() => {
    const { open } = getNavState(location.pathname);
    setOpenKeys((prev) => {
      const merged = new Set([...prev, ...open]);
      return [...merged];
    });
  }, [location.pathname]);

  const deptColor = DEPT_COLORS[user?.department?.code] || '#1d4ed8';
  const initials  = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  // ── Build filtered menu items based on current user's permissions ──────────
  const menuItems = useMemo(() => {
    const resolveItem = (item) => {
      // Pass-through dividers
      if (item.type === 'divider') return item;

      const { key, label, icon, disabled, permission, adminOnly, children, type } = item;

      // Permission-gated leaf
      if (permission) {
        return can(permission) ? { key, label, icon, type } : null;
      }
      // Admin-only disabled item
      if (adminOnly) {
        return isAdmin ? { key, label, icon, disabled: true, type } : null;
      }
      // Has children (SubMenu or Group) — filter recursively
      if (children) {
        const visible = children.map(resolveItem).filter(Boolean);
        if (visible.length === 0) return null;
        // Clean orphan dividers inside this group/submenu
        const cleaned = cleanDividers(visible);
        return cleaned.length > 0 ? { key, label, icon, children: cleaned, type } : null;
      }
      // Unrestricted item
      return { key, label, icon, type };
    };

    return NAV_ITEMS_DEF.map(resolveItem).filter(Boolean);
  }, [can, isAdmin]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleMenuClick = ({ key }) => {
    const path = KEY_TO_PATH[key];
    if (path) navigate(path);
  };

  return (
    <Sider
      width={248}
      collapsedWidth={64}
      collapsed={collapsed}
      style={{
        background:  '#ffffff',
        borderRight: '1px solid #e8eaed',
        position:    'fixed',
        top:         52,
        left:        0,
        bottom:      0,
        zIndex:      100,
        overflow:    'hidden',
        boxShadow:   '2px 0 8px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── COMPACT USER PANEL ──────────────────────────────────────────── */}
        <div
          style={{
            padding:      collapsed ? '12px 0' : '12px 14px',
            borderBottom: '1px solid #f0f0f0',
            flexShrink:   0,
            display:      'flex',
            alignItems:   'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition:   'padding 0.2s ease',
          }}
        >
          {collapsed ? (
            <Tooltip title={user?.name} placement="right">
              <Avatar
                size={32}
                style={{
                  background: deptColor,
                  fontWeight: 700,
                  fontSize:   13,
                  cursor:     'pointer',
                  boxShadow:  `0 2px 6px ${deptColor}30`,
                }}
                onClick={() => navigate('/profile')}
              >
                {initials}
              </Avatar>
            </Tooltip>
          ) : (
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        10,
                cursor:     'pointer',
                width:      '100%',
                minWidth:   0,
              }}
              onClick={() => navigate('/profile')}
            >
              <Avatar
                size={32}
                style={{
                  background: deptColor,
                  fontWeight: 700,
                  fontSize:   13,
                  flexShrink: 0,
                  boxShadow:  `0 2px 6px ${deptColor}30`,
                }}
              >
                {initials}
              </Avatar>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text
                  ellipsis
                  style={{
                    fontSize:   13,
                    fontWeight: 600,
                    color:      '#111827',
                    display:    'block',
                    lineHeight: '18px',
                  }}
                >
                  {user?.name}
                </Text>
                <Text
                  ellipsis
                  style={{
                    fontSize:   11,
                    color:      '#6b7280',
                    display:    'block',
                    lineHeight: '16px',
                  }}
                >
                  {user?.role?.label}
                </Text>
              </div>
            </div>
          )}
        </div>

        {/* ── NAVIGATION MENU ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            inlineIndent={16}
            selectedKeys={[selected]}
            openKeys={collapsed ? [] : openKeys}
            onOpenChange={(keys) => setOpenKeys(keys)}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ border: 'none', background: 'transparent', paddingTop: 4 }}
          />
        </div>

        {/* ── BOTTOM ACTIONS ─────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, borderTop: '1px solid #f0f0f0', padding: '6px 8px' }}>
          {collapsed ? (
            <>
              {isAdmin && (
                <Tooltip title="Reset Password" placement="right">
                  <Button
                    type="text"
                    icon={<KeyOutlined />}
                    style={{ width: '100%', color: '#6b7280', marginBottom: 2 }}
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
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 6, marginTop: 2, display: 'flex', justifyContent: 'center' }}>
                <Tooltip title="Expand sidebar" placement="right">
                  <Button
                    type="text"
                    size="small"
                    icon={<MenuUnfoldOutlined />}
                    onClick={onCollapse}
                    style={{ color: '#9ca3af' }}
                  />
                </Tooltip>
              </div>
            </>
          ) : (
            <>
              {isAdmin && (
                <Button
                  type="text"
                  icon={<KeyOutlined />}
                  block
                  style={{
                    textAlign:      'left',
                    justifyContent: 'flex-start',
                    color:          '#6b7280',
                    fontSize:       12,
                    height:         32,
                    paddingInline:  10,
                    marginBottom:   2,
                    borderRadius:   6,
                    display:        'flex',
                    alignItems:     'center',
                  }}
                  onClick={() => navigate('/admin/reset-password')}
                >
                  Reset Password
                </Button>
              )}
              {/* Sign out + collapse toggle on same row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Button
                  type="text"
                  danger
                  icon={<LogoutOutlined />}
                  size="small"
                  style={{ fontSize: 12, paddingInline: 10, borderRadius: 6 }}
                  onClick={handleLogout}
                >
                  Sign Out
                </Button>
                <Tooltip title="Collapse sidebar" placement="right">
                  <Button
                    type="text"
                    size="small"
                    icon={<MenuFoldOutlined />}
                    onClick={onCollapse}
                    style={{ color: '#9ca3af', borderRadius: 6 }}
                  />
                </Tooltip>
              </div>
            </>
          )}
        </div>

      </div>
    </Sider>
  );
};

export default AppSidebar;
