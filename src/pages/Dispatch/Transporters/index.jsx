import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Table, Space, Tag, Form, Input, Switch, Tooltip,
  message, Card, Select, Modal,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  CarOutlined, RightOutlined, SearchOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { transporterApi } from '../../../api/transporter.api';
import AppLayout from '../../../components/AppLayout';
import { useAuth } from '../../../context/AuthContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

const VEHICLE_OPTIONS = [
  'Mini Truck', 'Light Commercial Vehicle', 'Medium Truck', 'Heavy Truck',
  'Container', 'Tempo', 'Bike', 'Car', 'Other',
];

const TransportersPage = () => {
  const { user } = useAuth();
  const canWrite = ['dispatch_admin', 'it_admin', 'plant_head'].includes(user?.role?.name);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [view,    setView]    = useState('list');
  const [editing, setEditing] = useState(null);
  const [search,  setSearch]  = useState('');
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transporterApi.getAll();
      setRecords(res?.data ?? res ?? []);
    } catch { message.error('Failed to load transporters'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openForm = (record = null) => {
    setEditing(record);
    form.setFieldsValue(record
      ? { ...record, vehicle_types: record.vehicle_types ?? [] }
      : { is_active: true, vehicle_types: [] });
    setView('form');
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editing) {
        await transporterApi.update(editing.id, values);
        message.success('Transporter updated');
      } else {
        await transporterApi.create(values);
        message.success('Transporter created');
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
      title: `Delete "${record.name}"?`,
      content: 'This action cannot be undone.',
      okText: 'Delete', okType: 'danger',
      onOk: async () => {
        try {
          await transporterApi.delete(record.id);
          message.success('Transporter deleted');
          fetchAll();
        } catch (err) {
          message.error(err?.response?.data?.message || 'Failed to delete');
        }
      },
    });
  };

  const filtered = search
    ? records.filter((r) => r.name?.toLowerCase().includes(search.toLowerCase()))
    : records;

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v) => <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Contact Person', dataIndex: 'contact_person', key: 'contact_person',
      render: (v) => <Text style={{ fontSize: 13 }}>{v || '—'}</Text>,
    },
    {
      title: 'Phone', dataIndex: 'phone', key: 'phone', width: 140,
      render: (v) => <Text style={{ fontSize: 13 }}>{v || '—'}</Text>,
    },
    {
      title: 'GSTIN', dataIndex: 'gstin', key: 'gstin', width: 160,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{v || '—'}</Text>,
    },
    {
      title: 'Vehicle Types', dataIndex: 'vehicle_types', key: 'vehicle_types',
      render: (arr) => (arr ?? []).length > 0
        ? (arr ?? []).map((v) => <Tag key={v} style={{ marginBottom: 2 }}>{v}</Tag>)
        : <Text style={{ color: '#9ca3af', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 90, align: 'center',
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 90, align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1d4ed8' }} />} onClick={() => openForm(record)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
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
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Transporters</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Transporters</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Manage transport partners and their vehicle types</Text>
      </div>

      {view === 'list' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total',    value: records.length,                             color: '#1d4ed8', bg: '#eff6ff' },
              { label: 'Active',   value: records.filter((r) => r.is_active).length,  color: '#16a34a', bg: '#f0fdf4' },
              { label: 'Inactive', value: records.filter((r) => !r.is_active).length, color: '#9ca3af', bg: '#f9fafb' },
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
                placeholder="Search transporters…"
                prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240, borderRadius: 8 }} allowClear
              />
              <div style={{ flex: 1 }} />
              <Button icon={<ReloadOutlined />} onClick={fetchAll} style={{ borderRadius: 8 }}>Refresh</Button>
              {canWrite && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()} style={{ borderRadius: 8, fontWeight: 600 }}>
                  Add Transporter
                </Button>
              )}
            </div>
            <Table
              rowKey="id" dataSource={filtered} columns={columns} loading={loading}
              size="middle" scroll={{ x: 900 }}
              pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} transporters` }}
              locale={{ emptyText: (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <CarOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                  <Text style={{ color: '#9ca3af' }}>No transporters yet</Text>
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
              {editing ? `Edit — ${editing.name}` : 'Add Transporter'}
            </Title>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', maxWidth: 720 }}>
            <Form form={form} layout="vertical" disabled={!canWrite} requiredMark={false} size="large">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <Form.Item name="name" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Company / Transporter Name *</span>} rules={[{ required: true, message: 'Name is required' }]}>
                  <Input placeholder="e.g. Shree Transport Co." />
                </Form.Item>
                <Form.Item name="contact_person" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Contact Person</span>}>
                  <Input placeholder="e.g. Ramesh Kumar" />
                </Form.Item>
                <Form.Item name="phone" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Phone</span>}>
                  <Input placeholder="+91 98765 43210" />
                </Form.Item>
                <Form.Item name="email" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Email</span>}>
                  <Input placeholder="contact@transporter.com" />
                </Form.Item>
                <Form.Item name="gstin" label={<span style={{ fontWeight: 500, fontSize: 13 }}>GSTIN</span>}>
                  <Input placeholder="22AAAAA0000A1Z5" />
                </Form.Item>
                <Form.Item name="is_active" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Active</span>} valuePropName="checked">
                  <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                </Form.Item>
              </div>
              <Form.Item name="vehicle_types" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Vehicle Types</span>}>
                <Select mode="multiple" placeholder="Select vehicle types" options={VEHICLE_OPTIONS.map((v) => ({ value: v, label: v }))} />
              </Form.Item>
              <Form.Item name="address" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Address</span>}>
                <TextArea rows={2} placeholder="Company address" />
              </Form.Item>
              <Form.Item name="notes" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Notes</span>}>
                <TextArea rows={2} placeholder="Any additional notes" />
              </Form.Item>
              {canWrite && (
                <div>
                  <Button type="primary" loading={saving} onClick={handleSave} style={{ borderRadius: 8, fontWeight: 600, paddingInline: 28 }}>
                    {editing ? 'Save Changes' : 'Create Transporter'}
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

export default TransportersPage;
