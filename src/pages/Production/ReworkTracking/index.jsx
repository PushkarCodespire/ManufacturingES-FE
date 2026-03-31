import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Typography, Button, Drawer, Form, Input, InputNumber,
  Select, DatePicker, Space, Popconfirm, Steps, message, Modal, Divider,
  Spin, Row, Col, Statistic,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, RightOutlined, EditOutlined,
  CheckOutlined, DeleteOutlined, PlayCircleOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { reworkApi }  from '../../../api/production.api';
import api            from '../../../api/axios';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = {
  pending:     'default',
  authorized:  'blue',
  in_progress: 'orange',
  completed:   'green',
  scrapped:    'red',
};

export default function ReworkTrackingPage() {
  const { can } = usePermissions();
  const canWrite   = can('prod-rework_tracking-rework_vouchers-create_edit_delete');
  const canApprove = can('prod-rework_tracking-rework_vouchers-approve_reject');

  const [loading, setLoading]   = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [search,   setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  // Create drawer
  const [createOpen, setCreateOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [createForm] = Form.useForm();

  // Detail drawer
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailRecord,  setDetailRecord]  = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Complete modal
  const [completeOpen, setCompleteOpen]   = useState(false);
  const [completeId,   setCompleteId]     = useState(null);
  const [completeForm] = Form.useForm();

  // Lookup data
  const [items,    setItems]    = useState([]);
  const [machines, setMachines] = useState([]);
  const [wos,      setWos]      = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)      params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await reworkApi.getAll(params);
      setVouchers(res.data || []);
    } catch { message.error('Failed to load rework vouchers'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [itemsRes, machinesRes, wosRes] = await Promise.all([
          api.get('/items', { params: { limit: 500 } }),
          api.get('/machines'),
          api.get('/work-orders', { params: { status: 'in_progress', limit: 200 } }),
        ]);
        setItems(itemsRes.data || []);
        setMachines(machinesRes.data || []);
        setWos(wosRes.data || []);
      } catch { /* non-fatal */ }
    };
    fetchLookups();
  }, []);

  const handleCreate = async (values) => {
    setSaving(true);
    try {
      await reworkApi.create({
        ...values,
        rework_date: values.rework_date?.format('YYYY-MM-DD'),
      });
      message.success('Rework voucher created');
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch { message.error('Failed to create rework voucher'); }
    finally { setSaving(false); }
  };

  const handleAuthorize = async (id) => {
    try {
      await reworkApi.authorize(id);
      message.success('Voucher authorized');
      load();
    } catch { message.error('Authorization failed'); }
  };

  const handleStart = async (id) => {
    try {
      await reworkApi.start(id);
      message.success('Rework started');
      load();
    } catch { message.error('Failed to start rework'); }
  };

  const handleComplete = async (values) => {
    try {
      await reworkApi.complete(completeId, values);
      message.success('Rework completed');
      setCompleteOpen(false);
      completeForm.resetFields();
      load();
    } catch { message.error('Failed to complete rework'); }
  };

  const handleDelete = async (id) => {
    try {
      await reworkApi.delete(id);
      message.success('Deleted');
      load();
    } catch { message.error('Delete failed'); }
  };

  const openDetail = async (record) => {
    setDetailRecord(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await reworkApi.getById(record.id);
      setDetailRecord(res.data);
    } catch { message.error('Failed to load detail'); }
    finally { setDetailLoading(false); }
  };

  const columns = [
    {
      title:     'Voucher No',
      dataIndex: 'voucher_no',
      render:    (v, r) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(r)}>{v}</Button>
      ),
    },
    {
      title: 'Item',
      dataIndex: ['Item', 'name'],
      render: (v, r) => `${r.Item?.code || ''} ${v || ''}`.trim(),
    },
    { title: 'Qty Rework', dataIndex: 'qty_rework',  align: 'right' },
    { title: 'Passed',     dataIndex: 'qty_passed',   align: 'right' },
    { title: 'Scrapped',   dataIndex: 'qty_scrapped', align: 'right' },
    { title: 'Work Order', dataIndex: ['WorkOrder', 'wo_no'] },
    { title: 'Date',       dataIndex: 'rework_date' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v]}>{v?.replace(/_/g, ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space size={4}>
          {canApprove && r.status === 'pending' && (
            <Popconfirm title="Authorize this voucher?" onConfirm={() => handleAuthorize(r.id)}>
              <Button size="small" type="primary">Authorize</Button>
            </Popconfirm>
          )}
          {canWrite && r.status === 'authorized' && (
            <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleStart(r.id)}>Start</Button>
          )}
          {canWrite && ['authorized', 'in_progress'].includes(r.status) && (
            <Button size="small" icon={<CheckOutlined />} onClick={() => { setCompleteId(r.id); setCompleteOpen(true); }}>
              Complete
            </Button>
          )}
          {canWrite && r.status === 'pending' && (
            <Popconfirm title="Delete this voucher?" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Rework Tracking</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Rework Tracking</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Manage rework vouchers — track rework routing, authorization and outcomes.
      </Text>

      <Card
        style={{ marginTop: 16, border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="Search voucher no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={load}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="All statuses"
            allowClear
            style={{ width: 160 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'pending',     label: 'Pending'     },
              { value: 'authorized',  label: 'Authorized'  },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed',   label: 'Completed'   },
            ]}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('rework-tracking.csv', vouchers, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              New Rework Voucher
            </Button>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={vouchers}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Create Drawer */}
      <Drawer
        title="New Rework Voucher"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width={520}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setCreateOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={() => createForm.submit()}>Create</Button>
          </div>
        }
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="item_id" label="Item" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select item"
              options={items.map((i) => ({ value: i.id, label: `${i.code} – ${i.name}` }))}
            />
          </Form.Item>
          <Form.Item name="qty_rework" label="Qty to Rework" rules={[{ required: true }]}>
            <InputNumber min={0.001} precision={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="work_order_id" label="Work Order">
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="Link to work order (optional)"
              options={wos.map((w) => ({ value: w.id, label: w.wo_no }))}
            />
          </Form.Item>
          <Form.Item name="machine_id" label="Machine">
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="Machine (optional)"
              options={machines.map((m) => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>
          <Form.Item name="rework_date" label="Rework Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <TextArea rows={3} placeholder="Describe defect / rework reason..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        title={detailRecord ? `Rework Voucher — ${detailRecord.voucher_no}` : 'Rework Voucher'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={600}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin /></div>
        ) : detailRecord ? (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Statistic title="Qty Rework"  value={detailRecord.qty_rework}  /></Col>
              <Col span={8}><Statistic title="Qty Passed"  value={detailRecord.qty_passed}  /></Col>
              <Col span={8}><Statistic title="Qty Scrapped" value={detailRecord.qty_scrapped} /></Col>
            </Row>
            <div style={{ marginBottom: 8 }}>
              <Text strong>Item: </Text><Text>{detailRecord.Item?.code} — {detailRecord.Item?.name}</Text>
            </div>
            {detailRecord.reason && (
              <div style={{ marginBottom: 8 }}>
                <Text strong>Reason: </Text><Text>{detailRecord.reason}</Text>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <Text strong>Status: </Text>
              <Tag color={STATUS_COLOR[detailRecord.status]}>{detailRecord.status?.replace(/_/g, ' ').toUpperCase()}</Tag>
            </div>

            <Divider>Rework Steps</Divider>
            {detailRecord.Steps?.length ? (
              <Steps
                direction="vertical"
                size="small"
                items={detailRecord.Steps.map((s) => ({
                  title:       `Step ${s.step_no}: ${s.operation_name}`,
                  description: `${s.Machine?.name || '—'} · ${s.status}${s.CompletedBy ? ` · ${s.CompletedBy.name}` : ''}`,
                  status:      s.status === 'done' ? 'finish' : s.status === 'in_progress' ? 'process' : 'wait',
                }))}
              />
            ) : (
              <Text type="secondary">No steps defined.</Text>
            )}
          </>
        ) : null}
      </Drawer>

      {/* Complete Modal */}
      <Modal
        title="Complete Rework"
        open={completeOpen}
        onCancel={() => setCompleteOpen(false)}
        onOk={() => completeForm.submit()}
        okText="Save"
      >
        <Form form={completeForm} layout="vertical" onFinish={handleComplete}>
          <Form.Item name="qty_passed" label="Qty Passed" rules={[{ required: true }]}>
            <InputNumber min={0} precision={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="qty_scrapped" label="Qty Scrapped" rules={[{ required: true }]}>
            <InputNumber min={0} precision={3} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
}
