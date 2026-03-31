import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Row, Col, Statistic, DatePicker,
  Button, message, Table, Tag, Space, Empty, Spin,
} from 'antd';
import {
  RightOutlined, ReloadOutlined,
  ShoppingCartOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined,
  AuditOutlined, FileDoneOutlined, TrophyOutlined,
DownloadOutlined, } from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell, Legend,
  AreaChart, Area,
  PieChart, Pie,
  FunnelChart, Funnel, LabelList,
} from 'recharts';
import dayjs from 'dayjs';
import AppLayout                  from '../../../components/AppLayout';
import { procurementAnalyticsApi } from '../../../api/procurement.api';
import { exportToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const CARD_STYLE = {
  border: '1px solid #e8eaed',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  height: '100%',
};

const PO_STATUS_COLORS = {
  draft:     '#d1d5db',
  sent:      '#3b82f6',
  partial:   '#f59e0b',
  received:  '#22c55e',
  cancelled: '#ef4444',
};

const FUNNEL_COLORS = ['#1d4ed8', '#6366f1', '#22c55e'];

const VENDOR_COLORS = [
  '#1d4ed8', '#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa',
  '#06b6d4', '#0ea5e9', '#14b8a6', '#10b981', '#22c55e',
];

const fmtCcy = (v) =>
  v != null
    ? `₹${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : '₹0';

const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return dayjs(`${y}-${mo}-01`).format('MMM YY');
};

// ── Custom Pie label ─────────────────────────────────────────────────────────
const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  return (
    <text
      x={cx + r * Math.cos(-midAngle * R)}
      y={cy + r * Math.sin(-midAngle * R)}
      fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={12} fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export default function ProcurementAnalyticsPage() {
  const [dateRange,      setDateRange]      = useState(null);
  const [loading,        setLoading]        = useState(false);

  // Data states
  const [summary,        setSummary]        = useState(null);
  const [poStatus,       setPoStatus]       = useState([]);
  const [spendByVendor,  setSpendByVendor]  = useState([]);
  const [monthlySpend,   setMonthlySpend]   = useState([]);
  const [funnel,         setFunnel]         = useState([]);
  const [topItems,       setTopItems]       = useState([]);
  const [overduePOs,     setOverduePOs]     = useState([]);
  const [approvalAgeing, setApprovalAgeing] = useState([]);

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (dateRange) {
      params.from = dateRange[0].format('YYYY-MM-DD');
      params.to   = dateRange[1].format('YYYY-MM-DD');
    }
    const safe = (promise) => promise.catch(() => null);
    try {
      const [
        summaryRes, poStatusRes, vendorRes, monthlyRes,
        funnelRes, itemsRes, overdueRes, ageingRes,
      ] = await Promise.all([
        safe(procurementAnalyticsApi.getSummary(params)),
        safe(procurementAnalyticsApi.getPoStatus(params)),
        safe(procurementAnalyticsApi.getSpendByVendor(params)),
        safe(procurementAnalyticsApi.getMonthlySpend({ months: 12 })),
        safe(procurementAnalyticsApi.getFunnel(params)),
        safe(procurementAnalyticsApi.getTopItems(params)),
        safe(procurementAnalyticsApi.getOverduePOs()),
        safe(procurementAnalyticsApi.getApprovalAgeing()),
      ]);
      if (summaryRes)  setSummary(summaryRes.data);
      if (poStatusRes) setPoStatus((poStatusRes.data || []).map(r => ({
        name:  r.status.charAt(0).toUpperCase() + r.status.slice(1),
        value: parseInt(r.count, 10),
        key:   r.status,
      })));
      if (vendorRes)   setSpendByVendor(vendorRes.data || []);
      if (monthlyRes)  setMonthlySpend(monthlyRes.data || []);
      if (funnelRes)   setFunnel(funnelRes.data || []);
      if (itemsRes)    setTopItems(itemsRes.data || []);
      if (overdueRes)  setOverduePOs(overdueRes.data || []);
      if (ageingRes)   setApprovalAgeing(ageingRes.data || []);
    } catch (err) {
      message.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── KPI Cards ───────────────────────────────────────────────────────────────
  const kpis = summary ? [
    {
      title:  'Total POs',
      value:  summary.totalPos,
      icon:   <ShoppingCartOutlined style={{ fontSize: 22, color: '#1d4ed8' }} />,
      color:  '#eff6ff',
    },
    {
      title:  'Total Spend',
      value:  fmtCcy(summary.totalSpend),
      icon:   <FileDoneOutlined style={{ fontSize: 22, color: '#16a34a' }} />,
      color:  '#f0fdf4',
      raw:    true,
    },
    {
      title:  'Pending Approval',
      value:  summary.pendingApproval,
      icon:   <ClockCircleOutlined style={{ fontSize: 22, color: '#d97706' }} />,
      color:  '#fffbeb',
      warn:   summary.pendingApproval > 0,
    },
    {
      title:  'Overdue POs',
      value:  summary.overduePOs,
      icon:   <ExclamationCircleOutlined style={{ fontSize: 22, color: '#dc2626' }} />,
      color:  '#fef2f2',
      danger: summary.overduePOs > 0,
    },
    {
      title:  'Purchase Requisitions',
      value:  summary.totalPrs,
      icon:   <AuditOutlined style={{ fontSize: 22, color: '#6366f1' }} />,
      color:  '#eef2ff',
    },
    {
      title:  'Vendor RFQs',
      value:  summary.totalRfqs,
      icon:   <TrophyOutlined style={{ fontSize: 22, color: '#0891b2' }} />,
      color:  '#ecfeff',
    },
  ] : [];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Analytics</Text>
        </div>

        {/* Title + controls */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Procurement Analytics</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Spend analysis, vendor performance, and procurement pipeline overview.
            </Text>
          </div>
          <Space wrap>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD-MM-YYYY"
              allowClear
              placeholder={['From Date', 'To Date']}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>Refresh</Button>
          </Space>
        </div>

        <Spin spinning={loading}>
          {/* ── KPI Cards Row ─────────────────────────────────────────────────── */}
          <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
            {kpis.map((kpi, i) => (
              <Col key={i} xs={12} sm={8} lg={4}>
                <Card
                  style={{ ...CARD_STYLE, backgroundColor: kpi.color }}
                  styles={{ body: { padding: '16px 18px' } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{kpi.title}</Text>
                      <div style={{
                        fontSize: kpi.raw ? 18 : 24,
                        fontWeight: 700,
                        color: kpi.danger ? '#dc2626' : kpi.warn ? '#d97706' : '#111827',
                        marginTop: 4,
                        lineHeight: 1.2,
                      }}>
                        {kpi.value}
                      </div>
                    </div>
                    <div style={{ opacity: 0.8 }}>{kpi.icon}</div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* ── Row 2: Monthly Spend + PO Status ────────────────────────────── */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {/* Monthly spend area chart */}
            <Col xs={24} lg={16}>
              <Card style={CARD_STYLE} styles={{ body: { padding: '16px 20px' } }}>
                <Text strong style={{ fontSize: 14 }}>Monthly Spend Trend (₹)</Text>
                <div style={{ marginTop: 12, height: 240 }}>
                  {monthlySpend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlySpend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#1d4ed8" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0}   />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={60} />
                        <ReTooltip
                          formatter={(v) => [fmtCcy(v), 'Spend']}
                          labelFormatter={fmtMonth}
                        />
                        <Area
                          type="monotone" dataKey="spend"
                          stroke="#1d4ed8" strokeWidth={2}
                          fill="url(#spendGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No spend data" style={{ paddingTop: 60 }} />
                  )}
                </div>
              </Card>
            </Col>

            {/* PO Status Donut */}
            <Col xs={24} lg={8}>
              <Card style={CARD_STYLE} styles={{ body: { padding: '16px 20px' } }}>
                <Text strong style={{ fontSize: 14 }}>PO Status Distribution</Text>
                <div style={{ marginTop: 8, height: 240 }}>
                  {poStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={poStatus}
                          cx="50%" cy="50%"
                          innerRadius={55} outerRadius={90}
                          dataKey="value"
                          labelLine={false}
                          label={PieLabel}
                        >
                          {poStatus.map((entry, i) => (
                            <Cell key={i} fill={PO_STATUS_COLORS[entry.key] || '#9ca3af'} />
                          ))}
                        </Pie>
                        <ReTooltip formatter={(v, n) => [v, n]} />
                        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No PO data" style={{ paddingTop: 60 }} />
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* ── Row 3: Spend by Vendor + Funnel ─────────────────────────────── */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {/* Spend by Vendor horizontal bar */}
            <Col xs={24} lg={16}>
              <Card style={CARD_STYLE} styles={{ body: { padding: '16px 20px' } }}>
                <Text strong style={{ fontSize: 14 }}>Top Vendors by Spend</Text>
                <div style={{ marginTop: 12, height: 260 }}>
                  {spendByVendor.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={spendByVendor.slice(0, 8)}
                        layout="vertical"
                        margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="vendor" width={120} tick={{ fontSize: 11 }} />
                        <ReTooltip formatter={(v) => [fmtCcy(v), 'Spend']} />
                        <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                          {spendByVendor.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={VENDOR_COLORS[i % VENDOR_COLORS.length]} />
                          ))}
                          <LabelList dataKey="spend" position="right" formatter={v => `₹${(v/1000).toFixed(1)}k`} style={{ fontSize: 10 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No vendor spend data" style={{ paddingTop: 60 }} />
                  )}
                </div>
              </Card>
            </Col>

            {/* PR → RFQ → PO Funnel */}
            <Col xs={24} lg={8}>
              <Card style={CARD_STYLE} styles={{ body: { padding: '16px 20px' } }}>
                <Text strong style={{ fontSize: 14 }}>Procurement Pipeline</Text>
                <div style={{ marginTop: 12, height: 260 }}>
                  {funnel.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <ReTooltip formatter={(v, n) => [v, n]} />
                        <Funnel dataKey="count" data={funnel} isAnimationActive>
                          {funnel.map((entry, i) => (
                            <Cell key={i} fill={FUNNEL_COLORS[i]} />
                          ))}
                          <LabelList
                            position="right"
                            content={({ x, y, width, height, value, index }) => {
                              const item = funnel[index];
                              return (
                                <text x={x + width + 8} y={y + height / 2 + 5}
                                  fill="#374151" fontSize={11}>
                                  {item?.stage}: {value}
                                </text>
                              );
                            }}
                          />
                        </Funnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No pipeline data" style={{ paddingTop: 60 }} />
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* ── Row 4: Top Items + Overdue POs ──────────────────────────────── */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {/* Top Items table */}
            <Col xs={24} lg={12}>
              <Card style={CARD_STYLE} styles={{ body: { padding: '16px 20px' } }}>
                <Text strong style={{ fontSize: 14 }}>Top Items by Spend</Text>
                <Table
                  style={{ marginTop: 12 }}
                  size="small"
                  dataSource={topItems}
                  rowKey="id"
                  pagination={false}
                  scroll={{ x: 800 }}
                  columns={[
                    {
                      title: '#', key: 'rank', width: 32,
                      render: (_, __, i) => <Text type="secondary">{i + 1}</Text>,
                    },
                    { title: 'Item', dataIndex: 'item_name', key: 'item', ellipsis: true },
                    { title: 'Code', dataIndex: 'item_code', key: 'code', width: 80, render: v => v || '—' },
                    {
                      title: 'Spend', dataIndex: 'spend', key: 'spend', width: 110,
                      render: v => <Text strong>{fmtCcy(v)}</Text>,
                      sorter: (a, b) => a.spend - b.spend,
                      defaultSortOrder: 'descend',
                    },
                  ]}
                />
              </Card>
            </Col>

            {/* Overdue POs table */}
            <Col xs={24} lg={12}>
              <Card style={CARD_STYLE} styles={{ body: { padding: '16px 20px' } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 14 }}>Overdue Purchase Orders</Text>
                  {overduePOs.length > 0 && (
                    <Tag color="red">{overduePOs.length} overdue</Tag>
                  )}
                </div>
                {overduePOs.length > 0 ? (
                  <Table
                    style={{ marginTop: 12 }}
                    size="small"
                    dataSource={overduePOs}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: 800 }}
                    columns={[
                      { title: 'PO No',  dataIndex: 'po_no',   key: 'po',     width: 120 },
                      { title: 'Vendor', dataIndex: 'vendor',  key: 'vendor', ellipsis: true },
                      {
                        title: 'Expected', dataIndex: 'expected_date', key: 'exp', width: 100,
                        render: v => dayjs(v).format('DD MMM YY'),
                      },
                      {
                        title: 'Overdue', dataIndex: 'days_overdue', key: 'overdue', width: 80,
                        render: v => <Tag color={v > 14 ? 'red' : 'orange'}>{v}d</Tag>,
                        sorter: (a, b) => b.days_overdue - a.days_overdue,
                        defaultSortOrder: 'descend',
                      },
                    ]}
                  />
                ) : (
                  <Empty
                    description={<Text type="success"><CheckCircleOutlined /> No overdue POs</Text>}
                    style={{ paddingTop: 40 }}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* ── Row 5: Approval Ageing ───────────────────────────────────────── */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card style={CARD_STYLE} styles={{ body: { padding: '16px 20px' } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 14 }}>Pending Approval — Ageing</Text>
                  {approvalAgeing.length > 0 && (
                    <Tag color="orange">{approvalAgeing.length} pending</Tag>
                  )}
                </div>
                {approvalAgeing.length > 0 ? (
                  <Table
                    style={{ marginTop: 12 }}
                    size="small"
                    dataSource={approvalAgeing}
                    rowKey="id"
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    scroll={{ x: 800 }}
                    columns={[
                      { title: 'PO No',   dataIndex: 'po_no',    key: 'po',      width: 140 },
                      { title: 'Vendor',  dataIndex: 'vendor',   key: 'vendor',  ellipsis: true },
                      { title: 'Created By', dataIndex: 'creator', key: 'creator', width: 150 },
                      {
                        title: 'Created On', dataIndex: 'created_at', key: 'created', width: 120,
                        render: v => dayjs(v).format('DD MMM YYYY'),
                      },
                      {
                        title: 'Days Pending', dataIndex: 'days_pending', key: 'age', width: 110,
                        render: v => (
                          <Tag color={v >= 7 ? 'red' : v >= 3 ? 'orange' : 'default'}>{v}d</Tag>
                        ),
                        sorter: (a, b) => b.days_pending - a.days_pending,
                        defaultSortOrder: 'descend',
                      },
                    ]}
                  />
                ) : (
                  <Empty
                    description={<Text type="success"><CheckCircleOutlined /> No pending approvals</Text>}
                    style={{ paddingTop: 24 }}
                  />
                )}
              </Card>
            </Col>
          </Row>
        </Spin>
    </AppLayout>
  );
}
