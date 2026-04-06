import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Select, Typography, Modal, message,
  Tooltip, Tabs, Tag, Divider, InputNumber, Space,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  DollarOutlined,
  RightOutlined,
  InfoCircleOutlined,
  ShopOutlined,
  AppstoreOutlined,
  MinusCircleOutlined,
  TagOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { costingApi } from '../../../api/costing.api';
import { vendorApi }  from '../../../api/vendor.api';
import { itemApi }    from '../../../api/item.api';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

const { Title, Text } = Typography;
const { Option }      = Select;

const fmtDate     = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');
const fmtCurrency = (v)   =>
  v != null
    ? `₹ ${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

// ── Stat chip — identical pattern to Configuration ─────────────────────────────
const StatChip = ({ label, value, color, bg }) => (
  <div
    style={{
      padding: '8px 16px', background: bg,
      border: `1px solid ${color}30`, borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90,
    }}
  >
    <Text style={{ color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{value}</Text>
    <Text style={{ color, fontSize: 11, opacity: 0.8 }}>{label}</Text>
  </div>
);

// ── Row key counter for the add modal ─────────────────────────────────────────
let _rowKey = 0;
const makeRow = () => ({ key: ++_rowKey, item_id: null, price_per_unit: null, min_order_qty: null, lead_time_days: null });

// ══════════════════════════════════════════════════════════════════════════════
//  ADD PRICING MODAL
// ══════════════════════════════════════════════════════════════════════════════
const AddPricingModal = ({ open, type, vendors, items, onClose, onSaved }) => {
  const [vendorId, setVendorId] = useState(null);
  const [rows,     setRows]     = useState([makeRow()]);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (open) { setVendorId(null); setRows([makeRow()]); }
  }, [open]);

  const setRowField = (key, field, value) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const addRow    = () => setRows((prev) => [...prev, makeRow()]);
  const removeRow = (key) => { if (rows.length > 1) setRows((prev) => prev.filter((r) => r.key !== key)); };

  const handleSubmit = async () => {
    if (!vendorId) { message.warning('Please select a vendor'); return; }

    const incomplete = rows.filter((r) => !r.item_id || r.price_per_unit == null);
    if (incomplete.length) { message.warning('Fill in Item Code and Price for every row'); return; }

    const ids = rows.map((r) => r.item_id);
    if (new Set(ids).size !== ids.length) { message.warning('Duplicate items — each item can appear only once'); return; }

    setSaving(true);
    try {
      const payload = rows.map((r) => ({
        vendor_id:      vendorId,
        item_id:        r.item_id,
        type,
        price_per_unit: r.price_per_unit,
        min_order_qty:  r.min_order_qty  || null,
        lead_time_days: r.lead_time_days || null,
      }));
      await costingApi.create(payload);
      message.success(`${payload.length} pricing record${payload.length > 1 ? 's' : ''} created`);
      onSaved();
      onClose();
    } catch (err) {
      message.error(err?.message || 'Failed to create pricing');
    } finally {
      setSaving(false);
    }
  };

  const typeLabel  = type === 'purchase' ? 'Purchase' : 'Sales';
  const usedItemIds = rows.map((r) => r.item_id).filter(Boolean);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={880}
      title={null}
      destroyOnClose
      styles={{ body: { padding: '24px 28px' } }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: type === 'purchase' ? '#eff6ff' : '#f0fdf4',
            border:     `1px solid ${type === 'purchase' ? '#bfdbfe' : '#bbf7d0'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: type === 'purchase' ? '#1d4ed8' : '#16a34a', fontSize: 16,
          }}
        >
          <DollarOutlined />
        </div>
        <div>
          <Title level={5} style={{ margin: 0, color: '#111827' }}>Add Pricing For</Title>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {typeLabel} Pricing — choose a vendor and configure item prices
          </Text>
        </div>
      </div>

      {/* Vendor selector */}
      <div style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
          Vendor <span style={{ color: '#ef4444' }}>*</span>
        </Text>
        <Select
          showSearch
          placeholder="Select vendor…"
          optionFilterProp="children"
          value={vendorId}
          onChange={setVendorId}
          style={{ width: '100%' }}
        >
          {vendors.map((v) => (
            <Option key={v.id} value={v.id}>
              <Space size={6}>
                <Text style={{ fontFamily: 'monospace', color: '#6b7280', fontSize: 12 }}>{v.partner_code}</Text>
                {v.name}
              </Space>
            </Option>
          ))}
        </Select>
      </div>

      <Divider style={{ margin: '0 0 16px' }} />

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 140px 120px 130px 28px',
          gap: 10, marginBottom: 6,
        }}
      >
        {['Item Code', 'Item Name', 'Price / Unit (₹)', 'Min Order Qty', 'Lead Time', ''].map((h, i) => (
          <Text key={i} style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {h}
          </Text>
        ))}
      </div>

      {/* Item rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => {
          const selectedItem = items.find((it) => it.id === row.item_id);
          return (
            <div
              key={row.key}
              style={{ display: 'grid', gridTemplateColumns: '220px 1fr 140px 120px 130px 28px', gap: 10, alignItems: 'center' }}
            >
              {/* Item Code */}
              <Select
                showSearch
                placeholder="Code…"
                optionFilterProp="children"
                value={row.item_id}
                onChange={(v) => setRowField(row.key, 'item_id', v)}
                style={{ width: '100%' }}
              >
                {items.map((it) => (
                  <Option key={it.id} value={it.id} disabled={usedItemIds.includes(it.id) && it.id !== row.item_id}>
                    <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>{it.code}</Text>
                  </Option>
                ))}
              </Select>

              {/* Item Name — auto-fill, disabled */}
              <div
                style={{
                  height: 32, borderRadius: 6, background: '#f9fafb',
                  border: '1px solid #e5e7eb', padding: '0 12px',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <Text ellipsis style={{ fontSize: 12, color: selectedItem ? '#374151' : '#9ca3af' }}>
                  {selectedItem ? selectedItem.name : 'Select item code first'}
                </Text>
              </div>

              {/* Price per unit */}
              <InputNumber
                placeholder="0.00"
                min={0}
                step={0.01}
                precision={2}
                style={{ width: '100%' }}
                value={row.price_per_unit}
                onChange={(v) => setRowField(row.key, 'price_per_unit', v)}
              />

              {/* Min order qty */}
              <InputNumber
                placeholder="Qty"
                min={1}
                precision={0}
                style={{ width: '100%' }}
                value={row.min_order_qty}
                onChange={(v) => setRowField(row.key, 'min_order_qty', v)}
                addonAfter={
                  <Tooltip title="Minimum quantity that must be ordered in one purchase">
                    <InfoCircleOutlined style={{ color: '#9ca3af' }} />
                  </Tooltip>
                }
              />

              {/* Lead time */}
              <InputNumber
                placeholder="0"
                min={0}
                precision={0}
                style={{ width: '100%' }}
                value={row.lead_time_days}
                onChange={(v) => setRowField(row.key, 'lead_time_days', v)}
                addonAfter={
                  <Tooltip title="Expected days from order placement to delivery">
                    <InfoCircleOutlined style={{ color: '#9ca3af' }} />
                  </Tooltip>
                }
              />

              {/* Remove row */}
              <Button
                type="text" danger size="small"
                icon={<MinusCircleOutlined />}
                disabled={rows.length === 1}
                onClick={() => removeRow(row.key)}
                style={{ padding: 0, opacity: rows.length === 1 ? 0.3 : 1 }}
              />
            </div>
          );
        })}
      </div>

      {/* Add another row */}
      <Button
        type="link"
        icon={<PlusOutlined />}
        onClick={addRow}
        style={{ padding: 0, marginTop: 12, fontWeight: 600 }}
      >
        + Add Another Item
      </Button>

      <Divider style={{ margin: '16px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button onClick={onClose} style={{ borderRadius: 8 }}>Cancel</Button>
        <Button
          type="primary"
          loading={saving}
          onClick={handleSubmit}
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          Create Costing
        </Button>
      </div>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  EDIT PRICING MODAL
// ══════════════════════════════════════════════════════════════════════════════
const EditPricingModal = ({ open, record, onClose, onSaved }) => {
  const [price,    setPrice]    = useState(null);
  const [moq,      setMoq]      = useState(null);
  const [leadTime, setLeadTime] = useState(null);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (open && record) {
      setPrice(record.price_per_unit    != null ? parseFloat(record.price_per_unit)   : null);
      setMoq(record.min_order_qty       != null ? parseInt(record.min_order_qty, 10)   : null);
      setLeadTime(record.lead_time_days != null ? parseInt(record.lead_time_days, 10)  : null);
    }
  }, [open, record]);

  const handleSubmit = async () => {
    if (price == null) { message.warning('Price per unit is required'); return; }
    setSaving(true);
    try {
      await costingApi.update(record.id, {
        price_per_unit: price,
        min_order_qty:  moq      || null,
        lead_time_days: leadTime || null,
      });
      message.success('Pricing updated');
      onSaved();
      onClose();
    } catch (err) {
      message.error(err?.message || 'Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

  if (!record) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={460}
      title={
        <div style={{ paddingTop: 4 }}>
          <Text style={{ fontWeight: 700, fontSize: 15, color: '#111827', display: 'block' }}>Edit Pricing</Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {record.Vendor?.name} — {record.Item?.code}
          </Text>
        </div>
      }
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Price per Unit (₹) <span style={{ color: '#ef4444' }}>*</span>
          </Text>
          <InputNumber
            placeholder="0.00"
            min={0}
            step={0.01}
            precision={2}
            value={price}
            onChange={setPrice}
            style={{ width: '100%' }}
            prefix="₹"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Min Order Qty{' '}
              <Tooltip title="Minimum quantity per purchase order">
                <InfoCircleOutlined style={{ color: '#9ca3af' }} />
              </Tooltip>
            </Text>
            <InputNumber placeholder="—" min={1} precision={0} value={moq} onChange={setMoq} style={{ width: '100%' }} />
          </div>
          <div>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Lead Time{' '}
              <Tooltip title="Expected days from order to delivery">
                <InfoCircleOutlined style={{ color: '#9ca3af' }} />
              </Tooltip>
            </Text>
            <InputNumber placeholder="—" min={0} precision={0} value={leadTime} onChange={setLeadTime} style={{ width: '100%' }} addonAfter="Days" />
          </div>
        </div>
      </div>

      <Divider style={{ margin: '20px 0 16px' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button onClick={onClose} style={{ borderRadius: 8 }}>Cancel</Button>
        <Button type="primary" loading={saving} onClick={handleSubmit} style={{ borderRadius: 8, fontWeight: 600 }}>
          Update Pricing
        </Button>
      </div>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
// ── CSV Upload config ────────────────────────────────────────────────────────
const COSTING_CSV_HEADERS = [
  'Vendor Code', 'Item Code', 'Type', 'Price per Unit', 'Min Order Qty', 'Lead Time (days)',
];

const COSTING_CSV_SAMPLE = [
  {
    'Vendor Code': 'V-001', 'Item Code': 'ITM-001', 'Type': 'purchase',
    'Price per Unit': '150.00', 'Min Order Qty': '100', 'Lead Time (days)': '7',
  },
];

const COSTING_VALIDATION_RULES = [
  { field: 'Vendor Code', required: true },
  { field: 'Item Code', required: true },
  { field: 'Price per Unit', required: true },
];

const CostingPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('sites-costing-create_edit_delete');

  const [costings,       setCostings]       = useState([]);
  const [vendors,        setVendors]        = useState([]);
  const [items,          setItems]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [tab,            setTab]            = useState('purchase');  // purchase | sales
  const [viewMode,       setViewMode]       = useState('vendor');    // vendor | item
  const [filterVendorId, setFilterVendorId] = useState(null);
  const [addOpen,        setAddOpen]        = useState(false);
  const [editRecord,     setEditRecord]     = useState(null);
  const [csvModalOpen,   setCsvModalOpen]   = useState(false);

  // Load vendors + items once
  useEffect(() => {
    vendorApi.getAll({ type: 'vendor' }).then((d) => setVendors(d ?? [])).catch(() => {});
    itemApi.getAll({ limit: 10000 }).then((d) => setItems(d?.data ?? [])).catch(() => {});
  }, []);

  // Fetch costings on tab / vendor filter change
  const fetchCostings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { type: tab };
      if (filterVendorId) params.vendor_id = filterVendorId;
      const data = await costingApi.getAll(params);
      setCostings(data ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  }, [tab, filterVendorId]);

  useEffect(() => { fetchCostings(); }, [fetchCostings]);

  // Delete handler
  const handleDelete = (record) => {
    Modal.confirm({
      title:   'Delete pricing record?',
      content: `Remove ${record.type} pricing for "${record.Item?.name}" from "${record.Vendor?.name}"? This cannot be undone.`,
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await costingApi.delete(record.id);
          message.success('Pricing record deleted');
          fetchCostings();
        } catch (err) {
          message.error(err?.message || 'Failed to delete record');
        }
      },
    });
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0;
    let failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const vendorCode = row['Vendor Code'] || '';
        const itemCode = row['Item Code'] || '';
        const vendor = vendors.find((v) => v.partner_code === vendorCode || v.name?.toLowerCase() === vendorCode.toLowerCase());
        const item = items.find((i) => i.code === itemCode || i.name?.toLowerCase() === itemCode.toLowerCase());
        if (!vendor) throw new Error(`Vendor "${vendorCode}" not found`);
        if (!item) throw new Error(`Item "${itemCode}" not found`);
        await costingApi.create([{
          vendor_id:      vendor.id,
          item_id:        item.id,
          type:           (row['Type'] || 'purchase').toLowerCase(),
          price_per_unit: parseFloat(row['Price per Unit']) || 0,
          min_order_qty:  row['Min Order Qty'] ? parseInt(row['Min Order Qty'], 10) : null,
          lead_time_days: row['Lead Time (days)'] ? parseInt(row['Lead Time (days)'], 10) : null,
        }]);
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Vendor Code']}-${row['Item Code']}": ${err?.message || 'Failed'}`);
      }
    }
    fetchCostings();
    return { success, failed, errors };
  };

  // ── Build table columns ────────────────────────────────────────────────────
  const vendorCol = {
    title:  'Vendor',
    key:    'vendor',
    width:  220,
    render: (_, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#eff6ff', border: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1d4ed8', fontSize: 16, flexShrink: 0,
          }}
        >
          <ShopOutlined />
        </div>
        <div style={{ minWidth: 0 }}>
          <Text style={{ color: '#111827', fontWeight: 600, fontSize: 13, display: 'block' }}>
            {r.Vendor?.name}
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>
            {r.Vendor?.partner_code}
          </Text>
        </div>
      </div>
    ),
  };

  const itemCol = {
    title:  'Item Details',
    key:    'item',
    render: (_, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#f5f3ff', border: '1px solid #ddd6fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#7c3aed', fontSize: 16, flexShrink: 0,
          }}
        >
          <TagOutlined />
        </div>
        <div style={{ minWidth: 0 }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1d4ed8', display: 'block' }}>
            {r.Item?.code}
          </Text>
          <Text ellipsis style={{ fontSize: 13, color: '#111827' }}>{r.Item?.name}</Text>
          {r.Item?.unit && (
            <Tag style={{ marginTop: 2, fontSize: 10, lineHeight: '16px', padding: '0 6px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280' }}>
              {r.Item.unit}
            </Tag>
          )}
        </div>
      </div>
    ),
  };

  const columns = [
    ...(viewMode === 'vendor' ? [vendorCol, itemCol] : [itemCol, vendorCol]),
    {
      title:  'Price per Unit',
      key:    'price',
      width:  140,
      sorter: (a, b) => parseFloat(a.price_per_unit) - parseFloat(b.price_per_unit),
      render: (_, r) => (
        <Text style={{ fontWeight: 700, color: '#16a34a', fontSize: 14 }}>
          {fmtCurrency(r.price_per_unit)}
        </Text>
      ),
    },
    {
      title:  'Min Order Qty',
      key:    'moq',
      width:  120,
      sorter: (a, b) => (a.min_order_qty ?? 0) - (b.min_order_qty ?? 0),
      render: (_, r) => r.min_order_qty != null
        ? <Text style={{ fontWeight: 600 }}>{r.min_order_qty.toLocaleString('en-IN')}</Text>
        : <Text style={{ color: '#d1d5db' }}>—</Text>,
    },
    {
      title:  'Lead Time',
      key:    'lead_time',
      width:  110,
      sorter: (a, b) => (a.lead_time_days ?? 0) - (b.lead_time_days ?? 0),
      render: (_, r) => r.lead_time_days != null
        ? (
          <Space size={4}>
            <Text style={{ fontWeight: 600 }}>{r.lead_time_days}</Text>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>days</Text>
          </Space>
        )
        : <Text style={{ color: '#d1d5db' }}>—</Text>,
    },
    ...(canWrite ? [{
      title:  'Actions',
      key:    'actions',
      width:  100,
      align:  'center',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <Tooltip title="Edit pricing">
            <Button size="small" icon={<EditOutlined />} style={{ borderRadius: 6 }} onClick={() => setEditRecord(r)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} onClick={() => handleDelete(r)} />
          </Tooltip>
        </div>
      ),
    }] : []),
    {
      title:  'Created At',
      key:    'created',
      width:  160,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', color: '#111827' }}>
            {r.Creator?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(r.createdAt)}</Text>
        </div>
      ),
    },
    {
      title:  'Last Updated At',
      key:    'updated',
      width:  160,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', color: '#111827' }}>
            {r.Updater?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(r.updatedAt)}</Text>
        </div>
      ),
    },
  ];

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalAll      = costings.length;
  const purchaseCount = costings.filter((c) => c.type === 'purchase').length;
  const salesCount    = costings.filter((c) => c.type === 'sales').length;

  const selectedVendor = vendors.find((v) => v.id === filterVendorId);

  const displayData = [...costings].sort(
    viewMode === 'vendor'
      ? (a, b) => (a.Vendor?.name || '').localeCompare(b.Vendor?.name || '')
      : (a, b) => (a.Item?.name  || '').localeCompare(b.Item?.name  || '')
  );

  return (
    <AppLayout>
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Sites</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Costing</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Costing
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage purchase &amp; sales pricing for vendor–item pairs
        </Text>
      </div>

      {/* ── Stats — same pattern as Configuration ────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <StatChip label="Total Records"     value={totalAll}      color="#1d4ed8" bg="#eff6ff" />
        <StatChip label="Purchase Pricing"  value={purchaseCount} color="#b45309" bg="#fef3c7" />
        <StatChip label="Sales Pricing"     value={salesCount}    color="#16a34a" bg="#f0fdf4" />
      </div>

      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        {/* Tabs — Purchase / Sales */}
        <div style={{ padding: '0 20px' }}>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              { key: 'purchase', label: 'Purchase Pricing' },
              { key: 'sales',    label: 'Sales Pricing'    },
            ]}
            style={{ marginBottom: 0 }}
            tabBarStyle={{ marginBottom: 0 }}
          />
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* ── Toolbar — identical structure to Configuration ── */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>

            {/* Vendor filter */}
            <Select
              showSearch
              allowClear
              placeholder="Filter by vendor…"
              optionFilterProp="children"
              value={filterVendorId}
              onChange={setFilterVendorId}
              style={{ width: 240, borderRadius: 8 }}
            >
              {vendors.map((v) => <Option key={v.id} value={v.id}>{v.name}</Option>)}
            </Select>

            {/* View mode toggle */}
            <div
              style={{
                display: 'flex', background: '#f4f6f9',
                borderRadius: 8, padding: 3, gap: 2,
              }}
            >
              {[
                { mode: 'vendor', icon: <ShopOutlined />,     label: 'Vendor View' },
                { mode: 'item',   icon: <AppstoreOutlined />, label: 'Item View'   },
              ].map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, border: 'none',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: viewMode === mode ? '#1d4ed8' : 'transparent',
                    color:      viewMode === mode ? '#ffffff' : '#6b7280',
                    transition: 'all 0.15s',
                  }}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            <Button icon={<DownloadOutlined />} onClick={() => {
              const csvRows = displayData.map((c) => ({
                'Vendor Code': c.Vendor?.partner_code || '', 'Item Code': c.Item?.code || '',
                'Type': c.type || '', 'Price per Unit': c.price_per_unit ?? '',
                'Min Order Qty': c.min_order_qty ?? '', 'Lead Time (days)': c.lead_time_days ?? '',
              }));
              downloadSampleCsv('costing.csv', COSTING_CSV_HEADERS, csvRows);
            }}>Export CSV</Button>
            {canWrite && (
              <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={fetchCostings} style={{ borderRadius: 8 }}>
              Refresh
            </Button>

            {canWrite && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddOpen(true)}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Add Pricing
              </Button>
            )}
          </div>

          {/* ── Table ─────────────────────────────────────────────────── */}
          <Table
            rowKey="id"
            columns={columns}
            dataSource={displayData}
            loading={loading}
            pagination={{
              pageSize:  10,
              showTotal: (t) => `${t} pricing record${t !== 1 ? 's' : ''}`,
              style:     { marginBottom: 0 },
            }}
            scroll={{ x: 1050 }}
            size="middle"
            style={{ borderRadius: 8, overflow: 'hidden' }}
            locale={{
              emptyText: (
                <div style={{ padding: 40 }}>
                  <DollarOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                  <Text style={{ color: '#9ca3af' }}>
                    {filterVendorId && selectedVendor
                      ? `No ${tab} pricing configured for ${selectedVendor.name}`
                      : `No ${tab} pricing records found`}
                  </Text>
                  {canWrite && (
                    <>
                      <br />
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => setAddOpen(true)}
                        style={{ marginTop: 10 }}
                      >
                        Add Pricing
                      </Button>
                    </>
                  )}
                </div>
              ),
            }}
          />
        </div>
      </Card>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <AddPricingModal
        open={addOpen}
        type={tab}
        vendors={vendors}
        items={items}
        onClose={() => setAddOpen(false)}
        onSaved={fetchCostings}
      />
      <EditPricingModal
        open={Boolean(editRecord)}
        record={editRecord}
        onClose={() => setEditRecord(null)}
        onSaved={fetchCostings}
      />

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Costing"
        entityName="Pricing"
        sampleHeaders={COSTING_CSV_HEADERS}
        sampleRows={COSTING_CSV_SAMPLE}
        validationRules={COSTING_VALIDATION_RULES}
      />
    </AppLayout>
  );
};

export default CostingPage;
