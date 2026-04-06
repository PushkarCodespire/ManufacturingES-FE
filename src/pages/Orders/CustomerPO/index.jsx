import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer, Modal,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined, EyeOutlined,
  PlusCircleOutlined, MinusCircleOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { UploadOutlined } from '@ant-design/icons';
import { Upload } from 'antd';
import AppLayout            from '../../../components/AppLayout';
import usePermissions       from '../../../hooks/usePermissions';
import { customerOrderApi, quotationApi } from '../../../api/orders.api';
import { vendorApi }        from '../../../api/vendor.api';
import { itemApi }          from '../../../api/item.api';
import aiApi                from '../../../api/ai.api';
import useAiSuggestion      from '../../../hooks/useAiSuggestion';
import AiSuggestionCard     from '../../../components/AiSuggestion/AiSuggestionCard';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal       from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

const { Title, Text } = Typography;

// ── Price helpers ──────────────────────────────────────────────────────────────
const calcBase = (qty, price, disc) =>
  parseFloat(((qty || 0) * (price || 0) * (1 - (disc || 0) / 100)).toFixed(2));

const calcTotal = (qty, price, disc, gst) =>
  parseFloat((calcBase(qty, price, disc) * (1 + (gst || 0) / 100)).toFixed(2));

const STATUS_CONFIG = {
  active:        { color: 'blue',    label: 'Active'        },
  in_production: { color: 'orange',  label: 'In Production' },
  ready:         { color: 'cyan',    label: 'Ready'         },
  dispatched:    { color: 'purple',  label: 'Dispatched'    },
  closed:        { color: 'green',   label: 'Closed'        },
  cancelled:     { color: 'default', label: 'Cancelled'     },
};
const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

// ── CSV Upload config ─────────────────────────────────────────────────────────
const CSV_HEADERS = ['Customer Code', 'Customer PO No', 'Order Date', 'Delivery Date', 'Item Code', 'Description', 'Qty', 'Unit', 'Unit Price', 'Discount %', 'GST %', 'Notes'];
const CSV_SAMPLE = [
  { 'Customer Code': 'CUST-001', 'Customer PO No': 'PO-2025-001', 'Order Date': '2025-06-15', 'Delivery Date': '2025-07-15', 'Item Code': 'ITM-001', 'Description': 'Shaft Assembly', 'Qty': '100', 'Unit': 'pcs', 'Unit Price': '250', 'Discount %': '0', 'GST %': '18', 'Notes': '' },
];
const CSV_VALIDATION = [
  { field: 'Customer Code', required: true },
  { field: 'Customer PO No', required: true },
  { field: 'Item Code', required: true },
  { field: 'Qty', required: true },
];

const emptyItem = () => ({
  _key: Date.now() + Math.random(),
  item_id: null, description: '', qty_ordered: 1, unit: 'pcs',
  unit_price: 0, discount: 0, gst_rate: 18, total_price: 0,
});

export default function CustomerPOPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canWrite = can('plan-orders-customer_po-create_edit_delete');

  const [orders,       setOrders]       = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [items,        setItemsList]    = useState([]);
  const [quotations,   setQuotations]   = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [lineItems,    setLineItems]    = useState([emptyItem()]);

  const [form] = Form.useForm();
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [poExtractVisible, setPoExtractVisible] = useState(false);
  const aiExtract = useAiSuggestion(aiApi.extractPo);

  const handlePoUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    setPoExtractVisible(true);
    aiExtract.fetch(formData);
    return false; // prevent default upload
  };

  const applyPoExtraction = (data) => {
    if (!data) return;
    if (data.customer_po_no) form.setFieldValue('customer_po_no', data.customer_po_no);
    if (data.order_date) form.setFieldValue('order_date', dayjs(data.order_date));
    if (data.delivery_date) form.setFieldValue('delivery_date', dayjs(data.delivery_date));
    if (data.matched_customer?.id) form.setFieldValue('customer_id', data.matched_customer.id);
    if (data.terms) form.setFieldValue('terms', data.terms);
    if (data.items?.length) {
      const newItems = data.items.map((it, i) => ({
        _key: Date.now() + i,
        item_id: it.matched_item_id || null,
        description: it.description || '',
        qty_ordered: it.qty || 0,
        unit: it.unit || 'pcs',
        unit_price: it.unit_price || 0,
        gst_rate: 18,
      }));
      setLineItems(newItems);
    }
    message.success('PO data extracted — review and save');
    setPoExtractVisible(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await customerOrderApi.getAll(params);
      setOrders(data);
    } catch (err) { message.error(err?.message || 'Failed to load orders'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      vendorApi.getAll({ type: 'customer', limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => []),
      quotationApi.getAll({ limit: 200 }).catch(() => []),
    ]).then(([c, i, q]) => {
      setCustomers(Array.isArray(c) ? c : (c?.data ?? []));
      setItemsList(Array.isArray(i) ? i : (i?.data ?? []));
      setQuotations(Array.isArray(q) ? q : (q?.data ?? []));
    });
  }, []);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ order_date: dayjs() });
    setLineItems([emptyItem()]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      customer_id:    record.customer_id,
      customer_po_no: record.customer_po_no,
      quotation_id:   record.quotation_id,
      order_date:     dayjs(record.order_date),
      delivery_date:  record.delivery_date ? dayjs(record.delivery_date) : null,
      terms:          record.terms,
      notes:          record.notes,
      status:         record.status,
    });
    setLineItems((record.Items || []).map((it) => ({
      _key:         it.id,
      item_id:      it.item_id,
      description:  it.description || '',
      qty_ordered:  parseFloat(it.qty_ordered) || 1,
      unit:         it.unit || 'pcs',
      unit_price:   parseFloat(it.unit_price) || 0,
      discount:     parseFloat(it.discount) || 0,
      gst_rate:     parseFloat(it.gst_rate) || 18,
      total_price:  parseFloat(it.total_price) || 0,
    })));
    setDrawerOpen(true);
  };

  // When quotation selected, auto-populate customer + line items
  const onQuotationSelect = async (qId) => {
    if (!qId) return;
    const found = quotations.find((q) => q.id === qId);
    if (found) {
      form.setFieldsValue({ customer_id: found.customer_id });
      if (found.Items?.length) {
        setLineItems(found.Items.map((it) => ({
          _key:        Date.now() + Math.random(),
          item_id:     it.item_id,
          description: it.description || it.Item?.name || '',
          qty_ordered: parseFloat(it.qty) || 1,
          unit:        it.unit || 'pcs',
          unit_price:  parseFloat(it.unit_price) || 0,
          discount:    parseFloat(it.discount) || 0,
          gst_rate:    parseFloat(it.gst_rate) || 18,
          total_price: parseFloat(it.total_price) || 0,
        })));
      }
    }
  };

  const grossTotal  = parseFloat((lineItems.reduce((s, r) => s + (r.qty_ordered || 0) * (r.unit_price || 0), 0)).toFixed(2));
  const discountAmt = parseFloat((lineItems.reduce((s, r) => s + (r.qty_ordered || 0) * (r.unit_price || 0) * (r.discount || 0) / 100, 0)).toFixed(2));
  const subtotal    = parseFloat((grossTotal - discountAmt).toFixed(2));
  const gstAmount   = parseFloat((lineItems.reduce((s, r) => {
    const base = calcBase(r.qty_ordered, r.unit_price, r.discount);
    return s + base * (r.gst_rate || 0) / 100;
  }, 0)).toFixed(2));
  const grandTotal  = parseFloat((subtotal + gstAmount).toFixed(2));

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        customer_id:    vals.customer_id,
        customer_po_no: vals.customer_po_no,
        quotation_id:   vals.quotation_id || null,
        order_date:     vals.order_date.format('YYYY-MM-DD'),
        delivery_date:  vals.delivery_date ? vals.delivery_date.format('YYYY-MM-DD') : null,
        terms:          vals.terms || '',
        notes:          vals.notes || '',
        ...(editing && { status: vals.status }),
        items: lineItems.map(({ _key, ...it }) => ({
          ...it,
          total_price: calcTotal(it.qty_ordered, it.unit_price, it.discount, it.gst_rate),
        })),
      };
      if (editing) {
        await customerOrderApi.update(editing.id, payload);
        message.success('Order updated');
      } else {
        const result = await customerOrderApi.create(payload);
        message.success('Customer Order created');
        if (result?.warnings?.length) {
          Modal.warning({
            title: 'Price Mismatch Warning',
            width: 520,
            content: (
              <div>
                <p style={{ marginBottom: 8 }}>The following items have prices that differ more than 2% from the linked quotation:</p>
                <ul style={{ paddingLeft: 20 }}>
                  {result.warnings.map((w, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <strong>{w.item}</strong>: Quotation ₹{w.quotation_price} vs PO ₹{w.order_price} ({w.difference_pct}% diff)
                    </li>
                  ))}
                </ul>
                <p style={{ marginTop: 8, color: '#666' }}>The order has been created. Please verify the prices.</p>
              </div>
            ),
          });
        }
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await customerOrderApi.delete(id);
      message.success('Order deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  const addLine = () => setLineItems((p) => [...p, emptyItem()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));
  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  // ── CSV Import handler ────────────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    const groups = {};
    for (const row of rows) {
      const key = `${(row['Customer Code'] || '').trim()}||${(row['Customer PO No'] || '').trim()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    for (const [, groupRows] of Object.entries(groups)) {
      try {
        const first = groupRows[0];
        const custCode = (first['Customer Code'] || '').trim();
        const cust = customers.find((c) => c.partner_code?.toLowerCase() === custCode.toLowerCase());
        if (!cust) throw new Error(`Customer "${custCode}" not found`);
        const itemsPayload = groupRows.map((row) => {
          const itemCode = (row['Item Code'] || '').trim();
          const item = items.find((i) => i.code?.toLowerCase() === itemCode.toLowerCase());
          return {
            item_id: item?.id || null,
            description: row['Description'] || item?.name || '',
            qty_ordered: parseFloat(row['Qty']) || 1,
            unit: row['Unit'] || 'pcs',
            unit_price: parseFloat(row['Unit Price']) || 0,
            discount: parseFloat(row['Discount %']) || 0,
            gst_rate: parseFloat(row['GST %']) || 18,
            total_price: calcTotal(parseFloat(row['Qty']) || 1, parseFloat(row['Unit Price']) || 0, parseFloat(row['Discount %']) || 0, parseFloat(row['GST %']) || 18),
          };
        });
        await customerOrderApi.create({
          customer_id: cust.id,
          customer_po_no: first['Customer PO No'] || '',
          order_date: first['Order Date'] || dayjs().format('YYYY-MM-DD'),
          delivery_date: first['Delivery Date'] || null,
          terms: '',
          notes: first['Notes'] || '',
          items: itemsPayload,
        });
        success += groupRows.length;
      } catch (err) {
        failed += groupRows.length;
        errors.push(`PO "${groupRows[0]['Customer PO No']}": ${err?.response?.data?.message || err.message}`);
      }
    }
    load();
    return { success, failed, errors };
  };

  const onItemSelect = (key, itemId) => {
    const found = items.find((i) => i.id === itemId);
    if (found) {
      updateLine(key, 'description', found.name);
      updateLine(key, 'unit', found.unit || 'pcs');
      if (found.gst_rate) updateLine(key, 'gst_rate', parseFloat(found.gst_rate));
    }
    updateLine(key, 'item_id', itemId);
  };

  const columns = [
    {
      title: 'Order No',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 140,
      render: (no, r) => (
        <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>
          {no}
        </Text>
      ),
    },
    {
      title: 'Customer PO No',
      dataIndex: 'customer_po_no',
      key: 'cust_po',
      width: 150,
      render: (v) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 180,
      render: (_, r) => r.Customer ? (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Customer.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Customer.partner_code}</Text>
        </div>
      ) : '—',
    },
    {
      title: 'Order Date',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Delivery Date',
      dataIndex: 'delivery_date',
      key: 'delivery_date',
      width: 120,
      render: (d) => {
        if (!d) return '—';
        const isPast = dayjs(d).isBefore(dayjs(), 'day');
        return <Text style={{ color: isPast ? '#dc2626' : undefined }}>{dayjs(d).format('DD MMM YYYY')}</Text>;
      },
    },
    {
      title: 'Items',
      key: 'items',
      width: 70,
      align: 'center',
      render: (_, r) => (
        <Badge count={r.Items?.length || 0} style={{ backgroundColor: '#e0e7ff', color: '#1d4ed8' }} />
      ),
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'total_amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (v) => v ? <Text strong>₹{parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: canWrite ? 120 : 50,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View Details"><Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/orders/customer-po/${r.id}`)} /></Tooltip>
          {canWrite && (
            <>
              <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
              {(r.status === 'active' || r.status === 'cancelled') && (
                <Popconfirm title="Delete this order?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
                  <Tooltip title="Delete"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Orders</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Customer PO</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Customer Purchase Orders</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Record and manage confirmed customer purchase orders. Track delivery timelines and production status.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {orders.length}</Tag>
        <Tag color="processing">Active: {orders.filter((o) => o.status === 'active').length}</Tag>
        <Tag color="orange">In Production: {orders.filter((o) => o.status === 'in_production').length}</Tag>
        <Tag color="green">Closed: {orders.filter((o) => o.status === 'closed').length}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search order no or PO no…"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
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
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('customer-p-o.csv', orders, columns)}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)}>Upload CSV</Button>}
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Receive PO</Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={orders}
          size="small"
          scroll={{ x: 1280 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Drawer ──────────────────────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit Order — ${editing.order_no}` : 'Receive Customer PO'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={820}
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
                  {editing ? 'Update Order' : 'Create Order'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        {!editing && (
          <div style={{ marginBottom: 16 }}>
            <Upload beforeUpload={handlePoUpload} accept=".pdf,.png,.jpg,.jpeg" showUploadList={false} maxCount={1}>
              <Button icon={<UploadOutlined />} type="dashed" loading={aiExtract.loading}>
                Upload PO PDF — Madad will extract data
              </Button>
            </Upload>
            {poExtractVisible && (
              <AiSuggestionCard
                title="PO Data Extraction"
                loading={aiExtract.loading}
                error={aiExtract.error}
                aiAvailable={aiExtract.aiAvailable}
                onDismiss={() => setPoExtractVisible(false)}
                onRetry={() => {}}
                style={{ marginTop: 8 }}
              >
                {aiExtract.data?.data && (
                  <div>
                    <Text style={{ fontSize: 12 }}>
                      Found: {aiExtract.data.data.customer_po_no || 'PO#'} | {aiExtract.data.data.items?.length || 0} items | Quality: {aiExtract.data.data.extraction_quality}
                    </Text>
                    <br />
                    <Button size="small" type="primary" onClick={() => applyPoExtraction(aiExtract.data.data)} style={{ marginTop: 6 }}>
                      Apply Extracted Data
                    </Button>
                  </div>
                )}
              </AiSuggestionCard>
            )}
          </div>
        )}

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" placeholder="Select customer"
                  options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.partner_code})` }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customer_po_no" label="Customer PO Number" rules={[{ required: true, message: 'PO number is required' }]}>
                <Input placeholder="e.g. PO-2026-12345" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="quotation_id" label="Against Quotation (optional)">
                <Select showSearch allowClear optionFilterProp="label" placeholder="Link to quotation"
                  onChange={onQuotationSelect}
                  options={quotations.map((q) => ({ value: q.id, label: `${q.quotation_no} — ${q.Customer?.name || ''}` }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              {editing && (
                <Form.Item name="status" label="Status">
                  <Select options={STATUS_OPTIONS} />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="order_date" label="Order Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="delivery_date" label="Requested Delivery Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="terms" label="Terms">
            <Input.TextArea rows={2} placeholder="Payment terms, special conditions…" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Order Items
          </Divider>

          <div className="res-line-items">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 100px 55px 65px 80px 55px 55px 85px 32px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Description', 'Qty', 'Unit', 'Unit Price', 'Disc %', 'GST %', 'Total (₹)', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => {
            const rowTotal = calcTotal(row.qty_ordered, row.unit_price, row.discount, row.gst_rate);
            return (
            <div key={row._key} style={{ display: 'grid', gridTemplateColumns: '180px 100px 55px 65px 80px 55px 55px 85px 32px', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <Select size="small" showSearch allowClear optionFilterProp="label"
                value={row.item_id} placeholder="Item" onChange={(v) => onItemSelect(row._key, v)}
                options={items.map((i) => ({ value: i.id, label: `${i.name}` }))}
              />
              <Input size="small" placeholder="Description" value={row.description}
                onChange={(e) => updateLine(row._key, 'description', e.target.value)} />
              <InputNumber size="small" min={0} value={row.qty_ordered}
                onChange={(v) => updateLine(row._key, 'qty_ordered', v)} style={{ width: '100%' }} />
              <Input size="small" value={row.unit}
                onChange={(e) => updateLine(row._key, 'unit', e.target.value)} />
              <InputNumber size="small" min={0} precision={2} value={row.unit_price}
                onChange={(v) => updateLine(row._key, 'unit_price', v)} style={{ width: '100%' }} />
              <InputNumber size="small" min={0} max={100} precision={1} value={row.discount}
                onChange={(v) => updateLine(row._key, 'discount', v)} style={{ width: '100%' }} />
              <InputNumber size="small" min={0} precision={1} value={row.gst_rate}
                onChange={(v) => updateLine(row._key, 'gst_rate', v)} style={{ width: '100%' }} />
              <Text style={{ fontSize: 12, fontWeight: 600, color: '#111827', textAlign: 'right' }}>
                ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
              <Button size="small" type="text" danger icon={<MinusCircleOutlined />}
                onClick={() => removeLine(row._key)} disabled={lineItems.length === 1} />
            </div>
            );
          })}

          <Button type="dashed" onClick={addLine} icon={<PlusCircleOutlined />} style={{ width: '100%', marginTop: 4 }}>
            Add Item
          </Button>
          </div>
        </Form>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Customer POs"
        entityName="Customer PO"
        sampleHeaders={CSV_HEADERS}
        sampleRows={CSV_SAMPLE}
        validationRules={CSV_VALIDATION}
      />
    </AppLayout>
  );
}
