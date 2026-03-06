import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Radio, Checkbox,
  Card, Modal, message, Tooltip, Space, Badge,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  DatabaseOutlined,
  MenuOutlined,
  HistoryOutlined,
  BarChartOutlined,
  SearchOutlined,
  RightOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { warehouseApi } from '../../../api/warehouse.api';
import AppLayout        from '../../../components/AppLayout';

const { Title, Text } = Typography;

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return dayjs(iso).format('DD MMM YYYY HH:mm');
};

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({ warehouses, loading, search, onSearchChange, onRefresh, onNew, onDetail, onDelete }) => {
  const totalActive = warehouses.filter((w) => w.is_active).length;

  const columns = [
    {
      title: 'Name',
      key:   'name',
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
            <DatabaseOutlined />
          </div>
          <div>
            <Text
              style={{ color: '#111827', fontWeight: 600, fontSize: 13, display: 'block', cursor: 'pointer' }}
              onClick={() => onDetail(r)}
            >
              {r.name}
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>{r.code}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Created At',
      key:   'createdAt',
      width: 200,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>
            {r.Creator?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#374151' }}>{fmtDateTime(r.createdAt)}</Text>
        </div>
      ),
    },
    {
      title: 'Last Updated At',
      key:   'updatedAt',
      width: 220,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, color: '#1d4ed8', display: 'block', fontWeight: 500 }}>
            {r.Updater?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#374151' }}>{fmtDateTime(r.updatedAt)}</Text>
        </div>
      ),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  170,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            size="small"
            icon={<SettingOutlined />}
            style={{ borderRadius: 6, fontSize: 12 }}
            onClick={() => onDetail(r)}
          >
            Configure
          </Button>
          <Tooltip title="Delete warehouse">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ borderRadius: 6, fontSize: 12 }}
              onClick={() => onDelete(r)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* ── Page heading ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Inventory</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Warehouse</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Warehouses
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage warehouse locations, approval params and inventory settings
        </Text>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Warehouses', value: warehouses.length, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Active',           value: totalActive,       color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Inactive',         value: warehouses.length - totalActive, color: '#6b7280', bg: '#f9fafb' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: '8px 16px', background: s.bg,
              border: `1px solid ${s.color}30`, borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90,
            }}
          >
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              {s.value}
            </Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      {/* ── Table Card ───────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search warehouses…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onNew}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Add New Warehouse
          </Button>
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={warehouses}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} warehouses`, style: { marginBottom: 0 } }}
          scroll={{ x: 800 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <DatabaseOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No warehouses configured yet</Text>
                <br />
                <Button
                  type="primary"
                  size="small"
                  onClick={onNew}
                  style={{ marginTop: 10 }}
                >
                  Add Your First Warehouse
                </Button>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  PRE APPROVAL PARAMS TABLE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const PreApprovalParamsSection = ({ value = [], onChange, readOnly = false }) => {
  const rows = value.length > 0 ? value : [{ request_type: '', partner_type: '', approval_check: '' }];

  const handleChange = (idx, field, val) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange?.(updated);
  };

  const handleAddRow = () => {
    onChange?.([...rows, { request_type: '', partner_type: '', approval_check: '' }]);
  };

  const handleRemoveRow = (idx) => {
    const updated = rows.filter((_, i) => i !== idx);
    onChange?.(updated.length > 0 ? updated : [{ request_type: '', partner_type: '', approval_check: '' }]);
  };

  return (
    <div>
      <Text style={{ color: '#1d4ed8', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8 }}>
        Pre Approval Params
      </Text>
      <div
        style={{
          border:       '1px solid #e8eaed',
          borderRadius: 8,
          overflow:     'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display:    'grid',
            gridTemplateColumns: readOnly ? '1fr 1fr 1fr' : '1fr 1fr 1fr 40px',
            background: '#f8fafc',
            padding:    '8px 12px',
            borderBottom: '1px solid #e8eaed',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Request Type</Text>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Partner Type</Text>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Approval Check</Text>
          {!readOnly && <span />}
        </div>
        {/* Rows */}
        {rows.map((row, idx) => (
          <div
            key={idx}
            style={{
              display:    'grid',
              gridTemplateColumns: readOnly ? '1fr 1fr 1fr' : '1fr 1fr 1fr 40px',
              padding:    '8px 12px',
              borderBottom: idx < rows.length - 1 ? '1px solid #f3f4f6' : 'none',
              alignItems: 'center',
            }}
          >
            <Select
              size="small"
              placeholder=""
              value={row.request_type || undefined}
              onChange={(val) => handleChange(idx, 'request_type', val)}
              style={{ width: '90%' }}
              disabled={readOnly}
              allowClear
              options={[
                { label: 'Outward', value: 'outward' },
                { label: 'Inward',  value: 'inward' },
              ]}
            />
            <Select
              size="small"
              placeholder=""
              value={row.partner_type || undefined}
              onChange={(val) => handleChange(idx, 'partner_type', val)}
              style={{ width: '90%' }}
              disabled={readOnly}
              allowClear
              options={[
                { label: 'Customer',                  value: 'customer' },
                { label: 'Vendor',                    value: 'vendor' },
                { label: 'Subcontracting Customer',   value: 'subcontracting_customer' },
                { label: 'Subcontracting Vendor',     value: 'subcontracting_vendor' },
                { label: 'Other Warehouse',           value: 'other_warehouse' },
                { label: 'Machine',                   value: 'machine' },
              ]}
            />
            <Select
              size="small"
              placeholder=""
              value={row.approval_check || undefined}
              onChange={(val) => handleChange(idx, 'approval_check', val)}
              style={{ width: '90%' }}
              disabled={readOnly}
              allowClear
              options={[
                { label: 'Quality Check',           value: 'quality_check' },
                { label: 'Barcode Validation',      value: 'barcode_validation' },
                { label: 'Validation of Item Count', value: 'validation_of_item_count' },
              ]}
            />
            {!readOnly && (
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined style={{ fontSize: 13 }} />}
                onClick={() => handleRemoveRow(idx)}
              />
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button type="link" size="small" onClick={handleAddRow} style={{ padding: '4px 0', fontSize: 12 }}>
          Add params
        </Button>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ITEM LEVEL PARAMS COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const ItemLevelParamsSection = ({ value = {}, onChange, readOnly = false }) => {
  const params = {
    approved_tags:   value?.approved_tags   || [],
    unapproved_tags: value?.unapproved_tags || [],
  };

  return (
    <div>
      <Text style={{ color: '#1d4ed8', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
        Item Level Params
      </Text>
      <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 8, fontStyle: 'italic' }}>
        If an item tag is linked to multiple warehouses, the system will ignore the links and assign it to the partner's default warehouse.
      </Text>
      <div
        style={{
          border:       '1px solid #e8eaed',
          borderRadius: 8,
          overflow:     'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display:    'grid',
            gridTemplateColumns: '140px 1fr auto',
            background: '#f8fafc',
            padding:    '8px 12px',
            borderBottom: '1px solid #e8eaed',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Status</Text>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Item Tags</Text>
          <span />
        </div>
        {/* Approved row */}
        <div
          style={{
            display:    'grid',
            gridTemplateColumns: '140px 1fr auto',
            padding:    '10px 12px',
            borderBottom: '1px solid #f3f4f6',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Approved</Text>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>
            {params.approved_tags.length > 0 ? params.approved_tags.join(', ') : 'No attached Item Group tags'}
          </Text>
          {!readOnly && (
            <Button type="link" size="small" style={{ fontSize: 12, color: '#9ca3af' }}>
              Edit
            </Button>
          )}
        </div>
        {/* Unapproved row */}
        <div
          style={{
            display:    'grid',
            gridTemplateColumns: '140px 1fr auto',
            padding:    '10px 12px',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Unapproved</Text>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>
            {params.unapproved_tags.length > 0 ? params.unapproved_tags.join(', ') : 'No attached Item Group tags'}
          </Text>
          {!readOnly && (
            <Button type="link" size="small" style={{ fontSize: 12, color: '#9ca3af' }}>
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ADD WAREHOUSE VIEW
// ══════════════════════════════════════════════════════════════════════════════
const AddWarehouseView = ({ onBack, onSaved }) => {
  const [form]    = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [preApprovalParams, setPreApprovalParams] = useState([{ request_type: '', partner_type: '', approval_check: '' }]);
  const [itemLevelParams, setItemLevelParams]     = useState({ approved_tags: [], unapproved_tags: [] });

  const handleSubmit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const payload = {
      name:                      values.name,
      linked_partners:           values.linked_partners || null,
      mrn_to_issue:              values.mrn_to_issue === 'yes',
      rack_tracking:             values.rack_tracking === 'yes',
      costing_calculation:       values.costing_calculation === 'yes',
      bundle_tracking:           values.bundle_tracking === 'yes',
      generate_grn_sequentially: values.generate_grn_sequentially ?? true,
      grn_prefix:                values.grn_prefix || null,
      year_basis:                values.year_basis || 'calendar_year',
      pre_approval_params:       preApprovalParams.filter(p => p.request_type || p.partner_type || p.approval_check),
      item_level_params:         itemLevelParams,
    };

    setSaving(true);
    try {
      const res = await warehouseApi.create(payload);
      message.success(res.message || 'Warehouse created successfully');
      form.resetFields();
      onSaved();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'Failed to create warehouse');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{ color: '#374151', fontWeight: 500, paddingLeft: 0 }}
        />
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Add New Warehouses
        </Title>
      </div>

      {/* ── White card wrapper ──────────────────────────────────────────── */}
      <div
        style={{
          background:   '#ffffff',
          border:       '1px solid #e8eaed',
          borderRadius: 12,
          padding:      '28px 32px',
          boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
          {/* LEFT COLUMN */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{
                mrn_to_issue:              'no',
                rack_tracking:             'no',
                costing_calculation:       'no',
                bundle_tracking:           'no',
                generate_grn_sequentially: true,
                year_basis:                'calendar_year',
              }}
            >
              {/* Name */}
              <Form.Item
                name="name"
                label={<Text style={{ color: '#374151', fontWeight: 500, fontSize: 13 }}>Name</Text>}
                rules={[{ required: true, message: 'Warehouse name is required' }]}
              >
                <Input placeholder="" />
              </Form.Item>

              {/* Linked Partners */}
              <Form.Item
                name="linked_partners"
                label={<Text style={{ color: '#374151', fontWeight: 500, fontSize: 13 }}>Linked Partners</Text>}
              >
                <Input placeholder="" />
              </Form.Item>

              {/* Attributes */}
              <div style={{ marginBottom: 24 }}>
                <Title level={5} style={{ margin: '0 0 16px', color: '#111827', fontWeight: 700, fontSize: 15 }}>
                  Attributes
                </Title>

                {[
                  { name: 'mrn_to_issue',        label: 'MRN to Issue' },
                  { name: 'rack_tracking',        label: 'Rack Tracking' },
                  { name: 'costing_calculation',  label: 'Costing Calculation' },
                  { name: 'bundle_tracking',      label: 'Bundle Tracking' },
                ].map(({ name, label }) => (
                  <Form.Item
                    key={name}
                    name={name}
                    label={<Text style={{ color: '#374151', fontWeight: 400, fontSize: 13 }}>{label}</Text>}
                    style={{ marginBottom: 12 }}
                  >
                    <Radio.Group>
                      <Radio value="yes">Yes</Radio>
                      <Radio value="no">No</Radio>
                    </Radio.Group>
                  </Form.Item>
                ))}
              </div>

              {/* GRN Settings */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <Form.Item name="generate_grn_sequentially" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Checkbox>
                    <Text style={{ fontWeight: 500, fontSize: 13 }}>Generate GRN sequentially</Text>
                  </Checkbox>
                </Form.Item>

                <Form.Item
                  name="grn_prefix"
                  label={<Text style={{ fontSize: 12, color: '#6b7280' }}>GRN Prefix</Text>}
                  style={{ marginBottom: 0 }}
                >
                  <Input maxLength={2} style={{ width: 80 }} placeholder="" suffix={<Text style={{ fontSize: 10, color: '#9ca3af' }}>0 / 2</Text>} />
                </Form.Item>

                <Form.Item
                  name="year_basis"
                  label={<Text style={{ fontSize: 12, color: '#6b7280' }}>Year Basis</Text>}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    style={{ width: 160 }}
                    options={[
                      { label: 'Calendar Year',  value: 'calendar_year' },
                      { label: 'Financial Year', value: 'financial_year' },
                    ]}
                  />
                </Form.Item>
              </div>

              {/* Submit */}
              <div style={{ marginTop: 28 }}>
                <Button
                  type="primary"
                  loading={saving}
                  onClick={handleSubmit}
                  style={{
                    borderRadius:  8,
                    fontWeight:    600,
                    background:    '#1d4ed8',
                    paddingInline: 28,
                  }}
                >
                  Submit
                </Button>
              </div>
            </Form>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <PreApprovalParamsSection
              value={preApprovalParams}
              onChange={setPreApprovalParams}
            />
            <ItemLevelParamsSection
              value={itemLevelParams}
              onChange={setItemLevelParams}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  DETAIL / EDIT VIEW
// ══════════════════════════════════════════════════════════════════════════════
const DetailView = ({ warehouse, onBack, onSaved }) => {
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form]                  = Form.useForm();
  const [preApprovalParams, setPreApprovalParams] = useState(warehouse?.pre_approval_params || []);
  const [itemLevelParams, setItemLevelParams]     = useState(warehouse?.item_level_params || { approved_tags: [], unapproved_tags: [] });

  useEffect(() => {
    if (warehouse) {
      setPreApprovalParams(warehouse.pre_approval_params || []);
      setItemLevelParams(warehouse.item_level_params || { approved_tags: [], unapproved_tags: [] });
    }
  }, [warehouse]);

  const handleEdit = () => {
    form.setFieldsValue({
      name:                      warehouse.name,
      linked_partners:           warehouse.linked_partners || '',
      mrn_to_issue:              warehouse.mrn_to_issue ? 'yes' : 'no',
      rack_tracking:             warehouse.rack_tracking ? 'yes' : 'no',
      costing_calculation:       warehouse.costing_calculation ? 'yes' : 'no',
      bundle_tracking:           warehouse.bundle_tracking ? 'yes' : 'no',
      generate_grn_sequentially: warehouse.generate_grn_sequentially ?? true,
      grn_prefix:                warehouse.grn_prefix || '',
      year_basis:                warehouse.year_basis || 'calendar_year',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const payload = {
      name:                      values.name,
      linked_partners:           values.linked_partners || null,
      mrn_to_issue:              values.mrn_to_issue === 'yes',
      rack_tracking:             values.rack_tracking === 'yes',
      costing_calculation:       values.costing_calculation === 'yes',
      bundle_tracking:           values.bundle_tracking === 'yes',
      generate_grn_sequentially: values.generate_grn_sequentially ?? true,
      grn_prefix:                values.grn_prefix || null,
      year_basis:                values.year_basis || 'calendar_year',
      pre_approval_params:       preApprovalParams.filter(p => p.request_type || p.partner_type || p.approval_check),
      item_level_params:         itemLevelParams,
    };

    setSaving(true);
    try {
      await warehouseApi.update(warehouse.id, payload);
      message.success('Warehouse updated successfully');
      setEditing(false);
      onSaved();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'Failed to update warehouse');
    } finally {
      setSaving(false);
    }
  };

  if (!warehouse) return null;

  // ── READ-ONLY DETAIL VIEW ──────────────────────────────────────────────
  if (!editing) {
    return (
      <div>
        {/* Header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              style={{ color: '#374151', fontWeight: 500, paddingLeft: 0 }}
            />
            <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
              {warehouse.name}
            </Title>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              type="primary"
              icon={<BarChartOutlined />}
              style={{ borderRadius: 8, fontWeight: 600, background: '#1d4ed8' }}
            >
              Set Levels
            </Button>
            <Tooltip title="History">
              <Button
                type="text"
                icon={<HistoryOutlined style={{ fontSize: 18, color: '#6b7280' }} />}
              />
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <PreApprovalParamsSection
            value={warehouse.pre_approval_params || []}
            readOnly
          />
          <ItemLevelParamsSection
            value={warehouse.item_level_params || { approved_tags: [], unapproved_tags: [] }}
            readOnly
          />
        </div>

        {/* Edit button */}
        <div style={{ marginTop: 28 }}>
          <Button
            type="primary"
            onClick={handleEdit}
            style={{
              borderRadius:  8,
              fontWeight:    600,
              background:    '#1d4ed8',
              paddingInline: 28,
            }}
          >
            Edit
          </Button>
        </div>
      </div>
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => setEditing(false)}
          style={{ color: '#374151', fontWeight: 500, paddingLeft: 0 }}
        />
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Edit — {warehouse.name}
        </Title>
      </div>

      {/* White card wrapper */}
      <div
        style={{
          background:   '#ffffff',
          border:       '1px solid #e8eaed',
          borderRadius: 12,
          padding:      '28px 32px',
          boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        {/* Two-column layout (same as Add) */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
          {/* LEFT COLUMN */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
            >
              <Form.Item
                name="name"
                label={<Text style={{ color: '#374151', fontWeight: 500, fontSize: 13 }}>Name</Text>}
                rules={[{ required: true, message: 'Warehouse name is required' }]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="linked_partners"
                label={<Text style={{ color: '#374151', fontWeight: 500, fontSize: 13 }}>Linked Partners</Text>}
              >
                <Input />
              </Form.Item>

              <div style={{ marginBottom: 24 }}>
                <Title level={5} style={{ margin: '0 0 16px', color: '#111827', fontWeight: 700, fontSize: 15 }}>
                  Attributes
                </Title>
                {[
                  { name: 'mrn_to_issue',        label: 'MRN to Issue' },
                  { name: 'rack_tracking',        label: 'Rack Tracking' },
                  { name: 'costing_calculation',  label: 'Costing Calculation' },
                  { name: 'bundle_tracking',      label: 'Bundle Tracking' },
                ].map(({ name, label }) => (
                  <Form.Item
                    key={name}
                    name={name}
                    label={<Text style={{ color: '#374151', fontWeight: 400, fontSize: 13 }}>{label}</Text>}
                    style={{ marginBottom: 12 }}
                  >
                    <Radio.Group>
                      <Radio value="yes">Yes</Radio>
                      <Radio value="no">No</Radio>
                    </Radio.Group>
                  </Form.Item>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <Form.Item name="generate_grn_sequentially" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Checkbox>
                    <Text style={{ fontWeight: 500, fontSize: 13 }}>Generate GRN sequentially</Text>
                  </Checkbox>
                </Form.Item>
                <Form.Item
                  name="grn_prefix"
                  label={<Text style={{ fontSize: 12, color: '#6b7280' }}>GRN Prefix</Text>}
                  style={{ marginBottom: 0 }}
                >
                  <Input maxLength={2} style={{ width: 80 }} suffix={<Text style={{ fontSize: 10, color: '#9ca3af' }}>0 / 2</Text>} />
                </Form.Item>
                <Form.Item
                  name="year_basis"
                  label={<Text style={{ fontSize: 12, color: '#6b7280' }}>Year Basis</Text>}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    style={{ width: 160 }}
                    options={[
                      { label: 'Calendar Year',  value: 'calendar_year' },
                      { label: 'Financial Year', value: 'financial_year' },
                    ]}
                  />
                </Form.Item>
              </div>

              <div style={{ marginTop: 28 }}>
                <Button
                  type="primary"
                  loading={saving}
                  onClick={handleSave}
                  style={{ borderRadius: 8, fontWeight: 600, background: '#1d4ed8', paddingInline: 28 }}
                >
                  Save Changes
                </Button>
                <Button onClick={() => setEditing(false)} style={{ marginLeft: 12, borderRadius: 8 }}>
                  Cancel
                </Button>
              </div>
            </Form>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <PreApprovalParamsSection
              value={preApprovalParams}
              onChange={setPreApprovalParams}
            />
            <ItemLevelParamsSection
              value={itemLevelParams}
              onChange={setItemLevelParams}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const WarehousesPage = () => {
  const [warehouses,       setWarehouses]       = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [view,             setView]             = useState('list');   // 'list' | 'add' | 'detail'
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [search,           setSearch]           = useState('');

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.getAll(search ? { search } : {});
      setWarehouses(res?.data ?? res ?? []);
    } catch {
      message.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.name}"?`,
      content: 'This action cannot be undone.',
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await warehouseApi.delete(record.id);
          message.success(`Warehouse "${record.name}" deleted`);
          fetchWarehouses();
        } catch (err) {
          message.error(err?.response?.data?.message || 'Failed to delete warehouse');
        }
      },
    });
  };

  const handleNew = () => {
    setSelectedWarehouse(null);
    setView('add');
  };

  const handleDetail = async (record) => {
    try {
      const res = await warehouseApi.getById(record.id);
      setSelectedWarehouse(res?.data ?? res);
      setView('detail');
    } catch {
      message.error('Failed to load warehouse details');
    }
  };

  const handleSaved = () => {
    setView('list');
    setSelectedWarehouse(null);
    fetchWarehouses();
  };

  const handleBack = () => {
    setView('list');
    setSelectedWarehouse(null);
  };

  return (
    <AppLayout>
      {view === 'list' && (
        <ListView
          warehouses={warehouses}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          onRefresh={fetchWarehouses}
          onNew={handleNew}
          onDetail={handleDetail}
          onDelete={handleDelete}
        />
      )}

      {view === 'add' && (
        <AddWarehouseView
          onBack={handleBack}
          onSaved={handleSaved}
        />
      )}

      {view === 'detail' && (
        <DetailView
          warehouse={selectedWarehouse}
          onBack={handleBack}
          onSaved={handleSaved}
        />
      )}
    </AppLayout>
  );
};

export default WarehousesPage;
