import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Card, Row, Col, Statistic, DatePicker,
  Button, message, Space, Tag, Empty,
} from 'antd';
import {
  RightOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CarOutlined, FileTextOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LabelList,
} from 'recharts';
import dayjs from 'dayjs';
import { dispatchOrderApi }   from '../../../api/dispatchOrder.api';
import { deliveryChallanApi } from '../../../api/deliveryChallan.api';
import AppLayout              from '../../../components/AppLayout';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_MAP = {
  draft:      { label: 'Draft',      color: '#d1d5db' },
  confirmed:  { label: 'Confirmed',  color: '#3b82f6' },
  loading:    { label: 'Loading',    color: '#f59e0b' },
  dispatched: { label: 'Dispatched', color: '#8b5cf6' },
  delivered:  { label: 'Delivered',  color: '#22c55e' },
  cancelled:  { label: 'Cancelled',  color: '#ef4444' },
};

const CARD_STYLE = {
  border: '1px solid #e8eaed',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  height: '100%',
};

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const DispatchReportsPage = () => {
  const [orders,    setOrders]    = useState([]);
  const [challans,  setChallans]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [dateRange, setDateRange] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange) {
        params.from_date = dateRange[0].format('YYYY-MM-DD');
        params.to_date   = dateRange[1].format('YYYY-MM-DD');
      }
      const [ordersRes, challansRes] = await Promise.all([
        dispatchOrderApi.getAll(params),
        deliveryChallanApi.getAll(),
      ]);
      setOrders(ordersRes?.data ?? ordersRes ?? []);
      setChallans(challansRes?.data ?? challansRes ?? []);
    } catch (err) { message.error(err?.message || 'Failed to load report data'); }
    finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived stats ─────────────────────────────────────────── */
  const total          = orders.length;
  const delivered      = orders.filter((o) => o.status === 'delivered').length;
  const inTransit      = orders.filter((o) => o.status === 'dispatched').length;
  const challansTotal  = challans.length;
  const challansSigned = challans.filter((c) => c.status === 'signed').length;

  // On-time delivery %
  const otdOrders = orders.filter((o) => o.status === 'delivered' && o.expected_delivery_date && o.actual_delivery_date);
  const onTimeCount = otdOrders.filter((o) => dayjs(o.actual_delivery_date).isSameOrBefore(dayjs(o.expected_delivery_date))).length;
  const otdPercent = otdOrders.length > 0 ? Math.round((onTimeCount / otdOrders.length) * 100) : 0;

  /* ── Chart: Status Breakdown (Donut) ──────────────────────── */
  const statusData = useMemo(() => {
    const counts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([status, count]) => ({
      name: STATUS_MAP[status]?.label || status,
      value: count,
      color: STATUS_MAP[status]?.color || '#9ca3af',
    }));
  }, [orders]);

  /* ── Chart: Monthly Dispatch Trend (Area) ─────────────────── */
  const monthlyData = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const month = o.dispatch_date ? dayjs(o.dispatch_date).format('MMM YY') : null;
      if (month) map[month] = (map[month] || 0) + 1;
    });
    // Sort chronologically
    return Object.entries(map)
      .sort((a, b) => dayjs(a[0], 'MMM YY').valueOf() - dayjs(b[0], 'MMM YY').valueOf())
      .map(([month, count]) => ({ month, orders: count }));
  }, [orders]);

  /* ── Chart: Top 10 Customers (Horizontal Bar) ────────────── */
  const customerData = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const name = o.Customer?.name || 'Unknown';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, fullName: name, orders: count }));
  }, [orders]);

  /* ── Chart: Transporter Performance (Bar) ─────────────────── */
  const transporterData = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const name = o.Transporter?.name || 'Unassigned';
      if (!map[name]) map[name] = { total: 0, delivered: 0 };
      map[name].total += 1;
      if (o.status === 'delivered') map[name].delivered += 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 8)
      .map(([name, d]) => ({
        name: name.length > 16 ? name.slice(0, 16) + '…' : name,
        fullName: name,
        total: d.total,
        delivered: d.delivered,
      }));
  }, [orders]);

  const noData = (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
    </div>
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Dispatch</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Reports</Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Dispatch Reports</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Overview and analytics for dispatch operations.</Text>
        </div>
        <Space style={{ marginTop: 4 }}>
          <RangePicker value={dateRange} onChange={setDateRange} style={{ borderRadius: 8 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} style={{ borderRadius: 8 }}>Refresh</Button>
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Orders',    value: total,     icon: <CarOutlined />,         color: '#1d4ed8' },
          { title: 'Delivered',        value: delivered, icon: <CheckCircleOutlined />, color: '#16a34a' },
          { title: 'In Transit',       value: inTransit, icon: <ClockCircleOutlined />, color: '#7c3aed' },
          { title: 'Challans Signed',  value: `${challansSigned} / ${challansTotal}`, icon: <FileTextOutlined />, color: '#16a34a' },
          { title: 'On-Time Delivery', value: otdOrders.length > 0 ? `${otdPercent}%` : '—', icon: <CheckCircleOutlined />, color: otdPercent >= 80 ? '#16a34a' : otdPercent >= 50 ? '#d97706' : '#dc2626' },
        ].map((k) => (
          <Col xs={12} sm={8} md={4} lg={4} xl={4} key={k.title} style={{ minWidth: 160 }}>
            <Card style={CARD_STYLE}>
              <Statistic
                title={<Text style={{ fontSize: 12, color: '#6b7280' }}>{k.title}</Text>}
                value={k.value}
                valueStyle={{ color: k.color, fontWeight: 700 }}
                prefix={React.cloneElement(k.icon, { style: { color: k.color } })}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts Row 1: Status Pie + Monthly Trend */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <Card
            title={<Text strong style={{ fontSize: 14 }}>Orders by Status</Text>}
            style={CARD_STYLE}
            bodyStyle={{ padding: '12px 16px' }}
          >
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={CustomPieLabel}
                  >
                    {statusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(v, name) => [`${v} orders`, name]} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : noData}
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card
            title={<Text strong style={{ fontSize: 14 }}>Monthly Dispatch Trend</Text>}
            style={CARD_STYLE}
            bodyStyle={{ padding: '12px 16px' }}
          >
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <ReTooltip formatter={(v) => [`${v} orders`, 'Dispatched']} />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="#1d4ed8"
                    strokeWidth={2}
                    fill="url(#colorOrders)"
                    dot={{ r: 4, fill: '#1d4ed8' }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : noData}
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2: Top Customers + Transporter Performance */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title={<Text strong style={{ fontSize: 14 }}>Top 10 Customers by Order Volume</Text>}
            style={CARD_STYLE}
            bodyStyle={{ padding: '12px 16px' }}
          >
            {customerData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={customerData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#374151' }} />
                  <ReTooltip formatter={(v, name, props) => [`${v} orders`, props.payload.fullName]} />
                  <Bar dataKey="orders" fill="#1d4ed8" radius={[0, 4, 4, 0]} barSize={20}>
                    <LabelList dataKey="orders" position="right" style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : noData}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={<Text strong style={{ fontSize: 14 }}>Transporter Performance</Text>}
            style={CARD_STYLE}
            bodyStyle={{ padding: '12px 16px' }}
          >
            {transporterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={transporterData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#374151', angle: -30, textAnchor: 'end' }} height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <ReTooltip
                    formatter={(v, name, props) => [
                      `${v} orders`,
                      name === 'total' ? 'Total' : 'Delivered',
                    ]}
                    labelFormatter={(label) => transporterData.find(t => t.name === label)?.fullName || label}
                  />
                  <Legend
                    verticalAlign="top"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ fontSize: 12, color: '#374151' }}>
                        {value === 'total' ? 'Total Orders' : 'Delivered'}
                      </span>
                    )}
                  />
                  <Bar dataKey="total" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="delivered" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : noData}
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
};

export default DispatchReportsPage;
