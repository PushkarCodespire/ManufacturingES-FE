import React from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;

/**
 * StatCard — metric display card used in role dashboards.
 *
 * Props:
 *  label  — metric name
 *  value  — numeric or string value
 *  unit   — small text below value (optional)
 *  color  — accent color for value + icon bg
 *  icon   — Ant Design icon element (optional)
 */
const StatCard = ({ label, value, unit, color = '#2563eb', icon }) => (
  <Card
    style={{
      background: '#ffffff',
      border: '1px solid #e8eaed',
      borderRadius: 10,
      height: '100%',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}
    bodyStyle={{ padding: '20px 22px' }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <Text style={{ color: '#6b7280', fontSize: 12, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>
          {label}
        </Text>
        <Text
          style={{ color, fontSize: 26, fontWeight: 700, display: 'block', lineHeight: 1 }}
        >
          {value}
        </Text>
        {unit && (
          <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4, display: 'block' }}>
            {unit}
          </Text>
        )}
      </div>

      {icon && (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
    </div>
  </Card>
);

export default StatCard;
