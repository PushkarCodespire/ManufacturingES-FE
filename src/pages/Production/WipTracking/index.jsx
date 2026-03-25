import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Row, Col, Tag, Typography, Button, Space, Table,
  Progress, Tooltip, Statistic, Badge, Spin, message, Empty,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, TableOutlined, AppstoreOutlined,
  ClockCircleOutlined, UserOutlined,
} from '@ant-design/icons';
import AppLayout from '../../../components/AppLayout';
import api       from '../../../api/axios';

const { Title, Text } = Typography;

const REFRESH_SECS = 30;

function oeeColor(v) {
  if (v >= 85) return '#16a34a';
  if (v >= 65) return '#ca8a04';
  return '#dc2626';
}

function fmtElapsed(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }
  return `${minutes}m`;
}

function progressColor(pct) {
  if (pct >= 80) return '#16a34a';
  if (pct >= 50) return '#ca8a04';
  return '#dc2626';
}

function MachineCard({ card }) {
  return (
    <Card
      size="small"
      style={{ borderRadius: 10, border: '1px solid #e8eaed', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
      headStyle={{ padding: '8px 12px', minHeight: 38 }}
      bodyStyle={{ padding: '10px 12px' }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 13 }}>{card.machine_name}</Text>
          <Tag color="processing" style={{ margin: 0, fontSize: 11 }}>
            <ClockCircleOutlined style={{ marginRight: 3 }} />{fmtElapsed(card.elapsed_min)}
          </Tag>
        </div>
      }
    >
      {/* Job + WO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 12 }}>{card.job_no}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{card.wo_no}</Text>
      </div>

      {/* Item */}
      <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }} ellipsis>
        <Text style={{ fontWeight: 600, fontSize: 12 }}>{card.item_code}</Text>
        {' — '}
        <Text type="secondary" style={{ fontSize: 11 }}>{card.item_name}</Text>
      </Text>

      {/* Operator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <UserOutlined style={{ fontSize: 11, color: '#9ca3af' }} />
        <Text type="secondary" style={{ fontSize: 11 }}>{card.operator_name}</Text>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontSize: 11 }}>Produced</Text>
          <Text style={{ fontSize: 11, fontWeight: 600 }}>
            {card.qty_produced} / {card.planned_qty > 0 ? card.planned_qty : '—'} pcs
          </Text>
        </div>
        <Progress
          percent={card.progress_pct}
          size="small"
          strokeColor={progressColor(card.progress_pct)}
          format={(p) => `${p}%`}
          style={{ margin: 0 }}
        />
      </div>

      {/* OEE */}
      <div style={{
        background: '#f8fafc', borderRadius: 6, padding: '6px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <Text style={{ fontSize: 10, color: '#9ca3af', display: 'block' }}>OEE</Text>
          <Text style={{ fontSize: 20, fontWeight: 700, color: oeeColor(card.oee), lineHeight: 1.2 }}>
            {card.oee}%
          </Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          {[['A', card.availability], ['P', card.performance], ['Q', card.quality]].map(([k, v]) => (
            <div key={k} style={{ fontSize: 11 }}>
              <Text type="secondary">{k}: </Text>
              <Text style={{ color: oeeColor(v), fontWeight: 600 }}>{v}%</Text>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function WipTrackingPage() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [viewMode,   setViewMode]   = useState('cards'); // 'cards' | 'table'
  const [countdown,  setCountdown]  = useState(REFRESH_SECS);
  const timerRef   = useRef(null);
  const countRef   = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setCountdown(REFRESH_SECS);
    try {
      const res = await api.get('/oee/live');
      setData(res.data);
    } catch (err) {
      message.error(err?.message || 'Failed to load WIP data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current  = setInterval(load, REFRESH_SECS * 1000);
    countRef.current  = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : REFRESH_SECS)), 1000);
    return () => {
      clearInterval(timerRef.current);
      clearInterval(countRef.current);
    };
  }, [load]);

  const live     = data?.live || [];
  const asOf     = data?.as_of ? new Date(data.as_of) : null;
  const rejected = live.reduce((s, c) => s + (c.qty_rejected || 0), 0);
  const produced = live.reduce((s, c) => s + (c.qty_produced || 0), 0);
  const avgOee   = live.length > 0 ? (live.reduce((s, c) => s + c.oee, 0) / live.length).toFixed(1) : '—';

  const tableColumns = [
    { title: 'Machine',   dataIndex: 'machine_name', width: 140 },
    { title: 'Operator',  dataIndex: 'operator_name', width: 130 },
    { title: 'Job No',    dataIndex: 'job_no',        width: 130,
      render: (v) => <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{v}</Text> },
    { title: 'WO No',     dataIndex: 'wo_no',         width: 130 },
    { title: 'Item',      key: 'item',                width: 180,
      render: (_, r) => <><Text strong>{r.item_code}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.item_name}</Text></> },
    { title: 'Produced',  dataIndex: 'qty_produced',  width: 90,  align: 'right' },
    { title: 'Target',    dataIndex: 'planned_qty',   width: 80,  align: 'right' },
    { title: 'Progress',  dataIndex: 'progress_pct',  width: 90,  align: 'center',
      render: (v) => <Tag color={v >= 80 ? 'green' : v >= 50 ? 'gold' : 'red'}>{v}%</Tag> },
    { title: 'Elapsed',   dataIndex: 'elapsed_min',   width: 90,
      render: (v) => fmtElapsed(v) },
    { title: 'OEE %',     dataIndex: 'oee',           width: 80,  align: 'right',
      render: (v) => <Text style={{ color: oeeColor(v), fontWeight: 700 }}>{v}%</Text> },
    { title: 'Avail %',   dataIndex: 'availability',  width: 80,  align: 'right',
      render: (v) => `${v}%` },
    { title: 'Perf %',    dataIndex: 'performance',   width: 80,  align: 'right',
      render: (v) => `${v}%` },
    { title: 'Quality %', dataIndex: 'quality',       width: 90,  align: 'right',
      render: (v) => `${v}%` },
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>WIP Tracking</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Live WIP Tracking</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Real-time view of all active job cards on the shop floor.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tag color="blue">Active: {live.length}</Tag>
        <Tag color="green">Produced: {produced}</Tag>
        {rejected > 0 && <Tag color="red">Rejected: {rejected}</Tag>}
        <Tag color={avgOee !== '—' && parseFloat(avgOee) >= 65 ? 'green' : 'orange'}>
          Avg OEE: {avgOee}{avgOee !== '—' ? '%' : ''}
        </Tag>
        {asOf && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            As of {asOf.toLocaleTimeString()}
          </Text>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Auto-refresh in {countdown}s
        </Text>
        <Button.Group>
          <Button
            icon={<AppstoreOutlined />}
            type={viewMode === 'cards' ? 'primary' : 'default'}
            onClick={() => setViewMode('cards')}
          >Cards</Button>
          <Button
            icon={<TableOutlined />}
            type={viewMode === 'table' ? 'primary' : 'default'}
            onClick={() => setViewMode('table')}
          >Table</Button>
        </Button.Group>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      <Spin spinning={loading && !data}>
        {viewMode === 'cards' ? (
          live.length === 0 ? (
            <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: 40 }}>
              <Empty
                description={
                  <span>
                    <Text type="secondary">No active job cards right now</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>All machines are idle or no jobs have been started</Text>
                  </span>
                }
              />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {live.map((card) => (
                <Col key={card.job_card_id} xs={24} sm={12} md={8} lg={6}>
                  <MachineCard card={card} />
                </Col>
              ))}
            </Row>
          )
        ) : (
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Table
              rowKey="job_card_id"
              columns={tableColumns}
              dataSource={live}
              size="small"
              scroll={{ x: 1200 }}
              pagination={false}
              locale={{ emptyText: 'No active job cards' }}
            />
          </Card>
        )}
      </Spin>
    </AppLayout>
  );
}
