import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Button, Input, Table, Tag, Space, message,
  Drawer, Form, Select, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, RightOutlined,
  EditOutlined, DeleteOutlined,
DownloadOutlined, } from '@ant-design/icons';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { pfmeaApi }   from '../../../api/quality.api';
import { itemApi }    from '../../../api/item.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR = {
  draft:        'default',
  active:       'green',
  under_review: 'blue',
  obsolete:     'red',
};

export default function PFMEAPage() {
  const { can }  = usePermissions();
  const canWrite = can('npd-pfmea-create_edit_delete');
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
      const data = await pfmeaApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) { message.error(err?.message || 'Failed to load PFMEA records'); }
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
      title:      r.title,
      item_id:    r.item_id,
      drawing_id: r.drawing_id,
      revision:   r.revision,
      notes:      r.notes,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      if (editing) {
        await pfmeaApi.update(editing.id, vals);
        message.success('PFMEA updated');
      } else {
        await pfmeaApi.create(vals);
        message.success('PFMEA created');
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
      await pfmeaApi.delete(id);
      message.success('PFMEA deleted');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const baseColumns = [
    { title: 'PFMEA No.',    dataIndex: 'pfmea_no',    key: 'pfmea_no', width: 140 },
    { title: 'Title',        dataIndex: 'title',       key: 'title',    ellipsis: true },
    { title: 'Part No.',     key: 'part',              width: 130,
      render: (_, r) => r.Item?.code ?? '—' },
    { title: 'Rev.',         dataIndex: 'revision',    key: 'rev',      width: 60  },
    { title: 'Items',        key: 'items',             width: 80,
      render: (_, r) => <Tag color="blue">{r.PfmeaItems?.length ?? 0} items</Tag> },
    { title: 'High AP',      key: 'high_risk',         width: 90,
      render: (_, r) => {
        const high = (r.PfmeaItems ?? []).filter((i) => (i.action_priority ?? 0) >= 100).length;
        return high > 0
          ? <Tag color="red">{high} High</Tag>
          : <Tag color="green">OK</Tag>;
      }},
    { title: 'Status',       dataIndex: 'status',      key: 'status',   width: 110,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
  ];

  const actionColumn = {
    title: 'Actions', key: 'actions', width: 110,
    render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Delete this PFMEA?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const openColumn = {
    title: '', key: 'open', width: 80,
    render: (_, r) => (
      <Button size="small" type="link" onClick={() => navigate(`/quality/pfmea/${r.id}`)}>Open</Button>
    ),
  };
  const columns  = [...baseColumns, openColumn, ...(canWrite ? [actionColumn] : [])];
  const total    = records.length;
  const active   = records.filter((r) => r.status === 'active').length;
  const highAP   = records.filter((r) =>
    (r.PfmeaItems ?? []).some((i) => (i.action_priority ?? 0) >= 100),
  ).length;

  const filtered = records.filter((r) =>
    !search ||
    r.pfmea_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.title?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>NPD</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>PFMEA</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>PFMEA</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Process Failure Mode &amp; Effects Analysis — manage risk and action priority.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
        {highAP > 0 && <Tag color="red">High AP: {highAP}</Tag>}
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search PFMEA no., title or process..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('p-f-m-e-a.csv', filtered, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New PFMEA</Button>
          )}
        </div>

        <Table
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* ── Create / Edit Drawer ───────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit PFMEA — ${editing.pfmea_no}` : 'New PFMEA'}
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              {editing ? 'Save Changes' : 'Create PFMEA'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="title" label="PFMEA Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Bracket Assembly PFMEA" />
          </Form.Item>

          <Form.Item name="item_id" label="Related Part / Item" rules={[{ required: true, message: 'Item is required' }]}>
            <Select
              showSearch allowClear placeholder="Select part..."
              filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
              options={items.map((i) => ({ value: i.id, label: `${i.code ?? i.part_no} — ${i.name}` }))}
            />
          </Form.Item>

          <Form.Item name="revision" label="Revision">
            <Input placeholder="e.g. A, B, 01" />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Scope, assumptions, or any relevant notes..." />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
