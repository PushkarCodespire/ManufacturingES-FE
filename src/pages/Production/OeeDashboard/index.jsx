import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Table, Tag, Typography, Row, Col, Statistic, Select, DatePicker,
  Space, Button, Drawer, Progress, Tooltip, Spin, message, Tabs, Empty, Badge,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, LineChartOutlined, DashboardOutlined,
  ClockCircleOutlined, UserOutlined,
DownloadOutlined, } from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import api       from '../../../api/axios';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const LIVE_REFRESH_SECS = 30;

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

function OeeBar({ value, label }) {
  return (
    <Tooltip title={`${label}: ${value}%`}>
      <Progress
        percent={value}
        size="small"
        strokeColor={oeeColor(value)}
        format={(p) => `${p}%`}
        style={{ marginBottom: 4 }}
      />
    </Tooltip>
  );
}

// ── Live Machine Card ─────────────────────────────────────────────────────────
function LiveMachineCard({ card }) {
  const progressColor = card.progress_pct >= 80 ? '#16a34a' : card.progress_pct >= 50 ? '#ca8a04' : '#dc2626';
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 12 }}>{card.job_no}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{card.wo_no}</Text>
      </div>

      <div style={{ marginBottom: 4, fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        <Text style={{ fontWeight: 600, fontSize: 12 }}>{card.item_code}</Text>
        {' — '}
        <Text type="secondary" style={{ fontSize: 11 }}>{card.item_name}</Text>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <UserOutlined style={{ fontSize: 11, color: '#9ca3af' }} />
        <Text type="secondary" style={{ fontSize: 11 }}>{card.operator_name}</Text>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontSize: 11 }}>Produced</Text>
          <Text style={{ fontSize: 11, fontWeight: 600 }}>
            {card.qty_produced} / {card.planned_qty > 0 ? card.planned_qty : '—'} pcs
          </Text>
        </div>
        <Progress percent={card.progress_pct} size="small" strokeColor={progressColor} format={(p) => `${p}%`} style={{ margin: 0 }} />
      </div>

      <div style={{
        background: '#f8fafc', borderRadius: 6, padding: '6px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <Text style={{ fontSize: 10, color: '#9ca3af', display: 'block' }}>OEE</Text>
          <Text style={{ fontSize: 20, fontWeight: 700, color: oeeColor(card.oee), lineHeight: 1.2 }}>{card.oee}%</Text>
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

// ── Historical OEE Tab ────────────────────────────────────────────────────────
function HistoricalTab() {
  const [loading,      setLoading]      = useState(false);
  const [data,         setData]         = useState(null);
  const [dateRange,    setDateRange]    = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [detailMachine, setDetailMachine] = useState(null);
  const [detailData,   setDetailData]   = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.date_to   = dateRange[1].format('YYYY-MM-DD');
      const res = await api.get('/oee/dashboard', { params });
      setData(res.data);
    } catch {
      message.error('Failed to load OEE data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  const openMachineDetail = async (machine) => {
    setDetailMachine(machine);
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      const params = {};
      if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.date_to   = dateRange[1].format('YYYY-MM-DD');
      const res = await api.get(`/oee/machine/${machine.machine_id}`, { params });
      setDetailData(res.data);
    } catch {
      message.error('Failed to load machine detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const overall  = data?.overall;
  const machines = data?.machines || [];

  const columns = [
    {
      title: 'Machine', dataIndex: 'machine_name', width: 160,
      render: (v, r) => <Button type="link" style={{ padding: 0 }} onClick={() => openMachineDetail(r)}>{v}</Button>,
    },
    {
      title: 'OEE', dataIndex: 'oee', width: 80, sorter: (a, b) => a.oee - b.oee,
      render: (v) => <Tag color={v >= 85 ? 'green' : v >= 65 ? 'gold' : 'red'} style={{ fontWeight: 600 }}>{v}%</Tag>,
    },
    { title: 'Availability', dataIndex: 'availability', width: 150, render: (v) => <OeeBar value={v} label="Availability" /> },
    { title: 'Performance',  dataIndex: 'performance',  width: 150, render: (v) => <OeeBar value={v} label="Performance" /> },
    { title: 'Quality',      dataIndex: 'quality',      width: 150, render: (v) => <OeeBar value={v} label="Quality" /> },
    { title: 'Sched. Min', dataIndex: 'scheduled_min', align: 'right', width: 100 },
    { title: 'Run Min',    dataIndex: 'run_min',        align: 'right', width: 90 },
    { title: 'Produced',   dataIndex: 'qty_produced',   align: 'right', width: 90 },
    { title: 'Rejected',   dataIndex: 'qty_rejected',   align: 'right', width: 90 },
    { title: 'Job Cards',  dataIndex: 'job_card_count', align: 'right', width: 90 },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <RangePicker value={dateRange} onChange={setDateRange} allowClear={false} style={{ width: 280 }} />
        <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('oee-dashboard.csv', machines, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {overall && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          {[
            { label: 'OEE',           value: overall.oee,           suffix: '%' },
            { label: 'Availability',  value: overall.availability,  suffix: '%' },
            { label: 'Performance',   value: overall.performance,   suffix: '%' },
            { label: 'Quality',       value: overall.quality,       suffix: '%' },
            { label: 'Machines',      value: machines.length                    },
            { label: 'Total Produced',value: overall.qty_produced               },
          ].map(({ label, value, suffix }) => (
            <Col key={label} xs={12} sm={8} md={4}>
              <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
                <Statistic title={label} value={value} suffix={suffix}
                  valueStyle={{ color: suffix ? oeeColor(value) : undefined, fontSize: 20 }} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <DashboardOutlined style={{ marginRight: 8, color: '#1d4ed8' }} />
          <Text strong>Per-Machine OEE</Text>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>Click a machine name to see daily trend</Text>
        </div>
        <Spin spinning={loading}>
          <Table columns={columns} dataSource={machines} rowKey="machine_id" size="small" pagination={false} scroll={{ x: 900 }} />
        </Spin>
      </Card>

      <Drawer title={detailMachine ? `${detailMachine.machine_name} — OEE Trend` : ''} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={700}>
        {detailLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin /></div>
        ) : detailData ? (
          <>
            <Row gutter={12} style={{ marginBottom: 20 }}>
              {['oee', 'availability', 'performance', 'quality'].map((k) => (
                <Col key={k} span={6}>
                  <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                    <Statistic title={k.charAt(0).toUpperCase() + k.slice(1)} value={detailData.overall?.[k]}
                      suffix="%" valueStyle={{ fontSize: 16, color: oeeColor(detailData.overall?.[k] || 0) }} />
                  </Card>
                </Col>
              ))}
            </Row>
            <Text strong style={{ display: 'block', marginBottom: 10 }}>Daily OEE Trend</Text>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={detailData.trend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <ReTooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Line type="monotone" dataKey="oee"          name="OEE"         stroke="#1d4ed8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="availability" name="Availability" stroke="#16a34a" dot={false} />
                <Line type="monotone" dataKey="performance"  name="Performance"  stroke="#ca8a04" dot={false} />
                <Line type="monotone" dataKey="quality"      name="Quality"      stroke="#dc2626" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <Table style={{ marginTop: 16 }} size="small" dataSource={detailData.trend || []} rowKey="date" scroll={{ x: 600 }}
              columns={[
                { title: 'Date',      dataIndex: 'date',         width: 110 },
                { title: 'OEE %',     dataIndex: 'oee',          width: 80, render: (v) => <Tag color={v >= 85 ? 'green' : v >= 65 ? 'gold' : 'red'}>{v}%</Tag> },
                { title: 'Avail %',   dataIndex: 'availability', width: 80, render: (v) => `${v}%` },
                { title: 'Perf %',    dataIndex: 'performance',  width: 80, render: (v) => `${v}%` },
                { title: 'Quality %', dataIndex: 'quality',      width: 80, render: (v) => `${v}%` },
                { title: 'Produced',  dataIndex: 'qty_produced', width: 90 },
              ]} />
          </>
        ) : null}
      </Drawer>
    </>
  );
}

// ── Live Feed Tab ─────────────────────────────────────────────────────────────
function LiveFeedTab() {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(LIVE_REFRESH_SECS);
  const timerRef  = useRef(null);
  const countRef  = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setCountdown(LIVE_REFRESH_SECS);
    try {
      const res = await api.get('/oee/live');
      setData(res.data);
    } catch (err) {
      message.error(err?.message || 'Failed to load live data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, LIVE_REFRESH_SECS * 1000);
    countRef.current = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : LIVE_REFRESH_SECS)), 1000);
    return () => {
      clearInterval(timerRef.current);
      clearInterval(countRef.current);
    };
  }, [load]);

  const live     = data?.live || [];
  const asOf     = data?.as_of ? new Date(data.as_of) : null;
  const produced = live.reduce((s, c) => s + (c.qty_produced || 0), 0);
  const avgOee   = live.length > 0 ? (live.reduce((s, c) => s + c.oee, 0) / live.length).toFixed(1) : null;

  return (
    <>
      {/* Status bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tag color="blue">Active: {live.length}</Tag>
        <Tag color="green">Produced: {produced}</Tag>
        {avgOee !== null && (
          <Tag color={parseFloat(avgOee) >= 65 ? 'green' : 'orange'}>Avg OEE: {avgOee}%</Tag>
        )}
        {asOf && <Text type="secondary" style={{ fontSize: 11 }}>As of {asOf.toLocaleTimeString()}</Text>}
        <div style={{ flex: 1 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>Auto-refresh in {countdown}s</Text>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      <Spin spinning={loading && !data}>
        {live.length === 0 ? (
          <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: 40 }}>
            <Empty description={
              <span>
                <Text type="secondary">No active job cards right now</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>All machines are idle or no jobs have been started</Text>
              </span>
            } />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {live.map((card) => (
              <Col key={card.job_card_id} xs={24} sm={12} md={8}>
                <LiveMachineCard card={card} />
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OeeDashboardPage() {
  const [activeTab, setActiveTab] = useState('historical');

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>OEE Dashboard</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>OEE Dashboard</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Overall Equipment Effectiveness — Availability × Performance × Quality
      </Text>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'historical',
            label: <span><LineChartOutlined /> Historical</span>,
            children: <HistoricalTab />,
          },
          {
            key: 'live',
            label: (
              <span>
                <Badge status="processing" style={{ marginRight: 6 }} />
                Live Feed
              </span>
            ),
            children: <LiveFeedTab />,
          },
        ]}
      />
    </AppLayout>
  );
}
