import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Input, Typography, Modal, message,
  Select, Checkbox, Tag, Tooltip, Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  RightOutlined,
  InfoCircleOutlined,
  UpCircleOutlined,
  DownCircleOutlined,
  FormOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { customFieldApi } from '../../../../api/customField.api';
import AppLayout           from '../../../../components/AppLayout';
import usePermissions      from '../../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../../utils/exportCsv';
import CsvUploadModal from '../../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../../utils/csvImport';

const { Title, Text } = Typography;
const { Option }      = Select;

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// ── Predefined system events ───────────────────────────────────────────────────
const PREDEFINED_EVENTS = [
  { label: 'Inventory Inward – Header Custom Fields',           module: 'Inventory'   },
  { label: 'Inventory Outward – Customer Dispatch Fields',      module: 'Inventory'   },
  { label: 'Inventory Outward – Warehouse Transfer Fields',     module: 'Inventory'   },
  { label: 'Inventory Outward – Production Consumption Fields', module: 'Inventory'   },
  { label: 'Sales Order – Header Custom Fields',                module: 'Sales'       },
  { label: 'Sales Order – Line Custom Fields',                  module: 'Sales'       },
  { label: 'Purchase Order – Header Custom Fields',             module: 'Procurement' },
  { label: 'Purchase Order – Line Custom Fields',               module: 'Procurement' },
  { label: 'Create Customer Reference #',                       module: 'Masters'     },
  { label: 'Material Conversion – Custom Fields',               module: 'Production'  },
  { label: 'IQC – Inspection Custom Fields',                    module: 'Quality'     },
  { label: 'Production Order – Custom Fields',                  module: 'Production'  },
  { label: 'Dispatch – Delivery Note Custom Fields',            module: 'Dispatch'    },
];

// ── Field type options ─────────────────────────────────────────────────────────
const FIELD_TYPES = [
  { value: 'text',     label: 'Text'        },
  { value: 'number',   label: 'Number'      },
  { value: 'date',     label: 'Date'        },
  { value: 'select',   label: 'Dropdown'    },
  { value: 'checkbox', label: 'Checkbox'    },
  { value: 'textarea', label: 'Textarea'    },
  { value: 'email',    label: 'Email'       },
  { value: 'file',     label: 'File Upload' },
];

// ── Module color map ────────────────────────────────────────────────────────────
const MODULE_COLOR = {
  Inventory:   'blue',
  Sales:       'green',
  Production:  'red',
  Masters:     'purple',
  Procurement: 'orange',
  Quality:     'cyan',
  Dispatch:    'geekblue',
};

// ── Row key counter ────────────────────────────────────────────────────────────
let _rk = 0;
const makeField = () => ({
  key:           ++_rk,
  name:          '',
  type:          'text',
  show_in_form:  true,
  mandatory:     false,
  show_in_table: false,
});

// ══════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT VIEW  (matches screenshot 2 layout exactly)
// ══════════════════════════════════════════════════════════════════════════════
const AddEditView = ({ group, usedEvents, onBack, onSaved, canWrite }) => {
  const isEdit = Boolean(group);

  const [event,       setEvent]       = useState(group?.event       ?? null);
  const [fieldModule, setFieldModule] = useState(group?.field_module ?? null);
  const [fieldRows,   setFieldRows]   = useState(
    group?.fields?.length
      ? group.fields.map((f) => ({ key: ++_rk, ...f }))
      : [makeField()]
  );
  const [saving, setSaving] = useState(false);

  // When event changes, auto-set module
  const handleEventChange = (val) => {
    setEvent(val);
    const found = PREDEFINED_EVENTS.find((e) => e.label === val);
    setFieldModule(found?.module ?? null);
  };

  // Field row mutators
  const setRowField = (key, field, value) =>
    setFieldRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const addRow    = () => setFieldRows((prev) => [...prev, makeField()]);
  const removeRow = (key) => { if (fieldRows.length > 1) setFieldRows((prev) => prev.filter((r) => r.key !== key)); };

  const moveUp = (idx) => {
    if (idx === 0) return;
    setFieldRows((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };
  const moveDown = (idx) => {
    setFieldRows((prev) => {
      if (idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!event) { message.warning('Please select an Action'); return; }

    const emptyName = fieldRows.some((r) => !r.name?.trim());
    if (emptyName) { message.warning('All field names are required'); return; }

    const emptyType = fieldRows.some((r) => !r.type);
    if (emptyType) { message.warning('All field types are required'); return; }

    setSaving(true);
    try {
      const payload = {
        field_module: fieldModule,
        fields: fieldRows.map(({ key, ...rest }) => ({
          ...rest,
          name: rest.name.trim(),
        })),
      };

      if (isEdit) {
        await customFieldApi.update(group.id, payload);
        message.success('Field group updated');
      } else {
        await customFieldApi.create({ event, ...payload });
        message.success(`Field group "${event}" created`);
      }
      onSaved();
    } catch (err) {
      message.error(err?.message || 'Failed to save field group');
    } finally {
      setSaving(false);
    }
  };

  // Events not yet used (exclude already-saved ones except current)
  const availableEvents = PREDEFINED_EVENTS.filter(
    (e) => !usedEvents.includes(e.label) || e.label === group?.event
  );

  return (
    <AppLayout>
      {/* Back + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ borderRadius: 8 }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters › Inventory › Custom Fields</Text>
          </div>
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
            {isEdit ? `Edit — ${group.event}` : 'Add New Field Group'}
          </Title>
        </div>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '24px 28px' }}
      >
        {/* Action (Event) selector */}
        <div style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Action <span style={{ color: '#ef4444' }}>*</span>
          </Text>
          {isEdit ? (
            /* In edit mode — show but lock the event */
            <div
              style={{
                height: 36, borderRadius: 8, background: '#f9fafb',
                border: '1px solid #e5e7eb', padding: '0 12px',
                display: 'flex', alignItems: 'center',
              }}
            >
              <Text style={{ color: '#374151', fontSize: 14 }}>{group.event}</Text>
              {fieldModule && (
                <Tag color={MODULE_COLOR[fieldModule] || 'default'} style={{ marginLeft: 10, borderRadius: 20, fontSize: 11 }}>
                  {fieldModule}
                </Tag>
              )}
            </div>
          ) : (
            <Select
              showSearch
              placeholder="Action"
              optionFilterProp="children"
              value={event}
              onChange={handleEventChange}
              style={{ width: '100%' }}
              size="large"
            >
              {availableEvents.map((e) => (
                <Option key={e.label} value={e.label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{e.label}</span>
                    <Tag color={MODULE_COLOR[e.module] || 'default'} style={{ marginLeft: 8, borderRadius: 20, fontSize: 11 }}>
                      {e.module}
                    </Tag>
                  </div>
                </Option>
              ))}
            </Select>
          )}
        </div>

        {/* ── Fields grid ─────────────────────────────────────────────────── */}
        {/* Column headers */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: '1fr 200px 100px 100px 110px 96px',
            gap:                 12,
            marginBottom:        8,
            paddingBottom:       6,
            borderBottom:        '1px solid #f0f0f0',
          }}
        >
          {[
            'Field Names',
            'Field Types',
            'Show in Form',
            'Mandatory',
            'Show in Table',
            'Actions',
          ].map((h) => (
            <Text
              key={h}
              style={{
                fontSize:      12,
                fontWeight:    600,
                color:         '#374151',
                textAlign:     ['Show in Form', 'Mandatory', 'Show in Table'].includes(h) ? 'center' : 'left',
              }}
            >
              {h}
            </Text>
          ))}
        </div>

        {/* Field rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fieldRows.map((row, idx) => (
            <div
              key={row.key}
              style={{
                display:             'grid',
                gridTemplateColumns: '1fr 200px 100px 100px 110px 96px',
                gap:                 12,
                alignItems:          'center',
              }}
            >
              {/* Field Name */}
              <Input
                placeholder={`Field name ${idx + 1}`}
                value={row.name}
                onChange={(e) => setRowField(row.key, 'name', e.target.value)}
                style={{ borderRadius: 6 }}
                disabled={!canWrite}
              />

              {/* Field Type */}
              <Select
                placeholder="Field Type"
                value={row.type || undefined}
                onChange={(v) => setRowField(row.key, 'type', v)}
                style={{ width: '100%' }}
                disabled={!canWrite}
              >
                {FIELD_TYPES.map((t) => (
                  <Option key={t.value} value={t.value}>{t.label}</Option>
                ))}
              </Select>

              {/* Show in Form */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Checkbox
                  checked={row.show_in_form}
                  onChange={(e) => setRowField(row.key, 'show_in_form', e.target.checked)}
                  disabled={!canWrite}
                />
              </div>

              {/* Mandatory */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Checkbox
                  checked={row.mandatory}
                  onChange={(e) => setRowField(row.key, 'mandatory', e.target.checked)}
                  disabled={!canWrite}
                />
              </div>

              {/* Show in Table */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Checkbox
                  checked={row.show_in_table}
                  onChange={(e) => setRowField(row.key, 'show_in_table', e.target.checked)}
                  disabled={!canWrite}
                />
              </div>

              {/* Row actions */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Tooltip title="Move up">
                  <Button
                    type="text"
                    size="small"
                    icon={<UpCircleOutlined />}
                    disabled={idx === 0 || !canWrite}
                    onClick={() => moveUp(idx)}
                    style={{ color: idx === 0 ? '#d1d5db' : '#1d4ed8', padding: 2 }}
                  />
                </Tooltip>
                <Tooltip title="Move down">
                  <Button
                    type="text"
                    size="small"
                    icon={<DownCircleOutlined />}
                    disabled={idx === fieldRows.length - 1 || !canWrite}
                    onClick={() => moveDown(idx)}
                    style={{ color: idx === fieldRows.length - 1 ? '#d1d5db' : '#1d4ed8', padding: 2 }}
                  />
                </Tooltip>
                <Tooltip title="Remove field">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={fieldRows.length === 1 || !canWrite}
                    onClick={() => removeRow(row.key)}
                    style={{ padding: 2, opacity: fieldRows.length === 1 ? 0.3 : 1 }}
                  />
                </Tooltip>
              </div>
            </div>
          ))}
        </div>

        {/* Add more fields */}
        {canWrite && (
          <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={addRow}
            style={{ padding: 0, marginTop: 12, fontWeight: 600 }}
          >
            + Add more Fields
          </Button>
        )}

        <Divider style={{ margin: '20px 0 16px' }} />

        {canWrite && (
          <Button
            type="primary"
            loading={saving}
            onClick={handleSubmit}
            style={{ borderRadius: 8, fontWeight: 600, minWidth: 100 }}
          >
            {isEdit ? 'Update' : 'Submit'}
          </Button>
        )}
      </Card>
    </AppLayout>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW  (matches Configuration theme + screenshot 1)
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({ groups, loading, search, onSearchChange, onRefresh, onNew, onEdit, onDelete, canWrite, onUploadCsv }) => {
  const columns = [
    {
      title: 'Event',
      key:   'event',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              color: '#1d4ed8', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', textDecoration: 'none',
            }}
            onClick={() => onEdit(r)}
          >
            {r.event}
          </Text>
          <Tooltip
            title={
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.event}</div>
                <div>Module: {r.field_module || '—'}</div>
                <div>Fields: {r.fields?.length ?? 0}</div>
              </div>
            }
          >
            <InfoCircleOutlined style={{ color: '#9ca3af', fontSize: 13, cursor: 'default' }} />
          </Tooltip>
        </div>
      ),
    },
    {
      title:     'field_module',
      key:       'field_module',
      width:     160,
      render: (_, r) => r.field_module
        ? (
          <Tag
            color={MODULE_COLOR[r.field_module] || 'default'}
            style={{ borderRadius: 20, fontSize: 12 }}
          >
            {r.field_module}
          </Tag>
        )
        : <Text style={{ color: '#d1d5db' }}>—</Text>,
    },
    {
      title:  'Fields',
      key:    'fields',
      render: (_, r) => {
        const names = (r.fields ?? []).map((f) => f.name).filter(Boolean);
        return names.length
          ? <Text style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{names.join(', ')}</Text>
          : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>;
      },
    },
    {
      title:  'Created At',
      key:    'created',
      width:  180,
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
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', color: '#111827' }}>
            {r.Updater?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#1d4ed8' }}>{fmtDate(r.updatedAt)}</Text>
        </div>
      ),
    },
    ...(canWrite ? [{
      title:  'Actions',
      key:    'actions',
      width:  80,
      align:  'center',
      render: (_, r) => (
        <Tooltip title="Delete field group">
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            style={{ borderRadius: 6 }}
            onClick={() => onDelete(r)}
          />
        </Tooltip>
      ),
    }] : []),
  ];

  return (
    <Card
      style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      {/* Toolbar — same structure as Configuration */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <Input
          placeholder="Search events…"
          prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 280, borderRadius: 8 }}
          allowClear
        />
        <div style={{ flex: 1 }} />
        <Button icon={<DownloadOutlined />} onClick={() => {
          const csvRows = groups.map((g) => ({
            'Event': g.event || '', 'Module': g.field_module || '',
            'Fields': (g.fields ?? []).map((f) => f.name).filter(Boolean).join(', '),
          }));
          downloadSampleCsv('custom-fields.csv', CUSTOM_FIELD_CSV_HEADERS, csvRows);
        }}>Export CSV</Button>
        {canWrite && (
          <Button icon={<UploadOutlined />} onClick={onUploadCsv} style={{ borderRadius: 8 }}>Upload CSV</Button>
        )}
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
            Add New Field Group
          </Button>
        )}
      </div>

      {/* Table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={groups}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `${t} field group${t !== 1 ? 's' : ''}`, style: { marginBottom: 0 } }}
        scroll={{ x: 900 }}
        size="middle"
        style={{ borderRadius: 8, overflow: 'hidden' }}
        locale={{
          emptyText: (
            <div style={{ padding: 40 }}>
              <FormOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
              <Text style={{ color: '#9ca3af' }}>No custom field groups configured yet</Text>
              {canWrite && (
                <>
                  <br />
                  <Button type="primary" size="small" onClick={onNew} style={{ marginTop: 10 }}>
                    Add Your First Field Group
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
// ── CSV Upload config ────────────────────���───────────────────────────────────
const CUSTOM_FIELD_CSV_HEADERS = ['Event', 'Module', 'Fields'];

const CUSTOM_FIELD_CSV_SAMPLE = [
  { 'Event': 'Sales Order – Header Custom Fields', 'Module': 'Sales', 'Fields': 'PO Reference, Delivery Priority' },
];

const CUSTOM_FIELD_VALIDATION_RULES = [
  { field: 'Event', required: true },
];

const CustomFieldsPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('inventory-custom-fields-create_edit_delete');

  const [groups,   setGroups]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [view,     setView]     = useState('list');   // 'list' | 'add' | 'edit'
  const [selected, setSelected] = useState(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Fetch
  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customFieldApi.getAll();
      setGroups(data ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load custom field groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Client-side search filter
  const filtered = search
    ? groups.filter((g) =>
        g.event?.toLowerCase().includes(search.toLowerCase()) ||
        g.field_module?.toLowerCase().includes(search.toLowerCase())
      )
    : groups;

  // Delete
  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.event}"?`,
      content: 'All custom field definitions in this group will be permanently deleted. This cannot be undone.',
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await customFieldApi.delete(record.id);
          message.success(`"${record.event}" deleted`);
          fetchGroups();
        } catch (err) {
          message.error(err?.message || 'Failed to delete field group');
        }
      },
    });
  };

  const handleSaved = () => { setView('list'); setSelected(null); fetchGroups(); };

  // ── CSV Import handler ─────────────────────��─────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0;
    let failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const fieldNames = (row['Fields'] || '').split(',').map((f) => f.trim()).filter(Boolean);
        const fields = fieldNames.map((name) => ({
          name,
          type: 'text',
          show_in_form: true,
          mandatory: false,
          show_in_table: false,
        }));
        await customFieldApi.create({
          event:        row['Event'] || '',
          field_module: row['Module'] || null,
          fields,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Event']}": ${err?.message || 'Failed'}`);
      }
    }
    fetchGroups();
    return { success, failed, errors };
  };

  // Events already taken (to exclude from "add" dropdown)
  const usedEvents = groups.map((g) => g.event);

  // ── Add / Edit views ──────────────────────────────────────────────────────
  if (view === 'add') {
    return (
      <AddEditView
        group={null}
        usedEvents={usedEvents}
        onBack={() => setView('list')}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }
  if (view === 'edit' && selected) {
    return (
      <AddEditView
        group={selected}
        usedEvents={usedEvents}
        onBack={() => { setView('list'); setSelected(null); }}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalFields = groups.reduce((sum, g) => sum + (g.fields?.length ?? 0), 0);
  const moduleCount = new Set(groups.map((g) => g.field_module).filter(Boolean)).size;

  return (
    <AppLayout>
      {/* Page heading — same as Configuration */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Inventory</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Custom Fields</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Custom Fields
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Define custom fields per system event — control visibility, type and validation
        </Text>
      </div>

      {/* Stats chips — same pattern as Configuration */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Field Groups', value: groups.length, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Total Fields', value: totalFields,   color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Modules',      value: moduleCount,   color: '#b45309', bg: '#fef3c7' },
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

      <ListView
        groups={filtered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onRefresh={fetchGroups}
        onNew={() => setView('add')}
        onEdit={(r) => { setSelected(r); setView('edit'); }}
        onDelete={handleDelete}
        canWrite={canWrite}
        onUploadCsv={() => setCsvModalOpen(true)}
      />

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Custom Fields"
        entityName="Field Group"
        sampleHeaders={CUSTOM_FIELD_CSV_HEADERS}
        sampleRows={CUSTOM_FIELD_CSV_SAMPLE}
        validationRules={CUSTOM_FIELD_VALIDATION_RULES}
      />
    </AppLayout>
  );
};

export default CustomFieldsPage;
