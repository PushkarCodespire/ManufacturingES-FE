import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, Modal, InputNumber, message, Tooltip,
  Row, Col, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, RightOutlined,
  BulbOutlined, ClockCircleOutlined, CheckCircleFilled, CloseCircleFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout           from '../../../components/AppLayout';
import usePermissions      from '../../../hooks/usePermissions';
import useAiSuggestion     from '../../../hooks/useAiSuggestion';
import AiSuggestionCard    from '../../../components/AiSuggestion/AiSuggestionCard';
import { jobCardApi, workOrderApi } from '../../../api/production.api';
import { machineApi }   from '../../../api/machine.api';
import { shiftApi }     from '../../../api/shift.api';
import { userApi }      from '../../../api/user.api';
import aiApi            from '../../../api/ai.api';

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

const STATUS_CONFIG = {
  open:   { color: 'orange', label: 'Open'   },
  closed: { color: 'green',  label: 'Closed' },
};

export default function JobCardsPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-dpr-daily_production_report-create_edit_delete');

  const [jobCards,     setJobCards]     = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [machines,     setMachines]     = useState([]);
  const [shifts,       setShifts]       = useState([]);
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [woFilter,     setWoFilter]     = useState(null);

  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [saving,      setSaving]      = useState(false);

  // ── AI ETA ────────────────────────────────────────────────────────────────
  const aiEta    = useAiSuggestion(aiApi.getJobCardAiEta);
  const [aiJcDrawerOpen, setAiJcDrawerOpen] = useState(false);
  const [aiJcRecord,     setAiJcRecord]     = useState(null);

  const openAiJcDrawer = (jc) => {
    setAiJcRecord(jc);
    aiEta.reset();
    setAiJcDrawerOpen(true);
    aiEta.fetch(jc.id);
  };

  // Close modal
  const [closeModal,      setCloseModal]      = useState(false);
  const [closingCard,     setClosingCard]     = useState(null);
  const [closingQtyProd,  setClosingQtyProd]  = useState(null);
  const [closingQtyRej,   setClosingQtyRej]   = useState(null);
  const [closingSaving,   setClosingSaving]   = useState(false);

  const [form] = Form.useForm();

  // ── Load job cards ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search   = search;
      if (statusFilter) params.status   = statusFilter;
      if (woFilter)     params.work_order_id = woFilter;
      const data = await jobCardApi.getAll(params);
      setJobCards(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load job cards'); }
    finally { setLoading(false); }
  }, [search, statusFilter, woFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      workOrderApi.getAll({ limit: 500 }).catch(() => []),
      machineApi.getAll({ limit: 500 }).catch(() => []),
      shiftApi.getAll().catch(() => []),
      userApi.getAll({ limit: 500 }).catch(() => []),
    ]).then(([wo, m, s, u]) => {
      setWorkOrders(Array.isArray(wo) ? wo : (wo?.data ?? []));
      setMachines(Array.isArray(m) ? m : (m?.data ?? []));
      setShifts(Array.isArray(s) ? s : (s?.data ?? []));
      setUsers(Array.isArray(u) ? u : (u?.data ?? []));
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total      = jobCards.length;
  const countOpen  = jobCards.filter((r) => r.status === 'open').length;
  const countClosed= jobCards.filter((r) => r.status === 'closed').length;

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      work_order_id: record.work_order_id,
      machine_id:    record.machine_id,
      operator_id:   record.operator_id,
      shift_id:      record.shift_id,
      notes:         record.notes,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        work_order_id: vals.work_order_id,
        machine_id:    vals.machine_id  || null,
        operator_id:   vals.operator_id || null,
        shift_id:      vals.shift_id    || null,
        notes:         vals.notes       || '',
      };
      if (editing) {
        await jobCardApi.update(editing.id, payload);
        message.success('Job card updated');
      } else {
        await jobCardApi.create(payload);
        message.success('Job card created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const openCloseModal = (record) => {
    setClosingCard(record);
    setClosingQtyProd(null);
    setClosingQtyRej(0);
    setCloseModal(true);
  };

  const onClose = async () => {
    if (!closingQtyProd) { message.error('Enter qty produced'); return; }
    setClosingSaving(true);
    try {
      await jobCardApi.close(closingCard.id, {
        qty_produced: closingQtyProd,
        qty_rejected: closingQtyRej || 0,
      });
      message.success('Job card closed');
      setCloseModal(false);
      load();
    } catch (err) {
      message.error(err?.message || 'Close failed');
    } finally { setClosingSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await jobCardApi.delete(id);
      message.success('Job card deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Job No', dataIndex: 'job_no', key: 'job_no', width: 150,
      render: (no, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 600, cursor: canWrite ? 'pointer' : 'default' }}
          onClick={() => canWrite && openEdit(r)}
        >
          {no}
        </Text>
      ),
    },
    {
      title: 'Work Order', key: 'work_order', width: 140,
      render: (_, r) => (
        <Text style={{ fontSize: 13 }}>{r.WorkOrder?.wo_no || '—'}</Text>
      ),
    },
    {
      title: 'Machine', key: 'machine', width: 120,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Machine?.name || '—'}</Text>,
    },
    {
      title: 'Operator', key: 'operator', width: 130,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Operator?.name || '—'}</Text>,
    },
    {
      title: 'Start Time', dataIndex: 'start_time', key: 'start_time', width: 140,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY HH:mm') : '—',
    },
    {
      title: 'End Time', dataIndex: 'end_time', key: 'end_time', width: 140,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY HH:mm') : '—',
    },
    {
      title: 'Qty Produced', dataIndex: 'qty_produced', key: 'qty_produced', width: 110, align: 'right',
      render: (v) => v != null ? parseFloat(v).toLocaleString() : '—',
    },
    {
      title: 'Qty Rejected', dataIndex: 'qty_rejected', key: 'qty_rejected', width: 110, align: 'right',
      render: (v) => v != null ? (
        <Text style={{ color: v > 0 ? '#dc2626' : undefined }}>{parseFloat(v).toLocaleString()}</Text>
      ) : '—',
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'AI', key: 'ai', width: 54, align: 'center',
      render: (_, r) => (
        <Tooltip title="AI ETA Prediction">
          <Button
            size="small"
            type="text"
            icon={<BulbOutlined style={{ color: '#7c3aed' }} />}
            onClick={() => openAiJcDrawer(r)}
          />
        </Tooltip>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Job Cards</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Job Cards</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Track production execution — start, stop, and record output per machine run.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Open: {countOpen}</Tag>
        <Tag color="green">Closed: {countClosed}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search job number..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by work order"
            allowClear
            value={woFilter}
            onChange={setWoFilter}
            showSearch
            optionFilterProp="label"
            options={workOrders.map((wo) => ({ value: wo.id, label: wo.wo_no }))}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 150 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              New Job Card
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={jobCards}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── AI ETA Drawer ─────────────────────────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BulbOutlined style={{ color: '#7c3aed' }} />
            <span>AI ETA Prediction — {aiJcRecord?.job_no}</span>
          </div>
        }
        open={aiJcDrawerOpen}
        onClose={() => setAiJcDrawerOpen(false)}
        width={500}
        destroyOnClose={false}
      >
        <AiSuggestionCard
          loading={aiEta.loading}
          error={aiEta.error}
          aiAvailable={aiEta.aiAvailable}
          cached={aiEta.cached}
          onRetry={() => aiJcRecord && aiEta.fetch(aiJcRecord.id)}
          onDismiss={() => setAiJcDrawerOpen(false)}
          style={{ marginBottom: 16 }}
        >
          {(() => {
            const insight = parseInsight(aiEta.data?.ai_insight);
            if (!insight) return null;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Status badges */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {insight.on_track === true && (
                    <Tag color="green" icon={<CheckCircleFilled />}>On Track</Tag>
                  )}
                  {insight.on_track === false && (
                    <Tag color="red" icon={<CloseCircleFilled />}>Behind Schedule</Tag>
                  )}
                  {insight.on_track == null && (
                    <Tag color="default" icon={<ClockCircleOutlined />}>Not Started</Tag>
                  )}
                  <Tag color="purple">Confidence: {insight.confidence || '—'}</Tag>
                </div>

                {/* ETA assessment */}
                {insight.eta_assessment && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {insight.eta_assessment}
                  </div>
                )}

                {/* Current rate */}
                {insight.current_rate_assessment && (
                  <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', paddingLeft: 2 }}>
                    {insight.current_rate_assessment}
                  </div>
                )}

                {/* Risk factors */}
                {Array.isArray(insight.risk_factors) && insight.risk_factors.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Risk Factors
                    </Text>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#dc2626', fontSize: 13 }}>
                      {insight.risk_factors.map((f, i) => <li key={i} style={{ marginBottom: 3 }}>{f}</li>)}
                    </ul>
                  </div>
                )}

                {/* Recommended actions */}
                {Array.isArray(insight.recommended_actions) && insight.recommended_actions.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Recommended Actions
                    </Text>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#16a34a', fontSize: 13 }}>
                      {insight.recommended_actions.map((a, i) => <li key={i} style={{ marginBottom: 3 }}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </AiSuggestionCard>

        {/* Job card context */}
        {aiJcRecord && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>
            <Text strong style={{ display: 'block', marginBottom: 6, color: '#374151', fontSize: 13 }}>Job Card Details</Text>
            <div>Work Order: <strong style={{ color: '#111827' }}>{aiJcRecord.WorkOrder?.wo_no || '—'}</strong></div>
            <div>Machine: <strong style={{ color: '#111827' }}>{aiJcRecord.Machine?.name || '—'}</strong></div>
            <div>Operator: <strong style={{ color: '#111827' }}>{aiJcRecord.Operator?.name || '—'}</strong></div>
            <div>Start Time: <strong style={{ color: '#111827' }}>{aiJcRecord.start_time ? dayjs(aiJcRecord.start_time).format('DD MMM YYYY HH:mm') : '—'}</strong></div>
            <div>Qty Produced: <strong style={{ color: '#111827' }}>{aiJcRecord.qty_produced != null ? parseFloat(aiJcRecord.qty_produced).toLocaleString() : '—'}</strong></div>
            <div>Status: <strong style={{ color: '#111827' }}>{STATUS_CONFIG[aiJcRecord.status]?.label || aiJcRecord.status || '—'}</strong></div>
          </div>
        )}
      </Drawer>

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit Job Card — ${editing.job_no}` : 'New Job Card'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update' : 'Create Job Card'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="work_order_id"
            label="Work Order"
            rules={[{ required: true, message: 'Select a work order' }]}
          >
            <Select
              showSearch
              placeholder="Select work order"
              optionFilterProp="label"
              options={workOrders.map((wo) => ({
                value: wo.id,
                label: `${wo.wo_no}${wo.fpi_status === 'pending' ? ' (FPI Pending)' : wo.fpi_status === 'fail' ? ' (FPI Failed)' : ''}`,
              }))}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.work_order_id !== cur.work_order_id}>
            {() => {
              const woId = form.getFieldValue('work_order_id');
              const wo = workOrders.find((w) => w.id === woId);
              if (wo?.fpi_status === 'pending') {
                return <Alert type="warning" message="FPI not yet completed for this Work Order" showIcon style={{ marginBottom: 16 }} />;
              }
              if (wo?.fpi_status === 'fail') {
                return <Alert type="error" message="FPI failed — resolve before starting production" showIcon style={{ marginBottom: 16 }} />;
              }
              return null;
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="machine_id" label="Machine">
                <Select
                  showSearch
                  placeholder="Select machine"
                  optionFilterProp="label"
                  options={machines.map((m) => ({ value: m.id, label: m.name }))}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="shift_id" label="Shift">
                <Select
                  showSearch
                  placeholder="Select shift"
                  optionFilterProp="label"
                  options={shifts.map((s) => ({ value: s.id, label: s.name }))}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="operator_id" label="Operator">
            <Select
              showSearch
              placeholder="Select operator"
              optionFilterProp="label"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              allowClear
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Internal notes…" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Close Job Card Modal ──────────────────────────────────────────── */}
      <Modal
        title={`Close Job Card — ${closingCard?.job_no}`}
        open={closeModal}
        onCancel={() => setCloseModal(false)}
        onOk={onClose}
        okText="Close Job Card"
        okButtonProps={{ loading: closingSaving, style: { backgroundColor: '#16a34a', borderColor: '#16a34a' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Quantity Produced *</Text>
            <InputNumber
              min={0}
              precision={0}
              style={{ width: '100%' }}
              value={closingQtyProd}
              onChange={setClosingQtyProd}
              placeholder="Enter produced qty"
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>Quantity Rejected</Text>
            <InputNumber
              min={0}
              precision={0}
              style={{ width: '100%' }}
              value={closingQtyRej}
              onChange={setClosingQtyRej}
              placeholder="0"
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
