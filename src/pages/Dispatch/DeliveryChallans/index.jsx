import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Table, Space, Tag, Form, Input, Select, DatePicker,
  message, Card, Tooltip, Drawer, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  RightOutlined, SearchOutlined, FileTextOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { deliveryChallanApi } from '../../../api/deliveryChallan.api';
import { dispatchOrderApi }   from '../../../api/dispatchOrder.api';
import AppLayout              from '../../../components/AppLayout';
import usePermissions         from '../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

// ── CSV Upload config ────────────────────────────────────────────────────────
const DC_CSV_HEADERS = ['Dispatch Order No', 'Status', 'Issued Date', 'Receiver Name', 'Receiver Phone', 'Delivery Notes'];
const DC_CSV_SAMPLE = [
  { 'Dispatch Order No': 'DO-2025-001', 'Status': 'pending', 'Issued Date': '2025-06-15', 'Receiver Name': 'John Doe', 'Receiver Phone': '+91 98765 43210', 'Delivery Notes': 'Handle with care' },
];
const DC_CSV_VALIDATION = [
  { field: 'Dispatch Order No', required: true },
];

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLORS = { pending: 'default', issued: 'blue', signed: 'green', archived: 'gray' };
const STATUS_OPTIONS = [
  { value: 'pending',  label: 'Pending'  },
  { value: 'issued',   label: 'Issued'   },
  { value: 'signed',   label: 'Signed'   },
  { value: 'archived', label: 'Archived' },
];

const DeliveryChallansPage = () => {
  const { can } = usePermissions();
  const canWrite = can('dispatch-delivery_challans-create_edit_delete');

  const [records,      setRecords]      = useState([]);
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [search,       setSearch]       = useState('');
  const [form] = Form.useForm();
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await deliveryChallanApi.getAll(params);
      setRecords(res?.data ?? res ?? []);
    } catch (err) { message.error(err?.message || 'Failed to load challans'); }
    finally { setLoading(false); }
  }, [filterStatus]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await dispatchOrderApi.getAll();
      setOrders(res?.data ?? res ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openDrawer = (record = null) => {
    setEditing(record);
    if (record) {
      form.setFieldsValue({
        ...record,
        issued_date: record.issued_date ? dayjs(record.issued_date) : null,
        signed_date: record.signed_date ? dayjs(record.signed_date) : null,
      });
    } else {
      form.setFieldsValue({ status: 'pending' });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); form.resetFields(); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        issued_date: values.issued_date?.format('YYYY-MM-DD') || null,
        signed_date: values.signed_date?.format('YYYY-MM-DD') || null,
      };
      if (editing) {
        await deliveryChallanApi.update(editing.id, payload);
        message.success('Challan updated');
      } else {
        await deliveryChallanApi.create(payload);
        message.success('Challan created');
      }
      closeDrawer();
      fetchAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (record) => {
    try {
      await deliveryChallanApi.delete(record.id);
      message.success('Challan deleted');
      fetchAll();
    } catch (err) {
      message.error(err?.message || 'Failed to delete');
    }
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const order = row['Dispatch Order No'] ? orders.find((o) => o.order_number?.toLowerCase() === row['Dispatch Order No'].toLowerCase()) : null;
        await deliveryChallanApi.create({
          dispatch_order_id: order?.id || null,
          status:            row['Status'] || 'pending',
          issued_date:       row['Issued Date'] || null,
          receiver_name:     row['Receiver Name'] || null,
          receiver_phone:    row['Receiver Phone'] || null,
          delivery_notes:    row['Delivery Notes'] || null,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Dispatch Order No'] || ''}": ${err?.message || 'Failed'}`);
      }
    }
    fetchAll();
    return { success, failed, errors };
  };

  const filtered = search
    ? records.filter((r) =>
        r.challan_number?.toLowerCase().includes(search.toLowerCase()) ||
        r.DispatchOrder?.order_number?.toLowerCase().includes(search.toLowerCase()))
    : records;

  const total  = records.length;
  const issued = records.filter((r) => r.status === 'issued').length;
  const signed = records.filter((r) => r.status === 'signed').length;

  const columns = [
    {
      title: 'Challan #', dataIndex: 'challan_number', key: 'challan_number',
      render: (v) => <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13 }}>{v}</Text>,
    },
    {
      title: 'Dispatch Order', key: 'order',
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.DispatchOrder?.order_number || '—'}</Text>,
    },
    {
      title: 'Customer', key: 'customer',
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.DispatchOrder?.Customer?.name || '—'}</Text>,
    },
    {
      title: 'Issued Date', dataIndex: 'issued_date', key: 'issued_date', width: 130,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</Text>,
    },
    {
      title: 'Signed Date', dataIndex: 'signed_date', key: 'signed_date', width: 130,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v || '—'}</Text>,
    },
    {
      title: 'Receiver', dataIndex: 'receiver_name', key: 'receiver_name',
      render: (v) => <Text style={{ fontSize: 13 }}>{v || '—'}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v) => <Tag color={STATUS_COLORS[v]}>{v?.toUpperCase()}</Tag>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 90, align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1d4ed8' }} />} onClick={() => openDrawer(record)} />
          </Tooltip>
          {record.status !== 'signed' && (
            <Popconfirm
              title="Delete challan?"
              description="This action cannot be undone."
              okText="Delete" okType="danger"
              onConfirm={() => handleDelete(record)}
            >
              <Tooltip title="Delete">
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Dispatch</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Delivery Challans</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Delivery Challans</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Generate and track delivery challans for dispatched orders.</Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Issued: {issued}</Tag>
        <Tag color="green">Signed: {signed}</Tag>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search challan or order…"
            prefix={<SearchOutlined />}
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, borderRadius: 8 }} allowClear
          />
          <Select
            allowClear placeholder="Filter status" style={{ width: 160 }}
            options={STATUS_OPTIONS} value={filterStatus} onChange={setFilterStatus}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('delivery-challans.csv', filtered, columns)}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>}
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>
              New Challan
            </Button>
          )}
        </div>
        <Table
          rowKey="id" dataSource={filtered} columns={columns} loading={loading}
          size="middle" scroll={{ x: 900 }}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} challans` }}
          locale={{ emptyText: (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <FileTextOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
              <Text style={{ color: '#9ca3af' }}>No delivery challans yet</Text>
            </div>
          )}}
        />
      </Card>

      <Drawer
        title={editing ? `Edit — ${editing.challan_number}` : 'New Delivery Challan'}
        width={600}
        open={drawerOpen}
        onClose={closeDrawer}
        footer={
          canWrite ? (
            <Space>
              <Button type="primary" loading={saving} onClick={handleSave}>
                {editing ? 'Save Changes' : 'Create Challan'}
              </Button>
              <Button onClick={closeDrawer}>Cancel</Button>
            </Space>
          ) : null
        }
      >
        <Form form={form} layout="vertical" disabled={!canWrite} requiredMark={false}>
          <Form.Item name="dispatch_order_id" label="Dispatch Order" rules={[{ required: true, message: 'Select a dispatch order' }]}>
            <Select showSearch allowClear placeholder="Select dispatch order"
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              options={orders.map((o) => ({ value: o.id, label: `${o.order_number}${o.Customer ? ` — ${o.Customer.name}` : ''}` }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="status" label="Status">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="issued_date" label="Issued Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="signed_date" label="Signed Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="receiver_name" label="Receiver Name">
              <Input placeholder="Name of person receiving goods" />
            </Form.Item>
            <Form.Item name="receiver_phone" label="Receiver Phone" style={{ gridColumn: 'span 2' }}>
              <Input placeholder="+91 98765 43210" />
            </Form.Item>
          </div>
          <Form.Item name="delivery_notes" label="Delivery Notes">
            <Input.TextArea rows={3} placeholder="Any delivery notes or remarks" />
          </Form.Item>
        </Form>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Delivery Challans"
        entityName="Challan"
        sampleHeaders={DC_CSV_HEADERS}
        sampleRows={DC_CSV_SAMPLE}
        validationRules={DC_CSV_VALIDATION}
      />
    </AppLayout>
  );
};

export default DeliveryChallansPage;
