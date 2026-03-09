import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Table, Button, Form, Input, InputNumber, Select, Card, Modal,
  message, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, ArrowLeftOutlined,
  SearchOutlined, RightOutlined, EyeOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { toolApi } from '../../../api/tool.api';
import { tagApi }  from '../../../api/tag.api';
import AppLayout   from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

/** Lightweight unique key helper for inline-table rows */
const uid = () => Math.random().toString(36).slice(2, 9);

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({
  tools, loading, search, onSearchChange, onRefresh,
  onNew, onDetail, onDelete, canWrite,
}) => {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
          onClick={() => onDetail(r)}
        >
          {name}
        </Text>
      ),
    },
    {
      title: 'Multiplier',
      dataIndex: 'multiplier',
      key: 'multiplier',
      width: 120,
      render: (val) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>
          {val != null ? val : '—'}
        </Text>
      ),
    },
    {
      title: 'Lifetime',
      key: 'lifetime',
      width: 160,
      render: (_, r) => {
        const entries = r.lifetime_entries || [];
        const first   = entries[0];
        return (
          <Text style={{ fontSize: 12, color: '#374151' }}>
            {first?.lifetime_strokes != null
              ? `${Number(first.lifetime_strokes).toLocaleString()} strokes`
              : '—'}
          </Text>
        );
      },
    },
    {
      title: 'Maintenance Cycle',
      key: 'maintenance_cycle',
      width: 180,
      render: (_, r) => {
        const entries = r.lifetime_entries || [];
        const first   = entries[0];
        return (
          <Text style={{ fontSize: 12, color: '#374151' }}>
            {first?.maintenance_cycle_strokes != null
              ? `${Number(first.maintenance_cycle_strokes).toLocaleString()} strokes`
              : '—'}
          </Text>
        );
      },
    },
    {
      title: 'Created At',
      key: 'createdAt',
      width: 160,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, color: '#374151', display: 'block' }}>{r.Creator?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDateTime(r.createdAt)}</Text>
        </div>
      ),
    },
    {
      title: 'Last Updated At',
      key: 'updatedAt',
      width: 160,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, color: '#111827', fontWeight: 500, display: 'block' }}>{r.Updater?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDateTime(r.updatedAt)}</Text>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, r) =>
        canWrite ? (
          <Tooltip title="Delete">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(r)} />
          </Tooltip>
        ) : (
          <Tooltip title="View">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => onDetail(r)} />
          </Tooltip>
        ),
    },
  ];

  return (
    <>
      {/* ── Breadcrumb + Title ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Tools</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Tools</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage production tools, linked rules and maintenance schedules
        </Text>
      </div>

      {/* ── Card + Toolbar + Table ──────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search tools…"
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
              + NEW
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={tools}
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (t) => `${t} tools`,
            style: { marginBottom: 0 },
          }}
          scroll={{ x: 1100 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <ExclamationCircleOutlined style={{ fontSize: 32, color: '#d1d5db', marginBottom: 8 }} />
                <div style={{ color: '#9ca3af', fontSize: 13 }}>No tools found</div>
              </div>
            ),
          }}
        />
      </Card>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT / VIEW FORM
// ══════════════════════════════════════════════════════════════════════════════
const FormView = ({ tool, onBack, onSaved, canWrite }) => {
  const [form]            = Form.useForm();
  const [saving, setSaving]             = useState(false);
  const [allTags, setAllTags]           = useState([]);
  const [linkedRules, setLinkedRules]   = useState([]);
  const [lifetimeEntries, setLifetime]  = useState([]);

  const isEdit     = !!tool;
  const isReadOnly = !canWrite;

  // ── Load tags for Machine Group / Item selects ───────────────────────────
  useEffect(() => {
    tagApi.getAll()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setAllTags(list);
      })
      .catch(() => {});
  }, []);

  // ── Pre-fill for edit ────────────────────────────────────────────────────
  useEffect(() => {
    if (tool) {
      form.setFieldsValue({
        name:       tool.name,
        multiplier: tool.multiplier != null ? Number(tool.multiplier) : null,
      });
      setLinkedRules((tool.linked_rules || []).map((r) => ({ ...r, _key: uid() })));
      setLifetime((tool.lifetime_entries || []).map((e) => ({ ...e, _key: uid() })));
    } else {
      form.resetFields();
      setLinkedRules([]);
      setLifetime([]);
    }
  }, [tool, form]);

  // ── Linked Rules helpers ─────────────────────────────────────────────────
  const addLinkedRule = () =>
    setLinkedRules((prev) => [
      ...prev,
      { _key: uid(), machine_group_tag: null, item_tag: null, process: '', seconds_per_unit: null },
    ]);

  const updRule = (key, field, value) =>
    setLinkedRules((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));

  const delRule = (key) => setLinkedRules((prev) => prev.filter((r) => r._key !== key));

  // ── Lifetime Entry helpers ───────────────────────────────────────────────
  const addLifetimeEntry = () =>
    setLifetime((prev) => [
      ...prev,
      { _key: uid(), tool_details: '', lifetime_strokes: null, maintenance_cycle_strokes: null },
    ]);

  const updEntry = (key, field, value) =>
    setLifetime((prev) => prev.map((e) => (e._key === key ? { ...e, [field]: value } : e)));

  const delEntry = (key) => setLifetime((prev) => prev.filter((e) => e._key !== key));

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const cleanRules   = linkedRules.map(({ _key, ...r }) => r);
      const cleanEntries = lifetimeEntries.map(({ _key, ...e }) => e);

      const payload = {
        name:             values.name,
        multiplier:       values.multiplier != null ? values.multiplier : null,
        linked_rules:     cleanRules,
        lifetime_entries: cleanEntries,
      };

      if (isEdit) {
        await toolApi.update(tool.id, payload);
        message.success('Tool updated');
      } else {
        await toolApi.create(payload);
        message.success('Tool created');
      }
      onSaved();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const tagOptions = allTags.map((t) => ({ label: t.name, value: t.name }));

  // ── Linked Rules columns ─────────────────────────────────────────────────
  const linkedRuleColumns = [
    {
      title: 'Machine Group',
      key:   'machine_group_tag',
      width: 160,
      render: (_, row) => (
        <Select
          value={row.machine_group_tag || undefined}
          onChange={(v) => updRule(row._key, 'machine_group_tag', v)}
          options={tagOptions}
          placeholder="Select"
          showSearch
          size="small"
          style={{ width: '100%' }}
          disabled={isReadOnly}
          filterOption={(inp, opt) => (opt?.label || '').toLowerCase().includes(inp.toLowerCase())}
        />
      ),
    },
    {
      title: 'Item',
      key:   'item_tag',
      width: 150,
      render: (_, row) => (
        <Select
          value={row.item_tag || undefined}
          onChange={(v) => updRule(row._key, 'item_tag', v)}
          options={tagOptions}
          placeholder="Select"
          showSearch
          size="small"
          style={{ width: '100%' }}
          disabled={isReadOnly}
          filterOption={(inp, opt) => (opt?.label || '').toLowerCase().includes(inp.toLowerCase())}
        />
      ),
    },
    {
      title: 'Process',
      key:   'process',
      width: 130,
      render: (_, row) => (
        <Input
          value={row.process}
          onChange={(e) => updRule(row._key, 'process', e.target.value)}
          size="small"
          disabled={isReadOnly}
        />
      ),
    },
    {
      title: 'Seconds',
      key:   'seconds_per_unit',
      width: 90,
      render: (_, row) => (
        <InputNumber
          value={row.seconds_per_unit}
          onChange={(v) => updRule(row._key, 'seconds_per_unit', v)}
          min={0}
          size="small"
          style={{ width: '100%' }}
          disabled={isReadOnly}
        />
      ),
    },
    {
      title: '',
      key:   'del',
      width: 36,
      render: (_, row) =>
        !isReadOnly && (
          <Button
            type="text" size="small" danger
            icon={<DeleteOutlined />}
            onClick={() => delRule(row._key)}
          />
        ),
    },
  ];

  // ── Lifetime columns ─────────────────────────────────────────────────────
  const lifetimeColumns = [
    {
      title: 'Tool Details',
      key:   'tool_details',
      width: 160,
      render: (_, row) => (
        <Input
          value={row.tool_details}
          onChange={(e) => updEntry(row._key, 'tool_details', e.target.value)}
          size="small"
          disabled={isReadOnly}
        />
      ),
    },
    {
      title: (
        <span>
          Lifetime (Number of strokes){' '}
          <Tooltip title="Number of production strokes before this tool needs replacement">
            <InfoCircleOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
          </Tooltip>
        </span>
      ),
      key: 'lifetime_strokes',
      width: 210,
      render: (_, row) => (
        <InputNumber
          value={row.lifetime_strokes}
          onChange={(v) => updEntry(row._key, 'lifetime_strokes', v)}
          min={0}
          size="small"
          style={{ width: '100%' }}
          disabled={isReadOnly}
        />
      ),
    },
    {
      title: (
        <span>
          Maintenance Cycle (Number of strokes){' '}
          <Tooltip title="Number of production strokes before scheduled maintenance">
            <InfoCircleOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
          </Tooltip>
        </span>
      ),
      key: 'maintenance_cycle_strokes',
      width: 250,
      render: (_, row) => (
        <InputNumber
          value={row.maintenance_cycle_strokes}
          onChange={(v) => updEntry(row._key, 'maintenance_cycle_strokes', v)}
          min={0}
          size="small"
          style={{ width: '100%' }}
          disabled={isReadOnly}
        />
      ),
    },
    {
      title: '',
      key:   'del',
      width: 36,
      render: (_, row) =>
        !isReadOnly && (
          <Button
            type="text" size="small" danger
            icon={<DeleteOutlined />}
            onClick={() => delEntry(row._key)}
          />
        ),
    },
  ];

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined style={{ fontSize: 16, color: '#374151' }} />}
          onClick={onBack}
          style={{ padding: '4px 6px', borderRadius: 6 }}
        />
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          {isEdit ? tool.name : 'Add Tool'}
        </Title>
        {isEdit && <ClockCircleOutlined style={{ fontSize: 18, color: '#9ca3af', marginLeft: 4 }} />}
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* LEFT PANEL */}
        <div style={{ flex: '0 0 56%', minWidth: 0 }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isReadOnly}>

            {/* Name */}
            <Form.Item
              label={<Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Name</Text>}
              name="name"
              rules={[{ required: true, message: 'Name is required' }]}
              style={{ marginBottom: 16 }}
            >
              <Input style={{ borderRadius: 6, fontSize: 13 }} />
            </Form.Item>

            {/* Multiplier */}
            <Form.Item
              label={
                <span>
                  <Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Multiplier</Text>{' '}
                  <Tooltip title="Multiplier used in production calculations">
                    <InfoCircleOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
                  </Tooltip>
                </span>
              }
              name="multiplier"
              style={{ marginBottom: 20 }}
            >
              <InputNumber
                min={0}
                step={0.01}
                style={{ width: '100%', borderRadius: 6 }}
              />
            </Form.Item>

            {/* Linked Rules */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Linked Rules</Text>
                {!isReadOnly && (
                  <Button
                    type="link"
                    size="small"
                    onClick={addLinkedRule}
                    style={{ color: '#1d4ed8', fontWeight: 500, padding: 0 }}
                  >
                    + Rules
                  </Button>
                )}
              </div>
              <Table
                rowKey="_key"
                columns={linkedRuleColumns}
                dataSource={linkedRules}
                pagination={false}
                size="small"
                style={{ border: '1px solid #e8eaed', borderRadius: 8, overflow: 'hidden' }}
                locale={{
                  emptyText: (
                    <div style={{ padding: '24px 0', color: '#9ca3af', textAlign: 'center', fontSize: 12 }}>
                      No data
                    </div>
                  ),
                }}
              />
            </div>

            {/* Audit info for edit */}
            {isEdit && (
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 20,
                  border: '1px solid #f0f0f0',
                }}
              >
                <div style={{ display: 'flex', gap: 32 }}>
                  <div>
                    <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block' }}>Created By</Text>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{tool.Creator?.name || '—'}</Text>
                    <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>{fmtDateTime(tool.createdAt)}</Text>
                  </div>
                  <div>
                    <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block' }}>Last Updated By</Text>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{tool.Updater?.name || '—'}</Text>
                    <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>{fmtDateTime(tool.updatedAt)}</Text>
                  </div>
                </div>
              </div>
            )}

            {/* Submit / Edit button */}
            {!isReadOnly && (
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                style={{ borderRadius: 6, fontWeight: 600, background: '#1d4ed8', minWidth: 80 }}
              >
                {isEdit ? 'Edit' : 'Submit'}
              </Button>
            )}
          </Form>
        </div>

        {/* RIGHT PANEL — Lifetime & Maintenance cycle */}
        <div style={{ flex: '1 1 44%', minWidth: 0 }}>
          <div
            style={{
              border: '1px solid #e8eaed',
              borderRadius: 12,
              padding: '16px',
              background: '#ffffff',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Lifetime &amp; Maintenance cycle
              </Text>
              {!isReadOnly && (
                <Button
                  type="link"
                  size="small"
                  onClick={addLifetimeEntry}
                  style={{ color: '#1d4ed8', fontWeight: 500, padding: 0 }}
                >
                  + Add
                </Button>
              )}
            </div>

            <Table
              rowKey="_key"
              columns={lifetimeColumns}
              dataSource={lifetimeEntries}
              pagination={false}
              size="small"
              style={{ borderRadius: 8, overflow: 'hidden' }}
              locale={{
                emptyText: (
                  <div style={{ padding: '24px 0', color: '#9ca3af', textAlign: 'center', fontSize: 12 }}>
                    No data
                  </div>
                ),
              }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE CONTAINER
// ══════════════════════════════════════════════════════════════════════════════
const ToolsPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('production-tools-create_edit_delete');

  const [view, setView]               = useState('list');
  const [tools, setTools]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState('');
  const [selectedTool, setSelectedTool] = useState(null);

  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const data = await toolApi.getAll();
      setTools(Array.isArray(data) ? data : data?.data || []);
    } catch {
      message.error('Failed to load tools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tools;
    const q = search.toLowerCase();
    return tools.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q)
    );
  }, [tools, search]);

  const handleNew    = () => { setSelectedTool(null); setView('add'); };
  const handleDetail = (r) => { setSelectedTool(r);   setView('detail'); };
  const handleBack   = () => { setSelectedTool(null); setView('list'); };
  const handleSaved  = () => { handleBack(); fetchTools(); };

  const handleDelete = (tool) => {
    Modal.confirm({
      title:      'Delete Tool',
      content:    `Are you sure you want to delete "${tool.name}"?`,
      okText:     'Delete',
      okType:     'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await toolApi.delete(tool.id);
          message.success('Tool deleted');
          fetchTools();
        } catch {
          message.error('Failed to delete tool');
        }
      },
    });
  };

  const renderContent = () => {
    if (view === 'add' || view === 'detail') {
      return (
        <FormView
          tool={view === 'detail' ? selectedTool : null}
          onBack={handleBack}
          onSaved={handleSaved}
          canWrite={canWrite}
        />
      );
    }
    return (
      <ListView
        tools={filtered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onRefresh={fetchTools}
        onNew={handleNew}
        onDetail={handleDetail}
        onDelete={handleDelete}
        canWrite={canWrite}
      />
    );
  };

  return <AppLayout>{renderContent()}</AppLayout>;
};

export default ToolsPage;
