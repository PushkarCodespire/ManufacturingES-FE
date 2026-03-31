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
  EditOutlined,
  CheckOutlined,
  MinusOutlined,
  UpOutlined,
  DownOutlined,
  FileTextOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { templateApi } from '../../../../api/template.api';
import AppLayout        from '../../../../components/AppLayout';
import usePermissions   from '../../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../../utils/exportCsv';

const { Title, Text } = Typography;
const { Option }      = Select;
const { TextArea }    = Input;

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// ── Field types (matches screenshot 2 dropdown) ────────────────────────────────
const FIELD_TYPES = [
  { value: 'text',         label: 'Text'          },
  { value: 'textarea',     label: 'Text Area'      },
  { value: 'number',       label: 'Number'         },
  { value: 'date',         label: 'Date'           },
  { value: 'file',         label: 'File Upload'    },
  { value: 'alphanumeric', label: 'Alphanumeric'   },
  { value: 'list',         label: 'List'           },
  { value: 'model',        label: 'Model'          },
];

// ── Section layout options ─────────────────────────────────────────────────────
const LAYOUT_OPTIONS = [
  { value: 'none',  label: 'None'     },
  { value: '2-col', label: '2 Column' },
];

// ── Unique ID helper ───────────────────────────────────────────────────────────
let _uid = 0;
const uid = () => `${Date.now()}_${++_uid}`;

const makeSection = () => ({
  id:       uid(),
  label:    '',
  layout:   'none',
  fields:   [],
});

const makeField = () => ({
  id:       uid(),
  name:     '',
  type:     'text',
  required: true,
  options:  [],
});

// ══════════════════════════════════════════════════════════════════════════════
//  FIELD CARD — single field within a section
// ══════════════════════════════════════════════════════════════════════════════
const FieldCard = ({ field, canWrite, onUpdate, onDelete }) => {
  const isList  = field.type === 'list';

  const addOption    = () => onUpdate({ options: [...(field.options || []), ''] });
  const updateOption = (i, val) => {
    const opts = [...(field.options || [])];
    opts[i] = val;
    onUpdate({ options: opts });
  };
  const deleteOption = (i) => {
    const opts = [...(field.options || [])];
    opts.splice(i, 1);
    onUpdate({ options: opts });
  };

  return (
    <div
      style={{
        border:       '1px solid #e5e7eb',
        borderRadius: 8,
        padding:      '10px 12px',
        background:   '#fff',
      }}
    >
      {/* Field header row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: isList ? 10 : 0 }}>
        <Input
          value={field.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Name"
          style={{ flex: 1, borderRadius: 6 }}
          disabled={!canWrite}
        />
        <Select
          value={field.type}
          onChange={(v) => onUpdate({ type: v, options: v === 'list' ? [''] : [] })}
          style={{ width: 158 }}
          showSearch
          disabled={!canWrite}
          optionFilterProp="children"
        >
          {FIELD_TYPES.map((t) => (
            <Option key={t.value} value={t.value}>{t.label}</Option>
          ))}
        </Select>
        <Tooltip title={field.required ? 'Required' : 'Optional'}>
          <Switch
            checked={field.required}
            onChange={(v) => onUpdate({ required: v })}
            disabled={!canWrite}
            size="small"
          />
        </Tooltip>
        {canWrite && (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={onDelete}
            style={{ flexShrink: 0 }}
          />
        )}
      </div>

      {/* Options list — only for 'list' type */}
      {isList && (
        <div>
          {(field.options || []).map((opt, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
              <TextArea
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                rows={2}
                style={{ flex: 1, borderRadius: 6, resize: 'vertical', fontSize: 12 }}
                disabled={!canWrite}
                placeholder="Option value…"
              />
              {canWrite && (
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => deleteOption(i)}
                  style={{ marginTop: 4, flexShrink: 0 }}
                />
              )}
            </div>
          ))}
          {canWrite && (
            <Button
              type="link"
              size="small"
              onClick={addOption}
              style={{ padding: 0, fontSize: 12, height: 'auto' }}
            >
              + Add Another Option
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  SECTION CARD — collapsible section containing fields
// ══════════════════════════════════════════════════════════════════════════════
const SectionCard = ({
  section, sIdx, totalSections, canWrite,
  onUpdate, onDelete, onMoveUp, onMoveDown,
}) => {
  const [labelEditing, setLabelEditing] = useState(!section.label);
  const [collapsed,    setCollapsed]    = useState(false);

  const addField = () => {
    onUpdate({ fields: [...section.fields, makeField()] });
  };

  const updateField = (fieldId, updates) => {
    onUpdate({ fields: section.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)) });
  };

  const deleteField = (fieldId) => {
    onUpdate({ fields: section.fields.filter((f) => f.id !== fieldId) });
  };

  return (
    <div
      style={{
        border:       '1px solid #e5e7eb',
        borderRadius: 10,
        overflow:     'hidden',
        background:   '#fff',
        boxShadow:    '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Section header */}
      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           8,
          padding:       '10px 14px',
          background:    '#f9fafb',
          borderBottom:  collapsed ? 'none' : '1px solid #e5e7eb',
        }}
      >
        {/* Collapse toggle */}
        <Button
          type="text"
          size="small"
          icon={collapsed ? <PlusOutlined /> : <MinusOutlined />}
          onClick={() => setCollapsed((v) => !v)}
          style={{ color: '#6b7280', flexShrink: 0 }}
        />

        {/* Section label — edit or display */}
        {labelEditing ? (
          <>
            <Input
              value={section.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              onPressEnter={() => setLabelEditing(false)}
              placeholder="Section label"
              style={{ flex: 1, maxWidth: 320, borderRadius: 6, fontWeight: 600, textTransform: 'uppercase' }}
              autoFocus
            />
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined style={{ color: '#1d4ed8' }} />}
              onClick={() => setLabelEditing(false)}
            />
          </>
        ) : (
          <>
            <Text style={{ fontWeight: 700, fontSize: 12, color: '#374151', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 }}>
              {section.label || <span style={{ color: '#9ca3af', fontWeight: 400 }}>Untitled Section</span>}
            </Text>
            {canWrite && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ color: '#9ca3af', fontSize: 12 }} />}
                onClick={() => setLabelEditing(true)}
              />
            )}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Layout selector */}
        <Select
          value={section.layout}
          onChange={(v) => onUpdate({ layout: v })}
          options={LAYOUT_OPTIONS}
          style={{ width: 110 }}
          size="small"
          disabled={!canWrite}
        />

        {/* Move up / down */}
        <Tooltip title="Move up">
          <Button
            type="text"
            size="small"
            icon={<UpOutlined />}
            disabled={sIdx === 0}
            onClick={onMoveUp}
            style={{ color: sIdx === 0 ? '#d1d5db' : '#6b7280' }}
          />
        </Tooltip>
        <Tooltip title="Move down">
          <Button
            type="text"
            size="small"
            icon={<DownOutlined />}
            disabled={sIdx === totalSections - 1}
            onClick={onMoveDown}
            style={{ color: sIdx === totalSections - 1 ? '#d1d5db' : '#6b7280' }}
          />
        </Tooltip>

        {/* Delete section */}
        {canWrite && (
          <Tooltip title="Delete section">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={onDelete}
            />
          </Tooltip>
        )}
      </div>

      {/* Section body — fields */}
      {!collapsed && (
        <div style={{ padding: '16px 14px' }}>
          <div
            style={{
              display:             'grid',
              gridTemplateColumns: section.layout === '2-col' ? '1fr 1fr' : '1fr',
              gap:                 14,
            }}
          >
            {section.fields.map((field) => (
              <FieldCard
                key={field.id}
                field={field}
                canWrite={canWrite}
                onUpdate={(updates) => updateField(field.id, updates)}
                onDelete={() => deleteField(field.id)}
              />
            ))}
          </div>

          {canWrite && (
            <Button
              type="link"
              icon={<PlusOutlined />}
              onClick={addField}
              style={{ padding: 0, marginTop: section.fields.length ? 14 : 0, fontWeight: 600, fontSize: 13 }}
            >
              + Add Custom Field
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  TEMPLATE BUILDER — create / edit view
// ══════════════════════════════════════════════════════════════════════════════
const TemplateBuilder = ({ template, onBack, onSaved, canWrite }) => {
  const isEdit   = Boolean(template);
  const [name,     setName]     = useState(template?.name ?? '');
  const [sections, setSections] = useState(
    template?.sections?.length
      ? template.sections.map((s) => ({ ...s }))
      : [makeSection()]
  );
  const [saving, setSaving] = useState(false);

  // ── Section operations ─────────────────────────────────────────────────────
  const addSection = () => setSections((p) => [...p, makeSection()]);

  const updateSection = (id, updates) =>
    setSections((p) => p.map((s) => (s.id === id ? { ...s, ...updates } : s)));

  const deleteSection = (id) =>
    setSections((p) => p.filter((s) => s.id !== id));

  const moveSectionUp = (idx) => {
    if (idx === 0) return;
    setSections((p) => {
      const next = [...p];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveSectionDown = (idx) => {
    setSections((p) => {
      if (idx === p.length - 1) return p;
      const next = [...p];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!name.trim()) { message.warning('Template name is required'); return; }
    if (!sections.length) { message.warning('Add at least one section'); return; }

    const payload = {
      name,
      sections: sections.map((s) => ({
        id:     s.id,
        label:  (s.label || '').trim(),
        layout: s.layout,
        fields: s.fields.map((f) => ({
          id:       f.id,
          name:     f.name,
          type:     f.type,
          required: f.required,
          options:  f.options || [],
        })),
      })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await templateApi.update(template.id, payload);
        message.success('Template updated');
      } else {
        await templateApi.create(payload);
        message.success(`Template "${name}" created`);
      }
      onSaved();
    } catch (err) {
      message.error(err?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          14,
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom:  '1px solid #e5e7eb',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ borderRadius: 8 }} />

        {isEdit ? (
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
            Edit {template.name}
          </Title>
        ) : (
          <>
            <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
              Create Template
            </Title>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template Name (e.g. Purchase Order)"
              style={{ width: 240, borderRadius: 8, fontWeight: 500 }}
              suffix={<DownOutlined style={{ color: '#9ca3af', fontSize: 11 }} />}
            />
          </>
        )}

        <div style={{ flex: 1 }} />

        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={addSection}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            + Add New Section
          </Button>
        )}
      </div>

      {/* ── Sections list ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sections.map((section, idx) => (
          <SectionCard
            key={section.id}
            section={section}
            sIdx={idx}
            totalSections={sections.length}
            canWrite={canWrite}
            onUpdate={(updates) => updateSection(section.id, updates)}
            onDelete={() => deleteSection(section.id)}
            onMoveUp={() => moveSectionUp(idx)}
            onMoveDown={() => moveSectionDown(idx)}
          />
        ))}
      </div>

      {/* ── Submit ─────────────────────────────────────────────────────────── */}
      {canWrite && (
        <div style={{ marginTop: 24 }}>
          <Button
            type="primary"
            loading={saving}
            onClick={handleSubmit}
            style={{ borderRadius: 8, fontWeight: 600, minWidth: 100 }}
          >
            {isEdit ? 'Update' : 'Submit'}
          </Button>
        </div>
      )}
    </AppLayout>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  TEMPLATES LIST — Configuration-theme table view
// ══════════════════════════════════════════════════════════════════════════════
const TemplatesList = ({
  templates, loading, search, onSearchChange, onRefresh, onNew, onEdit, onDelete, canWrite,
}) => {
  const columns = [
    {
      title: 'Template Name',
      key:   'name',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: '#eff6ff', border: '1px solid #bfdbfe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#1d4ed8', fontSize: 16,
            }}
          >
            <FileTextOutlined />
          </div>
          <Text
            style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            onClick={() => onEdit(r)}
          >
            {r.name}
          </Text>
        </div>
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
      render: (_, r) => (
        <Tooltip title="Delete template">
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            style={{ borderRadius: 6 }}
            onClick={() => onDelete(r)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
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
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 260, borderRadius: 8 }}
          allowClear
        />
        <div style={{ flex: 1 }} />
        <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('templates.csv', templates, columns)}>Export CSV</Button>
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
        dataSource={templates}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `${t} templates`, style: { marginBottom: 0 } }}
        scroll={{ x: 700 }}
        size="middle"
        style={{ borderRadius: 8, overflow: 'hidden' }}
        locale={{
          emptyText: (
            <div style={{ padding: 40 }}>
              <FileTextOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
              <Text style={{ color: '#9ca3af' }}>No templates created yet</Text>
              {canWrite && (
                <>
                  <br />
                  <Button type="primary" size="small" onClick={onNew} style={{ marginTop: 10 }}>
                    Create Your First Template
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
const TemplatesPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('other-templates-create_edit_delete');

  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [view,      setView]      = useState('list');   // 'list' | 'create' | 'edit'
  const [selected,  setSelected]  = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await templateApi.getAll();
      setTemplates(data ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.name}"?`,
      content: 'This template and all its sections/fields will be permanently deleted.',
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await templateApi.delete(record.id);
          message.success(`"${record.name}" deleted`);
          fetchTemplates();
        } catch (err) {
          message.error(err?.message || 'Failed to delete template');
        }
      },
    });
  };

  const handleSaved = () => { setView('list'); setSelected(null); fetchTemplates(); };

  // ── Client-side search ─────────────────────────────────────────────────────
  const filtered = search
    ? templates.filter((t) => t.name?.toLowerCase().includes(search.toLowerCase()))
    : templates;

  // ── Builder views ──────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <TemplateBuilder
        template={null}
        onBack={() => setView('list')}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }
  if (view === 'edit' && selected) {
    return (
      <TemplateBuilder
        template={selected}
        onBack={() => { setView('list'); setSelected(null); }}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalSections = templates.reduce((sum, t) => sum + (t.sections?.length ?? 0), 0);
  const totalFields   = templates.reduce(
    (sum, t) => sum + (t.sections?.reduce((s2, sec) => s2 + (sec.fields?.length ?? 0), 0) ?? 0), 0
  );

  return (
    <AppLayout>
      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Other</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Templates</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Templates
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Build document templates with custom sections and fields for Purchase Orders, Enquiries and more
        </Text>
      </div>

      {/* Stats chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total',    value: templates.length, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Sections', value: totalSections,    color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Fields',   value: totalFields,      color: '#b45309', bg: '#fef3c7' },
        ].map((s) => (
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

      {/* List */}
      <TemplatesList
        templates={filtered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onRefresh={fetchTemplates}
        onNew={() => setView('create')}
        onEdit={(r) => { setSelected(r); setView('edit'); }}
        onDelete={handleDelete}
        canWrite={canWrite}
      />
    </AppLayout>
  );
};

export default TemplatesPage;
