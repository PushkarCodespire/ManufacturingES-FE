import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Card, Modal,
  message, Tooltip, Tag, Radio,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, ArrowLeftOutlined,
  SearchOutlined, RightOutlined, EyeOutlined,
  ExclamationCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ctqIssueApi } from '../../../api/ctqIssue.api';
import { tagApi } from '../../../api/tag.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// ─── Same options as Downtime ─────────────────────────────────────────────────
const DEPARTMENT_OPTIONS = [
  { label: 'Production', value: 'Production' },
  { label: 'Planning',   value: 'Planning' },
  { label: 'Process',    value: 'Process' },
  { label: 'Quality',    value: 'Quality' },
  { label: 'Admin',      value: 'Admin' },
  { label: 'Store',      value: 'Store' },
  { label: 'Purchase',   value: 'Purchase' },
  { label: 'Sales',      value: 'Sales' },
];

const SEVERITY_OPTIONS = [
  { label: 'Low',      value: 'Low' },
  { label: 'Medium',   value: 'Medium' },
  { label: 'High',     value: 'High' },
  { label: 'Critical', value: 'Critical' },
];

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({
  issues, loading, search, onSearchChange, onRefresh,
  onNew, onDetail, onDelete, canWrite,
}) => {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 220,
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
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 130,
      filters: DEPARTMENT_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (val, r) => r.department === val,
      render: (val) => <Text style={{ fontSize: 12, color: '#374151' }}>{val || '—'}</Text>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      filters: SEVERITY_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (val, r) => r.severity === val,
      render: (val) => <Text style={{ fontSize: 12, color: '#374151' }}>{val || '—'}</Text>,
    },
    {
      title: 'Tags',
      key: 'tags',
      width: 220,
      render: (_, r) => {
        const tags = r.tags || [];
        if (!tags.length) return <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>;
        const display = tags.join(', ');
        return display.length > 45
          ? <Tooltip title={display}>
              <Text style={{ fontSize: 12, color: '#374151' }}>{display.slice(0, 42)}…</Text>
            </Tooltip>
          : <Text style={{ fontSize: 12, color: '#374151' }}>{display}</Text>;
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
      render: (_, r) => (
        canWrite
          ? <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(r)} />
            </Tooltip>
          : <Tooltip title="View">
              <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => onDetail(r)} />
            </Tooltip>
      ),
    },
  ];

  return (
    <>
      {/* ── Breadcrumb + Title ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Critical To Quality</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Quality</Title>
          <Text style={{ color: '#9ca3af', fontSize: 18 }}>|</Text>
          <Title level={4} style={{ margin: 0, color: '#374151', fontWeight: 400 }}>Critical To Quality</Title>
        </div>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage critical-to-quality issue codes for production quality tracking
        </Text>
      </div>

      {/* ── Card + Toolbar + Table ─────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search CTQ issues…"
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
          dataSource={issues}
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (t) => `${t} issues`,
            style: { marginBottom: 0 },
          }}
          scroll={{ x: 1100 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <ExclamationCircleOutlined style={{ fontSize: 32, color: '#d1d5db', marginBottom: 8 }} />
                <div style={{ color: '#9ca3af', fontSize: 13 }}>No CTQ issues found</div>
              </div>
            ),
          }}
        />
      </Card>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT / VIEW FORM — matches reference UI
// ══════════════════════════════════════════════════════════════════════════════
const FormView = ({ issue, onBack, onSaved, canWrite }) => {
  const [form] = Form.useForm();
  const [saving, setSaving]               = useState(false);
  const [allTags, setAllTags]             = useState([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const isEdit     = !!issue;
  const isReadOnly = !canWrite;

  // Load Item Group tags
  useEffect(() => {
    tagApi.getAll({ tag_type: 'Item Group' })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setAllTags(list);
      })
      .catch(() => {});
  }, []);

  // Pre-fill form for edit
  useEffect(() => {
    if (issue) {
      form.setFieldsValue({
        name:       issue.name,
        tags:       issue.tags || [],
        department: issue.department,
        severity:   issue.severity,
        planned:    issue.category === 'Planned' ? 'yes' : 'no',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ planned: 'no', department: 'Production', severity: 'Low' });
    }
  }, [issue, form]);

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        name:       values.name,
        tags:       values.tags || [],
        department: values.department,
        severity:   values.severity,
        category:   values.planned === 'yes' ? 'Planned' : 'Unplanned',
      };
      if (isEdit) {
        await ctqIssueApi.update(issue.id, payload);
        message.success('CTQ issue updated');
      } else {
        await ctqIssueApi.create(payload);
        message.success('CTQ issue created');
      }
      onSaved();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const selectedTags = Form.useWatch('tags', form) || [];

  return (
    <div style={{ maxWidth: 780 }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined style={{ fontSize: 16, color: '#374151' }} />}
            onClick={onBack}
            style={{ padding: '4px 6px', borderRadius: 6 }}
          />
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
            {isEdit ? issue.name : 'Add New Issues'}
          </Title>
        </div>
        {isEdit && (
          <ClockCircleOutlined style={{ fontSize: 18, color: '#9ca3af' }} />
        )}
      </div>

      {/* ── Form ───────────────────────────────────────────────────────── */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ planned: 'no', department: 'Production', severity: 'Low' }}
        disabled={isReadOnly}
      >
        {/* Labels (Name) — only on Add */}
        {!isEdit && (
          <Form.Item
            label={<Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Labels</Text>}
            name="name"
            rules={[{ required: true, message: 'Name is required' }]}
            style={{ marginBottom: 20 }}
          >
            <Input
              placeholder="Type and press Enter to add multiple labels"
              style={{ borderRadius: 6, fontSize: 13 }}
            />
          </Form.Item>
        )}

        {/* Tags section */}
        <Form.Item name="tags" noStyle><></></Form.Item>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Tags</Text>
            {!isReadOnly && (
              <Text
                style={{ fontSize: 13, color: '#1d4ed8', cursor: 'pointer', fontWeight: 500 }}
                onClick={() => setTagPickerOpen(true)}
              >
                Edit
              </Text>
            )}
          </div>

          {selectedTags.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 0' }}>
              {selectedTags.map((tag) => (
                <Tag
                  key={tag}
                  style={{
                    borderRadius: 4,
                    padding: '3px 10px',
                    fontSize: 12,
                    background: '#f0f4ff',
                    border: '1px solid #dbeafe',
                    color: '#1e40af',
                  }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          ) : (
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>
              No attached Item Group tags
            </Text>
          )}
        </div>

        {/* Tag picker modal */}
        <Modal
          title="Select Item Group Tags"
          open={tagPickerOpen}
          onCancel={() => setTagPickerOpen(false)}
          footer={[
            <Button key="done" type="primary" onClick={() => setTagPickerOpen(false)} style={{ borderRadius: 6 }}>
              Done
            </Button>,
          ]}
          width={480}
        >
          <Select
            mode="multiple"
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Search and select Item Group tags…"
            value={selectedTags}
            onChange={(vals) => form.setFieldValue('tags', vals)}
            options={allTags.map((t) => ({ label: t.name, value: t.name }))}
            showSearch
            filterOption={(input, opt) =>
              (opt?.label || '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Modal>

        {/* Department + Severity */}
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            label={<Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Department</Text>}
            name="department"
            style={{ flex: 1, marginBottom: 16 }}
          >
            <Select
              options={DEPARTMENT_OPTIONS}
              placeholder="Production"
              showSearch
              filterOption={(input, opt) =>
                (opt?.label || '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label={<Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Severity</Text>}
            name="severity"
            style={{ flex: 1, marginBottom: 16 }}
          >
            <Select options={SEVERITY_OPTIONS} placeholder="Low" />
          </Form.Item>
        </div>

        {/* Planned — radio Yes / No */}
        <Form.Item
          label={<Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Planned</Text>}
          name="planned"
          style={{ marginBottom: 24 }}
        >
          <Radio.Group>
            <Radio value="yes">Yes</Radio>
            <Radio value="no">No</Radio>
          </Radio.Group>
        </Form.Item>

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
                <Text style={{ fontSize: 12, fontWeight: 500 }}>{issue.Creator?.name || '—'}</Text>
                <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>{fmtDateTime(issue.createdAt)}</Text>
              </div>
              <div>
                <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block' }}>Last Updated By</Text>
                <Text style={{ fontSize: 12, fontWeight: 500 }}>{issue.Updater?.name || '—'}</Text>
                <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>{fmtDateTime(issue.updatedAt)}</Text>
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
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE CONTAINER
// ══════════════════════════════════════════════════════════════════════════════
const CTQPage = () => {
  const { can } = usePermissions();
  const canWrite = can('production-quality-create_edit_delete');

  const [view, setView]                   = useState('list');
  const [issues, setIssues]               = useState([]);
  const [loading, setLoading]             = useState(false);
  const [search, setSearch]               = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ctqIssueApi.getAll();
      setIssues(Array.isArray(data) ? data : data?.data || []);
    } catch {
      message.error('Failed to load CTQ issues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const filtered = useMemo(() => {
    if (!search.trim()) return issues;
    const q = search.toLowerCase();
    return issues.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.severity?.toLowerCase().includes(q) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [issues, search]);

  const handleNew    = () => { setSelectedIssue(null); setView('add'); };
  const handleDetail = (r) => { setSelectedIssue(r);   setView('detail'); };
  const handleBack   = () => { setSelectedIssue(null); setView('list'); };
  const handleSaved  = () => { handleBack(); fetchIssues(); };

  const handleDelete = (issue) => {
    Modal.confirm({
      title:      'Delete CTQ Issue',
      content:    `Are you sure you want to delete "${issue.name}"?`,
      okText:     'Delete',
      okType:     'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await ctqIssueApi.delete(issue.id);
          message.success('CTQ issue deleted');
          fetchIssues();
        } catch {
          message.error('Failed to delete');
        }
      },
    });
  };

  const renderContent = () => {
    if (view === 'add' || view === 'detail') {
      return (
        <FormView
          issue={view === 'detail' ? selectedIssue : null}
          onBack={handleBack}
          onSaved={handleSaved}
          canWrite={canWrite}
        />
      );
    }
    return (
      <ListView
        issues={filtered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onRefresh={fetchIssues}
        onNew={handleNew}
        onDetail={handleDetail}
        onDelete={handleDelete}
        canWrite={canWrite}
      />
    );
  };

  return <AppLayout>{renderContent()}</AppLayout>;
};

export default CTQPage;
