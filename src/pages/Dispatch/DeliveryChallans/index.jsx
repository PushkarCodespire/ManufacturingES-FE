import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Table, Space, Tag, Form, Input, Select, DatePicker,
  message, Card, Modal, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  RightOutlined, SearchOutlined, ArrowLeftOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { deliveryChallanApi } from '../../../api/deliveryChallan.api';
import { dispatchOrderApi }   from '../../../api/dispatchOrder.api';
import AppLayout              from '../../../components/AppLayout';
import { useAuth }            from '../../../context/AuthContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLORS = { pending: 'default', issued: 'blue', signed: 'green', archived: 'gray' };
const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'issued',   label: 'Issued'   },
  { value: 'signed',   label: 'Signed'   },
  { value: 'archived', label: 'Archived' },
];

const DeliveryChallansPage = () => {
  const { user } = useAuth();
  const canWrite = ['dispatch_admin', 'it_admin', 'plant_head'].includes(user?.role?.name);

  const [records,      setRecords]      = useState([]);
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [view,         setView]         = useState('list');
  const [editing,      setEditing]      = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [search,       setSearch]       = useState('');
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await deliveryChallanApi.getAll(params);
      setRecords(res?.data ?? res ?? []);
    } catch { message.error('Failed to load challans'); }
    finally { setLoading(false); }
  }, [filterStatus]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await dispatchOrderApi.getAll();
      setOrders(res?.data ?? res ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openForm = (record = null) => {
    setEditing(record);
    if (record) {
      form.setFieldsValue({
        ...record,
        issued_date: record.issued_date ? dayjs(record.issued_date) : null,
        signed_date: record.signed_date ? dayjs(record.signed_date) : null,
      });
    } else {
      form.setFieldsValue({ status: 'pending' });
    }
    setView('form');
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        issued_date: values.issued_date?.format('YYYY-MM-DD') || null,
        signed_date: values.signed_date?.format('YYYY-MM-DD') || null,
      };
      if (editing) {
        await deliveryChallanApi.update(editing.id, payload);
        message.success('Challan updated');
      } else {
        await deliveryChallanApi.create(payload);
        message.success('Challan created');
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
      title: `Delete challan ${record.challan_number}?`,
      content: 'This action cannot be undone.',
      okText: 'Delete', okType: 'danger',
      onOk: async () => {
        try {
          await deliveryChallanApi.delete(record.id);
          message.success('Challan deleted');
          fetchAll();
        } catch (err) {
          message.error(err?.response?.data?.message || 'Failed to delete');
        }
      },
    });
  };

  const filtered = search
    ? records.filter((r) =>
        r.challan_number?.toLowerCase().includes(search.toLowerCase()) ||
        r.DispatchOrder?.order_number?.toLowerCase().includes(search.toLowerCase()))
    : records;

  const issued  = records.filter((r) => r.status === 'issued').length;
  const signed  = records.filter((r) => r.status === 'signed').length;

  const columns = [
    {
      title: 'Challan #', dataIndex: 'challan_number', key: 'challan_number',
      render: (v) => <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Dispatch Order', key: 'order',
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.DispatchOrder?.order_number || '—'}</Text>,
    },
    {
      title: 'Customer', key: 'customer',
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.DispatchOrder?.Customer?.name || '—'}</Text>,
    },
    {
      title: 'Issued Date', dataIndex: 'issued_date', key: 'issued_date', width: 130,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</Text>,
    },
    {
      title: 'Signed Date', dataIndex: 'signed_date', key: 'signed_date', width: 130,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</Text>,
    },
    {
      title: 'Receiver', dataIndex: 'receiver_name', key: 'receiver_name',
      render: (v) => <Text style={{ fontSize: 13 }}>{v || '—'}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v) => <Tag color={STATUS_COLORS[v]}>{v?.toUpperCase()}</Tag>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 90, align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1d4ed8' }} />} onClick={() => openForm(record)} />
          </Tooltip>
          {record.status !== 'signed' && (
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
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Delivery Challans</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Delivery Challans</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Generate and track delivery challans for dispatched orders</Text>
      </div>

      {view === 'list' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total',    value: records.length, color: '#1d4ed8', bg: '#eff6ff' },
              { label: 'Issued',   value: issued,         color: '#d97706', bg: '#fffbeb' },
              { label: 'Signed',   value: signed,         color: '#16a34a', bg: '#f0fdf4' },
            ].map((s) => (
              <div key={s.label} style={{ padding: '8px 16px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
                <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{s.value}</Text>
                <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
              </div>
            ))}
          </div>

          <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} styles={{ body: { padding: '16px 20px' } }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <Input
                placeholder="Search challan or order…"
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
                  New Challan
                </Button>
              )}
            </div>
            <Table
              rowKey="id" dataSource={filtered} columns={columns} loading={loading}
              size="middle" scroll={{ x: 900 }}
              pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} challans` }}
              locale={{ emptyText: (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <FileTextOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                  <Text style={{ color: '#9ca3af' }}>No delivery challans yet</Text>
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
              {editing ? `Edit — ${editing.challan_number}` : 'New Delivery Challan'}
            </Title>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', maxWidth: 680 }}>
            <Form form={form} layout="vertical" disabled={!canWrite} requiredMark={false} size="large">
              <Form.Item name="dispatch_order_id" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Dispatch Order *</span>} rules={[{ required: true, message: 'Select a dispatch order' }]}>
                <Select showSearch allowClear placeholder="Select dispatch order"
                  filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                  options={orders.map((o) => ({ value: o.id, label: `${o.order_number}${o.Customer ? ` — ${o.Customer.name}` : ''}` }))} />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 20px' }}>
                <Form.Item name="status" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Status</span>}>
                  <Select options={STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="issued_date" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Issued Date</span>}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="signed_date" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Signed Date</span>}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="receiver_name" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Receiver Name</span>}>
                  <Input placeholder="Name of person receiving goods" />
                </Form.Item>
                <Form.Item name="receiver_phone" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Receiver Phone</span>}>
                  <Input placeholder="+91 98765 43210" />
                </Form.Item>
              </div>
              <Form.Item name="delivery_notes" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Delivery Notes</span>}>
                <TextArea rows={3} placeholder="Any delivery notes or remarks" />
              </Form.Item>
              {canWrite && (
                <div>
                  <Button type="primary" loading={saving} onClick={handleSave} style={{ borderRadius: 8, fontWeight: 600, paddingInline: 28 }}>
                    {editing ? 'Save Changes' : 'Create Challan'}
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

export default DeliveryChallansPage;
