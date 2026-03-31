import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, Modal, InputNumber, message, Tooltip,
  Row, Col, Alert, Progress, Popconfirm, Badge, Divider,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, RightOutlined, QrcodeOutlined,
  BulbOutlined, ClockCircleOutlined, CheckCircleFilled, CloseCircleFilled,
  CheckOutlined, StopOutlined, DeleteOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout           from '../../../components/AppLayout';
import ResponsiveTable     from '../../../components/ResponsiveTable';
import usePermissions      from '../../../hooks/usePermissions';
import useAiSuggestion     from '../../../hooks/useAiSuggestion';
import AiSuggestionCard    from '../../../components/AiSuggestion/AiSuggestionCard';
import { jobCardApi, workOrderApi, routingApi } from '../../../api/production.api';
import { machineApi }   from '../../../api/machine.api';
import { shiftApi }     from '../../../api/shift.api';
import { userApi }      from '../../../api/user.api';
import aiApi            from '../../../api/ai.api';
import QrLabelPrint     from '../../../components/common/QrLabelPrint';
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

const STATUS_CONFIG = {
  open:      { color: 'orange', label: 'Open'      },
  closed:    { color: 'green',  label: 'Closed'    },
  cancelled: { color: 'red',    label: 'Cancelled' },
};

const TYPE_COLOR = {
  machining:  'blue',
  assembly:   'green',
  welding:    'orange',
  inspection: 'purple',
  painting:   'cyan',
  other:      'default',
};

// Efficiency badge — >100% means faster than standard (good)
function EfficiencyBadge({ pct }) {
  if (pct == null) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
  const color  = pct >= 100 ? '#16a34a' : pct >= 80 ? '#d97706' : '#dc2626';
  const label  = pct >= 100 ? 'Good' : pct >= 80 ? 'Avg' : 'Low';
  return (
    <Tooltip title={`${pct}% efficiency (standard CT / actual CT × 100)`}>
      <Tag color={pct >= 100 ? 'success' : pct >= 80 ? 'warning' : 'error'} style={{ fontSize: 11, fontWeight: 600 }}>
        {pct}% · {label}
      </Tag>
    </Tooltip>
  );
}

export default function JobCardsPage() {
  const { can } = usePermissions();
  const canWrite  = can('prod-dpr-daily_production_report-create_edit_delete');
  const canManage = can('prod-dpr-daily_production_report-create_edit_delete');

  const [jobCards,     setJobCards]     = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [machines,     setMachines]     = useState([]);
  const [shifts,       setShifts]       = useState([]);
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [woFilter,     setWoFilter]     = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [qrRecord,   setQrRecord]   = useState(null);
  const [routingSteps, setRoutingSteps] = useState([]);
  const [saving,     setSaving]     = useState(false);

  // AI ETA
  const aiEta = useAiSuggestion(aiApi.getJobCardAiEta);
  const [aiJcDrawerOpen, setAiJcDrawerOpen] = useState(false);
  const [aiJcRecord,     setAiJcRecord]     = useState(null);

  const openAiJcDrawer = (jc) => {
    setAiJcRecord(jc);
    aiEta.reset();
    setAiJcDrawerOpen(true);
    aiEta.fetch(jc.id);
  };

  // Close modal
  const [closeModal,     setCloseModal]     = useState(false);
  const [closingCard,    setClosingCard]     = useState(null);
  const [closingQtyProd, setClosingQtyProd]  = useState(null);
  const [closingQtyRej,  setClosingQtyRej]   = useState(0);
  const [closingBreak,   setClosingBreak]    = useState(0);
  const [closingNotes,   setClosingNotes]    = useState('');
  const [closingSaving,  setClosingSaving]   = useState(false);

  // QA inspection state (BUG-013)
  const [qaParams,     setQaParams]     = useState([]);
  const [qaInspector,  setQaInspector]  = useState(null);
  const [qaLoading,    setQaLoading]    = useState(false);
  const [inspectors,   setInspectors]   = useState([]);

  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search        = search;
      if (statusFilter) params.status        = statusFilter;
      if (woFilter)     params.work_order_id = woFilter;
      const data = await jobCardApi.getAll(params);
      setJobCards(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load job cards'); }
    finally { setLoading(false); }
  }, [search, statusFilter, woFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      workOrderApi.getAll({ limit: 500 }).catch(() => []),
      machineApi.getAll({ limit: 500 }).catch(() => []),
      shiftApi.getAll().catch(() => []),
      userApi.getAll({ limit: 500, roles: 'operator' }).catch(() => []),
      userApi.getAll({ limit: 500, roles: 'quality_manager,quality_incharge' }).catch(() => []),
    ]).then(([wo, m, s, u, insp]) => {
      setWorkOrders(Array.isArray(wo) ? wo : (wo?.data ?? []));
      setMachines(Array.isArray(m) ? m : (m?.data ?? []));
      setShifts(Array.isArray(s) ? s : (s?.data ?? []));
      setUsers(Array.isArray(u) ? u : (u?.data ?? []));
      setInspectors(Array.isArray(insp) ? insp : (insp?.data ?? []));
    });
  }, []);

  const total       = jobCards.length;
  const countOpen   = jobCards.filter((r) => r.status === 'open').length;
  const countClosed = jobCards.filter((r) => r.status === 'closed').length;

  const loadRoutingSteps = async (woId) => {
    setRoutingSteps([]);
    form.setFieldValue('routing_step_id', undefined);
    if (!woId) return;
    const wo = workOrders.find(w => w.id === woId);
    if (!wo) return;
    const routingId = wo.routing_id || wo.Routing?.id;
    if (!routingId) {
      // Try to find an active routing for the item
      try {
        const allRoutings = await routingApi.getAll({ item_id: wo.item_id, status: 'active', limit: 1 });
        const list = Array.isArray(allRoutings) ? allRoutings : (allRoutings?.data ?? []);
        if (list.length > 0 && list[0].id) {
          const detail = await routingApi.getById(list[0].id);
          const steps = detail?.data?.RoutingSteps || detail?.RoutingSteps || [];
          setRoutingSteps(steps.sort((a, b) => a.step_no - b.step_no));
        }
      } catch { /* no routing found */ }
      return;
    }
    try {
      const detail = await routingApi.getById(routingId);
      const steps = detail?.data?.RoutingSteps || detail?.RoutingSteps || [];
      setRoutingSteps(steps.sort((a, b) => a.step_no - b.step_no));
    } catch { /* ignore */ }
  };

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setRoutingSteps([]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      work_order_id:   record.work_order_id,
      routing_step_id: record.routing_step_id || undefined,
      machine_id:      record.machine_id,
      operator_id:     record.operator_id,
      shift_id:        record.shift_id,
      notes:           record.notes,
    });
    loadRoutingSteps(record.work_order_id);
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        work_order_id:   vals.work_order_id,
        routing_step_id: vals.routing_step_id || null,
        machine_id:      vals.machine_id  || null,
        operator_id:     vals.operator_id || null,
        shift_id:        vals.shift_id    || null,
        notes:           vals.notes       || '',
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

  const openCloseModal = async (record) => {
    setClosingCard(record);
    setClosingQtyProd(null);
    setClosingQtyRej(0);
    setClosingBreak(0);
    setClosingNotes('');
    setQaParams([]);
    setQaInspector(null);
    setCloseModal(true);

    // BUG-013: Load QA template + existing results if routing step requires QC
    const qcRequired = record.RoutingStep?.quality_check;
    if (qcRequired) {
      setQaLoading(true);
      try {
        const [tplRes, existRes] = await Promise.all([
          jobCardApi.getQaTemplate(record.id).catch(() => ({ data: [] })),
          jobCardApi.getQaResults(record.id).catch(() => ({ data: [] })),
        ]);
        const template = Array.isArray(tplRes) ? tplRes : (tplRes?.data ?? []);
        const existing = Array.isArray(existRes) ? existRes : (existRes?.data ?? []);

        if (existing.length > 0) {
          // Use existing results (pre-populate)
          setQaParams(existing.map((r) => ({
            parameter_name: r.parameter_name,
            specification:  r.specification,
            min_value:      r.min_value != null ? parseFloat(r.min_value) : null,
            max_value:      r.max_value != null ? parseFloat(r.max_value) : null,
            actual_value:   r.actual_value != null ? parseFloat(r.actual_value) : null,
            unit:           r.unit,
            notes:          r.notes,
          })));
          if (existing[0]?.inspector_id) setQaInspector(existing[0].inspector_id);
        } else if (template.length > 0) {
          // Use template (empty actual values)
          setQaParams(template.map((t) => ({
            parameter_name: t.parameter_name,
            specification:  t.specification,
            min_value:      t.min_value,
            max_value:      t.max_value,
            actual_value:   null,
            unit:           t.unit,
            notes:          '',
          })));
        }
      } catch { /* ignore */ }
      finally { setQaLoading(false); }
    }
  };

  const onClose = async () => {
    if (!closingQtyProd && closingQtyProd !== 0) { message.error('Enter qty produced'); return; }

    const qcRequired = closingCard?.RoutingStep?.quality_check;

    // BUG-013: Validate QA results before closing if QC required
    if (qcRequired && qaParams.length > 0) {
      const hasUnfilled = qaParams.some((p) => p.actual_value == null);
      if (hasUnfilled) {
        message.error('Complete QA inspection first — fill all actual values');
        return;
      }
    }

    setClosingSaving(true);
    try {
      // BUG-013: Save QA results first if QC required
      if (qcRequired && qaParams.length > 0) {
        await jobCardApi.saveQaResults(closingCard.id, {
          results: qaParams,
          inspector_id: qaInspector || null,
        });
      }

      await jobCardApi.close(closingCard.id, {
        qty_produced:  closingQtyProd,
        qty_rejected:  closingQtyRej || 0,
        break_minutes: closingBreak  || 0,
        notes:         closingNotes  || undefined,
      });
      message.success('Job card closed');
      setCloseModal(false);
      load();
    } catch (err) {
      message.error(err?.message || 'Close failed');
    } finally { setClosingSaving(false); }
  };

  const onCancel = async (id) => {
    try {
      await jobCardApi.cancel(id);
      message.success('Job card cancelled');
      load();
    } catch (err) { message.error(err?.message || 'Cancel failed'); }
  };

  const onDelete = async (id) => {
    try {
      await jobCardApi.delete(id);
      message.success('Job card deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  const columns = [
    {
      title: 'Job No', dataIndex: 'job_no', key: 'job_no', width: 140,
      render: (no, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 600, cursor: canWrite ? 'pointer' : 'default', fontSize: 13 }}
          onClick={() => canWrite && openEdit(r)}
        >
          {no}
        </Text>
      ),
    },
    {
      title: 'Work Order', key: 'work_order', width: 130,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.WorkOrder?.wo_no || '—'}</Text>,
    },
    {
      title: 'Step / Operation', key: 'operation', width: 190,
      render: (_, r) => {
        const stepNo = r.step_no;
        const opName = r.operation_name || r.RoutingStep?.operation_name;
        const wc     = r.RoutingStep?.WorkCenter;
        if (!opName) return <Text type="secondary" style={{ fontSize: 11 }}>Manual / Ad-hoc</Text>;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {stepNo != null && (
                <Tag color="geekblue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>S{stepNo}</Tag>
              )}
              <Text style={{ fontSize: 12, fontWeight: 500 }}>{opName}</Text>
            </div>
            {wc && (
              <Tag color={TYPE_COLOR[wc.type] || 'default'} style={{ fontSize: 10, marginTop: 2 }}>
                {wc.name}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Target CT', key: 'target_ct', width: 90, align: 'right',
      render: (_, r) => {
        const ct = r.cycle_time_min ?? r.RoutingStep?.cycle_time_min;
        return ct != null && parseFloat(ct) > 0
          ? <Text style={{ fontSize: 12 }}>{parseFloat(ct).toFixed(1)} min</Text>
          : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
      },
    },
    {
      title: 'Actual CT', key: 'actual_ct', width: 90, align: 'right',
      render: (_, r) => r.cycle_time_actual != null
        ? <Text style={{ fontSize: 12 }}>{parseFloat(r.cycle_time_actual).toFixed(1)} min</Text>
        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Efficiency', key: 'efficiency', width: 100,
      render: (_, r) => <EfficiencyBadge pct={r.efficiency_pct} />,
    },
    {
      title: 'Machine', key: 'machine', width: 110,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Machine?.name || '—'}</Text>,
    },
    {
      title: 'Operator', key: 'operator', width: 120,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Operator?.name || '—'}</Text>,
    },
    {
      title: 'Qty Produced', dataIndex: 'qty_produced', key: 'qty_produced', width: 100, align: 'right',
      render: (v) => v != null ? <Text style={{ fontSize: 12 }}>{parseFloat(v).toLocaleString()}</Text> : '—',
    },
    {
      title: 'Qty Rejected', dataIndex: 'qty_rejected', key: 'qty_rejected', width: 100, align: 'right',
      render: (v) => v != null ? (
        <Text style={{ color: v > 0 ? '#dc2626' : undefined, fontSize: 12 }}>{parseFloat(v).toLocaleString()}</Text>
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
      title: 'QC', key: 'qc_status', width: 70, align: 'center',
      render: (_, r) => {
        if (!r.RoutingStep?.quality_check) return null;
        const results = r.QaResults || [];
        if (results.length === 0) return <Tag color="orange" style={{ fontSize: 10 }}>QC &#x23F3;</Tag>;
        return <Tag color="green" style={{ fontSize: 10 }}>QC &#x2713;</Tag>;
      },
    },
    {
      title: 'FPI', key: 'fpi_status', width: 105,
      render: (_, r) => {
        const s = r.WorkOrder?.fpi_status;
        if (!s || s === 'not_required') return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        const cfg = {
          pending:     { color: 'orange', label: 'Pending'     },
          pass:        { color: 'green',  label: 'Pass'        },
          fail:        { color: 'red',    label: 'Fail'        },
          conditional: { color: 'gold',   label: 'Conditional' },
        }[s] || { color: 'default', label: s };
        return (
          <Tooltip title={`Work Order FPI: ${cfg.label}`}>
            <Tag color={cfg.color} style={{ fontSize: 10 }}>FPI: {cfg.label}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'AI', key: 'ai', width: 44, align: 'center',
      render: (_, r) => (
        <Tooltip title="AI ETA Prediction">
          <Button size="small" type="text" icon={<BulbOutlined style={{ color: '#7c3aed' }} />} onClick={() => openAiJcDrawer(r)} />
        </Tooltip>
      ),
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
      title: 'Actions', key: 'actions', width: 130, fixed: 'right',
      render: (_, r) => (
        <Space size={2}>
          {r.status === 'open' && (
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
            </Tooltip>
          )}
          {r.status === 'open' && (
            <Tooltip title="Close Job Card">
              <Button
                size="small" type="primary"
                icon={<CheckOutlined />}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                onClick={() => openCloseModal(r)}
              />
            </Tooltip>
          )}
          {r.status === 'open' && canManage && (
            <Popconfirm title="Cancel this job card?" onConfirm={() => onCancel(r.id)} okText="Cancel JC" okType="danger">
              <Tooltip title="Cancel">
                <Button size="small" danger icon={<StopOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {r.status === 'open' && !r.start_time && canManage && (
            <Popconfirm title="Delete this job card?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

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
        Track production execution — operation steps, cycle times, efficiency, and output per run.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Open: {countOpen}</Tag>
        <Tag color="green">Closed: {countClosed}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
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
            style={{ width: 140 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('job-cards.csv', jobCards, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              New Job Card
            </Button>
          )}
        </div>

        <ResponsiveTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={jobCards}
          size="small"
          scroll={{ x: 1600 }}
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {insight.on_track === true  && <Tag color="green" icon={<CheckCircleFilled />}>On Track</Tag>}
                  {insight.on_track === false && <Tag color="red"   icon={<CloseCircleFilled />}>Behind Schedule</Tag>}
                  {insight.on_track == null   && <Tag color="default" icon={<ClockCircleOutlined />}>Not Started</Tag>}
                  <Tag color="purple">Confidence: {insight.confidence || '—'}</Tag>
                </div>
                {insight.eta_assessment && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {insight.eta_assessment}
                  </div>
                )}
                {insight.current_rate_assessment && (
                  <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{insight.current_rate_assessment}</div>
                )}
                {Array.isArray(insight.risk_factors) && insight.risk_factors.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>Risk Factors</Text>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#dc2626', fontSize: 13 }}>
                      {insight.risk_factors.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(insight.recommended_actions) && insight.recommended_actions.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>Recommended Actions</Text>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#16a34a', fontSize: 13 }}>
                      {insight.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </AiSuggestionCard>

        {aiJcRecord && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>
            <Text strong style={{ display: 'block', marginBottom: 6, color: '#374151', fontSize: 13 }}>Job Card Details</Text>
            <div>Work Order: <strong style={{ color: '#111827' }}>{aiJcRecord.WorkOrder?.wo_no || '—'}</strong></div>
            <div>Operation: <strong style={{ color: '#111827' }}>{aiJcRecord.operation_name || aiJcRecord.RoutingStep?.operation_name || 'Manual'}</strong></div>
            <div>Machine: <strong style={{ color: '#111827' }}>{aiJcRecord.Machine?.name || '—'}</strong></div>
            <div>Standard Cycle: <strong style={{ color: '#111827' }}>{aiJcRecord.cycle_time_min ?? aiJcRecord.RoutingStep?.cycle_time_min ? `${parseFloat(aiJcRecord.cycle_time_min ?? aiJcRecord.RoutingStep?.cycle_time_min).toFixed(1)} min/pc` : '—'}</strong></div>
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
          <Form.Item name="work_order_id" label="Work Order" rules={[{ required: true, message: 'Select a work order' }]}>
            <Select
              showSearch placeholder="Select work order" optionFilterProp="label"
              onChange={(v) => loadRoutingSteps(v)}
              options={workOrders.map((wo) => ({
                value: wo.id,
                label: `${wo.wo_no}${wo.fpi_status === 'pending' ? ' (FPI Pending)' : wo.fpi_status === 'fail' ? ' (FPI Failed)' : ''}`,
              }))}
            />
          </Form.Item>

          {routingSteps.length > 0 && (
            <Form.Item name="routing_step_id" label="Routing Step (Operation)">
              <Select
                showSearch placeholder="Select routing step" optionFilterProp="label" allowClear
                options={routingSteps.map((s) => ({
                  value: s.id,
                  label: `S${s.step_no} — ${s.operation_name}${s.quality_check ? ' (QC)' : ''}`,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.work_order_id !== cur.work_order_id}>
            {() => {
              const woId = form.getFieldValue('work_order_id');
              const wo   = workOrders.find((w) => w.id === woId);
              if (wo?.fpi_status === 'pending') return <Alert type="warning" message="FPI not yet completed for this Work Order" showIcon style={{ marginBottom: 16 }} />;
              if (wo?.fpi_status === 'fail')    return <Alert type="error"   message="FPI failed — resolve before starting production" showIcon style={{ marginBottom: 16 }} />;
              return null;
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="machine_id" label="Machine">
                <Select showSearch placeholder="Select machine" optionFilterProp="label"
                  options={machines.map((m) => ({ value: m.id, label: m.name }))} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="shift_id" label="Shift">
                <Select showSearch placeholder="Select shift" optionFilterProp="label"
                  options={shifts.map((s) => ({ value: s.id, label: s.name }))} allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="operator_id" label="Operator">
            <Select showSearch placeholder="Select operator" optionFilterProp="label"
              options={users.map((u) => ({ value: u.id, label: u.name }))} allowClear />
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
        width={closingCard?.RoutingStep?.quality_check ? 680 : 460}
      >
        {closingCard && (() => {
          const targetCt = closingCard.cycle_time_min ?? closingCard.RoutingStep?.cycle_time_min;
          const opName   = closingCard.operation_name ?? closingCard.RoutingStep?.operation_name;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
              {(opName || targetCt) && (
                <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#374151', border: '1px solid #bae6fd' }}>
                  {opName && <div><strong>Operation:</strong> {opName}</div>}
                  {targetCt && parseFloat(targetCt) > 0 && (
                    <div><strong>Standard Cycle Time:</strong> {parseFloat(targetCt).toFixed(1)} min/piece
                      <Text type="secondary" style={{ fontSize: 11 }}> (efficiency will be calculated on close)</Text>
                    </div>
                  )}
                </div>
              )}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Quantity Produced *</Text>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} value={closingQtyProd} onChange={setClosingQtyProd} placeholder="Enter produced qty" />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Quantity Rejected</Text>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} value={closingQtyRej} onChange={setClosingQtyRej} placeholder="0" />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Break Time (minutes)</Text>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} value={closingBreak} onChange={setClosingBreak} placeholder="0" />
                <Text type="secondary" style={{ fontSize: 11 }}>Break time is excluded from cycle time calculation</Text>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Notes</Text>
                <Input.TextArea rows={2} value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} placeholder="Optional closing notes…" />
              </div>

              {/* BUG-013: QA Inspection Section */}
              {closingCard?.RoutingStep?.quality_check && (
                <div style={{ marginTop: 16 }}>
                  <Divider style={{ margin: '8px 0 12px' }}>QA Inspection</Divider>
                  {qaLoading ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>Loading QA parameters...</Text>
                  ) : qaParams.length === 0 ? (
                    <Alert type="info" message="No quality parameters defined for this item" showIcon style={{ fontSize: 12 }} />
                  ) : (
                    <>
                      <Table
                        size="small"
                        dataSource={qaParams}
                        rowKey={(_, idx) => idx}
                        pagination={false}
                        columns={[
                          { title: 'Parameter', dataIndex: 'parameter_name', width: 140, render: (v) => <Text style={{ fontSize: 12 }}>{v}</Text> },
                          {
                            title: 'Spec', width: 110,
                            render: (_, r) => r.min_value != null && r.max_value != null
                              ? <Text style={{ fontSize: 11 }}>{r.min_value} - {r.max_value}</Text>
                              : <Text style={{ fontSize: 11 }}>{r.specification || '\u2014'}</Text>,
                          },
                          { title: 'Unit', dataIndex: 'unit', width: 55, render: (v) => <Text style={{ fontSize: 11 }}>{v || '\u2014'}</Text> },
                          {
                            title: 'Actual', width: 100,
                            render: (_, r, idx) => (
                              <InputNumber
                                size="small"
                                value={r.actual_value}
                                onChange={(v) => {
                                  setQaParams((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], actual_value: v };
                                    return next;
                                  });
                                }}
                                style={{ width: 90 }}
                                placeholder="0.00"
                              />
                            ),
                          },
                          {
                            title: 'Result', width: 70,
                            render: (_, r) => {
                              if (r.actual_value == null) return <Tag>Pending</Tag>;
                              if (r.min_value != null && r.max_value != null) {
                                const pass = parseFloat(r.actual_value) >= parseFloat(r.min_value) && parseFloat(r.actual_value) <= parseFloat(r.max_value);
                                return <Tag color={pass ? 'green' : 'red'}>{pass ? 'Pass' : 'Fail'}</Tag>;
                              }
                              return <Tag color="green">Pass</Tag>;
                            },
                          },
                        ]}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Inspector</Text>
                        <Select
                          size="small"
                          placeholder="Select inspector"
                          value={qaInspector}
                          onChange={setQaInspector}
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          options={inspectors.map((u) => ({ value: u.id, label: u.name }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
      {/* QR Label Modal */}
      <QrLabelPrint
        open={!!qrRecord}
        onClose={() => setQrRecord(null)}
        type="JC"
        code={qrRecord?.job_no}
        title={qrRecord?.job_no}
        subtitle={qrRecord?.WorkOrder?.wo_no || qrRecord?.operation_name || ''}
      />
    </AppLayout>
  );
}
