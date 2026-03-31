import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Tabs, Modal, Form, Input, Select,
  InputNumber, Typography, Row, Col, Statistic, Badge, Drawer, List,
  Descriptions, Divider, message, Tooltip,
} from 'antd';
import {
  PlusOutlined, ToolOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, ReloadOutlined, CheckOutlined, SettingOutlined,
  CalendarOutlined,
DownloadOutlined, } from '@ant-design/icons';
import { moldPmApi, moldMasterApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = {
  pending:     'blue',
  overdue:     'red',
  in_progress: 'orange',
  completed:   'green',
  skipped:     'default',
};

const WO_STATUS_COLOR = { open: 'blue', in_progress: 'orange', completed: 'green', cancelled: 'default' };

export default function PMSchedulePage() {
  const [schedules, setSchedules]       = useState([]);
  const [templates, setTemplates]       = useState([]);
  const [loading, setLoading]           = useState(false);
  const [activeTab, setActiveTab]       = useState('schedules');
  const [tmplDrawer, setTmplDrawer]     = useState(false);
  const [workOrderDrawer, setWorkOrderDrawer] = useState(false);
  const [selectedWo, setSelectedWo]     = useState(null);
  const [completingWo, setCompletingWo] = useState(false);
  const [form] = Form.useForm();
  const [completeForm] = Form.useForm();
  const [scheduleForm] = Form.useForm();

  // ── Schedule PM modal state ──────────────────────────────────────────────
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [schedulingPm,      setSchedulingPm]      = useState(false);
  const [allMolds,          setAllMolds]           = useState([]);
  const [moldsLoading,      setMoldsLoading]       = useState(false);
  // Preview the selected template's details inside the modal
  const [selectedTemplate,  setSelectedTemplate]   = useState(null);

  const loadMolds = useCallback(async () => {
    setMoldsLoading(true);
    try {
      // moldMasterApi uses .then(r=>r.data) → double-unwrap → res IS the array
      const res = await moldMasterApi.getAll({ limit: 500 });
      setAllMolds(Array.isArray(res) ? res : (res?.data ?? []));
    } catch { /* silent */ }
    finally { setMoldsLoading(false); }
  }, []);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      // moldPmApi uses .then(r=>r.data) → double-unwrap → res IS the array directly
      const res = await moldPmApi.getSchedules();
      setSchedules(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load PM schedules'); }
    finally { setLoading(false); }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await moldPmApi.getTemplates();
      setTemplates(Array.isArray(res) ? res : (res?.data ?? []));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadSchedules(); loadTemplates(); }, [loadSchedules, loadTemplates]);

  const overdueCount   = schedules.filter((s) => s.status === 'overdue').length;
  const pendingCount   = schedules.filter((s) => s.status === 'pending').length;
  const inProgressCount= schedules.filter((s) => s.status === 'in_progress').length;

  const openWorkOrder = async (scheduleId) => {
    try {
      await moldPmApi.openWorkOrder(scheduleId);
      message.success('PM Work Order opened');
      loadSchedules();
    } catch (err) { message.error(err?.message ?? 'Failed to open work order'); }
  };

  const viewWorkOrder = async (woId) => {
    try {
      // moldPmApi.getWorkOrder uses .then(r=>r.data) → res IS the work order object
      const res = await moldPmApi.getWorkOrder(woId);
      setSelectedWo(res?.id ? res : (res?.data ?? res));
      setWorkOrderDrawer(true);
    } catch (err) { message.error(err?.message ?? 'Failed to load work order'); }
  };

  const completeWorkOrder = async (values) => {
    setCompletingWo(true);
    try {
      await moldPmApi.completeWorkOrder(selectedWo.id, values);
      message.success('PM Work Order completed');
      setWorkOrderDrawer(false);
      loadSchedules();
    } catch (err) { message.error(err?.message ?? 'Failed to complete work order'); }
    finally { setCompletingWo(false); }
  };

  const createTemplate = async (values) => {
    try {
      await moldPmApi.createTemplate(values);
      message.success('PM Template created');
      setTmplDrawer(false);
      form.resetFields();
      loadTemplates();
    } catch (err) { message.error(err?.message ?? 'Failed to create template'); }
  };

  const openScheduleModal = () => {
    scheduleForm.resetFields();
    setSelectedTemplate(null);
    setScheduleModalOpen(true);
    loadMolds();
  };

  const handleSchedulePm = async () => {
    let values;
    try { values = await scheduleForm.validateFields(); }
    catch { return; }
    setSchedulingPm(true);
    try {
      // Route: POST /mold/pm/:moldId/schedule  body: { template_id }
      await moldPmApi.schedulePm(values.mold_id, { template_id: values.template_id });
      message.success('PM scheduled successfully');
      setScheduleModalOpen(false);
      scheduleForm.resetFields();
      setSelectedTemplate(null);
      loadSchedules();
    } catch (err) { message.error(err?.message ?? 'Failed to schedule PM'); }
    finally { setSchedulingPm(false); }
  };

  const scheduleColumns = [
    {
      title: 'Mold',
      dataIndex: ['Mold', 'mold_code'],
      render: (_, r) => <><Text strong>{r.Mold?.mold_code}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.Mold?.name}</Text></>,
    },
    {
      title: 'PM Template',
      dataIndex: ['Template', 'name'],
      render: (_, r) => r.Template?.name || '—',
    },
    {
      title: 'Trigger',
      dataIndex: ['Template', 'trigger_type'],
      render: (_, r) => <Tag>{r.Template?.trigger_type?.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Next Due Shots',
      dataIndex: 'next_due_shots',
      render: (v, r) => {
        if (!v) return '—';
        const current = r.Mold?.current_shot_count || 0;
        const diff = v - current;
        return (
          <>
            <Text>{v?.toLocaleString()}</Text>
            {diff < 5000 && <Tag color="red" style={{ marginLeft: 4 }}>Soon</Tag>}
          </>
        );
      },
    },
    { title: 'Current Shots', dataIndex: ['Mold', 'current_shot_count'], render: (v) => v?.toLocaleString() || 0 },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v]}>{v?.replace('_', ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'pending' || r.status === 'overdue'
            ? <Button size="small" type="primary" icon={<ToolOutlined />} onClick={() => openWorkOrder(r.id)}>Open WO</Button>
            : r.status === 'in_progress'
            ? <Button size="small" icon={<CheckOutlined />} onClick={() => viewWorkOrder(r.id)}>View WO</Button>
            : null}
        </Space>
      ),
    },
  ];

  const templateColumns = [
    { title: 'Template Name', dataIndex: 'name', render: (v) => <Text strong>{v}</Text> },
    { title: 'Trigger', dataIndex: 'trigger_type', render: (v) => <Tag>{v?.replace('_', ' ')}</Tag> },
    { title: 'Shot Interval', dataIndex: 'shot_interval', render: (v) => v ? v.toLocaleString() : '—' },
    { title: 'Time Interval', dataIndex: 'time_interval_days', render: (v) => v ? `${v} days` : '—' },
    { title: 'Est. Duration', dataIndex: 'estimated_duration_min', render: (v) => v ? `${v} min` : '—' },
    { title: 'Steps', dataIndex: 'Items', render: (v) => v?.length || 0 },
    { title: 'Status', dataIndex: 'is_active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ToolOutlined /> PM Schedule</Title>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('p-m-schedule.csv', schedules, scheduleColumns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={loadSchedules}>Refresh</Button>
          <Button icon={<PlusOutlined />} onClick={() => setTmplDrawer(true)}>New Template</Button>
          <Button type="primary" icon={<CalendarOutlined />} onClick={openScheduleModal}>Schedule PM</Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card size="small"><Statistic title="Overdue" value={overdueCount} valueStyle={{ color: '#dc2626', fontSize: 20 }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small"><Statistic title="Pending" value={pendingCount} valueStyle={{ color: '#d97706', fontSize: 20 }} prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="In Progress" value={inProgressCount} valueStyle={{ color: '#2563eb', fontSize: 20 }} prefix={<ToolOutlined />} /></Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'schedules',
            label: <><ClockCircleOutlined /> Schedules</>,
            children: (
              <Table
                columns={scheduleColumns}
                dataSource={schedules}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 15 }}
                rowClassName={(r) => r.status === 'overdue' ? 'ant-table-row-danger' : ''}
              />
            ),
          },
          {
            key: 'templates',
            label: <><SettingOutlined /> Templates</>,
            children: (
              <Table
                columns={templateColumns}
                dataSource={templates}
                rowKey="id"
                pagination={{ pageSize: 15 }}
                expandable={{
                  expandedRowRender: (r) => (
                    <List
                      size="small"
                      dataSource={r.Items || []}
                      renderItem={(item) => (
                        <List.Item>
                          <Text>{item.step_number}. {item.task_description}</Text>
                          {item.is_mandatory && <Tag color="blue" style={{ marginLeft: 8 }}>Mandatory</Tag>}
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

      {/* Schedule PM Modal */}
      <Modal
        title={<Space><CalendarOutlined />Schedule PM for Mold</Space>}
        open={scheduleModalOpen}
        onCancel={() => { setScheduleModalOpen(false); scheduleForm.resetFields(); setSelectedTemplate(null); }}
        onOk={handleSchedulePm}
        confirmLoading={schedulingPm}
        okText="Schedule PM"
        width={520}
        destroyOnClose
      >
        <Form form={scheduleForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="mold_id"
            label="Mold"
            rules={[{ required: true, message: 'Please select a mold' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Search mold..."
              loading={moldsLoading}
              style={{ width: '100%' }}
              options={allMolds.map((m) => ({
                label: `${m.mold_code} — ${m.name}  (${m.status?.replace(/_/g, ' ')})`,
                value: m.id,
              }))}
              notFoundContent={moldsLoading ? 'Loading...' : 'No molds found'}
            />
          </Form.Item>

          <Form.Item
            name="template_id"
            label="PM Template"
            rules={[{ required: true, message: 'Please select a template' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select PM template..."
              style={{ width: '100%' }}
              onChange={(id) => setSelectedTemplate(templates.find((t) => t.id === id) ?? null)}
              options={templates.map((t) => ({
                label: `${t.name}  [${t.trigger_type?.replace('_', ' ')}]`,
                value: t.id,
              }))}
              notFoundContent="No templates found — create one first"
            />
          </Form.Item>

          {/* Show selected template details as a hint */}
          {selectedTemplate && (
            <Card size="small" style={{ background: '#f9fafb', border: '1px solid #e8eaed', borderRadius: 8, marginTop: -8 }}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Text style={{ fontSize: 12 }}>
                  <Text type="secondary">Trigger: </Text>
                  <Tag style={{ marginLeft: 4 }}>{selectedTemplate.trigger_type?.replace('_', ' ')}</Tag>
                </Text>
                {selectedTemplate.shot_interval && (
                  <Text style={{ fontSize: 12 }}>
                    <Text type="secondary">Shot Interval: </Text>
                    <Text strong>{selectedTemplate.shot_interval?.toLocaleString()} shots</Text>
                  </Text>
                )}
                {selectedTemplate.time_interval_days && (
                  <Text style={{ fontSize: 12 }}>
                    <Text type="secondary">Time Interval: </Text>
                    <Text strong>{selectedTemplate.time_interval_days} days</Text>
                  </Text>
                )}
                {selectedTemplate.estimated_duration_min && (
                  <Text style={{ fontSize: 12 }}>
                    <Text type="secondary">Est. Duration: </Text>
                    <Text strong>{selectedTemplate.estimated_duration_min} min</Text>
                  </Text>
                )}
                {selectedTemplate.Items?.length > 0 && (
                  <Text style={{ fontSize: 12 }}>
                    <Text type="secondary">Steps: </Text>
                    <Text strong>{selectedTemplate.Items.length} checklist items</Text>
                  </Text>
                )}
              </Space>
            </Card>
          )}
        </Form>
      </Modal>

      {/* New Template Drawer */}
      <Drawer title="New PM Template" width={520} open={tmplDrawer} onClose={() => setTmplDrawer(false)} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={createTemplate}>
          <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="trigger_type" label="Trigger Type" initialValue="shot_count">
            <Select options={[{ value: 'shot_count', label: 'Shot Count' }, { value: 'time_based', label: 'Time Based' }, { value: 'both', label: 'Both' }]} />
          </Form.Item>
          <Form.Item name="shot_interval" label="Shot Interval">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 50000" />
          </Form.Item>
          <Form.Item name="time_interval_days" label="Time Interval (Days)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="estimated_duration_min" label="Estimated Duration (min)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} />
          </Form.Item>
          <Divider>Checklist Items</Divider>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Card key={field.key} size="small" style={{ marginBottom: 8 }}
                    extra={<Button type="link" danger size="small" onClick={() => remove(field.name)}>Remove</Button>}>
                    <Form.Item {...field} name={[field.name, 'step_number']} label="Step" initialValue={index + 1} hidden>
                      <InputNumber />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'task_description']} label={`Step ${index + 1}`} rules={[{ required: true }]}>
                      <Input placeholder="Task description" />
                    </Form.Item>
                  </Card>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>Add Step</Button>
              </>
            )}
          </Form.List>
          <Divider />
          <Space>
            <Button type="primary" htmlType="submit">Create Template</Button>
            <Button onClick={() => setTmplDrawer(false)}>Cancel</Button>
          </Space>
        </Form>
      </Drawer>

      {/* Work Order Completion Drawer */}
      <Drawer title="Complete PM Work Order" width={540} open={workOrderDrawer} onClose={() => setWorkOrderDrawer(false)} destroyOnClose>
        {selectedWo && (
          <>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Mold">{selectedWo.Mold?.mold_code} — {selectedWo.Mold?.name}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={WO_STATUS_COLOR[selectedWo.status]}>{selectedWo.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Assigned To">{selectedWo.AssignedTo?.name || 'Unassigned'}</Descriptions.Item>
            </Descriptions>
            <Form form={completeForm} layout="vertical" onFinish={completeWorkOrder}>
              <Form.Item name="technician_notes" label="Technician Notes">
                <TextArea rows={3} placeholder="Summary of PM work done..." />
              </Form.Item>
              <Divider>Checklist Results</Divider>
              <Form.List name="checklist" initialValue={selectedWo.ChecklistResults || []}>
                {(fields) =>
                  fields.map((field) => (
                    <Card key={field.key} size="small" style={{ marginBottom: 8 }}>
                      <Form.Item {...field} name={[field.name, 'template_item_id']} hidden><InputNumber /></Form.Item>
                      <Form.Item {...field} name={[field.name, 'result']} label="Result" rules={[{ required: true }]}>
                        <Select options={[{ value: 'ok', label: '✅ OK' }, { value: 'not_ok', label: '❌ Not OK' }, { value: 'na', label: 'N/A' }]} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'finding']} label="Finding">
                        <Input placeholder="Any observation..." />
                      </Form.Item>
                    </Card>
                  ))
                }
              </Form.List>
              <Space>
                <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />} loading={completingWo}>Mark Complete</Button>
                <Button onClick={() => setWorkOrderDrawer(false)}>Cancel</Button>
              </Space>
            </Form>
          </>
        )}
      </Drawer>
    </AppLayout>
  );
}
