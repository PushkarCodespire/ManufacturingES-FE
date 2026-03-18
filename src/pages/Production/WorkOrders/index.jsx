import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col, Dropdown, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  DownOutlined, BulbOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout           from '../../../components/AppLayout';
import usePermissions      from '../../../hooks/usePermissions';
import useAiSuggestion     from '../../../hooks/useAiSuggestion';
import AiSuggestionCard    from '../../../components/AiSuggestion/AiSuggestionCard';
import { workOrderApi }    from '../../../api/production.api';
import { itemApi }         from '../../../api/item.api';
import { machineApi }      from '../../../api/machine.api';
import { shiftApi }        from '../../../api/shift.api';
import api                 from '../../../api/axios';
import aiApi               from '../../../api/ai.api';

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

const DELAY_RISK_COLOR = {
  none:     'green',
  low:      'cyan',
  medium:   'orange',
  high:     'red',
  critical: 'red',
};

const STATUS_CONFIG = {
  draft:       { color: 'default',    label: 'Draft'       },
  open:        { color: 'blue',       label: 'Open'        },
  in_progress: { color: 'processing', label: 'In Progress' },
  on_hold:     { color: 'orange',     label: 'On Hold'     },
  completed:   { color: 'green',      label: 'Completed'   },
  cancelled:   { color: 'red',        label: 'Cancelled'   },
};

const FPI_STATUS_CONFIG = {
  not_required: { color: 'default', label: 'N/A'     },
  pending:      { color: 'orange',  label: 'FPI Pending' },
  pass:         { color: 'green',   label: 'FPI Pass'    },
  fail:         { color: 'red',     label: 'FPI Fail'    },
};

const STATUS_TRANSITIONS = {
  draft:       ['open', 'cancelled'],
  open:        ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold:     ['in_progress', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low'    },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
];

export default function WorkOrdersPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-work_centre-manage_work_centre-create_edit_delete');

  const [workOrders,    setWorkOrders]    = useState([]);
  const [items,         setItems]         = useState([]);
  const [machines,      setMachines]      = useState([]);
  const [shifts,        setShifts]        = useState([]);
  const [customerOrders,setCustomerOrders]= useState([]);
  const [loading,       setLoading]       = useState(false);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);

  // ── AI delay risk ──────────────────────────────────────────────────────────
  const aiDelay    = useAiSuggestion(aiApi.getWoAiDelayRisk);
  const [aiWoDrawerOpen, setAiWoDrawerOpen] = useState(false);
  const [aiWoRecord,     setAiWoRecord]     = useState(null);

  const openAiWoDrawer = (wo) => {
    setAiWoRecord(wo);
    aiDelay.reset();
    setAiWoDrawerOpen(true);
    aiDelay.fetch(wo.id);
  };

  const [form] = Form.useForm();

  // ── Load work orders ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await workOrderApi.getAll(params);
      setWorkOrders(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load work orders'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      machineApi.getAll({ limit: 500 }).catch(() => []),
      shiftApi.getAll().catch(() => []),
      api.get('/customer-orders', { params: { limit: 500 } }).catch(() => ({ data: [] })),
    ]).then(([i, m, s, co]) => {
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setMachines(Array.isArray(m) ? m : (m?.data ?? []));
      setShifts(Array.isArray(s) ? s : (s?.data ?? []));
      const coData = Array.isArray(co) ? co : (co?.data ?? []);
      setCustomerOrders(coData);
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total       = workOrders.length;
  const countDraft  = workOrders.filter((r) => r.status === 'draft').length;
  const countIP     = workOrders.filter((r) => r.status === 'in_progress').length;
  const countDone   = workOrders.filter((r) => r.status === 'completed').length;

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      planned_start: dayjs(),
      priority:      'normal',
    });
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      item_id:           record.item_id,
      machine_id:        record.machine_id,
      shift_id:          record.shift_id,
      customer_order_id: record.customer_order_id,
      planned_qty:       parseFloat(record.planned_qty) || null,
      planned_start:     record.planned_start ? dayjs(record.planned_start) : null,
      planned_end:       record.planned_end   ? dayjs(record.planned_end)   : null,
      priority:          record.priority || 'normal',
      notes:             record.notes,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        item_id:           vals.item_id,
        machine_id:        vals.machine_id        || null,
        shift_id:          vals.shift_id          || null,
        customer_order_id: vals.customer_order_id || null,
        planned_qty:       vals.planned_qty,
        planned_start:     vals.planned_start?.format('YYYY-MM-DD') || null,
        planned_end:       vals.planned_end?.format('YYYY-MM-DD')   || null,
        priority:          vals.priority || 'normal',
        notes:             vals.notes || '',
      };
      if (editing) {
        await workOrderApi.update(editing.id, payload);
        message.success('Work order updated');
      } else {
        await workOrderApi.create(payload);
        message.success('Work order created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onStatusChange = async (id, status) => {
    try {
      await workOrderApi.updateStatus(id, status);
      message.success(`Status updated to ${STATUS_CONFIG[status]?.label || status}`);
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Status update failed'); }
  };

  const onDelete = async (id) => {
    try {
      await workOrderApi.delete(id);
      message.success('Work order deleted');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Delete failed'); }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'WO No', dataIndex: 'wo_no', key: 'wo_no', width: 150,
      render: (no, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => openEdit(r)}
        >
          {no}
        </Text>
      ),
    },
    {
      title: 'Item', key: 'item', width: 200,
      render: (_, r) => r.Item ? (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Item.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Item.code}</Text>
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Machine', key: 'machine', width: 130,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Machine?.name || '—'}</Text>,
    },
    {
      title: 'Planned Qty', dataIndex: 'planned_qty', key: 'planned_qty', width: 110, align: 'right',
      render: (v) => v != null ? parseFloat(v).toLocaleString() : '—',
    },
    {
      title: 'Produced Qty', dataIndex: 'produced_qty', key: 'produced_qty', width: 110, align: 'right',
      render: (v) => v != null ? parseFloat(v).toLocaleString() : '0',
    },
    {
      title: 'Planned Start', dataIndex: 'planned_start', key: 'planned_start', width: 120,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Planned End', dataIndex: 'planned_end', key: 'planned_end', width: 120,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'FPI', dataIndex: 'fpi_status', key: 'fpi_status', width: 100,
      render: (s) => {
        if (!s || s === 'not_required') return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        const cfg = FPI_STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Created By', key: 'creator', width: 120,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Creator?.name || '—'}</Text>,
    },
    {
      title: 'AI', key: 'ai', width: 54, align: 'center',
      render: (_, r) => (
        <Tooltip title="AI Delay Risk Analysis">
          <Button
            size="small"
            type="text"
            icon={<BulbOutlined style={{ color: '#7c3aed' }} />}
            onClick={() => openAiWoDrawer(r)}
          />
        </Tooltip>
      ),
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 160,
      render: (_, r) => {
        const transitions = STATUS_TRANSITIONS[r.status] || [];
        const canEdit     = ['draft', 'open'].includes(r.status);
        const canDelete   = r.status === 'draft';

        return (
          <Space size={4}>
            {canEdit && (
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
            )}
            {transitions.length > 0 && (
              <Dropdown
                menu={{
                  items: transitions.map((s) => ({
                    key:   s,
                    label: STATUS_CONFIG[s]?.label || s,
                  })),
                  onClick: ({ key }) => onStatusChange(r.id, key),
                }}
              >
                <Button size="small">
                  Status <DownOutlined />
                </Button>
              </Dropdown>
            )}
            {canDelete && (
              <Popconfirm
                title="Delete this work order?"
                onConfirm={() => onDelete(r.id)}
                okText="Delete"
                okType="danger"
              >
                <Tooltip title="Delete">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    }] : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Work Orders</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Work Orders</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Create and track work orders from Customer PO to production floor.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="default">Draft: {countDraft}</Tag>
        <Tag color="processing">In Progress: {countIP}</Tag>
        <Tag color="green">Completed: {countDone}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search WO number..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 160 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              New Work Order
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={workOrders}
          size="small"
          scroll={{ x: 1400 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── AI Delay Risk Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BulbOutlined style={{ color: '#7c3aed' }} />
            <span>AI Delay Risk — {aiWoRecord?.wo_no}</span>
          </div>
        }
        open={aiWoDrawerOpen}
        onClose={() => setAiWoDrawerOpen(false)}
        width={500}
        destroyOnClose={false}
      >
        <AiSuggestionCard
          loading={aiDelay.loading}
          error={aiDelay.error}
          aiAvailable={aiDelay.aiAvailable}
          cached={aiDelay.cached}
          onRetry={() => aiWoRecord && aiDelay.fetch(aiWoRecord.id)}
          onDismiss={() => setAiWoDrawerOpen(false)}
          style={{ marginBottom: 16 }}
        >
          {(() => {
            const insight = parseInsight(aiDelay.data?.ai_insight);
            if (!insight) return null;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Risk badges */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color={DELAY_RISK_COLOR[insight.delay_risk] || 'default'} style={{ fontWeight: 600 }}>
                    Risk: {String(insight.delay_risk || '—').toUpperCase()}
                  </Tag>
                  <Tag color="purple">Confidence: {insight.confidence || '—'}</Tag>
                  {insight.expedite_required && (
                    <Tag color="red" icon={<ThunderboltOutlined />}>Expedite Required</Tag>
                  )}
                </div>

                {/* Risk summary */}
                {insight.risk_summary && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {insight.risk_summary}
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

        {/* WO context */}
        {aiWoRecord && (
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>
            <Text strong style={{ display: 'block', marginBottom: 6, color: '#374151', fontSize: 13 }}>Work Order Details</Text>
            <div>Item: <strong style={{ color: '#111827' }}>{aiWoRecord.Item?.name || '—'}</strong></div>
            <div>Planned Qty: <strong style={{ color: '#111827' }}>{aiWoRecord.planned_qty ? parseFloat(aiWoRecord.planned_qty).toLocaleString() : '—'}</strong></div>
            <div>Produced Qty: <strong style={{ color: '#111827' }}>{aiWoRecord.produced_qty ? parseFloat(aiWoRecord.produced_qty).toLocaleString() : '0'}</strong></div>
            <div>Planned End: <strong style={{ color: '#111827' }}>{aiWoRecord.planned_end ? dayjs(aiWoRecord.planned_end).format('DD MMM YYYY') : '—'}</strong></div>
            <div>Status: <strong style={{ color: '#111827' }}>{STATUS_CONFIG[aiWoRecord.status]?.label || aiWoRecord.status || '—'}</strong></div>
          </div>
        )}
      </Drawer>

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit Work Order — ${editing.wo_no}` : 'New Work Order'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update' : 'Create Work Order'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="item_id"
                label="Item"
                rules={[{ required: true, message: 'Select an item' }]}
              >
                <Select
                  showSearch
                  placeholder="Search item by name or code"
                  optionFilterProp="label"
                  options={items.map((i) => ({
                    value: i.id,
                    label: `${i.name}${i.code ? ` (${i.code})` : ''}`,
                  }))}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="Priority">
                <Select options={PRIORITY_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

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

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customer_order_id" label="Customer Order">
                <Select
                  showSearch
                  placeholder="Select customer order"
                  optionFilterProp="label"
                  options={customerOrders.map((co) => ({
                    value: co.id,
                    label: co.order_no || co.po_no || `Order #${co.id}`,
                  }))}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="planned_qty"
                label="Planned Quantity"
                rules={[{ required: true, message: 'Enter planned quantity' }]}
              >
                <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="planned_start" label="Planned Start">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="planned_end" label="Planned End">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Internal notes…" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
