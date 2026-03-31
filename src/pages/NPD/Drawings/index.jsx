import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Button, Input, Table, Tag, Space, message,
  Drawer, Form, Popconfirm, Modal, Spin,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, RightOutlined,
  EditOutlined, DeleteOutlined, EyeOutlined, UploadOutlined,
  FilePdfOutlined, FileImageOutlined,
DownloadOutlined, } from '@ant-design/icons';
import AppLayout         from '../../../components/AppLayout';
import ResponsiveTable   from '../../../components/ResponsiveTable';
import usePermissions from '../../../hooks/usePermissions';
import { drawingApi } from '../../../api/quality.api';
import { uploadApi }  from '../../../api/orders.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR = { draft: 'default', active: 'green', obsolete: 'red' };

// Files are stored at /uploads/... and proxied by Vite → localhost:5000
const toFileUrl = (filePath) => (filePath ? (filePath.startsWith('http') ? filePath : filePath) : null);

// ── Shared file preview modal ──────────────────────────────────────────────────
function FilePreviewModal({ open, url, name, onClose }) {
  if (!open) return null;
  const ext  = (name ?? '').split('.').pop().toLowerCase();
  const isPdf = ext === 'pdf';
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  return (
    <Modal
      open={open}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isPdf ? <FilePdfOutlined style={{ color: '#ef4444' }} /> : <FileImageOutlined style={{ color: '#3b82f6' }} />}
          {name || 'File Preview'}
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

export default function DrawingsPage() {
  const { can }  = usePermissions();
  const canWrite = can('npd-drawings-create_edit_delete');
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [records,          setRecords]          = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [search,           setSearch]           = useState('');
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [editing,          setEditing]          = useState(null);
  const [saving,           setSaving]           = useState(false);
  const [selectedFile,     setSelectedFile]     = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const [previewModal,     setPreviewModal]     = useState({ open: false, url: '', name: '' });
  const [form]                                  = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await drawingApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) { message.error(err?.message || 'Failed to load drawings'); }
    finally   { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── File change ────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
    e.target.value = '';
  };

  // ── Preview ────────────────────────────────────────────────────────────────
  const onPreview = async (r) => {
    setPreviewLoadingId(r.id);
    try {
      const detail   = await drawingApi.getById(r.id);
      const versions = detail?.Versions ?? [];
      const current  = versions.find((v) => v.is_current) ?? versions[versions.length - 1];
      if (!current?.file_path) {
        message.info('No file uploaded for this drawing yet');
        return;
      }
      const url  = toFileUrl(current.file_path);
      const name = current.file_name ?? current.file_path.split('/').pop();
      setPreviewModal({ open: true, url, name });
    } catch (err) { message.error(err?.message || 'Failed to load drawing file'); }
    finally   { setPreviewLoadingId(null); }
  };

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setSelectedFile(null);
    setDrawerOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      drawing_no:       r.drawing_no,
      title:            r.title,
      current_revision: r.current_revision,
      customer:         r.customer,
      material:         r.material,
      notes:            r.notes,
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
        const newDrawing = await drawingApi.create(vals);
        // Upload initial file if selected
        if (selectedFile && newDrawing?.id) {
          try {
            const fd = new FormData();
            fd.append('file', selectedFile);
            const uploadRes = await uploadApi.uploadDrawing(fd);
            const filePath  = uploadRes?.file_path ?? uploadRes?.path ?? uploadRes?.url ?? String(uploadRes);
            await drawingApi.addVersion(newDrawing.id, {
              revision:    vals.current_revision,
              file_path:   filePath,
              file_name:   selectedFile.name,
              file_size:   selectedFile.size,
            });
            message.success('Drawing created with file uploaded');
          } catch {
            message.success('Drawing created');
            message.warning('File upload failed — you can upload it from the drawing detail page');
          }
        } else {
          message.success('Drawing created');
        }
      }
      setDrawerOpen(false);
      setSelectedFile(null);
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
    { title: 'Rev.',         dataIndex: 'current_revision', key: 'rev',        width: 60  },
    { title: 'Material',     dataIndex: 'material',         key: 'material',   width: 120 },
    { title: 'Customer',     dataIndex: 'customer',         key: 'customer',   width: 130, ellipsis: true },
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

  const previewColumn = {
    title: '', key: 'preview', width: 90,
    render: (_, r) => (
      <Button
        size="small"
        icon={previewLoadingId === r.id ? <Spin size="small" /> : <EyeOutlined />}
        disabled={previewLoadingId === r.id}
        onClick={() => onPreview(r)}
      >
        Preview
      </Button>
    ),
  };

  const openColumn = {
    title: '', key: 'open', width: 70,
    render: (_, r) => (
      <Button size="small" type="link" onClick={() => navigate(`/quality/drawings/${r.id}`)}>Open</Button>
    ),
  };
  const columns  = [...baseColumns, previewColumn, openColumn, ...(canWrite ? [actionColumn] : [])];
  const total    = records.length;
  const active   = records.filter((r) => r.status === 'active').length;
  const draft    = records.filter((r) => r.status === 'draft').length;
  const filtered = records.filter((r) =>
    !search ||
    r.drawing_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.current_revision?.toLowerCase().includes(search.toLowerCase()),
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
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('drawings.csv', filtered, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Drawing</Button>
          )}
        </div>

        <ResponsiveTable
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          loading={loading}
          size="small"
          scroll={{ x: 850 }}
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
            <Form.Item name="current_revision" label="Revision" rules={[{ required: true }]}>
              <Input placeholder="e.g. A, B, 01" />
            </Form.Item>
          </div>

          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Drawing title..." />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="material" label="Material">
              <Input placeholder="e.g. EN8, SS304" />
            </Form.Item>
            <Form.Item name="customer" label="Customer">
              <Input placeholder="e.g. Tata Motors" />
            </Form.Item>
          </div>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Optional notes..." />
          </Form.Item>

          {/* File upload — only on create */}
          {!editing && (
            <Form.Item label="Drawing File (optional)">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Button icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>
                  Choose File
                </Button>
                {selectedFile ? (
                  <span style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FilePdfOutlined style={{ color: '#ef4444' }} />
                    {selectedFile.name}
                    <Button
                      type="text"
                      size="small"
                      danger
                      style={{ padding: '0 4px', height: 'auto', fontSize: 11 }}
                      onClick={() => setSelectedFile(null)}
                    >
                      ✕
                    </Button>
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>No file selected — PDF, JPG, PNG</span>
                )}
              </div>
            </Form.Item>
          )}
        </Form>
      </Drawer>

      {/* ── File Preview Modal ──────────────────────────────────────────────── */}
      <FilePreviewModal
        open={previewModal.open}
        url={previewModal.url}
        name={previewModal.name}
        onClose={() => setPreviewModal((p) => ({ ...p, open: false }))}
      />
    </AppLayout>
  );
}
