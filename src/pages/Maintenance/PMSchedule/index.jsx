import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  InputNumber, Typography, Row, Col, Statistic, Drawer, Descriptions,
  Divider, message, Tabs, List, Badge, Checkbox, Tooltip, Alert,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ToolOutlined, CheckCircleOutlined,
  ClockCircleOutlined, PlayCircleOutlined, ThunderboltOutlined,
  BulbOutlined, WarningOutlined, ArrowUpOutlined, ArrowDownOutlined,
  UserOutlined, RiseOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import { maintenancePmApi, equipmentApi, maintenanceAiApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

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

// ── CSV Upload config (for PM Templates) ─────────────────────────────────────
const PMTMPL_CSV_HEADERS = [
  'Name', 'Frequency', 'Estimated Duration (min)', 'Description',
];
const PMTMPL_CSV_SAMPLE = [
  { 'Name': 'Monthly Lubrication Check', 'Frequency': 'monthly',
    'Estimated Duration (min)': '45', 'Description': 'Monthly greasing & oil level check' },
];
const PMTMPL_VALIDATION_RULES = [
  { field: 'Name', required: true },
];

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
  // MNT-005: PM optimization recommendations (schedule_id → recommendation)
  const [pmOptMap, setPmOptMap]     = useState({});
  const [pmOptLoading, setPmOptLoading] = useState(false);
  const [pmOptLoaded, setPmOptLoaded]   = useState(false);   // true once first load completes
  // MNT-004 + MNT-015: Wave 3 AI
  const [techSuggestions, setTechSuggestions] = useState(null);
  const [techLoading, setTechLoading]         = useState(false);
  const [smartSchedule, setSmartSchedule]     = useState(null);
  const [smartLoading, setSmartLoading]       = useState(false);
  const [csvModalOpen, setCsvModalOpen]       = useState(false);

  // MNT-005: load/refresh PM optimization (covers ALL active schedules)
  const loadPmOpt = useCallback(async () => {
    setPmOptLoading(true);
    try {
      const res  = await maintenanceAiApi.getPmOptimization();
      // After double-unwrap: res is already the array
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      const map  = {};
      list.forEach((r) => { map[r.schedule_id] = r; });
      setPmOptMap(map);
      setPmOptLoaded(true);
      if (list.length === 0) {
        message.info('No active PM schedules found — AI Insight column will update once active schedules exist');
      }
    } catch (err) {
      console.error('[PMSchedule] getPmOptimization failed:', err);
      message.warning('AI Insight could not load — check server logs. You can retry with the Refresh AI button.');
    } finally {
      setPmOptLoading(false);
    }
  }, []);

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
    loadPmOpt(); // MNT-005: load on mount with proper error handling
  }, [loadPmOpt]);

  useEffect(() => {
    loadAll();
    equipmentApi.getAll()
      .then((r) => setEquipment(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load equipment'));
  }, [loadAll]);

  // MNT-004: Load technician suggestions for a WO
  const loadTechSuggestions = async (equipmentId, templateId) => {
    setTechLoading(true);
    setTechSuggestions(null);
    try {
      const res = await maintenanceAiApi.getTechnicianSuggestion(equipmentId, templateId);
      setTechSuggestions(res?.data ?? res ?? []);
    } catch { /* silent */ }
    finally { setTechLoading(false); }
  };

  // MNT-015: Load smart schedule
  const loadSmartSchedule = async () => {
    setSmartLoading(true);
    try {
      const res = await maintenanceAiApi.getSmartSchedule();
      setSmartSchedule(res?.data ? res : { data: res?.data ?? res ?? [], summary: res?.summary });
    } catch (err) { message.error(err?.message || 'Failed to load smart schedule'); }
    finally { setSmartLoading(false); }
  };

  const openWo = async (woId) => {
    try {
      const res = await maintenancePmApi.getWorkOrder(woId);
      const wo = res?.id ? res : (res?.data ?? res);
      setSelectedWo(wo);
      setTechSuggestions(null); // reset on each open
      setWoDrawer(true);
      // MNT-004: silently preload technician suggestions
      if (wo?.equipment_id) loadTechSuggestions(wo.equipment_id, wo.template_id);
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
    } catch (err) { message.error(err?.message || 'Failed to complete WO'); }
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

  // ── CSV Import handler (imports PM Templates) ───────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        await maintenancePmApi.createTemplate({
          name: row['Name'],
          frequency_type: row['Frequency'] || 'monthly',
          estimated_duration_minutes: row['Estimated Duration (min)'] ? parseInt(row['Estimated Duration (min)'], 10) : null,
          description: row['Description'] || null,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Name']}": ${err?.message || 'Failed'}`);
      }
    }
    loadAll();
    return { success, failed, errors };
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
    {
      title: (
        <Space size={4}>
          <BulbOutlined style={{ color: '#7c3aed' }} />
          <span>AI Insight</span>
          {pmOptLoading && <span style={{ fontSize: 10, color: '#9ca3af' }}>(loading…)</span>}
        </Space>
      ),
      key: 'ai',
      width: 190,
      render: (_, r) => {
        // Show spinner while first load is in progress
        if (pmOptLoading && !pmOptLoaded) {
          return <Tag color="default" style={{ fontSize: 11, color: '#9ca3af' }}>Analyzing…</Tag>;
        }
        const opt = pmOptMap[r.id];
        if (!opt) {
          // Distinguish: inactive schedule vs no-data
          if (r.status !== 'active') {
            return (
              <Tooltip title="AI insights only apply to active schedules">
                <Tag color="default" style={{ fontSize: 11, color: '#d1d5db' }}>Inactive</Tag>
              </Tooltip>
            );
          }
          return (
            <Tooltip title="Active schedule not yet analyzed — click Refresh AI to load insights">
              <Tag color="default" style={{ fontSize: 11, color: '#9ca3af' }}>Pending</Tag>
            </Tooltip>
          );
        }
        const cfg = {
          tighten:          { color: 'red',    icon: <ArrowDownOutlined />, label: `Tighten → ${opt.suggested_interval_days}d` },
          extend:           { color: 'green',  icon: <ArrowUpOutlined />,  label: `Can extend → ${opt.suggested_interval_days}d` },
          scheduling_issue: { color: 'orange', icon: <WarningOutlined />,  label: 'Scheduling issue' },
          maintain:         { color: 'blue',   icon: <CheckCircleOutlined />, label: 'Interval OK' },
        }[opt.action] || { color: 'default', icon: null, label: opt.action };
        return (
          <Tooltip title={`${opt.reason} (Compliance: ${opt.pm_compliance_pct}%, Breakdowns 6m: ${opt.breakdowns_6m})`}>
            <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 11, cursor: 'help' }}>{cfg.label}</Tag>
          </Tooltip>
        );
      },
    },
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ClockCircleOutlined /> PM Schedule & Execution</Title>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => {
            const csvRows = templates.map((t) => ({
              'Name': t.name || '', 'Frequency': t.frequency_type || '',
              'Estimated Duration (min)': t.estimated_duration_minutes ?? '',
              'Description': t.description || '',
            }));
            downloadSampleCsv('pm-templates.csv', PMTMPL_CSV_HEADERS, csvRows);
          }}>Export CSV</Button>
          <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>
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
            children: <ResponsiveTable columns={woColumns} dataSource={workOrders} rowKey="id" loading={loading} scroll={{ x: 800 }} pagination={{ pageSize: 15 }} />,
          },
          {
            key: 'schedules',
            label: `Schedules (${schedules.length})`,
            children: (
              <div>
                {/* AI Insight toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: '#f5f3ff', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                  <BulbOutlined style={{ color: '#7c3aed', fontSize: 14 }} />
                  <Text style={{ fontSize: 12, color: '#6b7280', flex: 1 }}>
                    <strong style={{ color: '#7c3aed' }}>AI Insight</strong> — interval optimization based on 6-month breakdown frequency &amp; PM compliance.
                    {pmOptLoaded && ` ${Object.keys(pmOptMap).length} active schedule(s) analyzed.`}
                  </Text>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={pmOptLoading}
                    onClick={loadPmOpt}
                    style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                  >
                    Refresh AI
                  </Button>
                </div>
                <Table columns={schedColumns} dataSource={schedules} rowKey="id" loading={loading} scroll={{ x: 800 }} pagination={{ pageSize: 15 }} />
              </div>
            ),
          },
          {
            key: 'smart-schedule',
            label: <Space size={4}><RiseOutlined style={{ color: '#7c3aed' }} /><span>Smart Schedule</span></Space>,
            children: (
              <div>
                {!smartSchedule ? (
                  <div style={{ textAlign: 'center', padding: 32 }}>
                    <Button
                      type="primary"
                      icon={<RiseOutlined />}
                      loading={smartLoading}
                      onClick={loadSmartSchedule}
                      style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                    >
                      Generate Smart Schedule
                    </Button>
                    <div style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>
                      Ranks open PM WOs by production gaps, equipment risk, technician availability, and spare parts readiness
                    </div>
                  </div>
                ) : (
                  <>
                    <Space style={{ marginBottom: 12 }} wrap>
                      {smartSchedule?.summary && (
                        <>
                          <Tag color="red">{smartSchedule.summary.overdue_count} Overdue</Tag>
                          <Tag color="orange">{smartSchedule.summary.parts_not_ready} Parts Not Ready</Tag>
                          {smartSchedule.summary.batch_groups?.length > 0 && (
                            <Tag color="blue">{smartSchedule.summary.batch_groups.length} Batch Opportunities</Tag>
                          )}
                        </>
                      )}
                      <Button size="small" icon={<ReloadOutlined />} loading={smartLoading} onClick={loadSmartSchedule}>Refresh</Button>
                    </Space>
                    <Table
                      size="small"
                      scroll={{ x: 800 }}
                      rowKey="wo_id"
                      dataSource={smartSchedule?.data ?? []}
                      pagination={{ pageSize: 15 }}
                      columns={[
                        {
                          title: 'Priority',
                          width: 60,
                          render: (_, r, idx) => (
                            <Tag color={r.is_overdue ? 'red' : idx < 3 ? 'orange' : 'default'} style={{ fontSize: 11 }}>
                              #{idx + 1}
                            </Tag>
                          ),
                        },
                        {
                          title: 'WO',
                          render: (_, r) => (
                            <>
                              <Text strong style={{ fontSize: 12 }}>{r.wo_number}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 11 }}>{r.equipment_code} — {r.equipment_name}</Text>
                            </>
                          ),
                        },
                        {
                          title: 'Criticality',
                          dataIndex: 'criticality',
                          width: 80,
                          render: (v) => <Tag color={v === 'A' ? 'red' : v === 'B' ? 'orange' : 'default'}>{v}</Tag>,
                        },
                        {
                          title: 'Planned Date',
                          width: 110,
                          render: (_, r) => (
                            <Tooltip title={r.is_overdue ? 'Overdue — schedule ASAP' : `${r.days_until_due} days until due`}>
                              <Text style={{ color: r.is_overdue ? '#dc2626' : undefined, fontSize: 12 }}>
                                {r.recommended_date}
                              </Text>
                            </Tooltip>
                          ),
                        },
                        {
                          title: <Tooltip title="Score: 40% production gap + 25% equipment risk + 20% technician + 10% parts + 5% batch"><span>Score</span></Tooltip>,
                          width: 70,
                          render: (_, r) => (
                            <Tooltip title={`Gap:${Math.round(r.score_breakdown?.production_gap * 100)}% Risk:${Math.round(r.score_breakdown?.equipment_risk * 100)}% Tech:${Math.round(r.score_breakdown?.technician_load * 100)}%`}>
                              <Tag color={r.composite_score >= 0.7 ? 'green' : r.composite_score >= 0.4 ? 'gold' : 'default'} style={{ fontSize: 11 }}>
                                {Math.round(r.composite_score * 100)}%
                              </Tag>
                            </Tooltip>
                          ),
                        },
                        {
                          title: 'Flags',
                          render: (_, r) => (
                            <Space size={2} wrap>
                              {r.is_overdue && <Tag color="red" style={{ fontSize: 10 }}>Overdue</Tag>}
                              {!r.parts_ready && <Tag color="orange" style={{ fontSize: 10 }}>Parts Short</Tag>}
                              {r.batch_eligible && <Tag color="blue" style={{ fontSize: 10 }}>Batchable</Tag>}
                            </Space>
                          ),
                        },
                        {
                          title: '', width: 70,
                          render: (_, r) => <Button size="small" onClick={() => openWo(r.wo_id)}>View</Button>,
                        },
                      ]}
                    />
                  </>
                )}
              </div>
            ),
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
                scroll={{ x: 800 }}
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

            {/* MNT-004: AI Technician Suggestion */}
            {(techSuggestions !== null || techLoading) && (
              <div style={{ marginBottom: 16 }}>
                <Divider orientation="left" style={{ margin: '8px 0' }}>
                  <Space size={4}><UserOutlined style={{ color: '#7c3aed' }} /><span style={{ fontSize: 13, color: '#7c3aed' }}>Suggested Technicians</span></Space>
                </Divider>
                {techLoading ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>Loading suggestions...</Text>
                ) : (Array.isArray(techSuggestions) && techSuggestions.length > 0) ? (
                  techSuggestions.map((t, i) => (
                    <div key={t.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <Space size={6}>
                        {i === 0 && <Tag color="purple" style={{ fontSize: 10 }}>Best</Tag>}
                        <UserOutlined style={{ color: '#6b7280' }} />
                        <Text style={{ fontSize: 13 }}>{t.name}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>({t.employee_id})</Text>
                      </Space>
                      <Space size={4}>
                        {t.experience_count > 0 && <Tag color="blue" style={{ fontSize: 10 }}>{t.experience_count} past WOs</Tag>}
                        {t.avg_duration_minutes && <Tag color="green" style={{ fontSize: 10 }}>{t.avg_duration_minutes}m avg</Tag>}
                        <Tag color={t.open_wo_count === 0 ? 'green' : t.open_wo_count < 3 ? 'gold' : 'red'} style={{ fontSize: 10 }}>
                          {t.open_wo_count} open WOs
                        </Tag>
                      </Space>
                    </div>
                  ))
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>No technician history found for this equipment/template combination</Text>
                )}
              </div>
            )}

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

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload PM Templates"
        entityName="PM Template"
        sampleHeaders={PMTMPL_CSV_HEADERS}
        sampleRows={PMTMPL_CSV_SAMPLE}
        validationRules={PMTMPL_VALIDATION_RULES}
      />

      {/* New Template Modal */}
      <Modal title="New PM Template" open={tmplModal} onCancel={() => setTmplModal(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={createTemplate}>
          <Form.Item name="name" label="Template Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="frequency_type" label="Frequency" initialValue="monthly" rules={[{ required: true }]}>
                <Select options={Object.entries(FREQ_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
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
            <Col xs={24} sm={14}>
              <Form.Item name="next_due_date" label="First Due Date" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
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
    </AppLayout>
  );
}
