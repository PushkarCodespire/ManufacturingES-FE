import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  InputNumber, Typography, Row, Col, Statistic, Drawer, Descriptions,
  Divider, message, Tabs, List, Badge, Checkbox,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ToolOutlined, CheckCircleOutlined,
  ClockCircleOutlined, PlayCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { maintenancePmApi, equipmentApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = {
  open: 'blue', in_progress: 'orange', completed: 'green',
  cancelled: 'default', skipped: 'red',
};
const SCHED_COLOR = { active: 'green', paused: 'gold', cancelled: 'default' };
const FREQ_LABEL = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
  quarterly: 'Quarterly', semi_annual: 'Semi-Annual', annual: 'Annual', custom: 'Custom',
};

export default function PMSchedulePage() {
  const [templates, setTemplates]   = useState([]);
  const [schedules, setSchedules]   = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [equipment, setEquipment]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState('templates');
  const [woDrawer, setWoDrawer]     = useState(false);
  const [selectedWo, setSelectedWo] = useState(null);
  const [tmplModal, setTmplModal]   = useState(false);
  const [schedModal, setSchedModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form] = Form.useForm();
  const [schedForm] = Form.useForm();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tmpl, sched, wo] = await Promise.all([
        maintenancePmApi.getTemplates(),
        maintenancePmApi.getSchedules(),
        maintenancePmApi.getWorkOrders(),
      ]);
      // Each res IS already the array after double-unwrap (interceptor + .then(r=>r.data))
      setTemplates(Array.isArray(tmpl) ? tmpl : (tmpl?.data ?? []));
      setSchedules(Array.isArray(sched) ? sched : (sched?.data ?? []));
      setWorkOrders(Array.isArray(wo) ? wo : (wo?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load PM data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadAll();
    equipmentApi.getAll()
      .then((r) => setEquipment(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load equipment'));
  }, [loadAll]);

  const openWo = async (woId) => {
    try {
      const res = await maintenancePmApi.getWorkOrder(woId);
      // res IS the WO object after double-unwrap
      setSelectedWo(res?.id ? res : (res?.data ?? res));
      setWoDrawer(true);
    } catch (err) { message.error(err?.message ?? 'Failed to load work order'); }
  };

  const startWo = async (woId) => {
    try {
      await maintenancePmApi.startWorkOrder(woId);
      message.success('PM Work Order started');
      openWo(woId);
      loadAll();
    } catch (err) { message.error(err?.message ?? 'Failed to start WO'); }
  };

  const updateChecklist = async (woId, itemId, status) => {
    try {
      await maintenancePmApi.updateChecklistItem(woId, itemId, { status });
      openWo(woId);
    } catch (err) { message.error(err?.message ?? 'Failed to update checklist'); }
  };

  const completeWo = async (woId) => {
    try {
      await maintenancePmApi.completeWorkOrder(woId, {});
      message.success('PM Work Order completed. Schedule updated.');
      setWoDrawer(false);
      loadAll();
    } catch (err) { message.error(err?.response?.data?.message || 'Failed to complete WO'); }
  };

  const createTemplate = async (values) => {
    try {
      await maintenancePmApi.createTemplate(values);
      message.success('PM Template created');
      setTmplModal(false);
      form.resetFields();
      loadAll();
    } catch (err) { message.error(err?.message ?? 'Failed to create template'); }
  };

  const createSchedule = async (values) => {
    try {
      await maintenancePmApi.scheduleFor(values.equipment_id, values);
      message.success('PM Schedule created');
      setSchedModal(false);
      schedForm.resetFields();
      loadAll();
    } catch (err) { message.error(err?.message ?? 'Failed to create schedule'); }
  };

  const autoGenerate = async () => {
    setGenerating(true);
    try {
      const res = await maintenancePmApi.autoGenerateWOs();
      // res = { message, created } after double-unwrap (backend now wraps under data key)
      message.success(`${res?.created?.length || 0} PM Work Orders generated`);
      loadAll();
    } catch (err) { message.error(err?.message ?? 'Auto-generate failed'); }
    finally { setGenerating(false); }
  };

  const openCount      = workOrders.filter((w) => w.status === 'open').length;
  const inProgressCount= workOrders.filter((w) => w.status === 'in_progress').length;
  const completedCount = workOrders.filter((w) => w.status === 'completed').length;
  const overdueSchedules = schedules.filter((s) => s.status === 'active' && s.next_due_date < new Date().toISOString().slice(0, 10)).length;

  const woColumns = [
    { title: 'WO Number', dataIndex: 'wo_number', render: (v) => <Text strong>{v}</Text> },
    {
      title: 'Equipment',
      render: (_, r) => (
        <>
          <Text strong>{r.Equipment?.equipment_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.Equipment?.name}</Text>
        </>
      ),
    },
    { title: 'Template', dataIndex: ['Template', 'name'], render: (v) => v || '—' },
    { title: 'Planned Date', dataIndex: 'planned_date', render: (v) => {
      const overdue = v < new Date().toISOString().slice(0, 10);
      return <Text style={{ color: overdue ? '#dc2626' : undefined }}>{v}</Text>;
    }},
    { title: 'Assigned To', dataIndex: ['AssignedTo', 'name'], render: (v) => v || 'Unassigned' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={STATUS_COLOR[v]}>{v?.replace(/_/g, ' ').toUpperCase()}</Tag> },
    { title: 'Actions', key: 'actions', render: (_, r) => <Button size="small" onClick={() => openWo(r.id)}>View</Button> },
  ];

  const schedColumns = [
    {
      title: 'Equipment',
      render: (_, r) => (
        <>
          <Text strong>{r.Equipment?.equipment_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.Equipment?.name}</Text>
        </>
      ),
    },
    { title: 'Template', dataIndex: ['Template', 'name'], render: (v) => v || '—' },
    { title: 'Frequency', dataIndex: ['Template', 'frequency_type'], render: (v) => <Tag>{FREQ_LABEL[v] || v}</Tag> },
    { title: 'Next Due', dataIndex: 'next_due_date', render: (v) => {
      const overdue = v < new Date().toISOString().slice(0, 10);
      return <Text style={{ color: overdue ? '#dc2626' : undefined }}>{v}</Text>;
    }},
    { title: 'Last Completed', dataIndex: 'last_completed_date', render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={SCHED_COLOR[v]}>{v?.toUpperCase()}</Tag> },
  ];

  const tmplColumns = [
    { title: 'Template Name', dataIndex: 'name', render: (v) => <Text strong>{v}</Text> },
    { title: 'Frequency', dataIndex: 'frequency_type', render: (v) => <Tag>{FREQ_LABEL[v] || v}</Tag> },
    { title: 'Est. Duration', dataIndex: 'estimated_duration_minutes', render: (v) => v ? `${v} min` : '—' },
    { title: 'Steps', dataIndex: 'Items', render: (v) => <Tag>{(v || []).length} steps</Tag> },
    { title: 'Category', dataIndex: ['Category', 'name'], render: (v) => v || '—' },
  ];

  const allMandatoryDone = selectedWo?.Checklist
    ? selectedWo.Checklist.filter((c) => c.TemplateItem?.is_mandatory).every((c) => c.status === 'done')
    : false;

  return (
    <AppLayout>
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ClockCircleOutlined /> PM Schedule & Execution</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
          <Button icon={<ThunderboltOutlined />} onClick={autoGenerate} loading={generating}>Auto-Generate WOs</Button>
          <Button icon={<PlusOutlined />} onClick={() => setSchedModal(true)}>New Schedule</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setTmplModal(true)}>New Template</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={6}><Card><Statistic title="Open PM WOs" value={openCount} valueStyle={{ color: '#2563eb' }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="In Progress" value={inProgressCount} valueStyle={{ color: '#d97706' }} prefix={<PlayCircleOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Completed" value={completedCount} valueStyle={{ color: '#16a34a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Overdue Schedules" value={overdueSchedules} valueStyle={{ color: '#dc2626' }} prefix={<ToolOutlined />} /></Card></Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'workorders',
            label: `PM Work Orders (${workOrders.length})`,
            children: <Table columns={woColumns} dataSource={workOrders} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />,
          },
          {
            key: 'schedules',
            label: `Schedules (${schedules.length})`,
            children: <Table columns={schedColumns} dataSource={schedules} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />,
          },
          {
            key: 'templates',
            label: `Templates (${templates.length})`,
            children: (
              <Table
                columns={tmplColumns}
                dataSource={templates}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 15 }}
                expandable={{
                  expandedRowRender: (r) => (
                    <List
                      size="small"
                      dataSource={r.Items || []}
                      renderItem={(item) => (
                        <List.Item>
                          <Space>
                            <Tag>{item.step_number}</Tag>
                            <Text>{item.task_description}</Text>
                            {item.is_mandatory && <Tag color="red" style={{ fontSize: 10 }}>Mandatory</Tag>}
                            {item.expected_value && <Text type="secondary" style={{ fontSize: 11 }}>Expected: {item.expected_value} {item.unit}</Text>}
                          </Space>
                        </List.Item>
                      )}
                    />
                  ),
                }}
              />
            ),
          },
        ]}
      />

      {/* PM WO Detail Drawer */}
      <Drawer title="PM Work Order" width={640} open={woDrawer} onClose={() => setWoDrawer(false)} destroyOnClose>
        {selectedWo && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="WO Number" span={2}><Text strong>{selectedWo.wo_number}</Text></Descriptions.Item>
              <Descriptions.Item label="Equipment" span={2}>{selectedWo.Equipment?.equipment_code} — {selectedWo.Equipment?.name}</Descriptions.Item>
              <Descriptions.Item label="Template">{selectedWo.Template?.name}</Descriptions.Item>
              <Descriptions.Item label="Planned Date">{selectedWo.planned_date}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLOR[selectedWo.status]}>{selectedWo.status?.replace(/_/g, ' ').toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Assigned To">{selectedWo.AssignedTo?.name || 'Unassigned'}</Descriptions.Item>
              {selectedWo.started_at && <Descriptions.Item label="Started At" span={2}>{new Date(selectedWo.started_at).toLocaleString()}</Descriptions.Item>}
            </Descriptions>

            <Divider orientation="left">Checklist ({(selectedWo.Checklist || []).length} items)</Divider>
            <List
              size="small"
              dataSource={selectedWo.Checklist || []}
              renderItem={(item) => (
                <List.Item
                  actions={selectedWo.status === 'in_progress' && item.status === 'pending' ? [
                    <Button size="small" type="link" onClick={() => updateChecklist(selectedWo.id, item.id, 'done')}>Done</Button>,
                    <Button size="small" type="link" danger onClick={() => updateChecklist(selectedWo.id, item.id, 'skipped')}>Skip</Button>,
                  ] : []}
                >
                  <Space>
                    <Tag color={item.status === 'done' ? 'green' : item.status === 'skipped' ? 'default' : 'blue'}>
                      {item.TemplateItem?.step_number}
                    </Tag>
                    <Text style={{ textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>
                      {item.TemplateItem?.task_description}
                    </Text>
                    {item.TemplateItem?.is_mandatory && <Tag color="red" style={{ fontSize: 10 }}>Mandatory</Tag>}
                    {item.status === 'done' && <Tag color="green">✓</Tag>}
                    {item.status === 'skipped' && <Tag>Skipped</Tag>}
                  </Space>
                </List.Item>
              )}
            />

            <Divider />
            <Space wrap>
              {(selectedWo.status === 'open' || selectedWo.status === 'assigned') && (
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => startWo(selectedWo.id)}>Start PM</Button>
              )}
              {selectedWo.status === 'in_progress' && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={!allMandatoryDone}
                  onClick={() => completeWo(selectedWo.id)}
                >
                  {allMandatoryDone ? 'Complete PM WO' : 'Complete mandatory items first'}
                </Button>
              )}
            </Space>
          </>
        )}
      </Drawer>

      {/* New Template Modal */}
      <Modal title="New PM Template" open={tmplModal} onCancel={() => setTmplModal(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={createTemplate}>
          <Form.Item name="name" label="Template Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="frequency_type" label="Frequency" initialValue="monthly" rules={[{ required: true }]}>
                <Select options={Object.entries(FREQ_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="estimated_duration_minutes" label="Est. Duration (min)">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Create Template</Button>
            <Button onClick={() => setTmplModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* New Schedule Modal */}
      <Modal title="New PM Schedule" open={schedModal} onCancel={() => setSchedModal(false)} footer={null} width={480}>
        <Form form={schedForm} layout="vertical" onFinish={createSchedule}>
          <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
            />
          </Form.Item>
          <Form.Item name="template_id" label="PM Template" rules={[{ required: true }]}>
            <Select options={templates.map((t) => ({ value: t.id, label: `${t.name} (${FREQ_LABEL[t.frequency_type]})` }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="next_due_date" label="First Due Date" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="advance_days" label="Advance Days" initialValue={7}>
                <InputNumber style={{ width: '100%' }} min={1} max={30} />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit">Create Schedule</Button>
            <Button onClick={() => setSchedModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </div>
    </AppLayout>
  );
}
