import React, { useState, useEffect } from 'react';
import { Layout } from 'antd';
import { useLocation } from 'react-router-dom';
import AppHeader       from './AppHeader';
import AppSidebar      from './AppSidebar';
import MadadChatWidget from '../MadadChat/MadadChatWidget';
import useScreen       from '../../hooks/useScreen';

const { Content } = Layout;

const SIDEBAR_W           = 248;
const SIDEBAR_COLLAPSED_W = 64;

/**
 * AppLayout — main authenticated layout shell.
 *
 * Responsive behaviour:
 *   Desktop (≥ 1024 px) : fixed sidebar 248 px, user can collapse to 64 px
 *   Tablet  (768–1023 px): sidebar force-collapsed to 64 px, no manual toggle
 *   Mobile  (< 768 px)  : sidebar hidden, opens as Drawer overlay via hamburger
 *
 * Structure:
 *   ┌──────────────────────────────┐  ← AppHeader  (fixed, 52 px)
 *   │ ☰ Logo    [Help]  🔔        │
 *   ├───────┬──────────────────────┤
 *   │  Nav  │                      │
 *   │ User  │   Page Content       │
 *   │ Panel │                      │
 *   │  ▶◀  │                      │
 *   └───────┴──────────────────────┘
 */
const AppLayout = ({ children }) => {
  const [manualCollapsed,  setManualCollapsed]  = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const { isMobile, isTablet } = useScreen();
  const location = useLocation();

  // ── Collapse logic ────────────────────────────────────────────────────────
  // Tablet: always force-collapsed. Desktop: user toggle. Mobile: N/A (Drawer).
  const collapsed = isMobile ? false : (isTablet ? true : manualCollapsed);

  // ── Sidebar width for content margin ─────────────────────────────────────
  // Mobile: 0 (sidebar is an overlay Drawer, not in-flow)
  const sideWidth = isMobile ? 0 : (collapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_W);

  // ── Close mobile drawer on navigation ────────────────────────────────────
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // ── Sync: when switching from mobile to tablet/desktop, close drawer ──────
  useEffect(() => {
    if (!isMobile) setMobileDrawerOpen(false);
  }, [isMobile]);

  return (
    <Layout style={{ minHeight: '100vh', background: '#f4f6f9' }}>

      {/* Fixed slim top bar — hamburger opens mobile drawer */}
      <AppHeader onMenuOpen={() => setMobileDrawerOpen(true)} />

      {/* Row: sidebar + content — sits below the 52 px header */}
      <Layout style={{ marginTop: 52 }}>

        {/* Sidebar: Sider on desktop/tablet, Drawer overlay on mobile */}
        <AppSidebar
          collapsed={collapsed}
          onCollapse={() => setManualCollapsed((c) => !c)}
          mobileMode={isMobile}
          mobileOpen={mobileDrawerOpen}
          onMobileClose={() => setMobileDrawerOpen(false)}
        />

        {/* Main content — shifts right only when sidebar is in-flow (desktop/tablet) */}
        <Content
          style={{
            marginLeft: sideWidth,
            padding:    isMobile ? '12px' : '20px 24px',
            minHeight:  'calc(100vh - 52px)',
            background: '#f4f6f9',
            transition: 'margin-left 0.2s ease',
            // Prevent horizontal overflow on mobile
            maxWidth:   isMobile ? '100vw' : undefined,
            overflowX:  isMobile ? 'hidden' : undefined,
          }}
        >
          {children}
          <MadadChatWidget />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
