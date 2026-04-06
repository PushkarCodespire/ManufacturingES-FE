import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Button, Input, Table, Tag, Space, Drawer, Form, Select, DatePicker, InputNumber, Divider, message, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, RightOutlined, DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import { salesInvoiceApi } from '../../../api/accounts.api';
import { vendorApi } from '../../../api/vendor.api';
import { customerOrderApi } from '../../../api/orders.api';
import { dispatchOrderApi } from '../../../api/dispatchOrder.api';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

// ── CSV Upload config ────────────────────────────────────────────────────────
const INV_CSV_HEADERS = ['Customer Name', 'Invoice Date', 'Due Date', 'Subtotal', 'GST Amount', 'Total Amount', 'Notes'];
const INV_CSV_SAMPLE = [
  { 'Customer Name': 'XYZ Corp', 'Invoice Date': '2025-06-15', 'Due Date': '2025-07-15', 'Subtotal': '50000', 'GST Amount': '9000', 'Total Amount': '59000', 'Notes': '' },
];
const INV_CSV_VALIDATION = [
  { field: 'Customer Name', required: true },
  { field: 'Subtotal', required: true },
];

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: 'draft',     label: 'Draft' },
  { value: 'approved',  label: 'Approved' },
  { value: 'synced',    label: 'Synced' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusColor = (s) => ({ draft: 'default', approved: 'blue', synced: 'green', cancelled: 'red' }[s] || 'default');
const syncColor   = (s) => ({ pending: 'orange', synced: 'green', error: 'red' }[s] || 'default');

const SalesInvoicesPage = () => {
  const [rows, setRows]             = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [orders, setOrders]         = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form] = Form.useForm();
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await salesInvoiceApi.getAll(params);
      setRows(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load invoices'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    vendorApi.getAll({ type: 'customer', limit: 500 }).catch(() => []).then((v) => {
      const arr = Array.isArray(v) ? v : (v?.data ?? []);
      setCustomers(arr);
    });
    customerOrderApi.getAll({ limit: 500 }).catch(() => []).then((v) => {
      const arr = Array.isArray(v) ? v : (v?.data ?? []);
      setOrders(arr);
    });
    dispatchOrderApi.getAll({ limit: 500 }).catch(() => []).then((v) => {
      const arr = Array.isArray(v) ? v : (v?.data ?? []);
      setDispatches(arr);
    });
  }, []);

  const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ invoice_date: dayjs() }); setDrawerOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      customer_id:       r.customer_id,
      customer_order_id: r.customer_order_id,
      dispatch_order_id: r.dispatch_order_id,
      invoice_date:      r.invoice_date ? dayjs(r.invoice_date) : null,
      due_date:          r.due_date ? dayjs(r.due_date) : null,
      subtotal:          r.subtotal,
      gst_amount:        r.gst_amount,
      total_amount:      r.total_amount,
      notes:             r.notes,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        customer_id:       vals.customer_id,
        customer_order_id: vals.customer_order_id || null,
        dispatch_order_id: vals.dispatch_order_id || null,
        invoice_date:      vals.invoice_date?.format('YYYY-MM-DD'),
        due_date:          vals.due_date?.format('YYYY-MM-DD') || null,
        subtotal:          vals.subtotal || 0,
        gst_amount:        vals.gst_amount || 0,
        total_amount:      vals.total_amount || 0,
        notes:             vals.notes || '',
      };
      if (editing) { await salesInvoiceApi.update(editing.id, payload); message.success('Invoice updated'); }
      else         { await salesInvoiceApi.create(payload); message.success('Invoice created'); }
      setDrawerOpen(false); load();
    } catch (err) { if (err?.errorFields) return; message.error(err?.message || err?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const onApprove = async (id) => {
    try { await salesInvoiceApi.approve(id); message.success('Invoice approved'); load(); }
    catch (err) { message.error(err?.message || 'Approve failed'); }
  };
  const onDelete = async (id) => {
    try { await salesInvoiceApi.delete(id); message.success('Invoice deleted'); load(); }
    catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const cust = row['Customer Name'] ? customers.find((c) => c.name?.toLowerCase() === row['Customer Name'].toLowerCase()) : null;
        await salesInvoiceApi.create({
          customer_id:   cust?.id || null,
          invoice_date:  row['Invoice Date'] || null,
          due_date:      row['Due Date'] || null,
          subtotal:      parseFloat(row['Subtotal']) || 0,
          gst_amount:    parseFloat(row['GST Amount']) || 0,
          total_amount:  parseFloat(row['Total Amount']) || 0,
          notes:         row['Notes'] || '',
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Customer Name'] || ''}": ${err?.message || 'Failed'}`);
      }
    }
    load();
    return { success, failed, errors };
  };

  const total    = rows.length;
  const drafts   = rows.filter((r) => r.status === 'draft').length;
  const approved = rows.filter((r) => r.status === 'approved').length;

  const columns = [
    { title: 'Invoice No', dataIndex: 'invoice_no', key: 'invoice_no', width: 150,
      render: (v, r) => <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>{v}</Text>,
    },
    { title: 'Date', dataIndex: 'invoice_date', key: 'invoice_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    { title: 'Customer', key: 'customer', width: 200,
      render: (_, r) => r.Customer ? <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Customer.name}</Text> : <Text type="secondary">—</Text>,
    },
    { title: 'Order', key: 'order', width: 130,
      render: (_, r) => r.CustomerOrder ? <Text style={{ fontSize: 12 }}>{r.CustomerOrder.order_no}</Text> : '—',
    },
    { title: 'Subtotal', dataIndex: 'subtotal', key: 'subtotal', width: 110, align: 'right',
      render: (v) => v ? `₹${parseFloat(v).toLocaleString('en-IN')}` : '—',
    },
    { title: 'GST', dataIndex: 'gst_amount', key: 'gst_amount', width: 100, align: 'right',
      render: (v) => v ? `₹${parseFloat(v).toLocaleString('en-IN')}` : '—',
    },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 120, align: 'right',
      render: (v) => <Text strong>{v ? `₹${parseFloat(v).toLocaleString('en-IN')}` : '—'}</Text>,
    },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => <Tag color={statusColor(s)}>{s?.toUpperCase()}</Tag>,
    },
    { title: 'Tally', dataIndex: 'tally_sync_status', key: 'tally', width: 90,
      render: (s) => <Tag color={syncColor(s)}>{s}</Tag>,
    },
    { title: 'Actions', key: 'actions', width: 130,
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'draft' && (
            <Popconfirm title="Approve this invoice?" onConfirm={() => onApprove(r.id)} okText="Approve">
              <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />} />
            </Popconfirm>
          )}
          {r.status === 'draft' && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />}
          {r.status === 'draft' && (
            <Popconfirm title="Delete?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Accounts</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Sales Invoices</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Sales Invoices</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Generate and manage customer invoices from dispatches. Auto-sync to Tally.</Text>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="default">Drafts: {drafts}</Tag>
        <Tag color="green">Approved: {approved}</Tag>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input placeholder="Search invoice no..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260, borderRadius: 8 }} allowClear />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} style={{ width: 140 }} />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('sales-invoices.csv', rows, columns)}>Export CSV</Button>
          <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Invoice</Button>
        </div>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} size="small" scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }} />
      </Card>

      <Drawer title={editing ? `Edit Invoice — ${editing.invoice_no}` : 'New Sales Invoice'} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={640}
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={onSave}>{editing ? 'Update' : 'Create'}</Button>
        </div>}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customer_id" label="Customer" rules={[{ required: true, message: 'Select customer' }]}>
                <Select showSearch optionFilterProp="label" placeholder="Select customer"
                  options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.partner_code})` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="due_date" label="Due Date"><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item></Col>
            <Col span={12}>
              <Form.Item name="customer_order_id" label="Customer Order">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select order"
                  options={orders.map((o) => ({ value: o.id, label: `${o.order_no}${o.customer_po_no ? ` — PO: ${o.customer_po_no}` : ''}` }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dispatch_order_id" label="Dispatch Order">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select dispatch"
                  options={dispatches.map((d) => ({ value: d.id, label: d.order_number || `Dispatch #${d.id}` }))} />
              </Form.Item>
            </Col>
            <Col span={12} />
          </Row>
          <Divider style={{ margin: '12px 0' }}>Amounts</Divider>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="subtotal" label="Subtotal (₹)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item></Col>
            <Col span={8}><Form.Item name="gst_amount" label="GST (₹)"><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item></Col>
            <Col span={8}><Form.Item name="total_amount" label="Total (₹)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item></Col>
          </Row>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} placeholder="Any additional notes..." /></Form.Item>
        </Form>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Sales Invoices"
        entityName="Invoice"
        sampleHeaders={INV_CSV_HEADERS}
        sampleRows={INV_CSV_SAMPLE}
        validationRules={INV_CSV_VALIDATION}
      />
    </AppLayout>
  );
};

export default SalesInvoicesPage;
