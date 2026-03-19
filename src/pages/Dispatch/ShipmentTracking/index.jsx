import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Table, Tag, Select, Input, Button, Space, Timeline,
  Drawer, Descriptions, Divider, message, Tooltip,
} from 'antd';
import {
  RightOutlined, ReloadOutlined, SearchOutlined, EyeOutlined, NodeIndexOutlined,
} from '@ant-design/icons';
import { dispatchOrderApi } from '../../../api/dispatchOrder.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;

const STATUS_COLORS = {
  draft: 'default', confirmed: 'blue', loading: 'orange',
  dispatched: 'purple', delivered: 'green', cancelled: 'red',
};
const CHALLAN_STATUS_COLORS = { pending: 'default', issued: 'blue', signed: 'green', archived: 'gray' };
const STATUS_STEPS = ['draft', 'confirmed', 'loading', 'dispatched', 'delivered'];

const ShipmentTrackingPage = () => {
  const [records,      setRecords]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (search)       params.search = search;
      const res = await dispatchOrderApi.getAll(params);
      setRecords(res?.data ?? res ?? []);
    } catch (err) { message.error(err?.message || 'Failed to load orders'); }
    finally { setLoading(false); }
  }, [filterStatus, search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openDetail = (record) => { setSelected(record); setDrawerOpen(true); };

  const getTimelineItems = (status) => {
    const currentIdx = STATUS_STEPS.indexOf(status);
    return STATUS_STEPS.map((step, idx) => ({
      color: idx < currentIdx ? 'green' : idx === currentIdx ? 'blue' : 'gray',
      children: (
        <Text style={{ fontSize: 13, color: idx <= currentIdx ? '#111827' : '#9ca3af', fontWeight: idx === currentIdx ? 600 : 400 }}>
          {step.charAt(0).toUpperCase() + step.slice(1)}
        </Text>
      ),
    }));
  };

  const inTransit  = records.filter((r) => ['confirmed', 'loading', 'dispatched'].includes(r.status)).length;
  const delivered  = records.filter((r) => r.status === 'delivered').length;

  const columns = [
    {
      title: 'Order #', dataIndex: 'order_number', key: 'order_number',
      render: (v) => <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Customer', key: 'customer',
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Customer?.name || '—'}</Text>,
    },
    {
      title: 'Transporter', key: 'transporter',
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Transporter?.name || '—'}</Text>,
    },
    {
      title: 'Vehicle', dataIndex: 'vehicle_number', key: 'vehicle_number', width: 130,
      render: (v) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Driver', key: 'driver', width: 160,
      render: (_, r) => r.driver_name
        ? <div><Text style={{ fontSize: 13, display: 'block' }}>{r.driver_name}</Text><Text style={{ fontSize: 11, color: '#9ca3af' }}>{r.driver_phone || ''}</Text></div>
        : <Text style={{ color: '#9ca3af', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Dispatch Date', dataIndex: 'dispatch_date', key: 'dispatch_date', width: 130,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</Text>,
    },
    {
      title: 'Expected Delivery', dataIndex: 'expected_delivery_date', key: 'expected_delivery_date', width: 150,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (v) => <Tag color={STATUS_COLORS[v]}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Track', key: 'track', width: 80, align: 'center',
      render: (_, record) => (
        <Tooltip title="View tracking">
          <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#1d4ed8' }} />} onClick={() => openDetail(record)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Dispatch</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Shipment Tracking</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Shipment Tracking</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Real-time status of all dispatch orders.</Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {records.length}</Tag>
        <Tag color="orange">In Transit: {inTransit}</Tag>
        <Tag color="green">Delivered: {delivered}</Tag>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} styles={{ body: { padding: '16px 20px' } }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search order number…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }} allowClear
          />
          <Select
            allowClear placeholder="Filter status" style={{ width: 160 }}
            options={[
              { value: 'confirmed',  label: 'Confirmed'  },
              { value: 'loading',    label: 'Loading'    },
              { value: 'dispatched', label: 'Dispatched' },
              { value: 'delivered',  label: 'Delivered'  },
            ]}
            value={filterStatus} onChange={setFilterStatus}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchAll} style={{ borderRadius: 8 }}>Refresh</Button>
        </div>
        <Table
          rowKey="id" dataSource={records} columns={columns} loading={loading}
          size="middle" scroll={{ x: 1100 }}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} orders` }}
          locale={{ emptyText: (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <NodeIndexOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
              <Text style={{ color: '#9ca3af' }}>No shipments to track</Text>
            </div>
          )}}
        />
      </Card>

      <Drawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={<Text strong style={{ fontSize: 15 }}>Tracking: {selected?.order_number || ''}</Text>}
        width={480}
      >
        {selected && (
          <div>
            <Timeline items={getTimelineItems(selected.status)} style={{ marginBottom: 24 }} />
            <Divider />
            <Descriptions column={1} size="small" bordered labelStyle={{ fontWeight: 500, color: '#374151', width: 140 }}>
              <Descriptions.Item label="Order #">
                <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{selected.order_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Customer">{selected.Customer?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Transporter">{selected.Transporter?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Vehicle">{selected.vehicle_number || '—'}</Descriptions.Item>
              <Descriptions.Item label="Driver">{selected.driver_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Driver Phone">{selected.driver_phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Dispatch Date">{selected.dispatch_date || '—'}</Descriptions.Item>
              <Descriptions.Item label="Expected Delivery">{selected.expected_delivery_date || '—'}</Descriptions.Item>
              <Descriptions.Item label="Actual Delivery">{selected.actual_delivery_date || '—'}</Descriptions.Item>
              <Descriptions.Item label="Items">{selected.Items?.length || 0} line item(s)</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLORS[selected.status]}>{selected.status?.toUpperCase()}</Tag>
              </Descriptions.Item>
            </Descriptions>
            {selected.Challans?.length > 0 && (
              <>
                <Divider orientation="left" orientationMargin={0}><Text style={{ fontSize: 12, color: '#6b7280' }}>Delivery Challans</Text></Divider>
                {selected.Challans.map((c) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <Text style={{ fontSize: 13, fontWeight: 500 }}>{c.challan_number}</Text>
                    <Tag color={CHALLAN_STATUS_COLORS[c.status]}>{c.status?.toUpperCase()}</Tag>
                  </div>
                ))}
              </>
            )}
            {selected.notes && (
              <>
                <Divider />
                <Text type="secondary" style={{ fontSize: 12 }}>{selected.notes}</Text>
              </>
            )}
          </div>
        )}
      </Drawer>
    </AppLayout>
  );
};

export default ShipmentTrackingPage;
