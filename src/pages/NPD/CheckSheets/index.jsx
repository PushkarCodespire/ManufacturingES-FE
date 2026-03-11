import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Button, Input, Table, Tag, Space, message,
  Drawer, Form, Select, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, RightOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import AppLayout         from '../../../components/AppLayout';
import usePermissions    from '../../../hooks/usePermissions';
import { checkSheetApi } from '../../../api/quality.api';
import { itemApi }       from '../../../api/item.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR = { active: 'green', inactive: 'default' };

const STAGE_OPTS = [
  { value: 'incoming',   label: 'Incoming'   },
  { value: 'in_process', label: 'In Process' },
  { value: 'final',      label: 'Final'      },
  { value: 'dispatch',   label: 'Dispatch'   },
];

export default function CheckSheetsPage() {
  const { can }  = usePermissions();
  const canWrite = can('npd-check_sheets-create_edit_delete');
  const navigate = useNavigate();

  const [records,    setRecords]    = useState([]);
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [form]                      = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await checkSheetApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch { message.error('Failed to load check-sheet templates'); }
    finally   { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] }))
      .then((r) => setItems(Array.isArray(r) ? r : (r?.data ?? [])));
  }, []);

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      template_code: r.template_code,
      name:          r.name,
      item_id:       r.item_id,
      stage:         r.stage,
      revision:      r.revision,
      description:   r.description,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      if (editing) {
        await checkSheetApi.update(editing.id, vals);
        message.success('Check-sheet template updated');
      } else {
        await checkSheetApi.create(vals);
        message.success('Check-sheet template created');
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
      await checkSheetApi.delete(id);
      message.success('Template deleted');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const baseColumns = [
    { title: 'Template Code', dataIndex: 'template_code', key: 'code',  width: 150 },
    { title: 'Name',          dataIndex: 'name',          key: 'name',  ellipsis: true },
    { title: 'Part No.',      key: 'part',                width: 130,
      render: (_, r) => r.Item?.part_no ?? '—' },
    { title: 'Rev.',          dataIndex: 'revision',      key: 'rev',   width: 60  },
    { title: 'Stage',         dataIndex: 'stage',         key: 'stage', width: 110,
      render: (v) => <Tag>{STAGE_OPTS.find((o) => o.value === v)?.label ?? v}</Tag> },
    { title: 'Dimensions',    key: 'dims',                width: 100,
      render: (_, r) => <Tag color="blue">{r.Dimensions?.length ?? 0} dims</Tag> },
    { title: 'Status',        dataIndex: 'status',        key: 'status',width: 90,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag> },
  ];

  const actionColumn = {
    title: 'Actions', key: 'actions', width: 110,
    render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Delete this template?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const openColumn = {
    title: '', key: 'open', width: 80,
    render: (_, r) => (
      <Button size="small" type="link" onClick={() => navigate(`/quality/check-sheets/${r.id}`)}>Open</Button>
    ),
  };
  const columns  = [...baseColumns, openColumn, ...(canWrite ? [actionColumn] : [])];
  const total    = records.length;
  const active   = records.filter((r) => r.status === 'active').length;
  const filtered = records.filter((r) =>
    !search ||
    r.template_code?.toLowerCase().includes(search.toLowerCase()) ||
    r.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>NPD</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Check Sheets</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Check Sheets</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Manage dimensional inspection check-sheet templates per part and stage.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search template code or name..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Template</Button>
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
        title={editing ? `Edit Template — ${editing.template_code}` : 'New Check-Sheet Template'}
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              {editing ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="template_code" label="Template Code" rules={[{ required: true }]}>
              <Input placeholder="e.g. CS-001" />
            </Form.Item>
            <Form.Item name="revision" label="Revision">
              <Input placeholder="e.g. A, B, 01" />
            </Form.Item>
          </div>

          <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Final Inspection — Bracket" />
          </Form.Item>

          <Form.Item name="item_id" label="Part / Item">
            <Select
              showSearch allowClear placeholder="Select part..."
              filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
              options={items.map((i) => ({ value: i.id, label: `${i.part_no} — ${i.name}` }))}
            />
          </Form.Item>

          <Form.Item name="stage" label="Inspection Stage" rules={[{ required: true }]}>
            <Select options={STAGE_OPTS} placeholder="Select stage" />
          </Form.Item>

          <Form.Item name="description" label="Description / Notes">
            <TextArea rows={3} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
