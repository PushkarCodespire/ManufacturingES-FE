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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout              from '../../../components/AppLayout';
import usePermissions         from '../../../hooks/usePermissions';
import { stockAdjustmentApi } from '../../../api/store.api';
import { itemApi }            from '../../../api/item.api';
import { warehouseApi }       from '../../../api/warehouse.api';

const { Title, Text } = Typography;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { color: 'orange',  label: 'Pending'   },
  approved:  { color: 'green',   label: 'Approved'  },
  cancelled: { color: 'default', label: 'Cancelled' },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

const ADJ_TYPE_OPTIONS = [
  { value: 'count',      label: 'Physical Count'  },
  { value: 'damage',     label: 'Damage / Loss'   },
  { value: 'expiry',     label: 'Expiry / Scrap'  },
  { value: 'correction', label: 'Data Correction' },
];

// ── Empty line item ───────────────────────────────────────────────────────────
const emptyItem = () => ({
  _key:        Date.now() + Math.random(),
  item_id:     null,
  description: '',
  qty_book:    0,
  qty_actual:  0,
  qty_diff:    0,
});

// ── Compute diff ──────────────────────────────────────────────────────────────
const computeDiff = (row) => ({
  ...row,
  qty_diff: (parseFloat(row.qty_actual) || 0) - (parseFloat(row.qty_book) || 0),
});

export default function StockAdjustmentPage() {
  const { can } = usePermissions();
  const canWrite = can('store-inventory-stock_adjustment-create_edit_delete');

  const [adjustments,  setAdjustments]  = useState([]);
  const [warehouses,   setWarehouses]   = useState([]);
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [lineItems,  setLineItems]  = useState([emptyItem()]);

  const [form] = Form.useForm();

  // ── Load adjustments ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await stockAdjustmentApi.getAll(params);
      setAdjustments(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load stock adjustments'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      warehouseApi.getAll({ limit: 100 }).catch(() => []),
    ]).then(([i, w]) => {
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setWarehouses(Array.isArray(w) ? w : (w?.data ?? []));
    });
  }, []);

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ adj_date: dayjs(), adj_type: 'count' });
    setLineItems([emptyItem()]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      warehouse_id: record.warehouse_id,
      adj_date:     dayjs(record.adj_date),
      adj_type:     record.adj_type || 'count',
      notes:        record.notes,
      status:       record.status,
    });
    setLineItems((record.Items || []).map((it) => {
      const row = {
        _key:        it.id,
        item_id:     it.item_id,
        description: it.description || '',
        qty_book:    parseFloat(it.qty_book)   || 0,
        qty_actual:  parseFloat(it.qty_actual) || 0,
        qty_diff:    0,
      };
      return computeDiff(row);
    }));
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        warehouse_id: vals.warehouse_id,
        adj_date:     vals.adj_date.format('YYYY-MM-DD'),
        adj_type:     vals.adj_type || 'count',
        notes:        vals.notes    || '',
        ...(editing && { status: vals.status }),
        items: lineItems.map(({ _key, ...it }) => ({
          ...it,
          qty_diff: (parseFloat(it.qty_actual) || 0) - (parseFloat(it.qty_book) || 0),
        })),
      };
      if (editing) {
        await stockAdjustmentApi.update(editing.id, payload);
        message.success('Stock adjustment updated');
      } else {
        await stockAdjustmentApi.create(payload);
        message.success('Stock adjustment created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onApprove = async (id) => {
    try {
      await stockAdjustmentApi.approve(id);
      message.success('Stock adjustment approved — inventory updated');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Approval failed'); }
  };

  const onDelete = async (id) => {
    try {
      await stockAdjustmentApi.delete(id);
      message.success('Stock adjustment deleted');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Delete failed'); }
  };

  // ── Line item helpers ──────────────────────────────────────────────────────
  const addLine    = () => setLineItems((p) => [...p, emptyItem()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));

  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => {
      if (r._key !== key) return r;
      const updated = { ...r, [field]: value };
      return computeDiff(updated);
    }));

  const onItemSelect = (key, itemId) => {
    const found = items.find((i) => i.id === itemId);
    setLineItems((p) => p.map((r) => {
      if (r._key !== key) return r;
      const updated = {
        ...r,
        item_id:     itemId,
        description: found ? (found.name || '') : r.description,
      };
      return computeDiff(updated);
    }));
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total    = adjustments.length;
  const pending  = adjustments.filter((r) => r.status === 'pending').length;
  const approved = adjustments.filter((r) => r.status === 'approved').length;

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Adj No', dataIndex: 'adj_no', key: 'adj_no', width: 150,
      render: (no, r) => (
        <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>
          {no}
        </Text>
      ),
    },
    {
      title: 'Date', dataIndex: 'adj_date', key: 'adj_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Warehouse', key: 'warehouse', width: 140,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Warehouse?.name || '—'}</Text>,
    },
    {
      title: 'Type', dataIndex: 'adj_type', key: 'adj_type', width: 130,
      render: (t) => {
        const opt = ADJ_TYPE_OPTIONS.find((o) => o.value === t);
        return <Text style={{ fontSize: 13 }}>{opt?.label || t || '—'}</Text>;
      },
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
      title: 'Created By', key: 'creator', width: 110,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Creator?.name || '—'}</Text>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 120,
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'pending' && (
            <Tooltip title="Approve">
              <Popconfirm
                title="Approve this adjustment? This will update inventory."
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
            <Popconfirm title="Delete this adjustment?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
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
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Stock Adjustment</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Stock Adjustment</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Reconcile physical inventory counts with system records.
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
            placeholder="Search adj no…"
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
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Adjustment</Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={adjustments}
          size="small"
          scroll={{ x: 1050 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit Adjustment — ${editing.adj_no}` : 'New Stock Adjustment'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update Adjustment' : 'Create Adjustment'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Warehouse" rules={[{ required: true, message: 'Select a warehouse' }]}>
                <Select
                  showSearch
                  placeholder="Select warehouse"
                  optionFilterProp="label"
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="adj_date" label="Adjustment Date" rules={[{ required: true, message: 'Select a date' }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="adj_type" label="Adjustment Type">
            <Select options={ADJ_TYPE_OPTIONS} />
          </Form.Item>

          {editing && (
            <Form.Item name="status" label="Status">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          )}

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Reason for adjustment…" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Items
          </Divider>

          {/* Header — drawer 760px - 48px padding = 712px content */}
          {/* Grid: 160px 1fr 80px 80px 80px 28px */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px 80px 80px 28px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Description', 'Book Qty', 'Actual Qty', 'Difference', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => {
            const diff      = row.qty_diff || 0;
            const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#6b7280';

            return (
              <div
                key={row._key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr 80px 80px 80px 28px',
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
                  value={row.qty_book}
                  onChange={(v) => updateLine(row._key, 'qty_book', v)}
                  style={{ width: '100%' }}
                />
                <InputNumber
                  size="small"
                  min={0}
                  precision={3}
                  value={row.qty_actual}
                  onChange={(v) => updateLine(row._key, 'qty_actual', v)}
                  style={{ width: '100%' }}
                />
                {/* Computed difference — display only */}
                <div style={{ textAlign: 'right', padding: '0 4px' }}>
                  <Text style={{ fontWeight: 700, color: diffColor, fontSize: 13 }}>
                    {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                  </Text>
                </div>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<MinusCircleOutlined />}
                  onClick={() => removeLine(row._key)}
                  disabled={lineItems.length === 1}
                />
              </div>
            );
          })}

          <Button
            type="dashed"
            onClick={addLine}
            icon={<PlusCircleOutlined />}
            style={{ width: '100%', marginTop: 4 }}
          >
            Add Item
          </Button>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
