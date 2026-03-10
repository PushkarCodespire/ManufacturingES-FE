import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Button, Input, Table, Tag, Space, Drawer, Form, Select, DatePicker, InputNumber, Divider, message, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import { debitCreditNoteApi } from '../../../api/accounts.api';
import { vendorApi } from '../../../api/vendor.api';

const { Title, Text } = Typography;

const TYPE_OPTIONS   = [{ value: 'debit', label: 'Debit Note' }, { value: 'credit', label: 'Credit Note' }];
const STATUS_OPTIONS = [{ value: 'draft', label: 'Draft' }, { value: 'approved', label: 'Approved' }, { value: 'synced', label: 'Synced' }];
const REF_TYPES      = [{ value: 'iqc_rejection', label: 'IQC Rejection' }, { value: 'customer_return', label: 'Customer Return' }, { value: 'manual', label: 'Manual' }];

const statusColor = (s) => ({ draft: 'default', approved: 'blue', synced: 'green', cancelled: 'red' }[s] || 'default');
const typeColor   = (t) => t === 'debit' ? 'volcano' : 'cyan';

const DebitCreditNotesPage = () => {
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
  const noteType = Form.useWatch('type', form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (typeFilter)   params.type   = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await debitCreditNoteApi.getAll(params);
      setRows(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { message.error('Failed to load notes'); }
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

  const openAdd = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ note_date: dayjs(), type: 'debit' }); setDrawerOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      type:        r.type,
      vendor_id:   r.vendor_id,
      customer_id: r.customer_id,
      ref_type:    r.ref_type,
      note_date:   r.note_date ? dayjs(r.note_date) : null,
      amount:      r.amount,
      gst_amount:  r.gst_amount,
      total_amount:r.total_amount,
      reason:      r.reason,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        type:         vals.type,
        vendor_id:    vals.type === 'debit'  ? vals.vendor_id   : null,
        customer_id:  vals.type === 'credit' ? vals.customer_id : null,
        ref_type:     vals.ref_type || null,
        note_date:    vals.note_date?.format('YYYY-MM-DD'),
        amount:       vals.amount || 0,
        gst_amount:   vals.gst_amount || 0,
        total_amount: vals.total_amount || 0,
        reason:       vals.reason || '',
      };
      if (editing) { await debitCreditNoteApi.update(editing.id, payload); message.success('Note updated'); }
      else         { await debitCreditNoteApi.create(payload); message.success('Note created'); }
      setDrawerOpen(false); load();
    } catch (err) { if (err?.errorFields) return; message.error(err?.message || err?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const onApprove = async (id) => {
    try { await debitCreditNoteApi.approve(id); message.success('Note approved'); load(); }
    catch (err) { message.error(err?.message || 'Approve failed'); }
  };
  const onDelete = async (id) => {
    try { await debitCreditNoteApi.delete(id); message.success('Note deleted'); load(); }
    catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  const columns = [
    { title: 'Note No', dataIndex: 'note_no', key: 'note_no', width: 150,
      render: (v, r) => <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>{v}</Text>,
    },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 110,
      render: (t) => <Tag color={typeColor(t)}>{t === 'debit' ? 'DEBIT' : 'CREDIT'}</Tag>,
    },
    { title: 'Date', dataIndex: 'note_date', key: 'note_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    { title: 'Vendor / Customer', key: 'party', width: 200,
      render: (_, r) => {
        const party = r.type === 'debit' ? r.Vendor : r.Customer;
        return party ? <Text style={{ fontSize: 13 }}>{party.name}</Text> : <Text type="secondary">—</Text>;
      },
    },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 110, align: 'right',
      render: (v) => v ? `₹${parseFloat(v).toLocaleString('en-IN')}` : '—',
    },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 120, align: 'right',
      render: (v) => <Text strong>{v ? `₹${parseFloat(v).toLocaleString('en-IN')}` : '—'}</Text>,
    },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => <Tag color={statusColor(s)}>{s?.toUpperCase()}</Tag>,
    },
    { title: 'Actions', key: 'actions', width: 130,
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'draft' && <Popconfirm title="Approve?" onConfirm={() => onApprove(r.id)} okText="Approve"><Button size="small" type="primary" ghost icon={<CheckCircleOutlined />} /></Popconfirm>}
          {r.status === 'draft' && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />}
          {r.status === 'draft' && <Popconfirm title="Delete?" onConfirm={() => onDelete(r.id)} okType="danger"><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Accounts</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Debit/Credit Notes</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Debit / Credit Notes</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Debit notes for supplier IQC rejections. Credit notes for customer returns.</Text>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {rows.length}</Tag>
        <Tag color="volcano">Debit: {rows.filter((r) => r.type === 'debit').length}</Tag>
        <Tag color="cyan">Credit: {rows.filter((r) => r.type === 'credit').length}</Tag>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input placeholder="Search note no, reason..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240, borderRadius: 8 }} allowClear />
          <Select placeholder="Type" allowClear value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} style={{ width: 130 }} />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} style={{ width: 130 }} />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Note</Button>
        </div>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} size="small" scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }} />
      </Card>

      <Drawer title={editing ? `Edit — ${editing.note_no}` : 'New Debit / Credit Note'} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={580}
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={onSave}>{editing ? 'Update' : 'Create'}</Button>
        </div>}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Note Type" rules={[{ required: true }]}>
                <Select options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="note_date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          {noteType === 'debit' && (
            <Form.Item name="vendor_id" label="Supplier" rules={[{ required: true, message: 'Select supplier' }]}>
              <Select showSearch optionFilterProp="label" placeholder="Select supplier"
                options={vendors.map((v) => ({ value: v.id, label: `${v.name} (${v.partner_code})` }))} />
            </Form.Item>
          )}
          {noteType === 'credit' && (
            <Form.Item name="customer_id" label="Customer" rules={[{ required: true, message: 'Select customer' }]}>
              <Select showSearch optionFilterProp="label" placeholder="Select customer"
                options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.partner_code})` }))} />
            </Form.Item>
          )}
          <Form.Item name="ref_type" label="Reference Type">
            <Select allowClear placeholder="Select reference" options={REF_TYPES} />
          </Form.Item>
          <Divider style={{ margin: '12px 0' }}>Amounts</Divider>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item></Col>
            <Col span={8}><Form.Item name="gst_amount" label="GST (₹)"><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item></Col>
            <Col span={8}><Form.Item name="total_amount" label="Total (₹)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item></Col>
          </Row>
          <Form.Item name="reason" label="Reason"><Input.TextArea rows={3} placeholder="Reason for this note..." /></Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
};

export default DebitCreditNotesPage;
