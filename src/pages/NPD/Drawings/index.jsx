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
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { drawingApi } from '../../../api/quality.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR = { draft: 'default', active: 'green', obsolete: 'red' };

const DRAWING_TYPE_OPTS = [
  { value: 'component',    label: 'Component'    },
  { value: 'assembly',     label: 'Assembly'     },
  { value: 'subassembly',  label: 'Sub-Assembly' },
  { value: 'weld_drawing', label: 'Weld Drawing' },
  { value: 'tool_drawing', label: 'Tool Drawing' },
  { value: 'jig_fixture',  label: 'Jig / Fixture'},
];

export default function DrawingsPage() {
  const { can }  = usePermissions();
  const canWrite = can('npd-drawings-create_edit_delete');
  const navigate = useNavigate();

  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [form]                      = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await drawingApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch { message.error('Failed to load drawings'); }
    finally   { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      drawing_no:   r.drawing_no,
      title:        r.title,
      part_no:      r.part_no,
      drawing_type: r.drawing_type,
      material:     r.material,
      scale:        r.scale,
      sheet_size:   r.sheet_size,
      description:  r.description,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      if (editing) {
        await drawingApi.update(editing.id, vals);
        message.success('Drawing updated');
      } else {
        await drawingApi.create(vals);
        message.success('Drawing created');
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
      await drawingApi.delete(id);
      message.success('Drawing deleted');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const baseColumns = [
    { title: 'Drawing No.',  dataIndex: 'drawing_no',       key: 'drawing_no', width: 150 },
    { title: 'Title',        dataIndex: 'title',            key: 'title',      ellipsis: true },
    { title: 'Part No.',     dataIndex: 'part_no',          key: 'part_no',    width: 130 },
    { title: 'Rev.',         dataIndex: 'current_revision', key: 'rev',        width: 60  },
    { title: 'Material',     dataIndex: 'material',         key: 'material',   width: 120 },
    { title: 'Type',         dataIndex: 'drawing_type',     key: 'dtype',      width: 120,
      render: (v) => <Tag>{DRAWING_TYPE_OPTS.find((o) => o.value === v)?.label ?? v}</Tag> },
    { title: 'Status',       dataIndex: 'status',           key: 'status',     width: 90,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag> },
  ];

  const actionColumn = {
    title: 'Actions', key: 'actions', width: 110,
    render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Delete this drawing?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const openColumn = {
    title: '', key: 'open', width: 80,
    render: (_, r) => (
      <Button size="small" type="link" onClick={() => navigate(`/quality/drawings/${r.id}`)}>Open</Button>
    ),
  };
  const columns  = [...baseColumns, openColumn, ...(canWrite ? [actionColumn] : [])];
  const total    = records.length;
  const active   = records.filter((r) => r.status === 'active').length;
  const draft    = records.filter((r) => r.status === 'draft').length;
  const filtered = records.filter((r) =>
    !search ||
    r.drawing_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.part_no?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>NPD</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Engineering Drawings</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Engineering Drawings</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Manage engineering drawings, revisions and approval status.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
        <Tag color="default">Draft: {draft}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search drawing no., title or part no..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Drawing</Button>
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
        title={editing ? `Edit Drawing — ${editing.drawing_no}` : 'Add Engineering Drawing'}
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              {editing ? 'Save Changes' : 'Create Drawing'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="drawing_no" label="Drawing No." rules={[{ required: true }]}>
              <Input placeholder="e.g. DWG-001" />
            </Form.Item>
            <Form.Item name="part_no" label="Part No.">
              <Input placeholder="e.g. PN-0042" />
            </Form.Item>
          </div>

          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Drawing title..." />
          </Form.Item>

          <Form.Item name="drawing_type" label="Drawing Type" rules={[{ required: true }]}>
            <Select options={DRAWING_TYPE_OPTS} placeholder="Select type" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="material" label="Material">
              <Input placeholder="e.g. EN8, SS304" />
            </Form.Item>
            <Form.Item name="scale" label="Scale">
              <Input placeholder="e.g. 1:1, 1:2" />
            </Form.Item>
          </div>

          <Form.Item name="sheet_size" label="Sheet Size">
            <Input placeholder="e.g. A3, A4" />
          </Form.Item>

          <Form.Item name="description" label="Description / Notes">
            <TextArea rows={3} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
