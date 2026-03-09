import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Tabs, Card,
  Modal, message, Tooltip, Upload, Divider, InputNumber, Badge, Tag, Space,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, ArrowLeftOutlined,
  SearchOutlined, AppstoreOutlined, RightOutlined,
  HistoryOutlined, LinkOutlined, QrcodeOutlined,
  FilterOutlined, DownloadOutlined, SettingOutlined,
  CloseCircleOutlined, PlusCircleOutlined,
  AuditOutlined, ToolOutlined, CheckCircleOutlined, LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { itemApi } from '../../../api/item.api';
import { bomApi } from '../../../api/bom.api';
import { cycleTimeRuleApi } from '../../../api/cycleTimeRule.api';
import { tagApi } from '../../../api/tag.api';
import { machineApi } from '../../../api/machine.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// ── Item Group → auto-fill config ───────────────────────────────────────────
const ITEM_GROUPS = {
  Tooling:                { item_type: 'RM',  unit: 'piece' },
  Tubes:                  { item_type: 'RM',  unit: 'square_meter' },
  'Round Bars':           { item_type: 'RM',  unit: 'kg' },
  'Sheet Metal':          { item_type: 'RM',  unit: 'kg' },
  Castings:               { item_type: 'RM',  unit: 'kg' },
  Forgings:               { item_type: 'RM',  unit: 'kg' },
  Fasteners:              { item_type: 'RM',  unit: 'piece' },
  Marking:                { item_type: 'SFG', unit: 'piece' },
  Honing:                 { item_type: 'SFG', unit: 'piece' },
  Drilling:               { item_type: 'SFG', unit: 'piece' },
  'Machined Parts':       { item_type: 'SFG', unit: 'piece' },
  Assemblies:             { item_type: 'FG',  unit: 'piece' },
  'Consumables in KG':    { item_type: 'MRO', unit: 'kg' },
  'Consumables in Liters':{ item_type: 'MRO', unit: 'liter' },
  'Cutting Tools':        { item_type: 'MRO', unit: 'piece' },
  'Packing Material':     { item_type: 'PKG', unit: 'piece' },
  'Corrugated Boxes':     { item_type: 'PKG', unit: 'piece' },
  'Packing Quality Check':{ item_type: 'PKG', unit: 'piece' },
};

const ITEM_GROUP_OPTIONS = Object.keys(ITEM_GROUPS).map((g) => ({ label: g, value: g }));

// ── Comprehensive UOM list (20–30 options) ──────────────────────────────────
const UNIT_OPTIONS = [
  { label: 'piece',        value: 'piece' },
  { label: 'pair',         value: 'pair' },
  { label: 'dozen',        value: 'dozen' },
  { label: 'hundred',      value: 'hundred' },
  { label: 'thousand',     value: 'thousand' },
  { label: 'box',          value: 'box' },
  { label: 'pack',         value: 'pack' },
  { label: 'carton',       value: 'carton' },
  { label: 'pallet',       value: 'pallet' },
  { label: 'bag',          value: 'bag' },
  { label: 'bundle',       value: 'bundle' },
  { label: 'roll',         value: 'roll' },
  { label: 'set',          value: 'set' },
  { label: 'sheet',        value: 'sheet' },
  { label: 'kg',           value: 'kg' },
  { label: 'gram',         value: 'gram' },
  { label: 'ton',          value: 'ton' },
  { label: 'liter',        value: 'liter' },
  { label: 'ml',           value: 'ml' },
  { label: 'gallon',       value: 'gallon' },
  { label: 'meter',        value: 'meter' },
  { label: 'cm',           value: 'cm' },
  { label: 'mm',           value: 'mm' },
  { label: 'foot',         value: 'foot' },
  { label: 'inch',         value: 'inch' },
  { label: 'yard',         value: 'yard' },
  { label: 'square_meter', value: 'square_meter' },
  { label: 'square_foot',  value: 'square_foot' },
  { label: 'cubic_meter',  value: 'cubic_meter' },
];

// Sample rack names (in real app, these could come from API)
const RACK_OPTIONS = [
  'Rack A-1', 'Rack A-2', 'Rack A-3', 'Rack B-1', 'Rack B-2', 'Rack B-3',
  'Rack C-1', 'Rack C-2', 'Rack C-3', 'Rack D-1', 'Rack D-2',
  'Store Room 1', 'Store Room 2', 'Warehouse Shelf 1', 'Warehouse Shelf 2',
].map((r) => ({ label: r, value: r }));

// Sample partners (in real app, these come from a partners API)
const PARTNER_OPTIONS = [
  'Dynatech Controls', 'Precision Machining Co.', 'Steel India Ltd.',
  'Bharat Forge', 'Tata Steel', 'Atlas Copco', 'Parker Hannifin',
].map((p) => ({ label: p, value: p }));

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// ══════════════════════════════════════════════════════════════════════════════
//  FINALIZE BOM MODAL
// ══════════════════════════════════════════════════════════════════════════════
const FinalizeBomModal = ({ open, onClose, allItems }) => {
  const [boms, setBoms]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [bomUnit, setBomUnit]         = useState(null);
  const [bomLines, setBomLines]       = useState([]);
  const [currentBom, setCurrentBom]   = useState(null);

  const [bomSearch, setBomSearch] = useState('');

  // All items shown; optional search filter
  const bomItems = allItems.filter((i) => {
    if (!bomSearch) return true;
    const q = bomSearch.toLowerCase();
    return (i.code || '').toLowerCase().includes(q) || (i.name || '').toLowerCase().includes(q) || (i.item_group || '').toLowerCase().includes(q);
  });
  // All items as options for component selection
  const componentOptions = allItems.map((i) => ({ label: `${i.code} — ${i.name || ''}`, value: i.id }));

  const fetchBoms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bomApi.getAll();
      setBoms(res ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) { fetchBoms(); setSelectedItemId(null); setCurrentBom(null); setBomLines([]); setBomSearch(''); }
  }, [open, fetchBoms]);

  const getBomForItem = (itemId) => boms.find((b) => b.item_id === itemId);

  const handleSelectItem = async (itemId) => {
    setSelectedItemId(itemId);
    const existing = getBomForItem(itemId);
    if (existing) {
      setCurrentBom(existing);
      setBomUnit(existing.bom_unit);
      setBomLines((existing.Lines || []).map((ln) => ({
        component_item_id: ln.component_item_id,
        quantity: parseFloat(ln.quantity),
        unit: ln.unit,
      })));
    } else {
      const item = allItems.find((i) => i.id === itemId);
      setCurrentBom(null);
      setBomUnit(item?.bom_unit || item?.unit || null);
      setBomLines([]);
    }
  };

  const handleAddLine = () => {
    setBomLines([...bomLines, { component_item_id: null, quantity: 1, unit: 'piece' }]);
  };

  const handleRemoveLine = (idx) => {
    setBomLines(bomLines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx, field, value) => {
    const updated = [...bomLines];
    updated[idx] = { ...updated[idx], [field]: value };
    setBomLines(updated);
  };

  const handleSaveDraft = async () => {
    if (!selectedItemId) return;
    if (bomLines.length === 0) { message.warning('Add at least one component'); return; }
    const invalid = bomLines.some((ln) => !ln.component_item_id || !ln.quantity);
    if (invalid) { message.warning('Fill in all component fields'); return; }

    setSaving(true);
    try {
      await bomApi.createOrUpdate({
        item_id: selectedItemId,
        bom_unit: bomUnit,
        lines: bomLines,
      });
      message.success('BOM saved as draft');
      await fetchBoms();
      // Re-select to refresh
      const res = await bomApi.getAll();
      setBoms(res ?? []);
      const updated = (res ?? []).find((b) => b.item_id === selectedItemId);
      if (updated) { setCurrentBom(updated); }
    } catch (err) { message.error(err?.message || 'Failed to save BOM'); }
    finally { setSaving(false); }
  };

  const handleFinalize = async () => {
    if (!currentBom) {
      // Save first, then finalize
      await handleSaveDraft();
    }
    // Re-fetch to get updated bom
    const refreshed = await bomApi.getAll();
    setBoms(refreshed ?? []);
    const bom = (refreshed ?? []).find((b) => b.item_id === selectedItemId);
    if (!bom) { message.error('Save the BOM first'); return; }
    if (bom.status === 'finalized') { message.info('BOM is already finalized'); return; }

    Modal.confirm({
      title: 'Finalize BOM?',
      content: 'Once finalized, the BOM cannot be edited. Are you sure?',
      okText: 'Finalize',
      okType: 'primary',
      onOk: async () => {
        try {
          await bomApi.finalize(bom.id);
          message.success('BOM finalized');
          await fetchBoms();
          setCurrentBom({ ...bom, status: 'finalized' });
        } catch (err) { message.error(err?.message || 'Failed to finalize BOM'); }
      },
    });
  };

  const isFinalized = currentBom?.status === 'finalized';

  return (
    <Modal
      title={<Text style={{ fontWeight: 700, fontSize: 16 }}>Finalize BOM</Text>}
      open={open} onCancel={onClose} footer={null}
      width={960} centered destroyOnClose
    >
      <div style={{ display: 'flex', gap: 20, minHeight: 400 }}>
        {/* Left — item list */}
        <div style={{ width: 280, borderRight: '1px solid #e8eaed', paddingRight: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
            Select Item
          </Text>
          <Input
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            placeholder="Search items…"
            value={bomSearch}
            onChange={(e) => setBomSearch(e.target.value)}
            allowClear
            size="small"
            style={{ marginBottom: 8, borderRadius: 6 }}
          />
          <div style={{ maxHeight: 330, overflowY: 'auto' }}>
            {bomItems.length === 0 && (
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>No items found</Text>
            )}
            {bomItems.map((itm) => {
              const bom = getBomForItem(itm.id);
              const status = bom?.status;
              return (
                <div
                  key={itm.id}
                  onClick={() => handleSelectItem(itm.id)}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                    background: selectedItemId === itm.id ? '#eff6ff' : 'transparent',
                    border: selectedItemId === itm.id ? '1px solid #bfdbfe' : '1px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: 600 }}>{itm.code}</Text>
                        {itm.item_type && <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }} color={itm.item_type === 'FG' ? 'green' : itm.item_type === 'SFG' ? 'blue' : 'default'}>{itm.item_type}</Tag>}
                      </div>
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>{itm.name || ''}</Text>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {status === 'finalized' && <Badge status="success" text={<Text style={{ fontSize: 10, color: '#16a34a' }}>Finalized</Text>} />}
                      {status === 'draft' && <Badge status="processing" text={<Text style={{ fontSize: 10, color: '#2563eb' }}>Draft</Text>} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — BOM editor */}
        <div style={{ flex: 1 }}>
          {!selectedItemId ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Text style={{ color: '#9ca3af' }}>Select an item from the left to manage its BOM</Text>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontWeight: 600 }}>BOM Unit:</Text>
                  <Select
                    value={bomUnit || undefined}
                    onChange={(v) => setBomUnit(v)}
                    options={UNIT_OPTIONS}
                    style={{ width: 140 }}
                    showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
                    disabled={isFinalized}
                    placeholder="Select"
                  />
                </div>
                {isFinalized && (
                  <Tag icon={<LockOutlined />} color="success">Finalized</Tag>
                )}
              </div>

              {/* BOM Lines table */}
              <Table
                rowKey={(_, idx) => idx}
                dataSource={bomLines}
                pagination={false}
                size="small"
                locale={{ emptyText: <div style={{ padding: 20 }}><Text style={{ color: '#9ca3af', fontSize: 12 }}>No components added. Click "Add Component" to start.</Text></div> }}
                columns={[
                  {
                    title: 'Component Item', dataIndex: 'component_item_id', key: 'component_item_id',
                    render: (val, _, idx) => (
                      <Select
                        value={val || undefined} onChange={(v) => handleLineChange(idx, 'component_item_id', v)}
                        options={componentOptions} style={{ width: '100%' }}
                        showSearch filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        placeholder="Select component" disabled={isFinalized}
                      />
                    ),
                  },
                  {
                    title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 120,
                    render: (val, _, idx) => (
                      <InputNumber
                        value={val} onChange={(v) => handleLineChange(idx, 'quantity', v)}
                        min={0.0001} step={0.01} style={{ width: '100%' }}
                        disabled={isFinalized}
                      />
                    ),
                  },
                  {
                    title: 'Unit', dataIndex: 'unit', key: 'unit', width: 130,
                    render: (val, _, idx) => (
                      <Select
                        value={val || undefined} onChange={(v) => handleLineChange(idx, 'unit', v)}
                        options={UNIT_OPTIONS} style={{ width: '100%' }}
                        showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
                        disabled={isFinalized}
                      />
                    ),
                  },
                  ...(!isFinalized ? [{
                    title: '', key: 'actions', width: 40,
                    render: (_, __, idx) => (
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveLine(idx)} />
                    ),
                  }] : []),
                ]}
              />

              {/* Action buttons */}
              {!isFinalized && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                  <Button type="dashed" size="small" icon={<PlusCircleOutlined />} onClick={handleAddLine}>
                    Add Component
                  </Button>
                  <Space>
                    <Button onClick={handleSaveDraft} loading={saving} style={{ borderRadius: 8 }}>
                      Save Draft
                    </Button>
                    <Button type="primary" onClick={handleFinalize} loading={saving} icon={<CheckCircleOutlined />} style={{ borderRadius: 8, fontWeight: 600 }}>
                      Finalize
                    </Button>
                  </Space>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  RULES VIEW — Cycle Time Rules (full page sub-view)
// ══════════════════════════════════════════════════════════════════════════════
const RulesView = ({ onBack, canWrite }) => {
  const [rules, setRules]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [subView, setSubView]   = useState('list'); // list | add | edit
  const [editingRule, setEditingRule] = useState(null);

  // Tag options for add/edit
  const [machineOptions, setMachineOptions] = useState([]);
  const [itemTagOptions, setItemTagOptions] = useState([]);
  const [processOptions, setProcessOptions] = useState([]);

  // Daily target modal
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targetRule, setTargetRule]           = useState(null);
  const [targetForm] = Form.useForm();
  const [targetSaving, setTargetSaving]      = useState(false);

  // Add/Edit form
  const [ruleForm] = Form.useForm();
  const [ruleSaving, setRuleSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cycleTimeRuleApi.getAll();
      setRules(res ?? []);
    } catch { message.error('Failed to load rules'); }
    finally { setLoading(false); }
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      // 1. Tags from Tag Management
      const tagRes = await tagApi.getAll();
      const tags = tagRes ?? [];
      const mgFromTags = tags.filter((t) => t.tag_type === 'Machine Group').map((t) => t.name);
      const igFromTags = tags.filter((t) => t.tag_type === 'Item Group').map((t) => t.name);
      const prFromTags = tags.filter((t) => t.tag_type === 'Process').map((t) => t.name);

      // 2. Machine names + tags from existing machines
      let machineNames = [];
      let mgFromMachines = [];
      let igFromMachines = [];
      try {
        const machineRes = await machineApi.getAll({ pageSize: 1000 });
        const machines = machineRes ?? [];
        machineNames = machines.map((m) => m.name).filter(Boolean);
        machines.forEach((m) => {
          if (Array.isArray(m.machine_group_tags)) mgFromMachines.push(...m.machine_group_tags);
          if (Array.isArray(m.item_group_tags)) igFromMachines.push(...m.item_group_tags);
        });
      } catch { /* silent */ }

      // 3. Item group names from config
      const igFromConfig = Object.keys(ITEM_GROUPS);

      // 4. Common processes from item groups that are process-like
      const processLikeGroups = ['Marking', 'Honing', 'Drilling', 'Cutting', 'Turning', 'Grinding', 'Milling', 'Boring', 'Threading', 'Assembly', 'Packing', 'Inspection'];

      // Merge machine options: machine names + machine group tags
      const uniqueMachines = [...new Set([...machineNames, ...mgFromTags, ...mgFromMachines])].filter(Boolean).sort();
      const uniqueItemTags = [...new Set([...igFromTags, ...igFromMachines, ...igFromConfig])].filter(Boolean).sort();
      const uniqueProcesses = [...new Set([...prFromTags, ...processLikeGroups])].filter(Boolean).sort();

      setMachineOptions(uniqueMachines.map((t) => ({ label: t, value: t })));
      setItemTagOptions(uniqueItemTags.map((t) => ({ label: t, value: t })));
      setProcessOptions(uniqueProcesses.map((t) => ({ label: t, value: t })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchRules(); fetchOptions(); }, [fetchRules, fetchOptions]);

  const calcDailyTarget = (seconds) => {
    if (!seconds || seconds <= 0) return '—';
    return Math.floor(86400 / seconds);
  };

  const handleDeleteRule = (rule) => {
    Modal.confirm({
      title: 'Delete Rule?', content: `Delete rule for "${rule.machine_group_tag} → ${rule.item_group_tag}"?`,
      okText: 'Delete', okType: 'danger',
      onOk: async () => {
        try { await cycleTimeRuleApi.delete(rule.id); message.success('Rule deleted'); fetchRules(); }
        catch { message.error('Failed to delete rule'); }
      },
    });
  };

  const handleOpenTarget = (rule) => {
    setTargetRule(rule);
    targetForm.resetFields();
    setTargetModalOpen(true);
  };

  const handleSubmitTarget = async (values) => {
    if (!targetRule) return;
    setTargetSaving(true);
    try {
      await cycleTimeRuleApi.setDailyTarget(targetRule.id, {
        start_date: values.start_date,
        end_date:   values.end_date,
        target:     values.target,
      });
      message.success('Daily target set');
      setTargetModalOpen(false);
      fetchRules();
    } catch (err) { message.error(err?.message || 'Failed to set target'); }
    finally { setTargetSaving(false); }
  };

  const handleOpenEdit = (rule) => {
    setEditingRule(rule);
    ruleForm.setFieldsValue({
      machine_group_tag: rule.machine_group_tag,
      item_group_tag:    rule.item_group_tag,
      process:           rule.process || undefined,
      seconds_per_unit:  parseFloat(rule.seconds_per_unit),
    });
    setSubView('edit');
  };

  const handleOpenAdd = () => {
    setEditingRule(null);
    ruleForm.resetFields();
    setSubView('add');
  };

  const handleSaveRule = async (values) => {
    setRuleSaving(true);
    try {
      if (editingRule) {
        await cycleTimeRuleApi.update(editingRule.id, values);
        message.success('Rule updated');
      } else {
        await cycleTimeRuleApi.create(values);
        message.success('Rule created');
      }
      setSubView('list');
      fetchRules();
    } catch (err) { message.error(err?.message || 'Failed to save rule'); }
    finally { setRuleSaving(false); }
  };

  // ─── Add / Edit sub-view ──────────────────────────────────────────────────
  if (subView === 'add' || subView === 'edit') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setSubView('list')} style={{ padding: 0, color: '#6b7280' }} />
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
            {editingRule ? `Cycle Time Rules ${editingRule.id}` : 'Add New Cycle Time Rules'}
          </Title>
        </div>
        <Form form={ruleForm} layout="vertical" onFinish={handleSaveRule}>
          <div style={{ display: 'flex', gap: 20 }}>
            <Form.Item name="machine_group_tag" label={<Text style={{ fontWeight: 500 }}>Machine Group</Text>} rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
              <Select placeholder="Select machine" options={machineOptions} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="item_group_tag" label={<Text style={{ fontWeight: 500 }}>Item Group Tag</Text>} rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
              <Select placeholder="Select item tag" options={itemTagOptions} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="process" label={<Text style={{ fontWeight: 500 }}>Process</Text>} style={{ flex: 1 }}>
              <Select placeholder="Select process" options={processOptions} showSearch allowClear filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="seconds_per_unit" label={<Text style={{ fontWeight: 500 }}>Seconds</Text>} rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
              <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </div>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={ruleSaving} style={{ borderRadius: 8, fontWeight: 600 }}>
              {editingRule ? 'Edit' : 'Submit'}
            </Button>
          </Form.Item>
        </Form>
      </>
    );
  }

  // ─── Rules List ───────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Machines Tag', dataIndex: 'machine_group_tag', key: 'machine_group_tag',
      render: (val) => <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{val}</Text>,
    },
    {
      title: 'Item Tag', dataIndex: 'item_group_tag', key: 'item_group_tag',
      render: (val) => <Text style={{ fontSize: 12 }}>{val}</Text>,
    },
    {
      title: 'Process Tag', dataIndex: 'process', key: 'process',
      render: (val) => val ? <Text style={{ fontSize: 12 }}>{val}</Text> : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Seconds', dataIndex: 'seconds_per_unit', key: 'seconds_per_unit', width: 90,
      render: (val) => <Text style={{ fontSize: 12 }}>{parseFloat(val)}s</Text>,
    },
    {
      title: 'Daily Target', key: 'daily_target', width: 120,
      render: (_, r) => {
        const targets = r.DailyTargets || [];
        const today = dayjs().format('YYYY-MM-DD');
        const active = targets.find((t) => t.start_date <= today && t.end_date >= today);
        if (active) return <Tag color="blue" style={{ fontSize: 12, fontWeight: 500 }}>{active.target}</Tag>;
        return <Text style={{ fontSize: 12, color: '#6b7280' }}>{calcDailyTarget(parseFloat(r.seconds_per_unit))}</Text>;
      },
    },
    {
      title: 'Created At', key: 'createdAt', width: 170,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, fontWeight: 500, display: 'block' }}>{r.Creator?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>{fmtDateTime(r.createdAt)}</Text>
        </div>
      ),
    },
    {
      title: 'Last Updated At', key: 'updatedAt', width: 170,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, fontWeight: 500, display: 'block' }}>{r.Updater?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>{fmtDateTime(r.updatedAt)}</Text>
        </div>
      ),
    },
    {
      title: 'Actions', key: 'actions', width: 110,
      render: (_, r) => canWrite ? (
        <Space size={4}>
          <Tooltip title="Set Daily Target"><Button type="text" size="small" icon={<PlusCircleOutlined />} onClick={() => handleOpenTarget(r)} /></Tooltip>
          <Tooltip title="View / Edit"><Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => handleOpenEdit(r)} style={{ color: '#1d4ed8' }} /></Tooltip>
          <Tooltip title="Delete"><Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteRule(r)} /></Tooltip>
        </Space>
      ) : null,
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ padding: 0, color: '#9ca3af', fontSize: 12, height: 'auto' }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Cycle Time Rules</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Cycle Time Rules</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Define machine-item cycle times and daily targets</Text>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchRules} style={{ borderRadius: 8 }}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd} style={{ borderRadius: 8, fontWeight: 600 }}>
              + NEW
            </Button>
          )}
        </div>

        <Table
          rowKey="id" columns={columns} dataSource={rules} loading={loading}
          pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], showTotal: (t) => `${t} rules`, style: { marginBottom: 0 } }}
          scroll={{ x: 1200 }} size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <ToolOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No rules found</Text>
                {canWrite && (
                  <>
                    <br />
                    <Button type="primary" size="small" onClick={handleOpenAdd} style={{ marginTop: 10 }}>Add Your First Rule</Button>
                  </>
                )}
              </div>
            ),
          }}
        />
      </Card>

      {/* Set Daily Targets Modal */}
      <Modal
        title={<Text style={{ fontWeight: 700, fontSize: 14 }}>
          Set Daily Targets for {targetRule?.machine_group_tag} : {targetRule?.item_group_tag} : {targetRule?.process || '—'}
        </Text>}
        open={targetModalOpen}
        onCancel={() => setTargetModalOpen(false)}
        footer={null} centered width={480} destroyOnClose
      >
        <Form form={targetForm} layout="vertical" onFinish={handleSubmitTarget} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="start_date" label="Start Date" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
            <Form.Item name="end_date" label="End Date" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
            <Form.Item name="target" label="Target" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" loading={targetSaving} style={{ borderRadius: 8, fontWeight: 600 }}>Submit</Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({
  items, loading, search, onSearchChange, onRefresh, onNew, onDetail, onDelete,
  canWrite, pagination, onPageChange, onShowBomModal, onShowProcessModal,
}) => {
  const columns = [
    {
      title: 'Item Details', key: 'item_details',
      sorter: (a, b) => (a.code || '').localeCompare(b.code || ''),
      render: (_, r) => (
        <div>
          <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13, display: 'block', cursor: 'pointer' }} onClick={() => onDetail(r)}>
            {r.code || r.name}
          </Text>
          {r.name && r.name !== r.code && <Text style={{ color: '#6b7280', fontSize: 11 }}>{r.name}</Text>}
        </div>
      ),
    },
    {
      title: 'Item Group', key: 'item_group', width: 150,
      sorter: (a, b) => (a.item_group || '').localeCompare(b.item_group || ''),
      render: (_, r) => r.item_group ? <Text style={{ fontSize: 12 }}>{r.item_group}</Text> : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Attributes', key: 'attributes', width: 180,
      render: (_, r) => r.attributes ? <Text style={{ fontSize: 12 }}>{r.attributes}</Text> : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Units', key: 'units', width: 120,
      render: (_, r) => r.unit ? <Text style={{ fontSize: 12 }}>{r.unit}</Text> : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Item Type', key: 'item_type', width: 100,
      render: (_, r) => r.item_type ? <Text style={{ fontSize: 12, fontWeight: 500 }}>{r.item_type}</Text> : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Created At', key: 'createdAt', width: 180,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, fontWeight: 500, display: 'block' }}>{r.Creator?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>{fmtDateTime(r.createdAt)}</Text>
        </div>
      ),
    },
    {
      title: 'Last Updated At', key: 'updatedAt', width: 180,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 500, display: 'block' }}>{r.Updater?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>{fmtDateTime(r.updatedAt)}</Text>
        </div>
      ),
    },
    {
      title: 'Actions', key: 'actions', width: 60,
      render: (_, r) => canWrite ? (
        <Tooltip title="Delete"><Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => onDelete(r)} /></Tooltip>
      ) : null,
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Items</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Items</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Manage production items, BOMs and processes</Text>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search items…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          {canWrite && <Button icon={<AuditOutlined />} onClick={onShowBomModal} style={{ borderRadius: 8, fontWeight: 600 }}>FINALIZE BOM</Button>}
          {canWrite && <Button icon={<ToolOutlined />} onClick={onShowProcessModal} style={{ borderRadius: 8, fontWeight: 600 }}>SET PROCESS</Button>}
          <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onNew} style={{ borderRadius: 8, fontWeight: 600 }}>
              + NEW
            </Button>
          )}
        </div>

        <Table
          rowKey="id" columns={columns} dataSource={items} loading={loading}
          rowSelection={canWrite ? { type: 'checkbox' } : undefined}
          pagination={{ current: pagination.page, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}`, onChange: onPageChange, style: { marginBottom: 0 } }}
          scroll={{ x: 1200 }} size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <AppstoreOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No items found</Text>
                {canWrite && (
                  <>
                    <br />
                    <Button type="primary" size="small" onClick={onNew} style={{ marginTop: 10 }}>Add Your First Item</Button>
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
//  ADD NEW ITEM
// ══════════════════════════════════════════════════════════════════════════════
const AddItemForm = ({ onSave, onCancel, saving }) => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);

  const handleGroupChange = (val) => {
    const cfg = ITEM_GROUPS[val];
    form.setFieldsValue({
      item_type:      cfg?.item_type || '',
      unit:           cfg?.unit || undefined,
      sku_group_tags: [val],
    });
  };

  const handleUpload = async (info) => {
    const file = info.file || info;
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    setUploading(true);
    try {
      const res = await itemApi.upload(fd);
      const url = res?.data?.url;
      if (url) { form.setFieldsValue({ image_url: url }); message.success('Image uploaded'); }
    } catch { message.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (values) => {
    const { _img, ...payload } = values;
    await onSave(payload);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onCancel} style={{ padding: 0, color: '#6b7280' }} />
        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Add New Items</Title>
      </div>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <div style={{ display: 'flex', gap: 32 }}>
          <div style={{ flex: 1, maxWidth: 560 }}>
            <Form.Item name="code" label={<Text style={{ fontWeight: 500 }}>Item Code <Text type="danger">*</Text></Text>} rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="Enter item code" style={{ borderRadius: 6 }} />
            </Form.Item>
            <Form.Item name="name" label={<Text style={{ fontWeight: 500 }}>Item Name</Text>}>
              <TextArea rows={2} placeholder="Enter item name" style={{ borderRadius: 6 }} />
            </Form.Item>
            <Form.Item name="item_short_name" label={<Text style={{ fontWeight: 500 }}>Item Short Name</Text>}>
              <TextArea rows={2} placeholder="Enter short name" style={{ borderRadius: 6 }} />
            </Form.Item>
            <div style={{ display: 'flex', gap: 16 }}>
              <Form.Item name="item_group" label={<Text style={{ fontWeight: 500 }}>Item Group <Text type="danger">*</Text></Text>} rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
                <Select placeholder="Select group" options={ITEM_GROUP_OPTIONS} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} onChange={handleGroupChange} />
              </Form.Item>
              <Form.Item name="item_type" label={<Text style={{ fontWeight: 500 }}>Item Type</Text>} style={{ flex: 1 }}>
                <Input readOnly style={{ background: '#f9fafb' }} />
              </Form.Item>
              <Form.Item name="unit" label={<Text style={{ fontWeight: 500 }}>Unit <Text type="danger">*</Text></Text>} rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
                <Select placeholder="Select Unit" options={UNIT_OPTIONS} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
              </Form.Item>
            </div>
            <Form.Item name="sku_group_tags" label={<Text style={{ fontWeight: 500 }}>Sku Group Tags</Text>}>
              <Select mode="tags" placeholder="Add tags" />
            </Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={saving} style={{ borderRadius: 8, fontWeight: 600 }}>Submit</Button></Form.Item>
          </div>
          {/* Image upload — compact */}
          <div style={{ width: 180, paddingTop: 30, height: "200px" }}>
            <Upload.Dragger name="image" maxCount={1} showUploadList={false} beforeUpload={(f) => { handleUpload(f); return false; }} disabled={uploading} style={{ borderRadius: 8, height: 120 }}>
              <PlusOutlined style={{ fontSize: 20, color: '#9ca3af' }} />
              <p style={{ color: '#6b7280', fontSize: 11, marginTop: 6, marginBottom: 0 }}>{uploading ? 'Uploading…' : 'Upload'}</p>
            </Upload.Dragger>
            <Text style={{ display: 'block', textAlign: 'center', color: '#6b7280', fontSize: 11, margin: '6px 0' }}>OR</Text>
            <Form.Item name="image_url" noStyle><Input placeholder="Image Url" size="small" /></Form.Item>
          </div>
        </div>
      </Form>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  EDIT / VIEW — with all 5 tabs fully built
// ══════════════════════════════════════════════════════════════════════════════
const EditViewPage = ({ item, onBack, onRefresh, canWrite }) => {
  const [form] = Form.useForm();
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);

  // Tab data — stored locally, saved all together
  const [altUnits, setAltUnits]           = useState([]);
  const [standardLot, setStandardLot]     = useState([]);
  const [productionLot, setProductionLot] = useState([]);
  const [racks, setRacks]                 = useState([]);
  const [partnerCodes, setPartnerCodes]   = useState([]);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [partnerForm] = Form.useForm();

  // Init from item
  useEffect(() => {
    if (!item) return;
    form.setFieldsValue({
      name: item.name, item_short_name: item.item_short_name,
      item_group: item.item_group || undefined, item_type: item.item_type,
      unit: item.unit || undefined, bom_unit: item.bom_unit || undefined,
      sku_group_tags: item.sku_group_tags || [], image_url: item.image_url,
      gst_rate: item.gst_rate, hsn_code: item.hsn_code,
    });
    setAltUnits(item.alt_units || []);
    setStandardLot(item.batch_sizes?.standard_lot || []);
    setProductionLot(item.batch_sizes?.production_lot || []);
    setRacks(item.racks || []);
    setPartnerCodes(item.partner_codes || []);
  }, [item, form]);

  const handleGroupChange = (val) => {
    const cfg = ITEM_GROUPS[val];
    form.setFieldsValue({ item_type: cfg?.item_type || '', unit: cfg?.unit || undefined, sku_group_tags: [val] });
  };

  const handleUpload = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    setUploading(true);
    try {
      const res = await itemApi.upload(fd);
      const url = res?.data?.url;
      if (url) { form.setFieldsValue({ image_url: url }); message.success('Image uploaded'); }
    } catch { message.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await itemApi.update(item.id, {
        ...values,
        alt_units:     altUnits,
        batch_sizes:   { standard_lot: standardLot, production_lot: productionLot },
        racks,
        partner_codes: partnerCodes,
      });
      message.success('Item updated');
      setEditing(false);
      onRefresh();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to update item');
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setEditing(false);
    form.setFieldsValue({
      name: item.name, item_short_name: item.item_short_name,
      item_group: item.item_group || undefined, item_type: item.item_type,
      unit: item.unit || undefined, bom_unit: item.bom_unit || undefined,
      sku_group_tags: item.sku_group_tags || [], image_url: item.image_url,
      gst_rate: item.gst_rate, hsn_code: item.hsn_code,
    });
    setAltUnits(item.alt_units || []);
    setStandardLot(item.batch_sizes?.standard_lot || []);
    setProductionLot(item.batch_sizes?.production_lot || []);
    setRacks(item.racks || []);
    setPartnerCodes(item.partner_codes || []);
  };

  const primaryUnit = form.getFieldValue('unit') || item?.unit || 'piece';
  const imageUrl = form.getFieldValue('image_url') || item?.image_url;
  const imageSrc = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${API_BASE}${imageUrl}`) : null;

  // ── Helpers for dynamic lists ─────────────────────────────────────────────
  const listUpdate = (setter) => (idx, field, val) => setter((prev) => { const u = [...prev]; u[idx] = { ...u[idx], [field]: val }; return u; });

  // ── TAB 1: Alt Unit ───────────────────────────────────────────────────────
  const altUnitTab = (
    <div style={{ border: '1px solid #e8eaed', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#b45309' }}>Purchase/Sales Unit &#9432;</Text>
        <Text style={{ fontSize: 12, color: '#374151' }}>Primary Unit</Text>
      </div>
      {altUnits.map((au, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Input value={au.value} onChange={(e) => listUpdate(setAltUnits)(idx, 'value', e.target.value)} placeholder="" style={{ width: 100 }} disabled={!editing} />
          <Select value={au.unit || undefined} onChange={(v) => listUpdate(setAltUnits)(idx, 'unit', v)} placeholder="Select Unit" options={UNIT_OPTIONS} style={{ width: 140 }} disabled={!editing} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
          <Text style={{ color: '#6b7280', fontSize: 16 }}>=</Text>
          <Input value={au.primary_value || ''} onChange={(e) => listUpdate(setAltUnits)(idx, 'primary_value', e.target.value)} style={{ width: 100 }} disabled={!editing} />
          <Text style={{ fontSize: 12, fontWeight: 500 }}>{primaryUnit}</Text>
          {editing && <Button type="text" icon={<CloseCircleOutlined />} onClick={() => setAltUnits(altUnits.filter((_, i) => i !== idx))} style={{ color: '#6b7280' }} />}
        </div>
      ))}
      {editing && (
        <Button type="dashed" size="small" icon={<PlusCircleOutlined />} onClick={() => setAltUnits([...altUnits, { value: '', unit: '', primary_value: '', primary_unit: primaryUnit }])} style={{ marginTop: 4 }}>
          Add Unit
        </Button>
      )}
    </div>
  );

  // ── TAB 2: Batch Sizes ────────────────────────────────────────────────────
  const batchSizesTab = (
    <div>
      {/* Standard Lot Issuance */}
      <Text style={{ fontWeight: 600, fontSize: 13, display: 'block' }}>Standard Lot Issuance</Text>
      <Text style={{ fontSize: 11, color: '#b45309', display: 'block', marginBottom: 10 }}>
        Issuing materials in fixed quantities (e.g., 10 pieces per batch) helps control inventory, standardise production, and meet quality standards.
      </Text>
      {standardLot.map((sl, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Input value={sl.value} onChange={(e) => { const u = [...standardLot]; u[idx] = { ...u[idx], value: e.target.value }; setStandardLot(u); }} placeholder="" style={{ width: 160 }} disabled={!editing} />
          <Text style={{ fontSize: 12, fontWeight: 500 }}>{primaryUnit}</Text>
          {editing && <Button type="text" icon={<DeleteOutlined />} onClick={() => setStandardLot(standardLot.filter((_, i) => i !== idx))} />}
        </div>
      ))}
      {editing && (
        <Button type="dashed" size="small" icon={<PlusCircleOutlined />} onClick={() => setStandardLot([...standardLot, { value: '' }])} style={{ marginBottom: 20 }}>
          Add Pack Size
        </Button>
      )}

      <Divider style={{ margin: '16px 0' }} />

      {/* Production Lot Size */}
      <Text style={{ fontWeight: 600, fontSize: 13, display: 'block' }}>Production Lot Size</Text>
      <Text style={{ fontSize: 11, color: '#b45309', display: 'block', marginBottom: 10 }}>
        The quantity that is manufactured in a single production run
      </Text>
      {productionLot.map((pl, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Input value={pl.value} onChange={(e) => { const u = [...productionLot]; u[idx] = { ...u[idx], value: e.target.value }; setProductionLot(u); }} placeholder="" style={{ width: 160 }} disabled={!editing} />
          <Text style={{ fontSize: 12, fontWeight: 500 }}>{primaryUnit}</Text>
          {editing && <Button type="text" icon={<DeleteOutlined />} onClick={() => setProductionLot(productionLot.filter((_, i) => i !== idx))} />}
        </div>
      ))}
      {editing && (
        <Button type="dashed" size="small" icon={<PlusCircleOutlined />} onClick={() => setProductionLot([...productionLot, { value: '' }])}>
          Add Pack Size
        </Button>
      )}
    </div>
  );

  // ── TAB 3: Racks ──────────────────────────────────────────────────────────
  const racksTab = (
    <div>
      <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 10 }}>Racks</Text>
      <Divider style={{ margin: '0 0 12px 0' }} />
      {racks.map((rk, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Select value={rk || undefined} onChange={(v) => { const u = [...racks]; u[idx] = v; setRacks(u); }} placeholder="Select rack" options={RACK_OPTIONS} style={{ width: 200 }} disabled={!editing} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
          {editing && <Button type="text" icon={<DeleteOutlined />} onClick={() => setRacks(racks.filter((_, i) => i !== idx))} />}
        </div>
      ))}
      {editing && (
        <Button type="dashed" size="small" icon={<PlusCircleOutlined />} onClick={() => setRacks([...racks, ''])}>
          Add Racks
        </Button>
      )}
    </div>
  );

  // ── TAB 4: Partner Code ───────────────────────────────────────────────────
  const partnerColumns = [
    { title: 'Partner', dataIndex: 'partner', key: 'partner' },
    { title: 'Partner Item Code', dataIndex: 'partner_item_code', key: 'partner_item_code' },
    ...(editing ? [{
      title: 'Action', key: 'action', width: 60,
      render: (_, __, idx) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setPartnerCodes(partnerCodes.filter((_, i) => i !== idx))} />,
    }] : []),
  ];

  const handleAddPartner = () => {
    partnerForm.validateFields().then((vals) => {
      setPartnerCodes([...partnerCodes, vals]);
      partnerForm.resetFields();
      setPartnerModalOpen(false);
    });
  };

  const partnerCodeTab = (
    <div>
      {editing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setPartnerModalOpen(true)} style={{ fontWeight: 600 }}>Add New</Button>
        </div>
      )}
      <Table
        rowKey={(_, idx) => idx} columns={partnerColumns} dataSource={partnerCodes}
        size="small" pagination={false}
        locale={{ emptyText: <div style={{ padding: 16 }}><AppstoreOutlined style={{ fontSize: 24, color: '#d1d5db', display: 'block', marginBottom: 4 }} /><Text style={{ color: '#9ca3af', fontSize: 11 }}>No data</Text></div> }}
      />
      <Modal
        title="Add Partner Code" open={partnerModalOpen}
        onCancel={() => { partnerForm.resetFields(); setPartnerModalOpen(false); }}
        footer={null} centered width={560}
      >
        <Form form={partnerForm} layout="vertical" onFinish={handleAddPartner} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="partner" label="Partner" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
              <Select placeholder="Select partner" options={PARTNER_OPTIONS} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="partner_item_code" label="Partner Item Code" style={{ flex: 1 }}>
              <Input placeholder="Code" />
            </Form.Item>
            <Form.Item name="partner_item_name" label="Partner Item Name" style={{ flex: 1 }}>
              <Input placeholder="Name" />
            </Form.Item>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" style={{ borderRadius: 8, fontWeight: 600 }}>Submit</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );

  // ── TAB 5: Tax Information ────────────────────────────────────────────────
  const taxInfoTab = (
    <div style={{ border: '1px solid #e8eaed', borderRadius: 8, padding: 16 }}>
      <Form form={form} layout="vertical">
        <Form.Item name="gst_rate" label={<Text style={{ fontSize: 12, color: '#b45309', fontWeight: 500 }}>GST Rate</Text>}>
          <Input placeholder="" suffix="%" disabled={!editing} style={{ maxWidth: 400 }} />
        </Form.Item>
        <Form.Item name="hsn_code" label={<Text style={{ fontSize: 12, fontWeight: 500 }}>HSN Code</Text>}>
          <Input placeholder="" disabled={!editing} style={{ maxWidth: 220 }} />
        </Form.Item>
      </Form>
    </div>
  );

  const tabItems = [
    { key: 'alt_unit',     label: 'Alt Unit',          children: altUnitTab },
    { key: 'batch_sizes',  label: 'Batch Sizes',       children: batchSizesTab },
    { key: 'racks',        label: 'Racks',             children: racksTab },
    { key: 'partner_code', label: 'Partner Code',      children: partnerCodeTab },
    { key: 'tax_info',     label: 'Tax Information',   children: taxInfoTab },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ padding: 0, color: '#6b7280' }} />
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>Edit Items</Title>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" icon={<LinkOutlined />} style={{ color: '#6b7280' }} />
          <Button type="text" icon={<QrcodeOutlined />} style={{ color: '#6b7280' }} />
        </div>
      </div>

      {/* 3-column layout */}
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Left — form */}
        <div style={{ flex: '0 0 420px' }}>
          <Form form={form} layout="vertical">
            <Form.Item label={<Text style={{ fontWeight: 500 }}>Item Code <Text type="danger">*</Text></Text>}>
              <Input value={item.code} disabled style={{ background: '#f9fafb' }} />
            </Form.Item>
            <Form.Item name="name" label={<Text style={{ fontWeight: 500 }}>Item Name</Text>}>
              <TextArea rows={2} disabled={!editing} />
            </Form.Item>
            <Form.Item name="item_short_name" label={<Text style={{ fontWeight: 500 }}>Item Short Name</Text>}>
              <TextArea rows={2} disabled={!editing} />
            </Form.Item>
            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item name="item_group" label={<Text style={{ fontWeight: 500 }}>Item Group <Text type="danger">*</Text></Text>} rules={[{ required: true }]} style={{ flex: 1 }}>
                <Select options={ITEM_GROUP_OPTIONS} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} onChange={handleGroupChange} disabled={!editing} />
              </Form.Item>
              <Form.Item name="item_type" label={<Text style={{ fontWeight: 500 }}>Item Type</Text>} style={{ flex: 1 }}>
                <Input readOnly disabled style={{ background: '#f9fafb' }} />
              </Form.Item>
              <Form.Item name="unit" label={<Text style={{ fontWeight: 500 }}>Unit <Text type="danger">*</Text></Text>} rules={[{ required: true }]} style={{ flex: 1 }}>
                <Select options={UNIT_OPTIONS} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} disabled={!editing} />
              </Form.Item>
            </div>
            <Form.Item name="bom_unit" label={<Text style={{ fontWeight: 500 }}>BOM Unit</Text>} style={{ maxWidth: 180 }}>
              <Select options={UNIT_OPTIONS} showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} disabled={!editing} />
            </Form.Item>
            <Form.Item name="sku_group_tags" label={<Text style={{ fontWeight: 500 }}>Sku Group Tags</Text>}>
              <Select mode="tags" placeholder="Add tags" disabled={!editing} />
            </Form.Item>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {canWrite && !editing && (
                <Button type="primary" onClick={() => setEditing(true)} style={{ borderRadius: 8, fontWeight: 600 }}>Edit</Button>
              )}
              {editing && (
                <>
                  <Button onClick={resetForm} style={{ borderRadius: 8 }}>Close</Button>
                  <Button type="primary" onClick={handleSave} loading={saving} style={{ borderRadius: 8, fontWeight: 600 }}>Submit</Button>
                </>
              )}
            </div>
          </Form>
        </div>

        {/* Middle — image upload (compact) */}
        <div style={{ width: 160 }}>
          {imageSrc ? (
            <div style={{ marginBottom: 6 }}>
              <img src={imageSrc} alt="Item" style={{ width: '100%', borderRadius: 8, border: '1px solid #e8eaed', objectFit: 'cover', maxHeight: 120 }} />
              {editing && <Button type="link" danger size="small" onClick={() => form.setFieldsValue({ image_url: '' })} style={{ padding: 0, fontSize: 11 }}>Remove</Button>}
            </div>
          ) : (
            <Upload.Dragger name="image" maxCount={1} showUploadList={false} beforeUpload={(f) => { handleUpload(f); return false; }} disabled={!editing || uploading} style={{ borderRadius: 8, height: 100 }}>
              <PlusOutlined style={{ fontSize: 18, color: '#9ca3af' }} />
              <p style={{ color: '#6b7280', fontSize: 11, marginTop: 4, marginBottom: 0 }}>{uploading ? 'Uploading…' : 'Upload'}</p>
            </Upload.Dragger>
          )}
          <Text style={{ display: 'block', textAlign: 'center', color: '#6b7280', fontSize: 11, margin: '4px 0' }}>OR</Text>
          <Form form={form}>
            <Form.Item name="image_url" noStyle>
              <Input placeholder="Image Url" size="small" disabled={!editing} />
            </Form.Item>
          </Form>
        </div>

        {/* Right — tabs */}
        <div style={{ flex: 1, minWidth: 360, borderLeft: '1px solid #e8eaed', paddingLeft: 20 }}>
          <Tabs items={tabItems} size="small" />
        </div>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const ItemsPage = () => {
  const [view, setView]             = useState('list');
  const [items, setItems]           = useState([]);
  const [allItems, setAllItems]     = useState([]); // All items for BOM component selection
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [showBomModal, setShowBomModal]         = useState(false);
  const { can }  = usePermissions();
  const canWrite = can('production-items-create_edit_delete');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, pageSize: pagination.pageSize };
      if (search) params.search = search;
      const res = await itemApi.getAll(params);
      setItems(res?.data ?? []);
      if (res?.meta) setPagination((prev) => ({ ...prev, total: res.meta.total }));
    } catch { message.error('Failed to load items'); }
    finally { setLoading(false); }
  }, [search, pagination.page, pagination.pageSize]);

  // Fetch ALL items (no pagination) for BOM modal component selector
  const fetchAllItems = useCallback(async () => {
    try {
      const res = await itemApi.getAll({ pageSize: 1000 });
      setAllItems(res?.data ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchAllItems(); }, [fetchAllItems]);

  const handlePageChange = (page, pageSize) => setPagination((prev) => ({ ...prev, page, pageSize }));

  const handleCreate = async (values) => {
    setSaving(true);
    try { await itemApi.create(values); message.success('Item created'); setView('list'); fetchItems(); fetchAllItems(); }
    catch (err) { message.error(err?.message || 'Failed to create item'); }
    finally { setSaving(false); }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Delete Item?', content: `Permanently delete "${record.code || record.name}"?`,
      okText: 'Delete', okType: 'danger',
      onOk: async () => {
        try { await itemApi.delete(record.id); message.success('Item deleted'); fetchItems(); fetchAllItems(); }
        catch { message.error('Failed to delete item'); }
      },
    });
  };

  const handleDetail = async (record) => {
    try { const res = await itemApi.getById(record.id); setSelected(res?.data ?? res); setView('detail'); }
    catch { message.error('Failed to load item'); }
  };

  const refreshSelected = async () => {
    if (!selected) return;
    try { const res = await itemApi.getById(selected.id); setSelected(res?.data ?? res); }
    catch { /* silent */ }
  };

  return (
    <AppLayout>
      {view === 'list' && (
        <ListView items={items} loading={loading} search={search}
          onSearchChange={(v) => { setSearch(v); setPagination((p) => ({ ...p, page: 1 })); }}
          onRefresh={fetchItems} onNew={() => { setSelected(null); setView('add'); }}
          onDetail={handleDetail} onDelete={handleDelete} canWrite={canWrite}
          pagination={pagination} onPageChange={handlePageChange}
          onShowBomModal={() => setShowBomModal(true)}
          onShowProcessModal={() => setView('rules')} />
      )}
      {view === 'add' && canWrite && (
        <AddItemForm onSave={handleCreate} onCancel={() => setView('list')} saving={saving} />
      )}
      {view === 'detail' && selected && (
        <EditViewPage item={selected} onBack={() => { setView('list'); setSelected(null); fetchItems(); }} onRefresh={refreshSelected} canWrite={canWrite} />
      )}
      {view === 'rules' && (
        <RulesView onBack={() => setView('list')} canWrite={canWrite} />
      )}

      {/* Modals */}
      <FinalizeBomModal open={showBomModal} onClose={() => setShowBomModal(false)} allItems={allItems} />
    </AppLayout>
  );
};

export default ItemsPage;
