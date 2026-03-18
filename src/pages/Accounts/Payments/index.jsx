import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Button, Input, Table, Tag, Space, Drawer, Form, Select, DatePicker, InputNumber, message, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import { paymentApi } from '../../../api/accounts.api';
import { vendorApi } from '../../../api/vendor.api';

const { Title, Text } = Typography;

const TYPE_OPTIONS   = [{ value: 'payable', label: 'Payable (Supplier)' }, { value: 'receivable', label: 'Receivable (Customer)' }];
const STATUS_OPTIONS = [{ value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }];
const MODE_OPTIONS   = [{ value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }];

const statusColor = (s) => ({ pending: 'orange', completed: 'green', cancelled: 'red' }[s] || 'default');
const typeColor   = (t) => t === 'payable' ? 'red' : 'green';

const PaymentsPage = () => {
  const [rows, setRows]             = useState([]);
  const [vendors, setVendors]       = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form] = Form.useForm();
  const payType = Form.useWatch('type', form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (typeFilter)   params.type   = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await paymentApi.getAll(params);
      setRows(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load payments'); }
    finally { setLoading(false); }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      vendorApi.getAll({ type: 'vendor', limit: 500 }).catch(() => []),
      vendorApi.getAll({ type: 'customer', limit: 500 }).catch(() => []),
    ]).then(([v, c]) => {
      setVendors(Array.isArray(v) ? v : (v?.data ?? []));
      setCustomers(Array.isArray(c) ? c : (c?.data ?? []));
    });
  }, []);
  const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ payment_date: dayjs(), type: 'payable' }); setDrawerOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      type:         r.type,
      vendor_id:    r.vendor_id,
      customer_id:  r.customer_id,
      ref_no:       r.ref_no,
      amount:       r.amount,
      payment_date: r.payment_date ? dayjs(r.payment_date) : null,
      payment_mode: r.payment_mode,
      reference:    r.reference,
      notes:        r.notes,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        type:         vals.type,
        vendor_id:    vals.type === 'payable'    ? vals.vendor_id   : null,
        customer_id:  vals.type === 'receivable' ? vals.customer_id : null,
        ref_no:       vals.ref_no || null,
        amount:       vals.amount || 0,
        payment_date: vals.payment_date?.format('YYYY-MM-DD'),
        payment_mode: vals.payment_mode || null,
        reference:    vals.reference || null,
        notes:        vals.notes || '',
      };
      if (editing) { await paymentApi.update(editing.id, payload); message.success('Payment updated'); }
      else         { await paymentApi.create(payload); message.success('Payment created'); }
      setDrawerOpen(false); load();
    } catch (err) { if (err?.errorFields) return; message.error(err?.message || err?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try { await paymentApi.delete(id); message.success('Payment deleted'); load(); }
    catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  const totalPayable   = rows.filter((r) => r.type === 'payable').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const totalReceivable = rows.filter((r) => r.type === 'receivable').reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const columns = [
    { title: 'Payment No', dataIndex: 'payment_no', key: 'payment_no', width: 150,
      render: (v, r) => <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>{v}</Text>,
    },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 120,
      render: (t) => <Tag color={typeColor(t)}>{t === 'payable' ? 'PAYABLE' : 'RECEIVABLE'}</Tag>,
    },
    { title: 'Date', dataIndex: 'payment_date', key: 'payment_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    { title: 'Vendor / Customer', key: 'party', width: 200,
      render: (_, r) => {
        const party = r.type === 'payable' ? r.Vendor : r.Customer;
        return party ? <Text style={{ fontSize: 13 }}>{party.name}</Text> : <Text type="secondary">—</Text>;
      },
    },
    { title: 'Ref No', dataIndex: 'ref_no', key: 'ref_no', width: 130, render: (v) => v || '—' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 120, align: 'right',
      render: (v) => <Text strong>{v ? `₹${parseFloat(v).toLocaleString('en-IN')}` : '—'}</Text>,
    },
    { title: 'Mode', dataIndex: 'payment_mode', key: 'mode', width: 120,
      render: (m) => m ? <Tag>{m.replace('_', ' ').toUpperCase()}</Tag> : '—',
    },
    { title: 'Reference', dataIndex: 'reference', key: 'reference', width: 140, ellipsis: true, render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => <Tag color={statusColor(s)}>{s?.toUpperCase()}</Tag>,
    },
    { title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'pending' && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />}
          {r.status === 'pending' && (
            <Popconfirm title="Delete?" onConfirm={() => onDelete(r.id)} okType="danger">
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
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Payments</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Payment Tracking</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Track supplier payments (payable) and customer receivables.</Text>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {rows.length}</Tag>
        <Tag color="red">Payable: ₹{totalPayable.toLocaleString('en-IN')}</Tag>
        <Tag color="green">Receivable: ₹{totalReceivable.toLocaleString('en-IN')}</Tag>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input placeholder="Search payment, ref..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240, borderRadius: 8 }} allowClear />
          <Select placeholder="Type" allowClear value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} style={{ width: 160 }} />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} style={{ width: 130 }} />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Payment</Button>
        </div>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} size="small" scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }} />
      </Card>
      <Drawer title={editing ? `Edit — ${editing.payment_no}` : 'New Payment'} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={580}
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={onSave}>{editing ? 'Update' : 'Create'}</Button>
        </div>}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Payment Type" rules={[{ required: true }]}>
                <Select options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          {payType === 'payable' && (
            <Form.Item name="vendor_id" label="Supplier" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" placeholder="Select supplier"
                options={vendors.map((v) => ({ value: v.id, label: `${v.name} (${v.partner_code})` }))} />
            </Form.Item>
          )}
          {payType === 'receivable' && (
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" placeholder="Select customer"
                options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.partner_code})` }))} />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}><Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item></Col>
            <Col span={12}><Form.Item name="payment_mode" label="Payment Mode"><Select allowClear placeholder="Select mode" options={MODE_OPTIONS} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="ref_no" label="Reference Document"><Input placeholder="PO No / Invoice No" /></Form.Item></Col>
            <Col span={12}><Form.Item name="reference" label="Txn Reference"><Input placeholder="Cheque no / UTR / Txn ID" /></Form.Item></Col>
          </Row>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} placeholder="Notes..." /></Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
};

export default PaymentsPage;
