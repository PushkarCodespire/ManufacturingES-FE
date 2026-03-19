import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Table, Space, Tag, Form, Input, Switch, Tooltip,
  message, Card, Select, Drawer, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  CarOutlined, RightOutlined, SearchOutlined,
} from '@ant-design/icons';
import { transporterApi } from '../../../api/transporter.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { TextArea } = Input;

const VEHICLE_OPTIONS = [
  'Mini Truck', 'Light Commercial Vehicle', 'Medium Truck', 'Heavy Truck',
  'Container', 'Tempo', 'Bike', 'Car', 'Other',
];

const TransportersPage = () => {
  const { can } = usePermissions();
  const canWrite = can('dispatch-transporters-create_edit_delete');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search,  setSearch]  = useState('');
  const [form] = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transporterApi.getAll();
      setRecords(res?.data ?? res ?? []);
    } catch (err) { message.error(err?.message || 'Failed to load transporters'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openDrawer = (record = null) => {
    setEditing(record);
    form.setFieldsValue(record
      ? { ...record, vehicle_types: record.vehicle_types ?? [] }
      : { is_active: true, vehicle_types: [] });
    setDrawerOpen(true);
  };

  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); form.resetFields(); };

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
      closeDrawer();
      fetchAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (record) => {
    try {
      await transporterApi.delete(record.id);
      message.success('Transporter deleted');
      fetchAll();
    } catch (err) {
      message.error(err?.message || 'Failed to delete');
    }
  };

  const filtered = search
    ? records.filter((r) => r.name?.toLowerCase().includes(search.toLowerCase()))
    : records;

  const total    = records.length;
  const active   = records.filter((r) => r.is_active).length;
  const inactive = records.filter((r) => !r.is_active).length;

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
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1d4ed8' }} />} onClick={() => openDrawer(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete transporter?"
            description="This action cannot be undone."
            okText="Delete" okType="danger"
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="Delete">
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Dispatch</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Transporters</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Transporters</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Manage transport partners and their vehicle types.</Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
        {inactive > 0 && <Tag>Inactive: {inactive}</Tag>}
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search transporters…"
            prefix={<SearchOutlined />}
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }} allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>
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

      <Drawer
        title={editing ? `Edit — ${editing.name}` : 'Add Transporter'}
        width={520}
        open={drawerOpen}
        onClose={closeDrawer}
        footer={
          canWrite ? (
            <Space>
              <Button type="primary" loading={saving} onClick={handleSave}>
                {editing ? 'Save Changes' : 'Create Transporter'}
              </Button>
              <Button onClick={closeDrawer}>Cancel</Button>
            </Space>
          ) : null
        }
      >
        <Form form={form} layout="vertical" disabled={!canWrite} requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="name" label="Company / Transporter Name" rules={[{ required: true, message: 'Name is required' }]} style={{ gridColumn: 'span 2' }}>
              <Input placeholder="e.g. Shree Transport Co." />
            </Form.Item>
            <Form.Item name="contact_person" label="Contact Person">
              <Input placeholder="e.g. Ramesh Kumar" />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input placeholder="+91 98765 43210" />
            </Form.Item>
            <Form.Item name="email" label="Email">
              <Input placeholder="contact@transporter.com" />
            </Form.Item>
            <Form.Item name="gstin" label="GSTIN">
              <Input placeholder="22AAAAA0000A1Z5" />
            </Form.Item>
          </div>
          <Form.Item name="vehicle_types" label="Vehicle Types">
            <Select mode="multiple" placeholder="Select vehicle types" options={VEHICLE_OPTIONS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <TextArea rows={2} placeholder="Company address" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Any additional notes" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
};

export default TransportersPage;
