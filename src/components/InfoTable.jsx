import React from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;

/**
 * InfoTable — dark card with a title and rows of label → value pairs.
 * Used for profile details, system info, and any key-value display.
 *
 * Props:
 *  title  — card heading
 *  rows   — array of [label, value] tuples
 */
const InfoTable = ({ title, rows = [] }) => (
  <Card
    title={<span style={{ color: '#374151', fontSize: 14, fontWeight: 600 }}>{title}</span>}
    style={{
      background: '#ffffff',
      border: '1px solid #e8eaed',
      borderRadius: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}
    headStyle={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa', minHeight: 44 }}
    bodyStyle={{ padding: '12px 20px' }}
  >
    {rows.map(([label, value], i) => (
      <div
        key={label ?? i}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '9px 0',
          borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none',
          gap: 8,
        }}
      >
        <Text style={{ color: '#6b7280', fontSize: 13, flexShrink: 0 }}>{label}</Text>
        <Text
          ellipsis
          style={{ color: '#111827', fontSize: 13, fontWeight: 500, textAlign: 'right' }}
        >
          {value ?? '—'}
        </Text>
      </div>
    ))}
  </Card>
);

export default InfoTable;
