import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Button, Input, Table, Tag, Space, message,
  Drawer, Form, Select, InputNumber, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, RightOutlined,
  EditOutlined, DeleteOutlined,
DownloadOutlined, } from '@ant-design/icons';
import AppLayout      from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';
import usePermissions from '../../../hooks/usePermissions';
import { ncrApi }     from '../../../api/quality.api';
import { itemApi }    from '../../../api/item.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR  = { raised: 'orange', under_review: 'blue', dispositioned: 'purple', closed: 'green', cancelled: 'default' };
const NCR_TYPE_OPTS = [
  { value: 'dimensional',    label: 'Dimensional'    },
  { value: 'visual',         label: 'Visual'         },
  { value: 'material',       label: 'Material'       },
  { value: 'process',        label: 'Process'        },
  { value: 'documentation',  label: 'Documentation'  },
];
const LOCATION_OPTS = [
  { value: 'iqc',        label: 'IQC'        },
  { value: 'lqc',        label: 'LQC'        },
  { value: 'pqc',        label: 'PQC'        },
  { value: 'oqc',        label: 'OQC'        },
  { value: 'production', label: 'Production' },
  { value: 'store',      label: 'Store'      },
];

export default function NCRPage() {
  const { can }  = usePermissions();
  const canWrite = can('quality-ncr-create_edit_delete');
  const navigate = useNavigate();

  const [records,    setRecords]    = useState([]);
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [form]                      = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ncrApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) { message.error(err?.message || 'Failed to load NCR records'); }
    finally   { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] }))
      .then((r) => setItems(Array.isArray(r) ? r : (r?.data ?? [])));
  }, []);

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    // no default values needed
    setDrawerOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      ncr_type:      r.ncr_type,
      location_found:r.location_found,
      item_id:       r.item_id,
      defect_desc:   r.defect_desc,
      qty_affected:  parseFloat(r.qty_affected) || null,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = { ...vals };
      if (editing) {
        await ncrApi.update(editing.id, payload);
        message.success('NCR updated');
      } else {
        await ncrApi.create(payload);
        message.success('NCR raised');
      }
      setDrawerOpen(false);
      fetchAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await ncrApi.delete(id);
      message.success('NCR deleted');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const baseColumns = [
    { title: 'NCR No.',   dataIndex: 'ncr_no',            key: 'ncr_no',   width: 140 },
    { title: 'Type',      dataIndex: 'ncr_type',          key: 'type',     width: 90,
      render: (v) => <Tag color={{ process:'purple', material:'gold', product:'red', system:'cyan' }[v] ?? 'default'}>{v}</Tag> },
    { title: 'Location',  dataIndex: 'location_found',    key: 'location', width: 130,
      render: (v) => LOCATION_OPTS.find((o) => o.value === v)?.label ?? v },
    { title: 'Defect',    dataIndex: 'defect_desc',       key: 'defect',   ellipsis: true },
    { title: 'Raised By', key: 'raised_by', width: 130,
      render: (_, r) => r.RaisedBy?.name ?? '—' },
    { title: 'Qty Aff.',  dataIndex: 'qty_affected',      key: 'qty',      width: 90 },
    { title: 'Status',    dataIndex: 'status',            key: 'status',   width: 110,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Source', key: 'source', width: 100,
      render: (_, r) => r.complaint_id ? <Button size="small" type="link" onClick={() => navigate(`/quality/complaints/${r.complaint_id}`)}>Complaint</Button> : '—' },
    { title: 'CAPA', key: 'capa', width: 100,
      render: (_, r) => r.capa_id ? <Button size="small" type="link" onClick={() => navigate(`/quality/capa/${r.capa_id}`)}>View CAPA</Button> : '—' },
    { title: 'Date',      dataIndex: 'created_at',        key: 'date',     width: 110,
      render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
  ];

  const actionColumn = {
    title: 'Actions', key: 'actions', width: 110,
    render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Delete this NCR?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const openColumn = {
    title: '', key: 'open', width: 80,
    render: (_, r) => (
      <Button size="small" type="link" onClick={() => navigate(`/quality/ncr/${r.id}`)}>Open</Button>
    ),
  };
  const columns  = [...baseColumns, openColumn, ...(canWrite ? [actionColumn] : [])];
  const total    = records.length;
  const open     = records.filter((r) => r.status === 'raised' || r.status === 'under_review').length;
  const closed   = records.filter((r) => r.status === 'closed').length;
  const filtered = records.filter((r) =>
    !search ||
    r.ncr_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.defect_desc?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Internal NCR</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Internal NCR</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Track and manage Non-Conformance Reports raised internally.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Open: {open}</Tag>
        <Tag color="green">Closed: {closed}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search NCR no. or defect..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('n-c-r.csv', filtered, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Raise NCR</Button>
          )}
        </div>

        <ResponsiveTable
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* ── Create / Edit Drawer ───────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit NCR — ${editing.ncr_no}` : 'Raise Internal NCR'}
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              {editing ? 'Save Changes' : 'Raise NCR'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="ncr_type" label="NCR Type" rules={[{ required: true }]}>
              <Select options={NCR_TYPE_OPTS} placeholder="Select type" />
            </Form.Item>
            <Form.Item name="location_found" label="Location Found" rules={[{ required: true }]}>
              <Select options={LOCATION_OPTS} placeholder="Select location" />
            </Form.Item>
          </div>

          <Form.Item name="item_id" label="Related Item (optional)">
            <Select
              showSearch allowClear placeholder="Select item..."
              filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
              options={items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }))}
            />
          </Form.Item>

          <Form.Item name="defect_desc" label="Defect Description"
            rules={[{ required: true, min: 5, message: 'Min 5 characters' }]}>
            <TextArea rows={3} placeholder="Describe the defect..." />
          </Form.Item>

          <Form.Item name="qty_affected" label="Qty Affected">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
