import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, InputNumber, message, Popconfirm, Tabs,
  Progress, Badge, Descriptions, Alert, Modal, Tooltip,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, RightOutlined,
  DeleteOutlined, CheckOutlined, FileDoneOutlined, CloseOutlined,
} from '@ant-design/icons';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { ppapApi }    from '../../../api/quality.api';
import { itemApi }    from '../../../api/item.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const LEVEL_LABELS = { 1: 'Level 1 — PSW Only', 2: 'Level 2 — Select', 3: 'Level 3 — Full', 4: 'Level 4 — Customer Defined', 5: 'Level 5 — On-Site' };
const STATUS_COLOR = {
  draft:       'default',
  in_progress: 'blue',
  submitted:   'purple',
  approved:    'green',
  rejected:    'red',
};
const EL_STATUS_COLOR = {
  not_started: 'default',
  in_progress: 'blue',
  complete:    'green',
  na:          'default',
};
const EL_STATUS_OPTS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete',    label: 'Complete'     },
  { value: 'na',          label: 'N/A'          },
];

export default function PPAPPage() {
  const { can }  = usePermissions();
  const canWrite = can('npd-ppap-create_edit_delete');

  const [records,     setRecords]     = useState([]);
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [createOpen,  setCreateOpen]  = useState(false);
  const [detailRow,   setDetailRow]   = useState(null);
  const [detailOpen,  setDetailOpen]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [actionLoad,  setActionLoad]  = useState(false);
  const [createForm]                  = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ppapApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) { message.error('Failed to load PPAP submissions'); }
    finally       { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] }))
      .then((r) => setItems(Array.isArray(r) ? r : (r?.data ?? [])));
  }, []);

  const openDetail = async (row) => {
    try {
      const full = await ppapApi.getById(row.id);
      setDetailRow(full);
      setDetailOpen(true);
    } catch (err) { message.error('Failed to load PPAP details'); }
  };

  const reloadDetail = async () => {
    if (!detailRow) return;
    try {
      const full = await ppapApi.getById(detailRow.id);
      setDetailRow(full);
    } catch {}
  };

  const onCreate = async () => {
    try {
      const vals = await createForm.validateFields();
      setSaving(true);
      await ppapApi.create(vals);
      message.success('PPAP submission created');
      setCreateOpen(false);
      createForm.resetFields();
      fetchAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Create failed');
    } finally { setSaving(false); }
  };

  const onUpdateElement = async (el, status, docUrl) => {
    try {
      await ppapApi.updateElement(detailRow.id, el.id, { status, document_url: docUrl || el.document_url });
      reloadDetail();
    } catch (err) { message.error(err?.message || 'Update failed'); }
  };

  const onSignPsw = async () => {
    setActionLoad(true);
    try {
      await ppapApi.signPsw(detailRow.id);
      message.success('PSW signed — PPAP submitted');
      reloadDetail();
      fetchAll();
    } catch (err) { message.error(err?.message || 'Sign PSW failed'); }
    finally       { setActionLoad(false); }
  };

  const onApprove = async () => {
    setActionLoad(true);
    try {
      await ppapApi.approve(detailRow.id);
      message.success('PPAP approved');
      reloadDetail();
      fetchAll();
    } catch (err) { message.error(err?.message || 'Approve failed'); }
    finally       { setActionLoad(false); }
  };

  const onReject = async () => {
    setActionLoad(true);
    try {
      await ppapApi.reject(detailRow.id, { notes: 'Rejected' });
      message.success('PPAP rejected');
      reloadDetail();
      fetchAll();
    } catch (err) { message.error(err?.message || 'Reject failed'); }
    finally       { setActionLoad(false); }
  };

  const onDelete = async (id) => {
    try {
      await ppapApi.delete(id);
      message.success('PPAP deleted');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    { title: 'PPAP No.', dataIndex: 'ppap_no', key: 'ppap_no', width: 160 },
    { title: 'Part / Item', key: 'item', ellipsis: true,
      render: (_, r) => r.Item ? `${r.Item.code} — ${r.Item.name}` : '—' },
    { title: 'Level', dataIndex: 'submission_level', key: 'level', width: 70,
      render: (v) => <Tag>{v}</Tag> },
    { title: 'Rev.', dataIndex: 'revision', key: 'revision', width: 60 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    {
      title: 'Elements', key: 'elements', width: 140,
      render: (_, r) => {
        const els = r.Elements ?? [];
        const req = els.filter((e) => e.required);
        const done = req.filter((e) => e.status === 'complete').length;
        const pct = req.length ? Math.round((done / req.length) * 100) : 0;
        return <Progress percent={pct} size="small" style={{ marginBottom: 0 }} />;
      },
    },
    { title: 'Created By', key: 'creator', width: 120,
      render: (_, r) => r.Creator?.name ?? '—' },
    {
      title: '', key: 'actions', width: 120,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost onClick={() => openDetail(r)}>Open</Button>
          {canWrite && ['draft', 'rejected'].includes(r.status) && (
            <Popconfirm title="Delete PPAP?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const filtered = records.filter((r) =>
    !search || r.ppap_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.Item?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Detail — elements grid ──────────────────────────────────────────────────
  const renderElements = () => {
    if (!detailRow) return null;
    const els    = detailRow.Elements ?? [];
    const req    = els.filter((e) => e.required);
    const done   = req.filter((e) => e.status === 'complete').length;
    const pct    = req.length ? Math.round((done / req.length) * 100) : 0;
    const canSign = detailRow.status === 'in_progress' && done === req.length && canWrite;
    const canApprove = detailRow.status === 'submitted' && canWrite;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header summary */}
        <Card bodyStyle={{ padding: '12px 16px' }}
          style={{ border: '1px solid #e8eaed', borderRadius: 10 }}>
          <Descriptions size="small" column={3} bordered>
            <Descriptions.Item label="PPAP No.">{detailRow.ppap_no}</Descriptions.Item>
            <Descriptions.Item label="Level">Level {detailRow.submission_level}</Descriptions.Item>
            <Descriptions.Item label="Revision">{detailRow.revision || '—'}</Descriptions.Item>
            <Descriptions.Item label="Part">{detailRow.Item ? `${detailRow.Item.code} — ${detailRow.Item.name}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[detailRow.status] ?? 'default'}>{detailRow.status?.replace(/_/g, ' ')}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Required Done">{done} / {req.length}</Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 12 }}>
            <Progress percent={pct} strokeColor={pct === 100 ? '#22c55e' : '#3b82f6'} />
          </div>

          {canSign && (
            <Button type="primary" icon={<FileDoneOutlined />} style={{ marginTop: 12 }}
              loading={actionLoad} onClick={onSignPsw}>
              Sign PSW & Submit
            </Button>
          )}
          {canApprove && (
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" icon={<CheckOutlined />} loading={actionLoad} onClick={onApprove}>Approve</Button>
              <Popconfirm title="Reject this PPAP?" onConfirm={onReject} okText="Reject" okButtonProps={{ danger: true }}>
                <Button danger icon={<CloseOutlined />} loading={actionLoad}>Reject</Button>
              </Popconfirm>
            </Space>
          )}
          {detailRow.status === 'approved' && (
            <Alert type="success" showIcon message="PPAP Approved by Customer." style={{ marginTop: 12 }} />
          )}
          {detailRow.status === 'rejected' && (
            <Alert type="error" showIcon message="PPAP Rejected." style={{ marginTop: 12 }} />
          )}
        </Card>

        {/* Elements grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {els.map((el) => (
            <Card
              key={el.id}
              size="small"
              style={{
                border: `1px solid ${el.status === 'complete' ? '#86efac' : el.required ? '#e8eaed' : '#e8eaed'}`,
                borderRadius: 8,
                opacity: el.status === 'na' ? 0.6 : 1,
              }}
              bodyStyle={{ padding: '10px 12px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: '#9ca3af' }}>Element {el.element_no}</Text>
                <Space size={4}>
                  {el.required && <Tag color="blue" style={{ fontSize: 10, marginRight: 0 }}>Required</Tag>}
                  <Badge status={el.status === 'complete' ? 'success' : el.status === 'in_progress' ? 'processing' : 'default'} />
                </Space>
              </div>
              <Text style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8 }}>{el.element_name}</Text>
              {canWrite && detailRow.status !== 'submitted' && detailRow.status !== 'approved' && (
                <Select
                  size="small"
                  value={el.status}
                  options={EL_STATUS_OPTS}
                  style={{ width: '100%' }}
                  onChange={(v) => onUpdateElement(el, v)}
                />
              )}
              {(!canWrite || ['submitted', 'approved'].includes(detailRow.status)) && (
                <Tag color={EL_STATUS_COLOR[el.status] ?? 'default'} style={{ fontSize: 11 }}>
                  {el.status?.replace(/_/g, ' ')}
                </Tag>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>NPD</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>PPAP Tracker</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>PPAP 18-Element Tracker</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Manage AIAG PPAP submissions with level-based element tracking and PSW signing.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {records.length}</Tag>
        <Tag color="purple">Submitted: {records.filter((r) => r.status === 'submitted').length}</Tag>
        <Tag color="green">Approved: {records.filter((r) => r.status === 'approved').length}</Tag>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input placeholder="Search PPAP no. or part..." prefix={<SearchOutlined />}
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }} allowClear />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>
              New PPAP
            </Button>
          )}
        </div>

        <Table
          rowKey="id" dataSource={filtered} columns={columns} loading={loading} size="small"
          pagination={{ pageSize: 20, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create Drawer ──────────────────────────────────────────────────────── */}
      <Drawer
        title="Create PPAP Submission"
        width={480}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onCreate}>Create</Button>
          </div>
        }
      >
        <Form form={createForm} layout="vertical" requiredMark={false}>
          <Form.Item name="item_id" label="Part / Item" rules={[{ required: true }]}>
            <Select showSearch allowClear placeholder="Select item..."
              filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
              options={items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }))} />
          </Form.Item>
          <Form.Item name="submission_level" label="Submission Level" initialValue={3}>
            <Select options={[1,2,3,4,5].map((l) => ({ value: l, label: LEVEL_LABELS[l] }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="revision" label="Revision" initialValue="A">
              <Input placeholder="A" />
            </Form.Item>
            <Form.Item name="customer_id" label="Customer ID (optional)">
              <InputNumber style={{ width: '100%' }} placeholder="Vendor ID" />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Additional notes..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ──────────────────────────────────────────────────────── */}
      <Drawer
        title={detailRow ? `PPAP — ${detailRow.ppap_no}` : 'PPAP Detail'}
        width={900}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {renderElements()}
      </Drawer>
    </AppLayout>
  );
}
