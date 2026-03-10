import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Table, Tag, Select, Row, Col,
  message, Statistic, Progress, Tooltip,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, CheckCircleOutlined,
  ClockCircleOutlined, SyncOutlined, CarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout          from '../../../components/AppLayout';
import { customerOrderApi } from '../../../api/orders.api';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  active:        { color: 'blue',    label: 'Active',         icon: <ClockCircleOutlined /> },
  in_production: { color: 'orange',  label: 'In Production',  icon: <SyncOutlined spin /> },
  ready:         { color: 'cyan',    label: 'Ready',          icon: <CheckCircleOutlined /> },
  dispatched:    { color: 'purple',  label: 'Dispatched',     icon: <CarOutlined /> },
  closed:        { color: 'green',   label: 'Closed',         icon: <CheckCircleOutlined /> },
  cancelled:     { color: 'default', label: 'Cancelled',      icon: null },
};
const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  ...Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label })),
];

export default function OrderTrackingPage() {
  const [tracking,     setTracking]     = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerOrderApi.getTracking();
      setTracking(data);
    } catch { message.error('Failed to load tracking data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = tracking?.summary || {};
  const allOrders = tracking?.orders || [];

  const filtered = statusFilter
    ? allOrders.filter((o) => o.status === statusFilter)
    : allOrders;

  // Delivery status helper
  const deliveryStatus = (order) => {
    if (!order.delivery_date) return null;
    const days = dayjs(order.delivery_date).diff(dayjs(), 'day');
    if (order.status === 'closed' || order.status === 'dispatched') return null;
    if (days < 0)  return { color: '#dc2626', text: `${Math.abs(days)}d overdue` };
    if (days === 0) return { color: '#d97706', text: 'Due today' };
    if (days <= 3)  return { color: '#d97706', text: `${days}d left` };
    return { color: '#16a34a', text: `${days}d left` };
  };

  const columns = [
    {
      title: 'Order No',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 140,
      render: (no) => <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{no}</Text>,
    },
    {
      title: 'Cust. PO No',
      dataIndex: 'customer_po_no',
      key: 'cust_po',
      width: 140,
      render: (v) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 180,
      render: (_, r) => r.Customer ? (
        <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Customer.name}</Text>
      ) : '—',
    },
    {
      title: 'Order Date',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Delivery Date',
      dataIndex: 'delivery_date',
      key: 'delivery_date',
      width: 130,
      render: (d, r) => {
        if (!d) return '—';
        const ds = deliveryStatus(r);
        return (
          <div>
            <Text>{dayjs(d).format('DD MMM YYYY')}</Text>
            {ds && (
              <div>
                <Text style={{ fontSize: 11, color: ds.color, fontWeight: 600 }}>{ds.text}</Text>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Items',
      key: 'items',
      width: 200,
      render: (_, r) => {
        const items = r.Items || [];
        const totalOrdered   = items.reduce((s, i) => s + parseFloat(i.qty_ordered || 0), 0);
        const totalDelivered = items.reduce((s, i) => s + parseFloat(i.qty_delivered || 0), 0);
        const pct = totalOrdered > 0 ? Math.round((totalDelivered / totalOrdered) * 100) : 0;
        return (
          <div>
            <Text style={{ fontSize: 12 }}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
            {totalOrdered > 0 && (
              <Tooltip title={`Delivered: ${totalDelivered} / ${totalOrdered}`}>
                <Progress percent={pct} size="small" strokeColor={pct === 100 ? '#16a34a' : '#1d4ed8'} style={{ marginTop: 2 }} />
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'total_amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (v) => v ? <Text strong>₹{parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Created By',
      key: 'creator',
      width: 110,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Creator?.name || '—'}</Text>,
    },
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Orders</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Order Tracking</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Order Tracking Dashboard</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Real-time visibility across all customer orders — from receipt to dispatch.
      </Text>

      {/* ── Summary KPIs ──────────────────────────────────────────────────────── */}
      <Row gutter={12} style={{ marginTop: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Orders',   value: summary.total,         color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Active',         value: summary.active,        color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'In Production',  value: summary.in_production, color: '#d97706', bg: '#fef3c7' },
          { label: 'Ready',          value: summary.ready,         color: '#0891b2', bg: '#cffafe' },
          { label: 'Dispatched',     value: summary.dispatched,    color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Closed',         value: summary.closed,        color: '#16a34a', bg: '#dcfce7' },
        ].map((kpi) => (
          <Col key={kpi.label} xs={12} sm={8} md={4}>
            <Card
              size="small"
              style={{
                border: `1px solid ${kpi.color}20`,
                borderRadius: 10,
                background: kpi.bg,
                textAlign: 'center',
              }}
              bodyStyle={{ padding: '12px 8px' }}
            >
              <div style={{ fontSize: 26, fontWeight: 700, color: kpi.color, lineHeight: 1 }}>
                {loading ? '—' : (kpi.value ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{kpi.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            style={{ width: 180 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Showing {filtered.length} of {allOrders.length} orders
          </Text>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} orders` }}
          rowClassName={(r) => {
            const ds = deliveryStatus(r);
            if (ds?.color === '#dc2626') return 'row-overdue';
            return '';
          }}
        />
      </Card>
    </AppLayout>
  );
}
