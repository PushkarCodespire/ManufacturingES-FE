import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, InputNumber,
  Select, DatePicker, Modal, message, Tooltip, Space, Card, Tag,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined,
  ArrowLeftOutlined, SearchOutlined, RightOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { trainingRecordApi }  from '../../../api/trainingRecord.api';
import { trainingTopicApi }   from '../../../api/trainingTopic.api';
import AppLayout              from '../../../components/AppLayout';
import { useAuth }           from '../../../context/AuthContext';
import api                    from '../../../api/axios';

const { Title, Text } = Typography;

const STATUS_COLORS  = { active: 'green', expiring_soon: 'orange', expired: 'red' };
const STATUS_LABELS  = { active: 'Active', expiring_soon: 'Expiring Soon', expired: 'Expired' };
const EVAL_COLORS    = { pending: 'default', effective: 'green', partially_effective: 'orange', not_effective: 'red' };

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY') : '—');

// ── LIST VIEW ────────────────────────────────────────────────────────────────
const ListView = ({ records, loading, onRefresh, onNew, onEdit, onDelete, canWrite, filters, setFilters, employees, topics }) => {
  const base = [
    {
      title: 'Employee', key: 'employee', width: 160,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 13, fontWeight: 600, color: '#111827', display: 'block' }}>
            {r.Employee?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{r.Employee?.employee_id}</Text>
        </div>
      ),
    },
    {
      title: 'Topic', key: 'topic', width: 160,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>{r.Topic?.name || '—'}</Text>
          <Tag color={r.Topic?.category === 'Safety' ? 'red' : 'blue'} style={{ fontSize: 10, marginTop: 2 }}>
            {r.Topic?.category}
          </Tag>
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
              const color = ev ? (EVAL_COLORS[ev.result] || 'default') : '#e5e7eb';
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
        <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined style={{ color: '#1d4ed8' }} />} onClick={() => onEdit(r)} /></Tooltip>
        <Tooltip title="Delete"><Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => onDelete(r)} /></Tooltip>
      </Space>
    ),
  }] : base;

  const statusOpts = [
    { value: 'active', label: 'Active' },
    { value: 'expiring_soon', label: 'Expiring Soon' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <div>
      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: records.length, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Active', value: records.filter((r) => r.status === 'active').length, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Expiring', value: records.filter((r) => r.status === 'expiring_soon').length, color: '#d97706', bg: '#fffbeb' },
          { label: 'Expired', value: records.filter((r) => r.status === 'expired').length, color: '#dc2626', bg: '#fef2f2' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '8px 16px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{s.value}</Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search employee or topic…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            style={{ width: 220, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by employee"
            allowClear
            showSearch
            filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
            options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employee_id})` }))}
            onChange={(v) => setFilters((f) => ({ ...f, employee_id: v }))}
            style={{ width: 200, borderRadius: 8 }}
          />
          <Select
            placeholder="Filter by topic"
            allowClear
            showSearch
            filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
            options={topics.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => setFilters((f) => ({ ...f, topic_id: v }))}
            style={{ width: 180, borderRadius: 8 }}
          />
          <Select
            placeholder="Status"
            allowClear
            options={statusOpts}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            style={{ width: 150, borderRadius: 8 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onNew} style={{ borderRadius: 8, fontWeight: 600 }}>
              Add Record
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={records}
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          scroll={{ x: 900 }}
          size="middle"
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <FileTextOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No training records yet</Text>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

// ── FORM VIEW ────────────────────────────────────────────────────────────────
const RecordFormView = ({ record, onBack, onSaved, employees, topics }) => {
  const isEdit = !!record;
  const [form] = Form.useForm();
  const [saving, setSaving]     = useState(false);
  const [expiry, setExpiry]     = useState(null);
  const [selTopic, setSelTopic] = useState(null);

  useEffect(() => {
    if (isEdit) {
      const t = topics.find((t) => t.id === record.topic_id);
      setSelTopic(t);
      form.setFieldsValue({
        employee_id:      record.employee_id,
        topic_id:         record.topic_id,
        training_date:    record.training_date ? dayjs(record.training_date) : null,
        trainer_name:     record.trainer_name,
        trainer_id:       record.trainer_id,
        score:            record.score,
        validity_months:  record.validity_months,
        notes:            record.notes,
      });
      if (record.expiry_date) setExpiry(fmtDate(record.expiry_date));
    }
  }, [record, form, isEdit, topics]);

  const recalcExpiry = (date, months) => {
    if (date && months) {
      const d = dayjs(date).add(months, 'month');
      setExpiry(d.format('DD MMM YYYY'));
    } else {
      setExpiry(null);
    }
  };

  const handleTopicChange = (topicId) => {
    const t = topics.find((x) => x.id === topicId);
    setSelTopic(t);
    if (t) {
      form.setFieldValue('validity_months', t.validity_months);
      const date = form.getFieldValue('training_date');
      recalcExpiry(date, t.validity_months);
    }
  };

  const handleDateChange = (date) => {
    const months = form.getFieldValue('validity_months');
    recalcExpiry(date, months);
  };

  const handleValidityChange = (months) => {
    const date = form.getFieldValue('training_date');
    recalcExpiry(date, months);
  };

  const handleSubmit = async () => {
    let values; try { values = await form.validateFields(); } catch { return; }
    // Format date
    if (values.training_date) values.training_date = values.training_date.format('YYYY-MM-DD');
    setSaving(true);
    try {
      if (isEdit) { await trainingRecordApi.update(record.id, values); message.success('Record updated'); }
      else        { await trainingRecordApi.create(values);            message.success('Record created'); }
      form.resetFields(); onSaved();
    } catch (err) { message.error(err?.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ color: '#374151', paddingLeft: 0 }} />
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          {isEdit ? `Edit Record` : 'Add Training Record'}
        </Title>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Form form={form} layout="vertical" requiredMark={false} size="large" initialValues={{ validity_months: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>

            <Form.Item name="employee_id" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Employee *</span>} rules={[{ required: true, message: 'Required' }]}>
              <Select
                showSearch
                placeholder="Select employee"
                filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employee_id})` }))}
              />
            </Form.Item>

            <Form.Item name="topic_id" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Training Topic *</span>} rules={[{ required: true, message: 'Required' }]}>
              <Select
                showSearch
                placeholder="Select topic"
                filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                options={topics.map((t) => ({ value: t.id, label: `${t.name} (${t.category})` }))}
                onChange={handleTopicChange}
              />
            </Form.Item>

            <Form.Item name="training_date" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Training Date *</span>} rules={[{ required: true, message: 'Required' }]}>
              <DatePicker style={{ width: '100%' }} onChange={handleDateChange} />
            </Form.Item>

            <Form.Item name="validity_months" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Validity (Months)</span>}>
              <InputNumber min={1} max={120} addonAfter="months" style={{ width: '100%' }} onChange={handleValidityChange} />
            </Form.Item>

            {expiry && (
              <Form.Item label={<span style={{ fontWeight: 500, fontSize: 13 }}>Computed Expiry</span>}>
                <div style={{ padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, color: '#374151' }}>
                  {expiry}
                </div>
              </Form.Item>
            )}

            <Form.Item name="trainer_name" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Trainer Name</span>}>
              <Input placeholder="External trainer name" />
            </Form.Item>

            <Form.Item name="trainer_id" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Internal Trainer</span>}>
              <Select
                showSearch
                allowClear
                placeholder="Select internal trainer"
                filterOption={(inp, opt) => (opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
                options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employee_id})` }))}
              />
            </Form.Item>

            <Form.Item name="score" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Score (0–100)</span>}>
              <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="notes" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Notes</span>}>
            <Input.TextArea rows={3} placeholder="Optional notes…" />
          </Form.Item>

          <div>
            <Button type="primary" loading={saving} onClick={handleSubmit} style={{ borderRadius: 8, fontWeight: 600, paddingInline: 28 }}>
              {isEdit ? 'Save Changes' : 'Create Record'}
            </Button>
            <Button onClick={onBack} style={{ marginLeft: 12, borderRadius: 8 }}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
const TrainingRecordsPage = () => {
  const { user } = useAuth();
  const canWrite = ['hr_admin', 'it_admin', 'plant_head'].includes(user?.role?.name);

  const [records,  setRecords]  = useState([]);
  const [employees, setEmployees] = useState([]);
  const [topics,   setTopics]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [view,     setView]     = useState('list');
  const [editing,  setEditing]  = useState(null);
  const [filters,  setFilters]  = useState({ search: '', employee_id: null, topic_id: null, status: null });

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
    } catch { message.error('Failed to load records'); }
    finally { setLoading(false); }
  }, [filters.employee_id, filters.topic_id, filters.status]);

  useEffect(() => { fetchBase(); }, [fetchBase]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleDelete = (r) => Modal.confirm({
    title: `Delete this training record?`,
    content: `${r.Employee?.name} — ${r.Topic?.name}. This cannot be undone.`,
    okText: 'Delete', okType: 'danger',
    onOk: async () => {
      try { await trainingRecordApi.delete(r.id); message.success('Deleted'); fetchRecords(); }
      catch (err) { message.error(err?.response?.data?.message || 'Failed'); }
    },
  });

  const filtered = filters.search
    ? records.filter((r) =>
        r.Employee?.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.Topic?.name?.toLowerCase().includes(filters.search.toLowerCase()),
      )
    : records;

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>HR &amp; Training</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Training Records</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Training Records</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Log and manage employee training completions</Text>
      </div>

      {view === 'list' ? (
        <ListView
          records={filtered}
          loading={loading}
          onRefresh={fetchRecords}
          onNew={() => { setEditing(null); setView('form'); }}
          onEdit={(r) => { setEditing(r); setView('form'); }}
          onDelete={handleDelete}
          canWrite={canWrite}
          filters={filters}
          setFilters={setFilters}
          employees={employees}
          topics={topics}
        />
      ) : (
        <RecordFormView
          record={editing}
          onBack={() => { setView('list'); setEditing(null); }}
          onSaved={() => { setView('list'); setEditing(null); fetchRecords(); }}
          employees={employees}
          topics={topics}
        />
      )}
    </AppLayout>
  );
};

export default TrainingRecordsPage;
