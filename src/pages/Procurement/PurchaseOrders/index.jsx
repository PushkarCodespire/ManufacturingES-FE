import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col, Modal, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  PlusCircleOutlined, MinusCircleOutlined,
  SendOutlined, InboxOutlined, BulbOutlined,
  WarningOutlined, CheckCircleOutlined as CheckCircleFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout            from '../../../components/AppLayout';
import usePermissions       from '../../../hooks/usePermissions';
import { purchaseOrderApi } from '../../../api/procurement.api';
import { vendorApi }        from '../../../api/vendor.api';
import { itemApi }          from '../../../api/item.api';
import aiApi                from '../../../api/ai.api';
import useAiSuggestion      from '../../../hooks/useAiSuggestion';
import AiSuggestionCard     from '../../../components/AiSuggestion/AiSuggestionCard';

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

const STATUS_CONFIG = {
  draft:     { color: 'default', label: 'Draft'    },
  sent:      { color: 'blue',    label: 'Sent'     },
  partial:   { color: 'orange',  label: 'Partial'  },
  received:  { color: 'green',   label: 'Received' },
  cancelled: { color: 'red',     label: 'Cancelled'},
};

const emptyLine = () => ({
  _key:        Date.now() + Math.random(),
  item_id:     null,
  qty_ordered: null,
  unit_price:  null,
  unit:        'pcs',
});

export default function PurchaseOrdersPage() {
  const { can } = usePermissions();
  const canWrite = can('plan-po-create_po-create_edit_delete');

  const [pos,          setPOs]          = useState([]);
  const [vendors,      setVendors]      = useState([]);
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [vendorFilter, setVendorFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [lineItems,  setLineItems]  = useState([emptyLine()]);

  // Receive modal state
  const [receiveModal,  setReceiveModal]  = useState(false);
  const [receivingPO,   setReceivingPO]   = useState(null);
  const [receiveLines,  setReceiveLines]  = useState([]);
  const [receiveSaving, setReceiveSaving] = useState(false);

  const [form] = Form.useForm();

  // AI state
  const aiRisk = useAiSuggestion(aiApi.getPoAiRiskFlag);
  const [aiPoDrawerOpen, setAiPoDrawerOpen] = useState(false);
  const [aiPoRecord, setAiPoRecord] = useState(null);

  const openAiPoDrawer = (po) => {
    setAiPoRecord(po);
    setAiPoDrawerOpen(true);
    aiRisk.reset();
    aiRisk.fetch(po.id);
  };
  const closeAiPoDrawer = () => {
    setAiPoDrawerOpen(false);
    setAiPoRecord(null);
    aiRisk.reset();
  };

  // ── Load POs ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (search)       p.search    = search;
      if (vendorFilter) p.vendor_id = vendorFilter;
      if (statusFilter) p.status    = statusFilter;
      const data = await purchaseOrderApi.getAll(p);
      setPOs(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load purchase orders'); }
    finally { setLoading(false); }
  }, [search, vendorFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      vendorApi.getAll({ limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
    ]).then(([v, i]) => {
      setVendors(Array.isArray(v) ? v : (v?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total        = pos.length;
  const countDraft   = pos.filter((r) => r.status === 'draft').length;
  const countSent    = pos.filter((r) => r.status === 'sent').length;
  const countReceived= pos.filter((r) => r.status === 'received').length;

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ order_date: dayjs() });
    setLineItems([emptyLine()]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      vendor_id:     record.vendor_id,
      order_date:    record.order_date    ? dayjs(record.order_date)    : null,
      expected_date: record.expected_date ? dayjs(record.expected_date) : null,
      notes:         record.notes,
    });
    const lines = (record.Items || record.LineItems || []).map((it) => ({
      _key:        it.id || Date.now() + Math.random(),
      item_id:     it.item_id,
      qty_ordered: parseFloat(it.qty_ordered) || null,
      unit_price:  parseFloat(it.unit_price)  || null,
      unit:        it.unit || 'pcs',
    }));
    setLineItems(lines.length ? lines : [emptyLine()]);
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        vendor_id:     vals.vendor_id,
        order_date:    vals.order_date?.format('YYYY-MM-DD'),
        expected_date: vals.expected_date?.format('YYYY-MM-DD') || null,
        notes:         vals.notes || '',
        items:         lineItems.map(({ _key, ...it }) => it),
      };
      if (editing) {
        await purchaseOrderApi.update(editing.id, payload);
        message.success('Purchase order updated');
      } else {
        await purchaseOrderApi.create(payload);
        message.success('Purchase order created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onSend = async (id) => {
    try {
      await purchaseOrderApi.send(id);
      message.success('Purchase order sent to vendor');
      load();
    } catch (err) { message.error(err?.message || 'Send failed'); }
  };

  const openReceiveModal = (record) => {
    setReceivingPO(record);
    const lines = (record.Items || record.LineItems || []).map((it) => ({
      id:           it.id,
      item_name:    it.Item?.name || it.item_name || `Item #${it.item_id}`,
      qty_ordered:  parseFloat(it.qty_ordered) || 0,
      qty_received: 0,
    }));
    setReceiveLines(lines);
    setReceiveModal(true);
  };

  const onReceive = async () => {
    setReceiveSaving(true);
    try {
      await purchaseOrderApi.receive(receivingPO.id, { items: receiveLines });
      message.success('Receipt recorded');
      setReceiveModal(false);
      load();
    } catch (err) {
      message.error(err?.message || 'Receive failed');
    } finally { setReceiveSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await purchaseOrderApi.delete(id);
      message.success('Purchase order deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Line item helpers ──────────────────────────────────────────────────────
  const addLine    = () => setLineItems((p) => [...p, emptyLine()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));
  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  const lineTotal = lineItems.reduce(
    (sum, r) => sum + ((r.qty_ordered || 0) * (r.unit_price || 0)), 0
  );

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'PO No', dataIndex: 'po_no', key: 'po_no', width: 150,
      render: (no, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => r.status === 'draft' && canWrite && openEdit(r)}
        >
          {no}
        </Text>
      ),
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
      title: 'Order Date', dataIndex: 'order_date', key: 'order_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Expected Date', dataIndex: 'expected_date', key: 'expected_date', width: 120,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Items', key: 'items', width: 70, align: 'center',
      render: (_, r) => (
        <Badge
          count={(r.Items || r.LineItems || []).length}
          style={{ backgroundColor: '#e0e7ff', color: '#1d4ed8' }}
        />
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
      title: 'Created By', key: 'creator', width: 120,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Creator?.name || '—'}</Text>,
    },
    {
      title: 'AI', key: 'ai', width: 54, align: 'center',
      render: (_, r) => (
        <Tooltip title="AI Risk Analysis">
          <Button
            size="small"
            icon={<BulbOutlined />}
            style={{ color: '#7c3aed', borderColor: '#7c3aed' }}
            onClick={() => openAiPoDrawer(r)}
          />
        </Tooltip>
      ),
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 170,
      render: (_, r) => {
        const isDraft    = r.status === 'draft';
        const canReceive = ['sent', 'partial'].includes(r.status);
        return (
          <Space size={4}>
            {isDraft && (
              <Popconfirm
                title="Send this PO to vendor?"
                onConfirm={() => onSend(r.id)}
                okText="Send"
                okType="primary"
              >
                <Tooltip title="Send to Vendor">
                  <Button size="small" type="primary" ghost icon={<SendOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
            {canReceive && (
              <Tooltip title="Record Receipt">
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<InboxOutlined />}
                  style={{ borderColor: '#16a34a', color: '#16a34a' }}
                  onClick={() => openReceiveModal(r)}
                />
              </Tooltip>
            )}
            {isDraft && (
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
            )}
            {isDraft && (
              <Popconfirm
                title="Delete this purchase order?"
                onConfirm={() => onDelete(r.id)}
                okText="Delete"
                okType="danger"
              >
                <Tooltip title="Delete">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    }] : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Purchase Orders</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Purchase Orders</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Raise and track purchase orders to vendors.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="default">Draft: {countDraft}</Tag>
        <Tag color="blue">Sent: {countSent}</Tag>
        <Tag color="green">Received: {countReceived}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search PO number..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by vendor"
            allowClear
            value={vendorFilter}
            onChange={setVendorFilter}
            showSearch
            optionFilterProp="label"
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 150 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              New PO
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={pos}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit PO — ${editing.po_no}` : 'New Purchase Order'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update PO' : 'Create PO'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="vendor_id"
            label="Vendor"
            rules={[{ required: true, message: 'Select a vendor' }]}
          >
            <Select
              showSearch
              placeholder="Select vendor"
              optionFilterProp="label"
              options={vendors.map((v) => ({
                value: v.id,
                label: `${v.name}${v.partner_code ? ` (${v.partner_code})` : ''}`,
              }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="order_date"
                label="Order Date"
                rules={[{ required: true, message: 'Select order date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expected_date" label="Expected Delivery Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Terms, notes…" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Line Items
          </Divider>

          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 60px 28px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Qty', 'Unit Price', 'Unit', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => (
            <div
              key={row._key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 90px 60px 28px',
                gap: 6,
                marginBottom: 8,
                alignItems: 'center',
              }}
            >
              <Select
                showSearch
                size="small"
                placeholder="Select item"
                optionFilterProp="label"
                value={row.item_id}
                onChange={(v) => {
                  const master = items.find((i) => i.id === v);
                  setLineItems((prev) => prev.map((r) =>
                    r._key === row._key
                      ? { ...r, item_id: v ?? null, unit: master?.unit || r.unit || 'pcs' }
                      : r
                  ));
                }}
                allowClear
                options={items.map((i) => ({
                  value: i.id,
                  label: `${i.name}${i.code ? ` (${i.code})` : ''}`,
                }))}
              />
              <InputNumber
                size="small"
                min={0}
                precision={0}
                value={row.qty_ordered}
                onChange={(v) => updateLine(row._key, 'qty_ordered', v)}
                style={{ width: '100%' }}
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
              {/* Unit — auto-filled from item master, disabled when sourced from master */}
              <Tooltip
                title={row.item_id && items.find((i) => i.id === row.item_id)?.unit
                  ? 'Unit is set from item master'
                  : null}
              >
                <Input
                  size="small"
                  placeholder="pcs"
                  value={row.unit}
                  disabled={!!(row.item_id && items.find((i) => i.id === row.item_id)?.unit)}
                  onChange={(e) => updateLine(row._key, 'unit', e.target.value)}
                  style={{
                    background: (row.item_id && items.find((i) => i.id === row.item_id)?.unit)
                      ? '#f3f4f6' : undefined,
                    color: '#374151',
                    cursor: (row.item_id && items.find((i) => i.id === row.item_id)?.unit)
                      ? 'not-allowed' : undefined,
                  }}
                />
              </Tooltip>
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

          {lineTotal > 0 && (
            <div
              style={{
                marginTop:   12,
                padding:     '8px 12px',
                background:  '#f0fdf4',
                border:      '1px solid #bbf7d0',
                borderRadius: 8,
                textAlign:   'right',
              }}
            >
              <Text strong style={{ color: '#166534' }}>
                Order Total: ₹{lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
            </div>
          )}
        </Form>
      </Drawer>

      {/* ── Receive Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={`Record Receipt — ${receivingPO?.po_no}`}
        open={receiveModal}
        onCancel={() => setReceiveModal(false)}
        onOk={onReceive}
        okText="Record Receipt"
        okButtonProps={{ loading: receiveSaving }}
        width={600}
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={receiveLines}
          columns={[
            {
              title: 'Item',
              dataIndex: 'item_name',
              key: 'item_name',
            },
            {
              title: 'Qty Ordered',
              dataIndex: 'qty_ordered',
              key: 'qty_ordered',
              width: 110,
              align: 'right',
              render: (v) => v.toLocaleString(),
            },
            {
              title: 'Qty Received',
              key: 'qty_received',
              width: 130,
              render: (_, row) => (
                <InputNumber
                  size="small"
                  min={0}
                  max={row.qty_ordered}
                  precision={0}
                  value={row.qty_received}
                  onChange={(v) =>
                    setReceiveLines((prev) =>
                      prev.map((r) => r.id === row.id ? { ...r, qty_received: v || 0 } : r)
                    )
                  }
                  style={{ width: 90 }}
                />
              ),
            },
          ]}
        />
      </Modal>
      {/* ── AI Risk Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <BulbOutlined style={{ color: '#7c3aed' }} />
            <span>AI Risk Analysis — {aiPoRecord?.po_no}</span>
          </Space>
        }
        open={aiPoDrawerOpen}
        onClose={closeAiPoDrawer}
        width={500}
      >
        {aiPoRecord && (
          <>
            <Space wrap style={{ marginBottom: 16 }}>
              <Tag color="blue">{aiPoRecord.po_no}</Tag>
              {aiPoRecord.Vendor && <Tag color="purple">{aiPoRecord.Vendor.name}</Tag>}
              <Tag color={STATUS_CONFIG[aiPoRecord.status]?.color || 'default'}>
                {STATUS_CONFIG[aiPoRecord.status]?.label || aiPoRecord.status}
              </Tag>
              {aiPoRecord.expected_date && (
                <Tag>Due: {dayjs(aiPoRecord.expected_date).format('DD MMM YYYY')}</Tag>
              )}
            </Space>

            <AiSuggestionCard
              loading={aiRisk.loading}
              error={aiRisk.error}
              aiAvailable={aiRisk.aiAvailable}
              cached={aiRisk.cached}
              onRetry={() => aiRisk.fetch(aiPoRecord.id)}
              onDismiss={closeAiPoDrawer}
            >
              {(() => {
                const d = aiRisk.data;
                if (!d) return null;
                const insight = parseInsight(d.ai_insight);
                if (!insight) return null;
                return (
                  <div style={{ fontSize: 13 }}>
                    {/* Overall risk + confidence */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {insight.overall_risk && (
                        <Tag color={
                          insight.overall_risk === 'high' ? 'red' :
                          insight.overall_risk === 'medium' ? 'orange' : 'green'
                        } style={{ fontWeight: 600 }}>
                          Overall Risk: {insight.overall_risk?.toUpperCase()}
                        </Tag>
                      )}
                      {insight.delivery_risk && (
                        <Tag color={
                          insight.delivery_risk === 'high' ? 'red' :
                          insight.delivery_risk === 'medium' ? 'orange' : 'green'
                        }>
                          Delivery: {insight.delivery_risk}
                        </Tag>
                      )}
                      {insight.confidence && <Tag color="geekblue">Confidence: {insight.confidence}</Tag>}
                    </div>

                    {/* Context from backend */}
                    {(d.days_to_delivery != null || d.total_value != null || d.overdue_pos_for_vendor != null) && (
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                        marginBottom: 12,
                      }}>
                        {d.days_to_delivery != null && (
                          <div style={{ padding: '6px 10px', background: d.days_to_delivery < 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>Days to Delivery</div>
                            <div style={{ fontWeight: 700, color: d.days_to_delivery < 0 ? '#dc2626' : '#166534' }}>
                              {d.days_to_delivery < 0 ? `${Math.abs(d.days_to_delivery)} overdue` : d.days_to_delivery}
                            </div>
                          </div>
                        )}
                        {d.total_value != null && (
                          <div style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>PO Value</div>
                            <div style={{ fontWeight: 700, color: '#1d4ed8' }}>₹{parseFloat(d.total_value).toLocaleString('en-IN')}</div>
                          </div>
                        )}
                        {d.overdue_pos_for_vendor != null && (
                          <div style={{ padding: '6px 10px', background: d.overdue_pos_for_vendor > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>Vendor Overdue POs</div>
                            <div style={{ fontWeight: 700, color: d.overdue_pos_for_vendor > 0 ? '#d97706' : '#166534' }}>
                              {d.overdue_pos_for_vendor}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expedite warning */}
                    {insight.expedite_required && (
                      <Alert
                        type="warning"
                        showIcon
                        icon={<WarningOutlined />}
                        message="Expedite Required"
                        description="This PO requires expedited follow-up with the vendor."
                        style={{ marginBottom: 12, fontSize: 12 }}
                      />
                    )}

                    {/* Risk factors */}
                    {Array.isArray(insight.risk_factors) && insight.risk_factors.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>Risk Factors</Text>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {insight.risk_factors.map((item, i) => (
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
    </AppLayout>
  );
}
