import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer, Form,
  Select, Modal, message, Row, Col, Progress, Tooltip, Popconfirm,
  Badge, Statistic, Descriptions, Collapse, Divider, Empty, InputNumber,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, RightOutlined, BellOutlined,
  CheckCircleOutlined, WarningOutlined, ExclamationCircleOutlined,
  ClockCircleOutlined, ThunderboltOutlined, StopOutlined,
  PlusOutlined, SettingOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { moldLifeApi, moldMasterApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

const LIFE_STAGE_CONFIG = {
  normal:             { color: 'green',   label: 'Normal',             borderColor: '#52c41a' },
  plan_replacement:   { color: 'gold',    label: 'Plan Replacement',   borderColor: '#faad14' },
  urgent_replacement: { color: 'orange',  label: 'Urgent Replacement', borderColor: '#fa8c16' },
  critical:           { color: 'red',     label: 'Critical',           borderColor: '#f5222d' },
  end_of_life:        { color: 'default', label: 'End of Life',        borderColor: '#8c8c8c' },
  extended_life:      { color: 'purple',  label: 'Extended Life',      borderColor: '#722ed1' },
  // legacy aliases
  urgent: { color: 'orange', label: 'Urgent',       borderColor: '#fa8c16' },
  eol:    { color: 'default', label: 'End of Life',  borderColor: '#8c8c8c' },
};

const getLifeStageFromPct = (pct) => {
  if (pct >= 100) return 'end_of_life';
  if (pct >= 95)  return 'critical';
  if (pct >= 85)  return 'urgent_replacement';
  if (pct >= 70)  return 'plan_replacement';
  return 'normal';
};

// Compute life% from mold shot counts
const computeLifePct = (m) =>
  (m?.expected_life_shots > 0)
    ? Math.round(((m?.current_shot_count ?? 0) / m.expected_life_shots) * 100)
    : 0;

const getProgressColor = (pct) => {
  if (pct >= 95) return '#f5222d';
  if (pct >= 85) return '#fa8c16';
  if (pct >= 70) return '#faad14';
  return '#52c41a';
};
export default function MoldLifeManagementPage() {
  const { can } = usePermissions();
  const canWrite = can('mold-life_management-create_edit_delete');

  const [dashboard, setDashboard] = useState(null);
  const [molds, setMolds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [extensionSaving, setExtensionSaving] = useState(false);
  const [allMolds, setAllMolds] = useState([]);
  const [extensionForm] = Form.useForm();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMold, setSelectedMold] = useState(null);
  const [moldLifeStatus, setMoldLifeStatus] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configForm] = Form.useForm();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (stageFilter) params.life_stage = stageFilter;
      const data = await moldLifeApi.getDashboard(params);
      setDashboard(data?.summary || data);
      setMolds(Array.isArray(data?.molds) ? data.molds : (Array.isArray(data) ? data : []));
    } catch { message.error('Failed to load life management dashboard'); }
    finally { setLoading(false); }
  }, [search, stageFilter]);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const data = await moldLifeApi.getAlerts();
      setAlerts(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { message.error('Failed to load alerts'); }
    finally { setAlertsLoading(false); }
  }, []);

  const loadAllMolds = useCallback(async () => {
    try {
      const data = await moldMasterApi.getAll({ limit: 500 });
      setAllMolds(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { loadAlerts(); }, [loadAlerts]);
  useEffect(() => { loadAllMolds(); }, [loadAllMolds]);

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await moldLifeApi.acknowledgeAlert(alertId);
      message.success('Alert acknowledged');
      loadAlerts();
    } catch { message.error('Failed to acknowledge alert'); }
  };

  const handleRequestExtension = async () => {
    try {
      const vals = await extensionForm.validateFields();
      setExtensionSaving(true);
      await moldLifeApi.requestLifeExtension(vals.mold_id, { extended_to: vals.extended_to, reason: vals.reason });
      message.success('Life extension requested successfully');
      setExtensionModalOpen(false);
      extensionForm.resetFields();
      loadDashboard();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to request life extension');
    } finally { setExtensionSaving(false); }
  };

  const handleApproveExtension = async (extId) => {
    try {
      await moldLifeApi.approveLifeExtension(extId, { quality_signoff_by: 'current_user' });
      message.success('Life extension approved');
      loadDashboard();
      if (selectedMold) loadMoldLifeStatus(selectedMold.id);
    } catch { message.error('Failed to approve life extension'); }
  };

  const handleMoldClick = (mold) => {
    setSelectedMold(mold);
    setDrawerOpen(true);
    loadMoldLifeStatus(mold.id || mold.mold_id);
  };

  const loadMoldLifeStatus = async (moldId) => {
    setDrawerLoading(true);
    try {
      const data = await moldLifeApi.getLifeStatus(moldId);
      setMoldLifeStatus(data);
      // Sequelize returns associations using PascalCase alias: LifeConfig, LifeAlerts, etc.
      const cfg = data?.LifeConfig ?? data?.life_config;
      if (cfg) {
        configForm.setFieldsValue({
          threshold_70:  cfg.threshold_70  ?? 70,
          threshold_85:  cfg.threshold_85  ?? 85,
          threshold_95:  cfg.threshold_95  ?? 95,
          threshold_100: cfg.threshold_100 ?? 100,
          action_at_100: cfg.action_at_100 ?? 'soft_warning',
        });
      }
    } catch { message.error('Failed to load mold life status'); }
    finally { setDrawerLoading(false); }
  };

  const handleSaveConfig = async () => {
    try {
      const vals = await configForm.validateFields();
      setConfigSaving(true);
      await moldLifeApi.updateLifeConfig(selectedMold?.id || selectedMold?.mold_id, vals);
      message.success('Life configuration updated');
      loadDashboard();
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Failed to update life configuration');
    } finally { setConfigSaving(false); }
  };
  // Resolve each mold's effective life stage using the Mold.life_stage field first,
  // then fall back to computing from shot counts.
  const getMoldStage = (m) =>
    m.life_stage || getLifeStageFromPct(m.ShotSummary?.life_percentage ?? computeLifePct(m));

  const summaryStats = {
    total:            molds.length,
    normal:           molds.filter((m) => getMoldStage(m) === 'normal').length,
    plan_replacement: molds.filter((m) => getMoldStage(m) === 'plan_replacement').length,
    urgent:           molds.filter((m) => getMoldStage(m) === 'urgent_replacement').length,
    critical:         molds.filter((m) => getMoldStage(m) === 'critical').length,
    eol:              molds.filter((m) => ['end_of_life', 'extended_life'].includes(getMoldStage(m))).length,
  };

  const filteredMolds = molds.filter((m) => {
    const q = search.toLowerCase();
    if (q && !(m.mold_code?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q))) return false;
    if (stageFilter && getMoldStage(m) !== stageFilter) return false;
    return true;
  });

  const alertColumns = [
    { title: "Mold", key: "mold", width: 180, render: (_, r) => (<Space direction="vertical" size={0}><Text style={{ fontWeight: 500, fontSize: 13 }}>{r.mold_code || r.mold?.mold_code || "—"}</Text><Text style={{ fontSize: 11, color: "#6b7280" }}>{r.mold_name || r.mold?.name || ""}</Text></Space>) },
    { title: "Alert Type", dataIndex: "alert_type", key: "alert_type", width: 140, render: (val) => { const colors = { warning: "gold", urgent: "orange", critical: "red", eol: "default" }; return <Tag color={colors[val] || "blue"}>{(val || "").replace(/_/g, " ").toUpperCase()}</Tag>; } },
    { title: "Threshold %", dataIndex: "threshold_pct", key: "threshold_pct", width: 100, render: (val) => <Text style={{ fontSize: 12 }}>{val != null ? val + "%" : "—"}</Text> },
    { title: "Shots at Alert", dataIndex: "shot_count_at_alert", key: "shot_count_at_alert", width: 120, render: (val) => <Text style={{ fontSize: 12 }}>{val != null ? Number(val).toLocaleString() : "—"}</Text> },
    { title: "Status", dataIndex: "status", key: "status", width: 120, render: (val) => { const colors = { active: "red", acknowledged: "blue", resolved: "green" }; return <Tag color={colors[val] || "default"}>{(val || "").toUpperCase()}</Tag>; } },
    { title: "Created", dataIndex: "created_at", key: "created_at", width: 150, render: (val) => <Text style={{ fontSize: 12 }}>{fmtDateTime(val)}</Text> },
    ...(canWrite ? [{ title: "Action", key: "action", width: 120, render: (_, r) => r.status === "active" ? (<Button size="small" type="link" icon={<CheckCircleOutlined />} onClick={() => handleAcknowledgeAlert(r.id)}>Acknowledge</Button>) : null }] : []),
  ];

  const pendingExtensions = dashboard?.pending_extensions || [];
  const extensionColumns = [
    { title: "Mold", key: "mold_code", width: 140, render: (_, r) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{r.mold_code || r.mold?.mold_code || "—"}</Text> },
    { title: "From", dataIndex: "extended_from", key: "extended_from", width: 120, render: (val) => <Text style={{ fontSize: 12 }}>{val != null ? Number(val).toLocaleString() : "—"}</Text> },
    { title: "To", dataIndex: "extended_to", key: "extended_to", width: 120, render: (val) => <Text style={{ fontSize: 12 }}>{val != null ? Number(val).toLocaleString() : "—"}</Text> },
    { title: "Reason", dataIndex: "reason", key: "reason", width: 200, ellipsis: true, render: (val) => <Text style={{ fontSize: 12 }}>{val || "—"}</Text> },
    { title: "Status", dataIndex: "status", key: "status", width: 100, render: (val) => { const colors = { pending: "gold", approved: "green", rejected: "red" }; return <Tag color={colors[val] || "default"}>{(val || "").toUpperCase()}</Tag>; } },
    ...(canWrite ? [{ title: "Action", key: "action", width: 110, render: (_, r) => r.status === "pending" ? (<Popconfirm title="Approve this life extension?" onConfirm={() => handleApproveExtension(r.id)} okText="Approve"><Button size="small" type="link" icon={<SafetyCertificateOutlined />}>Approve</Button></Popconfirm>) : null }] : []),
  ];
  return (
    <AppLayout>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Text style={{ color: "#9ca3af", fontSize: 12 }}>Mold</Text>
        <RightOutlined style={{ color: "#d1d5db", fontSize: 10 }} />
        <Text style={{ color: "#6b7280", fontSize: 12 }}>Life Management</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Mold Life Management</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Monitor mold life cycles, alerts, and manage life extensions.</Text>

      <Row gutter={[12, 12]} style={{ marginTop: 16, marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="Total Molds" value={summaryStats.total} valueStyle={{ fontSize: 24, fontWeight: 600 }} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "3px solid #52c41a" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="Normal" value={summaryStats.normal} valueStyle={{ fontSize: 24, fontWeight: 600, color: "#52c41a" }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "3px solid #faad14" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="Plan Replacement" value={summaryStats.plan_replacement} valueStyle={{ fontSize: 24, fontWeight: 600, color: "#faad14" }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "3px solid #fa8c16" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="Urgent" value={summaryStats.urgent} valueStyle={{ fontSize: 24, fontWeight: 600, color: "#fa8c16" }} prefix={<WarningOutlined />} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "3px solid #f5222d" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="Critical" value={summaryStats.critical} valueStyle={{ fontSize: 24, fontWeight: 600, color: "#f5222d" }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "3px solid #8c8c8c" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="End of Life" value={summaryStats.eol} valueStyle={{ fontSize: 24, fontWeight: 600, color: "#8c8c8c" }} prefix={<StopOutlined />} /></Card></Col>
      </Row>

      <Card style={{ border: "1px solid #e8eaed", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }} bodyStyle={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <Input placeholder="Search molds..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240, borderRadius: 8 }} allowClear />
          <Select placeholder="Life Stage" value={stageFilter} onChange={setStageFilter} allowClear style={{ width: 200 }} options={[{ label: "Normal", value: "normal" }, { label: "Plan Replacement", value: "plan_replacement" }, { label: "Urgent Replacement", value: "urgent_replacement" }, { label: "Critical", value: "critical" }, { label: "End of Life", value: "end_of_life" }, { label: "Extended Life", value: "extended_life" }]} />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={() => { loadDashboard(); loadAlerts(); }}>Refresh</Button>
          {canWrite && (<Button type="primary" icon={<PlusOutlined />} onClick={() => setExtensionModalOpen(true)}>Request Extension</Button>)}
        </div>

        {loading ? (<div style={{ textAlign: "center", padding: 40 }}><Text type="secondary">Loading...</Text></div>) : filteredMolds.length === 0 ? (<Empty description="No molds found" />) : (
          <Row gutter={[16, 16]}>
            {filteredMolds.map((mold) => {
              const lifePct = mold.ShotSummary?.life_percentage ?? computeLifePct(mold);
              const stage = getMoldStage(mold);
              const sc = LIFE_STAGE_CONFIG[stage] || LIFE_STAGE_CONFIG.normal;
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={mold.id || mold.mold_id}>
                  <Card hoverable size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "4px solid " + sc.borderColor, cursor: "pointer" }} bodyStyle={{ padding: "14px 16px" }} onClick={() => handleMoldClick(mold)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <Text style={{ fontWeight: 600, fontSize: 14, color: "#1d4ed8", display: "block" }}>{mold.mold_code || "—"}</Text>
                        <Text style={{ fontSize: 12, color: "#6b7280" }}>{mold.name || ""}</Text>
                      </div>
                      <Tag color={sc.color} style={{ margin: 0 }}>{sc.label}</Tag>
                    </div>
                    <Progress percent={Math.min(lifePct, 100)} strokeColor={getProgressColor(lifePct)} size="small" format={() => lifePct + '%'} style={{ marginBottom: 8 }} />
                    <Text style={{ fontSize: 11, color: "#6b7280" }}>{(mold.current_shot_count ?? 0).toLocaleString()} / {(mold.expected_life_shots ?? 0).toLocaleString()} shots</Text>
                    {mold.estimated_remaining_days != null && (<Text style={{ fontSize: 11, color: "#9ca3af", display: "block", marginTop: 4 }}>~{mold.estimated_remaining_days} days remaining</Text>)}
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>
      <Collapse defaultActiveKey={[]} style={{ marginBottom: 16, borderRadius: 12, border: "1px solid #e8eaed" }}>
        <Panel header={<Space><BellOutlined /><Text style={{ fontWeight: 500 }}>Active Alerts</Text><Badge count={alerts.filter((a) => a.status === "active").length} style={{ marginLeft: 4 }} /></Space>} key="alerts">
          <Table dataSource={alerts} columns={alertColumns} rowKey="id" size="small" loading={alertsLoading} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => t + " alerts" }} scroll={{ x: 800 }} />
        </Panel>
      </Collapse>

      <Collapse defaultActiveKey={[]} style={{ marginBottom: 16, borderRadius: 12, border: "1px solid #e8eaed" }}>
        <Panel header={<Space><ThunderboltOutlined /><Text style={{ fontWeight: 500 }}>Pending Life Extensions</Text><Badge count={pendingExtensions.length} style={{ marginLeft: 4 }} /></Space>} key="extensions">
          <Table dataSource={pendingExtensions} columns={extensionColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} scroll={{ x: 700 }} />
        </Panel>
      </Collapse>

      <Modal title="Request Life Extension" open={extensionModalOpen} onCancel={() => { setExtensionModalOpen(false); extensionForm.resetFields(); }} onOk={handleRequestExtension} confirmLoading={extensionSaving} okText="Submit Request" width={480}>
        <Form form={extensionForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="mold_id" label="Select Mold" rules={[{ required: true, message: "Please select a mold" }]}>
            <Select showSearch placeholder="Search and select mold" optionFilterProp="label" options={allMolds.map((m) => ({ label: m.mold_code + " - " + m.name, value: m.id }))} />
          </Form.Item>
          <Form.Item name="extended_to" label="New Expected Life Shots" rules={[{ required: true, message: "Please enter new life shots" }]}>
            <InputNumber style={{ width: "100%" }} min={1} placeholder="Enter new expected life shots" />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: "Please enter a reason" }]}>
            <TextArea rows={3} placeholder="Reason for life extension request..." />
          </Form.Item>
        </Form>
      </Modal>
      <Drawer title={<Text style={{ fontWeight: 600 }}>{selectedMold?.mold_code || "—"} — Life Status</Text>} open={drawerOpen} onClose={() => { setDrawerOpen(false); setSelectedMold(null); setMoldLifeStatus(null); }} width={640} destroyOnClose>
        {drawerLoading ? (<div style={{ textAlign: "center", padding: 40 }}><Text type="secondary">Loading...</Text></div>) : moldLifeStatus ? (
          <>
            <Descriptions title="Mold Information" bordered size="small" column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Mold Code">{moldLifeStatus.mold_code || selectedMold?.mold_code || "—"}</Descriptions.Item>
              <Descriptions.Item label="Name">{moldLifeStatus.name || selectedMold?.name || "—"}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag>{(moldLifeStatus.status || "").toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Life Stage">{(() => { const stg = moldLifeStatus.life_stage || getLifeStageFromPct(moldLifeStatus.life_pct ?? 0); const cfg = LIFE_STAGE_CONFIG[stg] || LIFE_STAGE_CONFIG.normal; return <Tag color={cfg.color}>{cfg.label}</Tag>; })()}</Descriptions.Item>
            </Descriptions>

            <Descriptions title="Shot Summary" bordered size="small" column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Current Shots">{(moldLifeStatus.current_shot_count ?? 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Expected Life">{(moldLifeStatus.expected_life_shots ?? 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Life %" span={2}>{(() => { const pct = moldLifeStatus.ShotSummary?.life_percentage ?? computeLifePct(moldLifeStatus); return <Progress percent={Math.min(pct, 100)} strokeColor={getProgressColor(pct)} format={() => pct + '%'} />; })()}</Descriptions.Item>
              <Descriptions.Item label="Remaining Shots">{(Math.max(0, (moldLifeStatus.expected_life_shots ?? 0) - (moldLifeStatus.current_shot_count ?? 0))).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Est. Remaining Days">{moldLifeStatus.ShotSummary?.estimated_remaining_days ?? "—"}</Descriptions.Item>
            </Descriptions>

            <Divider />
            <div style={{ marginBottom: 16 }}><Text style={{ fontWeight: 600, fontSize: 15 }}><SettingOutlined style={{ marginRight: 6 }} />Life Configuration Thresholds</Text></div>
            <Form form={configForm} layout="vertical">
              <Row gutter={16}>
                <Col span={12}><Form.Item name="threshold_70" label="Plan Replacement (%)" rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: "100%" }} disabled={!canWrite} /></Form.Item></Col>
                <Col span={12}><Form.Item name="threshold_85" label="Urgent (%)" rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: "100%" }} disabled={!canWrite} /></Form.Item></Col>
                <Col span={12}><Form.Item name="threshold_95" label="Critical (%)" rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: "100%" }} disabled={!canWrite} /></Form.Item></Col>
                <Col span={12}><Form.Item name="threshold_100" label="EOL (%)" rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: "100%" }} disabled={!canWrite} /></Form.Item></Col>
                <Col span={24}><Form.Item name="action_at_100" label="Action at 100% Life" rules={[{ required: true }]}><Select disabled={!canWrite} options={[{ label: "Hard Block", value: "hard_block" }, { label: "Soft Warning", value: "soft_warning" }]} /></Form.Item></Col>
              </Row>
              {canWrite && (<Button type="primary" onClick={handleSaveConfig} loading={configSaving}>Save Configuration</Button>)}
            </Form>

            <Divider />
            <div style={{ marginBottom: 12 }}><Text style={{ fontWeight: 600, fontSize: 15 }}>Alert History</Text></div>
            <Table dataSource={moldLifeStatus.LifeAlerts || moldLifeStatus.alerts || []} rowKey="id" size="small" pagination={{ pageSize: 5 }} columns={[
              { title: "Type", dataIndex: "alert_type", key: "alert_type", width: 120, render: (val) => <Tag>{(val || "").replace(/_/g, " ").toUpperCase()}</Tag> },
              { title: "Threshold", dataIndex: "threshold_pct", key: "threshold_pct", width: 80, render: (val) => (val ?? "—") + "%" },
              { title: "Status", dataIndex: "status", key: "status", width: 100, render: (val) => { const cc = { active: "red", acknowledged: "blue", resolved: "green" }; return <Tag color={cc[val] || "default"}>{(val || "").toUpperCase()}</Tag>; } },
              { title: "Date", dataIndex: "created_at", key: "created_at", width: 140, render: (val) => fmtDateTime(val) },
            ]} />

            <Divider />
            <div style={{ marginBottom: 12 }}><Text style={{ fontWeight: 600, fontSize: 15 }}>Extension History</Text></div>
            <Table dataSource={moldLifeStatus.LifeExtensions || moldLifeStatus.extensions || []} rowKey="id" size="small" pagination={{ pageSize: 5 }} columns={[
              { title: "From", dataIndex: "extended_from", key: "extended_from", width: 100, render: (val) => (val != null ? Number(val).toLocaleString() : "—") },
              { title: "To", dataIndex: "extended_to", key: "extended_to", width: 100, render: (val) => (val != null ? Number(val).toLocaleString() : "—") },
              { title: "Reason", dataIndex: "reason", key: "reason", width: 160, ellipsis: true },
              { title: "Status", dataIndex: "status", key: "status", width: 90, render: (val) => { const cc = { pending: "gold", approved: "green", rejected: "red" }; return <Tag color={cc[val] || "default"}>{(val || "").toUpperCase()}</Tag>; } },
              { title: "Date", dataIndex: "created_at", key: "created_at", width: 130, render: (val) => fmtDateTime(val) },
            ]} />
          </>
        ) : (<Empty description="No data available" />)}
      </Drawer>
    </AppLayout>
  );
}
