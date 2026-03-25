import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Table, Tag, Space, Tooltip,
  Row, Col, Statistic, Progress, Collapse, Badge, message,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, WarningOutlined,
  CheckCircleOutlined, FireOutlined,
} from '@ant-design/icons';
import AppLayout        from '../../../components/AppLayout';
import { jobCardApi }  from '../../../api/production.api';

const { Title, Text } = Typography;

const TYPE_COLOR = {
  machining:  'blue',
  assembly:   'green',
  welding:    'orange',
  inspection: 'purple',
  painting:   'cyan',
  other:      'default',
};

function loadColor(pct) {
  if (pct > 100) return '#dc2626'; // overloaded — red
  if (pct > 80)  return '#d97706'; // high load — amber
  if (pct > 50)  return '#2563eb'; // moderate — blue
  return '#16a34a';                // comfortable — green
}

function fmtMin(min) {
  if (min == null || min === 0) return '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function CapacityPlanningPage() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await jobCardApi.getCapacityPlan();
      setData(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) {
      message.error(err?.message || 'Failed to load capacity plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const overloaded = data.filter((d) => d.overloaded).length;
  const highLoad   = data.filter((d) => d.load_pct > 80 && !d.overloaded).length;
  const healthy    = data.filter((d) => d.load_pct <= 80).length;
  const totalLoad  = data.reduce((s, d) => s + d.total_load_min, 0);

  // Sub-table: job cards per work center
  const jcColumns = [
    { title: 'Job No',        dataIndex: 'job_no',         key: 'job_no',         width: 130 },
    { title: 'Work Order',    dataIndex: 'wo_no',          key: 'wo_no',          width: 130 },
    { title: 'Operation',     dataIndex: 'operation_name', key: 'operation_name', width: 160 },
    {
      title: 'Remaining Qty', dataIndex: 'remaining_qty', key: 'remaining_qty', width: 110, align: 'right',
      render: (v) => parseFloat(v || 0).toLocaleString(),
    },
    {
      title: 'Cycle Time', dataIndex: 'cycle_time_min', key: 'cycle_time_min', width: 100, align: 'right',
      render: (v) => v > 0 ? `${parseFloat(v).toFixed(1)} min/pc` : '—',
    },
    {
      title: 'Load (min)', dataIndex: 'load_min', key: 'load_min', width: 100, align: 'right',
      render: (v) => <Text style={{ fontWeight: 500 }}>{fmtMin(Math.round(v))}</Text>,
    },
  ];

  const mainColumns = [
    {
      title: 'Work Center', key: 'wc', width: 200,
      render: (_, r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {r.overloaded && <WarningOutlined style={{ color: '#dc2626', fontSize: 13 }} />}
            <Text style={{ fontWeight: 600, fontSize: 13 }}>{r.work_center_name}</Text>
          </div>
          <Tag color={TYPE_COLOR[r.work_center_type] || 'default'} style={{ fontSize: 10, marginTop: 2 }}>
            {r.work_center_type}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Active Jobs', key: 'jobs', width: 90, align: 'center',
      render: (_, r) => (
        <Badge count={r.job_cards.length} style={{ backgroundColor: r.overloaded ? '#dc2626' : '#1d4ed8' }} />
      ),
    },
    {
      title: 'Total Load', key: 'load', width: 110, align: 'right',
      render: (_, r) => <Text style={{ fontWeight: 500, color: loadColor(r.load_pct) }}>{fmtMin(r.total_load_min)}</Text>,
    },
    {
      title: 'Shift Cap (8h)', key: 'cap', width: 110, align: 'right',
      render: (_, r) => <Text type="secondary">{fmtMin(r.shift_capacity_min)}</Text>,
    },
    {
      title: 'Load %', key: 'load_pct', width: 200,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Progress
            percent={Math.min(r.load_pct, 150)}
            strokeColor={loadColor(r.load_pct)}
            trailColor="#e5e7eb"
            size="small"
            style={{ flex: 1, margin: 0 }}
            showInfo={false}
          />
          <Text style={{ fontSize: 12, fontWeight: 600, color: loadColor(r.load_pct), minWidth: 44 }}>
            {r.load_pct}%
          </Text>
          {r.overloaded && <Tag color="error" style={{ fontSize: 10 }}>Overloaded</Tag>}
          {!r.overloaded && r.load_pct > 80 && <Tag color="warning" style={{ fontSize: 10 }}>High</Tag>}
          {r.load_pct <= 80 && <Tag color="success" style={{ fontSize: 10 }}>OK</Tag>}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Capacity Planning</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Capacity Planning</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Work-center load based on open job cards and routing cycle times. Updated in real time.
      </Text>

      {/* Summary tiles */}
      <Row gutter={12} style={{ marginTop: 16, marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e8eaed' }}>
            <Statistic
              title="Total Load"
              value={fmtMin(Math.round(totalLoad))}
              valueStyle={{ fontSize: 20, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #fecaca', background: '#fff5f5' }}>
            <Statistic
              title={<Space><FireOutlined style={{ color: '#dc2626' }} />Overloaded</Space>}
              value={overloaded}
              suffix="centers"
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #fde68a', background: '#fffbeb' }}>
            <Statistic
              title={<Space><WarningOutlined style={{ color: '#d97706' }} />High Load (&gt;80%)</Space>}
              value={highLoad}
              suffix="centers"
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
            <Statistic
              title={<Space><CheckCircleOutlined style={{ color: '#16a34a' }} />Healthy (&le;80%)</Space>}
              value={healthy}
              suffix="centers"
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        </div>

        {data.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            <CheckCircleOutlined style={{ fontSize: 32, marginBottom: 8 }} />
            <div>No open routing-based job cards found.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Generate job cards from a released Work Order to see capacity load.</div>
          </div>
        ) : (
          <Table
            rowKey="work_center_id"
            loading={loading}
            columns={mainColumns}
            dataSource={data}
            size="small"
            pagination={false}
            scroll={{ x: 800 }}
            expandable={{
              expandedRowRender: (record) => (
                <div style={{ margin: '0 0 12px 40px' }}>
                  <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 8 }}>
                    Open Job Cards at {record.work_center_name}
                  </Text>
                  <Table
                    rowKey="job_no"
                    columns={jcColumns}
                    dataSource={record.job_cards}
                    size="small"
                    pagination={false}
                    scroll={{ x: 800 }}
                    style={{ border: '1px solid #e8eaed', borderRadius: 8 }}
                  />
                </div>
              ),
              rowExpandable: (r) => r.job_cards && r.job_cards.length > 0,
            }}
            rowClassName={(r) => r.overloaded ? 'ant-table-row-danger' : ''}
          />
        )}
      </Card>

      <style>{`
        .ant-table-row-danger > td { background: #fff5f5 !important; }
        .ant-table-row-danger:hover > td { background: #fee2e2 !important; }
      `}</style>
    </AppLayout>
  );
}
