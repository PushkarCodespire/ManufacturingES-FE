import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Steps, Radio,
  Checkbox, Card, Modal, message, Tooltip, Badge, Tag, Drawer, Switch, Tree,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, ArrowLeftOutlined,
  SettingOutlined, SearchOutlined, RightOutlined, ToolOutlined,
  CheckCircleOutlined, InfoCircleOutlined, CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { machineApi } from '../../../api/machine.api';
import { productionParameterApi } from '../../../api/productionParameter.api';
import { tagApi } from '../../../api/tag.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// Default parameter columns for Step 3 — Set Parameters table
const SET_PARAM_COLUMNS = ['Scrap', 'Energy', 'Boxes', 'packaging', 'shipments'];

const PARAM_TYPE_OPTIONS = [
  { label: 'Text',        value: 'text' },
  { label: 'Number',      value: 'number' },
  { label: 'Date',        value: 'date' },
  { label: 'Date & Time', value: 'datetime' },
  { label: 'Derived',     value: 'derived' },
  { label: 'Integrated',  value: 'integrated' },
  { label: 'Checkbox',    value: 'checkbox' },
];

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({ machines, loading, search, onSearchChange, onRefresh, onNew, onDetail, onDelete, canWrite }) => {
  // Build recursive tree: root machines with children nested (supports multi-level)
  const treeData = useMemo(() => {
    if (!machines?.length) return [];

    const byId = new Map(machines.map((m) => [m.id, m]));
    const childrenByParent = new Map();

    machines.forEach((m) => {
      if (m.parent_id && byId.has(m.parent_id)) {
        if (!childrenByParent.has(m.parent_id)) childrenByParent.set(m.parent_id, []);
        childrenByParent.get(m.parent_id).push(m);
      }
    });

    // Recursively attach children at every level
    const attachChildren = (machine) => {
      const kids = childrenByParent.get(machine.id);
      if (!kids?.length) return { ...machine, children: undefined };
      return { ...machine, children: kids.map((k) => attachChildren(k)) };
    };

    // Roots = machines without parent_id OR whose parent isn't in current list
    const roots = machines.filter((m) => !m.parent_id || !byId.has(m.parent_id));
    return roots.map((m) => attachChildren(m));
  }, [machines]);

  const columns = [
    {
      title: 'Name',
      key: 'name',
      width: 200,
      render: (_, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
          onClick={() => onDetail(r)}
        >
          {r.name}
        </Text>
      ),
    },
    {
      title: 'Tags',
      key: 'tags',
      width: 260,
      render: (_, r) => {
        const tags = [
          ...(r.item_group_tags || []),
          ...(r.machine_group_tags || []),
          ...(r.iot_device_tags || []),
        ];
        return tags.length > 0
          ? <Text style={{ fontSize: 12, color: '#374151' }}>{tags.join(', ')}</Text>
          : <Text style={{ color: '#d1d5db', fontSize: 12 }}>-</Text>;
      },
    },
    {
      title: 'Shifts',
      key: 'shifts',
      width: 130,
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>
          {r.shift || 'Applied to All'}
        </Text>
      ),
    },
    {
      title: 'Children',
      key: 'children_col',
      width: 280,
      render: (_, r) => {
        const kids = r.Children || [];
        return kids.length > 0
          ? <Text style={{ fontSize: 12, color: '#374151' }}>{kids.map((c) => c.name).join(', ')}</Text>
          : <Text style={{ color: '#d1d5db', fontSize: 12 }}>-</Text>;
      },
    },
    {
      title: 'Created At',
      key: 'createdAt',
      width: 160,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, color: '#374151', display: 'block' }}>{r.Creator?.name || '-'}</Text>
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
          <Text style={{ fontSize: 12, color: '#111827', fontWeight: 500, display: 'block' }}>{r.Updater?.name || '-'}</Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDateTime(r.updatedAt)}</Text>
        </div>
      ),
    },
    ...(canWrite ? [{
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title="Configure">
            <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => onDetail(r)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(r)} />
          </Tooltip>
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Machines</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Machines</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Manage production machines and equipment</Text>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search machines…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onNew} style={{ borderRadius: 8, fontWeight: 600 }}>
              NEW
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={treeData}
          loading={loading}
          expandable={{
            childrenColumnName: 'children',
            defaultExpandAllRows: false,
            indentSize: 24,
          }}
          pagination={{ pageSize: 20, showTotal: (t) => `${t} machines`, style: { marginBottom: 0 } }}
          scroll={{ x: 1200 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <ToolOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No machines added yet</Text>
                {canWrite && (
                  <>
                    <br />
                    <Button type="primary" size="small" onClick={onNew} style={{ marginTop: 10 }}>Add Your First Machine</Button>
                  </>
                )}
              </div>
            ),
          }}
        />
      </Card>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ADD PARAMETER DRAWER
// ══════════════════════════════════════════════════════════════════════════════
const mkField = (type = 'number') => ({
  key: Date.now() + Math.random(), label: '', type, formula: '', ctq: '', enabled: true,
});

const AddParameterDrawer = ({ open, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [groupBy, setGroupBy] = useState('none');
  // Table is always visible — start with 1 default empty row
  const [fields, setFields] = useState([mkField('number')]);
  const [saving, setSaving] = useState(false);

  const addField = (defaultType = 'number') => {
    setFields((prev) => [...prev, mkField(defaultType)]);
  };

  const updateField = (key, prop, val) => {
    setFields((prev) => prev.map((f) => f.key === key ? { ...f, [prop]: val } : f));
  };

  const removeField = (key) => {
    setFields((prev) => prev.filter((f) => f.key !== key));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      message.warning('Title is required');
      return;
    }
    const validFields = fields.filter((f) => f.label.trim() && f.enabled);
    if (validFields.length === 0) {
      message.warning('Add at least one field');
      return;
    }

    setSaving(true);
    try {
      const parameters = validFields.map((f) => ({
        name: f.label.trim(),
        type: f.type,
        formula: f.type === 'derived' ? f.formula : null,
        ctq: f.type === 'derived' ? f.ctq : null,
      }));
      await onSave(parameters);
      setTitle('');
      setGroupBy('none');
      setFields([]);
      onClose();
    } catch {
      message.error('Failed to save parameters');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setGroupBy('none');
    setFields([mkField('number')]); // reset to one default row
    onClose();
  };

  return (
    <Drawer
      title={null}
      placement="right"
      width={520}
      open={open}
      onClose={handleClose}
      closable={false}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5} style={{ margin: 0 }}>Add Production Form</Title>
          <Button type="text" icon={<CloseOutlined />} onClick={handleClose} />
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Title & Group By */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Title*</Text>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Parameter group title"
              style={{ borderRadius: 6 }}
            />
          </div>
          <div style={{ width: 140 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Group By</Text>
            <Select
              value={groupBy}
              onChange={setGroupBy}
              style={{ width: '100%', borderRadius: 6 }}
              options={[{ label: 'None', value: 'none' }]}
            />
          </div>
        </div>

        {/* Add buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <Button
            icon={<PlusOutlined />}
            onClick={() => addField('number')}
            style={{ borderRadius: 6, borderColor: '#1d4ed8', color: '#1d4ed8' }}
          >
            Add Number Field
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => addField('derived')}
            style={{ borderRadius: 6, borderColor: '#7c3aed', color: '#7c3aed' }}
          >
            Add Derived Field
          </Button>
        </div>

        {/* Fields Table — always visible */}
        <div style={{ border: '1px solid #e8eaed', borderRadius: 8, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 40px 40px',
            gap: 8,
            padding: '10px 12px',
            background: '#f9fafb',
            borderBottom: '1px solid #e8eaed',
            fontSize: 12,
            fontWeight: 600,
            color: '#6b7280',
          }}>
            <span>Label / Key</span>
            <span>Type</span>
            <span style={{ textAlign: 'center' }}>Active</span>
            <span></span>
          </div>

          {/* Rows */}
          {fields.map((f) => (
            <div key={f.key}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 40px 40px',
                gap: 8,
                padding: '8px 12px',
                alignItems: 'center',
                borderBottom: '1px solid #f0f0f0',
              }}>
                <Input
                  size="small"
                  value={f.label}
                  onChange={(e) => updateField(f.key, 'label', e.target.value)}
                  placeholder="Field name"
                  style={{ borderRadius: 4 }}
                />
                <Select
                  size="small"
                  value={f.type}
                  onChange={(val) => updateField(f.key, 'type', val)}
                  options={PARAM_TYPE_OPTIONS}
                  style={{ width: '100%' }}
                />
                <div style={{ textAlign: 'center' }}>
                  <Switch
                    size="small"
                    checked={f.enabled}
                    onChange={(val) => updateField(f.key, 'enabled', val)}
                  />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeField(f.key)}
                  />
                </div>
              </div>

              {/* Derived-only fields: Formula & CTQ */}
              {f.type === 'derived' && (
                <div style={{ padding: '8px 12px 12px', background: '#faf5ff', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, color: '#7c3aed', display: 'block', marginBottom: 2 }}>Formula (Derived only)</Text>
                    <TextArea
                      size="small"
                      rows={2}
                      value={f.formula}
                      onChange={(e) => updateField(f.key, 'formula', e.target.value)}
                      placeholder="Enter formula expression..."
                      style={{ borderRadius: 4, fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <Text style={{ fontSize: 11, color: '#7c3aed', display: 'block', marginBottom: 2 }}>CTQ (Derived only)</Text>
                    <TextArea
                      size="small"
                      rows={2}
                      value={f.ctq}
                      onChange={(e) => updateField(f.key, 'ctq', e.target.value)}
                      placeholder="Enter CTQ expression..."
                      style={{ borderRadius: 4, fontSize: 12 }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" onClick={handleSubmit} loading={saving} style={{ borderRadius: 8, fontWeight: 600 }}>
            Submit
          </Button>
        </div>
      </div>
    </Drawer>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  TREE HELPERS (Step 1)
// ══════════════════════════════════════════════════════════════════════════════
const mkMachineNode = (isRoot = true) => ({
  key:       `m-${Date.now()}-${Math.random()}`,
  title:     '', // required by Ant Design Tree; actual content via titleRender
  name:      '',
  parent_id: null,
  isRoot,
  children:  [],
});

const treeUpdateNode = (key, field, val, nodes) =>
  nodes.map((n) =>
    n.key === key
      ? { ...n, [field]: val }
      : { ...n, children: n.children ? treeUpdateNode(key, field, val, n.children) : [] }
  );

const treeAddChild = (parentKey, nodes) => {
  const child = mkMachineNode(false);
  return nodes.map((n) =>
    n.key === parentKey
      ? { ...n, children: [...(n.children || []), child] }
      : { ...n, children: n.children ? treeAddChild(parentKey, n.children) : [] }
  );
};

const treeRemoveNode = (key, nodes) =>
  nodes
    .filter((n) => n.key !== key)
    .map((n) => ({ ...n, children: n.children ? treeRemoveNode(key, n.children) : [] }));

const getAllTreeKeys = (nodes) => {
  const keys = [];
  const walk = (list) => list.forEach((n) => { keys.push(n.key); if (n.children?.length) walk(n.children); });
  walk(nodes);
  return keys;
};

const flattenTreeNodes = (nodes) => {
  const result = [];
  const walk = (list) => list.forEach((n) => { result.push(n); if (n.children?.length) walk(n.children); });
  walk(nodes);
  return result;
};

// ── NodeTitle rendered inside Ant Design Tree (memoized to avoid focus loss) ─
const MachineNodeTitle = React.memo(({
  nodeKey, name, parent_id, isRoot, existingMachines,
  onNameChange, onParentChange, onAddChild, onRemove,
}) => {
  const parentOptions = useMemo(
    () => existingMachines.map((m) => ({ label: m.name, value: m.id })),
    [existingMachines]
  );

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
      onClick={(e) => e.stopPropagation()}
    >
      {isRoot && (
        <Text style={{ fontSize: 11, color: '#9ca3af', marginRight: 2 }}>Machine Name</Text>
      )}
      <Input
        size="small"
        value={name}
        onChange={(e) => onNameChange(nodeKey, e.target.value)}
        placeholder="Machine name"
        style={{ width: isRoot ? 240 : 220, borderRadius: 6 }}
      />
      {isRoot && (
        <Select
          size="small"
          value={parent_id || undefined}
          onChange={(val) => onParentChange(nodeKey, val || null)}
          placeholder="Parent Machine"
          allowClear
          showSearch
          filterOption={(inp, opt) => opt.label.toLowerCase().includes(inp.toLowerCase())}
          options={parentOptions}
          style={{ width: 190 }}
        />
      )}
      <Button
        size="small"
        icon={<PlusOutlined />}
        onClick={() => onAddChild(nodeKey)}
        style={{ borderRadius: 6, borderColor: '#1d4ed8', color: '#1d4ed8', fontSize: 12 }}
      >
        + Add Child
      </Button>
      <Button
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={() => onRemove(nodeKey)}
        style={{ borderRadius: 6 }}
      />
    </span>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
//  CREATE MACHINE STEPPER
// ══════════════════════════════════════════════════════════════════════════════
const CreateMachineStepper = ({ existingMachines, parameters, onDone, onCancel, onRefreshParams }) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Step 1: Machine hierarchy (Ant Design Tree data)
  const [treeData, setTreeData] = useState([mkMachineNode(true)]);

  // Step 2: Production against per flat machine
  const [productionSettings, setProductionSettings] = useState({});

  // Step 3: Parameters per flat machine
  const [parameterSettings, setParameterSettings] = useState({});

  // All expanded keys (always keep fully expanded)
  const expandedKeys = useMemo(() => getAllTreeKeys(treeData), [treeData]);

  // Flat list of all machines (for steps 2 and 3)
  const flatMachines = useMemo(() => flattenTreeNodes(treeData), [treeData]);

  // ── Stable callbacks to prevent focus-loss on controlled inputs ────────────
  const handleNameChange = useCallback((key, value) => {
    setTreeData((prev) => treeUpdateNode(key, 'name', value, prev));
  }, []);

  const handleParentChange = useCallback((key, value) => {
    setTreeData((prev) => treeUpdateNode(key, 'parent_id', value, prev));
  }, []);

  const handleAddChild = useCallback((key) => {
    setTreeData((prev) => treeAddChild(key, prev));
  }, []);

  const handleRemoveNode = useCallback((key) => {
    setTreeData((prev) => {
      const result = treeRemoveNode(key, prev);
      return result.length === 0 ? [mkMachineNode(true)] : result;
    });
  }, []);

  const addRootMachine = useCallback(() => {
    setTreeData((prev) => [...prev, mkMachineNode(true)]);
  }, []);

  // titleRender — memoized so Ant Design Tree doesn't remount nodes on re-render
  const titleRender = useCallback((nodeData) => (
    <MachineNodeTitle
      nodeKey={nodeData.key}
      name={nodeData.name}
      parent_id={nodeData.parent_id}
      isRoot={nodeData.isRoot}
      existingMachines={existingMachines}
      onNameChange={handleNameChange}
      onParentChange={handleParentChange}
      onAddChild={handleAddChild}
      onRemove={handleRemoveNode}
    />
  ), [existingMachines, handleNameChange, handleParentChange, handleAddChild, handleRemoveNode]);

  // Validate step
  const canGoNext = () => {
    if (step === 0) return flatMachines.some((m) => m.name.trim());
    return true;
  };

  // Submit
  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Map parameter names to their DB ids (if they exist in the parameters list)
      const paramIdByName = {};
      parameters.forEach((p) => { paramIdByName[p.name] = p.id; });

      const buildPayload = (list) =>
        list
          .filter((m) => m.name.trim())
          .map((m) => {
            const checkedParams = parameterSettings[m.key] || {};
            // Collect checked parameter IDs by matching column name → DB id
            const parameter_ids = Object.entries(checkedParams)
              .filter(([, v]) => v)
              .map(([name]) => paramIdByName[name])
              .filter(Boolean);
            // Also include the raw checked names for reference
            const parameter_names = Object.entries(checkedParams)
              .filter(([, v]) => v)
              .map(([name]) => name);

            return {
              name: m.name.trim(),
              parent_id: m.parent_id || null,
              production_against: productionSettings[m.key] || 'none',
              parameter_ids,
              parameter_names,
              children: m.children ? buildPayload(m.children) : [],
            };
          });

      await machineApi.bulkCreate({ machines: buildPayload(treeData) });
      message.success('Machines created successfully');
      onDone();
    } catch {
      message.error('Failed to create machines');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveParams = async (newParams) => {
    await productionParameterApi.bulkCreate({ parameters: newParams });
    message.success('Parameters added');
    onRefreshParams();
  };

  const stepItems = [
    { title: 'Add Machine' },
    { title: 'Record Production' },
    { title: 'Set Parameters' },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={onCancel}>Machines</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Create Machine</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onCancel} style={{ padding: 0, color: '#6b7280' }} />
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Create Machine</Title>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ maxWidth: 800, margin: '0 auto 24px' }}>
        <Steps current={step} items={stepItems} />
      </div>

      {/* Step Content */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e8eaed',
        borderRadius: 12,
        padding: '28px 32px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        minHeight: 300,
      }}>
        {/* ── Step 1: Add Machine ───────────────────────────────────── */}
        {step === 0 && (
          <div>
            <Text style={{ fontWeight: 600, fontSize: 15, color: '#111827', display: 'block', marginBottom: 16 }}>
              Machine Details
            </Text>

            {/* Ant Design Tree — same style as Master Access permission tree */}
            <Tree
              showLine={{ showLeafIcon: false }}
              expandedKeys={expandedKeys}
              onExpand={() => {/* keep fully expanded */}}
              treeData={treeData}
              titleRender={titleRender}
              selectable={false}
              blockNode={false}
              style={{ fontSize: 13 }}
            />

            <Button
              type="link"
              icon={<PlusOutlined />}
              onClick={addRootMachine}
              style={{ marginTop: 12, padding: 0, color: '#1d4ed8', fontWeight: 500 }}
            >
              + Add Another Machine
            </Button>
          </div>
        )}

        {/* ── Step 2: Record Production ─────────────────────────────── */}
        {step === 1 && (
          <div>
            <Table
              rowKey="key"
              dataSource={flatMachines.filter((m) => m.name.trim())}
              pagination={false}
              size="middle"
              columns={[
                {
                  title: 'Name',
                  dataIndex: 'name',
                  width: 200,
                },
                {
                  title: 'Work Order',
                  key: 'wo',
                  render: (_, r) => (
                    <Radio
                      checked={productionSettings[r.key] === 'work_order'}
                      onChange={() => setProductionSettings((p) => ({ ...p, [r.key]: 'work_order' }))}
                    />
                  ),
                },
                {
                  title: 'Sales Order',
                  key: 'so',
                  render: (_, r) => (
                    <Radio
                      checked={productionSettings[r.key] === 'sales_order'}
                      onChange={() => setProductionSettings((p) => ({ ...p, [r.key]: 'sales_order' }))}
                    />
                  ),
                },
                {
                  title: 'None',
                  key: 'none',
                  render: (_, r) => (
                    <Radio
                      checked={!productionSettings[r.key] || productionSettings[r.key] === 'none'}
                      onChange={() => setProductionSettings((p) => ({ ...p, [r.key]: 'none' }))}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* ── Step 3: Set Parameters ────────────────────────────────── */}
        {step === 2 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 500, color: '#374151', minWidth: 180 }}>
                    Name
                  </th>
                  {SET_PARAM_COLUMNS.map((col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        fontWeight: 500,
                        color: '#374151',
                        whiteSpace: 'nowrap',
                        minWidth: 140,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                  <th style={{ textAlign: 'left', padding: '14px 16px', minWidth: 140 }}>
                    <span
                      style={{ color: '#1d4ed8', cursor: 'pointer', fontWeight: 500, fontSize: 14 }}
                      onClick={() => setDrawerOpen(true)}
                    >
                      + Add Parameter
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {flatMachines.filter((m) => m.name.trim()).length === 0 ? (
                  <tr>
                    <td
                      colSpan={SET_PARAM_COLUMNS.length + 2}
                      style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}
                    >
                      No machines added yet. Go back to Step 1 to add machines.
                    </td>
                  </tr>
                ) : (
                  flatMachines.filter((m) => m.name.trim()).map((m) => (
                    <tr key={m.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '14px 16px', color: '#111827' }}>
                        {m.name}
                      </td>
                      {SET_PARAM_COLUMNS.map((col) => (
                        <td key={col} style={{ padding: '14px 16px' }}>
                          <Checkbox
                            checked={!!(parameterSettings[m.key] || {})[col]}
                            onChange={(e) =>
                              setParameterSettings((prev) => ({
                                ...prev,
                                [m.key]: { ...(prev[m.key] || {}), [col]: e.target.checked },
                              }))
                            }
                          />
                        </td>
                      ))}
                      <td style={{ padding: '14px 16px' }} />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <div>
          {step > 0 && (
            <Button onClick={() => setStep((s) => s - 1)} style={{ borderRadius: 8 }}>
              Back
            </Button>
          )}
        </div>
        <div>
          {step < 2 ? (
            <Button
              type="primary"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canGoNext()}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Next
            </Button>
          ) : (
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={saving}
              style={{ borderRadius: 8, fontWeight: 600, background: '#dc2626', borderColor: '#dc2626' }}
            >
              Submit
            </Button>
          )}
        </div>
      </div>

      <AddParameterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSaveParams}
      />
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  EDIT / VIEW PAGE (3-column layout matching reference)
// ══════════════════════════════════════════════════════════════════════════════
const EditViewPage = ({ machine, parameters, tags, onBack, onRefresh, onRefreshParams, canWrite }) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Build tag options from Tag Management
  const itemGroupTagOptions = useMemo(
    () => (tags || []).map((t) => ({ label: t.name, value: t.name })),
    [tags],
  );

  useEffect(() => {
    if (machine) {
      form.setFieldsValue({
        production_against:  machine.production_against || 'none',
        shift:               machine.shift || '',
        setup_time_hrs:      machine.setup_time_hrs || '',
        queue_time_days:     machine.queue_time_days || '',
        min_batch_quantity:  machine.min_batch_quantity || '',
        weighted_production: machine.weighted_production || false,
        auto_production:     machine.auto_production || false,
        start_stop_flow:     machine.start_stop_flow || false,
        serialization:       machine.serialization || false,
        item_group_tags:     machine.item_group_tags || [],
        machine_group_tags:  machine.machine_group_tags || [],
        iot_device_tags:     machine.iot_device_tags || [],
      });
    }
  }, [machine, form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      await machineApi.update(machine.id, values);
      message.success('Machine updated');
      setEditing(false);
      onRefresh();
    } catch {
      message.error('Failed to update machine');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleParam = async (paramId, field, value) => {
    try {
      const currentParams = (machine.Parameters || []).map((p) => ({
        parameter_id: p.id,
        is_production: p.MachineParameter?.is_production || false,
        is_barcode: p.MachineParameter?.is_barcode || false,
      }));

      const existing = currentParams.find((p) => p.parameter_id === paramId);
      let updated;
      if (existing) {
        updated = currentParams.map((p) =>
          p.parameter_id === paramId ? { ...p, [field]: value } : p
        );
      } else {
        updated = [...currentParams, {
          parameter_id: paramId,
          [field]: value,
          ...(field === 'is_production' ? { is_barcode: false } : { is_production: false }),
        }];
      }

      await machineApi.updateParameters(machine.id, { parameters: updated });
      onRefresh();
    } catch {
      message.error('Failed to update parameter');
    }
  };

  const handleSaveNewParams = async (newParams) => {
    await productionParameterApi.bulkCreate({ parameters: newParams });
    message.success('Parameters added');
    onRefreshParams();
  };

  const machineParamIds = new Set((machine.Parameters || []).map((p) => p.id));

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={onBack}>Machines</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>{machine.name}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ padding: 0, color: '#6b7280' }} />
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>{machine.name}</Title>
        </div>
      </div>

      {/* 3-column layout */}
      <Form form={form} layout="vertical" disabled={!editing}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* ── Column 1: Machine Details ─────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #e8eaed', borderRadius: 12,
          padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <Text style={{ fontWeight: 600, fontSize: 15, color: '#111827', display: 'block', marginBottom: 16 }}>
            Machine Details
          </Text>

          <Text style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Child machines</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {(machine.Children || []).length > 0
              ? machine.Children.map((c) => (
                  <Tag key={c.id} style={{ borderRadius: 6, padding: '2px 10px', fontSize: 12 }}>
                    {c.name}
                  </Tag>
                ))
              : <Text style={{ color: '#d1d5db', fontSize: 12 }}>No child machines</Text>
            }
          </div>

          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Code</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>{machine.code}</Text>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Parent</Text>
            <Text style={{ fontSize: 13 }}>{machine.Parent?.name || '—'}</Text>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Status</Text>
            {machine.is_active
              ? <Badge status="success" text={<Text style={{ color: '#16a34a', fontSize: 12 }}>Active</Text>} />
              : <Badge status="error" text={<Text style={{ color: '#dc2626', fontSize: 12 }}>Inactive</Text>} />
            }
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Description</Text>
            <Text style={{ fontSize: 13 }}>{machine.description || '—'}</Text>
          </div>
        </div>

        {/* ── Column 2: Planning ────────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #e8eaed', borderRadius: 12,
          padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <Text style={{ fontWeight: 600, fontSize: 15, color: '#111827', display: 'block', marginBottom: 16 }}>
            Planning
          </Text>

            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 8 }}>Production Against</Text>
            <Form.Item name="production_against" style={{ marginBottom: 16 }}>
              <Radio.Group>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Radio value="none">
                    <Text style={{ fontSize: 13 }}>None</Text>
                  </Radio>
                  <Radio value="work_order">
                    <div>
                      <Text style={{ fontSize: 13 }}>Work Order</Text>
                      <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>
                        Enables machine-wise scheduling and planning against an SO
                      </Text>
                    </div>
                  </Radio>
                  <Radio value="sales_order">
                    <div>
                      <Text style={{ fontSize: 13 }}>Sales Order</Text>
                      <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>
                        Direct production booking against the SO without scheduling
                      </Text>
                    </div>
                  </Radio>
                </div>
              </Radio.Group>
            </Form.Item>

            <Form.Item name="shift" label="Shift" style={{ marginBottom: 12 }}>
              <Input placeholder="Shift" style={{ borderRadius: 6 }} />
            </Form.Item>

            <Text style={{ fontWeight: 600, fontSize: 14, color: '#111827', display: 'block', margin: '16px 0 12px' }}>
              Machine Tags
            </Text>

            <Form.Item name="item_group_tags" label={<Text style={{ fontSize: 12, color: '#1d4ed8' }}>Item Group Tags</Text>} style={{ marginBottom: 12 }}>
              <Select
                mode="multiple"
                placeholder="Select item group tags"
                options={itemGroupTagOptions}
                style={{ borderRadius: 6 }}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item name="machine_group_tags" label={<Text style={{ fontSize: 12, color: '#1d4ed8' }}>Machine Group Tags</Text>} style={{ marginBottom: 12 }}>
              <Select mode="tags" placeholder="Add tags" style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item name="iot_device_tags" label="IOT Device Tags" style={{ marginBottom: 12 }}>
              <Select mode="tags" placeholder="Add tags" style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item name="setup_time_hrs" label="Setup Time (Hrs)" style={{ marginBottom: 12 }}>
              <Input type="number" placeholder="0" style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item name="queue_time_days" label="Queue Time (Days)" style={{ marginBottom: 12 }}>
              <Input type="number" placeholder="0" style={{ borderRadius: 6 }} />
            </Form.Item>

            <Form.Item name="min_batch_quantity" label="Minimum Batch Quantity" style={{ marginBottom: 12 }}>
              <Input type="number" placeholder="0" style={{ borderRadius: 6 }} />
            </Form.Item>
        </div>

        {/* ── Column 3: Production ─────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #e8eaed', borderRadius: 12,
          padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <Text style={{ fontWeight: 600, fontSize: 15, color: '#111827', display: 'block', marginBottom: 16 }}>
            Production
          </Text>

          <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 10 }}>
            Production Configuration
          </Text>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                { name: 'weighted_production', label: 'Weighted Production', info: true },
                { name: 'auto_production',     label: 'Auto Production' },
                { name: 'start_stop_flow',     label: 'Start/Stop Flow' },
                { name: 'serialization',       label: 'Serialization' },
              ].map((cfg) => (
                <div key={cfg.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {cfg.label}
                    {cfg.info && <InfoCircleOutlined style={{ color: '#9ca3af', fontSize: 12 }} />}
                  </span>
                  <Form.Item name={cfg.name} valuePropName="checked" style={{ margin: 0 }}>
                    <Checkbox />
                  </Form.Item>
                </div>
              ))}
            </div>

          <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 10 }}>
            Production Parameters
          </Text>

          <div style={{ border: '1px solid #e8eaed', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px',
              padding: '8px 12px',
              background: '#f9fafb',
              borderBottom: '1px solid #e8eaed',
              fontSize: 12,
              fontWeight: 600,
              color: '#6b7280',
            }}>
              <span>Name</span>
              <span style={{ textAlign: 'center' }}>Production</span>
              <span style={{ textAlign: 'center' }}>Barcode</span>
            </div>

            {parameters.map((p) => {
              const mp = (machine.Parameters || []).find((mp) => mp.id === p.id);
              const isProd = mp?.MachineParameter?.is_production || false;
              const isBarcode = mp?.MachineParameter?.is_barcode || false;

              return (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 80px',
                    padding: '8px 12px',
                    borderBottom: '1px solid #f0f0f0',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, color: '#374151' }}>{p.name}</Text>
                  <div style={{ textAlign: 'center' }}>
                    {machineParamIds.has(p.id) ? (
                      isProd
                        ? <CheckCircleOutlined
                            style={{ color: '#16a34a', fontSize: 16, cursor: editing ? 'pointer' : 'default' }}
                            onClick={() => editing && handleToggleParam(p.id, 'is_production', false)}
                          />
                        : <span
                            style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid #dc2626', cursor: editing ? 'pointer' : 'default' }}
                            onClick={() => editing && handleToggleParam(p.id, 'is_production', true)}
                          />
                    ) : (
                      <span
                        style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid #dc2626', cursor: editing ? 'pointer' : 'default' }}
                        onClick={() => editing && handleToggleParam(p.id, 'is_production', true)}
                      />
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {machineParamIds.has(p.id) ? (
                      isBarcode
                        ? <CheckCircleOutlined
                            style={{ color: '#16a34a', fontSize: 16, cursor: editing ? 'pointer' : 'default' }}
                            onClick={() => editing && handleToggleParam(p.id, 'is_barcode', false)}
                          />
                        : <span
                            style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid #dc2626', cursor: editing ? 'pointer' : 'default' }}
                            onClick={() => editing && handleToggleParam(p.id, 'is_barcode', true)}
                          />
                    ) : (
                      <span
                        style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid #dc2626', cursor: editing ? 'pointer' : 'default' }}
                        onClick={() => editing && handleToggleParam(p.id, 'is_barcode', true)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="link"
            icon={<PlusOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ padding: 0, marginTop: 8, fontSize: 12 }}
          >
            Attributes
          </Button>
        </div>
      </div>
      </Form>

      {/* Edit Button (fixed bottom-left like reference) */}
      {canWrite && (
        <div style={{ position: 'fixed', bottom: 24, left: 280 }}>
          {!editing ? (
            <Button
              type="primary"
              onClick={() => setEditing(true)}
              style={{ borderRadius: 8, fontWeight: 600, height: 36, paddingInline: 24 }}
            >
              Edit
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                onClick={handleSave}
                loading={saving}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                Save
              </Button>
              <Button onClick={() => setEditing(false)} style={{ borderRadius: 8 }}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      <AddParameterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSaveNewParams}
      />
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const MachinesPage = () => {
  const [view, setView]             = useState('list');
  const [machines, setMachines]     = useState([]);
  const [parameters, setParameters] = useState([]);
  const [tags, setTags]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState(null);
  const { can }  = usePermissions();
  const canWrite = can('production-machines-create_edit_delete');

  const fetchMachines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await machineApi.getAll(search ? { search } : {});
      setMachines(res?.data ?? res ?? []);
    } catch {
      message.error('Failed to load machines');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchParameters = useCallback(async () => {
    try {
      const res = await productionParameterApi.getAll();
      setParameters(res?.data ?? res ?? []);
    } catch {
      // silent
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await tagApi.getAll();
      setTags(res?.data ?? res ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchMachines(); }, [fetchMachines]);
  useEffect(() => { fetchParameters(); }, [fetchParameters]);
  useEffect(() => { fetchTags(); }, [fetchTags]);

  const refreshSelected = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await machineApi.getById(selected.id);
      setSelected(res?.data ?? res);
    } catch {
      // silent
    }
  }, [selected]);

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Delete Machine?',
      content: `Permanently delete "${record.name}"? This cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await machineApi.delete(record.id);
          message.success(`Machine "${record.name}" deleted`);
          fetchMachines();
        } catch {
          message.error('Failed to delete machine');
        }
      },
    });
  };

  const handleDetail = async (record) => {
    try {
      const res = await machineApi.getById(record.id);
      setSelected(res?.data ?? res);
      setView('detail');
    } catch {
      message.error('Failed to load machine details');
    }
  };

  return (
    <AppLayout>
      {view === 'list' && (
        <ListView
          machines={machines}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          onRefresh={fetchMachines}
          onNew={() => setView('add')}
          onDetail={handleDetail}
          onDelete={handleDelete}
          canWrite={canWrite}
        />
      )}
      {view === 'add' && canWrite && (
        <CreateMachineStepper
          existingMachines={machines}
          parameters={parameters}
          onDone={() => { setView('list'); fetchMachines(); }}
          onCancel={() => setView('list')}
          onRefreshParams={fetchParameters}
        />
      )}
      {view === 'detail' && selected && (
        <EditViewPage
          machine={selected}
          parameters={parameters}
          tags={tags}
          onBack={() => { setView('list'); setSelected(null); fetchMachines(); }}
          onRefresh={refreshSelected}
          onRefreshParams={fetchParameters}
          canWrite={canWrite}
        />
      )}
    </AppLayout>
  );
};

export default MachinesPage;
