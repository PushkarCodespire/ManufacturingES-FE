import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  PlusCircleOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { quotationApi, rfqApi } from '../../../api/orders.api';
import { vendorApi }    from '../../../api/vendor.api';
import { itemApi }      from '../../../api/item.api';
import aiApi            from '../../../api/ai.api';
import useAiSuggestion  from '../../../hooks/useAiSuggestion';
import AiSuggestionCard from '../../../components/AiSuggestion/AiSuggestionCard';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  draft:    { color: 'default', label: 'Draft'    },
  sent:     { color: 'blue',    label: 'Sent'     },
  accepted: { color: 'green',   label: 'Accepted' },
  rejected: { color: 'red',     label: 'Rejected' },
  revised:  { color: 'orange',  label: 'Revised'  },
};
const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

const emptyItem = () => ({
  _key: Date.now() + Math.random(),
  item_id: null, description: '', qty: 1, unit: 'pcs',
  unit_price: 0, discount: 0, gst_rate: 18, total_price: 0,
});

const calcTotal = (qty, price, disc) =>
  parseFloat(((qty || 0) * (price || 0) * (1 - (disc || 0) / 100)).toFixed(2));

export default function QuotationPage() {
  const { can } = usePermissions();
  const canWrite = can('plan-orders-quotation-create_edit_delete');

  const [quotations,   setQuotations]   = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [items,        setItemsList]    = useState([]);
  const [rfqs,         setRfqs]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [lineItems,    setLineItems]    = useState([emptyItem()]);

  const [form] = Form.useForm();
  const [priceHint, setPriceHint] = useState(null);
  const aiPrice = useAiSuggestion(aiApi.suggestPrice);

  const handlePriceSuggest = async (itemId, idx) => {
    if (!itemId) return;
    const customerId = form.getFieldValue('customer_id');
    aiPrice.fetch({ item_id: itemId, customer_id: customerId });
  };

  // Show price hint when AI returns
  useEffect(() => {
    if (aiPrice.data?.data?.suggested_price != null) {
      setPriceHint(aiPrice.data.data);
    }
  }, [aiPrice.data]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await quotationApi.getAll(params);
      setQuotations(data);
    } catch { message.error('Failed to load quotations'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      vendorApi.getAll({ type: 'customer', limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => []),
      rfqApi.getAll({ status: 'open', limit: 200 }).catch(() => []),
    ]).then(([c, i, r]) => {
      setCustomers(Array.isArray(c) ? c : (c?.data ?? []));
      setItemsList(Array.isArray(i) ? i : (i?.data ?? []));
      setRfqs(Array.isArray(r) ? r : (r?.data ?? []));
    });
  }, []);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ quotation_date: dayjs(), valid_till: dayjs().add(30, 'day') });
    setLineItems([emptyItem()]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      customer_id:    record.customer_id,
      rfq_id:         record.rfq_id,
      quotation_date: dayjs(record.quotation_date),
      valid_till:     record.valid_till ? dayjs(record.valid_till) : null,
      terms:          record.terms,
      notes:          record.notes,
      status:         record.status,
    });
    setLineItems((record.Items || []).map((it) => ({
      _key:        it.id,
      item_id:     it.item_id,
      description: it.description || '',
      qty:         parseFloat(it.qty) || 1,
      unit:        it.unit || 'pcs',
      unit_price:  parseFloat(it.unit_price) || 0,
      discount:    parseFloat(it.discount) || 0,
      gst_rate:    parseFloat(it.gst_rate) || 18,
      total_price: parseFloat(it.total_price) || 0,
    })));
    setDrawerOpen(true);
  };

  const grandTotal = lineItems.reduce((s, r) => s + calcTotal(r.qty, r.unit_price, r.discount), 0);

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        customer_id:    vals.customer_id,
        rfq_id:         vals.rfq_id || null,
        quotation_date: vals.quotation_date.format('YYYY-MM-DD'),
        valid_till:     vals.valid_till ? vals.valid_till.format('YYYY-MM-DD') : null,
        terms:          vals.terms || '',
        notes:          vals.notes || '',
        ...(editing && { status: vals.status }),
        items: lineItems.map(({ _key, ...it }) => ({
          ...it,
          total_price: calcTotal(it.qty, it.unit_price, it.discount),
        })),
      };
      if (editing) {
        await quotationApi.update(editing.id, payload);
        message.success('Quotation updated');
      } else {
        await quotationApi.create(payload);
        message.success('Quotation created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await quotationApi.delete(id);
      message.success('Quotation deleted');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Delete failed'); }
  };

  const addLine = () => setLineItems((p) => [...p, emptyItem()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));
  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  // When RFQ selected, auto-populate customer + line items
  const onRfqSelect = (rfqId) => {
    if (!rfqId) return;
    const found = rfqs.find((r) => r.id === rfqId);
    if (found) {
      form.setFieldsValue({ customer_id: found.customer_id });
      if (found.Items?.length) {
        setLineItems(found.Items.map((it) => ({
          _key:        Date.now() + Math.random(),
          item_id:     it.item_id,
          description: it.description || it.Item?.name || '',
          qty:         parseFloat(it.qty) || 1,
          unit:        it.unit || 'pcs',
          unit_price:  parseFloat(it.target_price) || 0,
          discount:    0,
          gst_rate:    parseFloat(it.Item?.gst_rate) || 18,
          total_price: 0,
        })));
      }
    }
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
      title: 'Quotation No',
      dataIndex: 'quotation_no',
      key: 'quotation_no',
      width: 150,
      render: (no, r) => (
        <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>
          {no}
        </Text>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'quotation_date',
      key: 'date',
      width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 200,
      render: (_, r) => r.Customer ? (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Customer.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Customer.partner_code}</Text>
        </div>
      ) : '—',
    },
    {
      title: 'Against RFQ',
      key: 'rfq',
      width: 130,
      render: (_, r) => r.Rfq ?
        <Tag color="purple">{r.Rfq.rfq_no}</Tag> :
        <Text type="secondary" style={{ fontSize: 12 }}>Direct</Text>,
    },
    {
      title: 'Valid Till',
      dataIndex: 'valid_till',
      key: 'valid_till',
      width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
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
      title: 'Total (₹)',
      dataIndex: 'total_amount',
      key: 'total',
      width: 120,
      align: 'right',
      render: (v) => v ? <Text strong>₹{parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    ...(canWrite ? [{
      title: 'Actions',
      key: 'actions',
      width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          {r.status !== 'accepted' && (
            <Popconfirm title="Delete this quotation?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
              <Tooltip title="Delete"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Orders</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Quotation</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Quotations</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Prepare and send quotations to customers. Track acceptance and convert to customer orders.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {quotations.length}</Tag>
        <Tag color="green">Accepted: {quotations.filter((q) => q.status === 'accepted').length}</Tag>
        <Tag color="processing">Sent: {quotations.filter((q) => q.status === 'sent').length}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search quotation no…"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Quotation</Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={quotations}
          size="small"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Drawer ──────────────────────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit — ${editing.quotation_no}` : 'New Quotation'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={800}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Grand Total: ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
              {canWrite && (
                <Button type="primary" loading={saving} onClick={onSave}>
                  {editing ? 'Update' : 'Create Quotation'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
                <Select
                  showSearch optionFilterProp="label" placeholder="Select customer"
                  options={customers.map((c) => ({ value: c.id, label: `${c.name} (${c.partner_code})` }))}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="rfq_id" label="Against RFQ (optional)">
                <Select
                  showSearch allowClear optionFilterProp="label" placeholder="Link to RFQ"
                  onChange={onRfqSelect}
                  options={rfqs.map((r) => ({ value: r.id, label: `${r.rfq_no} — ${r.Customer?.name || ''}` }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="quotation_date" label="Quotation Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="valid_till" label="Valid Till">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          {editing && (
            <Form.Item name="status" label="Status">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          )}
          <Form.Item name="terms" label="Terms & Conditions">
            <Input.TextArea rows={2} placeholder="Payment terms, delivery terms…" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Line Items
          </Divider>

          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 90px 60px 80px 70px 70px 70px 32px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Description', 'Qty', 'Unit', 'Unit Price', 'Disc %', 'GST %', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => (
            <div key={row._key} style={{ display: 'grid', gridTemplateColumns: '180px 90px 60px 80px 70px 70px 70px 32px', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <Select
                size="small" showSearch allowClear optionFilterProp="label"
                value={row.item_id} placeholder="Item"
                onChange={(v) => onItemSelect(row._key, v)}
                options={items.map((i) => ({ value: i.id, label: `${i.name}` }))}
              />
              <Input size="small" placeholder="Desc" value={row.description}
                onChange={(e) => updateLine(row._key, 'description', e.target.value)} />
              <InputNumber size="small" min={0} value={row.qty}
                onChange={(v) => updateLine(row._key, 'qty', v)} style={{ width: '100%' }} />
              <Input size="small" value={row.unit}
                onChange={(e) => updateLine(row._key, 'unit', e.target.value)} />
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber size="small" min={0} precision={2} value={row.unit_price}
                  onChange={(v) => updateLine(row._key, 'unit_price', v)} style={{ width: '100%' }} />
                <Tooltip title={priceHint && priceHint.summary ? `${priceHint.summary} (₹${priceHint.suggested_price})` : 'Get AI price suggestion'}>
                  <Button size="small" type="text" onClick={() => handlePriceSuggest(row.item_id)} loading={aiPrice.loading} style={{ fontSize: 11, padding: '0 4px' }}>
                    AI
                  </Button>
                </Tooltip>
              </Space.Compact>
              <InputNumber size="small" min={0} max={100} precision={1} value={row.discount}
                onChange={(v) => updateLine(row._key, 'discount', v)} style={{ width: '100%' }} />
              <InputNumber size="small" min={0} precision={1} value={row.gst_rate}
                onChange={(v) => updateLine(row._key, 'gst_rate', v)} style={{ width: '100%' }} />
              <Button size="small" type="text" danger icon={<MinusCircleOutlined />}
                onClick={() => removeLine(row._key)} disabled={lineItems.length === 1} />
            </div>
          ))}

          <Button type="dashed" onClick={addLine} icon={<PlusCircleOutlined />} style={{ width: '100%', marginTop: 4 }}>
            Add Item
          </Button>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
