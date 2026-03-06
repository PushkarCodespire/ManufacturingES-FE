import React from 'react';
import { Typography, Tag } from 'antd';

const { Title, Text } = Typography;

/**
 * PageHeader — section header with colored icon box, title, subtitle and tag.
 * Used at the top of every dashboard/module page.
 *
 * Props:
 *  icon      — Ant Design icon element
 *  title     — main heading
 *  subtitle  — secondary text (optional)
 *  tag       — tag label on the right (optional)
 *  color     — accent color for icon background and tag (optional)
 */
const PageHeader = ({ icon, title, subtitle, tag, color = '#1d4ed8' }) => (
  <div
    style={{
      marginBottom: 20,
      padding: '18px 24px',
      background: '#ffffff',
      borderRadius: 10,
      border: '1px solid #e8eaed',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
    }}
  >
    {icon && (
      <div
        style={{
          width: 46,
          height: 46,
          background: color,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    )}

    <div style={{ flex: 1, minWidth: 0 }}>
      <Title level={4} style={{ color: '#111827', margin: 0, fontSize: 17 }}>
        {title}
      </Title>
      {subtitle && (
        <Text style={{ color: '#6b7280', fontSize: 13 }}>{subtitle}</Text>
      )}
    </div>

    {tag && (
      <Tag
        style={{
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 12,
          margin: 0,
          background: `${color}12`,
          border: `1px solid ${color}40`,
          color,
          fontWeight: 500,
        }}
      >
        {tag}
      </Tag>
    )}
  </div>
);

export default PageHeader;
