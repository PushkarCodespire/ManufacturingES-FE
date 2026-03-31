import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Row, Col, Statistic, Drawer, Descriptions, Divider,
  message, Steps, List, Alert, Progress, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ToolOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, ThunderboltOutlined, ClockCircleOutlined,
  BulbOutlined, CheckOutlined,
DownloadOutlined, } from '@ant-design/icons';
import { breakdownApi, equipmentApi, maintenanceAiApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TextArea } = Input;

const BD_STATUS_COLOR = {
  open: 'red', assigned: 'orange', in_progress: 'blue',
  resolved: 'green', cancelled: 'default',
};
const WO_STATUS_COLOR = {
  open: 'blue', assigned: 'cyan', in_progress: 'orange',
  on_hold: 'gold', completed: 'green', cancelled: 'default',
};

export default function BreakdownPage() {
  const [breakdowns, setBreakdowns]   = useState([]);
  const [workOrders, setWorkOrders]   = useState([]);
  const [equipment, setEquipment]     = useState([]);
  const [priorities, setPriorities]   = useState([]);
  const [failureCodes, setFailureCodes] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [activeView, setActiveView] = useState('breakdowns');
  const [selected, setSelected]     = useState(null);
  const [selectedWo, setSelectedWo] = useState(null);
  const [bdDrawer, setBdDrawer]     = useState(false);
  const [woDrawer, setWoDrawer]     = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [diagnosisModal, setDiagnosisModal] = useState(false);
  const [taskModal, setTaskModal]     = useState(false);
  const [completeModal, setCompleteModal] = useState(false);
  const [form] = Form.useForm();
  const [diagForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [completeForm] = Form.useForm();
  // MNT-007: AI root cause suggestion state
  const [aiSuggestions, setAiSuggestions] = useState(null); // { suggestions[], symptoms }
  const [aiLoading, setAiLoading]         = useState(false);

  // MNT-007: Analyze symptoms and suggest root cause
  const analyzeBreakdown = async (bdId, autoSave = false) => {
    setAiLoading(true);
    setAiSuggestions(null);
    try {
      const res = await maintenanceAiApi.getRootCauseSuggestion(bdId, autoSave);
      const data = res?.data ?? res;
      setAiSuggestions(data);
      if (autoSave && data?.saved) {
        message.success('AI suggestion saved to breakdown record');
        // Refresh breakdown detail
        const updated = await breakdownApi.getBreakdownById(bdId);
        setSelected(updated?.id ? updated : (updated?.data ?? updated));
      }
    } catch (err) {
      message.error(err?.message || 'AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const loadBreakdowns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await breakdownApi.getBreakdowns();
      setBreakdowns(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load breakdowns'); }
    finally { setLoading(false); }
  }, []);

  const loadWorkOrders = useCallback(async () => {
    try {
      const res = await breakdownApi.getWorkOrders({ type: 'corrective' });
      setWorkOrders(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load work orders'); }
  }, []);

  useEffect(() => {
    loadBreakdowns();
    loadWorkOrders();
    equipmentApi.getAll({ status: 'operational' })
      .then((r) => setEquipment(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load equipment'));
    equipmentApi.getPriorities()
      .then((r) => setPriorities(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load priorities'));
    equipmentApi.getFailureCodes()
      .then((r) => setFailureCodes(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load failure codes'));
  }, [loadBreakdowns, loadWorkOrders]);

  const openBdDetail = async (id) => {
    try {
      const res = await breakdownApi.getBreakdownById(id);
      setSelected(res?.id ? res : (res?.data ?? res));
      setBdDrawer(true);
    } catch (err) { message.error(err?.message ?? 'Failed to load breakdown details'); }
  };

  const openWoDetail = async (id) => {
    try {
      const res = await breakdownApi.getWOById(id);
      setSelectedWo(res?.id ? res : (res?.data ?? res));
      setWoDrawer(true);
    } catch (err) { message.error(err?.message ?? 'Failed to load work order'); }
  };

  const reportBreakdown = async (values) => {
    try {
      await breakdownApi.createBreakdown(values);
      message.success('Breakdown reported! Machine status set to breakdown.');
      setReportModal(false);
      form.resetFields();
      loadBreakdowns();
    } catch (err) { message.error(err?.message ?? 'Failed to report breakdown'); }
  };

  const openCorrectiveWO = async () => {
    try {
      await breakdownApi.openCorrectiveWO(selected.id, { loto_required: selected.Equipment?.criticality === 'A' });
      message.success('Corrective WO opened');
      setBdDrawer(false);
      loadBreakdowns();
      loadWorkOrders();
    } catch (err) { message.error(err?.message ?? 'Failed to open WO'); }
  };

  const startWO = async (woId) => {
    try {
      await breakdownApi.startWO(woId);
      message.success('Work Order started');
      openWoDetail(woId);
      loadWorkOrders();
    } catch (err) { message.error(err?.message ?? 'Failed to start WO'); }
  };

  const saveDiagnosis = async (values) => {
    try {
      await breakdownApi.saveDiagnosis(selectedWo.id, values);
      message.success('Diagnosis saved');
      setDiagnosisModal(false);
      diagForm.resetFields();
      openWoDetail(selectedWo.id);
    } catch (err) { message.error(err?.message ?? 'Failed to save diagnosis'); }
  };

  const addTask = async (values) => {
    try {
      await breakdownApi.addTask(selectedWo.id, values);
      message.success('Task added');
      setTaskModal(false);
      taskForm.resetFields();
      openWoDetail(selectedWo.id);
    } catch (err) { message.error(err?.message ?? 'Failed to add task'); }
  };

  const completeTask = async (taskId) => {
    try {
      await breakdownApi.completeTask(selectedWo.id, taskId, {});
      message.success('Task completed');
      openWoDetail(selectedWo.id);
    } catch (err) { message.error(err?.message ?? 'Failed to complete task'); }
  };

  const completeWO = async (values) => {
    try {
      await breakdownApi.completeWO(selectedWo.id, values);
      message.success('Work Order completed! Equipment restored to operational.');
      setCompleteModal(false);
      completeForm.resetFields();
      setWoDrawer(false);
      loadBreakdowns();
      loadWorkOrders();
    } catch (err) { message.error(err?.message ?? 'Failed to complete WO'); }
  };

  const openCount      = breakdowns.filter((b) => b.status === 'open').length;
  const inProgressWOs  = workOrders.filter((w) => w.status === 'in_progress').length;
  const resolvedToday  = breakdowns.filter((b) => {
    return b.status === 'resolved' && b.resolved_at &&
      new Date(b.resolved_at).toDateString() === new Date().toDateString();
  }).length;

  const bdColumns = [
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
    { title: 'Priority', dataIndex: ['Priority', 'name'], render: (v, r) => <Tag color={r.Priority?.color_code || 'default'}>{v || '—'}</Tag> },
    { title: 'Symptoms', dataIndex: 'symptoms', ellipsis: true, render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={BD_STATUS_COLOR[v]}>{v?.toUpperCase()}</Tag> },
    { title: 'Reported', dataIndex: 'createdAt', render: (v) => new Date(v).toLocaleString() },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => <Button size="small" onClick={() => openBdDetail(r.id)}>View</Button>,
    },
  ];

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
    { title: 'Title', dataIndex: 'title', ellipsis: true },
    { title: 'Assigned To', dataIndex: ['AssignedTo', 'name'], render: (v) => v || 'Unassigned' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={WO_STATUS_COLOR[v]}>{v?.replace(/_/g, ' ').toUpperCase()}</Tag> },
    { title: 'Started', dataIndex: 'started_at', render: (v) => v ? new Date(v).toLocaleString() : '—' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => <Button size="small" onClick={() => openWoDetail(r.id)}>View</Button>,
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}><ThunderboltOutlined /> Breakdown & Corrective Maintenance</Title>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('breakdown.csv', breakdowns, bdColumns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { loadBreakdowns(); loadWorkOrders(); }}>Refresh</Button>
          <Button type="primary" danger icon={<ExclamationCircleOutlined />} onClick={() => setReportModal(true)}>
            🚨 Machine Down
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="Open Breakdowns" value={openCount} valueStyle={{ color: '#dc2626', fontSize: 20 }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={8}><Card size="small"><Statistic title="WOs In Progress" value={inProgressWOs} valueStyle={{ color: '#d97706', fontSize: 20 }} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card size="small"><Statistic title="Resolved Today" value={resolvedToday} valueStyle={{ color: '#16a34a', fontSize: 20 }} prefix={<CheckCircleOutlined />} /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Button type={activeView === 'breakdowns' ? 'primary' : 'default'} onClick={() => setActiveView('breakdowns')}>Breakdown Requests ({breakdowns.length})</Button>
        <Button type={activeView === 'workorders' ? 'primary' : 'default'} onClick={() => setActiveView('workorders')}>Corrective Work Orders ({workOrders.length})</Button>
      </Space>

      {activeView === 'breakdowns' && (
        <ResponsiveTable columns={bdColumns} dataSource={breakdowns} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} scroll={{ x: 800 }} />
      )}
      {activeView === 'workorders' && (
        <ResponsiveTable columns={woColumns} dataSource={workOrders} rowKey="id" pagination={{ pageSize: 15 }} scroll={{ x: 800 }} />
      )}

      {/* Report Breakdown Modal */}
      <Modal title="🚨 Report Machine Breakdown" open={reportModal} onCancel={() => setReportModal(false)} footer={null} width={520}>
        <Alert message="Machine will be marked as BREAKDOWN immediately." type="error" showIcon style={{ marginBottom: 16 }} />
        <Form form={form} layout="vertical" onFinish={reportBreakdown}>
          <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
            />
          </Form.Item>
          <Form.Item name="priority_id" label="Priority" rules={[{ required: true }]}>
            <Select options={priorities.map((p) => ({ value: p.id, label: `${p.name} (${p.response_time_minutes} min)` }))} />
          </Form.Item>
          <Form.Item name="symptoms" label="Symptoms / What happened?" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="Describe what you observed..." />
          </Form.Item>
          <Space>
            <Button type="primary" danger htmlType="submit">Report Breakdown</Button>
            <Button onClick={() => setReportModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Breakdown Detail Drawer */}
      <Drawer title="Breakdown Details" width={580} open={bdDrawer} onClose={() => { setBdDrawer(false); setAiSuggestions(null); }} destroyOnClose>
        {selected && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Equipment" span={2}>{selected.Equipment?.equipment_code} — {selected.Equipment?.name}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={BD_STATUS_COLOR[selected.status]}>{selected.status?.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Priority">{selected.Priority?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Reported By">{selected.ReportedBy?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Reported At">{new Date(selected.createdAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Symptoms" span={2}>{selected.symptoms}</Descriptions.Item>
              {selected.ai_suggested_cause && (
                <Descriptions.Item label="AI Suggested Cause" span={2}>
                  <Tag color="purple">AI</Tag> {selected.ai_suggested_cause}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* ── MNT-007: AI Root Cause Analysis ─────────────────────────── */}
            {['open', 'assigned', 'in_progress'].includes(selected.status) && (
              <div style={{ marginBottom: 16 }}>
                <Divider orientation="left" style={{ margin: '8px 0' }}>
                  <Space size={4}><BulbOutlined style={{ color: '#7c3aed' }} /><span style={{ color: '#7c3aed', fontSize: 13 }}>AI Root Cause Analysis</span></Space>
                </Divider>
                <Space wrap style={{ marginBottom: 8 }}>
                  <Button
                    icon={<BulbOutlined />}
                    loading={aiLoading}
                    onClick={() => analyzeBreakdown(selected.id, false)}
                    style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                    size="small"
                  >
                    Analyze Symptoms
                  </Button>
                  {aiSuggestions?.suggestions?.length > 0 && (
                    <Button
                      icon={<CheckOutlined />}
                      size="small"
                      type="primary"
                      loading={aiLoading}
                      onClick={() => analyzeBreakdown(selected.id, true)}
                      style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                    >
                      Apply Top Suggestion
                    </Button>
                  )}
                </Space>

                {aiSuggestions && (
                  aiSuggestions.suggestions?.length > 0 ? (
                    <div>
                      {/* Source label */}
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                        {aiSuggestions.suggestions[0]?.ai_generated
                          ? '✨ Generated by Claude AI — no matching failure codes in database'
                          : aiSuggestions.historical_wo_count > 0
                            ? `Based on ${aiSuggestions.historical_wo_count} historical WOs for this equipment`
                            : 'Matched against failure code library'}
                        {aiSuggestions.five_why_template && (
                          <Tag color="purple" style={{ marginLeft: 6, fontSize: 10 }}>5-Why Available</Tag>
                        )}
                      </Text>

                      {aiSuggestions.suggestions.map((s, i) => (
                        <Card
                          key={s.failure_code_id ?? `ai-${i}`}
                          size="small"
                          style={{
                            marginBottom: 6,
                            borderColor: i === 0 ? '#7c3aed' : '#e5e7eb',
                            background: s.ai_generated ? '#faf5ff' : '#fff',
                          }}
                        >
                          <Row justify="space-between" align="top">
                            <Col flex="auto">
                              <Space size={4} wrap>
                                {i === 0 && <Tag color="purple">Best Match</Tag>}
                                {s.ai_generated && <Tag color="geekblue">AI Generated</Tag>}
                                {s.category && <Tag color="default" style={{ fontSize: 10 }}>{s.category}</Tag>}
                                <Text strong style={{ fontSize: 13 }}>
                                  {s.code ? `[${s.code}] ` : ''}{s.name}
                                </Text>
                                {s.history_count > 0 && (
                                  <Tag color="orange">{s.history_count}× historical</Tag>
                                )}
                              </Space>
                              {s.typical_cause && (
                                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                  {s.typical_cause}
                                </div>
                              )}
                            </Col>
                            <Col style={{ minWidth: 56, textAlign: 'right' }}>
                              <Tooltip title={s.ai_generated ? 'Confidence estimate from Claude AI' : 'Confidence based on keyword match + historical frequency'}>
                                <Progress
                                  type="circle"
                                  percent={s.confidence}
                                  width={36}
                                  strokeColor={s.confidence >= 60 ? '#7c3aed' : s.confidence >= 30 ? '#d97706' : '#9ca3af'}
                                  format={(p) => <span style={{ fontSize: 10 }}>{p}%</span>}
                                />
                              </Tooltip>
                            </Col>
                          </Row>
                        </Card>
                      ))}

                      {/* MNT-014: 5-Why template (shown when ≥5 historical WOs) */}
                      {aiSuggestions.five_why_template && (
                        <div style={{ marginTop: 10 }}>
                          <Divider orientation="left" style={{ margin: '6px 0', fontSize: 12 }}>
                            <Space size={4}>
                              <BulbOutlined style={{ color: '#7c3aed' }} />
                              <span style={{ fontSize: 12, color: '#7c3aed' }}>5-Why Analysis Template</span>
                            </Space>
                          </Divider>
                          {aiSuggestions.five_why_template.map((step) => (
                            <div key={step.level} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                              <Tag color="purple" style={{ minWidth: 32, textAlign: 'center', flexShrink: 0 }}>W{step.level}</Tag>
                              <div>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{step.question}</Text>
                                <Text style={{ fontSize: 12 }}>{step.answer}</Text>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Alert
                      message="Could not generate suggestions"
                      description="Enter more descriptive symptoms (e.g. 'motor overheating', 'hydraulic leak', 'vibration noise') and try again."
                      type="info"
                      showIcon
                    />
                  )
                )}
              </div>
            )}

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              {selected.resolved_at && (
                <Descriptions.Item label="Resolved At" span={2}>{new Date(selected.resolved_at).toLocaleString()}</Descriptions.Item>
              )}
              {selected.resolution_notes && (
                <Descriptions.Item label="Resolution" span={2}>{selected.resolution_notes}</Descriptions.Item>
              )}
            </Descriptions>

            {(selected.WorkOrders || []).length > 0 && (
              <>
                <Divider orientation="left">Corrective Work Orders</Divider>
                {selected.WorkOrders.map((wo) => (
                  <Card key={wo.id} size="small" style={{ marginBottom: 8 }}>
                    <Row justify="space-between" align="middle">
                      <Text strong>{wo.wo_number}</Text>
                      <Space>
                        <Tag color={WO_STATUS_COLOR[wo.status]}>{wo.status?.replace(/_/g, ' ')}</Tag>
                        <Button size="small" onClick={() => { setBdDrawer(false); openWoDetail(wo.id); }}>Open WO</Button>
                      </Space>
                    </Row>
                  </Card>
                ))}
              </>
            )}

            <Divider />
            <Space wrap>
              {selected.status === 'open' && (
                <Button type="primary" icon={<ToolOutlined />} onClick={openCorrectiveWO}>Open Corrective WO</Button>
              )}
            </Space>
          </>
        )}
      </Drawer>

      {/* Work Order Detail Drawer */}
      <Drawer title="Corrective Work Order" width={640} open={woDrawer} onClose={() => setWoDrawer(false)} destroyOnClose>
        {selectedWo && (
          <>
            <Steps
              size="small"
              current={['open','assigned','in_progress','completed'].indexOf(selectedWo.status)}
              style={{ marginBottom: 16 }}
              items={['Open', 'Assigned', 'In Progress', 'Completed'].map((title) => ({ title }))}
            />

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="WO Number" span={2}><Text strong>{selectedWo.wo_number}</Text></Descriptions.Item>
              <Descriptions.Item label="Equipment" span={2}>{selectedWo.Equipment?.equipment_code} — {selectedWo.Equipment?.name}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={WO_STATUS_COLOR[selectedWo.status]}>{selectedWo.status?.replace(/_/g, ' ').toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Assigned To">{selectedWo.AssignedTo?.name || 'Unassigned'}</Descriptions.Item>
              <Descriptions.Item label="Started At">{selectedWo.started_at ? new Date(selectedWo.started_at).toLocaleString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="LOTO Required">
                <Tag color={selectedWo.loto_required ? (selectedWo.loto_completed ? 'green' : 'red') : 'default'}>
                  {selectedWo.loto_required ? (selectedWo.loto_completed ? 'Completed' : 'REQUIRED') : 'Not Required'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Title" span={2}>{selectedWo.title}</Descriptions.Item>
            </Descriptions>

            {/* Diagnosis */}
            {selectedWo.Diagnosis ? (
              <>
                <Divider orientation="left">Diagnosis & Root Cause</Divider>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="Root Cause">{selectedWo.Diagnosis.root_cause_analysis || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Why 1">{selectedWo.Diagnosis.five_why_1 || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Why 2">{selectedWo.Diagnosis.five_why_2 || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Corrective Action">{selectedWo.Diagnosis.corrective_action || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Preventive Action">{selectedWo.Diagnosis.preventive_action || '—'}</Descriptions.Item>
                </Descriptions>
              </>
            ) : null}

            {/* Tasks */}
            <Divider orientation="left">Repair Tasks ({(selectedWo.Tasks || []).length})</Divider>
            <List
              size="small"
              dataSource={selectedWo.Tasks || []}
              renderItem={(task) => (
                <List.Item
                  actions={task.status !== 'completed' ? [
                    <Button size="small" type="link" onClick={() => completeTask(task.id)}>Complete</Button>
                  ] : [<Tag color="green">Done</Tag>]}
                >
                  <Space>
                    <Text>{task.step_number}.</Text>
                    <Text style={{ textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}>
                      {task.task_description}
                    </Text>
                    {task.is_mandatory && <Tag color="red" style={{ fontSize: 10 }}>Mandatory</Tag>}
                  </Space>
                </List.Item>
              )}
            />

            <Divider />
            <Space wrap>
              {selectedWo.status === 'open' || selectedWo.status === 'assigned'
                ? <Button type="primary" icon={<ToolOutlined />} onClick={() => startWO(selectedWo.id)}>Start Work</Button>
                : null}
              {selectedWo.status === 'in_progress' && (
                <>
                  <Button icon={<ExclamationCircleOutlined />} onClick={() => { diagForm.setFieldsValue(selectedWo.Diagnosis || {}); setDiagnosisModal(true); }}>
                    {selectedWo.Diagnosis ? 'Edit Diagnosis' : 'Add Diagnosis'}
                  </Button>
                  <Button icon={<PlusOutlined />} onClick={() => setTaskModal(true)}>Add Task</Button>
                  <Button type="primary" danger icon={<CheckCircleOutlined />} onClick={() => setCompleteModal(true)}>
                    Mark Complete
                  </Button>
                </>
              )}
            </Space>
          </>
        )}
      </Drawer>

      {/* Diagnosis Modal */}
      <Modal title="5-Why Root Cause Analysis" open={diagnosisModal} onCancel={() => setDiagnosisModal(false)} footer={null} width={560}>
        <Form form={diagForm} layout="vertical" onFinish={saveDiagnosis}>
          <Form.Item name="symptom_description" label="Symptom Description"><TextArea rows={2} /></Form.Item>
          <Form.Item name="failure_code_id" label="Failure Code">
            <Select
              allowClear
              showSearch
              placeholder="Select failure code"
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={failureCodes.map((fc) => ({ value: fc.id, label: `${fc.code} — ${fc.name}` }))}
            />
          </Form.Item>
          <Divider>5-Why Analysis</Divider>
          <Form.Item name="five_why_1" label="Why 1 — Why did the failure occur?"><TextArea rows={2} /></Form.Item>
          <Form.Item name="five_why_2" label="Why 2 — Why did that happen?"><TextArea rows={2} /></Form.Item>
          <Form.Item name="five_why_3" label="Why 3"><TextArea rows={2} /></Form.Item>
          <Form.Item name="five_why_4" label="Why 4"><TextArea rows={2} /></Form.Item>
          <Form.Item name="five_why_5" label="Why 5 — Root Cause"><TextArea rows={2} /></Form.Item>
          <Form.Item name="corrective_action" label="Corrective Action"><TextArea rows={2} /></Form.Item>
          <Form.Item name="preventive_action" label="Preventive Action"><TextArea rows={2} /></Form.Item>
          <Space><Button type="primary" htmlType="submit">Save Diagnosis</Button><Button onClick={() => setDiagnosisModal(false)}>Cancel</Button></Space>
        </Form>
      </Modal>

      {/* Add Task Modal */}
      <Modal title="Add Repair Task" open={taskModal} onCancel={() => setTaskModal(false)} footer={null}>
        <Form form={taskForm} layout="vertical" onFinish={addTask}>
          <Form.Item name="task_description" label="Task Description" rules={[{ required: true }]}><TextArea rows={3} /></Form.Item>
          <Form.Item name="is_mandatory" label="Mandatory?" initialValue={false}>
            <Select options={[{ value: false, label: 'Optional' }, { value: true, label: 'Mandatory' }]} />
          </Form.Item>
          <Space><Button type="primary" htmlType="submit">Add Task</Button><Button onClick={() => setTaskModal(false)}>Cancel</Button></Space>
        </Form>
      </Modal>

      {/* Complete WO Modal */}
      <Modal title="Complete Work Order" open={completeModal} onCancel={() => setCompleteModal(false)} footer={null}>
        <Form form={completeForm} layout="vertical" onFinish={completeWO}>
          <Form.Item name="root_cause" label="Root Cause Summary"><TextArea rows={3} /></Form.Item>
          <Form.Item name="resolution_notes" label="Resolution Notes"><TextArea rows={3} /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Complete & Restore Equipment</Button>
            <Button onClick={() => setCompleteModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </AppLayout>
  );
}
