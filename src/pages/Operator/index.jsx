import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Row, Col, Tag, Progress, Modal, InputNumber,
  Input, Select, Empty, Spin, message, Statistic,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  RightOutlined,
  ToolOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import api from '../../api/axios';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import useScreen from '../../hooks/useScreen';

const { Title, Text } = Typography;

const STATUS_COLOR = {
  open: 'blue',
  in_progress: 'green',
  closed: 'default',
  cancelled: 'red',
};

// ── Touch-friendly button style ─────────────────────────────────────────────
const touchBtn = {
  height: 56,
  fontSize: 16,
  borderRadius: 14,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

const touchCard = {
  borderRadius: 16,
  border: '1px solid #e8eaed',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

export default function OperatorDashboard() {
  const { user } = useAuth();
  const { isMobile } = useScreen();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState({ activeJobs: 0, todayProduced: 0, pendingBreakdowns: 0 });
  const [equipment, setEquipment] = useState([]);

  // Modal states
  const [logModal, setLogModal] = useState({ open: false, job: null });
  const [logQtyGood, setLogQtyGood] = useState(0);
  const [logQtyRejected, setLogQtyRejected] = useState(0);
  const [logLoading, setLogLoading] = useState(false);

  const [breakdownModal, setBreakdownModal] = useState(false);
  const [bdEquipment, setBdEquipment] = useState(null);
  const [bdSymptoms, setBdSymptoms] = useState('');
  const [bdLoading, setBdLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, summaryRes, equipRes] = await Promise.allSettled([
        api.get('/operator/my-jobs'),
        api.get('/operator/summary'),
        api.get('/operator/equipment'),
      ]);
      if (jobsRes.status === 'fulfilled') setJobs(jobsRes.value.data || []);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data || {});
      if (equipRes.status === 'fulfilled') {
        setEquipment((equipRes.value.data || []).map(e => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` })));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Log Production ──────────────────────────────────────────────────────────
  const openLogModal = (job) => {
    setLogModal({ open: true, job });
    setLogQtyGood(0);
    setLogQtyRejected(0);
  };

  const submitLog = async () => {
    if (logQtyGood <= 0) return message.warning('Enter quantity produced');
    setLogLoading(true);
    try {
      await api.post('/operator/log-production', {
        job_card_id: logModal.job.id,
        qty_good: logQtyGood,
        qty_rejected: logQtyRejected,
      });
      message.success('Production logged!');
      setLogModal({ open: false, job: null });
      fetchData();
    } catch (err) {
      message.error(err?.message || 'Failed to log');
    } finally {
      setLogLoading(false);
    }
  };

  // ── Report Breakdown ────────────────────────────────────────────────────────
  const submitBreakdown = async () => {
    if (!bdEquipment || !bdSymptoms) return message.warning('Select equipment and describe the issue');
    setBdLoading(true);
    try {
      await api.post('/operator/report-breakdown', {
        equipment_id: bdEquipment,
        symptoms: bdSymptoms,
      });
      message.success('Breakdown reported!');
      setBreakdownModal(false);
      setBdEquipment(null);
      setBdSymptoms('');
      fetchData();
    } catch (err) {
      message.error(err?.message || 'Failed to report');
    } finally {
      setBdLoading(false);
    }
  };

  const pad = isMobile ? 12 : 24;

  return (
    <AppLayout>
    <div style={{ padding: pad, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Operator Panel</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>
              <DashboardOutlined style={{ marginRight: 8 }} />
              Operator Panel
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Welcome, {user?.full_name || user?.employee_id}
            </Text>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
            style={{ borderRadius: 10, height: 40 }}
          >
            {!isMobile && 'Refresh'}
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={8}>
          <Card style={{ ...touchCard, textAlign: 'center' }} bodyStyle={{ padding: isMobile ? '12px 8px' : '16px' }}>
            <Statistic
              title={<Text style={{ fontSize: isMobile ? 11 : 13, color: '#6b7280' }}>Active Jobs</Text>}
              value={summary.activeJobs}
              valueStyle={{ color: '#1d4ed8', fontSize: isMobile ? 24 : 32, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card style={{ ...touchCard, textAlign: 'center' }} bodyStyle={{ padding: isMobile ? '12px 8px' : '16px' }}>
            <Statistic
              title={<Text style={{ fontSize: isMobile ? 11 : 13, color: '#6b7280' }}>Produced Today</Text>}
              value={summary.todayProduced}
              valueStyle={{ color: '#16a34a', fontSize: isMobile ? 24 : 32, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card style={{ ...touchCard, textAlign: 'center' }} bodyStyle={{ padding: isMobile ? '12px 8px' : '16px' }}>
            <Statistic
              title={<Text style={{ fontSize: isMobile ? 11 : 13, color: '#6b7280' }}>Breakdowns</Text>}
              value={summary.pendingBreakdowns}
              valueStyle={{ color: summary.pendingBreakdowns > 0 ? '#dc2626' : '#6b7280', fontSize: isMobile ? 24 : 32, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12}>
          <Button
            type="primary"
            block
            icon={<WarningOutlined />}
            style={{ ...touchBtn, background: '#dc2626', borderColor: '#dc2626' }}
            onClick={() => setBreakdownModal(true)}
          >
            Report Breakdown
          </Button>
        </Col>
        <Col xs={12}>
          <Button
            type="primary"
            block
            icon={<ThunderboltOutlined />}
            style={{ ...touchBtn, background: '#d97706', borderColor: '#d97706' }}
            onClick={() => {
              if (jobs.length > 0) openLogModal(jobs[0]);
              else message.info('No active jobs to log production');
            }}
          >
            Quick Log
          </Button>
        </Col>
      </Row>

      {/* My Active Jobs */}
      <Title level={5} style={{ margin: '0 0 12px' }}>
        <ToolOutlined style={{ marginRight: 6 }} />
        My Active Jobs
      </Title>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
      ) : jobs.length === 0 ? (
        <Card style={touchCard}>
          <Empty description="No active jobs assigned to you" />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {jobs.map((job) => {
            const wo = job.WorkOrder;
            const item = wo?.Item;
            const planned = Number(wo?.planned_qty) || 0;
            const produced = Number(job.qty_produced) || 0;
            const pct = planned > 0 ? Math.round((produced / planned) * 100) : 0;

            return (
              <Card
                key={job.id}
                style={touchCard}
                bodyStyle={{ padding: isMobile ? 14 : 20 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <Text strong style={{ fontSize: 16, color: '#1d4ed8' }}>{job.job_no}</Text>
                    <div style={{ marginTop: 2 }}>
                      <Tag color={STATUS_COLOR[job.status] || 'default'} style={{ fontSize: 11 }}>
                        {job.status?.toUpperCase()}
                      </Tag>
                    </div>
                  </div>
                  {job.Machine && (
                    <Tag style={{ borderRadius: 8, fontSize: 12 }}>
                      {job.Machine.code}
                    </Tag>
                  )}
                </div>

                {wo && (
                  <div style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>
                      WO: {wo.wo_no}
                    </Text>
                    {item && (
                      <Text style={{ fontSize: 13, color: '#374151', display: 'block' }}>
                        {item.code} — {item.name}
                      </Text>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>Progress</Text>
                    <Text style={{ fontSize: 12, fontWeight: 600 }}>
                      {produced} / {planned}
                    </Text>
                  </div>
                  <Progress
                    percent={pct}
                    strokeColor={pct >= 100 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'}
                    size="small"
                    style={{ margin: 0 }}
                  />
                </div>

                <Button
                  type="primary"
                  block
                  icon={<PlayCircleOutlined />}
                  style={{ ...touchBtn, height: 48, fontSize: 15 }}
                  onClick={() => openLogModal(job)}
                >
                  Log Production
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Log Production Modal */}
      <Modal
        title="Log Production"
        open={logModal.open}
        onCancel={() => setLogModal({ open: false, job: null })}
        footer={null}
        centered
        width={isMobile ? '95%' : 420}
      >
        {logModal.job && (
          <div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f0f5ff', borderRadius: 10 }}>
              <Text strong style={{ fontSize: 15 }}>{logModal.job.job_no}</Text>
              {logModal.job.WorkOrder && (
                <Text style={{ display: 'block', fontSize: 13, color: '#6b7280' }}>
                  WO: {logModal.job.WorkOrder.wo_no} — {logModal.job.WorkOrder.Item?.name || ''}
                </Text>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Good Quantity *</Text>
              <InputNumber
                value={logQtyGood}
                onChange={setLogQtyGood}
                min={0}
                style={{ width: '100%', height: 48, fontSize: 18 }}
                size="large"
                placeholder="Enter good qty"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <Text style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Rejected Quantity</Text>
              <InputNumber
                value={logQtyRejected}
                onChange={setLogQtyRejected}
                min={0}
                style={{ width: '100%', height: 48, fontSize: 18 }}
                size="large"
                placeholder="Enter rejected qty"
              />
            </div>

            <Button
              type="primary"
              block
              size="large"
              loading={logLoading}
              onClick={submitLog}
              style={{ ...touchBtn, background: '#16a34a', borderColor: '#16a34a' }}
              icon={<CheckCircleOutlined />}
            >
              Submit Production
            </Button>
          </div>
        )}
      </Modal>

      {/* Report Breakdown Modal */}
      <Modal
        title="Report Breakdown"
        open={breakdownModal}
        onCancel={() => setBreakdownModal(false)}
        footer={null}
        centered
        width={isMobile ? '95%' : 420}
      >
        <div style={{ marginBottom: 16 }}>
          <Text style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Equipment *</Text>
          <Select
            value={bdEquipment}
            onChange={setBdEquipment}
            options={equipment}
            placeholder="Select equipment"
            style={{ width: '100%' }}
            size="large"
            showSearch
            filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Text style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Symptoms / Issue *</Text>
          <Input.TextArea
            value={bdSymptoms}
            onChange={e => setBdSymptoms(e.target.value)}
            rows={3}
            placeholder="Describe what's wrong..."
            style={{ fontSize: 15, borderRadius: 10 }}
          />
        </div>

        <Button
          type="primary"
          block
          size="large"
          loading={bdLoading}
          onClick={submitBreakdown}
          style={{ ...touchBtn, background: '#dc2626', borderColor: '#dc2626' }}
          icon={<WarningOutlined />}
        >
          Submit Breakdown Report
        </Button>
      </Modal>
    </div>
    </AppLayout>
  );
}
