import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, InputNumber,
  Select, Switch, Modal, message, Tooltip, Space, Card, Tag,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined,
  ArrowLeftOutlined, SearchOutlined, RightOutlined, BookOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { trainingTopicApi } from '../../../api/trainingTopic.api';
import AppLayout            from '../../../components/AppLayout';
import { useAuth }         from '../../../context/AuthContext';

const { Title, Text } = Typography;

const CATEGORY_OPTIONS = [
  { value: 'Machine', label: 'Machine' }, { value: 'Process', label: 'Process' },
  { value: 'Quality', label: 'Quality' }, { value: 'Safety',  label: 'Safety'  },
  { value: 'SOP',     label: 'SOP'     }, { value: 'Other',   label: 'Other'   },
];
const CATEGORY_COLORS = {
  Machine: 'blue', Process: 'purple', Quality: 'green',
  Safety: 'red', SOP: 'orange', Other: 'default',
};
const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY') : '—');

// ── LIST VIEW ────────────────────────────────────────────────────────────────
const ListView = ({ topics, loading, onRefresh, onNew, onEdit, onDelete, canWrite, search, setSearch }) => {
  const base = [
    { title: 'Name', dataIndex: 'name', key: 'name',
      render: (v) => <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13 }}>{v}</Text> },
    { title: 'Category', dataIndex: 'category', key: 'category', width: 120,
      render: (v) => <Tag color={CATEGORY_COLORS[v] || 'default'}>{v}</Tag> },
    { title: 'Validity', dataIndex: 'validity_months', key: 'validity_months', width: 110,
      render: (v) => <Text style={{ fontSize: 13 }}>{v} months</Text> },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</Text> },
    { title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 80, align: 'center',
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 120,
      render: (v) => <Text style={{ fontSize: 12, color: '#9ca3af' }}>{fmtDate(v)}</Text> },
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

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: topics.length, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Active', value: topics.filter((t) => t.is_active).length, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Inactive', value: topics.filter((t) => !t.is_active).length, color: '#9ca3af', bg: '#f9fafb' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '8px 16px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{s.value}</Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>
      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input placeholder="Search topics…" prefix={<SearchOutlined style={{ color: '#9ca3af' }} />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240, borderRadius: 8 }} allowClear />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>Refresh</Button>
          {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={onNew} style={{ borderRadius: 8, fontWeight: 600 }}>Add Topic</Button>}
        </div>
        <Table rowKey="id" columns={columns} dataSource={topics} loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} topics` }}
          scroll={{ x: 800 }} size="middle"
          locale={{ emptyText: (<div style={{ padding: 40, textAlign: 'center' }}><BookOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} /><Text style={{ color: '#9ca3af' }}>No training topics yet</Text></div>) }}
        />
      </Card>
    </div>
  );
};

// ── FORM VIEW ────────────────────────────────────────────────────────────────
const TopicFormView = ({ topic, onBack, onSaved }) => {
  const isEdit = !!topic;
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) form.setFieldsValue({ name: topic.name, category: topic.category, validity_months: topic.validity_months, description: topic.description, is_active: topic.is_active });
  }, [topic, form, isEdit]);

  const handleSubmit = async () => {
    let values; try { values = await form.validateFields(); } catch { return; }
    setSaving(true);
    try {
      if (isEdit) { await trainingTopicApi.update(topic.id, values); message.success('Topic updated'); }
      else        { await trainingTopicApi.create(values);           message.success('Topic created'); }
      form.resetFields(); onSaved();
    } catch (err) { message.error(err?.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ color: '#374151', paddingLeft: 0 }} />
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>{isEdit ? `Edit — ${topic.name}` : 'Add Training Topic'}</Title>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Form form={form} layout="vertical" requiredMark={false} size="large" initialValues={{ validity_months: 12, is_active: true, category: 'Other' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            <Form.Item name="name" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Name *</span>} rules={[{ required: true, message: 'Name is required' }]}>
              <Input placeholder="e.g. CNC Machine Operation" />
            </Form.Item>
            <Form.Item name="category" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Category *</span>} rules={[{ required: true, message: 'Category is required' }]}>
              <Select options={CATEGORY_OPTIONS} placeholder="Select category" />
            </Form.Item>
            <Form.Item name="validity_months" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Validity (Months) *</span>} rules={[{ required: true }]}>
              <InputNumber min={1} max={120} addonAfter="months" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="is_active" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Active</span>} valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </div>
          <Form.Item name="description" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Description</span>}>
            <Input.TextArea rows={3} placeholder="Optional description…" />
          </Form.Item>
          <div>
            <Button type="primary" loading={saving} onClick={handleSubmit} style={{ borderRadius: 8, fontWeight: 600, paddingInline: 28 }}>{isEdit ? 'Save Changes' : 'Create Topic'}</Button>
            <Button onClick={onBack} style={{ marginLeft: 12, borderRadius: 8 }}>Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
const TrainingTopicsPage = () => {
  const { user } = useAuth();
  const canWrite = ['hr_admin', 'it_admin', 'plant_head'].includes(user?.role?.name);
  const [topics, setTopics]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [view, setView]               = useState('list');
  const [editingTopic, setEditingTopic] = useState(null);
  const [search, setSearch]           = useState('');

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try { const res = await trainingTopicApi.getAll(); setTopics(res?.data ?? res ?? []); }
    catch (err) { message.error(err?.message || 'Failed to load topics'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const handleDelete = (r) => Modal.confirm({
    title: `Delete "${r.name}"?`, content: 'This action cannot be undone.', okText: 'Delete', okType: 'danger',
    onOk: async () => { try { await trainingTopicApi.delete(r.id); message.success('Deleted'); fetchTopics(); } catch (err) { message.error(err?.response?.data?.message || 'Failed'); } },
  });

  const filtered = search ? topics.filter((t) => t.name?.toLowerCase().includes(search.toLowerCase())) : topics;

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>HR &amp; Training</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Training Topics</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Training Topics</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Define training subjects, validity periods and categories</Text>
      </div>
      {view === 'list' ? (
        <ListView topics={filtered} loading={loading} onRefresh={fetchTopics}
          onNew={() => { setEditingTopic(null); setView('form'); }}
          onEdit={(r) => { setEditingTopic(r); setView('form'); }}
          onDelete={handleDelete} canWrite={canWrite} search={search} setSearch={setSearch}
        />
      ) : (
        <TopicFormView topic={editingTopic}
          onBack={() => { setView('list'); setEditingTopic(null); }}
          onSaved={() => { setView('list'); setEditingTopic(null); fetchTopics(); }}
        />
      )}
    </AppLayout>
  );
};

export default TrainingTopicsPage;
