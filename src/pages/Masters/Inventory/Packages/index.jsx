import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Input, InputNumber, Typography, Modal, message,
  Select, Switch, Tag, Tooltip, Row, Col, Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  RightOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { packageApi } from '../../../../api/package.api';
import { tagApi }     from '../../../../api/tag.api';
import AppLayout      from '../../../../components/AppLayout';
import usePermissions from '../../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option }      = Select;

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');
const fmtDim  = (v)   => (v != null && v !== '' ? `${parseFloat(v).toFixed(2)}` : '—');

const PACKAGE_TYPES = ['Box', 'Bag', 'Pallet', 'Crate', 'Drum', 'Tray', 'Blister', 'Pouch', 'Other'];
const INPUT_TYPES   = ['Manual', 'Barcode', 'RFID', 'Auto-Count'];
const ATTR_TYPES    = ['Text', 'Number', 'Date', 'Boolean'];

// ── Unique ID helper ──────────────────────────────────────────────────────────
let _uid = 0;
const uid = () => `${Date.now()}_${++_uid}`;

const makePackingRow = () => ({ id: uid(), item_tags: [], pack_size: '' });
const makeAttrRow    = () => ({ id: uid(), name: '',       type: 'Text' });

// ── Section heading ───────────────────────────────────────────────────────────
const SectionTitle = ({ title }) => (
  <div style={{ marginBottom: 14, marginTop: 4 }}>
    <Text
      style={{
        fontSize:   13,
        fontWeight: 700,
        color:      '#374151',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {title}
    </Text>
    <Divider style={{ marginTop: 6, marginBottom: 0, borderColor: '#f0f0f0' }} />
  </div>
);

// ── Field label ───────────────────────────────────────────────────────────────
const FieldLabel = ({ children, required }) => (
  <Text
    style={{
      fontSize:     12,
      fontWeight:   600,
      color:        '#374151',
      display:      'block',
      marginBottom: 4,
    }}
  >
    {children}
    {required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
  </Text>
);

// ══════════════════════════════════════════════════════════════════════════════
//  PACKAGE BUILDER — create / edit view
// ══════════════════════════════════════════════════════════════════════════════
const PackageBuilder = ({ pkg, onBack, onSaved, canWrite }) => {
  const isEdit = Boolean(pkg);

  const [name,              setName]              = useState(pkg?.name              ?? '');
  const [typeOfPackage,     setTypeOfPackage]     = useState(pkg?.type_of_package   ?? null);
  const [typeOfInput,       setTypeOfInput]       = useState(pkg?.type_of_input     ?? null);
  const [tareWeight,        setTareWeight]        = useState(pkg?.tare_weight       ?? null);
  const [packLength,        setPackLength]        = useState(pkg?.pack_length       ?? null);
  const [packWidth,         setPackWidth]         = useState(pkg?.pack_width        ?? null);
  const [packHeight,        setPackHeight]        = useState(pkg?.pack_height       ?? null);
  const [mandatoryCustomer, setMandatoryCustomer] = useState(pkg?.mandatory_customer ?? false);
  const [mandatorySO,       setMandatorySO]       = useState(pkg?.mandatory_so      ?? false);
  const [unitPacking,       setUnitPacking]       = useState(pkg?.unit_packing      ?? false);
  const [packingSizes,      setPackingSizes]      = useState(
    pkg?.packing_sizes?.length ? pkg.packing_sizes.map((r) => ({ ...r })) : [makePackingRow()]
  );
  const [attrs,             setAttrs]             = useState(
    pkg?.attributes?.length ? pkg.attributes.map((r) => ({ ...r })) : [makeAttrRow()]
  );
  const [saving,      setSaving]      = useState(false);
  const [itemTags,    setItemTags]    = useState([]);   // [{ id, name, tag_type }] — all tags

  // ── Fetch all tags ─────────────────────────────────────────────────────────
  useEffect(() => {
    tagApi.getAll()
      .then((data) => {
        const all = Array.isArray(data) ? data : (data?.data ?? []);
        setItemTags(all);
      })
      .catch(() => { /* non-critical — fallback to empty */ });
  }, []);

  // ── Packing size helpers ───────────────────────────────────────────────────
  const updatePS = (id, changes) =>
    setPackingSizes((p) => p.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  const deletePS = (id) =>
    setPackingSizes((p) => p.filter((r) => r.id !== id));

  // ── Attribute helpers ──────────────────────────────────────────────────────
  const updateAttr = (id, changes) =>
    setAttrs((p) => p.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  const deleteAttr = (id) =>
    setAttrs((p) => p.filter((r) => r.id !== id));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!name.trim()) { message.warning('Name is required'); return; }

    const payload = {
      name:               name.trim(),
      type_of_package:    typeOfPackage  || null,
      type_of_input:      typeOfInput    || null,
      tare_weight:        tareWeight     ?? null,
      pack_length:        packLength     ?? null,
      pack_width:         packWidth      ?? null,
      pack_height:        packHeight     ?? null,
      mandatory_customer: mandatoryCustomer,
      mandatory_so:       mandatorySO,
      unit_packing:       unitPacking,
      packing_sizes:      packingSizes.filter((r) => r.item_tags?.length || r.pack_size),
      attributes:         attrs.filter((r) => r.name?.trim()),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await packageApi.update(pkg.id, payload);
        message.success(`"${name}" updated`);
      } else {
        await packageApi.create(payload);
        message.success(`"${name}" created`);
      }
      onSaved();
    } catch (err) {
      message.error(err?.message || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Packing size table columns ─────────────────────────────────────────────
  const psColumns = [
    {
      title: <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Item Tags</Text>,
      key:   'item_tags',
      render: (_, r) => (
        <Select
          mode="multiple"
          value={r.item_tags}
          onChange={(v) => updatePS(r.id, { item_tags: v })}
          placeholder="No attached Item Group tags"
          size="small"
          style={{ width: '100%', minWidth: 220 }}
          disabled={!canWrite}
          showSearch
          optionFilterProp="label"
          allowClear
          options={(() => {
            // Group tags by tag_type for organised dropdown
            const groups = {};
            itemTags.forEach((t) => {
              const g = t.tag_type || 'General';
              if (!groups[g]) groups[g] = [];
              groups[g].push({ value: t.id, label: t.name });
            });
            return Object.entries(groups).map(([type, opts]) => ({
              label: type,
              options: opts,
            }));
          })()}
          notFoundContent={
            <Text style={{ fontSize: 12, color: '#9ca3af', padding: '8px 12px', display: 'block' }}>
              No tags found
            </Text>
          }
        />
      ),
    },
    {
      title: <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Pack Size</Text>,
      key:   'pack_size',
      width: 180,
      render: (_, r) => (
        <Input
          value={r.pack_size}
          onChange={(e) => updatePS(r.id, { pack_size: e.target.value })}
          placeholder="e.g. 10 pcs"
          size="small"
          style={{ borderRadius: 6 }}
          disabled={!canWrite}
        />
      ),
    },
    {
      title:  '',
      key:    'actions',
      width:  52,
      align:  'center',
      render: (_, r) =>
        canWrite ? (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deletePS(r.id)}
          />
        ) : null,
    },
  ];

  // ── Attributes table columns ───────────────────────────────────────────────
  const attrColumns = [
    {
      title: <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Name</Text>,
      key:   'name',
      render: (_, r) => (
        <Input
          value={r.name}
          onChange={(e) => updateAttr(r.id, { name: e.target.value })}
          placeholder="Attribute name"
          size="small"
          style={{ borderRadius: 6 }}
          disabled={!canWrite}
        />
      ),
    },
    {
      title: <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Type</Text>,
      key:   'type',
      width: 180,
      render: (_, r) => (
        <Select
          value={r.type}
          onChange={(v) => updateAttr(r.id, { type: v })}
          size="small"
          style={{ width: '100%' }}
          disabled={!canWrite}
        >
          {ATTR_TYPES.map((t) => <Option key={t} value={t}>{t}</Option>)}
        </Select>
      ),
    },
    {
      title:  '',
      key:    'action',
      width:  52,
      align:  'center',
      render: (_, r) =>
        canWrite ? (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteAttr(r.id)}
          />
        ) : null,
    },
  ];

  const tableStyle = {
    borderRadius: 8,
    overflow:     'hidden',
    border:       '1px solid #f0f0f0',
    marginBottom: 8,
  };

  return (
    <AppLayout>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           12,
          marginBottom:  20,
          paddingBottom: 16,
          borderBottom:  '1px solid #e5e7eb',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ borderRadius: 8 }} />
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          {isEdit ? `Edit ${pkg.name}` : 'Add Package'}
        </Title>
      </div>

      {/* ── Main form card ───────────────────────────────────────────────── */}
      <Card
        style={{
          border:       '1px solid #e8eaed',
          borderRadius: 12,
          boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        {/* ── Package Identity ─────────────────────────────────────────── */}
        <SectionTitle title="Package Identity" />
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={8}>
            <FieldLabel required>Name</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Package name"
              style={{ borderRadius: 8 }}
              disabled={!canWrite}
            />
          </Col>
          <Col span={8}>
            <FieldLabel>Type of Package</FieldLabel>
            <Select
              value={typeOfPackage}
              onChange={setTypeOfPackage}
              allowClear
              placeholder="Select type"
              style={{ width: '100%' }}
              disabled={!canWrite}
            >
              {PACKAGE_TYPES.map((t) => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </Col>
          <Col span={8}>
            <FieldLabel>Type of Input</FieldLabel>
            <Select
              value={typeOfInput}
              onChange={setTypeOfInput}
              allowClear
              placeholder="Select input type"
              style={{ width: '100%' }}
              disabled={!canWrite}
            >
              {INPUT_TYPES.map((t) => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </Col>
        </Row>

        {/* ── Physical Properties ──────────────────────────────────────── */}
        <SectionTitle title="Physical Properties" />
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={6}>
            <FieldLabel>Tare Weight</FieldLabel>
            <InputNumber
              value={tareWeight}
              onChange={setTareWeight}
              min={0}
              step={0.001}
              precision={3}
              addonAfter="kg"
              style={{ width: '100%' }}
              disabled={!canWrite}
            />
          </Col>
          <Col span={6}>
            <FieldLabel>Length</FieldLabel>
            <InputNumber
              value={packLength}
              onChange={setPackLength}
              min={0}
              step={0.01}
              precision={3}
              addonAfter="in"
              style={{ width: '100%' }}
              disabled={!canWrite}
            />
          </Col>
          <Col span={6}>
            <FieldLabel>Width</FieldLabel>
            <InputNumber
              value={packWidth}
              onChange={setPackWidth}
              min={0}
              step={0.01}
              precision={3}
              addonAfter="in"
              style={{ width: '100%' }}
              disabled={!canWrite}
            />
          </Col>
          <Col span={6}>
            <FieldLabel>Height</FieldLabel>
            <InputNumber
              value={packHeight}
              onChange={setPackHeight}
              min={0}
              step={0.01}
              precision={3}
              addonAfter="in"
              style={{ width: '100%' }}
              disabled={!canWrite}
            />
          </Col>
        </Row>

        {/* ── Usage Rules ──────────────────────────────────────────────── */}
        <SectionTitle title="Usage Rules" />
        <Row gutter={40} style={{ marginBottom: 24 }}>
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Switch
                checked={mandatoryCustomer}
                onChange={setMandatoryCustomer}
                disabled={!canWrite}
              />
              <Text style={{ fontSize: 13, color: '#374151' }}>Mandatory Customer</Text>
            </div>
          </Col>
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Switch
                checked={mandatorySO}
                onChange={setMandatorySO}
                disabled={!canWrite}
              />
              <Text style={{ fontSize: 13, color: '#374151' }}>Mandatory SO</Text>
            </div>
          </Col>
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Switch
                checked={unitPacking}
                onChange={setUnitPacking}
                disabled={!canWrite}
              />
              <Text style={{ fontSize: 13, color: '#374151' }}>Unit Packing</Text>
            </div>
          </Col>
        </Row>

        {/* ── Standard Packing Size ────────────────────────────────────── */}
        <SectionTitle title="Standard Packing Size" />
        <Table
          rowKey="id"
          columns={psColumns}
          dataSource={packingSizes}
          pagination={false}
          size="small"
          style={tableStyle}
        />
        {canWrite && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setPackingSizes((p) => [...p, makePackingRow()])}
            style={{ borderRadius: 6, fontSize: 12, marginBottom: 20 }}
            size="small"
          >
            Add New Row
          </Button>
        )}

        {/* ── Attributes ───────────────────────────────────────────────── */}
        <SectionTitle title="Attributes" />
        <Table
          rowKey="id"
          columns={attrColumns}
          dataSource={attrs}
          pagination={false}
          size="small"
          style={tableStyle}
        />
        {canWrite && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setAttrs((p) => [...p, makeAttrRow()])}
            style={{ borderRadius: 6, fontSize: 12 }}
            size="small"
          >
            Add New Row
          </Button>
        )}
      </Card>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      {canWrite && (
        <Button
          type="primary"
          loading={saving}
          onClick={handleSubmit}
          style={{ borderRadius: 8, fontWeight: 600, minWidth: 110 }}
        >
          {isEdit ? 'Update' : 'Submit'}
        </Button>
      )}
    </AppLayout>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  PACKAGES LIST — Configuration-theme table view
// ══════════════════════════════════════════════════════════════════════════════
const PackagesList = ({
  packages, loading, search, onSearchChange, onRefresh, onNew, onEdit, onDelete, canWrite,
}) => {
  const columns = [
    {
      title:    'Name',
      key:      'name',
      width:    220,
      ellipsis: true,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width:          32,
              height:         32,
              borderRadius:   8,
              flexShrink:     0,
              background:     '#eff6ff',
              border:         '1px solid #bfdbfe',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          '#1d4ed8',
              fontSize:       14,
            }}
          >
            <InboxOutlined />
          </div>
          <Text
            ellipsis={{ tooltip: r.name }}
            style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13, cursor: 'pointer', flex: 1, minWidth: 0 }}
            onClick={() => onEdit(r)}
          >
            {r.name}
          </Text>
        </div>
      ),
    },
    {
      title: 'Type of Package',
      key:   'type_of_package',
      width: 160,
      render: (_, r) =>
        r.type_of_package ? (
          <Tag color="blue" style={{ borderRadius: 4 }}>{r.type_of_package}</Tag>
        ) : (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>
        ),
    },
    {
      title: 'Attributes',
      key:   'attributes',
      width: 120,
      render: (_, r) => {
        const count = r.attributes?.length ?? 0;
        return count > 0 ? (
          <Tag color="geekblue" style={{ borderRadius: 4 }}>{count} attr{count > 1 ? 's' : ''}</Tag>
        ) : (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>
        );
      },
    },
    {
      title: 'Tare Wt',
      key:   'tare_weight',
      width: 100,
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>
          {r.tare_weight != null ? `${parseFloat(r.tare_weight).toFixed(3)} kg` : '—'}
        </Text>
      ),
    },
    {
      title: 'Pack Length',
      key:   'pack_length',
      width: 110,
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>
          {r.pack_length != null ? `${fmtDim(r.pack_length)} in` : '—'}
        </Text>
      ),
    },
    {
      title: 'Pack Width',
      key:   'pack_width',
      width: 110,
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>
          {r.pack_width != null ? `${fmtDim(r.pack_width)} in` : '—'}
        </Text>
      ),
    },
    {
      title: 'Pack Height',
      key:   'pack_height',
      width: 110,
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>
          {r.pack_height != null ? `${fmtDim(r.pack_height)} in` : '—'}
        </Text>
      ),
    },
    {
      title: 'Volume',
      key:   'volume',
      width: 120,
      render: (_, r) => {
        const { pack_length: l, pack_width: w, pack_height: h } = r;
        if (l == null || w == null || h == null) {
          return <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>;
        }
        const vol = (parseFloat(l) * parseFloat(w) * parseFloat(h)).toFixed(2);
        return (
          <Text style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>
            {vol} in³
          </Text>
        );
      },
    },
    {
      title:  'Created At',
      key:    'created',
      width:  180,
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
      width:  180,
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
      title:  'Actions',
      key:    'actions',
      width:  80,
      align:  'center',
      render: (_, r) =>
        canWrite ? (
          <Tooltip title="Delete package">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ borderRadius: 6 }}
              onClick={() => onDelete(r)}
            />
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Card
      style={{
        border:       '1px solid #e8eaed',
        borderRadius: 12,
        boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
      }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <Input
          placeholder="Search packages…"
          prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 260, borderRadius: 8 }}
          allowClear
        />
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>
          Refresh
        </Button>
        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onNew}
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
        dataSource={packages}
        loading={loading}
        pagination={{
          pageSize:  10,
          showTotal: (t) => `${t} packages`,
          style:     { marginBottom: 0 },
        }}
        scroll={{ x: 1520 }}
        size="middle"
        style={{ borderRadius: 8, overflow: 'hidden' }}
        locale={{
          emptyText: (
            <div style={{ padding: 40 }}>
              <InboxOutlined
                style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }}
              />
              <Text style={{ color: '#9ca3af' }}>No packages created yet</Text>
              {canWrite && (
                <>
                  <br />
                  <Button
                    type="primary"
                    size="small"
                    onClick={onNew}
                    style={{ marginTop: 10 }}
                  >
                    Create First Package
                  </Button>
                </>
              )}
            </div>
          ),
        }}
      />
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const PackagesPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('inventory-packages-create_edit_delete');

  const [packages,  setPackages]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [view,      setView]      = useState('list');   // 'list' | 'create' | 'edit'
  const [selected,  setSelected]  = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await packageApi.getAll();
      setPackages(data ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.name}"?`,
      content: 'This package and all its configuration will be permanently deleted.',
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await packageApi.delete(record.id);
          message.success(`"${record.name}" deleted`);
          fetchPackages();
        } catch (err) {
          message.error(err?.message || 'Failed to delete package');
        }
      },
    });
  };

  const handleSaved = () => { setView('list'); setSelected(null); fetchPackages(); };

  // ── Client-side search ─────────────────────────────────────────────────────
  const filtered = search
    ? packages.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
    : packages;

  // ── Builder views ──────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <PackageBuilder
        pkg={null}
        onBack={() => setView('list')}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }
  if (view === 'edit' && selected) {
    return (
      <PackageBuilder
        pkg={selected}
        onBack={() => { setView('list'); setSelected(null); }}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const withAttrs   = packages.filter((p) => p.attributes?.length > 0).length;
  const withRules   = packages.filter((p) => p.packing_sizes?.length > 0).length;

  return (
    <AppLayout>
      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Inventory</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Packages</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Packages
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Define physical packaging options with dimensions, packing rules and attributes
        </Text>
      </div>

      {/* Stats chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Packages',   value: packages.length, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'With Attributes',  value: withAttrs,        color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'With Pack Rules',  value: withRules,        color: '#b45309', bg: '#fef3c7' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding:       '8px 16px',
              background:    s.bg,
              border:        `1px solid ${s.color}30`,
              borderRadius:  8,
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              minWidth:      90,
            }}
          >
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              {s.value}
            </Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      {/* List */}
      <PackagesList
        packages={filtered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onRefresh={fetchPackages}
        onNew={() => setView('create')}
        onEdit={(r) => { setSelected(r); setView('edit'); }}
        onDelete={handleDelete}
        canWrite={canWrite}
      />
    </AppLayout>
  );
};

export default PackagesPage;
