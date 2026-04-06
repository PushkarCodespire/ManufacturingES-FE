import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col, Dropdown, Alert, Modal,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  DownOutlined, BulbOutlined, ThunderboltOutlined,
  ApartmentOutlined, BranchesOutlined, QrcodeOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout           from '../../../components/AppLayout';
import ResponsiveTable     from '../../../components/ResponsiveTable';
import usePermissions      from '../../../hooks/usePermissions';
import useAiSuggestion     from '../../../hooks/useAiSuggestion';
import AiSuggestionCard    from '../../../components/AiSuggestion/AiSuggestionCard';
import { workOrderApi }    from '../../../api/production.api';
import { itemApi }         from '../../../api/item.api';
import { machineApi }      from '../../../api/machine.api';
import { shiftApi }        from '../../../api/shift.api';
import { routingApi }      from '../../../api/routing.api';
import { customerOrderApi } from '../../../api/orders.api';
import api                 from '../../../api/axios';
import aiApi               from '../../../api/ai.api';
import QrLabelPrint        from '../../../components/common/QrLabelPrint';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal      from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

// ── CSV Upload config ─────────────────────────────────────────────────────────
const WO_CSV_HEADERS = ['Item Code', 'Planned Qty', 'Planned Start', 'Planned End', 'Priority', 'Machine Code', 'Routing Name', 'Shift Name', 'Customer Order No', 'Notes'];
const WO_CSV_SAMPLE = [
  { 'Item Code': 'ITM-001', 'Planned Qty': '500', 'Planned Start': '2025-06-15', 'Planned End': '2025-06-30', 'Priority': 'normal', 'Machine Code': 'MC-01', 'Routing Name': '', 'Shift Name': 'Day Shift', 'Customer Order No': '', 'Notes': '' },
];
const WO_CSV_VALIDATION = [
  { field: 'Item Code', required: true },
  { field: 'Planned Qty', required: true, validate: (v) => isNaN(parseFloat(v)) ? 'Qty must be a number' : null },
];

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
  released:    { color: 'cyan',       label: 'Released'    },
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
  open:        ['released', 'in_progress', 'on_hold', 'cancelled'],
  released:    ['in_progress', 'on_hold', 'cancelled'],
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
  const [routings,      setRoutings]      = useState([]);
  const [customerOrders,setCustomerOrders]= useState([]);
  const [loading,       setLoading]       = useState(false);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState(null);
  const [woTypeFilter,  setWoTypeFilter]  = useState(null);
  const [csvModalOpen, setCsvModalOpen]  = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);

  // QR label state
  const [qrRecord, setQrRecord] = useState(null);

  // Sub-assembly state
  const [subWoMap,   setSubWoMap]   = useState({});   // parentId -> sub-WOs array
  const [subLoading, setSubLoading] = useState({});   // parentId -> bool
  const [genLoading, setGenLoading] = useState({});   // parentId -> bool
  const [subDrawer,  setSubDrawer]  = useState(false);
  const [subParent,  setSubParent]  = useState(null);
  const [subForm]                   = Form.useForm();
  const [subSaving,  setSubSaving]  = useState(false);

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
      if (search)       params.search   = search;
      if (statusFilter) params.status   = statusFilter;
      if (woTypeFilter) params.wo_type  = woTypeFilter;
      const data = await workOrderApi.getAll(params);
      setWorkOrders(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load work orders'); }
    finally { setLoading(false); }
  }, [search, statusFilter, woTypeFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      machineApi.getAll({ limit: 500 }).catch(() => []),
      shiftApi.getAll().catch(() => []),
      api.get('/customer-orders', { params: { limit: 500 } }).catch(() => ({ data: [] })),
      routingApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
    ]).then(([i, m, s, co, rt]) => {
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setMachines(Array.isArray(m) ? m : (m?.data ?? []));
      setShifts(Array.isArray(s) ? s : (s?.data ?? []));
      const coData = Array.isArray(co) ? co : (co?.data ?? []);
      setCustomerOrders(coData);
      setRoutings(Array.isArray(rt) ? rt : (rt?.data ?? []));
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
      routing_id:        record.routing_id || null,
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
        routing_id:        vals.routing_id        || null,
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
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onStatusChange = async (id, status) => {
    try {
      const res = await workOrderApi.updateStatus(id, status);
      message.success(`Status updated to ${STATUS_CONFIG[status]?.label || status}`);
      if (res?.stock_receipt) {
        message.success(`WO completed — ${res.stock_receipt.qty} units added to ${res.stock_receipt.warehouse}`);
      }
      if (res?.oqc_created) {
        message.info(`OQC inspection ${res.oqc_created.inspection_no} auto-created`);
      }
      load();
    } catch (err) { message.error(err?.message || 'Status update failed'); }
  };

  const onDelete = async (id) => {
    try {
      await workOrderApi.delete(id);
      message.success('Work order deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── CSV Import handler ────────────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const itemCode = (row['Item Code'] || '').trim();
        const item = items.find((i) => i.code?.toLowerCase() === itemCode.toLowerCase() || i.name?.toLowerCase() === itemCode.toLowerCase());
        if (!item) throw new Error(`Item "${itemCode}" not found`);
        const machCode = (row['Machine Code'] || '').trim();
        const machine = machCode ? machines.find((m) => m.code?.toLowerCase() === machCode.toLowerCase() || m.name?.toLowerCase() === machCode.toLowerCase()) : null;
        const routingName = (row['Routing Name'] || '').trim();
        const routing = routingName ? routings.find((r) => r.name?.toLowerCase() === routingName.toLowerCase()) : null;
        const shiftName = (row['Shift Name'] || '').trim();
        const shift = shiftName ? shifts.find((s) => s.name?.toLowerCase() === shiftName.toLowerCase()) : null;
        const coNo = (row['Customer Order No'] || '').trim();
        const co = coNo ? customerOrders.find((c) => (c.order_no || c.co_no || '')?.toLowerCase() === coNo.toLowerCase()) : null;
        await workOrderApi.create({
          item_id:           item.id,
          machine_id:        machine?.id || null,
          routing_id:        routing?.id || null,
          shift_id:          shift?.id || null,
          customer_order_id: co?.id || null,
          planned_qty:       parseFloat(row['Planned Qty']) || 1,
          planned_start:     row['Planned Start'] || dayjs().format('YYYY-MM-DD'),
          planned_end:       row['Planned End'] || null,
          priority:          row['Priority'] || 'normal',
          notes:             row['Notes'] || '',
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Item Code']}": ${err?.response?.data?.message || err.message}`);
      }
    }
    load();
    return { success, failed, errors };
  };

  const handleGenerateJC = async (record) => {
    try {
      const res = await api.post(`/work-orders/${record.id}/generate-job-cards`);
      if (res.success) {
        message.success(res.message || 'Job cards generated');
        load();
      } else {
        message.error(res.message || 'Failed to generate job cards');
      }
    } catch (err) {
      message.error(err?.message || 'Failed to generate job cards');
    }
  };

  // ── Sub-assembly helpers ────────────────────────────────────────────────────
  const loadSubAssemblies = async (parentId) => {
    setSubLoading(p => ({ ...p, [parentId]: true }));
    try {
      const res = await api.get(`/work-orders/${parentId}/sub-assemblies`);
      setSubWoMap(p => ({ ...p, [parentId]: res.data || [] }));
    } catch { setSubWoMap(p => ({ ...p, [parentId]: [] })); }
    finally { setSubLoading(p => ({ ...p, [parentId]: false })); }
  };

  const handleGenerateSubWos = async (record) => {
    setGenLoading(p => ({ ...p, [record.id]: true }));
    try {
      const res = await api.post(`/work-orders/${record.id}/generate-sub-assemblies`);
      if (res.success) {
        message.success(res.message || 'Sub-assembly WOs generated');
        loadSubAssemblies(record.id);
      } else {
        message.error(res.message || 'Failed to generate sub-assembly WOs');
      }
    } catch (err) {
      message.error(err?.message || 'Failed to generate sub-assembly WOs');
    } finally {
      setGenLoading(p => ({ ...p, [record.id]: false }));
    }
  };

  const openSubDrawer = (parentRecord) => {
    setSubParent(parentRecord);
    subForm.resetFields();
    subForm.setFieldsValue({ priority: parentRecord.priority || 'normal', planned_start: parentRecord.planned_start ? dayjs(parentRecord.planned_start) : null, planned_end: parentRecord.planned_end ? dayjs(parentRecord.planned_end) : null });
    setSubDrawer(true);
  };

  const handleSaveSubWo = async () => {
    try {
      const vals = await subForm.validateFields();
      setSubSaving(true);
      const payload = {
        item_id:      vals.item_id,
        planned_qty:  vals.planned_qty || 0,
        machine_id:   vals.machine_id  || null,
        priority:     vals.priority    || 'normal',
        planned_start: vals.planned_start?.format('YYYY-MM-DD') || null,
        planned_end:   vals.planned_end?.format('YYYY-MM-DD')   || null,
        notes:         vals.notes || null,
      };
      await api.post(`/work-orders/${subParent.id}/sub-assemblies`, payload);
      message.success('Sub-assembly work order created');
      setSubDrawer(false);
      loadSubAssemblies(subParent.id);
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed to create sub-assembly WO');
    } finally { setSubSaving(false); }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'WO No', dataIndex: 'wo_no', key: 'wo_no', width: 170,
      render: (no, r) => (
        <div>
          <Text
            style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => openEdit(r)}
          >
            {no}
          </Text>
          {r.wo_type === 'sub_assembly' && (
            <Tag color="purple" style={{ marginLeft: 6, fontSize: 10 }}>Sub</Tag>
          )}
          {r.parent_wo_id && (
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
              <ApartmentOutlined /> sub-assembly
            </div>
          )}
        </div>
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
      title: 'Routing', key: 'routing', width: 160,
      render: (_, r) => r.Routing ? (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Routing.code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Routing.name}</Text>
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
      title: 'Steps', key: 'step_progress', width: 110,
      render: (_, r) => {
        const cards       = Array.isArray(r.JobCards) ? r.JobCards : [];
        const routingCards = cards.filter((jc) => jc.routing_step_id);
        const total       = routingCards.length;
        const done        = routingCards.filter((jc) => jc.status === 'closed').length;
        if (total === 0) return <Text type="secondary" style={{ fontSize: 11 }}>No routing</Text>;
        const pct = Math.round((done / total) * 100);
        return (
          <Tooltip title={`${done}/${total} steps completed`}>
            <div>
              <Text style={{ fontSize: 11 }}>{done}/{total}</Text>
              <Badge
                count={`${pct}%`}
                style={{ backgroundColor: pct === 100 ? '#16a34a' : pct > 0 ? '#d97706' : '#6b7280', fontSize: 10, marginLeft: 4 }}
              />
            </div>
          </Tooltip>
        );
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
      title: 'OQC', key: 'oqc', width: 100,
      render: (_, r) => {
        if (r.status !== 'completed') return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        const oqc = r.OqcInspection;
        if (!oqc) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        if (oqc.result === 'pass') return <Tag color="green">OQC ✓</Tag>;
        if (oqc.result === 'fail') return <Tag color="red">OQC ✗</Tag>;
        return <Tag color="orange">OQC ⏳</Tag>;
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
      title: 'Actions', key: 'actions', width: 200,
      render: (_, r) => {
        const transitions = STATUS_TRANSITIONS[r.status] || [];
        const canEdit     = ['draft', 'open'].includes(r.status);
        const canDelete   = r.status === 'draft';
        const isStandard  = r.wo_type !== 'sub_assembly';

        return (
          <Space size={4}>
            {canEdit && (
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
            )}
            {(r.status === 'released' || r.status === 'in_progress') && (
              <Tooltip title="Generate Job Cards from Routing">
                <Button
                  type="text"
                  size="small"
                  icon={<ThunderboltOutlined style={{ color: '#7c3aed' }} />}
                  onClick={() => handleGenerateJC(r)}
                />
              </Tooltip>
            )}
            {isStandard && canWrite && (
              <Dropdown
                menu={{
                  items: [
                    { key: 'gen-sub', label: 'Generate Sub-WOs from BOM', icon: <BranchesOutlined /> },
                    { key: 'add-sub', label: 'Add Sub-Assembly WO', icon: <PlusOutlined /> },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'gen-sub') handleGenerateSubWos(r);
                    if (key === 'add-sub') openSubDrawer(r);
                  },
                }}
              >
                <Tooltip title="Sub-Assembly">
                  <Button size="small" icon={<ApartmentOutlined />} />
                </Tooltip>
              </Dropdown>
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
          <Select
            placeholder="WO Type"
            allowClear
            value={woTypeFilter}
            onChange={setWoTypeFilter}
            options={[{ value: 'standard', label: 'Standard' }, { value: 'sub_assembly', label: 'Sub-Assembly' }]}
            style={{ width: 150 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('work-orders.csv', workOrders, columns)}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)}>Upload CSV</Button>}
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              New Work Order
            </Button>
          )}
        </div>

        <ResponsiveTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={workOrders}
          size="small"
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          expandable={{
            expandedRowRender: (record) => {
              const subs = subWoMap[record.id];
              if (!subs) return <div style={{ padding: '8px 16px', color: '#9ca3af' }}>Loading sub-assemblies…</div>;
              if (subs.length === 0) return (
                <div style={{ padding: '8px 16px', color: '#9ca3af', fontSize: 12 }}>
                  No sub-assembly work orders. Use the <ApartmentOutlined /> menu to generate or add one.
                </div>
              );
              return (
                <Table
                  rowKey="id"
                  dataSource={subs}
                  size="small"
                  pagination={false}
                  style={{ margin: '0 16px' }}
                  columns={[
                    { title: 'WO No', dataIndex: 'wo_no', width: 160, render: v => <Text code style={{ color: '#7c3aed' }}>{v}</Text> },
                    { title: 'Item', key: 'item', render: (_, r) => r.Item ? `${r.Item.name} (${r.Item.code})` : '—' },
                    { title: 'Planned Qty', dataIndex: 'planned_qty', align: 'right', width: 110, render: v => parseFloat(v).toLocaleString() },
                    { title: 'Status', dataIndex: 'status', width: 110, render: s => { const c = STATUS_CONFIG[s]; return <Tag color={c?.color}>{c?.label || s}</Tag>; } },
                    { title: 'Planned Start', dataIndex: 'planned_start', width: 120, render: d => d ? dayjs(d).format('DD MMM YYYY') : '—' },
                    { title: 'Created By', key: 'creator', width: 120, render: (_, r) => r.Creator?.name || '—' },
                  ]}
                />
              );
            },
            onExpand: (expanded, record) => {
              if (expanded && !subWoMap[record.id]) loadSubAssemblies(record.id);
            },
            rowExpandable: (record) => record.wo_type !== 'sub_assembly',
          }}
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
            <Col xs={24} sm={12}>
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
                  onChange={async (coId) => {
                    if (!coId) return;
                    try {
                      const co = await customerOrderApi.getById(coId);
                      const coData = co?.data ?? co;
                      const coItems = coData?.Items || coData?.items || [];
                      if (coItems.length > 0) {
                        const firstItem = coItems[0];
                        const itemId = firstItem.item_id;
                        form.setFieldsValue({
                          item_id: itemId,
                          planned_qty: parseFloat(firstItem.qty_ordered || firstItem.quantity || 0),
                        });
                        // Trigger routing auto-select for the item
                        const activeRoutings = routings.filter(r => r.item_id === itemId && r.status === 'active');
                        if (activeRoutings.length > 0) {
                          form.setFieldValue('routing_id', activeRoutings[0].id);
                        }
                        message.success('Item and quantity loaded from customer order');
                      }
                    } catch (e) {
                      console.warn('Failed to load CO details:', e);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="priority" label="Priority">
                <Select options={PRIORITY_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={16}>
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
                  onChange={(itemId) => {
                    // Auto-select first active routing for selected item
                    const activeRoutings = routings.filter(r => r.item_id === itemId && r.status === 'active');
                    form.setFieldValue('routing_id', activeRoutings.length > 0 ? activeRoutings[0].id : null);
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="planned_qty" label="Planned Quantity" rules={[{ required: true, message: 'Enter planned quantity' }]}>
                <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.item_id !== cur.item_id}
          >
            {({ getFieldValue }) => {
              const selectedItemId = getFieldValue('item_id');
              const itemRoutings = routings.filter(r => r.item_id === selectedItemId);
              if (!selectedItemId || itemRoutings.length === 0) return null;
              return (
                <Form.Item name="routing_id" label="Routing">
                  <Select
                    placeholder="Select routing"
                    allowClear
                    options={itemRoutings.map((r) => ({
                      value: r.id,
                      label: `${r.code} — ${r.name}`,
                    }))}
                    optionRender={(option) => {
                      const rt = itemRoutings.find(r => r.id === option.value);
                      return (
                        <Space>
                          <span>{option.label}</span>
                          {rt && <Tag color={rt.status === 'active' ? 'green' : 'default'} style={{ fontSize: 10 }}>{rt.status}</Tag>}
                        </Space>
                      );
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
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
            <Col xs={24} sm={12}>
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
            <Col xs={24} sm={12}>
              <Form.Item name="planned_start" label="Planned Start">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
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

      {/* ── Sub-Assembly WO Drawer ─────────────────────────────────────────── */}
      <Drawer
        title={<><ApartmentOutlined /> Add Sub-Assembly WO — {subParent?.wo_no}</>}
        open={subDrawer}
        onClose={() => setSubDrawer(false)}
        width={520}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setSubDrawer(false)}>Cancel</Button>
            <Button type="primary" loading={subSaving} onClick={handleSaveSubWo}>Create</Button>
          </div>
        }
      >
        <Form form={subForm} layout="vertical">
          <Form.Item name="item_id" label="Component Item" rules={[{ required: true, message: 'Select an item' }]}>
            <Select
              showSearch
              placeholder="Search component item"
              optionFilterProp="label"
              options={items.map(i => ({ value: i.id, label: `${i.name}${i.code ? ` (${i.code})` : ''}` }))}
              allowClear
            />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="planned_qty" label="Planned Quantity" rules={[{ required: true, message: 'Enter quantity' }]}>
                <InputNumber min={0} precision={3} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="priority" label="Priority">
                <Select options={PRIORITY_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="machine_id" label="Machine (optional)">
            <Select
              showSearch
              placeholder="Select machine"
              optionFilterProp="label"
              options={machines.map(m => ({ value: m.id, label: m.name }))}
              allowClear
            />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="planned_start" label="Planned Start">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="planned_end" label="Planned End">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* QR Label Modal */}
      <QrLabelPrint
        open={!!qrRecord}
        onClose={() => setQrRecord(null)}
        type="WO"
        identifier={qrRecord?.wo_no || ''}
        title="Work Order"
        subtitle={qrRecord?.Item?.name || ''}
      />

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Work Orders"
        entityName="Work Order"
        sampleHeaders={WO_CSV_HEADERS}
        sampleRows={WO_CSV_SAMPLE}
        validationRules={WO_CSV_VALIDATION}
      />
    </AppLayout>
  );
}
