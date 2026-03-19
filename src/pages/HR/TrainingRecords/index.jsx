import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, InputNumber,
  Select, DatePicker, message, Tooltip, Space, Card, Tag, Drawer, Popconfirm,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined,
  SearchOutlined, RightOutlined, FileTextOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { trainingRecordApi }  from '../../../api/trainingRecord.api';
import AppLayout              from '../../../components/AppLayout';
import usePermissions         from '../../../hooks/usePermissions';
import api                    from '../../../api/axios';
import aiApi                  from '../../../api/ai.api';
import useAiSuggestion        from '../../../hooks/useAiSuggestion';
import AiSuggestionCard       from '../../../components/AiSuggestion/AiSuggestionCard';

const { Title, Text } = Typography;

const parseInsight = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object' && !raw.raw_text) return raw;
  const text = raw.raw_text ?? raw;
  if (typeof text !== 'string') return raw;
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```[\s\S]*$/, '').trim();
  try { return JSON.parse(stripped); } catch {}
  try { return JSON.parse(text.trim()); } catch {}
  return null;
};

const COMPLIANCE_RISK_COLOR = { low: 'green', medium: 'orange', high: 'red', critical: 'red' };
const STATUS_COLORS  = { active: 'green', expiring_soon: 'orange', expired: 'red' };
const STATUS_LABELS  = { active: 'Active', expiring_soon: 'Expiring Soon', expired: 'Expired' };

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY') : '—');

const TrainingRecordsPage = () => {
  const { can } = usePermissions();
  const canWrite = can('other-training_records-create_edit_delete');

  const [records,    setRecords]    = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [topics,     setTopics]     = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [filters,    setFilters]    = useState({ search: '', employee_id: null, topic_id: null, status: null });
  const [expiry,     setExpiry]     = useState(null);
  const [form] = Form.useForm();

  const aiSkillGap = useAiSuggestion(aiApi.getSkillGapAnalysis);
  const [aiCardVisible, setAiCardVisible] = useState(false);
  const fetchSkillGap = () => { aiSkillGap.reset(); aiSkillGap.fetch(); };

  const fetchBase = useCallback(async () => {
    try {
      const [empRes, topRes] = await Promise.all([
        api.get('/users').then((r) => r.data),
        api.get('/hr/training-topics', { params: { is_active: true } }).then((r) => r.data),
      ]);
      setEmployees(empRes?.data ?? empRes ?? []);
      setTopics(topRes?.data ?? topRes ?? []);
    } catch { /* silent */ }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.employee_id) params.employee_id = filters.employee_id;
      if (filters.topic_id)    params.topic_id    = filters.topic_id;
      if (filters.status)      params.status      = filters.status;
      const res = await trainingRecordApi.getAll(params);
      setRecords(res?.data ?? res ?? []);
    } catch (err) { message.error(err?.message || 'Failed to load records'); }
    finally { setLoading(false); }
  }, [filters.employee_id, filters.topic_id, filters.status]);

  useEffect(() => { fetchBase(); }, [fetchBase]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const recalcExpiry = (date, months) => {
    if (date && months) setExpiry(dayjs(date).add(months, 'month').format('DD MMM YYYY'));
    else setExpiry(null);
  };

  const openDrawer = (record = null) => {
    setEditing(record);
    setExpiry(null);
    if (record) {
      form.setFieldsValue({
        employee_id:     record.employee_id,
        topic_id:        record.topic_id,
        training_date:   record.training_date ? dayjs(record.training_date) : null,
        trainer_name:    record.trainer_name,
        trainer_id:      record.trainer_id,
        score:           record.score,
        validity_months: record.validity_months,
        notes:           record.notes,
      });
      if (record.expiry_date) setExpiry(fmtDate(record.expiry_date));
    } else {
      form.setFieldsValue({ validity_months: 12 });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); setExpiry(null); form.resetFields(); };

  const handleTopicChange = (topicId) => {
    const t = topics.find((x) => x.id === topicId);
    if (t) {
      form.setFieldValue('validity_months', t.validity_months);
      const date = form.getFieldValue('training_date');
      recalcExpiry(date, t.validity_months);
    }
  };

  const handleSave = async () => {
    let values; try { values = await form.validateFields(); } catch { return; }
    if (values.training_date) values.training_date = values.training_date.format('YYYY-MM-DD');
    setSaving(true);
    try {
      if (editing) { await trainingRecordApi.update(editing.id, values); message.success('Record updated'); }
      else         { await trainingRecordApi.create(values);              message.success('Record created'); }
      closeDrawer();
      fetchRecords();
    } catch (err) { message.error(err?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (r) => {
    try { await trainingRecordApi.delete(r.id); message.success('Deleted'); fetchRecords(); }
    catch (err) { message.error(err?.message || 'Failed to delete'); }
  };

  const filtered = filters.search
    ? records.filter((r) =>
        r.Employee?.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.Topic?.name?.toLowerCase().includes(filters.search.toLowerCase()))
    : records;

  const total    = records.length;
  const active   = records.filter((r) => r.status === 'active').length;
  const expiring = records.filter((r) => r.status === 'expiring_soon').length;
  const expired  = records.filter((r) => r.status === 'expired').length;

  const base = [
    {
      title: 'Employee', key: 'employee', width: 160,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 13, fontWeight: 600, color: '#111827', display: 'block' }}>{r.Employee?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{r.Employee?.employee_id}</Text>
        </div>
      ),
    },
    {
      title: 'Topic', key: 'topic', width: 160,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>{r.Topic?.name || '—'}</Text>
          <Tag color={r.Topic?.category === 'Safety' ? 'red' : 'blue'} style={{ fontSize: 10, marginTop: 2 }}>{r.Topic?.category}</Tag>
        </div>
      ),
    },
    {
      title: 'Training Date', dataIndex: 'training_date', key: 'training_date', width: 130,
      render: (v) => <Text style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
    },
    {
      title: 'Expiry Date', dataIndex: 'expiry_date', key: 'expiry_date', width: 130,
      render: (v) => <Text style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: (v) => <Tag color={STATUS_COLORS[v] || 'default'}>{STATUS_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Effectiveness', key: 'effectiveness', width: 120, align: 'center',
      render: (_, r) => {
        const evals = r.Evaluations || [];
        const types = ['day_30', 'day_60', 'day_90'];
        return (
          <Space size={4}>
            {types.map((t) => {
              const ev = evals.find((e) => e.evaluation_type === t);
              const label = t === 'day_30' ? '30' : t === 'day_60' ? '60' : '90';
              return (
                <Tooltip key={t} title={`Day ${label}: ${ev ? ev.result?.replace('_', ' ') : 'pending'}`}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: ev?.result === 'effective' ? '#16a34a'
                      : ev?.result === 'partially_effective' ? '#d97706'
                      : ev?.result === 'not_effective' ? '#dc2626'
                      : ev?.result === 'pending' ? '#9ca3af' : '#e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 9, fontWeight: 700,
                  }}>
                    {label}
                  </div>
                </Tooltip>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: 'Trainer', dataIndex: 'trainer_name', key: 'trainer_name', width: 130,
      render: (v, r) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v || r.Trainer?.name || '—'}</Text>,
    },
  ];

  const columns = canWrite ? [...base, {
    title: 'Actions', key: 'actions', width: 90, align: 'center',
    render: (_, r) => (
      <Space size={4}>
        <Tooltip title="Edit">
          <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1d4ed8' }} />} onClick={() => openDrawer(r)} />
        </Tooltip>
        <Popconfirm
          title="Delete this training record?"
          description={`${r.Employee?.name} — ${r.Topic?.name}. This cannot be undone.`}
          okText="Delete" okType="danger"
          onConfirm={() => handleDelete(r)}
        >
          <Tooltip title="Delete">
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      </Space>
    ),
  }] : base;

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>HR &amp; Training</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Training Records</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Training Records</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Log and manage employee training completions.</Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
        <Tag color="orange">Expiring: {expiring}</Tag>
        <Tag color="red">Expired: {expired}</Tag>
      </div>

      {/* AI Skill Gap Panel */}
      {aiCardVisible && (
        <AiSuggestionCard
          title="AI Skill Gap Analysis"
          loading={aiSkillGap?.loading}
          error={aiSkillGap?.error}
          aiAvailable={aiSkillGap?.aiAvailable}
          cached={aiSkillGap?.cached}
          onRetry={fetchSkillGap}
          onDismiss={() => setAiCardVisible(false)}
          style={{ marginBottom: 20 }}
        >
          {(() => {
            const d = aiSkillGap?.data;
            const insight = parseInsight(d?.ai_insight);
            if (!insight) return null;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color={COMPLIANCE_RISK_COLOR[insight.compliance_risk] || 'default'} style={{ fontWeight: 600 }}>
                    Compliance Risk: {String(insight.compliance_risk || '—').toUpperCase()}
                  </Tag>
                  <Tag color="purple">Confidence: {insight.confidence || '—'}</Tag>
                </div>
                {insight.gap_summary && (
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {insight.gap_summary}
                  </div>
                )}
                {Array.isArray(insight.highest_priority_roles) && insight.highest_priority_roles.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>Highest Priority Roles</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {insight.highest_priority_roles.map((r, i) => <Tag key={i} color="red">{r}</Tag>)}
                    </div>
                  </div>
                )}
                {Array.isArray(insight.critical_topics_to_schedule) && insight.critical_topics_to_schedule.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>Critical Topics to Schedule</Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {insight.critical_topics_to_schedule.map((t, i) => <Tag key={i} color="orange">{t}</Tag>)}
                    </div>
                  </div>
                )}
                {Array.isArray(insight.immediate_actions) && insight.immediate_actions.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>Immediate Actions</Text>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#dc2626', fontSize: 13 }}>
                      {insight.immediate_actions.map((a, i) => <li key={i} style={{ marginBottom: 3 }}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(insight.recommended_training_calendar) && insight.recommended_training_calendar.length > 0 && (
                  <div>
                    <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>Recommended Training Calendar</Text>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#16a34a', fontSize: 13 }}>
                      {insight.recommended_training_calendar.map((c, i) => <li key={i} style={{ marginBottom: 3 }}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </AiSuggestionCard>
      )}

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search employee or topic…"
            prefix={<SearchOutlined />}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            style={{ width: 220, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by employee" allowClear showSearch
            filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
            options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employee_id})` }))}
            onChange={(v) => setFilters((f) => ({ ...f, employee_id: v }))}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by topic" allowClear showSearch
            filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
            options={topics.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => setFilters((f) => ({ ...f, topic_id: v }))}
            style={{ width: 180 }}
          />
          <Select
            placeholder="Status" allowClear
            options={[
              { value: 'active', label: 'Active' },
              { value: 'expiring_soon', label: 'Expiring Soon' },
              { value: 'expired', label: 'Expired' },
            ]}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            style={{ width: 150 }}
          />
          <div style={{ flex: 1 }} />
          {!aiCardVisible && (
            <Button
              icon={<BulbOutlined style={{ color: '#7c3aed' }} />}
              style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
              onClick={() => { setAiCardVisible(true); fetchSkillGap(); }}
            >
              AI Skill Gap
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchRecords}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>Add Record</Button>
          )}
        </div>

        <Table
          rowKey="id" columns={columns} dataSource={filtered} loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          scroll={{ x: 900 }} size="middle"
          locale={{ emptyText: (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <FileTextOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
              <Text style={{ color: '#9ca3af' }}>No training records yet</Text>
            </div>
          )}}
        />
      </Card>

      <Drawer
        title={editing ? 'Edit Training Record' : 'Add Training Record'}
        width={640}
        open={drawerOpen}
        onClose={closeDrawer}
        footer={
          canWrite ? (
            <Space>
              <Button type="primary" loading={saving} onClick={handleSave}>
                {editing ? 'Save Changes' : 'Create Record'}
              </Button>
              <Button onClick={closeDrawer}>Cancel</Button>
            </Space>
          ) : null
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="employee_id" label="Employee" rules={[{ required: true, message: 'Required' }]} style={{ gridColumn: 'span 2' }}>
              <Select showSearch placeholder="Select employee"
                filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employee_id})` }))} />
            </Form.Item>
            <Form.Item name="topic_id" label="Training Topic" rules={[{ required: true, message: 'Required' }]} style={{ gridColumn: 'span 2' }}>
              <Select showSearch placeholder="Select topic"
                filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                options={topics.map((t) => ({ value: t.id, label: `${t.name} (${t.category})` }))}
                onChange={handleTopicChange} />
            </Form.Item>
            <Form.Item name="training_date" label="Training Date" rules={[{ required: true, message: 'Required' }]}>
              <DatePicker style={{ width: '100%' }}
                onChange={(date) => {
                  const months = form.getFieldValue('validity_months');
                  recalcExpiry(date, months);
                }} />
            </Form.Item>
            <Form.Item name="validity_months" label="Validity (Months)">
              <InputNumber min={1} max={120} addonAfter="months" style={{ width: '100%' }}
                onChange={(months) => {
                  const date = form.getFieldValue('training_date');
                  recalcExpiry(date, months);
                }} />
            </Form.Item>
            {expiry && (
              <Form.Item label="Computed Expiry" style={{ gridColumn: 'span 2' }}>
                <div style={{ padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, color: '#374151' }}>
                  {expiry}
                </div>
              </Form.Item>
            )}
            <Form.Item name="trainer_name" label="Trainer Name">
              <Input placeholder="External trainer name" />
            </Form.Item>
            <Form.Item name="score" label="Score (0–100)">
              <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="trainer_id" label="Internal Trainer" style={{ gridColumn: 'span 2' }}>
              <Select showSearch allowClear placeholder="Select internal trainer"
                filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employee_id})` }))} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Optional notes…" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
};

export default TrainingRecordsPage;
