import React, { useState } from 'react';
import { Layout } from 'antd';
import AppHeader  from './AppHeader';
import AppSidebar from './AppSidebar';

const { Content } = Layout;

const SIDEBAR_W           = 248;
const SIDEBAR_COLLAPSED_W = 64;

/**
 * AppLayout — main authenticated layout shell.
 *
 * Structure:
 *   ┌──────────────────────────────┐  ← AppHeader  (fixed, 52 px)
 *   │ Logo         Help  🔔        │
 *   ├───────┬──────────────────────┤
 *   │  Nav  │                      │
 *   │ User  │   Page Content       │
 *   │ Panel │                      │
 *   │  ▶◀  │                      │
 *   └───────┴──────────────────────┘
 *     AppSidebar  ←→ Content
 *     (fixed, collapsible)
 */
const AppLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const sideWidth = collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W;

  return (
    <Layout style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      {/* Fixed slim top bar */}
      <AppHeader />

      {/* Row: sidebar + content — sits below the 52px header */}
      <Layout style={{ marginTop: 52 }}>
        {/* Fixed left sidebar — position:fixed, so Layout treats it as 0-width */}
        <AppSidebar
          collapsed={collapsed}
          onCollapse={() => setCollapsed((c) => !c)}
        />

        {/* Main content — shifts right to compensate for the fixed sidebar */}
        <Content
          style={{
            marginLeft: sideWidth,
            padding:    '20px 24px',
            minHeight:  'calc(100vh - 52px)',
            background: '#f4f6f9',
            transition: 'margin-left 0.2s ease',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
