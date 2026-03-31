import React from 'react';
import { Layout, Button, Space, Typography, Grid, Select } from 'antd';
import { QuestionCircleOutlined, MenuOutlined, BankOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import NotificationPanel from './NotificationPanel';
import GlobalSearch from './GlobalSearch';
import { useAuth } from '../../context/AuthContext';

const { Header }       = Layout;
const { Text }         = Typography;
const { useBreakpoint } = Grid;

/**
 * AppHeader — slim fixed top bar.
 *
 * On mobile (< 768 px):
 *   - Hamburger ☰ button opens the mobile sidebar Drawer (calls onMenuOpen)
 *   - App name tagline hidden to save space
 *   - Help button hidden (saves width)
 *
 * Props:
 *   onMenuOpen {function} — called when the hamburger icon is tapped
 */
const AppHeader = ({ onMenuOpen }) => {
  const navigate  = useNavigate();
  const bp        = useBreakpoint();
  const isMobile  = !bp.md;
  const { user, currentSiteId, switchSite } = useAuth();
  const sites = user?.sites || [];

  return (
    <Header
      data-print="hide"
      style={{
        background:     '#ffffff',
        borderBottom:   '1px solid #e8eaed',
        padding:        isMobile ? '0 12px' : '0 20px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        position:       'fixed',
        top:    0,
        left:   0,
        right:  0,
        zIndex: 200,
        height: 52,
        lineHeight: '52px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      {/* ── Left: Hamburger (mobile only) + Logo ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10 }}>

        {/* Hamburger — only visible on mobile */}
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 18 }} />}
            onClick={onMenuOpen}
            style={{ color: '#374151', padding: '0 4px', height: 36, display: 'flex', alignItems: 'center' }}
          />
        )}

        {/* Logo + app name */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          <img
            src="/codespire-logo.png"
            alt="CodeSpire Solutions"
            style={{ height: 28, objectFit: 'contain' }}
          />
          {/* App name — hidden on mobile to save header space */}
          {!isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <Text style={{ color: '#111827', fontWeight: 700, fontSize: 14 }}>
                Dynatech ONE
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 10, letterSpacing: '0.02em' }}>
                Operations 'N' Everything
              </Text>
            </div>
          )}
        </div>
      </div>

      {/* ── Centre: Global Search (desktop only) ──────────────────────── */}
      {!isMobile && <GlobalSearch />}

      {/* ── Right: Site switcher + Help + Live Notification Bell ─────── */}
      <Space size={6}>
        {/* Site/Plant switcher */}
        {!isMobile && sites.length > 0 && (
          <Select
            value={currentSiteId}
            onChange={switchSite}
            placeholder="All Plants"
            allowClear
            size="small"
            suffixIcon={<BankOutlined />}
            style={{ width: 160, fontSize: 12 }}
            options={[
              ...sites.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        )}
        {/* Help button — hidden on mobile */}
        {!isMobile && (
          <Button
            type="primary"
            size="small"
            icon={<QuestionCircleOutlined />}
            style={{
              background:    '#2563eb',
              borderColor:   '#2563eb',
              borderRadius:  20,
              fontSize:      12,
              height:        28,
              paddingInline: 10,
            }}
          >
            Help
          </Button>
        )}

        {/* SYS-007: Live bell — always visible */}
        <NotificationPanel />
      </Space>
    </Header>
  );
};

export default AppHeader;
