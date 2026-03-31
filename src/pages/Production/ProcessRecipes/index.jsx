import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Table, Tag, Space, Select, message, Tabs,
  Drawer, Form, InputNumber, Input, Switch, Popconfirm, Tooltip, Row, Col,
  Divider, DatePicker,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, RightOutlined, DeleteOutlined,
  ExperimentOutlined, WarningOutlined, EditOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { processRecipeApi } from '../../../api/production.api';
import { itemApi } from '../../../api/item.api';
import { machineApi } from '../../../api/machine.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_CONFIG = {
  ok:       { color: 'green',  label: 'OK' },
  warning:  { color: 'orange', label: 'Warning' },
  critical: { color: 'red',    label: 'Critical' },
};

// ── Recipe Management Tab ────────────────────────────────────────────────────
function RecipeTab() {
  const { can } = usePermissions();
  const canWrite = can('prod-process_recipes-process_recipes-create_edit_delete');

  const [recipes, setRecipes]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [items, setItems]           = useState([]);
  const [machines, setMachines]     = useState([]);
  const [filterItem, setFilterItem]     = useState(null);
  const [filterMachine, setFilterMachine] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form]                      = Form.useForm();
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterItem) params.item_id = filterItem;
      if (filterMachine) params.machine_id = filterMachine;
      const res = await processRecipeApi.getAll(params);
      setRecipes(res?.data ?? []);
    } catch { message.error('Failed to load recipes'); }
    finally { setLoading(false); }
  }, [filterItem, filterMachine]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    itemApi.getAll({ limit: 500 }).then((r) => setItems(r?.data ?? (Array.isArray(r) ? r : []))).catch(() => {});
    machineApi.getAll().then((r) => setMachines(r?.data ?? (Array.isArray(r) ? r : []))).catch(() => {});
  }, []);

  const openAdd = () => { setEditing(null); form.resetFields(); setDrawerOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      item_id: r.item_id, machine_id: r.machine_id, parameter_name: r.Parameter?.name,
      target_value: r.target_value ? parseFloat(r.target_value) : null,
      min_value: r.min_value ? parseFloat(r.min_value) : null,
      max_value: r.max_value ? parseFloat(r.max_value) : null,
      unit: r.unit, is_critical: r.is_critical,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      if (editing) {
        await processRecipeApi.update(editing.id, {
          target_value: vals.target_value, min_value: vals.min_value,
          max_value: vals.max_value, unit: vals.unit, is_critical: vals.is_critical,
        });
        message.success('Recipe updated');
      } else {
        await processRecipeApi.create({
          item_id: vals.item_id, machine_id: vals.machine_id,
          parameter_id: vals.parameter_id,
          target_value: vals.target_value, min_value: vals.min_value,
          max_value: vals.max_value, unit: vals.unit, is_critical: vals.is_critical,
        });
        message.success('Recipe created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await processRecipeApi.remove(id);
      message.success('Recipe deleted');
      load();
    } catch { message.error('Delete failed'); }
  };

  // Fetch production parameters for the dropdown
  const [params, setParams] = useState([]);
  useEffect(() => {
    import('../../../api/productionParameter.api').then((mod) => {
      mod.productionParameterApi.getAll().then((r) => setParams(r?.data ?? (Array.isArray(r) ? r : [])));
    }).catch(() => {});
  }, []);

  const columns = [
    {
      title: 'Item', key: 'item', width: 160,
      render: (_, r) => <div><Text strong>{r.Item?.code}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.Item?.name}</Text></div>,
    },
    {
      title: 'Machine', key: 'machine', width: 140,
      render: (_, r) => <div><Text strong>{r.Machine?.code}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.Machine?.name}</Text></div>,
    },
    { title: 'Parameter', key: 'param', width: 140, render: (_, r) => r.Parameter?.name || '-' },
    { title: 'Target', dataIndex: 'target_value', width: 90, align: 'right', render: (v) => v != null ? parseFloat(v) : '-' },
    { title: 'Min', dataIndex: 'min_value', width: 80, align: 'right', render: (v) => v != null ? parseFloat(v) : '-' },
    { title: 'Max', dataIndex: 'max_value', width: 80, align: 'right', render: (v) => v != null ? parseFloat(v) : '-' },
    { title: 'Unit', dataIndex: 'unit', width: 60 },
    {
      title: 'Critical', dataIndex: 'is_critical', width: 70, align: 'center',
      render: (v) => v ? <Tag color="red">Yes</Tag> : <Tag>No</Tag>,
    },
    ...(canWrite ? [{
      title: '', key: 'actions', width: 80,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="Delete?" onConfirm={() => onDelete(r.id)} okType="danger">
            <Tooltip title="Delete"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <>
      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Select showSearch optionFilterProp="label" placeholder="Filter by Item" value={filterItem} onChange={setFilterItem}
            options={items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }))} style={{ width: 220 }} allowClear />
          <Select showSearch optionFilterProp="label" placeholder="Filter by Machine" value={filterMachine} onChange={setFilterMachine}
            options={machines.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))} style={{ width: 220 }} allowClear />
          <div style={{ flex: 1 }} />
          <Tag color="blue">Total: {recipes.length}</Tag>
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('process-recipes.csv', recipes, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Recipe</Button>}
        </div>
        <Table rowKey="id" dataSource={recipes} columns={columns} size="small" loading={loading}
          pagination={{ pageSize: 20 }} scroll={{ x: 900 }} />
      </Card>

      <Drawer title={editing ? 'Edit Recipe' : 'Add Process Recipe'} open={drawerOpen} onClose={() => setDrawerOpen(false)}
        width={420} footer={
          <Space><Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={onSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button></Space>
        }>
        <Form form={form} layout="vertical">
          {!editing && (
            <>
              <Form.Item name="item_id" label="Item" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" placeholder="Select item..."
                  options={items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }))} />
              </Form.Item>
              <Form.Item name="machine_id" label="Machine" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" placeholder="Select machine..."
                  options={machines.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
              </Form.Item>
              <Form.Item name="parameter_id" label="Parameter" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" placeholder="Select parameter..."
                  options={params.map((p) => ({ value: p.id, label: p.name }))} />
              </Form.Item>
            </>
          )}
          <Row gutter={12}>
            <Col span={8}><Form.Item name="target_value" label="Target"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item></Col>
            <Col span={8}><Form.Item name="min_value" label="Min"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item></Col>
            <Col span={8}><Form.Item name="max_value" label="Max"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item></Col>
          </Row>
          <Form.Item name="unit" label="Unit"><Input placeholder="e.g. °C, bar, mm" /></Form.Item>
          <Form.Item name="is_critical" label="Critical Parameter" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Drawer>
    </>
  );
}

// ── Deviations Tab ───────────────────────────────────────────────────────────
function DeviationsTab() {
  const [deviations, setDeviations] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [dateRange, setDateRange]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange?.[0]) params.from = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.to = dateRange[1].format('YYYY-MM-DD');
      const res = await processRecipeApi.getDeviations(params);
      setDeviations(res?.data ?? []);
    } catch { message.error('Failed to load deviations'); }
    finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      title: 'Date', key: 'date', width: 140,
      render: (_, r) => r.recorded_at ? dayjs(r.recorded_at).format('DD MMM YYYY HH:mm') : '-',
    },
    { title: 'Job Card', key: 'jc', width: 120, render: (_, r) => r.JobCard?.job_no || '-' },
    { title: 'WO', key: 'wo', width: 120, render: (_, r) => r.JobCard?.WorkOrder?.wo_no || '-' },
    { title: 'Item', key: 'item', width: 140, render: (_, r) => r.Recipe?.Item?.code || '-' },
    { title: 'Machine', key: 'machine', width: 120, render: (_, r) => r.Recipe?.Machine?.code || '-' },
    { title: 'Parameter', key: 'param', width: 130, render: (_, r) => r.Recipe?.Parameter?.name || '-' },
    {
      title: 'Target', key: 'target', width: 80, align: 'right',
      render: (_, r) => r.Recipe?.target_value != null ? parseFloat(r.Recipe.target_value) : '-',
    },
    {
      title: 'Actual', dataIndex: 'actual_value', width: 80, align: 'right',
      render: (v) => <Text strong>{parseFloat(v)}</Text>,
    },
    {
      title: 'Deviation', dataIndex: 'deviation', width: 90, align: 'right',
      render: (v) => {
        const d = parseFloat(v);
        return <Text style={{ color: d > 0 ? '#dc2626' : '#d97706', fontWeight: 600 }}>{d > 0 ? '+' : ''}{d}</Text>;
      },
    },
    {
      title: 'Status', dataIndex: 'status', width: 90,
      render: (v) => {
        const cfg = STATUS_CONFIG[v] || STATUS_CONFIG.ok;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    { title: 'Recorded By', key: 'by', width: 120, render: (_, r) => r.Recorder?.name || '-' },
  ];

  return (
    <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      bodyStyle={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <RangePicker size="small" value={dateRange} onChange={setDateRange} />
        <div style={{ flex: 1 }} />
        <Tag color="red">Deviations: {deviations.length}</Tag>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>
      <Table rowKey="id" dataSource={deviations} columns={columns} size="small" loading={loading}
        pagination={{ pageSize: 20 }} scroll={{ x: 1200 }}
        locale={{ emptyText: 'No deviations found. All process readings are within spec.' }}
      />
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ProcessRecipesPage() {
  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Process Recipes</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Process Recipes</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Define process parameters per item per machine with target ranges. Record actuals and detect deviations.
      </Text>

      <div style={{ marginTop: 16 }}>
        <Tabs
          defaultActiveKey="recipes"
          items={[
            {
              key: 'recipes',
              label: <span><ExperimentOutlined style={{ marginRight: 6 }} />Recipes</span>,
              children: <RecipeTab />,
            },
            {
              key: 'deviations',
              label: <span><WarningOutlined style={{ marginRight: 6 }} />Deviations</span>,
              children: <DeviationsTab />,
            },
          ]}
        />
      </div>
    </AppLayout>
  );
}
