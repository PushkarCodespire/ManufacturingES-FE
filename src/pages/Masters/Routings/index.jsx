import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import {
  Typography, Card, Table, Button, Input, Tag, Space, Tooltip,
  Drawer, Form, Select, message, Popconfirm, InputNumber, Switch, DatePicker,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  SearchOutlined, RightOutlined, PauseCircleOutlined, PlayCircleOutlined,
  DownloadOutlined, UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { routingApi } from '../../../api/routing.api';
import { workCenterApi } from '../../../api/workCenter.api';
import api from '../../../api/axios';
import CsvUploadModal from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const STATUS_COLORS = { draft: 'orange', active: 'green', obsolete: 'default' };
const STATUS_LABELS = { draft: 'Draft', active: 'Active', obsolete: 'Obsolete' };

// ── CSV Upload config ────────────────────────────────────────────────────────
const ROUTING_CSV_HEADERS = ['Name', 'Code', 'Item Name', 'Version', 'Status', 'Effective Date', 'Notes'];

const ROUTING_CSV_SAMPLE = [
  {
    'Name': 'Standard Machining Routing',
    'Code': '',
    'Item Name': 'CNC Shaft Assembly',
    'Version': '1.0',
    'Status': 'draft',
    'Effective Date': '2026-04-01',
    'Notes': 'Default routing for shaft assemblies',
  },
  {
    'Name': 'Assembly Line Routing',
    'Code': '',
    'Item Name': '',
    'Version': '1.0',
    'Status': 'active',
    'Effective Date': '',
    'Notes': '',
  },
];

const ROUTING_CSV_VALIDATION = [
  { field: 'Name', required: true },
  {
    field: 'Status',
    validate: (v) => {
      if (v && !['draft', 'active', 'obsolete'].includes(v.toLowerCase())) {
        return '"Status" must be draft, active, or obsolete';
      }
      return null;
    },
  },
];

export default function RoutingsPage() {
  const { can } = usePermissions();
  const canWrite = can('production-routings-create_edit_delete');

  const [data,         setData]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Lookup data
  const [items,        setItems]        = useState([]);
  const [workCenters,  setWorkCenters]  = useState([]);
  const [machines,     setMachines]     = useState([]);

  // Steps state (managed outside form)
  const [steps,        setSteps]        = useState([]);

  const [form] = Form.useForm();

  // ── Fetch routings ───────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const res = await routingApi.getAll(params);
      setData(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) {
      message.error(err?.message || 'Failed to load routings');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Load lookup data on mount ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/items', { params: { limit: 500 } }).catch(() => []),
      workCenterApi.getAll({ limit: 500 }).catch(() => []),
      api.get('/machines', { params: { limit: 500 } }).catch(() => []),
    ]).then(([i, wc, m]) => {
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setWorkCenters(Array.isArray(wc) ? wc : (wc?.data ?? []));
      setMachines(Array.isArray(m) ? m : (m?.data ?? []));
    });
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total    = data.length;
  const active   = data.filter((r) => r.status === 'active').length;
  const draft    = data.filter((r) => r.status === 'draft').length;

  // ── Step management ───────────────────────────────────────────────────────
  const addStep = () => setSteps((s) => [...s, {
    step_no: (s.length + 1) * 10,
    operation_name: '',
    work_center_id: null,
    machine_id: null,
    setup_time_min: 0,
    cycle_time_min: 0,
    labor_type: 'machine',
    quality_check: false,
  }]);

  const removeStep = (idx) => setSteps((s) => s.filter((_, i) => i !== idx));

  const updateStep = (idx, field, value) =>
    setSteps((s) => s.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: 'draft', version: '1.0' });
    setSteps([]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      item_id:        record.item_id,
      name:           record.name,
      version:        record.version,
      status:         record.status,
      effective_date: record.effective_date ? dayjs(record.effective_date) : null,
      notes:          record.notes,
    });
    setSteps(record.RoutingSteps || []);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      if (steps.length === 0) {
        message.error('Please add at least one operation step');
        return;
      }
      const invalid = steps.find((s) => !s.operation_name || !s.work_center_id);
      if (invalid) {
        message.error('Each step must have an operation name and a work center');
        return;
      }
      setSaving(true);
      const payload = {
        ...vals,
        effective_date: vals.effective_date?.format('YYYY-MM-DD') || null,
        steps,
      };
      if (editing) {
        await routingApi.update(editing.id, payload);
        message.success('Routing updated');
      } else {
        await routingApi.create(payload);
        message.success('Routing created');
      }
      setDrawerOpen(false);
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await routingApi.remove(id);
      message.success('Routing deleted');
      fetchData();
    } catch (err) {
      message.error(err?.message || 'Delete failed');
    }
  };

  const handleStatusToggle = async (record) => {
    const newStatus = record.status === 'active' ? 'draft' : 'active';
    try {
      await routingApi.updateStatus(record.id, newStatus);
      message.success(`Status set to ${STATUS_LABELS[newStatus]}`);
      fetchData();
    } catch (err) {
      message.error(err?.message || 'Status update failed');
    }
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    // Build item name→id lookup
    const itemNameToId = {};
    items.forEach((i) => { itemNameToId[i.name?.toLowerCase()] = i.id; });

    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const itemName = row['Item Name']?.trim();
        const itemId = itemName ? itemNameToId[itemName.toLowerCase()] : undefined;
        await routingApi.create({
          name: row['Name']?.trim(),
          code: row['Code']?.trim() || undefined,
          item_id: itemId || undefined,
          version: row['Version']?.trim() || '1.0',
          status: row['Status']?.trim()?.toLowerCase() || 'draft',
          effective_date: row['Effective Date']?.trim() || undefined,
          notes: row['Notes']?.trim() || undefined,
          steps: [],
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row ${row._rowNum}: ${err.message}`);
      }
    }
    fetchData();
    return { success, failed, errors };
  };

  // ── Steps mini-table columns ──────────────────────────────────────────────
  const stepColumns = [
    {
      title: 'Step',
      dataIndex: 'step_no',
      width: 65,
      render: (v, _, idx) => (
        <InputNumber
          size="small"
          value={v}
          onChange={(val) => updateStep(idx, 'step_no', val)}
          style={{ width: 55 }}
        />
      ),
    },
    {
      title: 'Operation',
      dataIndex: 'operation_name',
      render: (v, _, idx) => (
        <Input
          size="small"
          value={v}
          onChange={(e) => updateStep(idx, 'operation_name', e.target.value)}
          placeholder="Operation name"
          style={{ width: 140 }}
        />
      ),
    },
    {
      title: 'Work Center',
      dataIndex: 'work_center_id',
      width: 145,
      render: (v, _, idx) => (
        <Select
          size="small"
          value={v}
          onChange={(val) => updateStep(idx, 'work_center_id', val)}
          options={workCenters.map((wc) => ({ value: wc.id, label: wc.name }))}
          style={{ width: 130 }}
          placeholder="Select WC"
        />
      ),
    },
    {
      title: 'Machine',
      dataIndex: 'machine_id',
      width: 135,
      render: (v, _, idx) => (
        <Select
          size="small"
          allowClear
          value={v}
          onChange={(val) => updateStep(idx, 'machine_id', val)}
          options={machines.map((m) => ({ value: m.id, label: m.name }))}
          style={{ width: 120 }}
          placeholder="Optional"
        />
      ),
    },
    {
      title: 'Setup(min)',
      dataIndex: 'setup_time_min',
      width: 85,
      render: (v, _, idx) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          onChange={(val) => updateStep(idx, 'setup_time_min', val)}
          style={{ width: 70 }}
        />
      ),
    },
    {
      title: 'Cycle(min)',
      dataIndex: 'cycle_time_min',
      width: 85,
      render: (v, _, idx) => (
        <InputNumber
          size="small"
          value={v}
          min={0}
          onChange={(val) => updateStep(idx, 'cycle_time_min', val)}
          style={{ width: 70 }}
        />
      ),
    },
    {
      title: 'QC',
      dataIndex: 'quality_check',
      width: 50,
      render: (v, _, idx) => (
        <Switch
          size="small"
          checked={v}
          onChange={(val) => updateStep(idx, 'quality_check', val)}
        />
      ),
    },
    {
      title: '',
      key: 'del',
      width: 40,
      render: (_, __, idx) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeStep(idx)}
        />
      ),
    },
  ];

  // ── Main table columns ────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 130,
      render: (v) => (
        <Text style={{ fontWeight: 600, fontFamily: 'monospace', color: '#1d4ed8' }}>{v}</Text>
      ),
    },
    {
      title: 'Item', key: 'item', width: 200,
      render: (_, r) => r.Item ? (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Item.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Item.code}</Text>
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name', width: 180,
    },
    {
      title: 'Version', dataIndex: 'version', key: 'version', width: 90,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v) => <Tag color={STATUS_COLORS[v] || 'default'}>{STATUS_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Steps', key: 'steps', width: 80,
      render: (_, r) => (
        <Tag>{r.RoutingSteps?.length || 0} steps</Tag>
      ),
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 140,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          {r.status !== 'obsolete' && (
            <Tooltip title={r.status === 'active' ? 'Deactivate' : 'Activate'}>
              <Button
                type="text"
                size="small"
                icon={
                  r.status === 'active'
                    ? <PauseCircleOutlined style={{ color: '#d97706' }} />
                    : <PlayCircleOutlined style={{ color: '#16a34a' }} />
                }
                onClick={() => handleStatusToggle(r)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Delete this routing?"
            onConfirm={() => handleDelete(r.id)}
            okText="Delete"
            okType="danger"
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Routings</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Part Routings</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Define multi-step operation sequences for items. Attach a routing to a Work Order to auto-generate Job Cards.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
        <Tag color="orange">Draft: {draft}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search routings..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => downloadSampleCsv('routings.csv', ROUTING_CSV_HEADERS, data.map((r) => ({ 'Name': r.name, 'Code': r.code || '', 'Item Name': r.Item?.name || '', 'Version': r.version || '', 'Status': r.status || '', 'Effective Date': r.effective_date || '', 'Notes': r.notes || '' })))}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>}
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              New Routing
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* Create / Edit Drawer */}
      <Drawer
        title={editing ? `Edit Routing — ${editing.code}` : 'New Routing'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={handleSave}>
                {editing ? 'Update' : 'Create Routing'}
              </Button>
            )}
          </div>
        }
      >
        {/* ── Section 1: Routing Header ──────────────────────────────────── */}
        <Form form={form} layout="vertical">
          <Form.Item
            name="item_id"
            label="Item"
            rules={[{ required: true, message: 'Select an item' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Search item..."
              options={items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }))}
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="Routing Name"
            rules={[{ required: true, message: 'Enter a routing name' }]}
          >
            <Input placeholder="e.g. Standard Machining Routing" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="version" label="Version">
              <Input placeholder="1.0" />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select
                options={[
                  { value: 'draft',    label: 'Draft'    },
                  { value: 'active',   label: 'Active'   },
                  { value: 'obsolete', label: 'Obsolete' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item name="effective_date" label="Effective Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes..." />
          </Form.Item>
        </Form>

        {/* ── Section 2: Operation Steps ─────────────────────────────────── */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text strong style={{ fontSize: 14 }}>Operation Steps</Text>
            {canWrite && (
              <Button size="small" icon={<PlusOutlined />} onClick={addStep}>
                Add Step
              </Button>
            )}
          </div>

          {steps.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '24px 0',
              color: '#9ca3af', fontSize: 13,
              border: '1px dashed #e8eaed', borderRadius: 8,
            }}>
              No steps added yet. Click "+ Add Step" to begin.
            </div>
          ) : (
            <Table
              rowKey={(_, idx) => idx}
              dataSource={steps}
              columns={stepColumns}
              size="small"
              pagination={false}
              scroll={{ x: 740 }}
              style={{ marginTop: 4 }}
            />
          )}
        </div>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Routings"
        entityName="Routing"
        sampleHeaders={ROUTING_CSV_HEADERS}
        sampleRows={ROUTING_CSV_SAMPLE}
        validationRules={ROUTING_CSV_VALIDATION}
      />
    </AppLayout>
  );
}
