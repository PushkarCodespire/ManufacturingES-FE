import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Card, Button, Table, Tag, Space, Drawer, Select,
  DatePicker, Statistic, Row, Col, message, Tabs, Tooltip,
  Popconfirm, Form, InputNumber, Modal, Alert,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, CalculatorOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined, BarChartOutlined,
  FileTextOutlined, SettingOutlined, CheckCircleOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { jobCostApi, workOrderApi } from '../../../api/production.api';
import { machineApi } from '../../../api/machine.api';
import { exportToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const fmtInr = (v) =>
  v != null ? `₹${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';

const fmtInrDec = (v) =>
  v != null
    ? `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

const LABOR_TYPES = ['direct', 'indirect', 'setup', 'rework', 'overtime'];

const OVERHEAD_RATE_TYPES = [
  { value: 'pct_of_labor',    label: '% of Labor Cost'     },
  { value: 'pct_of_material', label: '% of Material Cost'  },
  { value: 'flat_per_job',    label: 'Flat Amount per Job'  },
];

function VarianceBadge({ pct }) {
  if (pct == null || isNaN(parseFloat(pct))) return <Text type="secondary">—</Text>;
  const p = parseFloat(pct);
  if (Math.abs(p) < 5) return <Tag color="green">On Track ({p.toFixed(1)}%)</Tag>;
  if (p > 0)           return <Tag color="red">Over +{p.toFixed(1)}%</Tag>;
  return                      <Tag color="blue">Under {p.toFixed(1)}%</Tag>;
}

// ── Cost Detail Drawer ───────────────────────────────────────────────────────
function CostDetailDrawer({ record, open, onClose }) {
  if (!record) return null;
  const wo    = record.WorkOrder;
  const total = parseFloat(record.total_actual_cost || 0);

  const barData = [
    { name: 'Material', value: parseFloat(record.material_cost || 0), color: '#3b82f6' },
    { name: 'Labor',    value: parseFloat(record.labor_cost    || 0), color: '#10b981' },
    { name: 'Machine',  value: parseFloat(record.machine_cost  || 0), color: '#8b5cf6' },
    { name: 'Overhead', value: parseFloat(record.overhead_cost || 0), color: '#f59e0b' },
    { name: 'Scrap',    value: parseFloat(record.scrap_cost    || 0), color: '#ef4444' },
  ].filter((d) => d.value > 0);

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileTextOutlined style={{ color: '#1d4ed8' }} />
          <span>Cost Sheet — {wo?.wo_no || '—'}</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={620}
    >
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Actual Cost', value: fmtInr(record.total_actual_cost), color: '#1d4ed8' },
          { label: 'Standard Cost',     value: fmtInr(record.standard_cost),     color: '#6b7280' },
          { label: 'Cost per Unit',     value: fmtInrDec(record.cost_per_unit),  color: '#059669' },
          { label: 'Qty Produced',      value: parseFloat(record.qty_produced || 0).toLocaleString(), color: '#374151' },
        ].map((s) => (
          <Col xs={12} key={s.label}>
            <Card size="small" style={{ border: '1px solid #e5e7eb', borderRadius: 8 }} bodyStyle={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 13 }}>Variance vs Standard</Text>
          <VarianceBadge pct={record.variance_pct} />
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
          {fmtInr(record.variance_amount)} {parseFloat(record.variance_amount || 0) > 0 ? 'over' : 'under'} standard cost
        </div>
      </div>

      {barData.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>Cost Breakdown</Text>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} layout="vertical">
              <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} style={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={70} style={{ fontSize: 11 }} />
              <RTooltip formatter={(v) => fmtInr(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {barData.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {barData.map((d) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                <span>{d.name}: <strong>{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(record.material_lines) && record.material_lines.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#3b82f6' }}>Material (BOM-based)</Text>
          <Table size="small" pagination={false} rowKey="item_code"
            dataSource={record.material_lines}
            columns={[
              { title: 'Component', dataIndex: 'item_name', key: 'name', ellipsis: true },
              { title: 'Qty',       dataIndex: 'total_qty', key: 'qty',  align: 'right', width: 80, render: (v) => parseFloat(v || 0).toFixed(2) },
              { title: 'Unit Cost', dataIndex: 'unit_cost', key: 'uc',   align: 'right', width: 90, render: fmtInrDec },
              { title: 'Total',     dataIndex: 'total_cost',key: 'tot',  align: 'right', width: 90, render: fmtInr },
            ]}
          />
        </div>
      )}

      {Array.isArray(record.labor_lines) && record.labor_lines.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#10b981' }}>Labor</Text>
          <Table size="small" pagination={false} rowKey={(_, i) => i}
            dataSource={record.labor_lines}
            columns={[
              { title: 'Job No', dataIndex: 'job_no',       key: 'jn',   width: 100 },
              { title: 'Type',   dataIndex: 'labor_type',   key: 'type', width: 80, render: (v) => <Tag>{v}</Tag> },
              { title: 'Hrs',    dataIndex: 'duration_min', key: 'hrs',  align: 'right', width: 60, render: (v) => (v / 60).toFixed(2) },
              { title: 'Rate',   dataIndex: 'rate_per_hour',key: 'rate', align: 'right', width: 80, render: fmtInrDec },
              { title: 'Total',  dataIndex: 'cost',         key: 'tot',  align: 'right', width: 80, render: fmtInr },
            ]}
          />
        </div>
      )}

      {Array.isArray(record.machine_lines) && record.machine_lines.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#8b5cf6' }}>Machine</Text>
          <Table size="small" pagination={false} rowKey={(_, i) => i}
            dataSource={record.machine_lines}
            columns={[
              { title: 'Machine', dataIndex: 'machine',      key: 'mac',  ellipsis: true },
              { title: 'Hrs',     dataIndex: 'machine_hours',key: 'hrs',  align: 'right', width: 60, render: (v) => parseFloat(v || 0).toFixed(2) },
              { title: 'Rate',    dataIndex: 'rate_per_hour',key: 'rate', align: 'right', width: 80, render: fmtInrDec },
              { title: 'Total',   dataIndex: 'cost',         key: 'tot',  align: 'right', width: 80, render: fmtInr },
            ]}
          />
        </div>
      )}

      {Array.isArray(record.overhead_lines) && record.overhead_lines.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#f59e0b' }}>Overhead</Text>
          <Table size="small" pagination={false} rowKey="name"
            dataSource={record.overhead_lines}
            columns={[
              { title: 'Name',  dataIndex: 'name',       key: 'name', ellipsis: true },
              { title: 'Type',  dataIndex: 'rate_type',  key: 'type', width: 140, render: (v) => OVERHEAD_RATE_TYPES.find((t) => t.value === v)?.label || v },
              { title: 'Rate',  dataIndex: 'rate_value', key: 'rate', align: 'right', width: 70, render: (v, r) => r.rate_type === 'flat_per_job' ? fmtInr(v) : `${v}%` },
              { title: 'Total', dataIndex: 'cost',       key: 'tot',  align: 'right', width: 80, render: fmtInr },
            ]}
          />
        </div>
      )}
    </Drawer>
  );
}

// ── Rate Cards Tab ───────────────────────────────────────────────────────────
function RateCardsTab({ canWrite }) {
  const [rateCards, setRateCards]   = useState({ laborRates: [], machineRates: [], overheadRates: [] });
  const [machines,  setMachines]    = useState([]);
  const [loading,   setLoading]     = useState(false);
  const [saving,    setSaving]      = useState(false);

  const [laborModal,    setLaborModal]    = useState(false);
  const [laborEditing,  setLaborEditing]  = useState(null);
  const [laborForm]                       = Form.useForm();

  const [machineModal,   setMachineModal]   = useState(false);
  const [machineEditing, setMachineEditing] = useState(null);
  const [machineForm]                       = Form.useForm();

  const [overheadModal,   setOverheadModal]   = useState(false);
  const [overheadEditing, setOverheadEditing] = useState(null);
  const [overheadForm]                        = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await jobCostApi.getRateCards();
      setRateCards(res?.data || { laborRates: [], machineRates: [], overheadRates: [] });
    } catch { message.error('Failed to load rate cards'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    machineApi.getAll({ limit: 500 })
      .then((r) => setMachines(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => {});
  }, [load]);

  const openLaborAdd  = () => { setLaborEditing(null); laborForm.resetFields(); laborForm.setFieldsValue({ effective_from: dayjs() }); setLaborModal(true); };
  const openLaborEdit = (r) => { setLaborEditing(r); laborForm.setFieldsValue({ ...r, effective_from: r.effective_from ? dayjs(r.effective_from) : dayjs() }); setLaborModal(true); };
  const onLaborSave = async () => {
    try {
      const v = await laborForm.validateFields();
      setSaving(true);
      await jobCostApi.upsertLaborRate({ ...v, id: laborEditing?.id, effective_from: v.effective_from?.format('YYYY-MM-DD') });
      message.success('Saved'); setLaborModal(false); load();
    } catch (e) { if (e?.errorFields) return; message.error('Save failed'); }
    finally { setSaving(false); }
  };

  const openMachineAdd  = () => { setMachineEditing(null); machineForm.resetFields(); machineForm.setFieldsValue({ effective_from: dayjs() }); setMachineModal(true); };
  const openMachineEdit = (r) => { setMachineEditing(r); machineForm.setFieldsValue({ ...r, effective_from: r.effective_from ? dayjs(r.effective_from) : dayjs() }); setMachineModal(true); };
  const onMachineSave = async () => {
    try {
      const v = await machineForm.validateFields();
      setSaving(true);
      await jobCostApi.upsertMachineRate({ ...v, id: machineEditing?.id, effective_from: v.effective_from?.format('YYYY-MM-DD') });
      message.success('Saved'); setMachineModal(false); load();
    } catch (e) { if (e?.errorFields) return; message.error('Save failed'); }
    finally { setSaving(false); }
  };

  const openOverheadAdd  = () => { setOverheadEditing(null); overheadForm.resetFields(); setOverheadModal(true); };
  const openOverheadEdit = (r) => { setOverheadEditing(r); overheadForm.setFieldsValue(r); setOverheadModal(true); };
  const onOverheadSave = async () => {
    try {
      const v = await overheadForm.validateFields();
      setSaving(true);
      await jobCostApi.upsertOverheadRate({ ...v, id: overheadEditing?.id });
      message.success('Saved'); setOverheadModal(false); load();
    } catch (e) { if (e?.errorFields) return; message.error('Save failed'); }
    finally { setSaving(false); }
  };

  const rateCardCols = (editFn, deleteFn) => [
    ...(canWrite ? [{
      title: '', key: 'act', width: 80, align: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Button size="small" icon={<EditOutlined />} onClick={() => editFn(r)} />
          <Popconfirm title="Delete?" onConfirm={() => deleteFn(r.id)} okType="danger" okText="Delete">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Labor Rates */}
      <Card size="small"
        title={<span style={{ color: '#10b981', fontWeight: 600 }}>Labor Rates (₹/hour)</span>}
        extra={canWrite && <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openLaborAdd}>Add</Button>}
        style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <Table size="small" loading={loading} rowKey="id" pagination={false}
          dataSource={rateCards.laborRates}
          columns={[
            { title: 'Labor Type',     dataIndex: 'labor_type',   key: 'type', render: (v) => <Tag color="green">{v}</Tag> },
            { title: 'Rate/hr',        dataIndex: 'rate_per_hour',key: 'rate', align: 'right', render: fmtInrDec },
            { title: 'Effective From', dataIndex: 'effective_from',key: 'from', render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—' },
            { title: 'Notes',          dataIndex: 'notes',        key: 'notes', ellipsis: true, render: (v) => v || '—' },
            ...rateCardCols(openLaborEdit, async (id) => { try { await jobCostApi.deleteLaborRate(id); message.success('Deleted'); load(); } catch { message.error('Failed'); } }),
          ]}
        />
      </Card>

      {/* Machine Rates */}
      <Card size="small"
        title={<span style={{ color: '#8b5cf6', fontWeight: 600 }}>Machine Rates (₹/hour)</span>}
        extra={canWrite && <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openMachineAdd}>Add</Button>}
        style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <Table size="small" loading={loading} rowKey="id" pagination={false}
          dataSource={rateCards.machineRates}
          columns={[
            { title: 'Machine',        key: 'mac', render: (_, r) => r.Machine?.name || `Machine #${r.machine_id}` },
            { title: 'Rate/hr',        dataIndex: 'rate_per_hour', key: 'rate', align: 'right', render: fmtInrDec },
            { title: 'Effective From', dataIndex: 'effective_from',key: 'from', render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—' },
            { title: 'Notes',          dataIndex: 'notes',         key: 'notes', ellipsis: true, render: (v) => v || '—' },
            ...rateCardCols(openMachineEdit, async (id) => { try { await jobCostApi.deleteMachineRate(id); message.success('Deleted'); load(); } catch { message.error('Failed'); } }),
          ]}
        />
      </Card>

      {/* Overhead Rates */}
      <Card size="small"
        title={<span style={{ color: '#f59e0b', fontWeight: 600 }}>Overhead Rates</span>}
        extra={canWrite && <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openOverheadAdd}>Add</Button>}
        style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <Table size="small" loading={loading} rowKey="id" pagination={false}
          dataSource={rateCards.overheadRates}
          columns={[
            { title: 'Name',   dataIndex: 'overhead_name', key: 'name' },
            { title: 'Type',   dataIndex: 'rate_type',     key: 'type', render: (v) => OVERHEAD_RATE_TYPES.find((t) => t.value === v)?.label || v },
            { title: 'Value',  key: 'val', align: 'right', render: (_, r) => r.rate_type === 'flat_per_job' ? fmtInr(r.rate_value) : `${r.rate_value}%` },
            { title: 'Active', dataIndex: 'is_active', key: 'active', align: 'center', width: 70, render: (v) => v ? <CheckCircleOutlined style={{ color: '#16a34a' }} /> : '—' },
            ...rateCardCols(openOverheadEdit, async (id) => { try { await jobCostApi.deleteOverheadRate(id); message.success('Deleted'); load(); } catch { message.error('Failed'); } }),
          ]}
        />
      </Card>

      {/* Modals */}
      <Modal title={laborEditing ? 'Edit Labor Rate' : 'Add Labor Rate'} open={laborModal}
        onCancel={() => setLaborModal(false)} onOk={onLaborSave} okText="Save" confirmLoading={saving} width={400}>
        <Form form={laborForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="labor_type"    label="Labor Type"       rules={[{ required: true }]}>
            <Select options={LABOR_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="rate_per_hour" label="Rate per Hour (₹)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
          </Form.Item>
          <Form.Item name="effective_from" label="Effective From"  rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <input style={{ width: '100%', border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 8px' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={machineEditing ? 'Edit Machine Rate' : 'Add Machine Rate'} open={machineModal}
        onCancel={() => setMachineModal(false)} onOk={onMachineSave} okText="Save" confirmLoading={saving} width={400}>
        <Form form={machineForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="machine_id"    label="Machine"           rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={machines.map((m) => ({ value: m.id, label: m.name }))} />
          </Form.Item>
          <Form.Item name="rate_per_hour" label="Rate per Hour (₹)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
          </Form.Item>
          <Form.Item name="effective_from" label="Effective From"   rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <input style={{ width: '100%', border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 8px' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={overheadEditing ? 'Edit Overhead Rate' : 'Add Overhead Rate'} open={overheadModal}
        onCancel={() => setOverheadModal(false)} onOk={onOverheadSave} okText="Save" confirmLoading={saving} width={420}>
        <Form form={overheadForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="overhead_name" label="Name"       rules={[{ required: true }]}>
            <input style={{ width: '100%', border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 8px' }} placeholder="e.g. Factory Overhead" />
          </Form.Item>
          <Form.Item name="rate_type"     label="Rate Type"  rules={[{ required: true }]}>
            <Select options={OVERHEAD_RATE_TYPES} />
          </Form.Item>
          <Form.Item name="rate_value"    label="Value (% or ₹)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Profitability Tab ────────────────────────────────────────────────────────
function ProfitabilityTab() {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo,   setDateTo]   = useState(null);
  const [groupBy,  setGroupBy]  = useState('by_customer');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom.format('YYYY-MM-DD');
      if (dateTo)   params.date_to   = dateTo.format('YYYY-MM-DD');
      const result = await jobCostApi.getProfitability(params);
      setData(result?.data ?? result);
    } catch { message.error('Failed to load profitability'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return (data[groupBy] || []).slice(0, 10).map((r) => ({
      name:    r.name.length > 16 ? r.name.slice(0, 16) + '…' : r.name,
      Revenue: parseFloat(r.revenue || 0),
      Cost:    parseFloat(r.cost    || 0),
    }));
  }, [data, groupBy]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <DatePicker placeholder="From" value={dateFrom} onChange={setDateFrom} format="DD MMM YYYY" style={{ width: 140 }} />
        <DatePicker placeholder="To"   value={dateTo}   onChange={setDateTo}   format="DD MMM YYYY" style={{ width: 140 }} />
        <Select value={groupBy} onChange={setGroupBy} style={{ width: 160 }}
          options={[{ value: 'by_customer', label: 'By Customer' }, { value: 'by_item', label: 'By Item' }]} />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {data && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            { label: 'Total Revenue', value: fmtInr(data.total_revenue),                                    color: '#1d4ed8', bg: '#eff6ff' },
            { label: 'Total Cost',    value: fmtInr(data.total_cost),                                       color: '#dc2626', bg: '#fef2f2' },
            { label: 'Gross Profit',  value: fmtInr(data.total_revenue - data.total_cost),                  color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Margin',        value: data.total_revenue > 0 ? `${(((data.total_revenue - data.total_cost) / data.total_revenue) * 100).toFixed(1)}%` : '—', color: '#7c3aed', bg: '#f5f3ff' },
          ].map((s) => (
            <Col xs={12} sm={6} key={s.label}>
              <Card size="small" style={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8 }} bodyStyle={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, opacity: 0.75 }}>{s.label}</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {chartData.length > 0 && (
        <Card style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>Revenue vs Cost — Top 10</Text>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 10, left: 10, bottom: 40 }}>
              <XAxis dataKey="name" angle={-30} textAnchor="end" style={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} style={{ fontSize: 11 }} />
              <RTooltip formatter={(v) => fmtInr(v)} />
              <Legend />
              <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Cost"    fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {data && (
        <Table size="small" rowKey="name" dataSource={data[groupBy] || []}
          pagination={{ pageSize: 15 }}
          columns={[
            { title: groupBy === 'by_customer' ? 'Customer' : 'Item', dataIndex: 'name',    key: 'name',    ellipsis: true },
            { title: 'Revenue', dataIndex: 'revenue', key: 'rev',    align: 'right', render: fmtInr },
            { title: 'Cost',    dataIndex: 'cost',    key: 'cost',   align: 'right', render: fmtInr },
            { title: 'Profit',  dataIndex: 'profit',  key: 'profit', align: 'right', render: (v) => <Text style={{ color: v >= 0 ? '#16a34a' : '#dc2626' }}>{fmtInr(v)}</Text> },
            { title: 'Margin',  dataIndex: 'margin',  key: 'margin', align: 'right', width: 90, render: (v) => v != null ? <Tag color={v >= 20 ? 'green' : v >= 0 ? 'orange' : 'red'}>{v.toFixed(1)}%</Tag> : '—' },
            { title: 'WOs',     dataIndex: 'count',   key: 'cnt',    align: 'right', width: 60 },
          ]}
        />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function JobCostSheetPage() {
  const { can }   = usePermissions();
  const canWrite  = can('prod-cost_intelligence-job_cost_sheet-create_edit_delete');

  const [sheets,       setSheets]       = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [calculating,  setCalculating]  = useState(null);
  const [dateFrom,     setDateFrom]     = useState(null);
  const [dateTo,       setDateTo]       = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [detailOpen,   setDetailOpen]   = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [calcModal,    setCalcModal]    = useState(false);
  const [calcWoId,     setCalcWoId]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom)     params.date_from = dateFrom.format('YYYY-MM-DD');
      if (dateTo)       params.date_to   = dateTo.format('YYYY-MM-DD');
      if (statusFilter) params.status    = statusFilter;
      const data = await jobCostApi.getAll(params);
      setSheets(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { message.error('Failed to load cost sheets'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    workOrderApi.getAll({ limit: 500 })
      .then((r) => setWorkOrders(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => {});
  }, []);

  const onCalculate = async () => {
    if (!calcWoId) { message.error('Select a work order'); return; }
    setCalculating(calcWoId);
    try {
      await jobCostApi.calculate({ work_order_id: calcWoId });
      message.success('Cost sheet calculated');
      setCalcModal(false); setCalcWoId(null); load();
    } catch (e) { message.error(e?.message || 'Calculation failed'); }
    finally { setCalculating(null); }
  };

  const totalCost   = sheets.reduce((s, r) => s + parseFloat(r.total_actual_cost || 0), 0);
  const totalScrap  = sheets.reduce((s, r) => s + parseFloat(r.scrap_cost || 0), 0);
  const avgVariance = sheets.length > 0
    ? sheets.reduce((s, r) => s + parseFloat(r.variance_pct || 0), 0) / sheets.length : 0;

  const columns = [
    {
      title: 'Work Order', key: 'wo', width: 120,
      render: (_, r) => <Text style={{ fontWeight: 600, color: '#1d4ed8', fontSize: 13 }}>{r.WorkOrder?.wo_no || '—'}</Text>,
    },
    {
      title: 'Item', key: 'item', width: 180, ellipsis: true,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{r.WorkOrder?.Item?.name || '—'}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.WorkOrder?.Item?.code}</div>
        </div>
      ),
    },
    { title: 'Material', dataIndex: 'material_cost', key: 'mat', align: 'right', width: 110, render: (v) => <Text style={{ fontSize: 12 }}>{fmtInr(v)}</Text> },
    { title: 'Labor',    dataIndex: 'labor_cost',    key: 'lab', align: 'right', width: 100, render: (v) => <Text style={{ fontSize: 12 }}>{fmtInr(v)}</Text> },
    { title: 'Machine',  dataIndex: 'machine_cost',  key: 'mac', align: 'right', width: 100, render: (v) => <Text style={{ fontSize: 12 }}>{fmtInr(v)}</Text> },
    { title: 'Overhead', dataIndex: 'overhead_cost', key: 'ovh', align: 'right', width: 100, render: (v) => <Text style={{ fontSize: 12 }}>{fmtInr(v)}</Text> },
    { title: 'Scrap',    dataIndex: 'scrap_cost',    key: 'scr', align: 'right', width: 90,
      render: (v) => <Text style={{ fontSize: 12, color: parseFloat(v || 0) > 0 ? '#dc2626' : undefined }}>{fmtInr(v)}</Text> },
    { title: 'Total Cost', dataIndex: 'total_actual_cost', key: 'total', align: 'right', width: 120,
      render: (v) => <Text style={{ fontWeight: 600, fontSize: 13 }}>{fmtInr(v)}</Text> },
    { title: 'Cost/Unit', dataIndex: 'cost_per_unit', key: 'cpu', align: 'right', width: 100,
      render: (v) => <Text style={{ fontSize: 12 }}>{fmtInrDec(v)}</Text> },
    { title: 'Variance', key: 'var', width: 150, render: (_, r) => <VarianceBadge pct={r.variance_pct} /> },
    { title: 'Calculated', dataIndex: 'calculated_at', key: 'calc', width: 130,
      render: (d) => d ? <Text style={{ fontSize: 11 }}>{dayjs(d).format('DD MMM YY HH:mm')}</Text> : '—' },
    {
      title: 'Actions', key: 'actions', width: 90, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View Detail">
            <Button size="small" icon={<FileTextOutlined />} onClick={() => { setDetailRecord(r); setDetailOpen(true); }} />
          </Tooltip>
          {canWrite && (
            <Tooltip title="Recalculate">
              <Button size="small" icon={<CalculatorOutlined />} loading={calculating === r.work_order_id}
                onClick={async () => {
                  setCalculating(r.work_order_id);
                  try { await jobCostApi.calculate({ work_order_id: r.work_order_id }); message.success('Recalculated'); load(); }
                  catch { message.error('Failed'); }
                  finally { setCalculating(null); }
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Job Cost Sheet</Text>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Job Cost Sheet</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Actual cost breakdown per work order — material, labor, machine, overhead and scrap.
          </Text>
        </div>
        {canWrite && (
          <Button type="primary" icon={<CalculatorOutlined />} onClick={() => setCalcModal(true)}>
            Calculate Cost Sheet
          </Button>
        )}
      </div>

      <Row gutter={[12, 12]} style={{ marginTop: 12, marginBottom: 16 }}>
        {[
          { label: 'Cost Sheets',  value: sheets.length,                       color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Total Cost',   value: fmtInr(totalCost),                   color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Total Scrap',  value: fmtInr(totalScrap),                  color: '#dc2626', bg: '#fef2f2' },
          { label: 'Avg Variance', value: `${avgVariance.toFixed(1)}%`,
            color: avgVariance > 5 ? '#dc2626' : avgVariance < -5 ? '#2563eb' : '#16a34a', bg: '#f9fafb' },
        ].map((s) => (
          <Col xs={12} sm={6} key={s.label}>
            <Card size="small" style={{ background: s.bg, border: `1px solid ${s.color}20`, borderRadius: 8 }} bodyStyle={{ padding: '10px 14px' }}>
              <Statistic value={s.value} valueStyle={{ fontSize: 18, fontWeight: 700, color: s.color }} />
              <div style={{ fontSize: 11, color: s.color, opacity: 0.75 }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        <Tabs size="small" items={[
          {
            key: 'sheets',
            label: <span><FileTextOutlined /> Cost Sheets</span>,
            children: (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                  <DatePicker placeholder="From" value={dateFrom} onChange={setDateFrom} format="DD MMM YYYY" style={{ width: 140 }} />
                  <DatePicker placeholder="To"   value={dateTo}   onChange={setDateTo}   format="DD MMM YYYY" style={{ width: 140 }} />
                  <Select placeholder="Status" allowClear value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }}
                    options={[{ value: 'draft', label: 'Draft' }, { value: 'final', label: 'Final' }]} />
                  <div style={{ flex: 1 }} />
                  <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
                </div>
                <Table rowKey="id" loading={loading} dataSource={sheets} columns={columns} size="small"
                  scroll={{ x: 1400 }}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
                />
              </>
            ),
          },
          {
            key: 'profitability',
            label: <span><BarChartOutlined /> Profitability</span>,
            children: <ProfitabilityTab />,
          },
          {
            key: 'rate-cards',
            label: <span><SettingOutlined /> Rate Cards</span>,
            children: <RateCardsTab canWrite={canWrite} />,
          },
        ]} />
      </Card>

      <CostDetailDrawer record={detailRecord} open={detailOpen} onClose={() => setDetailOpen(false)} />

      <Modal title={<span><CalculatorOutlined /> Calculate Cost Sheet</span>}
        open={calcModal} onCancel={() => { setCalcModal(false); setCalcWoId(null); }}
        onOk={onCalculate} okText="Calculate" confirmLoading={!!calculating} width={440}>
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="Select a work order to calculate its actual cost from BOM, labor logs, machine time, and scrap." />
        <Select showSearch placeholder="Select work order" optionFilterProp="label"
          style={{ width: '100%' }} value={calcWoId} onChange={setCalcWoId}
          options={workOrders.map((wo) => ({
            value: wo.id,
            label: `${wo.wo_no}${wo.Item ? ` — ${wo.Item.name}` : ''}`,
          }))}
        />
      </Modal>
    </AppLayout>
  );
}
