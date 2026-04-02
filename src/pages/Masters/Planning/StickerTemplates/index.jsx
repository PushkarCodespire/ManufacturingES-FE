import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Table, Button, Input, Typography, Modal, message,
  Tag, Form, Select, InputNumber, Checkbox, Tabs, Divider,
  Tooltip, Badge, Spin,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  RightOutlined,
  QrcodeOutlined,
  BarcodeOutlined,
  PrinterOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  EyeOutlined,
  CopyOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { stickerTemplateApi } from '../../../../api/stickerTemplate.api';
import { machineApi }         from '../../../../api/machine.api';
import { vendorApi }          from '../../../../api/vendor.api';
import AppLayout              from '../../../../components/AppLayout';
import usePermissions         from '../../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../../utils/exportCsv';
import CsvUploadModal from '../../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../../utils/csvImport';

const { Title, Text } = Typography;
const { Option }      = Select;
const { TextArea }    = Input;

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// ── Template-for options ───────────────────────────────────────────────────────
const TEMPLATE_FOR_OPTIONS = [
  { value: 'Machine',   label: 'Machine'   },
  { value: 'Pack Type', label: 'Pack Type' },
];

// ── Key field options per template_for ─────────────────────────────────────────
const KEY_OPTIONS = {
  Machine:    ['Machine Code', 'Machine Name', 'Machine Type', 'Site Code', 'Site Name', 'Department'],
  'Pack Type': ['Pack Code', 'Pack Name', 'Item Code', 'Item Name', 'Batch No.', 'Serial No.', 'Quantity', 'Unit', 'MFG Date', 'Exp Date', 'Customer Code', 'Drawing No.'],
};

// ── Sticker type options ────────────────────────────────────────────────────────
const STICKER_TYPES = [
  { value: 'QR Code', label: 'QR Code'  },
  { value: 'Barcode', label: 'Barcode'  },
];

// ── Format options ─────────────────────────────────────────────────────────────
const FORMAT_OPTIONS = ['Basic', 'Compact', 'Detailed', 'Custom'];

// ── tag color per template_for ─────────────────────────────────────────────────
const TAG_COLOR = {
  Machine:    'blue',
  'Pack Type': 'purple',
};

// ── QR / Barcode Preview box ───────────────────────────────────────────────────
const QrPreview = ({ primaryKey, secondaryKey, separator, stickerType }) => {
  const content   = [primaryKey, secondaryKey].filter(Boolean).join(` ${separator || '/'} `);
  const isBarcode = stickerType === 'Barcode';
  const Icon      = isBarcode ? BarcodeOutlined : QrcodeOutlined;
  const label     = isBarcode ? 'Barcode Preview' : 'QR Preview';
  const emptyText = isBarcode ? 'Select keys to preview barcode' : 'Select keys to preview QR';

  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            10,
        padding:        '24px 16px',
        background:     '#f9fafb',
        border:         '1px dashed #d1d5db',
        borderRadius:   12,
        minHeight:      180,
      }}
    >
      <Icon style={{ fontSize: 80, color: '#374151' }} />
      {content ? (
        <div style={{ textAlign: 'center' }}>
          <Text style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', display: 'block' }}>
            {content}
          </Text>
        </div>
      ) : (
        <Text style={{ fontSize: 11, color: '#9ca3af' }}>{emptyText}</Text>
      )}
      <Text style={{ fontSize: 10, color: '#d1d5db' }}>{label}</Text>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT MODAL
// ══════════════════════════════════════════════════════════════════════════════
const TemplateModal = ({ record, open, onClose, onSaved, canWrite }) => {
  const [form]      = Form.useForm();
  const [saving,    setSaving]    = useState(false);
  const [machines,  setMachines]  = useState([]);
  const [customers, setCustomers] = useState([]);

  // Watch values for dynamic rendering
  const templateFor = Form.useWatch('template_for',  form);
  const primaryKey  = Form.useWatch('primary_key',   form);
  const secondaryKey= Form.useWatch('secondary_key', form);
  const separator   = Form.useWatch('separator',     form);
  const stickerType = Form.useWatch('sticker_type',  form);

  const isEdit = Boolean(record);

  useEffect(() => {
    if (open) {
      // Load reference data
      machineApi.getAll().then((d) => setMachines(d ?? [])).catch(() => {});
      vendorApi.getAll({ type: 'customer' }).then((d) => setCustomers(d ?? [])).catch(() => {});

      if (isEdit) {
        form.setFieldsValue({
          name:          record.name,
          template_for:  record.template_for,
          machine_id:    record.machine_id    || undefined,
          customer_ids:  record.customer_ids  || [],
          sticker_type:  record.sticker_type  || 'QR Code',
          primary_key:   record.primary_key   || undefined,
          secondary_key: record.secondary_key || undefined,
          separator:     record.separator     || '/',
          format:        record.format        || 'Basic',
          size_mm:       record.size_mm       || undefined,
          auto_printing: record.auto_printing || false,
          zpl_code:      record.zpl_code      || '',
          ctq_params:    record.ctq_params    || [],
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ separator: '/', format: 'Basic', sticker_type: 'QR Code', auto_printing: false });
      }
    }
  }, [open, record]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset key fields when template_for changes
  const handleTemplateForChange = () => {
    form.setFieldsValue({ primary_key: undefined, secondary_key: undefined, machine_id: undefined, customer_ids: [] });
  };

  const handleSave = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }

    setSaving(true);
    try {
      if (isEdit) {
        await stickerTemplateApi.update(record.id, values);
        message.success('Template updated');
      } else {
        await stickerTemplateApi.create(values);
        message.success('Sticker template created');
      }
      onSaved();
      onClose();
    } catch (err) {
      message.error(err?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const keyOptions = KEY_OPTIONS[templateFor] || [];

  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#374151' };

  const tabItems = [
    {
      key:   'default',
      label: 'Default',
      children: (
        <div className="res-two-panel" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', paddingTop: 16 }}>
          {/* Left: Form fields */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Type */}
            <Form.Item
              label={<Text style={labelStyle}>Type</Text>}
              name="sticker_type"
            >
              <Select style={{ width: '100%' }} disabled={!canWrite}>
                {STICKER_TYPES.map((t) => (
                  <Option key={t.value} value={t.value}>{t.label}</Option>
                ))}
              </Select>
            </Form.Item>

            {/* Primary Key */}
            <Form.Item
              label={<Text style={labelStyle}>Primary Key</Text>}
              name="primary_key"
            >
              <Select
                placeholder="Please select"
                showSearch
                allowClear
                disabled={!canWrite || !templateFor}
                style={{ width: '100%' }}
              >
                {keyOptions.map((k) => (
                  <Option key={k} value={k}>{k}</Option>
                ))}
              </Select>
            </Form.Item>

            {/* Secondary Key */}
            <Form.Item
              label={<Text style={labelStyle}>Secondary Key</Text>}
              name="secondary_key"
            >
              <Select
                placeholder="Please select"
                showSearch
                allowClear
                disabled={!canWrite || !templateFor}
                style={{ width: '100%' }}
              >
                {keyOptions.map((k) => (
                  <Option key={k} value={k}>{k}</Option>
                ))}
              </Select>
            </Form.Item>

            {/* Separator */}
            <Form.Item
              label={<Text style={labelStyle}>Separator</Text>}
              name="separator"
            >
              <Input
                style={{ borderRadius: 8 }}
                maxLength={5}
                disabled={!canWrite}
                placeholder="/"
              />
            </Form.Item>

            {/* Format + Size + Auto Printing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item
                label={<Text style={labelStyle}>Format</Text>}
                name="format"
              >
                <Select disabled={!canWrite}>
                  {FORMAT_OPTIONS.map((f) => (
                    <Option key={f} value={f}>{f}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label={<Text style={labelStyle}>Size (mm)</Text>}
                name="size_mm"
              >
                <InputNumber
                  style={{ width: '100%', borderRadius: 8 }}
                  min={0}
                  placeholder="0"
                  disabled={!canWrite}
                  addonAfter="mm"
                />
              </Form.Item>
            </div>

            <Form.Item name="auto_printing" valuePropName="checked">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Checkbox disabled={!canWrite} />
                <Text style={{ ...labelStyle, fontWeight: 500 }}>Auto Printing</Text>
                <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                  — Print sticker automatically when this event fires
                </Text>
              </div>
            </Form.Item>
          </div>

          {/* Right: QR preview */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 8 }}>
              {stickerType === 'Barcode' ? 'Barcode Preview' : 'QR Preview'}
            </Text>
            <QrPreview
              primaryKey={primaryKey}
              secondaryKey={secondaryKey}
              separator={separator}
              stickerType={stickerType}
            />
          </div>
        </div>
      ),
    },
    {
      key:   'zpl',
      label: 'ZPL कोड',
      children: (
        <div style={{ paddingTop: 16 }}>
          <div
            style={{
              background: '#1e1e2e', borderRadius: 8, padding: 12, marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 11, color: '#7c3aed', fontFamily: 'monospace' }}>
              ZPL II — Zebra Programming Language
            </Text>
            <Text style={{ fontSize: 10, color: '#6b7280' }}>
              Compatible with ZT Series, ZD Series, GK420
            </Text>
          </div>
          <Form.Item name="zpl_code" style={{ marginBottom: 0 }}>
            <TextArea
              rows={12}
              placeholder={`^XA\n^FO50,50^ADN,36,20^FD${primaryKey || '{PRIMARY_KEY}'}^FS\n^FO50,100^BCN,100,Y,N,N^FD${primaryKey || '{PRIMARY_KEY}'}^FS\n^XZ`}
              style={{
                fontFamily:  'monospace',
                fontSize:    12,
                background:  '#1e1e2e',
                color:       '#e2e8f0',
                border:      '1px solid #374151',
                borderRadius: 8,
              }}
              disabled={!canWrite}
            />
          </Form.Item>
          <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, display: 'block' }}>
            Use <Text code style={{ fontSize: 11 }}>{'{PRIMARY_KEY}'}</Text>,{' '}
            <Text code style={{ fontSize: 11 }}>{'{SECONDARY_KEY}'}</Text> as dynamic placeholders.
            Refer to Zebra ZPL II Programming Guide for command reference.
          </Text>
        </div>
      ),
    },
    {
      key:   'ctq',
      label: 'CTQ Params',
      children: (
        <div style={{ paddingTop: 16 }}>
          <CtqParamsEditor form={form} canWrite={canWrite} keyOptions={keyOptions} />
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#f5f3ff', border: '1px solid #ddd6fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#7c3aed', fontSize: 16,
            }}
          >
            <PrinterOutlined />
          </div>
          <span>{isEdit ? `Edit — ${record.name}` : 'New Sticker Template'}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      onOk={canWrite ? handleSave : onClose}
      okText={canWrite ? (isEdit ? 'Update' : 'Submit') : 'Close'}
      cancelText="Cancel"
      okButtonProps={{ loading: saving }}
      width={820}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        {/* ── Header row: Template For | Machine | Customer ───────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 0 }}>
          <Form.Item
            label={<Text style={labelStyle}>Sticker Template <span style={{ color: '#ef4444' }}>*</span></Text>}
            name="template_for"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select
              placeholder="Select type…"
              disabled={!canWrite}
              onChange={handleTemplateForChange}
            >
              {TEMPLATE_FOR_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>{o.label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={<Text style={labelStyle}>Machine</Text>}
            name="machine_id"
          >
            <Select
              placeholder="Please select"
              allowClear
              showSearch
              optionFilterProp="children"
              disabled={!canWrite || templateFor !== 'Machine'}
            >
              {machines.map((m) => (
                <Option key={m.id} value={m.id}>
                  {m.name} {m.code ? `(${m.code})` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={<Text style={labelStyle}>Customer</Text>}
            name="customer_ids"
          >
            <Select
              mode="multiple"
              placeholder="Please select"
              allowClear
              showSearch
              optionFilterProp="children"
              disabled={!canWrite}
              maxTagCount={2}
            >
              {customers.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.name} ({c.partner_code})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        {/* ── Template Name ─────────────────────────────────────────────── */}
        <Form.Item
          label={<Text style={labelStyle}>Name <span style={{ color: '#ef4444' }}>*</span></Text>}
          name="name"
          rules={[{ required: true, message: 'Template name is required' }]}
          style={{ marginBottom: 0 }}
        >
          <Input
            placeholder="e.g. Outward, Inward, Sales Orders"
            style={{ borderRadius: 8 }}
            disabled={!canWrite}
          />
        </Form.Item>

        <Divider style={{ margin: '16px 0 0' }} />

        {/* ── Tabs: Default | ZPL Code | CTQ Params ──────────────────────── */}
        <Tabs items={tabItems} size="small" style={{ marginTop: 0 }} />
      </Form>
    </Modal>
  );
};

// ── CTQ Params Editor sub-component ───────────────────────────────────────────
let _ctqKey = 0;
const makeCtqRow = () => ({ key: ++_ctqKey, param_name: '', source_field: '', unit: '' });

const CtqParamsEditor = ({ form, canWrite, keyOptions }) => {
  const [rows, setRows] = useState([makeCtqRow()]);

  const setRow = (key, field, val) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: val } : r)));

  const addRow    = () => setRows((p) => [...p, makeCtqRow()]);
  const removeRow = (key) => {
    const next = rows.filter((r) => r.key !== key);
    setRows(next.length ? next : [makeCtqRow()]);
    form.setFieldValue('ctq_params', next.map(({ key: _k, ...rest }) => rest));
  };

  const syncToForm = (updatedRows) => {
    form.setFieldValue('ctq_params', updatedRows.map(({ key: _k, ...rest }) => rest));
  };

  const handleChange = (key, field, val) => {
    const updated = rows.map((r) => (r.key === key ? { ...r, [field]: val } : r));
    setRows(updated);
    syncToForm(updated);
  };

  return (
    <div>
      <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 12 }}>
        Define Critical To Quality parameters to print on this sticker label.
      </Text>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 40px', gap: 8, marginBottom: 6 }}>
        {['Parameter Name', 'Source Field', 'Unit', ''].map((h) => (
          <Text key={h} style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{h}</Text>
        ))}
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => (
          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 40px', gap: 8, alignItems: 'center' }}>
            <Input
              placeholder="e.g. Hardness"
              value={row.param_name}
              onChange={(e) => handleChange(row.key, 'param_name', e.target.value)}
              style={{ borderRadius: 6 }}
              disabled={!canWrite}
            />
            <Select
              placeholder="Select field…"
              value={row.source_field || undefined}
              onChange={(v) => handleChange(row.key, 'source_field', v)}
              allowClear
              showSearch
              disabled={!canWrite}
              style={{ width: '100%' }}
            >
              {keyOptions.map((k) => <Option key={k} value={k}>{k}</Option>)}
            </Select>
            <Input
              placeholder="HRC / mm / μm"
              value={row.unit}
              onChange={(e) => handleChange(row.key, 'unit', e.target.value)}
              style={{ borderRadius: 6 }}
              disabled={!canWrite}
            />
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeRow(row.key)}
              disabled={!canWrite || rows.length === 1}
              style={{ opacity: rows.length === 1 ? 0.3 : 1 }}
            />
          </div>
        ))}
      </div>

      {canWrite && (
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={addRow}
          style={{ padding: 0, marginTop: 12, fontWeight: 600 }}
        >
          + Add CTQ Parameter
        </Button>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  PRINT PREVIEW MODAL
// ══════════════════════════════════════════════════════════════════════════════

// Open-window print: captures outerHTML (all inline styles) into a new tab,
// waits for images to load, then triggers window.print().
const printLabelNode = (node, title) => {
  const win = window.open('', '_blank', 'width=560,height=480');
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:24px}
    @media print{@page{margin:10mm}}</style></head>
    <body>${node.outerHTML}</body></html>`);
  win.document.close();
  const images = win.document.querySelectorAll('img');
  if (!images.length) { win.focus(); win.print(); win.close(); return; }
  let done = 0;
  const tryPrint = () => { if (++done === images.length) { win.focus(); win.print(); win.close(); } };
  images.forEach((img) => { if (img.complete) tryPrint(); else { img.onload = tryPrint; img.onerror = tryPrint; } });
};

const PrintPreviewModal = ({ record, open, onClose }) => {
  const [machines,     setMachines]     = useState([]);
  const [selMachineId, setSelMachineId] = useState(null);
  const [packData,     setPackData]     = useState({});
  const [result,       setResult]       = useState(null);
  const [rendering,    setRendering]    = useState(false);
  const labelRef = useRef(null);

  // Load machines on open (for Machine templates)
  useEffect(() => {
    if (!open) { setResult(null); setSelMachineId(null); setPackData({}); return; }
    if (record?.template_for === 'Machine') {
      machineApi.getAll().then((d) => setMachines(Array.isArray(d) ? d : d?.data ?? [])).catch(() => {});
    }
  }, [open, record]);

  // Unique input keys for Pack Type
  const packKeys = record ? [
    ...(record.primary_key   ? [record.primary_key]   : []),
    ...(record.secondary_key ? [record.secondary_key] : []),
    ...((record.ctq_params || []).map((p) => p.source_field).filter(Boolean)),
  ].filter((v, i, a) => v && a.indexOf(v) === i) : [];

  const handleGenerate = async () => {
    let entity_data = {};
    if (record.template_for === 'Machine') {
      const m = machines.find((x) => x.id === selMachineId);
      if (!m) { message.warning('Please select a machine'); return; }
      entity_data = {
        'Machine Code': m.code             || '',
        'Machine Name': m.name             || '',
        'Machine Type': m.machine_type     || '',
        'Site Code':    m.Site?.code       || '',
        'Site Name':    m.Site?.name       || '',
        'Department':   m.Department?.name || '',
      };
    } else {
      entity_data = { ...packData };
    }
    setRendering(true);
    try {
      const res = await stickerTemplateApi.render(record.id, { entity_data });
      setResult(res?.data ?? res);
    } catch (err) { message.error(err?.message || 'Failed to render label'); }
    finally { setRendering(false); }
  };

  const isBarcode = record?.sticker_type === 'Barcode';
  // api.qrserver.com — free, reliable, no key needed
  const qrUrl = result?.qr_data
    ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(result.qr_data)}&ecc=M&margin=4`
    : null;

  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#374151' };
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', fontSize: 16 }}>
            <PrinterOutlined />
          </div>
          <span>Print Preview — {record?.name}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={680}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        result && (
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => labelRef.current && printLabelNode(labelRef.current, `Label — ${record.name}`)}
          >
            Print Label
          </Button>
        ),
      ]}
      destroyOnClose
    >
      {/* ── Input area ──────────────────────────────────────────────────── */}
      {record?.template_for === 'Machine' && (
        <div style={{ marginBottom: 16 }}>
          <Text style={labelStyle}>Select Machine</Text>
          <Select
            placeholder="Choose a machine…"
            style={{ width: '100%', marginTop: 4 }}
            showSearch optionFilterProp="children"
            value={selMachineId}
            onChange={setSelMachineId}
          >
            {machines.map((m) => (
              <Option key={m.id} value={m.id}>{m.name} ({m.code})</Option>
            ))}
          </Select>
        </div>
      )}

      {record?.template_for === 'Pack Type' && packKeys.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text style={labelStyle}>Enter Values</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            {packKeys.map((k) => (
              <div key={k}>
                <Text style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>{k}</Text>
                <Input
                  value={packData[k] || ''}
                  onChange={(e) => setPackData((prev) => ({ ...prev, [k]: e.target.value }))}
                  placeholder={`Enter ${k}…`}
                  size="small"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        type="default"
        onClick={handleGenerate}
        loading={rendering}
        style={{ marginBottom: 16, borderRadius: 8 }}
      >
        Generate Preview
      </Button>

      {/* ── Label preview ────────────────────────────────────────────── */}
      {result && (
        <div
          ref={labelRef}
          style={{ border: '2px solid #e5e7eb', borderRadius: 10, padding: 20, background: '#ffffff', marginBottom: 12 }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
              {record.template_for} · {record.sticker_type}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 2 }}>{record.name}</div>
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* QR / Barcode */}
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              {isBarcode ? (
                <div style={{ border: '3px solid #111827', padding: '8px 20px', borderRadius: 4, minWidth: 140 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 22, letterSpacing: 6, fontWeight: 900, color: '#111111' }}>
                    {result.qr_data || '—'}
                  </div>
                  <div style={{ borderTop: '3px solid #111827', marginTop: 6, paddingTop: 4 }}>
                    <div style={{ fontSize: 9, letterSpacing: 1, fontFamily: 'monospace' }}>{result.qr_data}</div>
                  </div>
                </div>
              ) : qrUrl ? (
                <img
                  src={qrUrl}
                  alt="QR Code"
                  width={140}
                  height={140}
                  style={{ display: 'block', border: '1px solid #e5e7eb', borderRadius: 4 }}
                  crossOrigin="anonymous"
                />
              ) : (
                <div style={{ width: 140, height: 140, border: '1px dashed #d1d5db', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrcodeOutlined style={{ fontSize: 48, color: '#d1d5db' }} />
                </div>
              )}
              {result.qr_data && (
                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 4, maxWidth: 140, wordBreak: 'break-all' }}>
                  {result.qr_data}
                </div>
              )}
            </div>

            {/* Fields */}
            <div style={{ flex: 1 }}>
              {result.primary_value && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{record.primary_key}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: '#111827', lineHeight: 1.2 }}>
                    {result.primary_value}
                  </div>
                </div>
              )}
              {result.secondary_value && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{record.secondary_key}</div>
                  <div style={{ fontSize: 14, color: '#374151' }}>{result.secondary_value}</div>
                </div>
              )}
              {result.ctq_resolved?.filter((p) => p.param_name).length > 0 && (
                <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                    CTQ Parameters
                  </div>
                  {result.ctq_resolved.filter((p) => p.param_name).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{p.param_name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>
                        {p.value || '—'}{p.unit ? ` ${p.unit}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 14, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#9ca3af' }}>Format: {record.format}</span>
            {record.size_mm && <span style={{ fontSize: 9, color: '#9ca3af' }}>Size: {record.size_mm} mm</span>}
            <span style={{ fontSize: 9, color: '#9ca3af' }}>{today}</span>
          </div>
        </div>
      )}

      {/* ── ZPL output ───────────────────────────────────────────────── */}
      {result?.zpl_rendered && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: 600 }}>ZPL Output</Text>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => { navigator.clipboard.writeText(result.zpl_rendered); message.success('ZPL copied to clipboard'); }}
            >
              Copy
            </Button>
          </div>
          <pre style={{ background: '#1e1e2e', color: '#e2e8f0', padding: 12, borderRadius: 8, fontSize: 11, fontFamily: 'monospace', overflow: 'auto', maxHeight: 160, margin: 0 }}>
            {result.zpl_rendered}
          </pre>
        </div>
      )}
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
// ── CSV Upload config ────────────────────────────────────────────────────────
const STICKER_CSV_HEADERS = ['Name', 'Template For', 'Sticker Type', 'Primary Key', 'Secondary Key', 'Separator', 'Format'];

const STICKER_CSV_SAMPLE = [
  {
    'Name': 'Machine QR Label', 'Template For': 'Machine', 'Sticker Type': 'QR Code',
    'Primary Key': 'Machine Code', 'Secondary Key': 'Machine Name', 'Separator': '/', 'Format': 'Basic',
  },
];

const STICKER_VALIDATION_RULES = [
  { field: 'Name', required: true },
];

const StickerTemplatesPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('planning-sticker-templates-create_edit_delete');

  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');

  const [modal,   setModal]   = useState({ open: false, record: null });
  const [preview, setPreview] = useState({ open: false, record: null });
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stickerTemplateApi.getAll(search ? { search } : {});
      setTemplates(data ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load sticker templates');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.name}"?`,
      content: 'This will permanently delete the sticker template. This cannot be undone.',
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await stickerTemplateApi.delete(record.id);
          message.success(`"${record.name}" deleted`);
          fetchTemplates();
        } catch (err) {
          message.error(err?.message || 'Failed to delete template');
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
        await stickerTemplateApi.create({
          name:          row['Name'] || '',
          template_for:  row['Template For'] || 'Machine',
          sticker_type:  row['Sticker Type'] || 'QR Code',
          primary_key:   row['Primary Key'] || null,
          secondary_key: row['Secondary Key'] || null,
          separator:     row['Separator'] || '/',
          format:        row['Format'] || 'Basic',
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Name']}": ${err?.message || 'Failed'}`);
      }
    }
    fetchTemplates();
    return { success, failed, errors };
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const active   = templates.filter((t) => t.is_active).length;
  const inactive = templates.length - active;

  const STATS = [
    { label: 'Total',    value: templates.length, color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Active',   value: active,           color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Inactive', value: inactive,         color: '#6b7280', bg: '#f9fafb' },
  ];

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Name',
      key:   'name',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: '#f5f3ff', border: '1px solid #ddd6fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#7c3aed', fontSize: 16,
            }}
          >
            <PrinterOutlined />
          </div>
          <div>
            <Text
              style={{ fontWeight: 600, fontSize: 13, color: '#111827', display: 'block', cursor: 'pointer' }}
              onClick={() => setModal({ open: true, record: r })}
            >
              {r.name}
            </Text>
            <Tag
              color={TAG_COLOR[r.template_for] || 'default'}
              style={{ fontSize: 10, borderRadius: 20, marginTop: 2 }}
            >
              {r.template_for}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title:  'Customers',
      key:    'customers',
      width:  160,
      render: (_, r) => {
        const ids = r.customer_ids || [];
        return ids.length
          ? <Text style={{ fontSize: 12 }}>{ids.length} linked</Text>
          : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>;
      },
    },
    {
      title:     'Primary Key',
      dataIndex: 'primary_key',
      key:       'primary_key',
      width:     160,
      render: (v) => v
        ? <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151' }}>{v}</Text>
        : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title:     'Secondary Key',
      dataIndex: 'secondary_key',
      key:       'secondary_key',
      width:     160,
      render: (v) => v
        ? <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#374151' }}>{v}</Text>
        : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title:  'Created At',
      key:    'created',
      width:  170,
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
      width:  170,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', color: '#111827' }}>
            {r.Updater?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#1d4ed8' }}>{fmtDate(r.updatedAt)}</Text>
        </div>
      ),
    },
    {
      title:  'Action',
      key:    'action',
      width:  90,
      align:  'center',
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <Tooltip title="Print Preview">
            <Button
              size="small"
              icon={<EyeOutlined />}
              style={{ borderRadius: 6, color: '#16a34a', borderColor: '#bbf7d0' }}
              onClick={() => setPreview({ open: true, record: r })}
            />
          </Tooltip>
          <Tooltip title="Edit Template">
            <Button
              size="small"
              icon={<AppstoreOutlined />}
              style={{ borderRadius: 6, color: '#7c3aed', borderColor: '#ddd6fe' }}
              onClick={() => setModal({ open: true, record: r })}
            />
          </Tooltip>
          {canWrite && (
            <Tooltip title="Delete">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                style={{ borderRadius: 6 }}
                onClick={() => handleDelete(r)}
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      {/* ── Page heading ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Planning</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Sticker Templates</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Sticker Templates
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Configure QR code and barcode label templates for machines, items, dispatch and more
        </Text>
      </div>

      {/* ── Stats chips ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {STATS.map((s) => (
          <div
            key={s.label}
            style={{
              padding: '8px 16px', background: s.bg,
              border: `1px solid ${s.color}30`, borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90,
            }}
          >
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{s.value}</Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search templates…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => {
            const csvRows = templates.map((t) => ({
              'Name': t.name || '', 'Template For': t.template_for || '',
              'Sticker Type': t.sticker_type || '', 'Primary Key': t.primary_key || '',
              'Secondary Key': t.secondary_key || '', 'Separator': t.separator || '',
              'Format': t.format || '',
            }));
            downloadSampleCsv('sticker-templates.csv', STICKER_CSV_HEADERS, csvRows);
          }}>Export CSV</Button>
          {canWrite && (
            <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchTemplates} style={{ borderRadius: 8 }}>
            Refresh
          </Button>
          {canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModal({ open: true, record: null })}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              NEW
            </Button>
          )}
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={templates}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} templates`, style: { marginBottom: 0 } }}
          scroll={{ x: 900 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <PrinterOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No sticker templates created yet</Text>
                {canWrite && (
                  <>
                    <br />
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => setModal({ open: true, record: null })}
                      style={{ marginTop: 10 }}
                    >
                      Create Your First Template
                    </Button>
                  </>
                )}
              </div>
            ),
          }}
        />
      </Card>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <TemplateModal
        record={modal.record}
        open={modal.open}
        onClose={() => setModal({ open: false, record: null })}
        onSaved={() => { fetchTemplates(); setModal({ open: false, record: null }); }}
        canWrite={canWrite}
      />

      <PrintPreviewModal
        record={preview.record}
        open={preview.open}
        onClose={() => setPreview({ open: false, record: null })}
      />

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Sticker Templates"
        entityName="Template"
        sampleHeaders={STICKER_CSV_HEADERS}
        sampleRows={STICKER_CSV_SAMPLE}
        validationRules={STICKER_VALIDATION_RULES}
      />
    </AppLayout>
  );
};

export default StickerTemplatesPage;
