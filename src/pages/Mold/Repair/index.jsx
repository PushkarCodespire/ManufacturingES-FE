import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  InputNumber, Typography, Row, Col, Statistic, Drawer, Steps,
  Descriptions, Divider, message, Timeline, Badge, Switch,
} from 'antd';
import {
  PlusOutlined, ToolOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, SendOutlined, ReloadOutlined, DollarOutlined,
  SettingOutlined,
DownloadOutlined, } from '@ant-design/icons';
import { moldRepairApi, moldMasterApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TextArea } = Input;

const URGENCY_COLOR = { low: 'green', medium: 'blue', high: 'orange', critical: 'red' };
const STATUS_COLOR  = {
  requested: 'blue', approved: 'cyan', in_progress: 'orange',
  sub_contracted: 'purple', received: 'geekblue', inspection_pending: 'gold',
  completed: 'green', cancelled: 'default',
};

const STATUS_STEPS = ['requested', 'approved', 'in_progress', 'sub_contracted', 'received', 'inspection_pending', 'completed'];

export default function RepairPage() {
  const [requests, setRequests]           = useState([]);
  const [repairTypes, setRepairTypes]     = useState([]);
  const [loading, setLoading]             = useState(false);
  const [detailDrawer, setDetailDrawer]   = useState(false);
  const [selected, setSelected]           = useState(null);
  const [createModal, setCreateModal]     = useState(false);
  const [costModal, setCostModal]         = useState(false);
  const [trackModal, setTrackModal]       = useState(false);
  const [molds, setMolds]                 = useState([]);
  const [form] = Form.useForm();
  const [costForm] = Form.useForm();
  const [trackForm] = Form.useForm();
  const [typeForm] = Form.useForm();

  // ── Repair Types drawer state ─────────────────────────────────────────────
  const [typesDrawer, setTypesDrawer] = useState(false);
  const [savingType,  setSavingType]  = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      // All moldRepairApi methods use .then(r=>r.data) → double-unwrap → res IS the array
      const res = await moldRepairApi.getRequests();
      setRequests(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load repair requests'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadRequests();
    // r IS already the array after double-unwrap — r.data would be undefined
    moldRepairApi.getRepairTypes()
      .then((r) => setRepairTypes(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => {});
    moldMasterApi.getAll({ limit: 500 })
      .then((r) => setMolds(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => {});
  }, [loadRequests]);

  const openDetail = async (id) => {
    try {
      // moldRepairApi.getById uses .then(r=>r.data) → res IS the repair object directly
      const res = await moldRepairApi.getById(id);
      setSelected(res?.id ? res : (res?.data ?? res));
      setDetailDrawer(true);
    } catch (err) { message.error(err?.message ?? 'Failed to load repair details'); }
  };

  const createRequest = async (values) => {
    try {
      // mold_id goes in the URL param — strip it from the body or Joi rejects it
      const { mold_id, ...body } = values;
      await moldRepairApi.createRequest(mold_id, body);
      message.success('Repair request created. Mold status set to repair_needed.');
      setCreateModal(false);
      form.resetFields();
      loadRequests();
    } catch (err) { message.error(err?.message ?? 'Failed to create repair request'); }
  };

  const approve = async () => {
    try {
      await moldRepairApi.approve(selected.id, {});
      message.success('Repair request approved');
      setDetailDrawer(false);
      loadRequests();
    } catch (err) { message.error(err?.message ?? 'Failed to approve repair request'); }
  };

  const addTracking = async (values) => {
    try {
      await moldRepairApi.addTracking(selected.id, values);
      message.success('Tracking event added');
      setTrackModal(false);
      trackForm.resetFields();
      openDetail(selected.id);
    } catch (err) { message.error(err?.message ?? 'Failed to add tracking event'); }
  };

  const addCost = async (values) => {
    try {
      await moldRepairApi.addCost(selected.id, values);
      message.success('Cost added');
      setCostModal(false);
      costForm.resetFields();
      openDetail(selected.id);
    } catch (err) { message.error(err?.message ?? 'Failed to add cost'); }
  };

  const complete = async () => {
    Modal.confirm({
      title: 'Complete Repair?',
      content: 'This will mark the repair as completed and set mold status to trial_pending.',
      onOk: async () => {
        try {
          await moldRepairApi.complete(selected.id, {});
          message.success('Repair completed. Mold moved to trial_pending.');
          setDetailDrawer(false);
          loadRequests();
        } catch (err) { message.error(err?.message ?? 'Failed to complete repair'); }
      },
    });
  };

  const saveRepairType = async (values) => {
    setSavingType(true);
    try {
      await moldRepairApi.createRepairType(values);
      message.success(`Repair type "${values.name}" created`);
      typeForm.resetFields();
      // Reload repair types list
      moldRepairApi.getRepairTypes()
        .then((r) => setRepairTypes(Array.isArray(r) ? r : (r?.data ?? [])))
        .catch(() => {});
    } catch (err) { message.error(err?.message ?? 'Failed to create repair type'); }
    finally { setSavingType(false); }
  };

  const columns = [
    {
      title: 'Mold', width: 150,
      render: (_, r) => <><Text strong>{r.Mold?.mold_code}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.Mold?.name}</Text></>,
    },
    { title: 'Repair Type', dataIndex: ['RepairType', 'name'], width: 140, render: (v) => v || '—' },
    {
      title: 'Urgency', width: 100,
      dataIndex: 'urgency',
      render: (v) => <Tag color={URGENCY_COLOR[v]}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Status', width: 130,
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v]}>{v?.replace(/_/g, ' ').toUpperCase()}</Tag>,
    },
    { title: 'Requested By', dataIndex: ['RequestedBy', 'name'], width: 130, render: (v) => v || '—' },
    { title: 'Est. Cost', dataIndex: 'estimated_cost', width: 100, render: (v) => v ? `₹${Number(v).toLocaleString()}` : '—' },
    {
      title: 'Actions', width: 80,
      key: 'actions',
      render: (_, r) => <Button size="small" onClick={() => openDetail(r.id)}>View</Button>,
    },
  ];

  const activeCount   = requests.filter((r) => !['completed', 'cancelled'].includes(r.status)).length;
  const criticalCount = requests.filter((r) => r.urgency === 'critical').length;
  const completedCount= requests.filter((r) => r.status === 'completed').length;

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ToolOutlined /> Mold Repair</Title>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('repair.csv', requests, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={loadRequests}>Refresh</Button>
          <Button icon={<SettingOutlined />} onClick={() => setTypesDrawer(true)}>Manage Types</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>Request Repair</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="Active Repairs" value={activeCount} valueStyle={{ fontSize: 20 }} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="Critical" value={criticalCount} valueStyle={{ color: '#dc2626', fontSize: 20 }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="Completed" value={completedCount} valueStyle={{ color: '#16a34a', fontSize: 20 }} prefix={<CheckCircleOutlined />} /></Card></Col>
      </Row>

      <Table columns={columns} dataSource={requests} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} scroll={{ x: 800 }} />


      {/* Create Repair Request Modal */}
      <Modal title="New Repair Request" open={createModal} onCancel={() => setCreateModal(false)} footer={null} width={560}>
        <Form form={form} layout="vertical" onFinish={createRequest}>
          <Form.Item name="mold_id" label="Mold" rules={[{ required: true }]}>
            <Select showSearch filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={molds.map((m) => ({ value: m.id, label: `${m.mold_code} — ${m.name}` }))} />
          </Form.Item>
          <Form.Item name="repair_type_id" label="Repair Type">
            <Select allowClear options={repairTypes.map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item name="damage_description" label="Damage Description" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="damage_area" label="Damage Area">
            <Input placeholder="e.g. Cavity surface, Ejector pins..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="urgency" label="Urgency" initialValue="medium">
                <Select options={['low', 'medium', 'high', 'critical'].map((v) => ({ value: v, label: v.toUpperCase() }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="estimated_cost" label="Estimated Cost (₹)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Space><Button type="primary" htmlType="submit">Submit Request</Button><Button onClick={() => setCreateModal(false)}>Cancel</Button></Space>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer title="Repair Request Details" width={620} open={detailDrawer} onClose={() => setDetailDrawer(false)} destroyOnClose>
        {selected && (
          <>
            <Steps
              size="small"
              current={STATUS_STEPS.indexOf(selected.status)}
              style={{ marginBottom: 16 }}
              items={['Requested', 'Approved', 'In Progress', 'Sub-Con', 'Received', 'Inspection', 'Completed'].map((title) => ({ title }))}
            />
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Mold" span={2}>{selected.Mold?.mold_code} — {selected.Mold?.name}</Descriptions.Item>
              <Descriptions.Item label="Urgency"><Tag color={URGENCY_COLOR[selected.urgency]}>{selected.urgency?.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLOR[selected.status]}>{selected.status?.replace(/_/g, ' ').toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Damage Area">{selected.damage_area || '—'}</Descriptions.Item>
              <Descriptions.Item label="Est. Cost">₹{Number(selected.estimated_cost || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>{selected.damage_description}</Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Timeline</Divider>
            <Timeline>
              {(selected.TrackingEvents || []).map((e) => (
                <Timeline.Item key={e.id} color={e.event_type === 'returned' ? 'green' : 'blue'}>
                  <Text strong>{e.event_type?.replace(/_/g, ' ')}</Text>
                  <br /><Text type="secondary">{new Date(e.event_date).toLocaleString()}</Text>
                  {e.notes && <><br /><Text>{e.notes}</Text></>}
                </Timeline.Item>
              ))}
            </Timeline>

            <Divider orientation="left">Costs</Divider>
            {(selected.Costs || []).map((c) => (
              <Card key={c.id} size="small" style={{ marginBottom: 8 }}>
                <Row justify="space-between">
                  <Text>{c.cost_type} — {c.description}</Text>
                  <Text strong>₹{Number(c.amount).toLocaleString()}</Text>
                </Row>
              </Card>
            ))}

            <Divider />
            <Space wrap>
              {selected.status === 'requested' && <Button type="primary" icon={<CheckCircleOutlined />} onClick={approve}>Approve</Button>}
              <Button icon={<SendOutlined />} onClick={() => setTrackModal(true)}>Add Tracking Event</Button>
              <Button icon={<DollarOutlined />} onClick={() => setCostModal(true)}>Add Cost</Button>
              {['received', 'inspection_pending'].includes(selected.status) &&
                <Button type="primary" danger icon={<CheckCircleOutlined />} onClick={complete}>Mark Complete</Button>}
            </Space>
          </>
        )}
      </Drawer>

      {/* Add Tracking Modal */}
      <Modal title="Add Tracking Event" open={trackModal} onCancel={() => setTrackModal(false)} footer={null}>
        <Form form={trackForm} layout="vertical" onFinish={addTracking}>
          <Form.Item name="event_type" label="Event Type" rules={[{ required: true }]}>
            <Select options={['dispatched','received_by_vendor','repair_started','repair_completed','returned','inspection_done'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><TextArea rows={3} /></Form.Item>
          <Space><Button type="primary" htmlType="submit">Add Event</Button><Button onClick={() => setTrackModal(false)}>Cancel</Button></Space>
        </Form>
      </Modal>

      {/* Manage Repair Types Drawer */}
      <Drawer
        title={<Space><SettingOutlined />Manage Repair Types</Space>}
        width={560}
        open={typesDrawer}
        onClose={() => setTypesDrawer(false)}
        destroyOnClose
      >
        {/* Add new type form */}
        <Form form={typeForm} layout="vertical" onFinish={saveRepairType}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>Add New Repair Type</Text>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Cavity Surface Repair" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Brief description of this repair type..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="typical_duration_days" label="Typical Duration (days)">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 3" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="typical_cost" label="Typical Cost (₹)">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="e.g. 5000" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="requires_sub_con" label="Requires Sub-Contracting" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={savingType}>
            Add Repair Type
          </Button>
        </Form>

        <Divider />

        {/* Existing types list */}
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Existing Types ({repairTypes.length})
        </Text>
        {repairTypes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
            No repair types yet — add one above to populate the dropdown.
          </div>
        ) : (
          <Table
            dataSource={repairTypes}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: 'Name', dataIndex: 'name', key: 'name', render: (v) => <Text strong>{v}</Text> },
              { title: 'Duration', dataIndex: 'typical_duration_days', key: 'dur', width: 90,
                render: (v) => v ? `${v}d` : '—' },
              { title: 'Cost', dataIndex: 'typical_cost', key: 'cost', width: 100,
                render: (v) => v ? `₹${Number(v).toLocaleString()}` : '—' },
              { title: 'Sub-Con', dataIndex: 'requires_sub_con', key: 'sub', width: 80,
                render: (v) => <Tag color={v ? 'orange' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
              { title: 'Status', dataIndex: 'is_active', key: 'active', width: 70,
                render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Off'}</Tag> },
            ]}
          />
        )}
      </Drawer>

      {/* Add Cost Modal */}
      <Modal title="Add Repair Cost" open={costModal} onCancel={() => setCostModal(false)} footer={null}>
        <Form form={costForm} layout="vertical" onFinish={addCost}>
          <Form.Item name="cost_type" label="Cost Type" rules={[{ required: true }]}>
            <Select options={['labour','material','transport','inspection','other'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
          <Space><Button type="primary" htmlType="submit">Add Cost</Button><Button onClick={() => setCostModal(false)}>Cancel</Button></Space>
        </Form>
      </Modal>
    </AppLayout>
  );
}
