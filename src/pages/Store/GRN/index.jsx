import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  PlusCircleOutlined, MinusCircleOutlined, CheckCircleOutlined,
  BulbOutlined, StopOutlined, ExclamationCircleOutlined, QrcodeOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout            from '../../../components/AppLayout';
import ResponsiveTable      from '../../../components/ResponsiveTable';
import usePermissions       from '../../../hooks/usePermissions';
import { grnApi }           from '../../../api/store.api';
import { vendorApi }        from '../../../api/vendor.api';
import { itemApi }          from '../../../api/item.api';
import { warehouseApi }     from '../../../api/warehouse.api';
import { purchaseOrderApi } from '../../../api/procurement.api';
import aiApi                from '../../../api/ai.api';
import useAiSuggestion      from '../../../hooks/useAiSuggestion';
import AiSuggestionCard     from '../../../components/AiSuggestion/AiSuggestionCard';
import QrLabelPrint         from '../../../components/common/QrLabelPrint';
import { exportTableToCsv } from '../../../utils/exportCsv';

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

const { Title, Text } = Typography;

// ── Price helpers ──────────────────────────────────────────────────────────────
const calcBase = (qty, price, disc) =>
  parseFloat(((qty || 0) * (price || 0) * (1 - (disc || 0) / 100)).toFixed(2));

const calcTotal = (qty, price, disc, gst) =>
  parseFloat((calcBase(qty, price, disc) * (1 + (gst || 0) / 100)).toFixed(2));

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
  discount:     0,
  gst_rate:     18,
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
  const [pos,          setPos]          = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  // QR label state
  const [qrRecord, setQrRecord] = useState(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [lineItems,  setLineItems]  = useState([emptyItem()]);

  const [form] = Form.useForm();

  // AI state
  const aiQuality = useAiSuggestion(aiApi.getGrnAiQualityFlag);
  const [aiGrnDrawerOpen, setAiGrnDrawerOpen] = useState(false);
  const [aiGrnRecord, setAiGrnRecord] = useState(null);

  const openAiGrnDrawer = (grn) => {
    setAiGrnRecord(grn);
    setAiGrnDrawerOpen(true);
    aiQuality.reset();
    aiQuality.fetch(grn.id);
  };
  const closeAiGrnDrawer = () => {
    setAiGrnDrawerOpen(false);
    setAiGrnRecord(null);
    aiQuality.reset();
  };

  // ── Load GRNs ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await grnApi.getAll(params);
      setGrns(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load GRNs'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      vendorApi.getAll({ type: 'vendor', limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      warehouseApi.getAll({ limit: 100 }).catch(() => []),
      purchaseOrderApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
    ]).then(([v, i, w, p]) => {
      setVendors(Array.isArray(v) ? v : (v?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setWarehouses(Array.isArray(w) ? w : (w?.data ?? []));
      const poList = Array.isArray(p) ? p : (p?.data ?? []);
      setPos(poList);
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
      po_id:        record.po_id || null,
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
      discount:     parseFloat(it.discount)  || 0,
      gst_rate:     parseFloat(it.gst_rate)  || 18,
      lot_no:       it.lot_no       || '',
      remarks:      it.remarks      || '',
    })));
    setDrawerOpen(true);
  };

  const grossTotal  = parseFloat((lineItems.reduce((s, r) => s + (r.qty_received || 0) * (r.unit_price || 0), 0)).toFixed(2));
  const discountAmt = parseFloat((lineItems.reduce((s, r) => s + (r.qty_received || 0) * (r.unit_price || 0) * (r.discount || 0) / 100, 0)).toFixed(2));
  const subtotal    = parseFloat((grossTotal - discountAmt).toFixed(2));
  const gstAmount   = parseFloat((lineItems.reduce((s, r) => {
    const base = calcBase(r.qty_received, r.unit_price, r.discount);
    return s + base * (r.gst_rate || 0) / 100;
  }, 0)).toFixed(2));
  const grandTotal  = parseFloat((subtotal + gstAmount).toFixed(2));

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        vendor_id:    vals.vendor_id    || null,
        warehouse_id: vals.warehouse_id,
        received_date: vals.received_date.format('YYYY-MM-DD'),
        po_id:        vals.po_id        || null,
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
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onApprove = async (id) => {
    try {
      await grnApi.approve(id);
      message.success('GRN approved — inventory updated');
      load();
    } catch (err) { message.error(err?.message || 'Approval failed'); }
  };

  const onDelete = async (id) => {
    try {
      await grnApi.delete(id);
      message.success('GRN deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
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

  // ── PO selection: auto-fill vendor, po_reference, and line items ──────────
  const onPoSelect = async (poId) => {
    if (!poId) return;
    try {
      const res = await purchaseOrderApi.getById(poId);
      const po = res?.data ?? res;
      if (!po) return;
      // Auto-fill vendor
      if (po.vendor_id) form.setFieldsValue({ vendor_id: po.vendor_id });
      if (po.po_no)     form.setFieldsValue({ po_reference: po.po_no });
      // Auto-fill line items from PO items
      const poItems = po.Items || [];
      if (poItems.length) {
        setLineItems(poItems.map((pit) => ({
          _key:         Date.now() + Math.random(),
          item_id:      pit.item_id,
          item_code:    pit.Item?.code || '',
          description:  pit.Item?.name || pit.description || '',
          qty_ordered:  parseFloat(pit.qty_ordered) || 0,
          qty_received: parseFloat(pit.qty_ordered) - parseFloat(pit.qty_received || 0),
          unit:         pit.unit || pit.Item?.unit || 'pcs',
          unit_price:   pit.unit_price ? parseFloat(pit.unit_price) : null,
          lot_no:       '',
          remarks:      '',
        })));
      }
    } catch { /* silent — PO detail fetch failed */ }
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
      title: 'Purchase Order', key: 'po_ref', width: 150,
      render: (_, r) => r.PurchaseOrder
        ? <Text style={{ color: '#1d4ed8', fontSize: 12 }}>{r.PurchaseOrder.po_no}</Text>
        : (r.po_reference || <Text type="secondary">—</Text>),
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
    {
      title: 'AI', key: 'ai', width: 54, align: 'center',
      render: (_, r) => (
        <Tooltip title="AI Quality Flag">
          <Button
            size="small"
            icon={<BulbOutlined />}
            style={{ color: '#7c3aed', borderColor: '#7c3aed' }}
            onClick={() => openAiGrnDrawer(r)}
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
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('g-r-n.csv', grns, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New GRN</Button>
          )}
        </div>

        <ResponsiveTable
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>
                Gross: ₹{grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                {discountAmt > 0 && (
                  <span style={{ marginLeft: 12, color: '#dc2626' }}>
                    Discount: −₹{discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                )}
                <span style={{ marginLeft: 12 }}>
                  Subtotal: ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span style={{ marginLeft: 12 }}>
                  GST: ₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </Text>
              <Text strong style={{ fontSize: 14 }}>
                Grand Total (incl. GST): ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
              {canWrite && (
                <Button type="primary" loading={saving} onClick={onSave}>
                  {editing ? 'Update GRN' : 'Create GRN'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
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
            <Col xs={24} sm={12}>
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
            <Col xs={24} sm={12}>
              <Form.Item name="po_id" label="Link to Purchase Order">
                <Select
                  showSearch
                  placeholder="Select PO (optional)"
                  optionFilterProp="label"
                  allowClear
                  onChange={onPoSelect}
                  options={pos.map((p) => ({
                    value: p.id,
                    label: `${p.po_no}${p.Vendor ? ` — ${p.Vendor.name}` : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="received_date" label="Received Date" rules={[{ required: true, message: 'Select a date' }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="po_reference" label="PO Reference">
                <Input placeholder="Vendor PO no." />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
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

          <div className="res-line-items">
          {/* Header — drawer 760px - 48px padding = 712px content */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 70px 1fr 60px 45px 65px 50px 50px 80px 28px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Code', 'Lot No', 'Qty Rcvd', 'Unit', 'Unit Price', 'Disc %', 'GST %', 'Total (₹)', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => {
            const rowTotal = calcTotal(row.qty_received, row.unit_price, row.discount, row.gst_rate);
            return (
            <div
              key={row._key}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 70px 1fr 60px 45px 65px 50px 50px 80px 28px',
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
                placeholder="Lot No"
                value={row.lot_no}
                onChange={(e) => updateLine(row._key, 'lot_no', e.target.value)}
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
              <InputNumber
                size="small"
                min={0}
                max={100}
                precision={1}
                value={row.discount}
                onChange={(v) => updateLine(row._key, 'discount', v)}
                style={{ width: '100%' }}
              />
              <InputNumber
                size="small"
                min={0}
                precision={1}
                value={row.gst_rate}
                onChange={(v) => updateLine(row._key, 'gst_rate', v)}
                style={{ width: '100%' }}
              />
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#111827', textAlign: 'right' }}>
                ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
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
          </div>
        </Form>
      </Drawer>
      {/* ── AI Quality Flag Drawer ────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <BulbOutlined style={{ color: '#7c3aed' }} />
            <span>AI Quality Flag — {aiGrnRecord?.grn_no}</span>
          </Space>
        }
        open={aiGrnDrawerOpen}
        onClose={closeAiGrnDrawer}
        width={500}
      >
        {aiGrnRecord && (
          <>
            <Space wrap style={{ marginBottom: 16 }}>
              <Tag color="blue">{aiGrnRecord.grn_no}</Tag>
              {aiGrnRecord.Vendor && <Tag color="purple">{aiGrnRecord.Vendor.name}</Tag>}
              <Tag color={STATUS_CONFIG[aiGrnRecord.status]?.color || 'default'}>
                {STATUS_CONFIG[aiGrnRecord.status]?.label || aiGrnRecord.status}
              </Tag>
              {aiGrnRecord.received_date && (
                <Tag>Received: {dayjs(aiGrnRecord.received_date).format('DD MMM YYYY')}</Tag>
              )}
            </Space>

            <AiSuggestionCard
              loading={aiQuality.loading}
              error={aiQuality.error}
              aiAvailable={aiQuality.aiAvailable}
              cached={aiQuality.cached}
              onRetry={() => aiQuality.fetch(aiGrnRecord.id)}
              onDismiss={closeAiGrnDrawer}
            >
              {(() => {
                const d = aiQuality.data;
                if (!d) return null;
                const insight = parseInsight(d.ai_insight);
                if (!insight) return null;
                return (
                  <div style={{ fontSize: 13 }}>
                    {/* Risk level + confidence */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {insight.quality_risk && (
                        <Tag color={
                          insight.quality_risk === 'high' ? 'red' :
                          insight.quality_risk === 'medium' ? 'orange' : 'green'
                        } style={{ fontWeight: 600 }}>
                          Quality Risk: {insight.quality_risk?.toUpperCase()}
                        </Tag>
                      )}
                      {insight.confidence && <Tag color="geekblue">Confidence: {insight.confidence}</Tag>}
                    </div>

                    {/* Block / escalate banners */}
                    {insight.block_inventory && (
                      <Alert
                        type="error"
                        showIcon
                        icon={<StopOutlined />}
                        message="Block Inventory Recommended"
                        description="AI recommends holding this GRN from inventory until quality review is complete."
                        style={{ marginBottom: 10, fontSize: 12 }}
                      />
                    )}
                    {insight.escalate_to_quality && (
                      <Alert
                        type="warning"
                        showIcon
                        icon={<ExclamationCircleOutlined />}
                        message="Escalate to Quality Team"
                        description="This GRN should be reviewed by the quality team before approval."
                        style={{ marginBottom: 10, fontSize: 12 }}
                      />
                    )}

                    {/* Risk summary */}
                    {insight.risk_summary && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>Risk Summary</Text>
                        <div style={{
                          marginTop: 4, padding: '8px 12px',
                          background: '#f8fafc', border: '1px solid #e2e8f0',
                          borderRadius: 6, fontSize: 12, lineHeight: 1.6, color: '#374151',
                        }}>
                          {insight.risk_summary}
                        </div>
                      </div>
                    )}

                    {/* IQC summary from backend context */}
                    {d.iqc_summary && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>IQC Summary</Text>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#4b5563' }}>
                          {typeof d.iqc_summary === 'string'
                            ? d.iqc_summary
                            : `Status: ${d.iqc_summary.status || '—'} | Result: ${d.iqc_summary.result || '—'}`}
                        </div>
                      </div>
                    )}

                    {/* Quality concerns */}
                    {Array.isArray(insight.quality_concerns) && insight.quality_concerns.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>Quality Concerns</Text>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {insight.quality_concerns.map((item, i) => (
                            <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommended actions */}
                    {Array.isArray(insight.recommended_actions) && insight.recommended_actions.length > 0 && (
                      <div style={{ marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>Recommended Actions</Text>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {insight.recommended_actions.map((item, i) => (
                            <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {insight.raw_text && (
                      <div style={{ fontSize: 12, color: '#4b5563', whiteSpace: 'pre-wrap' }}>
                        {insight.raw_text}
                      </div>
                    )}
                  </div>
                );
              })()}
            </AiSuggestionCard>
          </>
        )}
      </Drawer>

      <QrLabelPrint
        open={!!qrRecord}
        onClose={() => setQrRecord(null)}
        type="GRN"
        identifier={qrRecord?.grn_no || ''}
        title="Goods Receipt Note"
        subtitle={qrRecord?.Vendor?.name || ''}
      />
    </AppLayout>
  );
}
