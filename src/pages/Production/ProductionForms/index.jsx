import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Input, Typography, Modal, message,
  Select, Switch, Tag, Tooltip, Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  RightOutlined,
  FormOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { productionFormApi } from '../../../api/productionForm.api';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option }      = Select;

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// ── Group By options ────────────────────────────────────────────────────────────
// '' maps to null (None) in the database
const GROUP_BY_OPTIONS = [
  { value: '',                   label: 'None'              },
  { value: 'Item',               label: 'Item'              },
  { value: 'Item Tags',          label: 'Item Tags'         },
  { value: 'Rejection Reasons',  label: 'Rejection Reasons' },
  { value: 'Downtime Reasons',   label: 'Downtime Reasons'  },
  { value: 'Scraps',             label: 'Scraps'            },
];

// ── Unique ID helper ─────────────────────────────────────────────────────────────
let _uid = 0;
const uid = () => `${Date.now()}_${++_uid}`;

// Convert a label to a safe field key (snake_case slug)
const toKey = (label) => {
  if (!label) return '';
  return label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

const makeNumberField = () => ({
  id:         uid(),
  label:      '',
  key:        '',
  type:       'Number',
  is_derived: false,
  ctq:        false,
});

const makeDerivedField = () => ({
  id:         uid(),
  label:      '',
  key:        '',
  type:       '',
  is_derived: true,
  ctq:        false,
});

// ══════════════════════════════════════════════════════════════════════════════
//  PRODUCTION FORM BUILDER — create / edit view
// ══════════════════════════════════════════════════════════════════════════════
const ProductionFormBuilder = ({ form, onBack, onSaved, canWrite }) => {
  const isEdit = Boolean(form);

  // '' represents "None" (null in DB); a populated group_by is its own value
  const [title,   setTitle]   = useState(form?.title ?? '');
  const [groupBy, setGroupBy] = useState(form?.group_by ?? '');
  const [fields,  setFields]  = useState(
    form?.fields?.length ? form.fields.map((f) => ({ ...f })) : []
  );
  const [saving, setSaving] = useState(false);

  // ── Field operations ──────────────────────────────────────────────────────
  const addNumberField  = () => setFields((p) => [...p, makeNumberField()]);
  const addDerivedField = () => setFields((p) => [...p, makeDerivedField()]);

  const updateField = (id, changes) =>
    setFields((p) => p.map((f) => (f.id === id ? { ...f, ...changes } : f)));

  const deleteField = (id) =>
    setFields((p) => p.filter((f) => f.id !== id));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim()) { message.warning('Title is required'); return; }

    const payload = {
      title:    title.trim(),
      group_by: groupBy || null,          // '' → null (None)
      fields:   fields.map(({ id, label, key, type, is_derived, ctq }) => ({
        id, label, key, type, is_derived, ctq,
      })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await productionFormApi.update(form.id, payload);
        message.success('Production form updated');
      } else {
        await productionFormApi.create(payload);
        message.success(`"${title}" created`);
      }
      onSaved();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: (
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          Label / Key
        </Text>
      ),
      key: 'label',
      render: (_, f) => (
        <div>
          <Input
            value={f.label}
            onChange={(e) => {
              const label = e.target.value;
              updateField(f.id, { label, key: toKey(label) });
            }}
            placeholder="Label"
            size="small"
            style={{ borderRadius: 6 }}
            disabled={!canWrite}
          />
          {f.key && (
            <Text
              style={{
                fontSize:    11,
                color:       '#9ca3af',
                fontFamily:  'monospace',
                display:     'block',
                marginTop:   3,
                paddingLeft: 2,
              }}
            >
              {f.key}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: (
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Type</Text>
      ),
      key:   'type',
      width: 200,
      render: (_, f) =>
        f.is_derived ? (
          <Input
            value={f.type}
            onChange={(e) => updateField(f.id, { type: e.target.value })}
            placeholder="Formula / Expression"
            size="small"
            style={{ borderRadius: 6 }}
            disabled={!canWrite}
          />
        ) : (
          <Tag
            color="blue"
            style={{ borderRadius: 4, fontSize: 12, fontWeight: 500, padding: '1px 10px' }}
          >
            Number
          </Tag>
        ),
    },
    {
      title: (
        <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block' }}>
            CTQ
          </Text>
          <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>
            (Derived Only)
          </Text>
        </div>
      ),
      key:   'ctq',
      width: 130,
      align: 'center',
      render: (_, f) => (
        <Switch
          checked={f.ctq}
          onChange={(v) => updateField(f.id, { ctq: v })}
          disabled={!f.is_derived || !canWrite}
          size="small"
        />
      ),
    },
    {
      title:  '',
      key:    'actions',
      width:  52,
      align:  'center',
      render: (_, f) =>
        canWrite ? (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteField(f.id)}
          />
        ) : null,
    },
  ];

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
          {isEdit ? `Edit ${form.title}` : 'Add New Production Forms'}
        </Title>
      </div>

      {/* ── Main card ───────────────────────────────────────────────────── */}
      <Card
        style={{
          border:     '1px solid #e8eaed',
          borderRadius: 12,
          boxShadow:  '0 1px 4px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '20px' }}
      >
        {/* Control row — Title, Group By, Add Field buttons */}
        <div
          style={{
            display:     'flex',
            gap:         12,
            alignItems:  'flex-end',
            marginBottom: 20,
            flexWrap:    'wrap',
          }}
        >
          {/* Title input */}
          <div>
            <Text
              style={{
                fontSize:   12,
                fontWeight: 600,
                color:      '#374151',
                display:    'block',
                marginBottom: 4,
              }}
            >
              Title <span style={{ color: '#dc2626' }}>*</span>
            </Text>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Form title"
              style={{ width: 220, borderRadius: 8 }}
              disabled={!canWrite}
            />
          </div>

          {/* Group By select */}
          <div>
            <Text
              style={{
                fontSize:   12,
                fontWeight: 600,
                color:      '#374151',
                display:    'block',
                marginBottom: 4,
              }}
            >
              Group By
            </Text>
            <Select
              value={groupBy}
              onChange={(v) => setGroupBy(v)}
              showSearch
              style={{ width: 200 }}
              optionFilterProp="children"
              disabled={!canWrite}
              placeholder="None"
            >
              {GROUP_BY_OPTIONS.map((opt) => (
                <Option key={opt.value || '__none__'} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </div>

          <div style={{ flex: 1 }} />

          {/* Add field buttons */}
          {canWrite && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Button
                icon={<PlusOutlined />}
                onClick={addNumberField}
                style={{ borderRadius: 8 }}
              >
                Add Number Field
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={addDerivedField}
                style={{ borderRadius: 8 }}
              >
                Add Derived Field
              </Button>
            </div>
          )}
        </div>

        {/* Fields table / empty state */}
        {fields.length > 0 ? (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={fields}
            pagination={false}
            size="small"
            style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #f0f0f0' }}
          />
        ) : (
          <div
            style={{
              textAlign:    'center',
              padding:      '36px 0',
              borderTop:    '1px solid #f0f0f0',
              color:        '#9ca3af',
            }}
          >
            <FormOutlined
              style={{ fontSize: 30, display: 'block', marginBottom: 10, color: '#d1d5db' }}
            />
            <Text style={{ color: '#9ca3af', fontSize: 13 }}>
              No fields yet — use the buttons above to add number or derived fields
            </Text>
          </div>
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
//  PRODUCTION FORMS LIST — Configuration-theme table view
// ══════════════════════════════════════════════════════════════════════════════
const ProductionFormsList = ({
  forms, loading, search, onSearchChange, onRefresh, onNew, onEdit, onDelete, canWrite,
}) => {
  const columns = [
    {
      title: 'Name',
      key:   'title',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width:           36,
              height:          36,
              borderRadius:    10,
              flexShrink:      0,
              background:      '#eff6ff',
              border:          '1px solid #bfdbfe',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              color:           '#1d4ed8',
              fontSize:        16,
            }}
          >
            <FormOutlined />
          </div>
          <Text
            style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            onClick={() => onEdit(r)}
          >
            {r.title}
          </Text>
        </div>
      ),
    },
    {
      title: 'Keys',
      key:   'keys',
      width: 220,
      render: (_, r) => {
        const keys = (r.fields || [])
          .map((f) => f.key || f.label)
          .filter(Boolean)
          .join(', ');
        return (
          <Text style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
            {keys || '—'}
          </Text>
        );
      },
    },
    {
      title: 'Per Model',
      key:   'group_by',
      width: 150,
      render: (_, r) =>
        r.group_by ? (
          <Tag color="geekblue" style={{ borderRadius: 4 }}>
            {r.group_by}
          </Tag>
        ) : (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>
        ),
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
          <Tooltip title="Delete form">
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
          placeholder="Search production forms…"
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
        dataSource={forms}
        loading={loading}
        pagination={{
          pageSize:  10,
          showTotal: (t) => `${t} forms`,
          style:     { marginBottom: 0 },
        }}
        scroll={{ x: 900 }}
        size="middle"
        style={{ borderRadius: 8, overflow: 'hidden' }}
        locale={{
          emptyText: (
            <div style={{ padding: 40 }}>
              <FormOutlined
                style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }}
              />
              <Text style={{ color: '#9ca3af' }}>No production forms created yet</Text>
              {canWrite && (
                <>
                  <br />
                  <Button
                    type="primary"
                    size="small"
                    onClick={onNew}
                    style={{ marginTop: 10 }}
                  >
                    Create First Form
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
const ProductionFormsPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('production-production_forms-create_edit_delete');

  const [forms,    setForms]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [view,     setView]     = useState('list');   // 'list' | 'create' | 'edit'
  const [selected, setSelected] = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await productionFormApi.getAll();
      setForms(data ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load production forms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.title}"?`,
      content: 'This production form and all its fields will be permanently deleted.',
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await productionFormApi.delete(record.id);
          message.success(`"${record.title}" deleted`);
          fetchForms();
        } catch (err) {
          message.error(err?.message || 'Failed to delete production form');
        }
      },
    });
  };

  const handleSaved = () => { setView('list'); setSelected(null); fetchForms(); };

  // ── Client-side search ────────────────────────────────────────────────────
  const filtered = search
    ? forms.filter((f) => f.title?.toLowerCase().includes(search.toLowerCase()))
    : forms;

  // ── Builder views ─────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <ProductionFormBuilder
        form={null}
        onBack={() => setView('list')}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }
  if (view === 'edit' && selected) {
    return (
      <ProductionFormBuilder
        form={selected}
        onBack={() => { setView('list'); setSelected(null); }}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalFields   = forms.reduce((sum, f) => sum + (f.fields?.length ?? 0), 0);
  const derivedFields = forms.reduce(
    (sum, f) => sum + (f.fields?.filter((fd) => fd.is_derived).length ?? 0), 0
  );

  return (
    <AppLayout>
      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Production Forms</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Production Forms
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Define data-collection forms for production tracking with number and derived fields
        </Text>
      </div>

      {/* Stats chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Forms',    value: forms.length,  color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Fields',         value: totalFields,   color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Derived Fields', value: derivedFields, color: '#b45309', bg: '#fef3c7' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding:         '8px 16px',
              background:      s.bg,
              border:          `1px solid ${s.color}30`,
              borderRadius:    8,
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              minWidth:        90,
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
      <ProductionFormsList
        forms={filtered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onRefresh={fetchForms}
        onNew={() => setView('create')}
        onEdit={(r) => { setSelected(r); setView('edit'); }}
        onDelete={handleDelete}
        canWrite={canWrite}
      />
    </AppLayout>
  );
};

export default ProductionFormsPage;
