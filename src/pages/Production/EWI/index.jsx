import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, Drawer, Form, Tooltip,
  Popconfirm, message, Typography, Card, Badge, Divider, Empty,
  Collapse, InputNumber,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  CheckCircleOutlined, StopOutlined, FileTextOutlined,
  WarningOutlined, SearchOutlined, ReloadOutlined,
DownloadOutlined, } from '@ant-design/icons';
import AppLayout from '../../../components/AppLayout';
import { ewiApi } from '../../../api/ewi.api';
import { useAuth } from '../../../context/AuthContext';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const STATUS_COLOR = { draft: 'default', active: 'success', obsolete: 'warning' };
const STATUS_LABEL = { draft: 'Draft', active: 'Active', obsolete: 'Obsolete' };

const ADMIN_ROLES = ['it_admin', 'plant_head', 'production_manager', 'production_incharge', 'quality_manager', 'quality_incharge'];

/* ── Step editor row ─────────────────────────────────────────────────────── */
function StepRow({ step, onSave, onDelete, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [form]  = Form.useForm();

  const startEdit = () => {
    form.setFieldsValue({
      step_no:     step.step_no,
      title:       step.title,
      instruction: step.instruction,
      warning:     step.warning,
    });
    setEditing(true);
  };

  const save = async () => {
    const vals = await form.validateFields();
    await onSave(step.id, vals);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card size="small" style={{ marginBottom: 8, background: '#fafafa', border: '1px solid #1677ff' }}>
        <Form form={form} layout="vertical" size="small">
          <Space style={{ width: '100%' }} direction="vertical" size={4}>
            <Space>
              <Form.Item name="step_no" label="Step #" style={{ margin: 0, width: 80 }}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="title" label="Title" rules={[{ required: true }]} style={{ margin: 0, flex: 1, minWidth: 200 }}>
                <Input />
              </Form.Item>
            </Space>
            <Form.Item name="instruction" label="Instruction" style={{ margin: 0 }}>
              <Input.TextArea rows={2} placeholder="What the operator must do..." />
            </Form.Item>
            <Form.Item name="warning" label="Safety / Warning" style={{ margin: 0 }}>
              <Input.TextArea rows={1} placeholder="Any caution or safety note..." />
            </Form.Item>
            <Space>
              <Button type="primary" size="small" onClick={save}>Save</Button>
              <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
            </Space>
          </Space>
        </Form>
      </Card>
    );
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 8, borderLeft: '3px solid #1677ff' }}
      extra={
        !readOnly && (
          <Space size={4}>
            <Tooltip title="Edit step"><Button size="small" icon={<EditOutlined />} onClick={startEdit} /></Tooltip>
            <Popconfirm title="Delete this step?" onConfirm={() => onDelete(step.id)} okText="Yes" cancelText="No">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        )
      }
    >
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        <Text strong>Step {step.step_no}: {step.title}</Text>
        {step.instruction && <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{step.instruction}</Paragraph>}
        {step.warning && (
          <Tag icon={<WarningOutlined />} color="warning" style={{ whiteSpace: 'normal' }}>
            {step.warning}
          </Tag>
        )}
      </Space>
    </Card>
  );
}

/* ── Add-step inline form ─────────────────────────────────────────────────── */
function AddStepForm({ ewiId, onAdded }) {
  const [open, setOpen]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const submit = async () => {
    const vals = await form.validateFields();
    setLoading(true);
    try {
      await ewiApi.addStep(ewiId, vals);
      form.resetFields();
      setOpen(false);
      onAdded();
    } catch { message.error('Failed to add step'); }
    finally { setLoading(false); }
  };

  if (!open) {
    return <Button icon={<PlusOutlined />} type="dashed" block onClick={() => setOpen(true)}>Add Step</Button>;
  }

  return (
    <Card size="small" style={{ background: '#f0f5ff', border: '1px dashed #1677ff' }}>
      <Form form={form} layout="vertical" size="small">
        <Space>
          <Form.Item name="step_no" label="Step #" style={{ margin: 0, width: 80 }}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="title" label="Title" rules={[{ required: true }]} style={{ margin: 0, flex: 1, minWidth: 200 }}>
            <Input placeholder="Step title" />
          </Form.Item>
        </Space>
        <Form.Item name="instruction" label="Instruction" style={{ marginTop: 8, marginBottom: 4 }}>
          <Input.TextArea rows={2} placeholder="Describe what the operator must do..." />
        </Form.Item>
        <Form.Item name="warning" label="Safety / Warning" style={{ marginBottom: 8 }}>
          <Input placeholder="Optional safety note or caution" />
        </Form.Item>
        <Space>
          <Button type="primary" size="small" loading={loading} onClick={submit}>Add</Button>
          <Button size="small" onClick={() => setOpen(false)}>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function EWIPage() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role?.name);

  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [params,  setParams]  = useState({ page: 1, limit: 20, status: '', q: '' });

  // Drawer states
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selected,      setSelected]      = useState(null); // full EWI with Steps
  const [editMode,      setEditMode]      = useState(false);
  const [form] = Form.useForm();

  /* ── Fetch list ── */
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ''));
      const res = await ewiApi.getAll(clean);
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch { message.error('Failed to load EWI documents'); }
    finally { setLoading(false); }
  }, [params]);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* ── Open detail drawer ── */
  const openDetail = async (id) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const doc = await ewiApi.getById(id);
      setSelected(doc);
      setEditMode(false);
    } catch { message.error('Failed to load EWI'); }
    finally { setDrawerLoading(false); }
  };

  /* ── Create new ── */
  const openCreate = () => {
    setSelected(null);
    setEditMode(true);
    form.resetFields();
    setDrawerOpen(true);
  };

  const saveHeader = async () => {
    const vals = await form.validateFields();
    setDrawerLoading(true);
    try {
      if (selected) {
        const updated = await ewiApi.update(selected.id, vals);
        setSelected(prev => ({ ...prev, ...updated }));
        message.success('EWI updated');
      } else {
        const created = await ewiApi.create(vals);
        message.success(`EWI ${created.doc_no} created`);
        const full = await ewiApi.getById(created.id);
        setSelected(full);
      }
      setEditMode(false);
      fetchList();
    } catch { message.error('Save failed'); }
    finally { setDrawerLoading(false); }
  };

  /* ── Status change ── */
  const changeStatus = async (id, status) => {
    try {
      await ewiApi.updateStatus(id, status);
      message.success(`Status set to ${status}`);
      fetchList();
      if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
    } catch { message.error('Status update failed'); }
  };

  /* ── Step ops ── */
  const reloadSelected = async () => {
    if (!selected) return;
    const doc = await ewiApi.getById(selected.id);
    setSelected(doc);
  };

  const saveStep = async (stepId, vals) => {
    await ewiApi.updateStep(selected.id, stepId, vals);
    await reloadSelected();
  };

  const deleteStep = async (stepId) => {
    await ewiApi.deleteStep(selected.id, stepId);
    await reloadSelected();
  };

  /* ── Table columns ── */
  const columns = [
    {
      title: 'Doc No',
      dataIndex: 'doc_no',
      render: (v, r) => <Button type="link" onClick={() => openDetail(r.id)}>{v}</Button>,
      width: 140,
    },
    { title: 'Title', dataIndex: 'title', ellipsis: true },
    {
      title: 'Item',
      dataIndex: ['Item', 'name'],
      ellipsis: true,
      render: (v, r) => r.Item ? <><Text type="secondary" style={{ fontSize: 11 }}>{r.Item.code}</Text><br />{v}</> : '—',
      width: 160,
    },
    { title: 'Version', dataIndex: 'version', width: 80, align: 'center' },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: v => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: 'Steps',
      width: 70,
      align: 'center',
      render: (_, r) => <Badge count={r.step_count || 0} showZero color="#1677ff" />,
    },
    {
      title: 'Actions',
      width: 100,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View"><Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)} /></Tooltip>
          {isAdmin && r.status === 'draft' && (
            <Tooltip title="Activate">
              <Popconfirm title="Activate this EWI?" onConfirm={() => changeStatus(r.id, 'active')} okText="Yes">
                <Button size="small" icon={<CheckCircleOutlined />} type="primary" ghost />
              </Popconfirm>
            </Tooltip>
          )}
          {isAdmin && r.status === 'active' && (
            <Tooltip title="Obsolete">
              <Popconfirm title="Mark as obsolete?" onConfirm={() => changeStatus(r.id, 'obsolete')} okText="Yes">
                <Button size="small" icon={<StopOutlined />} danger ghost />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const readOnly = !isAdmin || selected?.status === 'obsolete';

  return (
    <AppLayout>
      <div style={{ padding: '24px 24px 0' }}>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              <FileTextOutlined style={{ marginRight: 8 }} />Electronic Work Instructions
            </Title>
            <Text type="secondary">Define step-by-step operator instructions per item / process</Text>
          </Space>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New EWI</Button>
          )}
        </Space>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }} size="small">
          <Space wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search doc no or title..."
              allowClear
              style={{ width: 240 }}
              value={params.q}
              onChange={e => setParams(p => ({ ...p, q: e.target.value, page: 1 }))}
            />
            <Select
              allowClear placeholder="All statuses"
              style={{ width: 140 }}
              value={params.status || undefined}
              onChange={v => setParams(p => ({ ...p, status: v || '', page: 1 }))}
            >
              <Option value="draft">Draft</Option>
              <Option value="active">Active</Option>
              <Option value="obsolete">Obsolete</Option>
            </Select>
            <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('e-w-i.csv', data, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchList}>Refresh</Button>
          </Space>
        </Card>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          size="small"
          pagination={{
            total,
            current: params.page,
            pageSize: params.limit,
            showSizeChanger: true,
            showTotal: t => `${t} documents`,
            onChange: (page, limit) => setParams(p => ({ ...p, page, limit })),
          }}
        />
      </div>

      {/* ── Drawer ── */}
      <Drawer
        title={
          selected
            ? <Space>
                <FileTextOutlined />
                <span>{selected.doc_no} — {selected.title}</span>
                <Tag color={STATUS_COLOR[selected?.status]}>{STATUS_LABEL[selected?.status]}</Tag>
              </Space>
            : 'New EWI Document'
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelected(null); setEditMode(false); }}
        width={700}
        loading={drawerLoading}
        extra={
          selected && !editMode && isAdmin && selected.status !== 'obsolete' ? (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => { form.setFieldsValue(selected); setEditMode(true); }}>Edit</Button>
              {selected.status === 'draft' && (
                <Popconfirm title="Activate this EWI?" onConfirm={() => changeStatus(selected.id, 'active')} okText="Yes">
                  <Button type="primary" icon={<CheckCircleOutlined />}>Activate</Button>
                </Popconfirm>
              )}
              {selected.status === 'active' && (
                <Popconfirm title="Mark as obsolete?" onConfirm={() => changeStatus(selected.id, 'obsolete')} okText="Yes">
                  <Button danger icon={<StopOutlined />}>Obsolete</Button>
                </Popconfirm>
              )}
            </Space>
          ) : editMode ? (
            <Space>
              <Button onClick={() => { setEditMode(false); if (!selected) setDrawerOpen(false); }}>Cancel</Button>
              <Button type="primary" loading={drawerLoading} onClick={saveHeader}>Save</Button>
            </Space>
          ) : null
        }
      >
        {/* Header form */}
        {(editMode || !selected) ? (
          <Form form={form} layout="vertical">
            <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
              <Input placeholder="e.g. Assembly – PP Granules Injection Moulding" />
            </Form.Item>
            <Space style={{ width: '100%' }} size={12}>
              <Form.Item name="version" label="Version" style={{ flex: 1 }}>
                <Input placeholder="1.0" />
              </Form.Item>
              <Form.Item name="effective_date" label="Effective Date" style={{ flex: 1 }}>
                <Input type="date" />
              </Form.Item>
            </Space>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} placeholder="Scope, applicable processes, etc." />
            </Form.Item>
          </Form>
        ) : (
          <>
            {/* Detail view */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={2}>
                <Space wrap>
                  <Text type="secondary">Version:</Text><Text strong>{selected.version}</Text>
                  {selected.effective_date && <><Text type="secondary">Effective:</Text><Text>{selected.effective_date}</Text></>}
                  {selected.Item && <><Text type="secondary">Item:</Text><Text>{selected.Item.code} — {selected.Item.name}</Text></>}
                  {selected.ApprovedBy && <><Text type="secondary">Approved by:</Text><Text>{selected.ApprovedBy.name}</Text></>}
                </Space>
                {selected.notes && <><Divider style={{ margin: '8px 0' }} /><Text type="secondary">{selected.notes}</Text></>}
              </Space>
            </Card>

            {/* Steps */}
            <Title level={5} style={{ marginBottom: 8 }}>
              Work Steps ({selected.Steps?.length || 0})
            </Title>

            {(!selected.Steps || selected.Steps.length === 0) ? (
              <Empty description="No steps defined yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              selected.Steps.map(step => (
                <StepRow
                  key={step.id}
                  step={step}
                  readOnly={readOnly}
                  onSave={saveStep}
                  onDelete={deleteStep}
                />
              ))
            )}

            {!readOnly && (
              <div style={{ marginTop: 12 }}>
                <AddStepForm ewiId={selected.id} onAdded={reloadSelected} />
              </div>
            )}
          </>
        )}
      </Drawer>
    </AppLayout>
  );
}
