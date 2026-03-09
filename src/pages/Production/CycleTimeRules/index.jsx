import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Modal, Card,
  message, Tooltip, InputNumber, Tag, Space,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, ArrowLeftOutlined,
  RightOutlined, PlusCircleOutlined, ToolOutlined, HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { cycleTimeRuleApi } from '../../../api/cycleTimeRule.api';
import { tagApi }           from '../../../api/tag.api';
import { machineApi }       from '../../../api/machine.api';
import AppLayout            from '../../../components/AppLayout';
import usePermissions       from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// Item group names for populating item tag options
const ITEM_GROUPS = {
  Tooling: 1, Tubes: 1, 'Round Bars': 1, 'Sheet Metal': 1,
  Castings: 1, Forgings: 1, Fasteners: 1, Marking: 1, Honing: 1,
  Drilling: 1, 'Machined Parts': 1, Assemblies: 1,
  'Consumables in KG': 1, 'Consumables in Liters': 1,
  'Cutting Tools': 1, 'Packing Material': 1,
  'Corrugated Boxes': 1, 'Packing Quality Check': 1,
};

// ══════════════════════════════════════════════════════════════════════════════
//  CYCLE TIME RULES PAGE
// ══════════════════════════════════════════════════════════════════════════════
const CycleTimeRulesPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('production-items-create_edit_delete');

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
      const tagRes = await tagApi.getAll();
      const tags = tagRes ?? [];
      const mgFromTags = tags.filter((t) => t.tag_type === 'Machine Group').map((t) => t.name);
      const igFromTags = tags.filter((t) => t.tag_type === 'Item Group').map((t) => t.name);
      const prFromTags = tags.filter((t) => t.tag_type === 'Process').map((t) => t.name);

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

      const igFromConfig = Object.keys(ITEM_GROUPS);
      const processLikeGroups = [
        'Marking', 'Honing', 'Drilling', 'Cutting', 'Turning',
        'Grinding', 'Milling', 'Boring', 'Threading', 'Assembly',
        'Packing', 'Inspection',
      ];

      const uniqueMachines  = [...new Set([...machineNames, ...mgFromTags, ...mgFromMachines])].filter(Boolean).sort();
      const uniqueItemTags  = [...new Set([...igFromTags, ...igFromMachines, ...igFromConfig])].filter(Boolean).sort();
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
      title: 'Delete Rule?',
      content: `Delete rule for "${rule.machine_group_tag} → ${rule.item_group_tag}"?`,
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

  // ─── Add / Edit sub-view ────────────────────────────────────────────────────
  if (subView === 'add' || subView === 'edit') {
    return (
      <AppLayout>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
            <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>Cycle Time Rules</Text>
            <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
            <Text style={{ color: '#6b7280', fontSize: 12 }}>{editingRule ? 'Edit' : 'Add New'}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setSubView('list')} style={{ padding: 0, color: '#6b7280' }} />
            <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
              {editingRule ? `Cycle Time Rules ${editingRule.id}` : 'Add New Cycle Time Rules'}
            </Title>
          </div>
        </div>

        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
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
        </Card>
      </AppLayout>
    );
  }

  // ─── Rules List ─────────────────────────────────────────────────────────────
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
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
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
          pagination={{ pageSize: 20, showTotal: (t) => `${t} rules`, style: { marginBottom: 0 } }}
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
                    <Button type="primary" size="small" onClick={handleOpenAdd} style={{ marginTop: 10 }}>
                      Add Your First Rule
                    </Button>
                  </>
                )}
              </div>
            ),
          }}
        />
      </Card>

      {/* Set Daily Targets Modal */}
      <Modal
        title={
          <Text style={{ fontWeight: 700, fontSize: 14 }}>
            Set Daily Targets for {targetRule?.machine_group_tag} : {targetRule?.item_group_tag} : {targetRule?.process || '—'}
          </Text>
        }
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
            <Button type="primary" htmlType="submit" loading={targetSaving} style={{ borderRadius: 8, fontWeight: 600 }}>
              Submit
            </Button>
          </div>
        </Form>
      </Modal>
    </AppLayout>
  );
};

export default CycleTimeRulesPage;
