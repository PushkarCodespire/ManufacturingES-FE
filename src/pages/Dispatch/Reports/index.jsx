import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Row, Col, Statistic, Table, Tag, DatePicker,
  Button, message, Space,
} from 'antd';
import {
  RightOutlined, ReloadOutlined, BarChartOutlined,
  CheckCircleOutlined, ClockCircleOutlined, CarOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { dispatchOrderApi }   from '../../../api/dispatchOrder.api';
import { deliveryChallanApi } from '../../../api/deliveryChallan.api';
import AppLayout              from '../../../components/AppLayout';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLORS = {
  draft: 'default', confirmed: 'blue', loading: 'orange',
  dispatched: 'purple', delivered: 'green', cancelled: 'red',
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
    } catch { message.error('Failed to load report data'); }
    finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived stats
  const total          = orders.length;
  const delivered      = orders.filter((o) => o.status === 'delivered').length;
  const inTransit      = orders.filter((o) => o.status === 'dispatched').length;
  const challansTotal  = challans.length;
  const challansSigned = challans.filter((c) => c.status === 'signed').length;

  // Status breakdown
  const statusBreakdown = Object.entries(
    orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {})
  ).map(([status, count]) => ({ status, count }));

  // Top customers
  const customerMap = {};
  orders.forEach((o) => {
    const name = o.Customer?.name || 'Unknown';
    customerMap[name] = (customerMap[name] || 0) + 1;
  });
  const topCustomers = Object.entries(customerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const statusColumns = [
    {
      title: 'Status', dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLORS[v]}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Count', dataIndex: 'count',
      render: (v) => <Text style={{ fontWeight: 600, fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Share', key: 'share',
      render: (_, r) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{total > 0 ? `${Math.round(r.count / total * 100)}%` : '—'}</Text>,
    },
  ];

  const customerColumns = [
    {
      title: 'Customer', dataIndex: 'name',
      render: (v) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: 'Orders', dataIndex: 'count',
      render: (v) => <Text style={{ fontWeight: 600, fontSize: 13 }}>{v}</Text>,
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Dispatch</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Reports</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Dispatch Reports</Title>
            <Text style={{ color: '#6b7280', fontSize: 13 }}>Overview and analytics for dispatch operations</Text>
          </div>
          <Space>
            <RangePicker value={dateRange} onChange={setDateRange} style={{ borderRadius: 8 }} />
            <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ borderRadius: 8 }}>Refresh</Button>
          </Space>
        </div>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: 'Total Orders',     value: total,          icon: <CarOutlined />,         color: '#1d4ed8' },
          { title: 'Delivered',        value: delivered,      icon: <CheckCircleOutlined />,  color: '#16a34a' },
          { title: 'In Transit',       value: inTransit,      icon: <ClockCircleOutlined />,  color: '#7c3aed' },
          { title: 'Challans Signed',  value: `${challansSigned} / ${challansTotal}`, icon: <FileTextOutlined />, color: '#16a34a' },
        ].map((k) => (
          <Col xs={12} sm={8} md={6} key={k.title}>
            <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
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

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            title={<Text strong style={{ fontSize: 13 }}>Orders by Status</Text>}
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '12px 20px' }}
          >
            <Table
              dataSource={statusBreakdown} columns={statusColumns} rowKey="status"
              pagination={false} size="middle" loading={loading}
              locale={{ emptyText: (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <BarChartOutlined style={{ fontSize: 24, color: '#d1d5db', display: 'block', marginBottom: 8 }} />
                  <Text style={{ color: '#9ca3af', fontSize: 12 }}>No data yet</Text>
                </div>
              )}}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={<Text strong style={{ fontSize: 13 }}>Top Customers by Order Volume</Text>}
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '12px 20px' }}
          >
            <Table
              dataSource={topCustomers} columns={customerColumns} rowKey="name"
              pagination={false} size="middle" loading={loading}
              locale={{ emptyText: (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <BarChartOutlined style={{ fontSize: 24, color: '#d1d5db', display: 'block', marginBottom: 8 }} />
                  <Text style={{ color: '#9ca3af', fontSize: 12 }}>No data yet</Text>
                </div>
              )}}
            />
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
};

export default DispatchReportsPage;
