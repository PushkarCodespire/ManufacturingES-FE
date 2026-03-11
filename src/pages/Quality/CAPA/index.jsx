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
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { capaApi }    from '../../../api/quality.api';
import { userApi }    from '../../../api/user.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR = {
  open: 'orange', in_progress: 'blue', effectiveness: 'purple',
  closed: 'green', cancelled: 'default',
};

const CAPA_TYPE_OPTS   = [{ value: 'capa', label: 'CAPA' }, { value: 'car', label: 'CAR' }];
const SOURCE_OPTS      = [
  { value: 'customer_complaint',  label: 'Customer Complaint'   },
  { value: 'internal_audit',      label: 'Internal Audit'       },
  { value: 'ncr',                 label: 'NCR'                  },
  { value: 'warranty',            label: 'Warranty'             },
  { value: 'production_rejection',label: 'Production Rejection' },
  { value: 'supplier_rejection',  label: 'Supplier Rejection'   },
  { value: 'other',               label: 'Other'                },
];

export default function CAPAPage() {
  const { can }  = usePermissions();
  const canWrite = can('quality-capa-create_edit_delete');
  const navigate = useNavigate();

  const [records,    setRecords]    = useState([]);
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [form]                      = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await capaApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch { message.error('Failed to load CAPA records'); }
    finally   { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    userApi.getAll({ limit: 500, is_active: true }).catch(() => [])
      .then((d) => setUsers(Array.isArray(d) ? d : []));
  }, []);

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ detection_date: dayjs(), due_date: dayjs().add(30, 'day') });
    setDrawerOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      capa_type:          r.capa_type,
      source:             r.source,
      problem_description:r.problem_description,
      problem_statement:  r.problem_statement,
      detection_date:     r.detection_date ? dayjs(r.detection_date) : null,
      due_date:           r.due_date       ? dayjs(r.due_date)       : null,
      champion_id:        r.champion_id,
      d1_team_selection:  r.d1_team_selection,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        ...vals,
        detection_date: vals.detection_date?.format('YYYY-MM-DD'),
        due_date:       vals.due_date?.format('YYYY-MM-DD'),
      };
      if (editing) {
        await capaApi.update(editing.id, payload);
        message.success('CAPA updated');
      } else {
        await capaApi.create(payload);
        message.success('CAPA created');
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
      await capaApi.delete(id);
      message.success('CAPA deleted');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const baseColumns = [
    { title: 'CAPA No.',  dataIndex: 'capa_no',             key: 'capa_no',  width: 140 },
    { title: 'Type',      dataIndex: 'capa_type',           key: 'type',     width: 80,
      render: (v) => <Tag color={v === 'capa' ? 'blue' : 'orange'}>{v?.toUpperCase()}</Tag> },
    { title: 'Source',    dataIndex: 'source',              key: 'source',   width: 160,
      render: (v) => SOURCE_OPTS.find((o) => o.value === v)?.label ?? v },
    { title: 'Problem',   dataIndex: 'problem_description', key: 'problem',  ellipsis: true },
    { title: 'Champion',  key: 'champion', width: 140,
      render: (_, r) => r.Champion?.name ?? '—' },
    { title: 'Status',    dataIndex: 'status',              key: 'status',   width: 110,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Due Date',  dataIndex: 'due_date',            key: 'due',      width: 110 },
  ];

  const actionColumn = {
    title: 'Actions', key: 'actions', width: 110,
    render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Delete this CAPA?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const openColumn = {
    title: '', key: 'open', width: 80,
    render: (_, r) => (
      <Button size="small" type="link" onClick={() => navigate(`/quality/capa/${r.id}`)}>Open</Button>
    ),
  };
  const columns = [...baseColumns, openColumn, ...(canWrite ? [actionColumn] : [])];

  const total  = records.length;
  const open   = records.filter((r) => r.status !== 'closed' && r.status !== 'cancelled').length;
  const closed = records.filter((r) => r.status === 'closed').length;

  const filtered = records.filter((r) =>
    !search ||
    r.capa_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.problem_description?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>CAPA / 8D</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>CAPA / 8D</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Manage Corrective &amp; Preventive Actions using 8D methodology.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Open: {open}</Tag>
        <Tag color="green">Closed: {closed}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search CAPA no. or description..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New CAPA</Button>
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
        title={editing ? `Edit CAPA — ${editing.capa_no}` : 'New CAPA / 8D'}
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              {editing ? 'Save Changes' : 'Create CAPA'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="capa_type" label="CAPA Type" rules={[{ required: true }]}>
            <Select options={CAPA_TYPE_OPTS} placeholder="Select type" />
          </Form.Item>

          <Form.Item name="source" label="Source" rules={[{ required: true }]}>
            <Select options={SOURCE_OPTS} placeholder="Select source" />
          </Form.Item>

          <Form.Item name="problem_description" label="Problem Description"
            rules={[{ required: true, min: 10, message: 'Min 10 characters' }]}>
            <TextArea rows={3} placeholder="Describe the problem clearly..." />
          </Form.Item>

          <Form.Item name="problem_statement" label="Problem Statement (5W2H)">
            <TextArea rows={3} placeholder="Who, What, When, Where, Why, How, How many..." />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="detection_date" label="Detection Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="due_date" label="Due Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </div>

          <Form.Item name="champion_id" label="CAPA Champion">
            <Select
              showSearch
              allowClear
              placeholder="Assign champion..."
              filterOption={(input, opt) =>
                opt?.label?.toLowerCase().includes(input.toLowerCase())
              }
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>

          <Form.Item name="d1_team_selection" label="D1 — Team Members">
            <Input placeholder="e.g. John, Priya, Rahul..." />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
