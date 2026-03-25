import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography, Card, Button, Descriptions, Tag, Space, message,
  Drawer, Form, Input, DatePicker, Table, Popconfirm, Modal,
} from 'antd';
import {
  ArrowLeftOutlined, RightOutlined, UploadOutlined,
  CheckOutlined, StopOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { drawingApi } from '../../../api/quality.api';
import { uploadApi }  from '../../../api/orders.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR    = { draft: 'default', active: 'green', obsolete: 'red' };
const DTYPE_LABELS    = {
  component: 'Component', assembly: 'Assembly', subassembly: 'Sub-Assembly',
  weld_drawing: 'Weld Drawing', tool_drawing: 'Tool Drawing', jig_fixture: 'Jig / Fixture',
};

export default function DrawingDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { can }    = usePermissions();
  const canWrite   = can('npd-drawings-create_edit_delete');
  const fileRef    = useRef(null);

  const [drawing,      setDrawing]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [approveOpen,  setApproveOpen]  = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [form]                          = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await drawingApi.getById(id);
      setDrawing(data);
    } catch (err) { message.error(err?.message || 'Failed to load drawing'); }
    finally   { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── File change ────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
    e.target.value = '';
  };

  // ── Upload revision ────────────────────────────────────────────────────────
  const onUploadRevision = async () => {
    try {
      const vals = await form.validateFields();
      if (!selectedFile) { message.error('Please choose a file first'); return; }
      setSaving(true);

      // Check cascade impact on check-sheets before proceeding
      let cascadeInfo = null;
      try {
        cascadeInfo = await drawingApi.checkCascade(id);
      } catch { /* ignore cascade check failures */ }

      if (cascadeInfo && cascadeInfo.count > 0) {
        const confirmed = await new Promise((resolve) => {
          Modal.confirm({
            title: 'Check-Sheet Cascade Warning',
            icon: <ExclamationCircleOutlined />,
            content: (
              <div>
                <p>Uploading a new revision will <strong>invalidate {cascadeInfo.count} check-sheet(s)</strong>:</p>
                <ul style={{ maxHeight: 160, overflow: 'auto', paddingLeft: 20, margin: '8px 0' }}>
                  {(cascadeInfo.affected_check_sheets ?? []).map((cs, i) => (
                    <li key={i} style={{ fontSize: 13, marginBottom: 2 }}>{cs.template_code ?? cs}</li>
                  ))}
                </ul>
                <p>These check-sheets will need to be reviewed and revalidated after this revision.</p>
              </div>
            ),
            okText: 'Proceed with Upload',
            cancelText: 'Cancel',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!confirmed) { setSaving(false); return; }
      }

      const fd = new FormData();
      fd.append('file', selectedFile);
      const uploadRes = await uploadApi.uploadDrawing(fd);
      const filePath  = uploadRes?.file_path ?? uploadRes?.path ?? uploadRes?.url ?? String(uploadRes);

      const result = await drawingApi.addVersion(id, {
        revision:     vals.revision,
        drawn_by:     vals.drawn_by,
        drawing_date: vals.drawing_date?.format('YYYY-MM-DD'),
        change_desc:  vals.change_desc,
        file_path:    filePath,
        file_name:    selectedFile.name,
        file_size:    selectedFile.size,
      });
      const affectedCount = result?.affected_check_sheets ?? cascadeInfo?.count ?? 0;
      message.success(
        affectedCount > 0
          ? `Revision uploaded successfully — ${affectedCount} check-sheet(s) invalidated`
          : 'Revision uploaded successfully'
      );
      setDrawerOpen(false);
      setSelectedFile(null);
      form.resetFields();
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Upload failed');
    } finally { setSaving(false); }
  };

  // ── Approve ────────────────────────────────────────────────────────────────
  const onApprove = async () => {
    try {
      await drawingApi.approve(id, { notes: approveNotes });
      message.success('Drawing approved');
      setApproveOpen(false);
      setApproveNotes('');
      load();
    } catch (err) { message.error(err?.message || 'Approve failed'); }
  };

  // ── Obsolete ───────────────────────────────────────────────────────────────
  const onObsolete = async () => {
    try {
      await drawingApi.obsolete(id);
      message.success('Drawing marked as obsolete');
      load();
    } catch (err) { message.error(err?.message || 'Failed'); }
  };

  // ── Version table ──────────────────────────────────────────────────────────
  const versionCols = [
    { title: 'Rev.',     dataIndex: 'revision',     key: 'rev',   width: 60 },
    { title: 'Current',  key: 'cur', width: 80,
      render: (_, r) => r.is_current ? <Tag color="green">Current</Tag> : null },
    { title: 'File',     dataIndex: 'file_name',    key: 'file',  ellipsis: true },
    { title: 'Size',     dataIndex: 'file_size',    key: 'size',  width: 90,
      render: (v) => v ? `${(v / 1024).toFixed(1)} KB` : '—' },
    { title: 'Drawn By', dataIndex: 'drawn_by',     key: 'by',    width: 120 },
    { title: 'Date',     dataIndex: 'drawing_date', key: 'date',  width: 110 },
    { title: 'Change Description', dataIndex: 'change_desc', key: 'desc', ellipsis: true },
    { title: 'View', key: 'view', width: 60,
      render: (_, r) => r.file_path
        ? <a href={r.file_path} target="_blank" rel="noreferrer">View</a>
        : '—' },
  ];

  if (loading) return <AppLayout><div style={{ padding: 40, color: '#6b7280' }}>Loading drawing…</div></AppLayout>;
  if (!drawing) return <AppLayout><div style={{ padding: 40, color: '#ef4444' }}>Drawing not found.</div></AppLayout>;

  const versions = drawing.Versions ?? [];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>NPD</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text
          style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
          onClick={() => navigate('/quality/drawings')}
        >
          Drawings
        </Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{drawing.drawing_no}</Text>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quality/drawings')}>Back</Button>
        <div>
          <Title level={3} style={{ margin: 0 }}>{drawing.drawing_no} — {drawing.title}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Engineering Drawing Detail</Text>
        </div>
      </div>

      {/* Card 1 — Drawing Info */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
        bodyStyle={{ padding: '16px 20px' }}
        title="Drawing Information"
        extra={canWrite && (
          <Space>
            {drawing.status === 'draft' && (
              <Button type="primary" icon={<CheckOutlined />} onClick={() => setApproveOpen(true)}>
                Approve
              </Button>
            )}
            {drawing.status === 'active' && (
              <Popconfirm
                title="Mark as Obsolete?"
                description="This action cannot be undone."
                onConfirm={onObsolete}
                okText="Mark Obsolete"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<StopOutlined />}>Mark Obsolete</Button>
              </Popconfirm>
            )}
          </Space>
        )}
      >
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Drawing No.">{drawing.drawing_no}</Descriptions.Item>
          <Descriptions.Item label="Title">{drawing.title}</Descriptions.Item>
          <Descriptions.Item label="Part No.">{drawing.part_no || '—'}</Descriptions.Item>
          <Descriptions.Item label="Drawing Type">{DTYPE_LABELS[drawing.drawing_type] ?? drawing.drawing_type ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Material">{drawing.material || '—'}</Descriptions.Item>
          <Descriptions.Item label="Scale">{drawing.scale || '—'}</Descriptions.Item>
          <Descriptions.Item label="Sheet Size">{drawing.sheet_size || '—'}</Descriptions.Item>
          <Descriptions.Item label="Current Revision">{drawing.current_revision || '—'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={STATUS_COLOR[drawing.status] ?? 'default'}>
              {drawing.status ?? '—'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Approved By">{drawing.ApprovedBy?.name ?? '—'}</Descriptions.Item>
          {drawing.approved_at && (
            <Descriptions.Item label="Approved At">
              {dayjs(drawing.approved_at).format('DD-MMM-YYYY')}
            </Descriptions.Item>
          )}
          {drawing.description && (
            <Descriptions.Item label="Notes / Description" span={2}>
              {drawing.description}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Card 2 — Drawing Versions */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
        title={`Drawing Versions (${versions.length})`}
        extra={canWrite && (
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => { form.resetFields(); setSelectedFile(null); setDrawerOpen(true); }}
          >
            Upload New Revision
          </Button>
        )}
      >
        <Table
          rowKey="id"
          dataSource={versions}
          columns={versionCols}
          size="small"
          pagination={false}
          scroll={{ x: 800 }}
          locale={{ emptyText: 'No revisions uploaded yet' }}
        />
      </Card>

      {/* Upload Revision Drawer */}
      <Drawer
        title="Upload New Revision"
        width={440}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onUploadRevision}>Upload Revision</Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="revision" label="Revision" rules={[{ required: true }]}>
            <Input placeholder="e.g. A, B, 02" />
          </Form.Item>

          <Form.Item name="drawn_by" label="Drawn By">
            <Input placeholder="Name of drafter" />
          </Form.Item>

          <Form.Item name="drawing_date" label="Drawing Date">
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>

          <Form.Item name="change_desc" label="Change Description">
            <TextArea rows={3} placeholder="Describe what changed in this revision..." />
          </Form.Item>

          <Form.Item label="Drawing File" required>
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
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedFile ? selectedFile.name : 'No file selected (PDF, JPG, PNG)'}
              </Text>
            </div>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Approve Modal */}
      <Modal
        title={`Approve Drawing — ${drawing.drawing_no}`}
        open={approveOpen}
        onOk={onApprove}
        onCancel={() => { setApproveOpen(false); setApproveNotes(''); }}
        okText="Approve Drawing"
      >
        <p>Approving this drawing will mark it as <Tag color="green">Active</Tag></p>
        <TextArea
          rows={3}
          placeholder="Approval notes (optional)..."
          value={approveNotes}
          onChange={(e) => setApproveNotes(e.target.value)}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </AppLayout>
  );
}
