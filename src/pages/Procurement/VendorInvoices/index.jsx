import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Row, Col, Alert, Descriptions, Badge, Statistic, Modal,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, RightOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined,
  ExclamationCircleOutlined, SyncOutlined, DollarOutlined,
  FileTextOutlined, StopOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout           from '../../../components/AppLayout';
import ResponsiveTable     from '../../../components/ResponsiveTable';
import usePermissions      from '../../../hooks/usePermissions';
import { vendorInvoiceApi } from '../../../api/procurement.api';
import { purchaseOrderApi } from '../../../api/procurement.api';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal       from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';
import { UploadOutlined }   from '@ant-design/icons';

// ── CSV Upload config ─────────────────────────────────────────────────────────
const VINV_CSV_HEADERS = ['Invoice No', 'PO No', 'Invoice Date', 'Due Date', 'Tax Amount', 'Item Description', 'Qty Invoiced', 'Unit Price', 'Notes'];
const VINV_CSV_SAMPLE = [
  { 'Invoice No': 'INV-2025-001', 'PO No': 'PO-001', 'Invoice Date': '2025-06-20', 'Due Date': '2025-07-20', 'Tax Amount': '500', 'Item Description': 'Steel Plate', 'Qty Invoiced': '100', 'Unit Price': '250', 'Notes': '' },
];
const VINV_CSV_VALIDATION = [
  { field: 'Invoice No', required: true },
  { field: 'PO No', required: true },
  { field: 'Invoice Date', required: true },
];

const { Title, Text } = Typography;

// ── Configs ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { color: 'gold',    label: 'Pending'   },
  approved:  { color: 'green',   label: 'Approved'  },
  disputed:  { color: 'red',     label: 'Disputed'  },
  paid:      { color: 'blue',    label: 'Paid'      },
  cancelled: { color: 'default', label: 'Cancelled' },
};

const MATCH_CONFIG = {
  pending:        { color: 'default', label: 'Not Matched',    icon: null },
  matched:        { color: 'green',   label: 'Matched',        icon: <CheckCircleOutlined /> },
  partial_match:  { color: 'orange',  label: 'Partial Match',  icon: <ExclamationCircleOutlined /> },
  disputed:       { color: 'red',     label: 'Disputed',       icon: <CloseCircleOutlined /> },
};

const MATCH_FLAG_CONFIG = {
  ok:             { color: 'green',   label: 'OK'             },
  qty_mismatch:   { color: 'orange',  label: 'Qty Mismatch'   },
  price_mismatch: { color: 'orange',  label: 'Price Mismatch' },
  both_mismatch:  { color: 'red',     label: 'Both Mismatch'  },
  pending:        { color: 'default', label: 'Pending'        },
};

const fmtCcy = (v) =>
  v != null
    ? `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

const fmtQty = (v) => v != null ? parseFloat(v).toLocaleString() : '—';

// ─────────────────────────────────────────────────────────────────────────────
export default function VendorInvoicesPage() {
  const { can } = usePermissions();
  const canWrite   = can('plan-vendor-invoices-vendor_invoices-create_edit_delete');
  const canApprove = can('plan-vendor-invoices-approve_invoice-approve_reject');

  // ── Data ──────────────────────────────────────────────────────────────────
  const [records,      setRecords]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFil,    setStatusFil]    = useState('');
  const [matchFil,     setMatchFil]     = useState('');
  const [poOptions,    setPoOptions]    = useState([]);

  // ── Drawer / Modal state ──────────────────────────────────────────────────
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailRec,     setDetailRec]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [form]                            = Form.useForm();
  const [lineItems,     setLineItems]     = useState([emptyLine()]);

  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Dispute modal
  const [disputeModal,  setDisputeModal]  = useState(false);
  const [disputeRec,    setDisputeRec]    = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing,     setDisputing]     = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFil) params.status       = statusFil;
      if (matchFil)  params.match_status = matchFil;
      const res = await vendorInvoiceApi.getAll(params);
      setRecords(res.data || []);
    } catch { message.error('Failed to load invoices'); }
    finally  { setLoading(false); }
  }, [statusFil, matchFil]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    purchaseOrderApi.getAll({ limit: 500 })
      .then(r => setPoOptions((r.data || []).map(p => ({ value: p.id, label: `${p.po_no} — ${p.Vendor?.name || ''}` }))))
      .catch(() => {});
  }, []);

  const loadDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await vendorInvoiceApi.getById(id);
      setDetailRec(res.data);
    } catch { message.error('Failed to load invoice detail'); }
    finally  { setDetailLoading(false); }
  };

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filtered = records.filter(r =>
    !search ||
    r.internal_ref?.toLowerCase().includes(search.toLowerCase()) ||
    r.invoice_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.Vendor?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.PurchaseOrder?.po_no?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalPending  = records.filter(r => r.status === 'pending').length;
  const totalDisp     = records.filter(r => r.status === 'disputed').length;
  const totalApproved = records.filter(r => r.status === 'approved').length;
  const totalValue    = records.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
  const mismatched    = records.filter(r => r.match_status === 'partial_match').length;

  // ── Line items ────────────────────────────────────────────────────────────
  function emptyLine() {
    return { _key: Date.now() + Math.random(), item_id: null, description: '', qty_invoiced: null, unit_price: null };
  }
  const addLine    = () => setLineItems(p => [...p, emptyLine()]);
  const removeLine = (key) => setLineItems(p => p.filter(l => l._key !== key));
  const updateLine = (key, field, val) =>
    setLineItems(p => p.map(l => l._key === key ? { ...l, [field]: val } : l));

  const lineTotal = lineItems.reduce((s, l) =>
    s + (parseFloat(l.qty_invoiced || 0) * parseFloat(l.unit_price || 0)), 0);

  // ── Create invoice ────────────────────────────────────────────────────────
  const openCreate = () => {
    form.resetFields();
    setLineItems([emptyLine()]);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    let values;
    try { values = await form.validateFields(); }
    catch { return; }

    const validLines = lineItems.filter(l => l.qty_invoiced && l.unit_price != null);
    if (!validLines.length) { message.error('Add at least one item line'); return; }

    setSaving(true);
    try {
      const payload = {
        ...values,
        invoice_date: values.invoice_date.format('YYYY-MM-DD'),
        due_date:     values.due_date?.format('YYYY-MM-DD') || null,
        grn_id:       values.grn_id || null,
        items: validLines.map(l => ({
          item_id:      l.item_id || null,
          description:  l.description || null,
          qty_invoiced: parseFloat(l.qty_invoiced),
          unit_price:   parseFloat(l.unit_price),
        })),
      };
      await vendorInvoiceApi.create(payload);
      message.success('Invoice created & matched');
      setDrawerOpen(false);
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Create failed');
    } finally { setSaving(false); }
  };

  // ── CSV Import handler ────────────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const poNo = (row['PO No'] || '').trim();
        const po = poOptions.find((p) => p.label?.toLowerCase().includes(poNo.toLowerCase()));
        if (!po) throw new Error(`PO "${poNo}" not found`);
        await vendorInvoiceApi.create({
          invoice_no:   row['Invoice No'],
          po_id:        po.value,
          invoice_date: row['Invoice Date'],
          due_date:     row['Due Date'] || null,
          tax_amount:   parseFloat(row['Tax Amount']) || 0,
          notes:        row['Notes'] || '',
          items: [{
            description:  row['Item Description'] || '',
            qty_invoiced: parseFloat(row['Qty Invoiced']) || 1,
            unit_price:   parseFloat(row['Unit Price']) || 0,
          }],
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Invoice No']}": ${err?.response?.data?.message || err.message}`);
      }
    }
    load();
    return { success, failed, errors };
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleRematch = async (inv) => {
    try {
      const res = await vendorInvoiceApi.rematch(inv.id);
      message.success(res.data?.message || 'Rematched');
      load();
      if (detailOpen && detailRec?.id === inv.id) loadDetail(inv.id);
    } catch (e) { message.error(e?.response?.data?.message || 'Rematch failed'); }
  };

  const handleApprove = async (inv) => {
    try {
      await vendorInvoiceApi.approve(inv.id);
      message.success('Invoice approved');
      load();
      if (detailOpen && detailRec?.id === inv.id) loadDetail(inv.id);
    } catch (e) { message.error(e?.response?.data?.message || 'Approve failed'); }
  };

  const openDispute = (inv) => {
    setDisputeRec(inv);
    setDisputeReason('');
    setDisputeModal(true);
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) { message.error('Enter a dispute reason'); return; }
    setDisputing(true);
    try {
      await vendorInvoiceApi.dispute(disputeRec.id, { dispute_reason: disputeReason });
      message.success('Invoice marked as disputed');
      setDisputeModal(false);
      load();
      if (detailOpen && detailRec?.id === disputeRec.id) loadDetail(disputeRec.id);
    } catch (e) { message.error(e?.response?.data?.message || 'Dispute failed'); }
    finally { setDisputing(false); }
  };

  const handleMarkPaid = async (inv) => {
    try {
      await vendorInvoiceApi.markPaid(inv.id);
      message.success('Invoice marked as paid');
      load();
      if (detailOpen && detailRec?.id === inv.id) loadDetail(inv.id);
    } catch (e) { message.error(e?.response?.data?.message || 'Failed'); }
  };

  const handleCancel = async (inv) => {
    try {
      await vendorInvoiceApi.cancel(inv.id);
      message.success('Invoice cancelled');
      load();
    } catch (e) { message.error(e?.response?.data?.message || 'Cancel failed'); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Ref No', dataIndex: 'internal_ref', key: 'ref', width: 140,
      render: (v, r) => <Button type="link" style={{ padding: 0 }} onClick={() => { setDetailRec(r); setDetailOpen(true); loadDetail(r.id); }}>{v}</Button>,
    },
    {
      title: 'Invoice No', dataIndex: 'invoice_no', key: 'inv_no', width: 130, ellipsis: true,
    },
    {
      title: 'Vendor', key: 'vendor', ellipsis: true,
      render: (_, r) => r.Vendor?.name || '—',
    },
    {
      title: 'PO', key: 'po', width: 120,
      render: (_, r) => r.PurchaseOrder?.po_no || '—',
    },
    {
      title: 'Invoice Date', dataIndex: 'invoice_date', key: 'date', width: 110,
      render: v => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Due Date', dataIndex: 'due_date', key: 'due', width: 100,
      render: v => v ? dayjs(v).format('DD MMM YY') : '—',
    },
    {
      title: 'Amount', dataIndex: 'total_amount', key: 'amount', width: 120,
      render: v => <Text strong>{fmtCcy(v)}</Text>,
    },
    {
      title: 'Match', dataIndex: 'match_status', key: 'match', width: 130,
      render: v => {
        const cfg = MATCH_CONFIG[v] || { color: 'default', label: v };
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: v => {
        const cfg = STATUS_CONFIG[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Actions', key: 'actions', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space size={4} wrap>
          <Tooltip title="View Detail">
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setDetailRec(r); setDetailOpen(true); loadDetail(r.id); }} />
          </Tooltip>
          {canWrite && r.status === 'pending' && (
            <Tooltip title="Re-run Match">
              <Button size="small" icon={<SyncOutlined />} onClick={() => handleRematch(r)} />
            </Tooltip>
          )}
          {canApprove && r.status === 'pending' && (
            <>
              <Tooltip title="Approve">
                <Popconfirm title="Approve this invoice?" onConfirm={() => handleApprove(r)} okText="Approve">
                  <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#16a34a', borderColor: '#16a34a' }} />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="Dispute">
                <Button size="small" icon={<ExclamationCircleOutlined />} danger onClick={() => openDispute(r)} />
              </Tooltip>
            </>
          )}
          {canApprove && r.status === 'approved' && (
            <Tooltip title="Mark as Paid">
              <Popconfirm title="Mark invoice as paid?" onConfirm={() => handleMarkPaid(r)} okText="Mark Paid">
                <Button size="small" icon={<DollarOutlined />} style={{ color: '#1d4ed8', borderColor: '#1d4ed8' }} />
              </Popconfirm>
            </Tooltip>
          )}
          {canWrite && !['paid', 'cancelled'].includes(r.status) && (
            <Tooltip title="Cancel">
              <Popconfirm title="Cancel this invoice?" onConfirm={() => handleCancel(r)} okText="Cancel" okType="danger">
                <Button size="small" icon={<StopOutlined />} danger />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // ── 3-way match table in detail ────────────────────────────────────────────
  const matchColumns = [
    { title: 'Item',         key: 'item',    ellipsis: true,
      render: (_, r) => r.Item?.name || r.description || `Item #${r.item_id}` },
    { title: 'Ordered',      dataIndex: 'qty_ordered',   key: 'ordered',  width: 90,  render: fmtQty },
    { title: 'Received',     dataIndex: 'qty_received',  key: 'received', width: 90,  render: fmtQty },
    { title: 'Invoiced',     dataIndex: 'qty_invoiced',  key: 'invoiced', width: 90,  render: fmtQty },
    { title: 'PO Price',     dataIndex: 'po_unit_price', key: 'poprice',  width: 100, render: v => v != null ? fmtCcy(v) : '—' },
    { title: 'Inv Price',    dataIndex: 'unit_price',    key: 'invprice', width: 100, render: fmtCcy },
    { title: 'Amount',       dataIndex: 'amount',        key: 'amount',   width: 110, render: fmtCcy },
    {
      title: 'Match',        dataIndex: 'match_flag',    key: 'flag',     width: 130,
      render: v => {
        const cfg = MATCH_FLAG_CONFIG[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ padding: '24px 24px 0' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Vendor Invoices</Text>
        </div>

        <Title level={3} style={{ margin: 0 }}>Vendor Invoices</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Record vendor invoices, run three-way matching (PO ↔ GRN ↔ Invoice), and approve for payment.
        </Text>

        {/* KPI chips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Tag color="blue">Total Value: {fmtCcy(totalValue)}</Tag>
          <Tag color="gold">Pending: {totalPending}</Tag>
          <Tag color="red">Disputed: {totalDisp}</Tag>
          <Tag color="green">Approved: {totalApproved}</Tag>
          {mismatched > 0 && <Tag color="orange">Partial Match: {mismatched}</Tag>}
        </div>

        {/* Main table */}
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          styles={{ body: { padding: '16px 20px' } }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search ref / invoice no / vendor / PO..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 300, borderRadius: 8 }}
              allowClear
            />
            <Select
              placeholder="Status"
              value={statusFil || undefined}
              onChange={v => setStatusFil(v || '')}
              allowClear style={{ width: 120 }}
              options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
            <Select
              placeholder="Match"
              value={matchFil || undefined}
              onChange={v => setMatchFil(v || '')}
              allowClear style={{ width: 150 }}
              options={Object.entries(MATCH_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            />
            <div style={{ flex: 1 }} />
            <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('vendor-invoices.csv', filtered, columns)}>Export CSV</Button>
            {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)}>Upload CSV</Button>}
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                New Invoice
              </Button>
            )}
          </div>

          <ResponsiveTable
            columns={columns}
            dataSource={filtered}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 15, showSizeChanger: false, showTotal: t => `${t} invoices` }}
          />
        </Card>
      </div>

      {/* ── Create Invoice Drawer ────────────────────────────────────────── */}
      <Drawer
        title="New Vendor Invoice"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={700}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              Create & Match
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="invoice_no" label="Vendor Invoice No" rules={[{ required: true }]}>
                <Input placeholder="e.g. INV-2024-001" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="po_id" label="Against Purchase Order" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Select PO..."
                  options={poOptions}
                  filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="due_date" label="Due Date">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="tax_amount" label="Tax / GST Amount (₹)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="grn_id" label="Link to GRN (optional)">
                <Input placeholder="GRN UUID..." />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Internal notes..." />
          </Form.Item>

          <Divider orientation="left" style={{ margin: '8px 0 12px' }}>Invoice Line Items</Divider>

          {lineItems.map((line) => (
            <div key={line._key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <Input
                placeholder="Description"
                value={line.description}
                onChange={e => updateLine(line._key, 'description', e.target.value)}
                style={{ flex: 2 }}
              />
              <InputNumber
                placeholder="Qty"
                value={line.qty_invoiced}
                onChange={v => updateLine(line._key, 'qty_invoiced', v)}
                min={0.001} precision={3}
                style={{ width: 90 }}
              />
              <InputNumber
                placeholder="Unit Price"
                value={line.unit_price}
                onChange={v => updateLine(line._key, 'unit_price', v)}
                min={0} precision={2}
                style={{ width: 110 }}
                prefix="₹"
              />
              <Text style={{ lineHeight: '32px', fontSize: 12, minWidth: 80, textAlign: 'right' }}>
                {fmtCcy((line.qty_invoiced || 0) * (line.unit_price || 0))}
              </Text>
              <Button icon={<CloseCircleOutlined />} danger size="small"
                onClick={() => removeLine(line._key)}
                disabled={lineItems.length === 1} style={{ marginTop: 4 }} />
            </div>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} block>Add Line</Button>

          <div style={{ textAlign: 'right', marginTop: 10 }}>
            <Text strong>Sub-total: {fmtCcy(lineTotal)}</Text>
          </div>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={
          detailRec
            ? <Space>
                <Text strong>{detailRec.internal_ref}</Text>
                <Tag color={STATUS_CONFIG[detailRec.status]?.color}>{STATUS_CONFIG[detailRec.status]?.label}</Tag>
                <Tag color={MATCH_CONFIG[detailRec.match_status]?.color} icon={MATCH_CONFIG[detailRec.match_status]?.icon}>
                  {MATCH_CONFIG[detailRec.match_status]?.label}
                </Tag>
              </Space>
            : 'Invoice Detail'
        }
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={860}
        loading={detailLoading}
        extra={
          detailRec && (
            <Space>
              {canWrite && detailRec.status === 'pending' && (
                <Button icon={<SyncOutlined />} onClick={() => handleRematch(detailRec)}>Re-match</Button>
              )}
              {canApprove && detailRec.status === 'pending' && (
                <>
                  <Popconfirm title="Approve invoice?" onConfirm={() => handleApprove(detailRec)} okText="Approve">
                    <Button icon={<CheckCircleOutlined />} style={{ color: '#16a34a', borderColor: '#16a34a' }}>Approve</Button>
                  </Popconfirm>
                  <Button icon={<ExclamationCircleOutlined />} danger onClick={() => openDispute(detailRec)}>Dispute</Button>
                </>
              )}
              {canApprove && detailRec.status === 'approved' && (
                <Popconfirm title="Mark as paid?" onConfirm={() => handleMarkPaid(detailRec)} okText="Mark Paid">
                  <Button icon={<DollarOutlined />} type="primary">Mark Paid</Button>
                </Popconfirm>
              )}
            </Space>
          )
        }
      >
        {detailRec && (
          <>
            {detailRec.status === 'disputed' && detailRec.dispute_reason && (
              <Alert type="error" showIcon message="Dispute Reason" description={detailRec.dispute_reason} style={{ marginBottom: 16 }} />
            )}
            {detailRec.match_status === 'partial_match' && (
              <Alert type="warning" showIcon message="Partial Match — some line items have quantity or price discrepancies. Review before approving." style={{ marginBottom: 16 }} />
            )}
            {detailRec.match_status === 'matched' && detailRec.status === 'pending' && (
              <Alert type="success" showIcon message="Three-way match passed — invoice amounts align with PO and GRN." style={{ marginBottom: 16 }} />
            )}

            {/* Summary cards */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={6}><Statistic title="Invoice Amount" value={fmtCcy(detailRec.invoice_amount)} valueStyle={{ fontSize: 16 }} /></Col>
              <Col span={6}><Statistic title="Tax/GST" value={fmtCcy(detailRec.tax_amount)} valueStyle={{ fontSize: 16 }} /></Col>
              <Col span={6}><Statistic title="Total Amount" value={fmtCcy(detailRec.total_amount)} valueStyle={{ fontSize: 16, color: '#1d4ed8', fontWeight: 700 }} /></Col>
              <Col span={6}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Due Date</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>
                  {detailRec.due_date ? dayjs(detailRec.due_date).format('DD MMM YYYY') : '—'}
                </div>
              </Col>
            </Row>

            <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Invoice No">{detailRec.invoice_no}</Descriptions.Item>
              <Descriptions.Item label="Internal Ref">{detailRec.internal_ref}</Descriptions.Item>
              <Descriptions.Item label="Vendor">{detailRec.Vendor?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="PO">{detailRec.PurchaseOrder?.po_no || '—'}</Descriptions.Item>
              <Descriptions.Item label="GRN">{detailRec.GRN?.grn_no || '—'}</Descriptions.Item>
              <Descriptions.Item label="Invoice Date">{dayjs(detailRec.invoice_date).format('DD MMM YYYY')}</Descriptions.Item>
              {detailRec.Approver && (
                <Descriptions.Item label="Approved By">{detailRec.Approver.name}</Descriptions.Item>
              )}
              {detailRec.approved_at && (
                <Descriptions.Item label="Approved On">{dayjs(detailRec.approved_at).format('DD MMM YYYY')}</Descriptions.Item>
              )}
              {detailRec.paid_at && (
                <Descriptions.Item label="Paid On" span={2}>{dayjs(detailRec.paid_at).format('DD MMM YYYY HH:mm')}</Descriptions.Item>
              )}
              {detailRec.notes && (
                <Descriptions.Item label="Notes" span={2}>{detailRec.notes}</Descriptions.Item>
              )}
            </Descriptions>

            {/* Three-way match table */}
            <Divider orientation="left" style={{ margin: '8px 0 12px' }}>
              Three-Way Match — Line Items
            </Divider>
            <Table
              size="small"
              dataSource={detailRec.Items || []}
              rowKey="id"
              pagination={false}
              columns={matchColumns}
              scroll={{ x: 'max-content' }}
              rowClassName={(r) =>
                r.match_flag === 'both_mismatch' ? 'ant-table-row-danger'
                : ['qty_mismatch', 'price_mismatch'].includes(r.match_flag) ? 'ant-table-row-warning'
                : ''
              }
              summary={(items) => {
                const total = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={6}><Text strong>Total</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={6}><Text strong>{fmtCcy(total)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={7} />
                  </Table.Summary.Row>
                );
              }}
            />
          </>
        )}
      </Drawer>

      {/* ── Dispute Modal ────────────────────────────────────────────────── */}
      <Modal
        title={`Dispute Invoice — ${disputeRec?.internal_ref || ''}`}
        open={disputeModal}
        onCancel={() => setDisputeModal(false)}
        onOk={handleDispute}
        okText="Mark as Disputed"
        okButtonProps={{ danger: true }}
        confirmLoading={disputing}
      >
        <Alert type="warning" showIcon message="The invoice will be flagged for review and the vendor will need to resubmit." style={{ marginBottom: 16 }} />
        <Input.TextArea
          rows={4}
          placeholder="Describe the reason for dispute (e.g. quantity delivered differs, pricing doesn't match PO)..."
          value={disputeReason}
          onChange={e => setDisputeReason(e.target.value)}
        />
      </Modal>
      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Vendor Invoices"
        entityName="Vendor Invoice"
        sampleHeaders={VINV_CSV_HEADERS}
        sampleRows={VINV_CSV_SAMPLE}
        validationRules={VINV_CSV_VALIDATION}
      />
    </AppLayout>
  );
}
