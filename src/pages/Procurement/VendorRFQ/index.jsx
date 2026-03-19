import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col, Modal, Alert, Descriptions, Tabs,
  Progress, Empty,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  PlusCircleOutlined, MinusCircleOutlined,
  SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, ShoppingCartOutlined, AuditOutlined,
  TrophyOutlined, LockOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { vendorRfqApi } from '../../../api/procurement.api';
import { itemApi }      from '../../../api/item.api';
import { vendorApi }    from '../../../api/vendor.api';

const { Title, Text } = Typography;

// ── Configs ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:   { color: 'default', label: 'Draft'    },
  sent:    { color: 'blue',    label: 'Sent'      },
  closed:  { color: 'orange',  label: 'Closed'    },
  awarded: { color: 'green',   label: 'Awarded'   },
};

const VENDOR_STATUS_CONFIG = {
  invited:     { color: 'default', label: 'Invited'     },
  responded:   { color: 'blue',    label: 'Responded'   },
  declined:    { color: 'red',     label: 'Declined'    },
  awarded:     { color: 'green',   label: 'Awarded'     },
};

const emptyItem = () => ({
  _key:         Date.now() + Math.random(),
  item_id:      null,
  qty_required: null,
  unit:         'pcs',
  notes:        '',
});

const fmtCcy = (v) =>
  v != null && v !== '' && !isNaN(v)
    ? `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

// ─────────────────────────────────────────────────────────────────────────────
export default function VendorRFQPage() {
  const { can } = usePermissions();
  const canWrite  = can('plan-vendor-rfq-vendor_rfq-create_edit_delete');
  const canAward  = can('plan-vendor-rfq-award_rfq-approve_reject');

  // ── Data ────────────────────────────────────────────────────────────────────
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [statusFil, setStatusFil] = useState('');
  const [items,     setItems]     = useState([]);   // all items (master)
  const [vendors,   setVendors]   = useState([]);   // all vendors (master)

  // ── Drawer / Modal state ────────────────────────────────────────────────────
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editRecord,   setEditRecord]   = useState(null);   // null = create
  const [detailOpen,   setDetailOpen]   = useState(false);
  const [detailRec,    setDetailRec]    = useState(null);
  const [detailLoading,setDetailLoading]= useState(false);

  // Quotes entry modal
  const [quoteModal,   setQuoteModal]   = useState(false);
  const [quoteVendor,  setQuoteVendor]  = useState(null);   // vendor_id selected
  const [quoteLines,   setQuoteLines]   = useState([]);     // per-item price inputs
  const [quoteSaving,  setQuoteSaving]  = useState(false);

  // Award modal
  const [awardModal,   setAwardModal]   = useState(false);
  const [awardRec,     setAwardRec]     = useState(null);
  const [awardForm]                     = Form.useForm();
  const [awarding,     setAwarding]     = useState(false);

  // Create/Edit form
  const [form]          = Form.useForm();
  const [lineItems,     setLineItems]   = useState([emptyItem()]);
  const [saving,        setSaving]      = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)    params.search = search;
      if (statusFil) params.status = statusFil;
      const res = await vendorRfqApi.getAll(params);
      setRecords(res.data || []);
    } catch { message.error('Failed to load RFQs'); }
    finally  { setLoading(false); }
  }, [search, statusFil]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    itemApi.getAll({ limit: 500 })
      .then(r => setItems(r.data?.rows || r.data || []))
      .catch(() => {});
    vendorApi.getAll({ limit: 500 })
      .then(r => {
        const list = Array.isArray(r) ? r : (r?.data?.rows || r?.data || []);
        setVendors(list);
      })
      .catch((err) => message.error('Failed to load vendors: ' + (err?.message || 'Server error')));
  }, []);

  const loadDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await vendorRfqApi.getById(id);
      setDetailRec(res.data);
    } catch { message.error('Failed to load RFQ detail'); }
    finally  { setDetailLoading(false); }
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  const total   = records.length;
  const drafts  = records.filter(r => r.status === 'draft').length;
  const sent    = records.filter(r => r.status === 'sent').length;
  const closed  = records.filter(r => r.status === 'closed').length;
  const awarded = records.filter(r => r.status === 'awarded').length;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditRecord(null);
    form.resetFields();
    setLineItems([emptyItem()]);
    setDrawerOpen(true);
  };

  const openEdit = (rec) => {
    setEditRecord(rec);
    form.setFieldsValue({
      title:             rec.title,
      pr_id:             rec.pr_id || undefined,
      response_deadline: rec.response_deadline ? dayjs(rec.response_deadline) : null,
      notes:             rec.notes,
      vendor_ids:        (rec.Vendors || []).map(v => v.vendor_id),
    });
    setLineItems(
      (rec.Items || []).map(it => ({
        _key:         it.id,
        item_id:      it.item_id,
        qty_required: parseFloat(it.qty_required),
        unit:         it.unit || 'pcs',
        notes:        it.notes || '',
      }))
    );
    setDrawerOpen(true);
  };

  const openDetail = async (rec) => {
    setDetailRec(rec);
    setDetailOpen(true);
    await loadDetail(rec.id);
  };

  const openQuoteEntry = (rfq) => {
    setDetailRec(rfq);
    // Initialise quote lines from rfq items
    const lines = (rfq.Items || []).map(it => {
      const existingQuote = (it.Quotes || []).find(q => q.vendor_id === quoteVendor);
      return {
        rfq_item_id:    it.id,
        item_name:      it.Item?.name || `Item #${it.item_id}`,
        item_code:      it.Item?.code || '',
        qty_required:   parseFloat(it.qty_required),
        unit:           it.unit || 'pcs',
        unit_price:     existingQuote?.unit_price ? parseFloat(existingQuote.unit_price) : null,
        lead_time_days: existingQuote?.lead_time_days || null,
        notes:          existingQuote?.notes || '',
      };
    });
    setQuoteLines(lines);
    setQuoteVendor(null);
    setQuoteModal(true);
  };

  const openAward = (rfq) => {
    setAwardRec(rfq);
    awardForm.resetFields();
    awardForm.setFieldsValue({ order_date: dayjs() });
    setAwardModal(true);
  };

  // ── Save (create / update) ────────────────────────────────────────────────────
  const handleSave = async () => {
    let values;
    try { values = await form.validateFields(); }
    catch { return; }

    const validLines = lineItems.filter(l => l.item_id && l.qty_required);
    if (!validLines.length) { message.error('Add at least one item'); return; }

    const payload = {
      ...values,
      response_deadline: values.response_deadline?.format('YYYY-MM-DD') || null,
      items: validLines.map(l => ({
        item_id:      l.item_id,
        qty_required: l.qty_required,
        unit:         l.unit || 'pcs',
        notes:        l.notes || null,
      })),
    };

    setSaving(true);
    try {
      if (editRecord) {
        await vendorRfqApi.update(editRecord.id, payload);
        message.success('RFQ updated');
      } else {
        await vendorRfqApi.create(payload);
        message.success('RFQ created');
      }
      setDrawerOpen(false);
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  // ── Workflow actions ──────────────────────────────────────────────────────────
  const handleSend = async (rfq) => {
    try {
      await vendorRfqApi.send(rfq.id);
      message.success('RFQ sent to vendors');
      load();
      if (detailOpen && detailRec?.id === rfq.id) loadDetail(rfq.id);
    } catch (e) { message.error(e?.response?.data?.message || 'Failed to send'); }
  };

  const handleClose = async (rfq) => {
    try {
      await vendorRfqApi.close(rfq.id);
      message.success('RFQ closed for comparison');
      load();
      if (detailOpen && detailRec?.id === rfq.id) loadDetail(rfq.id);
    } catch (e) { message.error(e?.response?.data?.message || 'Failed to close'); }
  };

  const handleDelete = async (id) => {
    try {
      await vendorRfqApi.delete(id);
      message.success('RFQ deleted');
      load();
    } catch (e) { message.error(e?.response?.data?.message || 'Delete failed'); }
  };

  // ── Save quotes ───────────────────────────────────────────────────────────────
  const handleSaveQuotes = async () => {
    if (!quoteVendor) { message.error('Select a vendor first'); return; }
    const filledLines = quoteLines.filter(l => l.unit_price != null && l.unit_price !== '');
    if (!filledLines.length) { message.error('Enter at least one price'); return; }

    setQuoteSaving(true);
    try {
      await vendorRfqApi.saveQuotes(detailRec.id, {
        vendor_id: quoteVendor,
        quotes: filledLines.map(l => ({
          rfq_item_id:    l.rfq_item_id,
          unit_price:     parseFloat(l.unit_price),
          lead_time_days: l.lead_time_days || null,
          notes:          l.notes || null,
        })),
      });
      message.success('Quotes saved');
      setQuoteModal(false);
      load();
      if (detailOpen && detailRec?.id) loadDetail(detailRec.id);
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save quotes');
    } finally { setQuoteSaving(false); }
  };

  // ── Award ─────────────────────────────────────────────────────────────────────
  const handleAward = async () => {
    let values;
    try { values = await awardForm.validateFields(); }
    catch { return; }

    setAwarding(true);
    try {
      const res = await vendorRfqApi.award(awardRec.id, {
        vendor_id:     values.vendor_id,
        order_date:    values.order_date.format('YYYY-MM-DD'),
        expected_date: values.expected_date?.format('YYYY-MM-DD') || null,
        notes:         values.notes || null,
      });
      message.success(`RFQ awarded! PO ${res.data?.po?.po_no} created.`);
      setAwardModal(false);
      load();
      if (detailOpen && detailRec?.id === awardRec.id) loadDetail(awardRec.id);
    } catch (e) {
      message.error(e?.response?.data?.message || 'Award failed');
    } finally { setAwarding(false); }
  };

  // ── Line item helpers ─────────────────────────────────────────────────────────
  const addLine    = () => setLineItems(p => [...p, emptyItem()]);
  const removeLine = (key) => setLineItems(p => p.filter(l => l._key !== key));
  const updateLine = (key, field, val) =>
    setLineItems(p => p.map(l => l._key === key ? { ...l, [field]: val } : l));

  // ── Quote comparison (matrix: items × vendors) ────────────────────────────────
  const buildComparisonData = (rfq) => {
    if (!rfq?.Items?.length || !rfq?.Vendors?.length) return { columns: [], dataSource: [] };

    const respondedVendors = (rfq.Vendors || []).filter(v =>
      ['responded', 'awarded'].includes(v.status)
    );

    const columns = [
      { title: 'Item',     dataIndex: 'item',     key: 'item',     width: 180, ellipsis: true },
      { title: 'Qty',      dataIndex: 'qty',      key: 'qty',      width: 80  },
      ...respondedVendors.map(rv => ({
        title:     rv.Vendor?.name || `Vendor ${rv.vendor_id}`,
        key:       `v_${rv.vendor_id}`,
        width:     130,
        render:    (_, row) => {
          const q = row.quotes?.[rv.vendor_id];
          if (!q) return <Text type="secondary">—</Text>;
          const isMin = row.minPrice != null && parseFloat(q.unit_price) === row.minPrice;
          return (
            <div>
              <Text style={{ color: isMin ? '#16a34a' : undefined, fontWeight: isMin ? 600 : 400 }}>
                {fmtCcy(q.unit_price)}
              </Text>
              {q.lead_time_days != null && (
                <div><Text type="secondary" style={{ fontSize: 11 }}>{q.lead_time_days}d lead</Text></div>
              )}
              {isMin && <Tag color="green" style={{ marginTop: 2, fontSize: 10 }}>L1</Tag>}
            </div>
          );
        },
      })),
    ];

    const dataSource = (rfq.Items || []).map(it => {
      const quotes = {};
      (it.Quotes || []).forEach(q => { quotes[q.vendor_id] = q; });
      const prices = Object.values(quotes).map(q => parseFloat(q.unit_price)).filter(p => !isNaN(p));
      const minPrice = prices.length ? Math.min(...prices) : null;
      return {
        key:      it.id,
        item:     it.Item?.name || `Item #${it.item_id}`,
        qty:      `${parseFloat(it.qty_required)} ${it.unit}`,
        quotes,
        minPrice,
      };
    });

    return { columns, dataSource };
  };

  // ── Main table columns ────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'RFQ No', dataIndex: 'rfq_no', key: 'rfq_no', width: 160,
      render: (v, r) => <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(r)}>{v}</Button>,
    },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v) => {
        const cfg = STATUS_CONFIG[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Items', key: 'items', width: 70,
      render: (_, r) => <Badge count={(r.Items || []).length} color="blue" showZero />,
    },
    {
      title: 'Vendors', key: 'vendors', width: 80,
      render: (_, r) => <Badge count={(r.Vendors || []).length} color="geekblue" showZero />,
    },
    {
      title: 'Deadline', dataIndex: 'response_deadline', key: 'deadline', width: 110,
      render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Awarded To', key: 'awarded', width: 140,
      render: (_, r) => r.AwardedVendor ? <Text>{r.AwardedVendor.name}</Text> : '—',
    },
    {
      title: 'Actions', key: 'actions', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space size={4} wrap>
          <Tooltip title="View Detail">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
          </Tooltip>
          {canWrite && r.status === 'draft' && (
            <>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
              <Tooltip title="Send to Vendors">
                <Popconfirm title="Send RFQ to all vendors?" onConfirm={() => handleSend(r)} okText="Send">
                  <Button size="small" icon={<SendOutlined />} type="primary" />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="Delete">
                <Popconfirm title="Delete this RFQ?" onConfirm={() => handleDelete(r.id)} okText="Delete" okType="danger">
                  <Button size="small" icon={<DeleteOutlined />} danger />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          {canWrite && r.status === 'sent' && (
            <>
              <Tooltip title="Enter Vendor Quotes">
                <Button size="small" icon={<AuditOutlined />} onClick={() => openQuoteEntry(r)}>Quotes</Button>
              </Tooltip>
              <Tooltip title="Close for Comparison">
                <Popconfirm title="Close RFQ for comparison?" onConfirm={() => handleClose(r)} okText="Close">
                  <Button size="small" icon={<LockOutlined />} />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          {canWrite && r.status === 'closed' && (
            <Tooltip title="Enter Vendor Quotes">
              <Button size="small" icon={<AuditOutlined />} onClick={() => openQuoteEntry(r)}>Quotes</Button>
            </Tooltip>
          )}
          {canAward && ['sent', 'closed'].includes(r.status) && (
            <Tooltip title="Award to Vendor">
              <Button size="small" icon={<TrophyOutlined />} onClick={() => openAward(r)} style={{ color: '#d97706', borderColor: '#d97706' }}>
                Award
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // ── Detail tabs ───────────────────────────────────────────────────────────────
  const renderDetailTabs = (rfq) => {
    if (!rfq) return null;
    const { columns: compCols, dataSource: compData } = buildComparisonData(rfq);

    return (
      <Tabs defaultActiveKey="items" items={[
        {
          key: 'items',
          label: 'Items',
          children: (
            <Table
              size="small"
              dataSource={rfq.Items || []}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Item',  key: 'item',  render: (_, r) => r.Item?.name || `#${r.item_id}` },
                { title: 'Code',  key: 'code',  render: (_, r) => r.Item?.code || '—', width: 100 },
                { title: 'Qty',   dataIndex: 'qty_required', key: 'qty', width: 90, render: v => parseFloat(v) },
                { title: 'Unit',  dataIndex: 'unit',         key: 'unit', width: 70 },
                { title: 'Notes', dataIndex: 'notes',        key: 'notes', ellipsis: true, render: v => v || '—' },
              ]}
            />
          ),
        },
        {
          key: 'vendors',
          label: 'Vendors',
          children: (
            <Table
              size="small"
              dataSource={rfq.Vendors || []}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Vendor',  key: 'name',   render: (_, r) => r.Vendor?.name || `#${r.vendor_id}` },
                { title: 'Code',    key: 'code',   render: (_, r) => r.Vendor?.partner_code || '—', width: 100 },
                { title: 'Contact', key: 'contact',render: (_, r) => r.Vendor?.mobile || r.Vendor?.email || '—' },
                {
                  title: 'Status', key: 'status', width: 110,
                  render: (_, r) => {
                    const cfg = VENDOR_STATUS_CONFIG[r.status] || { color: 'default', label: r.status };
                    return <Tag color={cfg.color}>{cfg.label}</Tag>;
                  },
                },
              ]}
            />
          ),
        },
        {
          key: 'comparison',
          label: 'Quote Comparison',
          children: compData.length > 0 && compCols.length > 1 ? (
            <Table
              size="small"
              dataSource={compData}
              columns={compCols}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          ) : (
            <Empty description="No vendor quotes yet. Enter quotes using the 'Quotes' button." />
          ),
        },
      ]} />
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ padding: '24px 24px 0' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Vendor RFQ</Text>
        </div>

        {/* Title */}
        <Title level={3} style={{ margin: 0 }}>Vendor RFQ</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Send requests for quotation to suppliers, compare prices, and award to the best vendor.
        </Text>

        {/* Stat chips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Tag color="blue">Total: {total}</Tag>
          <Tag color="default">Draft: {drafts}</Tag>
          <Tag color="geekblue">Sent: {sent}</Tag>
          <Tag color="orange">Closed: {closed}</Tag>
          <Tag color="green">Awarded: {awarded}</Tag>
        </div>

        {/* Main card */}
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          styles={{ body: { padding: '16px 20px' } }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search RFQ no..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 220, borderRadius: 8 }}
              allowClear
            />
            <Select
              placeholder="Status"
              value={statusFil || undefined}
              onChange={v => setStatusFil(v || '')}
              allowClear
              style={{ width: 130 }}
              options={[
                { value: 'draft',   label: 'Draft'   },
                { value: 'sent',    label: 'Sent'    },
                { value: 'closed',  label: 'Closed'  },
                { value: 'awarded', label: 'Awarded' },
              ]}
            />
            <div style={{ flex: 1 }} />
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                New RFQ
              </Button>
            )}
          </div>

          <Table
            columns={columns}
            dataSource={records}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 15, showSizeChanger: false, showTotal: t => `${t} records` }}
          />
        </Card>
      </div>

      {/* ── Create / Edit Drawer ─────────────────────────────────────────────── */}
      <Drawer
        title={editRecord ? `Edit RFQ — ${editRecord.rfq_no}` : 'New Vendor RFQ'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={700}
        footer={
          <div style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {editRecord ? 'Update RFQ' : 'Create RFQ'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="title" label="RFQ Title" rules={[{ required: true, message: 'Title is required' }]}>
                <Input placeholder="e.g. Q1 Raw Material Procurement" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="response_deadline" label="Response Deadline">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="vendor_ids" label="Invite Vendors" rules={[{ required: true, message: 'Select at least one vendor' }]}>
            <Select
              mode="multiple"
              placeholder="Select vendors to invite"
              options={vendors.map(v => ({ value: v.id, label: `${v.name} (${v.partner_code || v.id})` }))}
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              showSearch
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Additional notes to vendors..." />
          </Form.Item>

          <Divider orientation="left" style={{ margin: '8px 0 12px' }}>Items Required</Divider>

          {lineItems.map((line, idx) => (
            <div key={line._key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 2 }}>
                <Select
                  showSearch
                  placeholder="Item"
                  value={line.item_id || undefined}
                  onChange={v => updateLine(line._key, 'item_id', v)}
                  options={items.map(it => ({ value: it.id, label: `${it.name} (${it.code || it.id})` }))}
                  filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                  style={{ width: '100%' }}
                />
              </div>
              <InputNumber
                placeholder="Qty"
                value={line.qty_required}
                onChange={v => updateLine(line._key, 'qty_required', v)}
                min={0.001}
                style={{ width: 90 }}
              />
              <Select
                value={line.unit}
                onChange={v => updateLine(line._key, 'unit', v)}
                options={['pcs','kg','ltr','mtr','box','set'].map(u => ({ value: u, label: u }))}
                style={{ width: 80 }}
              />
              <Input
                placeholder="Notes"
                value={line.notes}
                onChange={e => updateLine(line._key, 'notes', e.target.value)}
                style={{ flex: 1 }}
              />
              <Button icon={<MinusCircleOutlined />} danger onClick={() => removeLine(line._key)}
                disabled={lineItems.length === 1} />
            </div>
          ))}
          <Button type="dashed" icon={<PlusCircleOutlined />} onClick={addLine} block>
            Add Item
          </Button>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ────────────────────────────────────────────────────── */}
      <Drawer
        title={
          detailRec
            ? <Space>
                <Text strong>{detailRec.rfq_no}</Text>
                <Tag color={STATUS_CONFIG[detailRec.status]?.color || 'default'}>
                  {STATUS_CONFIG[detailRec.status]?.label || detailRec.status}
                </Tag>
              </Space>
            : 'RFQ Detail'
        }
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={800}
        extra={
          detailRec && (
            <Space>
              {canWrite && detailRec.status === 'draft' && (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detailRec); }}>Edit</Button>
              )}
              {canWrite && ['sent', 'closed'].includes(detailRec.status) && (
                <Button icon={<AuditOutlined />} onClick={() => openQuoteEntry(detailRec)}>Enter Quotes</Button>
              )}
              {canAward && ['sent', 'closed'].includes(detailRec.status) && (
                <Button icon={<TrophyOutlined />} onClick={() => openAward(detailRec)}
                  style={{ color: '#d97706', borderColor: '#d97706' }}>
                  Award
                </Button>
              )}
              {canWrite && detailRec.status === 'sent' && (
                <Popconfirm title="Close RFQ for quote comparison?" onConfirm={() => handleClose(detailRec)} okText="Close">
                  <Button icon={<LockOutlined />}>Close RFQ</Button>
                </Popconfirm>
              )}
            </Space>
          )
        }
      >
        {detailRec && (
          <>
            {detailRec.status === 'awarded' && detailRec.AwardedVendor && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
                message={`Awarded to ${detailRec.AwardedVendor.name}`}
                description={detailRec.awarded_at ? `Awarded on ${dayjs(detailRec.awarded_at).format('DD MMM YYYY')}` : null}
              />
            )}

            <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Title" span={2}>{detailRec.title}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_CONFIG[detailRec.status]?.color}>{STATUS_CONFIG[detailRec.status]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Response Deadline">
                {detailRec.response_deadline ? dayjs(detailRec.response_deadline).format('DD MMM YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Created By">{detailRec.Creator?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Created On">
                {dayjs(detailRec.created_at || detailRec.createdAt).format('DD MMM YYYY')}
              </Descriptions.Item>
              {detailRec.notes && (
                <Descriptions.Item label="Notes" span={2}>{detailRec.notes}</Descriptions.Item>
              )}
            </Descriptions>

            {renderDetailTabs(detailRec)}
          </>
        )}
      </Drawer>

      {/* ── Enter Quotes Modal ───────────────────────────────────────────────── */}
      <Modal
        title={`Enter Vendor Quotes — ${detailRec?.rfq_no || ''}`}
        open={quoteModal}
        onCancel={() => setQuoteModal(false)}
        onOk={handleSaveQuotes}
        okText="Save Quotes"
        confirmLoading={quoteSaving}
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Select Vendor: </Text>
          <Select
            placeholder="Choose vendor..."
            value={quoteVendor || undefined}
            onChange={vid => {
              setQuoteVendor(vid);
              // Prefill existing quotes for this vendor
              const lines = (detailRec?.Items || []).map(it => {
                const existingQuote = (it.Quotes || []).find(q => q.vendor_id === vid);
                return {
                  rfq_item_id:    it.id,
                  item_name:      it.Item?.name || `Item #${it.item_id}`,
                  item_code:      it.Item?.code || '',
                  qty_required:   parseFloat(it.qty_required),
                  unit:           it.unit || 'pcs',
                  unit_price:     existingQuote?.unit_price ? parseFloat(existingQuote.unit_price) : null,
                  lead_time_days: existingQuote?.lead_time_days || null,
                  notes:          existingQuote?.notes || '',
                };
              });
              setQuoteLines(lines);
            }}
            options={(detailRec?.Vendors || []).map(v => ({
              value: v.vendor_id,
              label: v.Vendor?.name || `Vendor ${v.vendor_id}`,
            }))}
            style={{ width: 300 }}
          />
        </div>

        {quoteVendor && quoteLines.length > 0 ? (
          <Table
            size="small"
            dataSource={quoteLines}
            rowKey="rfq_item_id"
            pagination={false}
            columns={[
              {
                title: 'Item', key: 'item', ellipsis: true,
                render: (_, r) => <div><div>{r.item_name}</div><Text type="secondary" style={{ fontSize: 11 }}>{r.item_code}</Text></div>,
              },
              {
                title: 'Qty', key: 'qty', width: 80,
                render: (_, r) => `${r.qty_required} ${r.unit}`,
              },
              {
                title: 'Unit Price (₹)', key: 'price', width: 130,
                render: (_, r) => (
                  <InputNumber
                    value={r.unit_price}
                    onChange={v => setQuoteLines(p => p.map(l => l.rfq_item_id === r.rfq_item_id ? { ...l, unit_price: v } : l))}
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                    placeholder="0.00"
                  />
                ),
              },
              {
                title: 'Lead (days)', key: 'lead', width: 110,
                render: (_, r) => (
                  <InputNumber
                    value={r.lead_time_days}
                    onChange={v => setQuoteLines(p => p.map(l => l.rfq_item_id === r.rfq_item_id ? { ...l, lead_time_days: v } : l))}
                    min={0}
                    style={{ width: '100%' }}
                    placeholder="—"
                  />
                ),
              },
            ]}
          />
        ) : !quoteVendor ? (
          <Empty description="Select a vendor above to enter their prices" />
        ) : null}
      </Modal>

      {/* ── Award Modal ──────────────────────────────────────────────────────── */}
      <Modal
        title={`Award RFQ — ${awardRec?.rfq_no || ''}`}
        open={awardModal}
        onCancel={() => setAwardModal(false)}
        onOk={handleAward}
        okText="Award & Create PO"
        confirmLoading={awarding}
        okButtonProps={{ style: { backgroundColor: '#d97706', borderColor: '#d97706' } }}
        width={500}
      >
        <Alert
          type="info"
          showIcon
          message="A Purchase Order will be automatically created for the awarded vendor."
          style={{ marginBottom: 16 }}
        />
        <Form form={awardForm} layout="vertical">
          <Form.Item name="vendor_id" label="Award To Vendor" rules={[{ required: true, message: 'Select a vendor' }]}>
            <Select
              placeholder="Select winning vendor..."
              options={(awardRec?.Vendors || []).map(v => ({
                value: v.vendor_id,
                label: v.Vendor?.name || `Vendor ${v.vendor_id}`,
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="order_date" label="PO Order Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expected_date" label="Expected Delivery">
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Notes for PO..." />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
}
