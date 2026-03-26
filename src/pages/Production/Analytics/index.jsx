import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Select, Button, Tag, Table, Spin,
  message, Statistic, Progress, Tooltip,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, BarChartOutlined, LineChartOutlined,
  RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import AppLayout       from '../../../components/AppLayout';
import api             from '../../../api/axios';

const { Title, Text } = Typography;

const RANGE_OPTIONS = [
  { value: '7d',   label: 'Last 7 Days' },
  { value: '30d',  label: 'Last 30 Days' },
  { value: '90d',  label: 'Last 90 Days' },
  { value: '180d', label: 'Last 180 Days' },
];

const MACHINE_COLORS = ['#1d4ed8','#16a34a','#b45309','#7c3aed','#dc2626','#0d9488','#92400e','#374151'];

function fmtNum(v) {
  if (v == null) return '—';
  return parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

function shortDay(dateStr) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function ProductionAnalyticsPage() {
  const [range,       setRange]       = useState('30d');
  const [loading,     setLoading]     = useState(false);
  const [summary,     setSummary]     = useState(null);
  const [woTrend,     setWoTrend]     = useState([]);
  const [rejTrend,    setRejTrend]    = useState([]);
  const [machines,    setMachines]    = useState([]);
  const [topItems,    setTopItems]    = useState([]);

  const load = useCallback(async (r = range) => {
    setLoading(true);
    try {
      const [s, wo, rej, mach, items] = await Promise.all([
        api.get(`/production-analytics/summary?range=${r}`),
        api.get(`/production-analytics/wo-trend?range=${r}`),
        api.get(`/production-analytics/rejection-trend?range=${r}`),
        api.get(`/production-analytics/machine-utilization?range=${r}`),
        api.get(`/production-analytics/top-items?range=${r}&limit=10`),
      ]);
      setSummary(s.data || null);
      setWoTrend((wo.data || []).map(d => ({ ...d, day: shortDay(d.day) })));
      setRejTrend((rej.data || []).map(d => ({ ...d, day: shortDay(d.day) })));
      setMachines(mach.data || []);
      setTopItems(items.data || []);
    } catch {
      message.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const handleRangeChange = (v) => { setRange(v); load(v); };

  // ── Summary tile ──────────────────────────────────────────────────────────
  const sumTiles = summary ? [
    { label: 'Work Orders',         value: summary.total_work_orders,     color: '#1d4ed8', suffix: '' },
    { label: 'Completion Rate',      value: summary.completion_rate,       color: '#16a34a', suffix: '%', progress: true },
    { label: 'Total Produced',       value: fmtNum(summary.total_produced), color: '#7c3aed', suffix: ' pcs' },
    { label: 'Rejection Rate',       value: summary.rejection_rate,        color: summary.rejection_rate > 5 ? '#dc2626' : '#ca8a04', suffix: '%', progress: true },
    { label: 'Scrap Cost',           value: `₹${fmtNum(summary.scrap_cost)}`, color: '#b45309', suffix: '' },
    { label: 'Total Job Cards',      value: summary.total_job_cards,       color: '#0d9488', suffix: '' },
  ] : [];

  // ── Machine utilization columns ───────────────────────────────────────────
  const machCols = [
    { title: 'Machine',        dataIndex: 'machine_name', key: 'name', ellipsis: true },
    { title: 'Jobs',           dataIndex: 'job_count',    key: 'jobs',   width: 70, align: 'center' },
    { title: 'Utilization',    dataIndex: 'utilization_pct', key: 'util', width: 160,
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress percent={v} size="small" showInfo={false}
            strokeColor={v >= 75 ? '#16a34a' : v >= 50 ? '#ca8a04' : '#dc2626'}
            style={{ flex: 1, margin: 0 }} />
          <Text style={{ fontSize: 12, width: 38, textAlign: 'right' }}>{v}%</Text>
        </div>
      ),
    },
    { title: 'Produced',       dataIndex: 'qty_produced',    key: 'prod',  width: 90, align: 'right', render: fmtNum },
    { title: 'Rejected',       dataIndex: 'qty_rejected',    key: 'rej',   width: 80, align: 'right', render: fmtNum },
    { title: 'Rejection %',    dataIndex: 'rejection_pct',   key: 'rpct',  width: 100, align: 'center',
      render: (v) => <Tag color={v > 5 ? 'red' : v > 2 ? 'orange' : 'green'}>{v}%</Tag> },
  ];

  // ── Top items columns ─────────────────────────────────────────────────────
  const itemCols = [
    { title: '#', key: 'rank', width: 40, render: (_, __, i) => <Text type="secondary">{i + 1}</Text> },
    { title: 'Item',       dataIndex: 'item_name', key: 'name', ellipsis: true,
      render: (v, r) => <div><div style={{ fontWeight: 500 }}>{v}</div><Text type="secondary" style={{ fontSize: 11 }}>{r.item_code}</Text></div> },
    { title: 'Produced',   dataIndex: 'qty_produced',  key: 'prod',   width: 90,  align: 'right', render: fmtNum },
    { title: 'Rejected',   dataIndex: 'qty_rejected',  key: 'rej',    width: 80,  align: 'right', render: fmtNum },
    { title: 'Rej %',      dataIndex: 'rejection_pct', key: 'rpct',   width: 80,  align: 'center',
      render: (v) => <Tag color={v > 5 ? 'red' : v > 2 ? 'orange' : 'green'}>{v}%</Tag> },
  ];

  return (
    <AppLayout>
      <div style={{ padding: '0 0 24px' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Analytics</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <Title level={3} style={{ margin: 0 }}>Production Analytics</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Historical trends for work orders, output, rejection, and machine utilization.
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select
              value={range}
              onChange={handleRangeChange}
              options={RANGE_OPTIONS}
              style={{ width: 150 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Spin spinning={loading}>
          {/* ── Summary Tiles ── */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {sumTiles.map((t) => (
              <Col xs={12} sm={8} md={4} key={t.label}>
                <Card
                  size="small"
                  style={{ borderTop: `3px solid ${t.color}`, borderRadius: 10, height: '100%',
                           boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                  bodyStyle={{ padding: '12px 14px' }}
                >
                  <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600,
                                 textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                    {t.label}
                  </Text>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginTop: 4, lineHeight: 1.2 }}>
                    {t.value}{typeof t.value === 'number' && t.suffix ? <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{t.suffix}</span> : null}
                  </div>
                  {t.progress && typeof t.value === 'number' && (
                    <Progress percent={parseFloat(t.value)} showInfo={false}
                      strokeColor={t.color} trailColor="#f3f4f6" size="small" style={{ marginTop: 6 }} />
                  )}
                </Card>
              </Col>
            ))}
          </Row>

          {/* ── Trend Charts ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {/* WO Completion Trend */}
            <Col xs={24} lg={12}>
              <Card
                title={<span><BarChartOutlined style={{ marginRight: 8, color: '#1d4ed8' }} />Work Order Completions</span>}
                style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                bodyStyle={{ padding: '12px 16px' }}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={woTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ReTooltip
                      formatter={(v, name) => [fmtNum(v), name === 'count' ? 'WOs Completed' : name === 'qty_produced' ? 'Qty Produced' : 'Qty Planned']}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="count"       name="WOs"         fill="#1d4ed8" radius={[3,3,0,0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* Rejection Trend */}
            <Col xs={24} lg={12}>
              <Card
                title={<span><LineChartOutlined style={{ marginRight: 8, color: '#dc2626' }} />Daily Rejection Rate</span>}
                style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                bodyStyle={{ padding: '12px 16px' }}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={rejTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} unit="%" />
                    <ReTooltip formatter={(v) => [`${v}%`, 'Rejection Rate']} />
                    <Line dataKey="rejection_pct" name="Rejection %" stroke="#dc2626"
                          dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* Output Trend */}
            <Col xs={24} lg={12}>
              <Card
                title={<span><RiseOutlined style={{ marginRight: 8, color: '#16a34a' }} />Daily Output (Qty Produced)</span>}
                style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                bodyStyle={{ padding: '12px 16px' }}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={rejTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ReTooltip formatter={(v, name) => [fmtNum(v), name === 'qty_produced' ? 'Produced' : 'Rejected']} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="qty_produced" name="Produced" fill="#16a34a" radius={[3,3,0,0]} maxBarSize={20} stackId="a" />
                    <Bar dataKey="qty_rejected" name="Rejected" fill="#fca5a5" radius={[3,3,0,0]} maxBarSize={20} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* Machine Utilization Bar */}
            <Col xs={24} lg={12}>
              <Card
                title={<span><BarChartOutlined style={{ marginRight: 8, color: '#7c3aed' }} />Machine Utilization %</span>}
                style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                bodyStyle={{ padding: '12px 16px' }}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={machines.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 4, right: 40, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="machine_name" tick={{ fontSize: 10 }} width={80} />
                    <ReTooltip formatter={(v) => [`${v}%`, 'Utilization']} />
                    <Bar dataKey="utilization_pct" name="Utilization" radius={[0,3,3,0]} maxBarSize={18}>
                      {machines.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={MACHINE_COLORS[i % MACHINE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* ── Bottom Tables ── */}
          <Row gutter={[16, 16]}>
            {/* Machine Detail Table */}
            <Col xs={24} xl={14}>
              <Card
                title="Machine Performance Detail"
                style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                bodyStyle={{ padding: '0' }}
              >
                <Table
                  dataSource={machines}
                  columns={machCols}
                  rowKey="machine_id"
                  size="small"
                  pagination={{ pageSize: 8, size: 'small' }}
                  scroll={{ x: 560 }}
                />
              </Card>
            </Col>

            {/* Top Items */}
            <Col xs={24} xl={10}>
              <Card
                title="Top 10 Items by Output"
                style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                bodyStyle={{ padding: '0' }}
              >
                <Table
                  dataSource={topItems}
                  columns={itemCols}
                  rowKey="item_id"
                  size="small"
                  pagination={false}
                  scroll={{ x: 400 }}
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      </div>
    </AppLayout>
  );
}
