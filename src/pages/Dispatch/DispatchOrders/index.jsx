import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Table, Space, Tag, Form, Input, Select, DatePicker,
  InputNumber, message, Card, Modal, Divider, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  RightOutlined, SearchOutlined, ArrowLeftOutlined,
  PlusCircleOutlined, MinusCircleOutlined, InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { dispatchOrderApi } from '../../../api/dispatchOrder.api';
import { transporterApi }   from '../../../api/transporter.api';
import AppLayout            from '../../../components/AppLayout';
import { useAuth }          from '../../../context/AuthContext';
import api                  from '../../../api/axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLORS = {
  draft: 'default', confirmed: 'blue', loading: 'orange',
  dispatched: 'purple', delivered: 'green', cancelled: 'red',
};
const STATUS_OPTIONS = [
  { value: 'draft',      label: 'Draft'      },
  { value: 'confirmed',  label: 'Confirmed'  },
  { value: 'loading',    label: 'Loading'    },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered',  label: 'Delivered'  },
  { value: 'cancelled',  label: 'Cancelled'  },
];

const DispatchOrdersPage = () => {
  const { user } = useAuth();
  const canWrite = ['dispatch_admin', 'it_admin', 'plant_head'].includes(user?.role?.name);

  const [records,      setRecords]      = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [items,        setItems]        = useState([]);
  const [warehouses,   setWarehouses]   = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [view,         setView]         = useState('list');
  const [editing,      setEditing]      = useState(null);
  const [orderItems,   setOrderItems]   = useState([{ item_id: null, quantity: 1, unit: '', weight: null, notes: '' }]);
  const [filterStatus, setFilterStatus] = useState(null);
  const [search,       setSearch]       = useState('');
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await dispatchOrderApi.getAll(params);
      setRecords(res?.data ?? res ?? []);
    } catch { message.error('Failed to load dispatch orders'); }
    finally { setLoading(false); }
  }, [filterStatus]);

  const fetchBase = useCallback(async () => {
    try {
      const [custRes, transRes, itemRes, whRes] = await Promise.all([
        api.get('/vendors', { params: { is_active: true } }).then((r) => r.data),
        transporterApi.getAll({ is_active: true }),
        api.get('/items').then((r) => r.data),
        api.get('/warehouses').then((r) => r.data),
      ]);
      setCustomers(custRes?.data ?? custRes ?? []);
      setTransporters(transRes?.data ?? transRes ?? []);
      setItems(itemRes?.data ?? itemRes ?? []);
      setWarehouses(whRes?.data ?? whRes ?? []);
    } catch { message.error('Failed to load reference data'); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchBase(); }, [fetchBase]);

  const openForm = (record = null) => {
    setEditing(record);
    if (record) {
      form.setFieldsValue({
        ...record,
        dispatch_date:          record.dispatch_date          ? dayjs(record.dispatch_date)          : null,
        expected_delivery_date: record.expected_delivery_date ? dayjs(record.expected_delivery_date) : null,
        actual_delivery_date:   record.actual_delivery_date   ? dayjs(record.actual_delivery_date)   : null,
      });
      setOrderItems(record.Items?.length > 0 ? record.Items : [{ item_id: null, quantity: 1, unit: '', weight: null, notes: '' }]);
    } else {
      form.setFieldsValue({ status: 'draft' });
      setOrderItems([{ item_id: null, quantity: 1, unit: '', weight: null, notes: '' }]);
    }
    setView('form');
  };

  const addItem    = () => setOrderItems((prev) => [...prev, { item_id: null, quantity: 1, unit: '', weight: null, notes: '' }]);
  const removeItem = (idx) => setOrderItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => setOrderItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        dispatch_date:          values.dispatch_date?.format('YYYY-MM-DD') || null,
        expected_delivery_date: values.expected_delivery_date?.format('YYYY-MM-DD') || null,
        actual_delivery_date:   values.actual_delivery_date?.format('YYYY-MM-DD') || null,
        items: orderItems
          .filter((it) => it.item_id)
          .map(({ id, item_id, quantity, unit, weight, notes }) => ({
            ...(id ? { id } : {}),
            item_id, quantity, unit: unit || null, weight: weight || null, notes: notes || null,
          })),
      };
      if (editing) {
        await dispatchOrderApi.update(editing.id, payload);
        message.success('Order updated');
      } else {
        await dispatchOrderApi.create(payload);
        message.success('Order created');
      }
      setView('list');
      fetchAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: `Delete order ${record.order_number}?`,
      content: 'This action cannot be undone.',
      okText: 'Delete', okType: 'danger',
      onOk: async () => {
        try {
          await dispatchOrderApi.delete(record.id);
          message.success('Order deleted');
          fetchAll();
        } catch (err) {
          message.error(err?.response?.data?.message || 'Failed to delete');
        }
      },
    });
  };

  const filtered = search
    ? records.filter((r) =>
        r.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        r.Customer?.name?.toLowerCase().includes(search.toLowerCase()))
    : records;

  const inProgress = records.filter((r) => ['confirmed', 'loading', 'dispatched'].includes(r.status)).length;
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
      title: 'Dispatch Date', dataIndex: 'dispatch_date', key: 'dispatch_date', width: 130,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</Text>,
    },
    {
      title: 'Vehicle', dataIndex: 'vehicle_number', key: 'vehicle_number', width: 130,
      render: (v) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (v) => <Tag color={STATUS_COLORS[v]}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Challans', key: 'challans', width: 100, align: 'center',
      render: (_, r) => r.Challans?.length > 0
        ? <Tag color="blue">{r.Challans.length} challan(s)</Tag>
        : <Text style={{ color: '#9ca3af', fontSize: 12 }}>—</Text>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 90, align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1d4ed8' }} />} onClick={() => openForm(record)} />
          </Tooltip>
          {(record.status === 'draft' || record.status === 'cancelled') && (
            <Tooltip title="Delete">
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Dispatch</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Dispatch Orders</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Dispatch Orders</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Create and manage outbound dispatch orders</Text>
      </div>

      {view === 'list' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total',       value: records.length, color: '#1d4ed8', bg: '#eff6ff' },
              { label: 'In Progress', value: inProgress,     color: '#d97706', bg: '#fffbeb' },
              { label: 'Delivered',   value: delivered,      color: '#16a34a', bg: '#f0fdf4' },
            ].map((s) => (
              <div key={s.label} style={{ padding: '8px 16px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
                <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{s.value}</Text>
                <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
              </div>
            ))}
          </div>

          <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <Input
                placeholder="Search order or customer…"
                prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: 260, borderRadius: 8 }} allowClear
              />
              <Select
                allowClear placeholder="Filter status" style={{ width: 160 }}
                options={STATUS_OPTIONS} value={filterStatus} onChange={setFilterStatus}
              />
              <div style={{ flex: 1 }} />
              <Button icon={<ReloadOutlined />} onClick={fetchAll} style={{ borderRadius: 8 }}>Refresh</Button>
              {canWrite && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()} style={{ borderRadius: 8, fontWeight: 600 }}>
                  New Order
                </Button>
              )}
            </div>
            <Table
              rowKey="id" dataSource={filtered} columns={columns} loading={loading}
              size="middle" scroll={{ x: 1000 }}
              pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} orders` }}
              locale={{ emptyText: (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <InboxOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                  <Text style={{ color: '#9ca3af' }}>No dispatch orders yet</Text>
                </div>
              )}}
            />
          </Card>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setView('list')} style={{ color: '#374151', paddingLeft: 0 }} />
            <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
              {editing ? `Edit — ${editing.order_number}` : 'New Dispatch Order'}
            </Title>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <Form form={form} layout="vertical" disabled={!canWrite} requiredMark={false} size="large">
              <Text strong style={{ fontSize: 13, color: '#374151' }}>Order Details</Text>
              <Divider style={{ margin: '10px 0 20px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 20px' }}>
                <Form.Item name="customer_id" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Customer</span>}>
                  <Select showSearch allowClear placeholder="Select customer"
                    filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                    options={customers.map((c) => ({ value: c.id, label: c.name }))} />
                </Form.Item>
                <Form.Item name="status" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Status</span>}>
                  <Select options={STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="from_warehouse_id" label={<span style={{ fontWeight: 500, fontSize: 13 }}>From Warehouse</span>}>
                  <Select allowClear placeholder="Select warehouse"
                    options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
                </Form.Item>
                <Form.Item name="transporter_id" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Transporter</span>}>
                  <Select allowClear placeholder="Select transporter"
                    options={transporters.map((t) => ({ value: t.id, label: t.name }))} />
                </Form.Item>
                <Form.Item name="vehicle_number" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Vehicle Number</span>}>
                  <Input placeholder="e.g. MH 12 AB 1234" />
                </Form.Item>
                <Form.Item name="driver_name" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Driver Name</span>}>
                  <Input placeholder="Driver full name" />
                </Form.Item>
                <Form.Item name="driver_phone" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Driver Phone</span>}>
                  <Input placeholder="+91 98765 43210" />
                </Form.Item>
                <Form.Item name="dispatch_date" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Dispatch Date</span>}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="expected_delivery_date" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Expected Delivery</span>}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="actual_delivery_date" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Actual Delivery</span>}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="total_packages" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Total Packages</span>}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
                <Form.Item name="total_weight" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Total Weight (kg)</span>}>
                  <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                </Form.Item>
              </div>
              <Form.Item name="shipping_address" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Shipping Address</span>}>
                <TextArea rows={2} placeholder="Delivery address" />
              </Form.Item>
              <Form.Item name="notes" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Notes</span>}>
                <TextArea rows={2} />
              </Form.Item>

              {/* Line Items */}
              <Text strong style={{ fontSize: 13, color: '#374151' }}>Items / Products</Text>
              <Divider style={{ margin: '10px 0 16px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr 40px', gap: 8, marginBottom: 6 }}>
                {['Item', 'Qty', 'Unit', 'Weight (kg)', 'Notes', ''].map((h) => (
                  <Text key={h} style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{h}</Text>
                ))}
              </div>
              {orderItems.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr 40px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <Select showSearch allowClear placeholder="Select item" value={it.item_id} onChange={(v) => updateItem(idx, 'item_id', v)}
                    filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                    options={items.map((i) => ({ value: i.id, label: `${i.name}${i.code ? ` (${i.code})` : ''}` }))}
                    disabled={!canWrite} size="middle" />
                  <InputNumber placeholder="Qty" value={it.quantity} min={0.001} step={0.001} style={{ width: '100%' }} onChange={(v) => updateItem(idx, 'quantity', v)} disabled={!canWrite} size="middle" />
                  <Input placeholder="Unit" value={it.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} disabled={!canWrite} size="middle" />
                  <InputNumber placeholder="0.000" value={it.weight} min={0} step={0.001} style={{ width: '100%' }} onChange={(v) => updateItem(idx, 'weight', v)} disabled={!canWrite} size="middle" />
                  <Input placeholder="Notes" value={it.notes} onChange={(e) => updateItem(idx, 'notes', e.target.value)} disabled={!canWrite} size="middle" />
                  {canWrite && orderItems.length > 1
                    ? <Button size="small" type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeItem(idx)} />
                    : <span />}
                </div>
              ))}
              {canWrite && (
                <Button size="small" icon={<PlusCircleOutlined />} type="dashed" onClick={addItem} style={{ marginTop: 4 }}>
                  Add Item
                </Button>
              )}

              {canWrite && (
                <div style={{ marginTop: 28 }}>
                  <Button type="primary" loading={saving} onClick={handleSave} style={{ borderRadius: 8, fontWeight: 600, paddingInline: 28 }}>
                    {editing ? 'Save Changes' : 'Create Order'}
                  </Button>
                  <Button onClick={() => setView('list')} style={{ marginLeft: 12, borderRadius: 8 }}>Cancel</Button>
                </div>
              )}
            </Form>
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default DispatchOrdersPage;
