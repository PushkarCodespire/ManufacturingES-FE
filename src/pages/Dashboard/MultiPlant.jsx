import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Row, Col, Statistic, Tag, Table, Button,
  message, Spin, Empty, Progress,
} from 'antd';
import {
  RightOutlined, ReloadOutlined, BankOutlined,
  ToolOutlined, WarningOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const { Title, Text } = Typography;

function kpiColor(v, good, bad) {
  if (v >= good) return '#16a34a';
  if (v >= bad) return '#d97706';
  return '#dc2626';
}

export default function MultiPlantDashboard() {
  const navigate = useNavigate();
  const { switchSite } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/multi-plant');
      setData(res?.data ?? res);
    } catch { message.error('Failed to load multi-plant data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const plants = data?.plants || [];
  const totals = data?.totals || {};

  const handlePlantClick = (siteId) => {
    switchSite(siteId);
    navigate('/dashboard');
  };

  const columns = [
    {
      title: 'Plant', key: 'plant', width: 180,
      render: (_, r) => (
        <div>
          <Button type="link" style={{ padding: 0, fontWeight: 700 }} onClick={() => handlePlantClick(r.site_id)}>
            {r.site_name}
          </Button>
          <br /><Text type="secondary" style={{ fontSize: 11 }}>{r.site_code}</Text>
        </div>
      ),
    },
    {
      title: 'Machines', dataIndex: 'machines', width: 90, align: 'center',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Open WOs', dataIndex: 'open_wos', width: 100, align: 'center',
      sorter: (a, b) => a.open_wos - b.open_wos,
      render: (v) => <Text style={{ fontWeight: 700, fontSize: 16 }}>{v}</Text>,
    },
    {
      title: 'Produced (MTD)', dataIndex: 'produced_qty', width: 130, align: 'right',
      sorter: (a, b) => a.produced_qty - b.produced_qty,
      render: (v) => <Text style={{ fontWeight: 600 }}>{v.toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Breakdowns', dataIndex: 'breakdowns', width: 110, align: 'center',
      sorter: (a, b) => a.breakdowns - b.breakdowns,
      render: (v) => v > 0 ? <Tag color="red" icon={<WarningOutlined />}>{v}</Tag> : <Tag color="green">0</Tag>,
    },
    {
      title: 'Open NCRs', dataIndex: 'open_ncrs', width: 100, align: 'center',
      render: (v) => v > 0 ? <Tag color="orange">{v}</Tag> : <Tag color="green">0</Tag>,
    },
    {
      title: '', key: 'action', width: 100,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => handlePlantClick(r.site_id)}>
          View Dashboard <RightOutlined />
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Dashboard</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Multi-Plant</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Multi-Plant Dashboard</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Corporate view across all plants. KPI aggregation and plant-level comparison.
      </Text>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} style={{ float: 'right' }}>Refresh</Button>
      </div>

      <Spin spinning={loading && !data}>
        {/* Totals */}
        <Row gutter={16} style={{ marginBottom: 24, clear: 'both' }}>
          <Col xs={12} sm={6}>
            <Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '14px 16px' }}>
              <Statistic title="Total Plants" value={plants.length} prefix={<BankOutlined />} valueStyle={{ fontSize: 24, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '14px 16px' }}>
              <Statistic title="Open Work Orders" value={totals.open_wos || 0} valueStyle={{ fontSize: 24, fontWeight: 700, color: '#1d4ed8' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '14px 16px' }}>
              <Statistic title="Produced (MTD)" value={totals.produced_qty || 0} suffix="pcs" valueStyle={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '14px 16px' }}>
              <Statistic title="Breakdowns (MTD)" value={totals.breakdowns || 0} valueStyle={{ fontSize: 24, fontWeight: 700, color: totals.breakdowns > 0 ? '#dc2626' : '#16a34a' }} />
            </Card>
          </Col>
        </Row>

        {/* Plant Cards */}
        {plants.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {plants.map((p) => (
              <Col key={p.site_id} xs={24} sm={12} lg={8}>
                <Card
                  hoverable
                  onClick={() => handlePlantClick(p.site_id)}
                  style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                  bodyStyle={{ padding: '16px 20px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <Text strong style={{ fontSize: 16 }}>{p.site_name}</Text>
                      <br /><Text type="secondary" style={{ fontSize: 11 }}>{p.site_code} | {p.machines} machines</Text>
                    </div>
                    <BankOutlined style={{ fontSize: 24, color: '#1d4ed8' }} />
                  </div>
                  <Row gutter={8}>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 10 }}>Open WOs</Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#1d4ed8' }}>{p.open_wos}</div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 10 }}>Produced</Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{p.produced_qty}</div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 10 }}>Breakdowns</Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: p.breakdowns > 0 ? '#dc2626' : '#16a34a' }}>{p.breakdowns}</div>
                      </div>
                    </Col>
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Comparison Table */}
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}>
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>Plant Comparison</Text>
          <Table
            rowKey="site_id"
            dataSource={plants}
            columns={columns}
            size="small"
            pagination={false}
            scroll={{ x: 800 }}
            locale={{ emptyText: <Empty description="No plants configured. Go to Masters → Sites to add plants." /> }}
          />
        </Card>
      </Spin>
    </AppLayout>
  );
}
