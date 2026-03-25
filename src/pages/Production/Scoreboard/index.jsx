import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Tag, Progress, Typography, Button, Space, Tooltip, message,
} from 'antd';
import {
  FullscreenOutlined, FullscreenExitOutlined, ReloadOutlined, AlertOutlined,
} from '@ant-design/icons';
import AppLayout from '../../../components/AppLayout';
import { scoreboardApi } from '../../../api/production.api';

const { Title, Text } = Typography;

const getMachineColor = (card) => {
  if (card.has_alert) return '#f5222d';
  if (card.achievement_pct === null) return '#8c8c8c';
  if (card.achievement_pct >= 90) return '#52c41a';
  if (card.achievement_pct >= 70) return '#fa8c16';
  return '#f5222d';
};

const getStatusLabel = (card) => {
  if (card.has_alert) return { text: 'ALERT', color: 'red' };
  if (card.machine_status === 'running') return { text: 'RUNNING', color: 'green' };
  return { text: 'IDLE', color: 'default' };
};

export default function ScoreboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await scoreboardApi.get();
      setData(Array.isArray(result) ? result : (result?.data ?? []));
      setLastUpdated(new Date());
    } catch (err) {
      message.error('Failed to load scoreboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh in TV mode every 30s
  useEffect(() => {
    if (!tvMode) return;
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, [tvMode, loadData]);

  const wrapperStyle = tvMode ? {
    background: '#0a0a0a',
    minHeight: '100vh',
    padding: 16,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    overflowY: 'auto',
  } : {};

  return (
    <AppLayout>
    <div className={tvMode ? 'tv-mode' : ''} style={wrapperStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          {!tvMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
              <Text style={{ color: '#d1d5db', fontSize: 10 }}>›</Text>
              <Text style={{ color: '#6b7280', fontSize: 12 }}>Scoreboard</Text>
            </div>
          )}
          <Title level={tvMode ? 2 : 3} style={{ margin: 0, color: tvMode ? '#fff' : undefined }}>
            Production Scoreboard
          </Title>
          {lastUpdated && (
            <Text style={{ fontSize: 11, color: tvMode ? '#aaa' : '#9ca3af' }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={loadData}
            type={tvMode ? 'default' : 'default'}
          >
            {!tvMode && 'Refresh'}
          </Button>
          <Tooltip title={tvMode ? 'Exit TV Mode' : 'TV Mode (auto-refresh 30s)'}>
            <Button
              icon={tvMode ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setTvMode((v) => !v)}
              type={tvMode ? 'primary' : 'default'}
            >
              {!tvMode && 'TV Mode'}
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Grid */}
      <Row gutter={[12, 12]}>
        {data.map((card) => {
          const color = getMachineColor(card);
          const status = getStatusLabel(card);
          return (
            <Col key={card.machine_id} xs={24} sm={12} md={8} lg={6}>
              <Card
                style={{
                  borderRadius: 10,
                  border: `2px solid ${color}`,
                  height: 200,
                  cursor: 'default',
                  background: tvMode ? '#1a1a1a' : '#fff',
                  overflow: 'hidden',
                }}
                styles={{ body: { padding: '12px 14px', height: '100%' } }}
              >
                {/* Machine name + status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <Text strong style={{ fontSize: 14, color: tvMode ? '#fff' : '#111', display: 'block', lineHeight: 1.2 }}>
                      {card.machine_name}
                    </Text>
                    <Text style={{ fontSize: 11, color: tvMode ? '#aaa' : '#6b7280' }}>{card.machine_code}</Text>
                  </div>
                  <Tag color={status.color} style={{ fontSize: 10, margin: 0 }}>
                    {status.text}
                  </Tag>
                </div>

                {/* Work Order */}
                <div style={{ marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: tvMode ? '#aaa' : '#6b7280' }}>
                    {card.active_work_order
                      ? `${card.active_work_order.wo_no} — ${card.active_work_order.item?.name || ''}`
                      : 'No active work order'}
                  </Text>
                </div>

                {/* Qty stats */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <Text style={{ fontSize: 10, color: tvMode ? '#aaa' : '#9ca3af', display: 'block' }}>Produced</Text>
                    <Text strong style={{ fontSize: 18, color: tvMode ? '#fff' : '#111' }}>{card.qty_produced}</Text>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <Text style={{ fontSize: 10, color: tvMode ? '#aaa' : '#9ca3af', display: 'block' }}>Rejected</Text>
                    <Text strong style={{ fontSize: 18, color: '#f5222d' }}>{card.qty_rejected}</Text>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <Text style={{ fontSize: 10, color: tvMode ? '#aaa' : '#9ca3af', display: 'block' }}>Target</Text>
                    <Text strong style={{ fontSize: 18, color: tvMode ? '#fff' : '#111' }}>{card.planned_qty || '—'}</Text>
                  </div>
                </div>

                {/* Progress bar */}
                {card.achievement_pct !== null ? (
                  <Progress
                    percent={card.achievement_pct}
                    size="small"
                    strokeColor={color}
                    trailColor={tvMode ? '#333' : '#f0f0f0'}
                    format={(pct) => <span style={{ color: tvMode ? '#fff' : '#111', fontSize: 11 }}>{pct}%</span>}
                  />
                ) : (
                  <Text style={{ fontSize: 11, color: tvMode ? '#888' : '#9ca3af' }}>No target set</Text>
                )}

                {/* Alert badge */}
                {card.has_alert && (
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertOutlined style={{ color: '#f5222d', fontSize: 11 }} />
                    <Text style={{ fontSize: 10, color: '#f5222d' }}>
                      {card.active_alert?.alert_type?.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
        {!loading && data.length === 0 && (
          <Col span={24}>
            <Text style={{ color: tvMode ? '#aaa' : '#9ca3af' }}>No active machines found.</Text>
          </Col>
        )}
      </Row>
    </div>
    </AppLayout>
  );
}
