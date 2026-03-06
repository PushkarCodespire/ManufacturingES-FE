import React from 'react';
import { Layout, Button, Space, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import NotificationPanel from './NotificationPanel';

const { Header } = Layout;
const { Text }   = Typography;

/**
 * AppHeader — slim fixed top bar.
 * Contains: CodeSpire logo + "Dynatech ONE" tagline (left) | Help + Bell (right).
 * User details and navigation live in AppSidebar.
 * Bell opens the live NotificationPanel drawer (SYS-007).
 */
const AppHeader = () => {
  const navigate = useNavigate();

  return (
    <Header
      style={{
        background:     '#ffffff',
        borderBottom:   '1px solid #e8eaed',
        padding:        '0 20px',
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
      {/* ── Left: Logo + App name ─────────────────────────────────────── */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        onClick={() => navigate('/dashboard')}
      >
        <img
          src="/codespire-logo.png"
          alt="CodeSpire Solutions"
          style={{ height: 28, objectFit: 'contain' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <Text style={{ color: '#111827', fontWeight: 700, fontSize: 14 }}>
            Dynatech ONE
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 10, letterSpacing: '0.02em' }}>
            Operations 'N' Everything
          </Text>
        </div>
      </div>

      {/* ── Right: Help + Live Notification Bell ─────────────────────── */}
      <Space size={6}>
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

        {/* SYS-007: Live bell — real unread count, opens notification drawer */}
        <NotificationPanel />
      </Space>
    </Header>
  );
};

export default AppHeader;
