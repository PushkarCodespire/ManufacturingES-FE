import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  PlusCircleOutlined, MinusCircleOutlined, CheckCircleOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout             from '../../../components/AppLayout';
import ResponsiveTable       from '../../../components/ResponsiveTable';
import usePermissions        from '../../../hooks/usePermissions';
import { materialRequestApi } from '../../../api/store.api';
import { itemApi }           from '../../../api/item.api';
import { warehouseApi }      from '../../../api/warehouse.api';
import { workOrderApi }      from '../../../api/production.api';
import { bomApi }            from '../../../api/bom.api';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal        from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

// ── CSV Upload config ─────────────────────────────────────────────────────────
const MR_CSV_HEADERS = ['Warehouse', 'Required Date', 'Priority', 'Item Code', 'Description', 'Qty', 'Unit', 'Notes'];
const MR_CSV_SAMPLE = [
  { 'Warehouse': 'Main Store', 'Required Date': '2025-06-20', 'Priority': 'normal', 'Item Code': 'ITM-001', 'Description': 'Shaft Assembly', 'Qty': '50', 'Unit': 'pcs', 'Notes': '' },
];
const MR_CSV_VALIDATION = [
  { field: 'Warehouse', required: true },
  { field: 'Item Code', required: true },
  { field: 'Qty', required: true, validate: (v) => isNaN(parseFloat(v)) ? 'Qty must be a number' : null },
];

const { Title, Text } = Typography;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { color: 'orange', label: 'Pending'   },
  approved:  { color: 'green',  label: 'Approved'  },
  issued:    { color: 'blue',   label: 'Issued'    },
  cancelled: { color: 'default',label: 'Cancelled' },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low'    },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_COLORS = { low: 'default', normal: 'blue', urgent: 'red' };

// ── Empty line item ───────────────────────────────────────────────────────────
const emptyItem = () => ({
  _key:        Date.now() + Math.random(),
  item_id:     null,
  description: '',
  qty:         1,
  unit:        'pcs',
});

export default function MaterialRequestPage() {
  const { can } = usePermissions();
  const canWrite = can('store-requests-material_request-create_edit_delete');

  const [requests,     setRequests]     = useState([]);
  const [warehouses,   setWarehouses]   = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [lineItems,  setLineItems]  = useState([emptyItem()]);

  const [form] = Form.useForm();

  // ── Load requests ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await materialRequestApi.getAll(params);
      setRequests(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load material requests'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      warehouseApi.getAll({ limit: 100 }).catch(() => []),
      workOrderApi.getAll({ limit: 500 }).then(r => r?.data ?? r).catch(() => []),
    ]).then(([i, w, wo]) => {
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setWarehouses(Array.isArray(w) ? w : (w?.data ?? []));
      const woArr = Array.isArray(wo) ? wo : (wo?.data ?? []);
      setWorkOrders(woArr);
    });
  }, []);

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ required_date: dayjs(), priority: 'normal' });
    setLineItems([emptyItem()]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      warehouse_id:   record.warehouse_id,
      work_order_id:  record.work_order_id || undefined,
      required_date:  dayjs(record.required_date),
      priority:       record.priority || 'normal',
      notes:          record.notes,
      status:         record.status,
    });
    setLineItems((record.Items || []).map((it) => ({
      _key:        it.id,
      item_id:     it.item_id,
      description: it.description || '',
      qty:         parseFloat(it.qty_requested) || 1,
      unit:        it.unit || 'pcs',
    })));
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        warehouse_id:  vals.warehouse_id,
        required_date: vals.required_date.format('YYYY-MM-DD'),
        priority:      vals.priority || 'normal',
        work_order_id: vals.work_order_id || null,
        notes:         vals.notes    || '',
        ...(editing && { status: vals.status }),
        items: lineItems.map(({ _key, ...it }) => it),
      };
      if (editing) {
        await materialRequestApi.update(editing.id, payload);
        message.success('Material request updated');
      } else {
        await materialRequestApi.create(payload);
        message.success('Material request created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onApprove = async (id) => {
    try {
      await materialRequestApi.approve(id);
      message.success('Material request approved');
      load();
    } catch (err) { message.error(err?.message || 'Approval failed'); }
  };

  const onDelete = async (id) => {
    try {
      await materialRequestApi.delete(id);
      message.success('Material request deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── CSV Import handler ────────────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    // Group rows by Warehouse + Required Date + Priority to create one MR per group
    const groups = {};
    for (const row of rows) {
      const key = `${(row['Warehouse'] || '').trim()}||${(row['Required Date'] || '').trim()}||${(row['Priority'] || 'normal').trim()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    for (const [, groupRows] of Object.entries(groups)) {
      try {
        const first = groupRows[0];
        const whName = (first['Warehouse'] || '').trim();
        const wh = warehouses.find((w) => w.name?.toLowerCase() === whName.toLowerCase());
        if (!wh) throw new Error(`Warehouse "${whName}" not found`);
        const mrItems = groupRows.map((row) => {
          const itemCode = (row['Item Code'] || '').trim();
          const item = items.find((i) => i.code?.toLowerCase() === itemCode.toLowerCase() || i.name?.toLowerCase() === itemCode.toLowerCase());
          return {
            item_id:     item?.id || null,
            description: row['Description'] || item?.name || '',
            qty:         parseFloat(row['Qty']) || 1,
            unit:        row['Unit'] || 'pcs',
          };
        });
        await materialRequestApi.create({
          warehouse_id:  wh.id,
          required_date: first['Required Date'] || dayjs().format('YYYY-MM-DD'),
          priority:      first['Priority'] || 'normal',
          notes:         first['Notes'] || '',
          items:         mrItems,
        });
        success += groupRows.length;
      } catch (err) {
        failed += groupRows.length;
        errors.push(`MR "${groupRows[0]['Warehouse']}": ${err?.response?.data?.message || err.message}`);
      }
    }
    load();
    return { success, failed, errors };
  };

  // ── Line item helpers ──────────────────────────────────────────────────────
  const addLine    = () => setLineItems((p) => [...p, emptyItem()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));
  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  const onItemSelect = (key, itemId) => {
    const found = items.find((i) => i.id === itemId);
    if (found) {
      updateLine(key, 'description', found.name || '');
      updateLine(key, 'unit',        found.unit || 'pcs');
    }
    updateLine(key, 'item_id', itemId);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total    = requests.length;
  const pending  = requests.filter((r) => r.status === 'pending').length;
  const approved = requests.filter((r) => r.status === 'approved').length;

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'MR No', dataIndex: 'request_no', key: 'request_no', width: 150,
      render: (no, r) => (
        <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>
          {no}
        </Text>
      ),
    },
    {
      title: 'Required Date', dataIndex: 'required_date', key: 'required_date', width: 120,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Warehouse', key: 'warehouse', width: 150,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Warehouse?.name || '—'}</Text>,
    },
    {
      title: 'Priority', dataIndex: 'priority', key: 'priority', width: 90,
      render: (p) => <Tag color={PRIORITY_COLORS[p] || 'default'}>{p ? p.charAt(0).toUpperCase() + p.slice(1) : '—'}</Tag>,
    },
    {
      title: 'Items', key: 'items', width: 70, align: 'center',
      render: (_, r) => (
        <Badge count={r.Items?.length || 0} style={{ backgroundColor: '#e0e7ff', color: '#1d4ed8' }} />
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Requested By', key: 'creator', width: 120,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Creator?.name || '—'}</Text>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 120,
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'pending' && (
            <Tooltip title="Approve">
              <Popconfirm
                title="Approve this material request?"
                onConfirm={() => onApprove(r.id)}
                okText="Approve"
                okType="primary"
              >
                <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {r.status === 'pending' && (
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
            </Tooltip>
          )}
          {r.status === 'pending' && (
            <Popconfirm title="Delete this request?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Store</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Material Request</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Material Request</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Request materials from the store for production or other departments.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Pending: {pending}</Tag>
        <Tag color="green">Approved: {approved}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search MR no, notes…"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            style={{ width: 160 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('material-request.csv', requests, columns)}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)}>Upload CSV</Button>}
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Request</Button>
          )}
        </div>

        <ResponsiveTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={requests}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit Material Request — ${editing.request_no}` : 'New Material Request'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update Request' : 'Create Request'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item name="warehouse_id" label="Warehouse" rules={[{ required: true, message: 'Select a warehouse' }]}>
                <Select
                  showSearch
                  placeholder="Select warehouse"
                  optionFilterProp="label"
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="required_date" label="Required Date" rules={[{ required: true, message: 'Select a date' }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="priority" label="Priority">
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>

          <Form.Item name="work_order_id" label="Work Order (optional)">
            <Select
              showSearch
              placeholder="Link to a work order (auto-fills BOM items)"
              optionFilterProp="label"
              allowClear
              onChange={async (woId) => {
                if (!woId) return;
                try {
                  const woRes = await workOrderApi.getById(woId);
                  const woData = woRes?.data ?? woRes;
                  const itemId = woData.item_id;
                  const plannedQty = parseFloat(woData.planned_qty || 1);

                  if (itemId) {
                    const bomRes = await bomApi.getByItemId(itemId);
                    const bomData = bomRes?.data ?? bomRes;
                    const lines = bomData?.Lines || bomData?.lines || [];
                    if (lines.length > 0) {
                      setLineItems(lines.map((bl, idx) => ({
                        _key: Date.now() + idx,
                        item_id: bl.component_item_id,
                        description: bl.Item?.name || bl.ComponentItem?.name || '',
                        qty: parseFloat((parseFloat(bl.quantity) * plannedQty).toFixed(3)),
                        unit: bl.unit || bl.Item?.unit || bl.ComponentItem?.unit || 'pcs',
                      })));
                      message.success(`${lines.length} BOM component(s) loaded — quantities calculated for ${plannedQty} units`);
                    } else {
                      message.info('No BOM found for this item');
                    }
                  }
                } catch (e) {
                  console.warn('Failed to load BOM:', e);
                }
              }}
              options={workOrders.map((wo) => ({
                value: wo.id,
                label: `${wo.wo_number || wo.order_no || wo.id} — ${wo.Item?.name || ''}`,
              }))}
            />
          </Form.Item>

          {editing && (
            <Form.Item name="status" label="Status">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          )}

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Internal notes…" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Line Items
          </Divider>

          <div className="res-line-items">
          {/* Header — drawer 720px - 48px padding = 672px content */}
          {/* Grid: 160px 1fr 65px 50px 28px */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 65px 50px 28px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Description', 'Qty', 'Unit', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => (
            <div
              key={row._key}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr 65px 50px 28px',
                gap: 6,
                marginBottom: 8,
                alignItems: 'center',
              }}
            >
              <Select
                showSearch
                placeholder="Select item"
                optionFilterProp="label"
                size="small"
                value={row.item_id}
                onChange={(v) => onItemSelect(row._key, v)}
                allowClear
                options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.code || ''})` }))}
              />
              <Input
                size="small"
                placeholder="Description"
                value={row.description}
                onChange={(e) => updateLine(row._key, 'description', e.target.value)}
              />
              <InputNumber
                size="small"
                min={0}
                precision={3}
                value={row.qty}
                onChange={(v) => updateLine(row._key, 'qty', v)}
                style={{ width: '100%' }}
              />
              <Input
                size="small"
                placeholder="unit"
                value={row.unit}
                onChange={(e) => updateLine(row._key, 'unit', e.target.value)}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => removeLine(row._key)}
                disabled={lineItems.length === 1}
              />
            </div>
          ))}

          <Button
            type="dashed"
            onClick={addLine}
            icon={<PlusCircleOutlined />}
            style={{ width: '100%', marginTop: 4 }}
          >
            Add Item
          </Button>
          </div>
        </Form>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Material Requests"
        entityName="Material Request"
        sampleHeaders={MR_CSV_HEADERS}
        sampleRows={MR_CSV_SAMPLE}
        validationRules={MR_CSV_VALIDATION}
      />
    </AppLayout>
  );
}
