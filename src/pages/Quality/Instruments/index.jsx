import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Row, Col, Statistic, Tabs, Progress, Alert, Modal, List,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  SafetyCertificateOutlined, BulbOutlined, QrcodeOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout           from '../../../components/AppLayout';
import ResponsiveTable     from '../../../components/ResponsiveTable';
import usePermissions      from '../../../hooks/usePermissions';
import useAiSuggestion     from '../../../hooks/useAiSuggestion';
import AiSuggestionCard    from '../../../components/AiSuggestion/AiSuggestionCard';
import { instrumentApi, calibrationFailureApi } from '../../../api/quality.api';
import aiApi               from '../../../api/ai.api';
import QrLabelPrint        from '../../../components/common/QrLabelPrint';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const parseInsight = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object' && !raw.raw_text) return raw;
  const text = raw.raw_text ?? raw;
  if (typeof text !== 'string') return raw;
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```[\s\S]*$/, '').trim();
  try { return JSON.parse(stripped); } catch {}
  try { return JSON.parse(text.trim()); } catch {}
  return null;
};

const RISK_COLOR = { low: 'green', medium: 'orange', high: 'red', critical: 'red' };

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

  // QR label state
  const [qrRecord, setQrRecord] = useState(null);

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

  // ── Calibration Failure state ──────────────────────────────────────────────
  const [failureInstr,    setFailureInstr]    = useState(null);  // instrument selected for failure view
  const [failures,        setFailures]        = useState([]);
  const [failureLoading,  setFailureLoading]  = useState(false);
  const [logFailureOpen,  setLogFailureOpen]  = useState(false);
  const [failureSaving,   setFailureSaving]   = useState(false);
  const [failureForm]                         = Form.useForm();

  const loadFailures = useCallback(async (instr) => {
    if (!instr) return;
    setFailureLoading(true);
    try {
      const data = await calibrationFailureApi.getByInstrument(instr.id);
      setFailures(Array.isArray(data) ? data : []);
    } catch (err) { message.error('Failed to load calibration failures'); }
    finally       { setFailureLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'failures' && failureInstr) loadFailures(failureInstr);
  }, [activeTab, failureInstr, loadFailures]);

  const onLogFailure = async () => {
    try {
      const vals = await failureForm.validateFields();
      setFailureSaving(true);
      await calibrationFailureApi.log(failureInstr.id, {
        ...vals,
        failed_date: vals.failed_date?.format('YYYY-MM-DD'),
        last_passed_date: vals.last_passed_date?.format('YYYY-MM-DD'),
      });
      message.success('Calibration failure logged and CAPA auto-created');
      setLogFailureOpen(false);
      failureForm.resetFields();
      loadFailures(failureInstr);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Log failed');
    } finally { setFailureSaving(false); }
  };

  const onCloseFailure = async (failureId) => {
    try {
      await calibrationFailureApi.close(failureId, { disposition: 'closed' });
      message.success('Failure record closed');
      loadFailures(failureInstr);
    } catch (err) { message.error(err?.message || 'Close failed'); }
  };

  // ── AI Calibration Forecast ────────────────────────────────────────────────
  const aiCalib    = useAiSuggestion(aiApi.getCalibrationForecast);
  const [aiCardVisible, setAiCardVisible] = useState(false);

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
    } catch (err) { message.error(err?.message || 'Failed to load instruments'); }
    finally { setLoading(false); }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load verification status ───────────────────────────────────────────────
  const loadVerStatus = useCallback(async () => {
    setVerLoading(true);
    try {
      const res = await instrumentApi.getVerificationStatus();
      setVerStatus({ data: res?.data ?? [], summary: res?.summary ?? {} });
    } catch (err) { message.error(err?.message || 'Failed to load verification status'); }
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
    {
      title: '', key: 'qr', width: 40,
      render: (_, r) => (
        <Tooltip title="QR Label">
          <Button size="small" type="text" icon={<QrcodeOutlined />}
            onClick={() => setQrRecord(r)} />
        </Tooltip>
      ),
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
        {overdue > 0 && <Tag color="red">Overdue: {overdue}</Tag>}
        <div style={{ flex: 1 }} />
        {!aiCardVisible && (
          <Button
            size="small"
            icon={<BulbOutlined style={{ color: '#7c3aed' }} />}
            style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
            onClick={() => {
              setAiCardVisible(true);
              aiCalib.reset();
              aiCalib.fetch();
            }}
          >
            AI Calibration Forecast
          </Button>
        )}
      </div>

      {aiCardVisible && (
        <AiSuggestionCard
          title="AI Calibration Forecast"
          loading={aiCalib.loading}
          error={aiCalib.error}
          aiAvailable={aiCalib.aiAvailable}
          cached={aiCalib.cached}
          onRetry={() => { aiCalib.reset(); aiCalib.fetch(); }}
          onDismiss={() => setAiCardVisible(false)}
          style={{ marginBottom: 16 }}
        >
          {(() => {
            const d = aiCalib.data;
            const insight = parseInsight(d?.ai_insight);
            if (!insight) return null;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Risk / context tags */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color={RISK_COLOR[insight.risk_level] || 'default'} style={{ fontWeight: 600 }}>
                    Risk: {String(insight.risk_level || '—').toUpperCase()}
                  </Tag>
                  <Tag color="purple">Confidence: {insight.confidence || '—'}</Tag>
                  {insight.compliance_risk && <Tag color="red">Compliance Risk</Tag>}
                </div>

                {/* Fleet health summary */}
                {insight.fleet_health_summary && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {insight.fleet_health_summary}
                  </div>
                )}

                {/* Instruments to prioritise */}
                {Array.isArray(insight.instruments_to_prioritise) && insight.instruments_to_prioritise.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>Instruments to Prioritise</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {insight.instruments_to_prioritise.map((inst, i) => (
                        <Tag key={i} color="orange">{inst}</Tag>
                      ))}
                    </div>
                  </div>
                )}

                {/* Immediate actions */}
                {Array.isArray(insight.immediate_actions) && insight.immediate_actions.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>Immediate Actions</Text>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#dc2626', fontSize: 13 }}>
                      {insight.immediate_actions.map((a, i) => <li key={i} style={{ marginBottom: 3 }}>{a}</li>)}
                    </ul>
                  </div>
                )}

                {/* Scheduling recommendations */}
                {Array.isArray(insight.scheduling_recommendations) && insight.scheduling_recommendations.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>Scheduling Recommendations</Text>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#16a34a', fontSize: 13 }}>
                      {insight.scheduling_recommendations.map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </AiSuggestionCard>
      )}

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
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('instruments.csv', instruments, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Instrument</Button>
          )}
        </div>

        <ResponsiveTable
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
          {
            key: 'failures',
            label: 'Calibration Failures',
            children: (
              <div style={{ paddingTop: 8 }}>
                <Card bodyStyle={{ padding: '12px 16px' }} style={{ border: '1px solid #e8eaed', borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Select
                      showSearch allowClear
                      placeholder="Select instrument to view failures..."
                      style={{ width: 360 }}
                      filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
                      options={instruments.map((i) => ({ value: i.id, label: `${i.instrument_code} — ${i.name}`, record: i }))}
                      onChange={(v, opt) => {
                        const instr = instruments.find((i) => i.id === v);
                        setFailureInstr(instr || null);
                        if (instr) loadFailures(instr);
                        else setFailures([]);
                      }}
                    />
                    {failureInstr && canWrite && (
                      <Button type="primary" danger icon={<ExclamationCircleOutlined />}
                        onClick={() => { failureForm.resetFields(); setLogFailureOpen(true); }}>
                        Log Failure
                      </Button>
                    )}
                    {failureInstr && (
                      <Button icon={<ReloadOutlined />} onClick={() => loadFailures(failureInstr)}>Refresh</Button>
                    )}
                  </div>
                </Card>

                {!failureInstr && (
                  <Alert type="info" showIcon message="Select an instrument above to view its calibration failure history." />
                )}

                {failureInstr && (
                  <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: '16px 20px' }}>
                    <Table
                      rowKey="id"
                      loading={failureLoading}
                      size="small"
                      dataSource={failures}
                      pagination={{ pageSize: 15 }}
                      columns={[
                        { title: 'Failed Date', dataIndex: 'failed_date', key: 'fd', width: 110 },
                        { title: 'Last Passed', dataIndex: 'last_passed_date', key: 'lp', width: 110, render: (v) => v || '—' },
                        { title: 'Deviation Found', dataIndex: 'deviation_found', key: 'dev', ellipsis: true },
                        { title: 'Impact', dataIndex: 'impact_level', key: 'impact', width: 80,
                          render: (v) => <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'default'}>{v}</Tag> },
                        { title: 'Disposition', dataIndex: 'disposition', key: 'disp', width: 110,
                          render: (v) => <Tag color={v === 'closed' ? 'green' : v === 'under_review' ? 'orange' : 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
                        { title: 'CAPA', key: 'capa', width: 80, render: (_, r) => r.capa_id ? <Tag color="purple">Linked</Tag> : '—' },
                        { title: 'Logged By', key: 'creator', width: 120, render: (_, r) => r.Creator?.name ?? '—' },
                        ...(canWrite ? [{
                          title: '', key: 'close', width: 80,
                          render: (_, r) => r.disposition !== 'closed' ? (
                            <Popconfirm title="Close this failure record?" onConfirm={() => onCloseFailure(r.id)} okText="Close">
                              <Button size="small">Close</Button>
                            </Popconfirm>
                          ) : null,
                        }] : []),
                      ]}
                    />
                  </Card>
                )}
              </div>
            ),
          },
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
      {/* ── Log Calibration Failure Modal ─────────────────────────────────────── */}
      <Modal
        title={`Log Calibration Failure — ${failureInstr?.instrument_code}`}
        open={logFailureOpen}
        onCancel={() => setLogFailureOpen(false)}
        onOk={onLogFailure}
        confirmLoading={failureSaving}
        okText="Log Failure"
        okButtonProps={{ danger: true }}
      >
        <Alert type="warning" showIcon
          message="Logging a failure will flag the instrument inactive and auto-create a CAPA."
          style={{ marginBottom: 16 }} />
        <Form form={failureForm} layout="vertical" requiredMark={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="failed_date" label="Failed Date" rules={[{ required: true }]}
                initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_passed_date" label="Last Passed Date">
                <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="deviation_found" label="Deviation Found">
            <Input.TextArea rows={2} placeholder="Describe the deviation / out-of-tolerance finding..." />
          </Form.Item>
          <Form.Item name="impact_level" label="Impact Level" initialValue="unknown">
            <Select options={[
              { value: 'unknown',  label: 'Unknown'  },
              { value: 'low',      label: 'Low'      },
              { value: 'medium',   label: 'Medium'   },
              { value: 'high',     label: 'High'     },
              { value: 'critical', label: 'Critical' },
            ]} />
          </Form.Item>
          <Form.Item name="containment_action" label="Containment Action">
            <Input.TextArea rows={2} placeholder="Immediate containment steps taken..." />
          </Form.Item>
        </Form>
      </Modal>

      <QrLabelPrint
        open={!!qrRecord}
        onClose={() => setQrRecord(null)}
        type="INST"
        identifier={qrRecord?.instrument_code || ''}
        title="Instrument"
        subtitle={qrRecord?.name || ''}
      />
    </AppLayout>
  );
}
