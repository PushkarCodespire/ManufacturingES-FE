import React from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

/**
 * BrandLogo — brand mark used at the top of auth pages.
 * Displays the CodeSpire Solutions logo image with an optional icon overlay for special screens.
 *
 * Props:
 *  icon     — Optional JSX overlay (e.g. SafetyOutlined for change-password screen).
 *  title    — Heading below the logo. Defaults to "Dynatech ONE".
 *  subtitle — Subtext below heading. Defaults to tagline.
 *  size     — Logo image height in px. Defaults to 48.
 */
const BrandLogo = ({
  icon,
  title = 'Dynatech ONE',
  subtitle = "Operations 'N' Everything",
  size = 48,
}) => (
  <div style={{ textAlign: 'center', marginBottom: 28 }}>
    {/* CodeSpire Solutions logo image */}
    <div style={{ margin: '0 auto 16px', display: 'inline-block', position: 'relative' }}>
      <img
        src="/codespire-logo.png"
        alt="CodeSpire Solutions"
        style={{
          height: size,
          maxWidth: 220,
          objectFit: 'contain',
          display: 'block',
        }}
      />
      {/* Optional icon badge (e.g. for change-password page) */}
      {icon && (
        <div
          style={{
            position: 'absolute',
            bottom: -10,
            right: -10,
            width: 28,
            height: 28,
            background: '#1d4ed8',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: '#fff',
            boxShadow: '0 2px 8px rgba(29,78,216,0.30)',
          }}
        >
          {icon}
        </div>
      )}
    </div>
    <Title level={2} style={{ color: '#111827', margin: 0, fontWeight: 700, fontSize: 22 }}>
      {title}
    </Title>
    {subtitle && (
      <Text style={{ color: '#6b7280', fontSize: 13 }}>{subtitle}</Text>
    )}
  </div>
);

export default BrandLogo;
