import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Button, Input, Table, Tag, Space, message,
  Drawer, Form, Select, Popconfirm, Modal, Spin,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, RightOutlined,
  EditOutlined, DeleteOutlined, CheckCircleOutlined,
  EyeOutlined, FilePdfOutlined, FileImageOutlined,
} from '@ant-design/icons';
import AppLayout         from '../../../components/AppLayout';
import usePermissions    from '../../../hooks/usePermissions';
import { checkSheetApi, drawingApi } from '../../../api/quality.api';
import { itemApi }                   from '../../../api/item.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR = { active: 'green', inactive: 'default', invalidated: 'red', reviewed: 'blue' };

// Files are stored at /uploads/... and proxied by Vite → localhost:5000
const toFileUrl = (filePath) => (filePath ? (filePath.startsWith('http') ? filePath : filePath) : null);

// ── Shared file preview modal ──────────────────────────────────────────────────
function FilePreviewModal({ open, url, name, onClose }) {
  if (!open) return null;
  const ext   = (name ?? '').split('.').pop().toLowerCase();
  const isPdf = ext === 'pdf';
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  return (
    <Modal
      open={open}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isPdf ? <FilePdfOutlined style={{ color: '#ef4444' }} /> : <FileImageOutlined style={{ color: '#3b82f6' }} />}
          {name || 'Drawing Preview'}
        </span>
      }
      onCancel={onClose}
      footer={
        <Button type="link" href={url} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </Button>
      }
      width={900}
      centered
      styles={{ body: { padding: 0, minHeight: 480 } }}
    >
      {isPdf && (
        <iframe
          src={url}
          title={name}
          width="100%"
          height="600px"
          style={{ border: 'none', display: 'block' }}
        />
      )}
      {isImg && (
        <div style={{ padding: 16, textAlign: 'center', background: '#f9fafb' }}>
          <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: 560, borderRadius: 4 }} />
        </div>
      )}
      {!isPdf && !isImg && (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
          <p>Cannot preview this file type.</p>
          <Button type="primary" href={url} target="_blank" rel="noreferrer">Download / Open</Button>
        </div>
      )}
    </Modal>
  );
}

export default function CheckSheetsPage() {
  const { can }  = usePermissions();
  const canWrite = can('npd-check_sheets-create_edit_delete');
  const navigate = useNavigate();

  const [records,          setRecords]          = useState([]);
  const [items,            setItems]            = useState([]);
  const [drawings,         setDrawings]         = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [search,           setSearch]           = useState('');
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [editing,          setEditing]          = useState(null);
  const [saving,           setSaving]           = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [previewModal,     setPreviewModal]     = useState({ open: false, url: '', name: '' });
  const [form]                                  = Form.useForm();

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
    drawingApi.getAll({}).catch(() => [])
      .then((r) => setDrawings(Array.isArray(r) ? r : []));
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
      drawing_id: r.drawing_id,
      item_id:    r.item_id,
      name:       r.name,
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

  // ── Preview drawing file ──────────────────────────────────────────────────
  const onPreviewDrawing = async (r) => {
    if (!r.drawing_id) { message.info('No drawing linked to this check-sheet'); return; }
    setPreviewLoadingId(r.id);
    try {
      const detail   = await drawingApi.getById(r.drawing_id);
      const versions = detail?.Versions ?? [];
      const current  = versions.find((v) => v.is_current) ?? versions[versions.length - 1];
      if (!current?.file_path) {
        message.info('No file uploaded for the linked drawing yet');
        return;
      }
      const url  = toFileUrl(current.file_path);
      const name = current.file_name ?? current.file_path.split('/').pop();
      setPreviewModal({ open: true, url, name });
    } catch { message.error('Failed to load drawing file'); }
    finally   { setPreviewLoadingId(null); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const baseColumns = [
    { title: 'Drawing',        key: 'drawing',             width: 150,
      render: (_, r) => r.Drawing?.drawing_no ?? '—' },
    { title: 'Name',          dataIndex: 'name',          key: 'name',  ellipsis: true },
    { title: 'Part No.',      key: 'part',                width: 130,
      render: (_, r) => r.Item?.code ?? '—' },
    { title: 'Rev.',          dataIndex: 'revision',      key: 'rev',   width: 60  },
    { title: 'Dimensions',    key: 'dims',                width: 100,
      render: (_, r) => <Tag color="blue">{r.Dimensions?.length ?? 0} dims</Tag> },
    { title: 'Status',        key: 'status', width: 110,
      render: (_, r) => <Tag color={STATUS_COLOR[r.sheet_status] ?? STATUS_COLOR[r.status] ?? 'default'}>{r.sheet_status || r.status}</Tag> },
  ];

  const onRevalidate = async (rid) => {
    try {
      await checkSheetApi.revalidate(rid);
      message.success('Check-sheet revalidated');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Revalidate failed'); }
  };

  const actionColumn = {
    title: 'Actions', key: 'actions', width: 150,
    render: (_, r) => (
      <Space size={4}>
        {r.sheet_status === 'invalidated' && (
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => onRevalidate(r.id)}>
            Revalidate
          </Button>
        )}
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Delete this template?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const previewColumn = {
    title: '', key: 'preview', width: 110,
    render: (_, r) => (
      <Button
        size="small"
        icon={previewLoadingId === r.id ? <Spin size="small" /> : <EyeOutlined />}
        disabled={previewLoadingId === r.id}
        onClick={() => onPreviewDrawing(r)}
      >
        Drawing
      </Button>
    ),
  };

  const openColumn = {
    title: '', key: 'open', width: 70,
    render: (_, r) => (
      <Button size="small" type="link" onClick={() => navigate(`/quality/check-sheets/${r.id}`)}>Open</Button>
    ),
  };
  const columns     = [...baseColumns, previewColumn, openColumn, ...(canWrite ? [actionColumn] : [])];
  const total       = records.length;
  const active      = records.filter((r) => r.status === 'active').length;
  const invalidated = records.filter((r) => r.sheet_status === 'invalidated').length;
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
        <Tag color="red">Invalidated: {invalidated}</Tag>
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
          <Form.Item name="drawing_id" label="Drawing" rules={[{ required: true, message: 'Drawing is required' }]}>
            <Select
              showSearch allowClear placeholder="Select drawing..."
              filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
              options={drawings.map((d) => ({ value: d.id, label: `${d.drawing_no} — ${d.title ?? ''} (Rev ${d.current_revision ?? '—'})` }))}
            />
          </Form.Item>

          <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Final Inspection — Bracket" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="item_id" label="Part / Item" rules={[{ required: true, message: 'Item is required' }]}>
              <Select
                showSearch allowClear placeholder="Select part..."
                filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
                options={items.map((i) => ({ value: i.id, label: `${i.part_no ?? i.code} — ${i.name}` }))}
              />
            </Form.Item>
            <Form.Item name="revision" label="Revision" rules={[{ required: true }]}>
              <Input placeholder="e.g. A, B, 01" />
            </Form.Item>
          </div>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Drawing File Preview Modal ──────────────────────────────────────── */}
      <FilePreviewModal
        open={previewModal.open}
        url={previewModal.url}
        name={previewModal.name}
        onClose={() => setPreviewModal((p) => ({ ...p, open: false }))}
      />
    </AppLayout>
  );
}
