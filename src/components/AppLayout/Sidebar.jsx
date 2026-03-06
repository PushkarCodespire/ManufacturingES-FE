import React from 'react';
import { Layout, Menu, Avatar, Tag, Button, Typography, Tooltip } from 'antd';
import { DashboardOutlined, PoweroffOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const { Sider } = Layout;
const { Text } = Typography;

// Department accent colors — matches Dept codes 10–17 (visible on white bg)
const DEPT_COLORS = {
  10: '#1d4ed8', 11: '#16a34a', 12: '#b45309', 13: '#7c3aed',
  14: '#dc2626', 15: '#0d9488', 16: '#1d4ed8', 17: '#92400e',
};

// Navigation items — grows as modules are built sprint by sprint
const MENU_ITEMS = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
];

/**
 * Sidebar — fixed left navigation panel with logo, user chip, nav menu and logout.
 *
 * Props:
 *  collapsed   — boolean
 *  onCollapse  — setter function
 */
const Sidebar = ({ collapsed, onCollapse }) => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const deptColor        = DEPT_COLORS[user?.department?.code] || '#1d4ed8';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      width={240}
      collapsedWidth={64}
      style={{
        background: '#ffffff',
        borderRight: '1px solid #e8eaed',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 100,
        overflow: 'auto',
        boxShadow: '1px 0 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Logo ────────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 14px' : '0 16px',
          borderBottom: '1px solid #f3f4f6',
          gap: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            background: '#1d4ed8',
            border: '2px solid #3b82f6',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>D</span>
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <Text
              style={{
                color: '#111827',
                fontWeight: 700,
                fontSize: 14,
                display: 'block',
                lineHeight: 1.3,
              }}
            >
              Dynatech ONE
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 10 }}>Operations 'N' Everything</Text>
          </div>
        )}
      </div>

      {/* ── User Chip ────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar size={34} style={{ background: deptColor, flexShrink: 0, fontWeight: 700 }}>
              {user?.name?.charAt(0)}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <Text
                ellipsis
                style={{ color: '#111827', fontSize: 13, fontWeight: 600, display: 'block' }}
              >
                {user?.name}
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 11 }}>{user?.employee_id}</Text>
            </div>
          </div>
          <Tag
            style={{
              marginTop: 10,
              fontSize: 11,
              borderRadius: 4,
              background: `${deptColor}12`,
              border: `1px solid ${deptColor}40`,
              color: deptColor,
              fontWeight: 500,
            }}
          >
            {user?.role?.label}
          </Tag>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <Menu
        mode="inline"
        defaultSelectedKeys={['dashboard']}
        theme="light"
        style={{ background: 'transparent', border: 'none', padding: '8px' }}
        items={MENU_ITEMS}
      />

      {/* ── Logout ───────────────────────────────────────────────────────── */}
      <div
        style={{ position: 'absolute', bottom: 16, left: 0, right: 0, padding: '0 8px' }}
      >
        <Tooltip title={collapsed ? 'Logout' : ''} placement="right">
          <Button
            type="text"
            icon={<PoweroffOutlined />}
            onClick={handleLogout}
            danger
            block
            style={{
              textAlign: collapsed ? 'center' : 'left',
              height: 38,
            }}
          >
            {!collapsed && 'Logout'}
          </Button>
        </Tooltip>
      </div>
    </Sider>
  );
};

export default Sidebar;
