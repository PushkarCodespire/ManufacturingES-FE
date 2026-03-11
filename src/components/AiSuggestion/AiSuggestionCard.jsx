import React from 'react';
import { Card, Typography, Button, Spin, Alert, Tag } from 'antd';
import { BulbOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * AiSuggestionCard — dismissible card for showing AI suggestions.
 *
 * Props:
 *  title       — card title (default "Madad AI Suggestion")
 *  loading     — show spinner
 *  error       — error message string
 *  aiAvailable — false hides the card entirely
 *  cached      — show "cached" badge
 *  onDismiss   — callback to hide the card
 *  onRetry     — callback to re-fetch
 *  children    — suggestion content
 *  style       — extra card styles
 */
const AiSuggestionCard = ({
  title = 'Madad AI Suggestion',
  loading = false,
  error = null,
  aiAvailable = true,
  cached = false,
  onDismiss,
  onRetry,
  children,
  style,
}) => {
  if (!aiAvailable) return null;

  return (
    <Card
      size="small"
      style={{
        background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f4f8 100%)',
        border: '1px solid #adc6ff',
        borderRadius: 10,
        ...style,
      }}
      bodyStyle={{ padding: '14px 18px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: loading || error || children ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BulbOutlined style={{ color: '#1677ff', fontSize: 16 }} />
          <Text strong style={{ color: '#1d39c4', fontSize: 13 }}>{title}</Text>
          {cached && <Tag color="geekblue" style={{ margin: 0, fontSize: 10, lineHeight: '18px', height: 18 }}>cached</Tag>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {onRetry && (
            <Button type="text" size="small" icon={<ReloadOutlined />} onClick={onRetry} disabled={loading} />
          )}
          {onDismiss && (
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={onDismiss} />
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <Spin size="small" />
          <Text style={{ color: '#6b7280', fontSize: 12, display: 'block', marginTop: 6 }}>
            Madad soch raha hai...
          </Text>
        </div>
      )}

      {error && !loading && (
        <Alert type="warning" showIcon message={error} style={{ fontSize: 12 }} />
      )}

      {!loading && !error && children}
    </Card>
  );
};

export default AiSuggestionCard;
