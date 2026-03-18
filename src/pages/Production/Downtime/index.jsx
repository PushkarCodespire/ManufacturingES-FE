import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Card, Modal,
  message, Tooltip, Tag, Radio,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, ArrowLeftOutlined,
  SearchOutlined, RightOutlined, EyeOutlined,
  ExclamationCircleOutlined, ClockCircleOutlined, EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { downtimeReasonApi } from '../../../api/downtimeReason.api';
import { tagApi } from '../../../api/tag.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// ─── Dropdown options (from reference screenshots) ───────────────────────────
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

const TYPE_OF_FAULT_OPTIONS = [
  { label: 'Man',      value: 'Man' },
  { label: 'Machine',  value: 'Machine' },
  { label: 'Material', value: 'Material' },
  { label: 'Method',   value: 'Method' },
];

const NATURE_OF_FAULT_OPTIONS = [
  { label: 'Electrical',  value: 'Electrical' },
  { label: 'Mechanical',  value: 'Mechanical' },
  { label: 'Electronic',  value: 'Electronic' },
  { label: 'Chemical',    value: 'Chemical' },
];

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({
  reasons, loading, search, onSearchChange, onRefresh,
  onNew, onDetail, onDelete, canWrite,
}) => {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
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
      title: 'Type of Downtime',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      filters: [
        { text: 'Planned',   value: 'Planned' },
        { text: 'Unplanned', value: 'Unplanned' },
      ],
      onFilter: (val, r) => r.category === val,
      render: (val) => <Text style={{ fontSize: 12, color: '#374151' }}>{val || '—'}</Text>,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      filters: DEPARTMENT_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (val, r) => r.department === val,
      render: (val) => <Text style={{ fontSize: 12, color: '#374151' }}>{val || '—'}</Text>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      filters: SEVERITY_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (val, r) => r.severity === val,
      render: (val) => <Text style={{ fontSize: 12, color: '#374151' }}>{val || '—'}</Text>,
    },
    {
      title: 'Type of Fault',
      dataIndex: 'type_of_fault',
      key: 'type_of_fault',
      width: 120,
      filters: TYPE_OF_FAULT_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (val, r) => r.type_of_fault === val,
      render: (val) => <Text style={{ fontSize: 12, color: '#374151' }}>{val || '—'}</Text>,
    },
    {
      title: 'Nature of Fault',
      dataIndex: 'nature_of_fault',
      key: 'nature_of_fault',
      width: 130,
      filters: NATURE_OF_FAULT_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (val, r) => r.nature_of_fault === val,
      render: (val) => <Text style={{ fontSize: 12, color: '#374151' }}>{val || '—'}</Text>,
    },
    {
      title: 'Tags',
      key: 'tags',
      width: 200,
      render: (_, r) => {
        const allTags = r.tags || [];
        if (!allTags.length) return <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>;
        const display = allTags.join(', ');
        return display.length > 40
          ? <Tooltip title={display}>
              <Text style={{ fontSize: 12, color: '#374151' }}>{display.slice(0, 37)}…</Text>
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
        <div style={{ display: 'flex', gap: 8 }}>
          {canWrite
            ? <Tooltip title="Delete">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(r)} />
              </Tooltip>
            : <Tooltip title="View">
                <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => onDetail(r)} />
              </Tooltip>
          }
        </div>
      ),
    },
  ];

  return (
    <>
      {/* ── Breadcrumb + Title ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Downtime</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Downtime</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage downtime reason codes and categories for production tracking
        </Text>
      </div>

      {/* ── Card + Toolbar + Table ─────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search downtime reasons…"
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
              NEW
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={reasons}
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (t) => `${t} downtime reasons`,
            style: { marginBottom: 0 },
          }}
          scroll={{ x: 1400 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <ExclamationCircleOutlined style={{ fontSize: 32, color: '#d1d5db', marginBottom: 8 }} />
                <div style={{ color: '#9ca3af', fontSize: 13 }}>No downtime reasons found</div>
              </div>
            ),
          }}
        />
      </Card>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT / VIEW FORM — matches reference UI exactly
// ══════════════════════════════════════════════════════════════════════════════
const FormView = ({ reason, onBack, onSaved, canWrite }) => {
  const [form] = Form.useForm();
  const [saving, setSaving]           = useState(false);
  const [allTags, setAllTags]         = useState([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const isEdit     = !!reason;
  const isReadOnly = !canWrite;

  // Load all tags for the tag picker
  useEffect(() => {
    tagApi.getAll()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setAllTags(list);
      })
      .catch(() => {});
  }, []);

  // Pre-fill form when editing
  useEffect(() => {
    if (reason) {
      form.setFieldsValue({
        name:            reason.name,
        tags:            reason.tags || [],
        department:      reason.department,
        severity:        reason.severity,
        type_of_fault:   reason.type_of_fault,
        nature_of_fault: reason.nature_of_fault,
        planned:         reason.category === 'Planned' ? 'yes' : 'no',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ planned: 'no', department: 'Production', severity: 'Low' });
    }
  }, [reason, form]);

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        name:            values.name,
        tags:            values.tags || [],
        department:      values.department,
        severity:        values.severity,
        type_of_fault:   values.type_of_fault,
        nature_of_fault: values.nature_of_fault,
        category:        values.planned === 'yes' ? 'Planned' : 'Unplanned',
      };
      if (isEdit) {
        await downtimeReasonApi.update(reason.id, payload);
        message.success('Downtime reason updated');
      } else {
        await downtimeReasonApi.create(payload);
        message.success('Downtime reason created');
      }
      onSaved();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Tag chips rendered inside the Tags section
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
            {isEdit ? reason.name : 'Add New Issues'}
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
        {/* Labels (Name) ─ only shown on Add */}
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
        <Form.Item name="tags" style={{ marginBottom: 20 }} noStyle>
          <></>
        </Form.Item>
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

          {/* Tag chips display */}
          {selectedTags.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0' }}>
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
              Tag this Downtime to Machine to use this downtime
            </Text>
          )}
        </div>

        {/* Tag picker modal */}
        <Modal
          title="Select Tags"
          open={tagPickerOpen}
          onCancel={() => setTagPickerOpen(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setTagPickerOpen(false)} style={{ borderRadius: 6 }}>
              Done
            </Button>,
          ]}
          width={480}
        >
          <Select
            mode="multiple"
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Search and select tags…"
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
        <div style={{ display: 'flex', gap: 16, marginBottom: 0 }}>
          <Form.Item
            label={<Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Department</Text>}
            name="department"
            style={{ flex: 1, marginBottom: 16 }}
          >
            <Select
              options={DEPARTMENT_OPTIONS}
              placeholder="Production"
              style={{ borderRadius: 6 }}
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
            <Select options={SEVERITY_OPTIONS} placeholder="Low" style={{ borderRadius: 6 }} />
          </Form.Item>
        </div>

        {/* Type of Fault + Nature of Fault */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 0 }}>
          <Form.Item
            label={<Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Type of Fault</Text>}
            name="type_of_fault"
            style={{ flex: 1, marginBottom: 16 }}
          >
            <Select
              options={TYPE_OF_FAULT_OPTIONS}
              placeholder="Select…"
              style={{ borderRadius: 6 }}
              allowClear
              showSearch
              filterOption={(input, opt) =>
                (opt?.label || '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label={<Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Nature of Fault</Text>}
            name="nature_of_fault"
            style={{ flex: 1, marginBottom: 16 }}
          >
            <Select
              options={NATURE_OF_FAULT_OPTIONS}
              placeholder="Select…"
              style={{ borderRadius: 6 }}
              allowClear
              showSearch
              filterOption={(input, opt) =>
                (opt?.label || '').toLowerCase().includes(input.toLowerCase())
              }
            />
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

        {/* Submit / Edit button */}
        {!isReadOnly && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                background: '#1d4ed8',
                minWidth: 80,
              }}
            >
              {isEdit ? 'Edit' : 'Submit'}
            </Button>
          </div>
        )}
      </Form>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE CONTAINER
// ══════════════════════════════════════════════════════════════════════════════
const DowntimePage = () => {
  const { can } = usePermissions();
  const canWrite = can('production-downtime-create_edit_delete');

  const [view, setView]             = useState('list');
  const [reasons, setReasons]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [selectedReason, setSelectedReason] = useState(null);

  const fetchReasons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await downtimeReasonApi.getAll();
      setReasons(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      message.error(err?.message || 'Failed to load downtime reasons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReasons(); }, [fetchReasons]);

  const filtered = useMemo(() => {
    if (!search.trim()) return reasons;
    const q = search.toLowerCase();
    return reasons.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.severity?.toLowerCase().includes(q) ||
        r.type_of_fault?.toLowerCase().includes(q) ||
        r.nature_of_fault?.toLowerCase().includes(q) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [reasons, search]);

  const handleNew    = () => { setSelectedReason(null); setView('add'); };
  const handleDetail = (r) => { setSelectedReason(r); setView('detail'); };
  const handleBack   = () => { setSelectedReason(null); setView('list'); };
  const handleSaved  = () => { handleBack(); fetchReasons(); };

  const handleDelete = (reason) => {
    Modal.confirm({
      title:      'Delete Downtime Reason',
      content:    `Are you sure you want to delete "${reason.name}"?`,
      okText:     'Delete',
      okType:     'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await downtimeReasonApi.delete(reason.id);
          message.success('Downtime reason deleted');
          fetchReasons();
        } catch (err) {
          message.error(err?.message || 'Failed to delete');
        }
      },
    });
  };

  const renderContent = () => {
    if (view === 'add' || view === 'detail') {
      return (
        <FormView
          reason={view === 'detail' ? selectedReason : null}
          onBack={handleBack}
          onSaved={handleSaved}
          canWrite={canWrite}
        />
      );
    }
    return (
      <ListView
        reasons={filtered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onRefresh={fetchReasons}
        onNew={handleNew}
        onDetail={handleDetail}
        onDelete={handleDelete}
        canWrite={canWrite}
      />
    );
  };

  return <AppLayout>{renderContent()}</AppLayout>;
};

export default DowntimePage;
