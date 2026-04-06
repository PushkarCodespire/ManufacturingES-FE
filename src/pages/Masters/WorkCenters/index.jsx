import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import {
  Typography, Card, Table, Button, Input, Tag, Space, Tooltip,
  Drawer, Form, Select, message, Popconfirm, InputNumber, Switch,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  SearchOutlined, RightOutlined,
  DownloadOutlined, UploadOutlined,
} from '@ant-design/icons';
import { workCenterApi } from '../../../api/workCenter.api';
import CsvUploadModal from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const TYPE_COLORS = {
  machining: 'blue', assembly: 'green', welding: 'orange',
  inspection: 'purple', painting: 'cyan', other: 'default',
};
const TYPE_LABELS = {
  machining: 'Machining', assembly: 'Assembly', welding: 'Welding',
  inspection: 'Inspection', painting: 'Painting', other: 'Other',
};

// ── CSV Upload config ────────────────────────────────────────────────────────
const WC_CSV_HEADERS = [
  'Name', 'Code', 'Type', 'Department', 'Capacity Per Shift', 'Capacity UOM', 'Description',
];

const WC_CSV_SAMPLE = [
  {
    'Name': 'CNC Bay 1',
    'Code': '',
    'Type': 'machining',
    'Department': 'Production',
    'Capacity Per Shift': '100',
    'Capacity UOM': 'pcs',
    'Description': 'CNC machining center bay 1',
  },
  {
    'Name': 'Assembly Line A',
    'Code': '',
    'Type': 'assembly',
    'Department': 'Production',
    'Capacity Per Shift': '50',
    'Capacity UOM': 'pcs',
    'Description': 'Manual assembly line',
  },
];

const WC_CSV_VALIDATION = [
  { field: 'Name', required: true },
  {
    field: 'Type',
    validate: (v) => {
      if (v && !['machining', 'assembly', 'welding', 'inspection', 'painting', 'other'].includes(v.toLowerCase())) {
        return '"Type" must be machining, assembly, welding, inspection, painting, or other';
      }
      return null;
    },
  },
  {
    field: 'Capacity Per Shift',
    validate: (v) => (v && isNaN(parseFloat(v)) ? '"Capacity Per Shift" must be a number' : null),
  },
];

export default function WorkCentersPage() {
  const { can } = usePermissions();
  const canWrite = can('production-work_centers-create_edit_delete');

  const [data,       setData]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const res = await workCenterApi.getAll(params);
      setData(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) {
      message.error(err?.message || 'Failed to load work centers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total  = data.length;
  const active = data.filter((r) => r.is_active).length;

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      name:               record.name,
      type:               record.type,
      department:         record.department,
      capacity_per_shift: record.capacity_per_shift,
      capacity_uom:       record.capacity_uom,
      description:        record.description,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      if (editing) {
        await workCenterApi.update(editing.id, vals);
        message.success('Work center updated');
      } else {
        await workCenterApi.create(vals);
        message.success('Work center created');
      }
      setDrawerOpen(false);
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await workCenterApi.remove(id);
      message.success('Work center deleted');
      fetchData();
    } catch (err) {
      message.error(err?.message || 'Delete failed');
    }
  };

  const handleToggle = async (record) => {
    try {
      await workCenterApi.toggleActive(record.id);
      message.success(`Work center ${record.is_active ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (err) {
      message.error(err?.message || 'Toggle failed');
    }
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        await workCenterApi.create({
          name: row['Name']?.trim(),
          type: row['Type']?.trim()?.toLowerCase() || undefined,
          department: row['Department']?.trim() || undefined,
          capacity_per_shift: row['Capacity Per Shift'] ? parseFloat(row['Capacity Per Shift']) : undefined,
          capacity_uom: row['Capacity UOM']?.trim() || undefined,
          description: row['Description']?.trim() || undefined,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row ${row._rowNum}: ${err.message}`);
      }
    }
    fetchData();
    return { success, failed, errors };
  };

  const columns = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 120,
      render: (v) => (
        <Text style={{ fontWeight: 600, fontFamily: 'monospace', color: '#1d4ed8' }}>{v}</Text>
      ),
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name', width: 180,
      render: (v) => <Text style={{ fontWeight: 500 }}>{v}</Text>,
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type', width: 120,
      render: (v) => (
        <Tag color={TYPE_COLORS[v] || 'default'}>{TYPE_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: 'Department', dataIndex: 'department', key: 'department', width: 140,
    },
    {
      title: 'Capacity/Shift', key: 'capacity', width: 140,
      render: (_, r) => (
        r.capacity_per_shift != null
          ? <Text>{r.capacity_per_shift} {r.capacity_uom || ''}</Text>
          : <Text type="secondary">—</Text>
      ),
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 160,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title={r.is_active ? 'Deactivate' : 'Activate'}>
            <Switch
              size="small"
              checked={r.is_active}
              onChange={() => handleToggle(r)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this work center?"
            onConfirm={() => handleDelete(r.id)}
            okText="Delete"
            okType="danger"
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Work Centers</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Work Centers</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Define production work centers — groups of machines with shared capacity and type.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Active: {active}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search work centers..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => downloadSampleCsv('work-centers.csv', WC_CSV_HEADERS, data.map((r) => ({ 'Name': r.name, 'Code': r.code, 'Type': r.type, 'Department': r.department, 'Capacity Per Shift': r.capacity_per_shift, 'Capacity UOM': r.capacity_uom, 'Description': r.description })))}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>}
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Add Work Center
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          size="small"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* Create / Edit Drawer */}
      <Drawer
        title={
          editing
            ? (
              <div>
                <div style={{ fontWeight: 600 }}>Edit Work Center</div>
                <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                  {editing.code}
                </div>
              </div>
            )
            : 'New Work Center'
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={handleSave}>
                {editing ? 'Update' : 'Create'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Enter work center name' }]}
          >
            <Input placeholder="e.g. CNC Bay 1" />
          </Form.Item>

          <Form.Item name="type" label="Type">
            <Select
              placeholder="Select type"
              options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              allowClear
            />
          </Form.Item>

          <Form.Item name="department" label="Department">
            <Select
              placeholder="Select department"
              options={[
                { value: 'Production',   label: 'Production'   },
                { value: 'Quality',      label: 'Quality'      },
                { value: 'Maintenance',  label: 'Maintenance'  },
                { value: 'Store',        label: 'Store'        },
                { value: 'Other',        label: 'Other'        },
              ]}
              allowClear
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="capacity_per_shift" label="Capacity / Shift">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
            <Form.Item name="capacity_uom" label="UOM">
              <Select
                placeholder="Select UOM"
                options={[
                  { value: 'pcs', label: 'pcs' },
                  { value: 'hrs', label: 'hrs' },
                ]}
                allowClear
              />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description..." />
          </Form.Item>
        </Form>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Work Centers"
        entityName="Work Center"
        sampleHeaders={WC_CSV_HEADERS}
        sampleRows={WC_CSV_SAMPLE}
        validationRules={WC_CSV_VALIDATION}
      />
    </AppLayout>
  );
}
