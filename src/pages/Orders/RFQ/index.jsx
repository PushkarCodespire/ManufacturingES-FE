import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  FileTextOutlined, PlusCircleOutlined, MinusCircleOutlined,
  PaperClipOutlined, CheckCircleOutlined, LoadingOutlined, EyeOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { rfqApi, uploadApi } from '../../../api/orders.api';
import { vendorApi }    from '../../../api/vendor.api';
import { itemApi }      from '../../../api/item.api';
import aiApi            from '../../../api/ai.api';
import useAiSuggestion  from '../../../hooks/useAiSuggestion';
import AiSuggestionCard from '../../../components/AiSuggestion/AiSuggestionCard';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal       from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';
import { UploadOutlined }   from '@ant-design/icons';

const { Title, Text } = Typography;

// Strip /api suffix to get the static-file base (e.g. http://localhost:5000)
const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  open:      { color: 'blue',    label: 'Open'      },
  quoted:    { color: 'orange',  label: 'Quoted'    },
  converted: { color: 'green',   label: 'Converted' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

// ── CSV Upload config ─────────────────────────────────────────────────────────
const CSV_HEADERS = ['Customer Code', 'RFQ Date', 'Subject', 'Item Code', 'Customer Part No', 'Description', 'Qty', 'Unit', 'Target Price', 'Notes'];
const CSV_SAMPLE = [
  { 'Customer Code': 'Maruti Suzuki India Ltd', 'RFQ Date': '2025-06-15', 'Subject': 'Machined Parts', 'Item Code': 'ITM-001', 'Customer Part No': 'CP-100', 'Description': 'Shaft Assembly', 'Qty': '100', 'Unit': 'pcs', 'Target Price': '250', 'Notes': '' },
];
const CSV_VALIDATION = [
  { field: 'Customer Code', required: true },
  { field: 'Item Code', required: true },
  { field: 'Qty', required: true },
];

// ── Empty item row ────────────────────────────────────────────────────────────
const emptyItem = () => ({
  _key: Date.now() + Math.random(),
  item_id: null, customer_item_code: '', description: '',
  qty: 1, unit: 'pcs', target_price: null, notes: '',
  drawing_url: null, drawing_name: null,
});

export default function RFQPage() {
  const { can } = usePermissions();
  const canWrite = can('plan-orders-rfq-create_edit_delete');

  const [rfqs,        setRfqs]        = useState([]);
  const [customers,   setCustomers]   = useState([]);
  const [items,       setItemsList]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState(null);

  // Drawer state
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [lineItems,    setLineItems]    = useState([emptyItem()]);
  const [uploadingKey, setUploadingKey] = useState(null);  // _key of row currently uploading

  // Hidden file input for drawing upload
  const fileInputRef      = useRef(null);
  const currentUploadKey  = useRef(null);

  const [form] = Form.useForm();
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const ai = useAiSuggestion(aiApi.suggestRfqFill);

  const handleAiFill = async () => {
    const customerId = form.getFieldValue('customer_id');
    if (!customerId) { message.warning('Select a customer first'); return; }
    setAiVisible(true);
    ai.fetch({ customer_id: customerId });
  };

  const applyAiSuggestion = (suggestion) => {
    if (!suggestion?.suggestions?.length) return;
    const newItems = suggestion.suggestions.map((s, i) => ({
      _key: Date.now() + i,
      item_id: s.item_id || null,
      qty: s.suggested_qty || 0,
      unit: s.unit || null,
      description: s.item_name || '',
      customer_item_code: '',
      target_price: null,
      notes: s.reason || '',
      drawing_url: null,
      drawing_name: null,
    }));
    setLineItems(newItems);
    if (suggestion.notes_suggestion) form.setFieldValue('notes', suggestion.notes_suggestion);
    message.success('AI suggestions applied — review and adjust');
    setAiVisible(false);
  };

  // ── Load data ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await rfqApi.getAll(params);
      setRfqs(data);
    } catch (err) { message.error(err?.message || 'Failed to load RFQs'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      vendorApi.getAll({ type: 'customer', limit: 500 }).catch(() => ({ data: [] })),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
    ]).then(([c, i]) => {
      setCustomers(Array.isArray(c) ? c : (c?.data ?? []));
      setItemsList(Array.isArray(i) ? i : (i?.data ?? []));
    });
  }, []);

  // ── Drawer helpers ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ rfq_date: dayjs() });
    setLineItems([emptyItem()]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      customer_id: record.customer_id,
      rfq_date:    dayjs(record.rfq_date),
      subject:     record.subject,
      notes:       record.notes,
      status:      record.status,
    });
    setLineItems((record.Items || []).map((it) => ({
      _key:               it.id,
      item_id:            it.item_id,
      customer_item_code: it.customer_item_code || '',
      description:        it.description || '',
      qty:                parseFloat(it.qty) || 1,
      unit:               it.unit || 'pcs',
      target_price:       it.target_price ? parseFloat(it.target_price) : null,
      notes:              it.notes || '',
      drawing_url:        it.drawing_url  || null,
      drawing_name:       it.drawing_name || null,
    })));
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }

      // Warn (non-blocking) if new parts have no drawing attached
      const newPartsWithoutDrawing = lineItems.filter((it) => !it.item_id && !it.drawing_url);
      if (newPartsWithoutDrawing.length > 0) {
        message.warning(
          `${newPartsWithoutDrawing.length} new part(s) have no drawing attached. Consider attaching drawings before submitting.`
        );
      }

      setSaving(true);

      const payload = {
        customer_id: vals.customer_id,
        rfq_date:    vals.rfq_date.format('YYYY-MM-DD'),
        subject:     vals.subject || '',
        notes:       vals.notes   || '',
        ...(editing && { status: vals.status }),
        items: lineItems.map(({ _key, ...it }) => it),
      };

      if (editing) {
        await rfqApi.update(editing.id, payload);
        message.success('RFQ updated');
      } else {
        await rfqApi.create(payload);
        message.success('RFQ created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return; // Ant validation
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await rfqApi.delete(id);
      message.success('RFQ deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── CSV Import handler ────────────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    // Group rows by Customer Code + RFQ Date + Subject to create one RFQ per group
    const groups = {};
    for (const row of rows) {
      const key = `${(row['Customer Code'] || '').trim()}||${(row['RFQ Date'] || '').trim()}||${(row['Subject'] || '').trim()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    for (const [, groupRows] of Object.entries(groups)) {
      try {
        const first = groupRows[0];
        const custCode = (first['Customer Code'] || '').trim();
        const cust = customers.find((c) => c.partner_code?.toLowerCase() === custCode.toLowerCase() || c.name?.toLowerCase() === custCode.toLowerCase());
        if (!cust) throw new Error(`Customer "${custCode}" not found`);
        const lineItemsPayload = groupRows.map((row) => {
          const itemCode = (row['Item Code'] || '').trim();
          const item = items.find((i) => i.code?.toLowerCase() === itemCode.toLowerCase() || i.name?.toLowerCase() === itemCode.toLowerCase());
          return {
            item_id: item?.id || null,
            customer_item_code: row['Customer Part No'] || '',
            description: row['Description'] || item?.name || '',
            qty: parseFloat(row['Qty']) || 1,
            unit: row['Unit'] || 'pcs',
            target_price: row['Target Price'] ? parseFloat(row['Target Price']) : null,
            notes: row['Notes'] || '',
          };
        });
        await rfqApi.create({
          customer_id: cust.id,
          rfq_date: first['RFQ Date'] || dayjs().format('YYYY-MM-DD'),
          subject: first['Subject'] || '',
          notes: '',
          items: lineItemsPayload,
        });
        success += groupRows.length;
      } catch (err) {
        failed += groupRows.length;
        errors.push(`Group "${groupRows[0]['Customer Code']}": ${err?.response?.data?.message || err.message}`);
      }
    }
    load();
    return { success, failed, errors };
  };

  // ── Line item helpers ─────────────────────────────────────────────────────────
  const addLine = () => setLineItems((p) => [...p, emptyItem()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));
  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  // When item selected, auto-fill description & unit
  const onItemSelect = (key, itemId) => {
    const found = items.find((i) => i.id === itemId);
    if (found) {
      updateLine(key, 'description', found.name);
      updateLine(key, 'unit', found.unit || 'pcs');
    }
    updateLine(key, 'item_id', itemId);
  };

  // ── Drawing upload helpers ────────────────────────────────────────────────────
  const handleDrawingClick = (key) => {
    currentUploadKey.current = key;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = currentUploadKey.current;
    if (!key) return;

    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadApi.uploadDrawing(formData);
      // axios interceptor already unwraps res.data, then uploadApi does .then(r => r.data)
      // so `res` here is already { url, filename, original_name, size, mimetype }
      updateLine(key, 'drawing_url',  res.url);
      updateLine(key, 'drawing_name', res.original_name || file.name);
      message.success('Drawing attached');
    } catch (err) {
      message.error(err?.message || 'Drawing upload failed');
    } finally {
      setUploadingKey(null);
      // Reset the input so the same file can be re-selected if needed
      e.target.value = '';
    }
  };

  const removeDrawing = (key) => {
    updateLine(key, 'drawing_url',  null);
    updateLine(key, 'drawing_name', null);
  };

  const openDrawing = (url) => {
    window.open(`${BACKEND_URL}${url}`, '_blank', 'noopener,noreferrer');
  };

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const total     = rfqs.length;
  const openCount = rfqs.filter((r) => r.status === 'open').length;

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'RFQ No',
      dataIndex: 'rfq_no',
      key: 'rfq_no',
      width: 160,
      render: (no, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => openEdit(r)}
        >
          {no}
        </Text>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'rfq_date',
      key: 'rfq_date',
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
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
      render: (s) => s || <Text type="secondary">—</Text>,
    },
    {
      title: 'Items',
      key: 'items',
      width: 80,
      align: 'center',
      render: (_, r) => {
        const drawingCount = (r.Items || []).filter((it) => it.drawing_url).length;
        return (
          <Space size={4}>
            <Badge count={r.Items?.length || 0} style={{ backgroundColor: '#e0e7ff', color: '#1d4ed8' }} />
            {drawingCount > 0 && (
              <Tooltip title={`${drawingCount} drawing(s) attached`}>
                <PaperClipOutlined style={{ color: '#16a34a', fontSize: 12 }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Created By',
      key: 'creator',
      width: 120,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Creator?.name || '—'}</Text>,
    },
    ...(canWrite ? [{
      title: 'Actions',
      key: 'actions',
      width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          {r.status !== 'converted' && (
            <Popconfirm title="Delete this RFQ?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Orders</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>RFQ</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Request for Quotation</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Manage incoming RFQs from customers. Track item requirements and convert to quotations.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="processing">Open: {openCount}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search RFQ no or subject…"
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
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('r-f-q.csv', rfqs, columns)}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)}>Upload CSV</Button>}
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New RFQ</Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rfqs}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create / Edit Drawer ───────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit RFQ — ${editing.rfq_no}` : 'New Request for Quotation'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update RFQ' : 'Create RFQ'}
              </Button>
            )}
          </div>
        }
      >
        {/* Hidden file input for drawing uploads */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Select customer"
                  optionFilterProp="label"
                  options={customers.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.partner_code})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="rfq_date" label="RFQ Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          {!editing && (
            <Button size="small" type="dashed" onClick={handleAiFill} loading={ai.loading} style={{ marginBottom: 12 }}>
              Madad: Auto-fill from history
            </Button>
          )}

          {aiVisible && (
            <AiSuggestionCard
              loading={ai.loading}
              error={ai.error}
              aiAvailable={ai.aiAvailable}
              cached={ai.cached}
              onDismiss={() => setAiVisible(false)}
              onRetry={handleAiFill}
              style={{ marginBottom: 12 }}
            >
              {ai.data?.data && (
                <div>
                  <Text style={{ fontSize: 12, color: '#374151' }}>{ai.data.data.summary}</Text>
                  <div style={{ marginTop: 8 }}>
                    {(ai.data.data.suggestions || []).map((s, i) => (
                      <Tag key={i} color={s.confidence === 'high' ? 'green' : s.confidence === 'medium' ? 'orange' : 'default'} style={{ marginBottom: 4 }}>
                        {s.item_name} × {s.suggested_qty}
                      </Tag>
                    ))}
                  </div>
                  <Button size="small" type="primary" onClick={() => applyAiSuggestion(ai.data.data)} style={{ marginTop: 8 }}>
                    Apply Suggestions
                  </Button>
                </div>
              )}
            </AiSuggestionCard>
          )}

          <Form.Item name="subject" label="Subject">
            <Input placeholder="Brief description of the RFQ" />
          </Form.Item>

          {editing && (
            <Form.Item name="status" label="Status">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          )}

          <Form.Item name="notes" label="Internal Notes">
            <Input.TextArea rows={2} placeholder="Internal notes…" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Line Items
          </Divider>

          <div className="res-line-items">
          {/* Line item header — drawer 760px - 48px padding = 712px content */}
          {/* columns: Item(150) CustNo(96) Desc(1fr) Qty(54) Unit(56) Price(80) Drawing(32) Remove(24) */}
          <div style={{ display: 'grid', gridTemplateColumns: '150px 96px 1fr 54px 56px 80px 56px 24px', gap: 6, marginBottom: 6 }}>
            {['Item (optional)', 'Cust. Part No', 'Description', 'Qty', 'Unit', 'Target Price', '', ''].map((h, idx) => (
              <Text key={idx} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {/* Column sub-header for Drawing */}
          <div style={{ display: 'grid', gridTemplateColumns: '150px 96px 1fr 54px 56px 80px 56px 24px', gap: 6, marginBottom: 4 }}>
            <span /><span /><span /><span /><span /><span />
            <Tooltip title="Attach drawing (PDF / JPG / PNG, max 10 MB)">
              <Text style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', display: 'block' }}>Dwg</Text>
            </Tooltip>
            <span />
          </div>

          {lineItems.map((row) => (
            <div
              key={row._key}
              style={{ display: 'grid', gridTemplateColumns: '150px 96px 1fr 54px 56px 80px 56px 24px', gap: 6, marginBottom: 8, alignItems: 'center' }}
            >
              {/* Item select */}
              <Select
                showSearch
                placeholder="Select item"
                optionFilterProp="label"
                value={row.item_id}
                onChange={(v) => onItemSelect(row._key, v)}
                allowClear
                options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))}
                size="small"
              />

              {/* Customer part no */}
              <Input
                size="small"
                placeholder="Cust. part no."
                value={row.customer_item_code}
                onChange={(e) => updateLine(row._key, 'customer_item_code', e.target.value)}
              />

              {/* Description */}
              <Input
                size="small"
                placeholder="Description"
                value={row.description}
                onChange={(e) => updateLine(row._key, 'description', e.target.value)}
              />

              {/* Qty */}
              <InputNumber
                size="small"
                min={0}
                value={row.qty}
                onChange={(v) => updateLine(row._key, 'qty', v)}
                style={{ width: '100%' }}
              />

              {/* Unit */}
              <Input
                size="small"
                placeholder="unit"
                value={row.unit}
                onChange={(e) => updateLine(row._key, 'unit', e.target.value)}
              />

              {/* Target price */}
              <InputNumber
                size="small"
                min={0}
                precision={2}
                placeholder="₹ price"
                value={row.target_price}
                onChange={(v) => updateLine(row._key, 'target_price', v)}
                style={{ width: '100%' }}
              />

              {/* Drawing upload / view buttons */}
              {uploadingKey === row._key ? (
                <Button size="small" type="text" icon={<LoadingOutlined spin />} disabled style={{ width: 32 }} />
              ) : row.drawing_url ? (
                <Tooltip
                  title={
                    <span>
                      <strong>{row.drawing_name || 'Drawing attached'}</strong>
                      <br />
                      <span style={{ fontSize: 11, color: '#86efac' }}>
                        👁 View &nbsp;·&nbsp; 📎 Replace &nbsp;·&nbsp; 🗑 Right-click to remove
                      </span>
                    </span>
                  }
                >
                  <Space size={0}>
                    <Button
                      size="small"
                      type="text"
                      style={{ color: '#16a34a', padding: '0 2px' }}
                      icon={<EyeOutlined />}
                      onClick={() => openDrawing(row.drawing_url)}
                    />
                    <Button
                      size="small"
                      type="text"
                      style={{ color: '#16a34a', padding: '0 2px' }}
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleDrawingClick(row._key)}
                      onContextMenu={(e) => { e.preventDefault(); removeDrawing(row._key); }}
                    />
                  </Space>
                </Tooltip>
              ) : (
                <Tooltip title="Attach drawing (PDF / JPG / PNG)">
                  <Button
                    size="small"
                    type="text"
                    style={{ color: '#9ca3af', width: 32 }}
                    icon={<PaperClipOutlined />}
                    onClick={() => handleDrawingClick(row._key)}
                  />
                </Tooltip>
              )}

              {/* Remove row */}
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

          {/* Drawing legend */}
          <div style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: '#9ca3af' }}>
              <PaperClipOutlined /> = click to attach &nbsp;·&nbsp;
              <EyeOutlined style={{ color: '#16a34a' }} /> = open drawing &nbsp;·&nbsp;
              <CheckCircleOutlined style={{ color: '#16a34a' }} /> = click to replace, right-click to remove
            </Text>
          </div>
          </div>{/* /res-line-items */}
        </Form>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload RFQs"
        entityName="RFQ"
        sampleHeaders={CSV_HEADERS}
        sampleRows={CSV_SAMPLE}
        validationRules={CSV_VALIDATION}
      />
    </AppLayout>
  );
}
