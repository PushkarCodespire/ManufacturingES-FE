import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, message, Tooltip,
  Popconfirm, Row, Col, Tabs, Empty,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  CheckCircleOutlined, BulbOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout            from '../../../components/AppLayout';
import ResponsiveTable      from '../../../components/ResponsiveTable';
import usePermissions       from '../../../hooks/usePermissions';
import useAiSuggestion      from '../../../hooks/useAiSuggestion';
import AiSuggestionCard     from '../../../components/AiSuggestion/AiSuggestionCard';
import aiApi                from '../../../api/ai.api';
import { scheduleApi, workOrderApi } from '../../../api/production.api';
import { itemApi }     from '../../../api/item.api';
import { machineApi }  from '../../../api/machine.api';
import { shiftApi }    from '../../../api/shift.api';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  draft:     { color: 'default', label: 'Draft'     },
  published: { color: 'green',   label: 'Published' },
  completed: { color: 'cyan',    label: 'Completed' },
};

// ── Schedule Board (daily machine grid view) ──────────────────────────────────
function ScheduleBoard({ schedules, ganttDays }) {
  const machineRows = useMemo(() => {
    const map = {};
    schedules.forEach((s) => {
      const key  = s.machine_id || '__none__';
      const name = s.Machine?.name || 'No Machine';
      if (!map[key]) map[key] = { name, slots: {} };
      const date = s.schedule_date ? dayjs(s.schedule_date).format('YYYY-MM-DD') : null;
      if (!date) return;
      if (!map[key].slots[date]) map[key].slots[date] = [];
      map[key].slots[date].push(s);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [schedules]);

  if (ganttDays.length === 0) return (
    <Empty description="Select a date range to view the schedule board" style={{ padding: '40px 0' }} />
  );
  if (machineRows.length === 0) return (
    <Empty description="No schedules found for this period" style={{ padding: '40px 0' }} />
  );

  const CELL_COLORS = {
    draft:     { bg: '#f3f4f6', border: '#d1d5db', text: '#374151', badge: 'default' },
    published: { bg: '#dcfce7', border: '#86efac', text: '#166534', badge: 'success' },
    completed: { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af', badge: 'processing' },
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{
              minWidth: 150, maxWidth: 150, textAlign: 'left',
              padding: '8px 12px', background: '#f9fafb',
              borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb',
              position: 'sticky', left: 0, zIndex: 2,
            }}>
              Machine
            </th>
            {ganttDays.map((d) => {
              const isToday = d === dayjs().format('YYYY-MM-DD');
              return (
                <th key={d} style={{
                  minWidth: 130, textAlign: 'center',
                  padding: '6px 4px', background: isToday ? '#eff6ff' : '#f9fafb',
                  borderBottom: '2px solid #e5e7eb',
                  borderLeft: isToday ? '2px solid #3b82f6' : '1px solid #f3f4f6',
                  fontWeight: 600,
                }}>
                  <div style={{ fontSize: 11, color: isToday ? '#1d4ed8' : '#374151' }}>
                    {dayjs(d).format('ddd').toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, color: isToday ? '#1d4ed8' : '#6b7280', fontWeight: isToday ? 700 : 400 }}>
                    {dayjs(d).format('DD MMM')}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {machineRows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{
                padding: '8px 12px', fontWeight: 600, fontSize: 12, color: '#374151',
                borderRight: '1px solid #e5e7eb',
                position: 'sticky', left: 0, background: '#fff', zIndex: 1,
                verticalAlign: 'middle',
              }}>
                {row.name}
              </td>
              {ganttDays.map((d) => {
                const isToday = d === dayjs().format('YYYY-MM-DD');
                const slots   = row.slots[d] || [];
                return (
                  <td key={d} style={{
                    padding: 4, verticalAlign: 'top',
                    borderLeft: isToday ? '2px solid #bfdbfe' : '1px solid #f3f4f6',
                    background: isToday ? '#f0f9ff' : undefined,
                    minWidth: 130,
                  }}>
                    {slots.length === 0 ? null : slots.map((s) => {
                      const col = CELL_COLORS[s.status] || CELL_COLORS.draft;
                      return (
                        <Tooltip
                          key={s.id}
                          title={
                            <div style={{ fontSize: 12 }}>
                              <div><strong>{s.schedule_no}</strong></div>
                              <div>Item: {s.Item?.name || '—'}</div>
                              <div>WO: {s.WorkOrder?.wo_no || '—'}</div>
                              <div>Qty: {s.planned_qty ? parseFloat(s.planned_qty).toLocaleString() : '—'}</div>
                              <div>Shift: {s.Shift?.name || '—'}</div>
                              <div>Status: {s.status}</div>
                            </div>
                          }
                        >
                          <div style={{
                            background: col.bg, border: `1px solid ${col.border}`,
                            borderRadius: 6, padding: '4px 6px', marginBottom: 3, cursor: 'default',
                          }}>
                            <div style={{ fontWeight: 700, color: col.text, fontSize: 11 }}>{s.schedule_no}</div>
                            <div style={{ color: '#374151', fontSize: 11, marginTop: 1 }}>
                              {s.Item?.name ? (s.Item.name.length > 18 ? s.Item.name.slice(0, 18) + '…' : s.Item.name) : '—'}
                            </div>
                            {s.planned_qty && (
                              <div style={{ color: '#6b7280', fontSize: 10 }}>
                                {parseFloat(s.planned_qty).toLocaleString()} pcs
                              </div>
                            )}
                          </div>
                        </Tooltip>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SchedulingPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-mrp_expected_production-create_plan-create_edit_delete');

  const [schedules,    setSchedules]    = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [items,        setItems]        = useState([]);
  const [machines,     setMachines]     = useState([]);
  const [shifts,       setShifts]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [dateFrom,     setDateFrom]     = useState(null);
  const [dateTo,       setDateTo]       = useState(null);
  const [machineFilter,setMachineFilter]= useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);

  const [form] = Form.useForm();

  // ── AI suggestions ────────────────────────────────────────────────────────
  const shortage   = useAiSuggestion(aiApi.getShortagePrediction);
  const bottleneck = useAiSuggestion(aiApi.getBottleneckDetection);
  const [showShortage, setShowShortage]     = useState(false);
  const [showBottleneck, setShowBottleneck] = useState(false);

  const [viewMode, setViewMode] = useState('table');

  // ── Gantt date columns (current date range, capped at 14 days) ────────────
  const ganttDays = useMemo(() => {
    const start = (dateFrom || dayjs()).startOf('day');
    const end   = (dateTo   || dayjs().add(6, 'day')).startOf('day');
    const days  = [];
    let curr = start;
    while (!curr.isAfter(end) && days.length < 14) {
      days.push(curr.format('YYYY-MM-DD'));
      curr = curr.add(1, 'day');
    }
    return days;
  }, [dateFrom, dateTo]);

  // ── Load schedules ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (dateFrom)      p.date_from  = dateFrom.format('YYYY-MM-DD');
      if (dateTo)        p.date_to    = dateTo.format('YYYY-MM-DD');
      if (machineFilter) p.machine_id = machineFilter;
      if (statusFilter)  p.status     = statusFilter;
      const data = await scheduleApi.getAll(p);
      setSchedules(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load production schedules'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, machineFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      workOrderApi.getAll({ limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      machineApi.getAll({ limit: 500 }).catch(() => []),
      shiftApi.getAll().catch(() => []),
    ]).then(([wo, i, m, s]) => {
      setWorkOrders(Array.isArray(wo) ? wo : (wo?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setMachines(Array.isArray(m) ? m : (m?.data ?? []));
      setShifts(Array.isArray(s) ? s : (s?.data ?? []));
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total        = schedules.length;
  const countDraft   = schedules.filter((r) => r.status === 'draft').length;
  const countPublished = schedules.filter((r) => r.status === 'published').length;

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ schedule_date: dayjs() });
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      schedule_date:  record.schedule_date ? dayjs(record.schedule_date) : null,
      machine_id:     record.machine_id,
      shift_id:       record.shift_id,
      item_id:        record.item_id,
      planned_qty:    parseFloat(record.planned_qty) || null,
      work_order_id:  record.work_order_id,
      notes:          record.notes,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        schedule_date: vals.schedule_date?.format('YYYY-MM-DD'),
        machine_id:    vals.machine_id    || null,
        shift_id:      vals.shift_id      || null,
        item_id:       vals.item_id,
        planned_qty:   vals.planned_qty,
        work_order_id: vals.work_order_id || null,
        notes:         vals.notes         || '',
      };
      if (editing) {
        await scheduleApi.update(editing.id, payload);
        message.success('Schedule updated');
      } else {
        await scheduleApi.create(payload);
        message.success('Schedule created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onPublish = async (id) => {
    try {
      await scheduleApi.publish(id);
      message.success('Schedule published');
      load();
    } catch (err) { message.error(err?.message || 'Publish failed'); }
  };

  const onDelete = async (id) => {
    try {
      await scheduleApi.delete(id);
      message.success('Schedule deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Schedule No', dataIndex: 'schedule_no', key: 'schedule_no', width: 150,
      render: (no, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 600, cursor: canWrite ? 'pointer' : 'default' }}
          onClick={() => canWrite && r.status === 'draft' && openEdit(r)}
        >
          {no}
        </Text>
      ),
    },
    {
      title: 'Date', dataIndex: 'schedule_date', key: 'schedule_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Machine', key: 'machine', width: 130,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Machine?.name || '—'}</Text>,
    },
    {
      title: 'Shift', key: 'shift', width: 110,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Shift?.name || '—'}</Text>,
    },
    {
      title: 'Item', key: 'item', width: 180,
      render: (_, r) => r.Item ? (
        <Text style={{ fontSize: 13 }}>{r.Item.name}</Text>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Planned Qty', dataIndex: 'planned_qty', key: 'planned_qty', width: 110, align: 'right',
      render: (v) => v != null ? parseFloat(v).toLocaleString() : '—',
    },
    {
      title: 'Work Order', key: 'work_order', width: 130,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.WorkOrder?.wo_no || '—'}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Created By', key: 'creator', width: 120,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Creator?.name || '—'}</Text>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 140,
      render: (_, r) => {
        const isDraft = r.status === 'draft';
        return (
          <Space size={4}>
            {isDraft && (
              <Tooltip title="Publish">
                <Popconfirm
                  title="Publish this schedule?"
                  onConfirm={() => onPublish(r.id)}
                  okText="Publish"
                  okType="primary"
                >
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<CheckCircleOutlined />}
                  />
                </Popconfirm>
              </Tooltip>
            )}
            {isDraft && (
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
            )}
            {isDraft && (
              <Popconfirm
                title="Delete this schedule?"
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
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Scheduling</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Production Scheduling</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Plan daily machine allocations and link to work orders.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="default">Draft: {countDraft}</Tag>
        <Tag color="green">Published: {countPublished}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <DatePicker
            placeholder="From date"
            value={dateFrom}
            onChange={setDateFrom}
            format="DD MMM YYYY"
            style={{ width: 140 }}
          />
          <DatePicker
            placeholder="To date"
            value={dateTo}
            onChange={setDateTo}
            format="DD MMM YYYY"
            style={{ width: 140 }}
          />
          <Select
            placeholder="Filter by machine"
            allowClear
            value={machineFilter}
            onChange={setMachineFilter}
            showSearch
            optionFilterProp="label"
            options={machines.map((m) => ({ value: m.id, label: m.name }))}
            style={{ width: 180 }}
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
          <Tooltip title="AI: Predict material shortages">
            <Button
              icon={<BulbOutlined />}
              onClick={() => { setShowShortage(true); shortage.fetch(); }}
              loading={shortage.loading}
            >
              Shortage
            </Button>
          </Tooltip>
          <Tooltip title="AI: Detect production bottlenecks">
            <Button
              icon={<BulbOutlined />}
              onClick={() => { setShowBottleneck(true); bottleneck.fetch(); }}
              loading={bottleneck.loading}
            >
              Bottleneck
            </Button>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              New Schedule
            </Button>
          )}
        </div>

        <Tabs
          activeKey={viewMode}
          onChange={setViewMode}
          size="small"
          style={{ marginTop: 4 }}
          items={[
            {
              key: 'table',
              label: 'Table View',
              children: (
                <ResponsiveTable
                  rowKey="id"
                  loading={loading}
                  columns={columns}
                  dataSource={schedules}
                  size="small"
                  scroll={{ x: 1300 }}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
                />
              ),
            },
            {
              key: 'board',
              label: 'Schedule Board',
              children: <ScheduleBoard schedules={schedules} ganttDays={ganttDays} />,
            },
          ]}
        />
      </Card>

      {/* ── AI Shortage Prediction Panel ──────────────────────────────────── */}
      {showShortage && (
        <AiSuggestionCard
          title="Material Shortage Prediction"
          loading={shortage.loading}
          error={shortage.error}
          aiAvailable={shortage.aiAvailable}
          cached={shortage.cached}
          onDismiss={() => { setShowShortage(false); shortage.reset(); }}
          onRetry={() => shortage.fetch()}
          style={{ marginTop: 16 }}
        >
          {shortage.data?.suggestion && (
            <div style={{ fontSize: 13 }}>
              {shortage.data.suggestion.summary_hinglish && (
                <div style={{ whiteSpace: 'pre-line', marginBottom: 10, color: '#374151' }}>
                  {shortage.data.suggestion.summary_hinglish}
                </div>
              )}
              {shortage.data.suggestion.at_risk_items?.length > 0 && (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="item_code"
                  dataSource={shortage.data.suggestion.at_risk_items}
                  columns={[
                    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 180, ellipsis: true },
                    { title: 'Code', dataIndex: 'item_code', key: 'item_code', width: 100 },
                    { title: 'Stock', dataIndex: 'current_stock', key: 'current_stock', width: 80, align: 'right' },
                    { title: 'Required', dataIndex: 'required_qty', key: 'required_qty', width: 80, align: 'right' },
                    { title: 'Deficit', dataIndex: 'deficit', key: 'deficit', width: 80, align: 'right',
                      render: (v) => <Text type="danger">{v}</Text> },
                    { title: 'Urgency', dataIndex: 'urgency', key: 'urgency', width: 90,
                      render: (u) => <Tag color={u === 'critical' ? 'red' : u === 'warning' ? 'orange' : 'blue'}>{u}</Tag> },
                  ]}
                />
              )}
              {shortage.data.suggestion.at_risk_items?.length === 0 && (
                <Text type="success">No material shortages predicted — supply looks healthy.</Text>
              )}
            </div>
          )}
        </AiSuggestionCard>
      )}

      {/* ── AI Bottleneck Detection Panel ────────────────────────────────── */}
      {showBottleneck && (
        <AiSuggestionCard
          title="Production Bottleneck Detection"
          loading={bottleneck.loading}
          error={bottleneck.error}
          aiAvailable={bottleneck.aiAvailable}
          cached={bottleneck.cached}
          onDismiss={() => { setShowBottleneck(false); bottleneck.reset(); }}
          onRetry={() => bottleneck.fetch()}
          style={{ marginTop: 16 }}
        >
          {bottleneck.data?.suggestion && (
            <div style={{ fontSize: 13 }}>
              {bottleneck.data.suggestion.summary_hinglish && (
                <div style={{ whiteSpace: 'pre-line', marginBottom: 10, color: '#374151' }}>
                  {bottleneck.data.suggestion.summary_hinglish}
                </div>
              )}
              {bottleneck.data.suggestion.bottlenecks?.length > 0 && (
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(r) => `${r.machine_id}-${r.date}`}
                  dataSource={bottleneck.data.suggestion.bottlenecks}
                  columns={[
                    { title: 'Machine', dataIndex: 'machine_name', key: 'machine_name', width: 150 },
                    { title: 'Date', dataIndex: 'date', key: 'date', width: 110,
                      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—' },
                    { title: 'Scheduled', dataIndex: 'scheduled_hours', key: 'scheduled_hours', width: 90, align: 'right',
                      render: (v) => `${v}h` },
                    { title: 'Available', dataIndex: 'available_hours', key: 'available_hours', width: 90, align: 'right',
                      render: (v) => `${v}h` },
                    { title: 'Overload', dataIndex: 'overload_pct', key: 'overload_pct', width: 90, align: 'right',
                      render: (v) => <Text type="danger">{v}%</Text> },
                    { title: 'Severity', dataIndex: 'severity', key: 'severity', width: 90,
                      render: (s) => <Tag color={s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'blue'}>{s}</Tag> },
                  ]}
                />
              )}
              {bottleneck.data.suggestion.bottlenecks?.length === 0 && (
                <Text type="success">No bottlenecks detected — machine capacity looks balanced.</Text>
              )}
            </div>
          )}
        </AiSuggestionCard>
      )}

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit Schedule — ${editing.schedule_no}` : 'New Production Schedule'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update' : 'Create Schedule'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="schedule_date"
            label="Schedule Date"
            rules={[{ required: true, message: 'Select a date' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
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
            <Col xs={24} sm={16}>
              <Form.Item
                name="item_id"
                label="Item"
                rules={[{ required: true, message: 'Select an item' }]}
              >
                <Select
                  showSearch
                  placeholder="Select item"
                  optionFilterProp="label"
                  options={items.map((i) => ({
                    value: i.id,
                    label: `${i.name}${i.code ? ` (${i.code})` : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="planned_qty"
                label="Planned Qty"
                rules={[{ required: true, message: 'Enter qty' }]}
              >
                <InputNumber min={1} precision={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="work_order_id" label="Work Order (optional)">
            <Select
              showSearch
              placeholder="Link to work order"
              optionFilterProp="label"
              options={workOrders.map((wo) => ({ value: wo.id, label: wo.wo_no }))}
              allowClear
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Notes…" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
