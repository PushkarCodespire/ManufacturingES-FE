import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Button, Input, Table, Tag, Space, message,
  Drawer, Form, Select, DatePicker, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, RightOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { complaintApi } from '../../../api/quality.api';
import { vendorApi }    from '../../../api/vendor.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR = {
  received: 'orange', acknowledged: 'blue', investigating: 'purple',
  resolved: 'cyan',   closed: 'green',       rejected: 'red',
};

const SEVERITY_OPTS = [
  { value: 'critical', label: 'Critical' },
  { value: 'major',    label: 'Major'    },
  { value: 'minor',    label: 'Minor'    },
];

export default function ComplaintsPage() {
  const { can }  = usePermissions();
  const canWrite = can('quality-complaints-create_edit_delete');
  const navigate = useNavigate();

  const [records,    setRecords]    = useState([]);
  const [customers,  setCustomers]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [form]                      = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await complaintApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch { message.error('Failed to load complaints'); }
    finally   { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    vendorApi.getAll({ type: 'customer', limit: 500 }).catch(() => [])
      .then((d) => setCustomers(Array.isArray(d) ? d : []));
  }, []);

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ received_date: dayjs() });
    setDrawerOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      customer_id:            r.customer_id,
      customer_name:          r.customer_name,
      received_date:          r.received_date ? dayjs(r.received_date) : null,
      complaint_description:  r.complaint_description,
      severity:               r.severity,
      vehicle_reg_no:         r.vehicle_reg_no,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        ...vals,
        received_date: vals.received_date?.format('YYYY-MM-DD'),
      };
      if (editing) {
        await complaintApi.update(editing.id, payload);
        message.success('Complaint updated');
      } else {
        await complaintApi.create(payload);
        message.success('Complaint logged');
      }
      setDrawerOpen(false);
      fetchAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await complaintApi.delete(id);
      message.success('Complaint deleted');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const baseColumns = [
    { title: 'No.',         dataIndex: 'complaint_no',         key: 'no',     width: 150 },
    { title: 'Customer',    key: 'customer', width: 160,
      render: (_, r) => r.Customer?.name ?? r.customer_name ?? '—' },
    { title: 'Description', dataIndex: 'complaint_description',key: 'desc',   ellipsis: true },
    { title: 'Severity',    dataIndex: 'severity',             key: 'sev',    width: 90,
      render: (v) => <Tag color={v === 'critical' ? 'red' : v === 'major' ? 'orange' : 'default'}>{v}</Tag> },
    { title: 'Status',      dataIndex: 'status',               key: 'status', width: 120,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Due',         dataIndex: 'response_due',         key: 'due',    width: 110 },
    { title: 'Received',    dataIndex: 'received_date',        key: 'date',   width: 110 },
  ];

  const actionColumn = {
    title: 'Actions', key: 'actions', width: 110,
    render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Delete this complaint?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const openColumn = {
    title: '', key: 'open', width: 80,
    render: (_, r) => (
      <Button size="small" type="link" onClick={() => navigate(`/quality/complaints/${r.id}`)}>Open</Button>
    ),
  };
  const columns  = [...baseColumns, openColumn, ...(canWrite ? [actionColumn] : [])];
  const total    = records.length;
  const open     = records.filter((r) => !['closed', 'rejected'].includes(r.status)).length;
  const resolved = records.filter((r) => r.status === 'closed').length;
  const filtered = records.filter((r) =>
    !search ||
    r.complaint_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.complaint_description?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Customer Complaints</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Customer Complaints</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Manage customer complaints, track resolutions and close the loop.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Open: {open}</Tag>
        <Tag color="green">Resolved: {resolved}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search complaint no. or description..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Log Complaint</Button>
          )}
        </div>

        <Table
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create / Edit Drawer ───────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit Complaint — ${editing.complaint_no}` : 'Log Customer Complaint'}
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              {editing ? 'Save Changes' : 'Log Complaint'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="customer_id" label="Customer (from master)">
            <Select
              showSearch allowClear placeholder="Select customer..."
              filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>

          <Form.Item name="customer_name" label="Customer Name (if not in master)">
            <Input placeholder="Type customer name..." />
          </Form.Item>

          <Form.Item name="received_date" label="Received Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>

          <Form.Item name="severity" label="Severity" rules={[{ required: true }]}>
            <Select options={SEVERITY_OPTS} placeholder="Select severity" />
          </Form.Item>

          <Form.Item name="complaint_description" label="Complaint Description"
            rules={[{ required: true, min: 10, message: 'Min 10 characters' }]}>
            <TextArea rows={4} placeholder="Describe the complaint in detail..." />
          </Form.Item>

          <Form.Item name="vehicle_reg_no" label="Vehicle Reg. No. (if applicable)">
            <Input placeholder="e.g. MH12AB1234" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
