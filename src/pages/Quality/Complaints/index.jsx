import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Card, Button, Input, Table, Tag, Space, message,
  Drawer, Form, Select, DatePicker, Popconfirm, Descriptions,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, RightOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { complaintApi } from '../../../api/quality.api';
import { vendorApi }    from '../../../api/vendor.api';
import { itemApi }      from '../../../api/item.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR = {
  received: 'orange', acknowledged: 'blue', investigating: 'purple',
  resolved: 'cyan',   closed: 'green',       rejected: 'red',
};


export default function ComplaintsPage() {
  const { can }  = usePermissions();
  const canWrite = can('quality-complaints-create_edit_delete');
  const navigate = useNavigate();

  const [records,          setRecords]          = useState([]);
  const [customers,        setCustomers]        = useState([]);
  const [items,            setItems]            = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [search,           setSearch]           = useState('');
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [editing,          setEditing]          = useState(null);
  const [saving,           setSaving]           = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form]                                  = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await complaintApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) { message.error(err?.message || 'Failed to load complaints'); }
    finally   { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    vendorApi.getAll({ type: 'customer', limit: 500 }).catch(() => [])
      .then((d) => setCustomers(Array.isArray(d) ? d : []));
    itemApi.getAll({ limit: 500, is_active: true })
      .then((res) => setItems(Array.isArray(res?.data) ? res.data : []))
      .catch(() => []);
  }, []);

  // ── Drawer helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setSelectedCustomer(null);
    setDrawerOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      customer_name:  r.customer_name,
      customer_ref:   r.customer_ref,
      item_id:        r.item_id,
      part_no_ext:    r.part_no_ext,
      qty_affected:   r.qty_affected,
      defect_desc:    r.defect_desc,
      delivery_date:  r.delivery_date ? dayjs(r.delivery_date) : null,
    });
    const c = customers.find((x) => x.name === r.customer_name);
    setSelectedCustomer(c || null);
    setDrawerOpen(true);
  };

  const onCustomerChange = (val) => {
    const c = customers.find((x) => x.name === val);
    setSelectedCustomer(c || null);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        ...vals,
        delivery_date: vals.delivery_date?.format('YYYY-MM-DD'),
      };
      if (editing) {
        await complaintApi.update(editing.id, payload);
        message.success('Complaint updated');
      } else {
        await complaintApi.create(payload);
        message.success('Complaint logged');
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
      await complaintApi.delete(id);
      message.success('Complaint deleted');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const baseColumns = [
    { title: 'No.',         dataIndex: 'complaint_no', key: 'no',     width: 145 },
    { title: 'Customer',    key: 'customer',           width: 140,
      render: (_, r) => r.customer_name ?? '—' },
    { title: 'Item',        key: 'item',               width: 130,
      render: (_, r) => r.Item ? `${r.Item.name} (${r.Item.code})` : '—' },
    { title: 'Description', dataIndex: 'defect_desc',  key: 'desc',   ellipsis: true, minWidth: 160 },
    { title: 'Status',      dataIndex: 'status',       key: 'status', width: 110,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'NCR',  key: 'ncr',  width: 85,
      render: (_, r) => r.ncr_id  ? <Button size="small" type="link" onClick={() => navigate(`/quality/ncr/${r.ncr_id}`)}>View</Button>  : '—' },
    { title: 'CAPA', key: 'capa', width: 85,
      render: (_, r) => r.capa_id ? <Button size="small" type="link" onClick={() => navigate(`/quality/capa/${r.capa_id}`)}>View</Button> : '—' },
    { title: 'Due',      dataIndex: 'response_due', key: 'due',  width: 100 },
    { title: 'Logged',   dataIndex: 'created_at',   key: 'date', width: 100,
      render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
  ];

  const actionColumn = {
    title: 'Actions', key: 'actions', width: 110,
    render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Delete this complaint?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  const openColumn = {
    title: '', key: 'open', width: 80,
    render: (_, r) => (
      <Button size="small" type="link" onClick={() => navigate(`/quality/complaints/${r.id}`)}>Open</Button>
    ),
  };
  const columns  = [...baseColumns, openColumn, ...(canWrite ? [actionColumn] : [])];
  const total    = records.length;
  const open     = records.filter((r) => !['closed', 'rejected'].includes(r.status)).length;
  const resolved = records.filter((r) => r.status === 'closed').length;
  const filtered = records.filter((r) =>
    !search ||
    r.complaint_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.defect_desc?.toLowerCase().includes(search.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Customer Complaints</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Customer Complaints</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Manage customer complaints, track resolutions and close the loop.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Open: {open}</Tag>
        <Tag color="green">Resolved: {resolved}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search complaint no. or description..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Log Complaint</Button>
          )}
        </div>

        <Table
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          loading={loading}
          size="small"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create / Edit Drawer ───────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit Complaint — ${editing.complaint_no}` : 'Log Customer Complaint'}
        width={520}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              {editing ? 'Save Changes' : 'Log Complaint'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="customer_name" label="Customer Name"
            rules={[{ required: true, message: 'Customer name is required' }]}>
            <Select
              showSearch
              allowClear
              placeholder="Select customer..."
              onChange={onCustomerChange}
              filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
              options={customers.map((c) => ({ value: c.name, label: c.name }))}
            />
          </Form.Item>

          {selectedCustomer && (
            <div style={{ marginTop: -8, marginBottom: 16, padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <Descriptions size="small" column={2} labelStyle={{ color: '#6b7280', fontWeight: 500 }} contentStyle={{ color: '#111827' }}>
                {selectedCustomer.mobile && (
                  <Descriptions.Item label="Mobile">{selectedCustomer.mobile}</Descriptions.Item>
                )}
                {selectedCustomer.email && (
                  <Descriptions.Item label="Email">{selectedCustomer.email}</Descriptions.Item>
                )}
                {selectedCustomer.gstin && (
                  <Descriptions.Item label="GSTIN" span={2}>{selectedCustomer.gstin}</Descriptions.Item>
                )}
                {(selectedCustomer.address || selectedCustomer.city) && (
                  <Descriptions.Item label="Address" span={2}>
                    {[selectedCustomer.address, selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode]
                      .filter(Boolean).join(', ')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          )}

          <Form.Item name="customer_ref" label="Customer PO / Reference No.">
            <Input placeholder="e.g. PO-2024-1234" />
          </Form.Item>

          <Form.Item name="item_id" label="Item / Part"
            rules={[{ required: true, message: 'Item is required' }]}>
            <Select
              showSearch allowClear placeholder="Select item..."
              filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
              options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))}
            />
          </Form.Item>

          <Form.Item name="part_no_ext" label="Customer Part No. (if different)">
            <Input placeholder="Customer's part number..." />
          </Form.Item>

          <Form.Item name="qty_affected" label="Qty Affected">
            <Input type="number" min={0} placeholder="0" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="defect_desc" label="Defect Description"
            rules={[{ required: true, min: 10, message: 'Min 10 characters required' }]}>
            <TextArea rows={4} placeholder="Describe the defect / complaint in detail..." />
          </Form.Item>

          <Form.Item name="delivery_date" label="Delivery Date (when parts were delivered)">
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
