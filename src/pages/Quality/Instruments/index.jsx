import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Row, Col, Statistic, Tabs, Progress,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { instrumentApi } from '../../../api/quality.api';

const { Title, Text } = Typography;

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:         { color: 'green',   label: 'Active'         },
  inactive:       { color: 'default', label: 'Inactive'       },
  in_calibration: { color: 'orange',  label: 'In Calibration' },
  scrapped:       { color: 'red',     label: 'Scrapped'       },
};

const CATEGORY_OPTIONS = [
  { value: 'dimensional',  label: 'Dimensional'  },
  { value: 'electrical',   label: 'Electrical'   },
  { value: 'pressure',     label: 'Pressure'     },
  { value: 'temperature',  label: 'Temperature'  },
  { value: 'force',        label: 'Force'        },
  { value: 'optical',      label: 'Optical'      },
  { value: 'other',        label: 'Other'        },
];

const VERIFY_RESULT = {
  pass:        { color: 'green', label: 'Pass'        },
  fail:        { color: 'red',   label: 'Fail'        },
  conditional: { color: 'gold',  label: 'Conditional' },
};

export default function InstrumentsPage() {
  const { can } = usePermissions();
  const canWrite = can('quality-instruments-create_edit_delete');

  const [instruments, setInstruments] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [activeTab,   setActiveTab]   = useState('list');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [form] = Form.useForm();

  // Verify drawer
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifying,  setVerifying]  = useState(null);
  const [verifyForm] = Form.useForm();
  const [verifySaving, setVerifySaving] = useState(false);

  // Verification status
  const [verStatus, setVerStatus] = useState({ data: [], summary: {} });
  const [verLoading, setVerLoading] = useState(false);

  // ── Load instruments ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)         params.search = search;
      if (statusFilter)   params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const data = await instrumentApi.getAll(params);
      setInstruments(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { message.error('Failed to load instruments'); }
    finally { setLoading(false); }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load verification status ───────────────────────────────────────────────
  const loadVerStatus = useCallback(async () => {
    setVerLoading(true);
    try {
      const res = await instrumentApi.getVerificationStatus();
      setVerStatus({ data: res?.data ?? [], summary: res?.summary ?? {} });
    } catch { message.error('Failed to load verification status'); }
    finally { setVerLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'verification') loadVerStatus();
  }, [activeTab, loadVerStatus]);

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      instrument_code:            record.instrument_code,
      name:                       record.name,
      category:                   record.category,
      manufacturer:               record.manufacturer,
      model_no:                   record.model_no,
      serial_no:                  record.serial_no,
      measurement_range:          record.measurement_range,
      accuracy:                   record.accuracy,
      location:                   record.location,
      status:                     record.status,
      calibration_frequency_days: record.calibration_frequency_days,
      notes:                      record.notes,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = { ...vals };
      if (editing) {
        await instrumentApi.update(editing.id, payload);
        message.success('Instrument updated');
      } else {
        await instrumentApi.create(payload);
        message.success('Instrument created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await instrumentApi.delete(id);
      message.success('Instrument deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Verify helpers ─────────────────────────────────────────────────────────
  const openVerify = (record) => {
    setVerifying(record);
    verifyForm.resetFields();
    verifyForm.setFieldsValue({ result: 'pass' });
    setVerifyOpen(true);
  };

  const onVerify = async () => {
    try {
      const vals = await verifyForm.validateFields();
      setVerifySaving(true);
      await instrumentApi.verify(verifying.id, vals);
      message.success(`Instrument ${verifying.instrument_code} verified`);
      setVerifyOpen(false);
      load();
      if (activeTab === 'verification') loadVerStatus();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Verification failed');
    } finally { setVerifySaving(false); }
  };

  // ── Table columns — Instruments List ───────────────────────────────────────
  const columns = [
    {
      title: 'Code', dataIndex: 'instrument_code', key: 'code', width: 130,
      render: (v, r) => (
        <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>
          {v}
        </Text>
      ),
    },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
    {
      title: 'Category', dataIndex: 'category', key: 'category', width: 110,
      render: (v) => <Tag>{v || '—'}</Tag>,
    },
    { title: 'Make / Model', key: 'make', width: 150,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{[r.manufacturer, r.model_no].filter(Boolean).join(' / ') || '—'}</Text>,
    },
    { title: 'Location', dataIndex: 'location', key: 'location', width: 120, ellipsis: true },
    {
      title: 'Freq (days)', dataIndex: 'calibration_frequency_days', key: 'freq', width: 90, align: 'center',
      render: (v) => v || '—',
    },
    {
      title: 'Last Calibrated', dataIndex: 'last_calibrated_at', key: 'last_cal', width: 120,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : <Text type="secondary">Never</Text>,
    },
    {
      title: 'Next Due', dataIndex: 'next_due_at', key: 'next_due', width: 120,
      render: (d) => {
        if (!d) return <Text type="secondary">—</Text>;
        const overdue = dayjs(d).isBefore(dayjs(), 'day');
        return <Text style={{ color: overdue ? '#dc2626' : '#16a34a', fontWeight: overdue ? 600 : 400 }}>{dayjs(d).format('DD MMM YYYY')}</Text>;
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    ...(canWrite ? [{
      title: '', key: 'actions', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'active' && (
            <Tooltip title="Verify today">
              <Button size="small" type="primary" ghost icon={<SafetyCertificateOutlined />} onClick={() => openVerify(r)} />
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title="Delete instrument?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  // ── Table columns — Verification Status ────────────────────────────────────
  const verColumns = [
    { title: 'Code', dataIndex: 'instrument_code', key: 'code', width: 130,
      render: (v) => <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{v}</Text>,
    },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
    { title: 'Category', dataIndex: 'category', key: 'cat', width: 110,
      render: (v) => <Tag>{v || '—'}</Tag>,
    },
    { title: 'Location', dataIndex: 'location', key: 'loc', width: 120, ellipsis: true },
    {
      title: 'Verified Today', key: 'verified', width: 130, align: 'center',
      render: (_, r) => r.verified_today
        ? <Tag color={VERIFY_RESULT[r.verification_result]?.color || 'green'}>{VERIFY_RESULT[r.verification_result]?.label || 'Yes'}</Tag>
        : <Tag color="orange">Pending</Tag>,
    },
    {
      title: 'Overdue', key: 'overdue', width: 90, align: 'center',
      render: (_, r) => r.is_overdue
        ? <Tag color="red"><ExclamationCircleOutlined /> Yes</Tag>
        : <Text type="secondary">No</Text>,
    },
    ...(canWrite ? [{
      title: '', key: 'actions', width: 80,
      render: (_, r) => !r.verified_today ? (
        <Button size="small" type="primary" ghost icon={<SafetyCertificateOutlined />} onClick={() => openVerify(r)}>
          Verify
        </Button>
      ) : null,
    }] : []),
  ];

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total    = instruments.length;
  const active   = instruments.filter((r) => r.status === 'active').length;
  const overdue  = instruments.filter((r) => r.next_due_at && dayjs(r.next_due_at).isBefore(dayjs(), 'day')).length;

  const vs = verStatus.summary;
  const verPercent = vs.total > 0 ? Math.round((vs.verified / vs.total) * 100) : 0;

  // ── Tab: List ──────────────────────────────────────────────────────────────
  const tabList = (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
        {overdue > 0 && <Tag color="red">Overdue: {overdue}</Tag>}
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search code, name, serial…"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, borderRadius: 8 }}
            allowClear
          />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={setStatusFilter}
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 140 }}
          />
          <Select placeholder="Category" allowClear value={categoryFilter} onChange={setCategoryFilter}
            options={CATEGORY_OPTIONS}
            style={{ width: 140 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Instrument</Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={instruments}
          size="small"
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} instruments` }}
        />
      </Card>
    </>
  );

  // ── Tab: Daily Verification ────────────────────────────────────────────────
  const tabVerification = (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Total Active" value={vs.total || 0} valueStyle={{ color: '#1d4ed8', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Verified Today" value={vs.verified || 0} valueStyle={{ color: '#16a34a', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Pending" value={vs.pending || 0} valueStyle={{ color: '#d97706', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Overdue" value={vs.overdue || 0} valueStyle={{ color: '#dc2626', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Progress type="circle" percent={verPercent} size={50} strokeColor="#16a34a" />
            <Text style={{ display: 'block', fontSize: 11, marginTop: 4 }}>Completion</Text>
          </Card>
        </Col>
      </Row>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button icon={<ReloadOutlined />} onClick={loadVerStatus}>Refresh</Button>
        </div>
        <Table
          rowKey="id"
          loading={verLoading}
          columns={verColumns}
          dataSource={verStatus.data}
          size="small"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} instruments` }}
          rowClassName={(r) => r.is_overdue ? 'ant-table-row-danger' : ''}
        />
      </Card>
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Instruments</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Instrument & Calibration Management</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Track measuring instruments, calibration schedules, and daily verification status.
      </Text>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 12 }}
        items={[
          { key: 'list', label: 'Instruments', children: <div style={{ paddingTop: 8 }}>{tabList}</div> },
          { key: 'verification', label: 'Daily Verification', children: <div style={{ paddingTop: 8 }}>{tabVerification}</div> },
        ]}
      />

      {/* ── Create / Edit Drawer ──────────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit — ${editing.instrument_code}` : 'New Instrument'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={600}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update' : 'Create'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="instrument_code" label="Instrument Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. VM-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Vernier Caliper 150mm" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category">
                <Select placeholder="Select category" options={CATEGORY_OPTIONS} allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status" initialValue="active">
                <Select options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="manufacturer" label="Make / Manufacturer">
                <Input placeholder="Manufacturer" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="model_no" label="Model No.">
                <Input placeholder="Model no." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="serial_no" label="Serial No">
                <Input placeholder="Serial number" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="measurement_range" label="Range">
                <Input placeholder="e.g. 0-150mm" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="accuracy" label="Accuracy / Least Count">
                <Input placeholder="e.g. 0.02mm" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="calibration_frequency_days" label="Calibration Freq (days)">
                <InputNumber min={1} placeholder="365" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="location" label="Location">
            <Input placeholder="e.g. IQC Lab, Production Floor" />
          </Form.Item>

          <Form.Item name="notes" label="Remarks">
            <Input.TextArea rows={2} placeholder="Internal notes…" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Verify Drawer ─────────────────────────────────────────────────────── */}
      <Drawer
        title={`Verify — ${verifying?.instrument_code || ''}`}
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        width={420}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setVerifyOpen(false)}>Cancel</Button>
            <Button type="primary" loading={verifySaving} onClick={onVerify}>Submit Verification</Button>
          </div>
        }
      >
        {verifying && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <Text strong>{verifying.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {[verifying.manufacturer, verifying.model_no].filter(Boolean).join(' / ')}
              {verifying.serial_no && ` — S/N: ${verifying.serial_no}`}
            </Text>
          </div>
        )}
        <Form form={verifyForm} layout="vertical">
          <Form.Item name="result" label="Verification Result" rules={[{ required: true }]}>
            <Select options={[
              { value: 'pass', label: 'Pass' },
              { value: 'fail', label: 'Fail' },
              { value: 'conditional', label: 'Conditional' },
            ]} />
          </Form.Item>
          <Form.Item name="certificate_no" label="Certificate No">
            <Input placeholder="Optional certificate reference" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} placeholder="Observations…" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
