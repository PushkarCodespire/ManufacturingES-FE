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
import AppLayout          from '../../../components/AppLayout';
import usePermissions     from '../../../hooks/usePermissions';
import { grnApi }         from '../../../api/store.api';
import { vendorApi }      from '../../../api/vendor.api';
import { itemApi }        from '../../../api/item.api';
import { warehouseApi }   from '../../../api/warehouse.api';

const { Title, Text } = Typography;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { color: 'orange',  label: 'Pending'   },
  approved:  { color: 'green',   label: 'Approved'  },
  cancelled: { color: 'default', label: 'Cancelled' },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

// ── Empty line item ───────────────────────────────────────────────────────────
const emptyItem = () => ({
  _key:         Date.now() + Math.random(),
  item_id:      null,
  item_code:    '',
  description:  '',
  qty_ordered:  null,
  qty_received: 1,
  unit:         'pcs',
  unit_price:   null,
  lot_no:       '',
  remarks:      '',
});

export default function GRNPage() {
  const { can } = usePermissions();
  const canWrite = can('store-transactions-grn-create_edit_delete');

  const [grns,         setGrns]         = useState([]);
  const [vendors,      setVendors]      = useState([]);
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

  // ── Load GRNs ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await grnApi.getAll(params);
      setGrns(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { message.error('Failed to load GRNs'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      vendorApi.getAll({ type: 'vendor', limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      warehouseApi.getAll({ limit: 100 }).catch(() => []),
    ]).then(([v, i, w]) => {
      setVendors(Array.isArray(v) ? v : (v?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setWarehouses(Array.isArray(w) ? w : (w?.data ?? []));
    });
  }, []);

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ received_date: dayjs() });
    setLineItems([emptyItem()]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      vendor_id:    record.vendor_id,
      warehouse_id: record.warehouse_id,
      received_date: dayjs(record.received_date),
      po_reference: record.po_reference,
      invoice_no:   record.invoice_no,
      status:       record.status,
      notes:        record.notes,
    });
    setLineItems((record.Items || []).map((it) => ({
      _key:         it.id,
      item_id:      it.item_id,
      item_code:    it.item_code    || '',
      description:  it.description || '',
      qty_ordered:  it.qty_ordered  ? parseFloat(it.qty_ordered)  : null,
      qty_received: parseFloat(it.qty_received) || 1,
      unit:         it.unit         || 'pcs',
      unit_price:   it.unit_price   ? parseFloat(it.unit_price)   : null,
      lot_no:       it.lot_no       || '',
      remarks:      it.remarks      || '',
    })));
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        vendor_id:    vals.vendor_id    || null,
        warehouse_id: vals.warehouse_id,
        received_date: vals.received_date.format('YYYY-MM-DD'),
        po_reference: vals.po_reference || '',
        invoice_no:   vals.invoice_no   || '',
        notes:        vals.notes        || '',
        ...(editing && { status: vals.status }),
        items: lineItems.map(({ _key, ...it }) => it),
      };
      if (editing) {
        await grnApi.update(editing.id, payload);
        message.success('GRN updated');
      } else {
        await grnApi.create(payload);
        message.success('GRN created');
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
      await grnApi.approve(id);
      message.success('GRN approved — inventory updated');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Approval failed'); }
  };

  const onDelete = async (id) => {
    try {
      await grnApi.delete(id);
      message.success('GRN deleted');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Delete failed'); }
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
      updateLine(key, 'item_code',   found.code || '');
      updateLine(key, 'unit',        found.unit || 'pcs');
    }
    updateLine(key, 'item_id', itemId);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total    = grns.length;
  const pending  = grns.filter((r) => r.status === 'pending').length;
  const approved = grns.filter((r) => r.status === 'approved').length;

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'GRN No', dataIndex: 'grn_no', key: 'grn_no', width: 160,
      render: (no, r) => (
        <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>
          {no}
        </Text>
      ),
    },
    {
      title: 'Date', dataIndex: 'received_date', key: 'received_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Vendor', key: 'vendor', width: 200,
      render: (_, r) => r.Vendor ? (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Vendor.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Vendor.partner_code}</Text>
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Warehouse', key: 'warehouse', width: 140,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Warehouse?.name || '—'}</Text>,
    },
    {
      title: 'PO Ref', dataIndex: 'po_reference', key: 'po_ref', width: 120,
      render: (v) => v || <Text type="secondary">—</Text>,
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
                title="Approve this GRN? Inventory will be updated."
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
          {r.status !== 'approved' && (
            <Popconfirm title="Delete this GRN?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
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
        <Text style={{ color: '#6b7280', fontSize: 12 }}>GRN</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Goods Receipt Note</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Record incoming goods from vendors. Approve to update inventory stock.
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
            placeholder="Search GRN no, PO ref, invoice…"
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New GRN</Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={grns}
          size="small"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit GRN — ${editing.grn_no}` : 'New Goods Receipt Note'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update GRN' : 'Create GRN'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vendor_id" label="Vendor">
                <Select
                  showSearch
                  placeholder="Select vendor"
                  optionFilterProp="label"
                  options={vendors.map((v) => ({ value: v.id, label: `${v.name} (${v.partner_code || ''})` }))}
                  allowClear
                />
              </Form.Item>
            </Col>
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
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="received_date" label="Received Date" rules={[{ required: true, message: 'Select a date' }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="po_reference" label="PO Reference">
                <Input placeholder="Vendor PO no." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="invoice_no" label="Invoice No">
                <Input placeholder="Invoice number" />
              </Form.Item>
            </Col>
          </Row>

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

          {/* Header — drawer 760px - 48px padding = 712px content */}
          {/* Grid: 160px 90px 1fr 65px 50px 70px 28px — fits in 712px */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 90px 1fr 65px 50px 70px 28px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Item Code', 'Description', 'Qty Rcvd', 'Unit', 'Unit Price', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => (
            <div
              key={row._key}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 90px 1fr 65px 50px 70px 28px',
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
                placeholder="Code"
                value={row.item_code}
                onChange={(e) => updateLine(row._key, 'item_code', e.target.value)}
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
                value={row.qty_received}
                onChange={(v) => updateLine(row._key, 'qty_received', v)}
                style={{ width: '100%' }}
              />
              <Input
                size="small"
                placeholder="unit"
                value={row.unit}
                onChange={(e) => updateLine(row._key, 'unit', e.target.value)}
              />
              <InputNumber
                size="small"
                min={0}
                precision={2}
                placeholder="₹"
                value={row.unit_price}
                onChange={(v) => updateLine(row._key, 'unit_price', v)}
                style={{ width: '100%' }}
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
        </Form>
      </Drawer>
    </AppLayout>
  );
}
