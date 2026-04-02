import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, InputNumber,
  Select, Switch, message, Tooltip, Space, Card, Tag, Drawer, Popconfirm,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined,
  SearchOutlined, RightOutlined, BookOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { trainingTopicApi } from '../../../api/trainingTopic.api';
import AppLayout            from '../../../components/AppLayout';
import usePermissions       from '../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal       from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

const { Title, Text } = Typography;

// ── CSV Upload config ────────────────────────────────────────────────────────
const TOPIC_CSV_HEADERS = ['Name', 'Category', 'Validity (Months)', 'Description', 'Active'];
const TOPIC_CSV_SAMPLE = [
  { 'Name': 'CNC Machine Operation', 'Category': 'Machine', 'Validity (Months)': '12', 'Description': 'Basic CNC operation training', 'Active': 'Yes' },
];
const TOPIC_VALIDATION_RULES = [
  { field: 'Name', required: true },
];

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

const TrainingTopicsPage = () => {
  const { can } = usePermissions();
  const canWrite = can('other-training_topics-create_edit_delete');

  const [topics,      setTopics]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [search,      setSearch]      = useState('');
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try { const res = await trainingTopicApi.getAll(); setTopics(res?.data ?? res ?? []); }
    catch (err) { message.error(err?.message || 'Failed to load topics'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const openDrawer = (record = null) => {
    setEditing(record);
    if (record) {
      form.setFieldsValue({ name: record.name, category: record.category, validity_months: record.validity_months, description: record.description, is_active: record.is_active });
    } else {
      form.setFieldsValue({ validity_months: 12, is_active: true, category: 'Other' });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); form.resetFields(); };

  const handleSave = async () => {
    let values; try { values = await form.validateFields(); } catch { return; }
    setSaving(true);
    try {
      if (editing) { await trainingTopicApi.update(editing.id, values); message.success('Topic updated'); }
      else         { await trainingTopicApi.create(values);              message.success('Topic created'); }
      closeDrawer();
      fetchTopics();
    } catch (err) { message.error(err?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (record) => {
    try { await trainingTopicApi.delete(record.id); message.success('Deleted'); fetchTopics(); }
    catch (err) { message.error(err?.message || 'Failed to delete'); }
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const activeVal = (row['Active'] || 'yes').toLowerCase();
        await trainingTopicApi.create({
          name: row['Name'],
          category: row['Category'] || 'Other',
          validity_months: row['Validity (Months)'] ? parseInt(row['Validity (Months)'], 10) : 12,
          description: row['Description'] || null,
          is_active: activeVal === 'yes' || activeVal === 'true' || activeVal === '1',
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Name']}": ${err?.message || 'Failed'}`);
      }
    }
    fetchTopics();
    return { success, failed, errors };
  };

  const filtered = search ? topics.filter((t) => t.name?.toLowerCase().includes(search.toLowerCase())) : topics;

  const total    = topics.length;
  const active   = topics.filter((t) => t.is_active).length;
  const inactive = topics.filter((t) => !t.is_active).length;

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
        <Tooltip title="Edit">
          <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1d4ed8' }} />} onClick={() => openDrawer(r)} />
        </Tooltip>
        <Popconfirm
          title={`Delete "${r.name}"?`}
          description="This action cannot be undone."
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
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Training Topics</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Training Topics</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Define training subjects, validity periods and categories.</Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
        {inactive > 0 && <Tag>Inactive: {inactive}</Tag>}
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input placeholder="Search topics…" prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240, borderRadius: 8 }} allowClear />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => {
            const csvRows = filtered.map((t) => ({
              'Name': t.name || '', 'Category': t.category || '',
              'Validity (Months)': t.validity_months ?? '', 'Description': t.description || '',
              'Active': t.is_active ? 'Yes' : 'No',
            }));
            downloadSampleCsv('training-topics.csv', TOPIC_CSV_HEADERS, csvRows);
          }}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>}
        <Button icon={<ReloadOutlined />} onClick={fetchTopics}>Refresh</Button>
          {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>Add Topic</Button>}
        </div>
        <Table rowKey="id" columns={columns} dataSource={filtered} loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} topics` }}
          scroll={{ x: 800 }} size="middle"
          locale={{ emptyText: (<div style={{ padding: 40, textAlign: 'center' }}><BookOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} /><Text style={{ color: '#9ca3af' }}>No training topics yet</Text></div>) }}
        />
      </Card>

      <Drawer
        title={editing ? `Edit — ${editing.name}` : 'Add Training Topic'}
        width={520}
        open={drawerOpen}
        onClose={closeDrawer}
        footer={
          canWrite ? (
            <Space>
              <Button type="primary" loading={saving} onClick={handleSave}>
                {editing ? 'Save Changes' : 'Create Topic'}
              </Button>
              <Button onClick={closeDrawer}>Cancel</Button>
            </Space>
          ) : null
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]} style={{ gridColumn: 'span 2' }}>
              <Input placeholder="e.g. CNC Machine Operation" />
            </Form.Item>
            <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Category is required' }]}>
              <Select options={CATEGORY_OPTIONS} placeholder="Select category" />
            </Form.Item>
            <Form.Item name="validity_months" label="Validity (Months)" rules={[{ required: true }]}>
              <InputNumber min={1} max={120} addonAfter="months" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="is_active" label="Active" valuePropName="checked" style={{ gridColumn: 'span 2' }}>
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description…" />
          </Form.Item>
        </Form>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Training Topics"
        entityName="Training Topic"
        sampleHeaders={TOPIC_CSV_HEADERS}
        sampleRows={TOPIC_CSV_SAMPLE}
        validationRules={TOPIC_VALIDATION_RULES}
      />
    </AppLayout>
  );
};

export default TrainingTopicsPage;
