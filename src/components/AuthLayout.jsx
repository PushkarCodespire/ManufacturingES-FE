import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

/**
 * AuthLayout — full-screen light gray centered wrapper for Login and ChangePassword pages.
 * Renders children centered with a footer copyright line.
 */
const AuthLayout = ({ children }) => (
  <div
    style={{
      minHeight: '100vh',
      background: '#f4f6f9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}
  >
    {children}
    <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 28 }}>
      Dynatech Industries © 2026 &nbsp;|&nbsp; IATF 16949 Compliant
    </Text>
  </div>
);

export default AuthLayout;
