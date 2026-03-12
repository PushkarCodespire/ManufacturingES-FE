import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Tag, Space, Typography, Row, Col, Statistic,
  Progress, Drawer, Descriptions, Divider, message, List,
} from 'antd';
import {
  ReloadOutlined, HeartOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, ToolOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { equipmentHealthApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;

const STATUS_COLOR = {
  operational: 'green', under_maintenance: 'orange',
  breakdown: 'red', decommissioned: 'default',
};

function healthColor(score) {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function healthStatus(score) {
  if (score >= 70) return { label: 'Healthy', color: 'green' };
  if (score >= 40) return { label: 'Warning', color: 'orange' };
  return { label: 'Critical', color: 'red' };
}

export default function HealthDashboardPage() {
  const [dashData, setDashData]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await equipmentHealthApi.getDashboard();
      setDashData(res);
    } catch (err) { message.error(err?.message ?? 'Failed to load health dashboard'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const openDetail = async (equip) => {
    setLoadingDetail(true);
    setDetailDrawer(true);
    try {
      const res = await equipmentHealthApi.getHealthScore(equip.id);
      setSelected(res);
    } catch (err) { message.error(err?.message ?? 'Failed to load health history'); }
    finally { setLoadingDetail(false); }
  };

  const recalculate = async (equipId) => {
    try {
      await equipmentHealthApi.calculateHealthScore(equipId);
      message.success('Health score recalculated');
      loadDashboard();
      if (selected?.equipment?.id === equipId) openDetail({ id: equipId });
    } catch (err) { message.error(err?.message ?? 'Failed to recalculate'); }
  };

  const equipment = dashData?.equipment || [];
  const summary   = dashData?.summary   || {};

  return (
    <AppLayout>
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><HeartOutlined /> Equipment Health Dashboard</Title>
        <Button icon={<ReloadOutlined />} onClick={loadDashboard} loading={loading}>Refresh</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={6}><Card><Statistic title="Total Equipment" value={summary.total || 0} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Healthy (≥70)" value={summary.healthyCount || 0} valueStyle={{ color: '#16a34a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Warning (40–69)" value={summary.warningCount || 0} valueStyle={{ color: '#d97706' }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Critical (<40)" value={summary.criticalCount || 0} valueStyle={{ color: '#dc2626' }} prefix={<ThunderboltOutlined />} /></Card></Col>
      </Row>

      {/* Equipment Health Cards */}
      <Row gutter={[16, 16]}>
        {equipment.map((equip) => {
          const score  = equip.current_health_score ?? 100;
          const status = healthStatus(score);
          const current = equip.CurrentStatus?.current_status || equip.status;
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={equip.id}>
              <Card
                size="small"
                hoverable
                onClick={() => openDetail(equip)}
                style={{ borderLeft: `4px solid ${healthColor(score)}`, cursor: 'pointer' }}
                title={
                  <Space>
                    <Text strong style={{ fontSize: 12 }}>{equip.equipment_code}</Text>
                    <Tag color={status.color}>{status.label}</Tag>
                  </Space>
                }
                extra={<Tag color={STATUS_COLOR[current]} style={{ fontSize: 10 }}>{current?.replace(/_/g, ' ')}</Tag>}
              >
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{equip.name}</Text>
                </div>
                <Progress
                  percent={score}
                  strokeColor={healthColor(score)}
                  size="small"
                  format={(p) => <Text strong style={{ color: healthColor(score) }}>{p}</Text>}
                />
                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11 }} type="secondary">
                    Criticality: <Tag color={equip.criticality === 'A' ? 'red' : equip.criticality === 'B' ? 'orange' : 'blue'} style={{ fontSize: 10 }}>{equip.criticality}</Tag>
                  </Text>
                  <Button
                    type="link"
                    size="small"
                    style={{ fontSize: 11, padding: 0 }}
                    onClick={(e) => { e.stopPropagation(); recalculate(equip.id); }}
                  >
                    Recalc
                  </Button>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Health Detail Drawer */}
      <Drawer
        title="Equipment Health Details"
        width={540}
        open={detailDrawer}
        onClose={() => setDetailDrawer(false)}
        destroyOnClose
      >
        {selected && !loadingDetail && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Equipment" span={2}>
                {selected.equipment?.equipment_code} — {selected.equipment?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLOR[selected.equipment?.status]}>{selected.equipment?.status?.replace(/_/g, ' ').toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Criticality">
                <Tag color={selected.equipment?.criticality === 'A' ? 'red' : 'orange'}>{selected.equipment?.criticality}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Current Score" span={2}>
                <Progress
                  percent={selected.equipment?.current_health_score ?? 100}
                  strokeColor={healthColor(selected.equipment?.current_health_score ?? 100)}
                  style={{ marginTop: 4 }}
                />
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Score History (Last 10)</Title>
            <List
              size="small"
              dataSource={selected.history || []}
              renderItem={(h) => (
                <List.Item>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(h.calculated_at).toLocaleDateString()}
                    </Text>
                    <Progress
                      percent={h.score}
                      strokeColor={healthColor(h.score)}
                      size="small"
                      style={{ width: 200 }}
                    />
                    <Text strong style={{ color: healthColor(h.score), minWidth: 28 }}>{h.score}</Text>
                  </Space>
                </List.Item>
              )}
            />

            <Divider />
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => recalculate(selected.equipment?.id)}
            >
              Recalculate Score
            </Button>
          </>
        )}
      </Drawer>
    </div>
    </AppLayout>
  );
}

