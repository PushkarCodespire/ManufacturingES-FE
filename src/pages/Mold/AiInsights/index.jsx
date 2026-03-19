import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Modal, message, Row, Col, Progress, Tooltip, Statistic,
  Descriptions, Divider, Empty, Select, Form, Badge, Alert,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, RightOutlined, RobotOutlined,
  ThunderboltOutlined, CheckCircleOutlined, WarningOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined, LikeOutlined,
  DislikeOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { moldAiApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { TextArea } = Input;

const fmtDate = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '—');
const fmtNum  = (n) => (n != null ? Number(n).toLocaleString() : '—');

// ── Confidence badge ─────────────────────────────────────────────────────────
const CONFIDENCE_CONFIG = {
  high:   { color: 'green',  label: 'High Confidence',   icon: <CheckCircleOutlined /> },
  medium: { color: 'orange', label: 'Medium Confidence', icon: <WarningOutlined />     },
  low:    { color: 'red',    label: 'Low Confidence',    icon: <ExclamationCircleOutlined /> },
};

const ConfidenceBadge = ({ level }) => {
  const cfg = CONFIDENCE_CONFIG[level] || CONFIDENCE_CONFIG.low;
  return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
};

// ── Life ratio bar ───────────────────────────────────────────────────────────
const LifeRatioBar = ({ rated, predicted }) => {
  if (!rated || rated <= 0) return <Text type="secondary">—</Text>;
  const ratio = Math.min(Math.max(predicted / rated, 0), 1.5);
  const pct   = Math.round(ratio * 100);
  const color = pct >= 100 ? '#52c41a' : pct >= 85 ? '#faad14' : '#f5222d';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: 11, color: '#6b7280' }}>Rated: {fmtNum(rated)}</Text>
        <Text style={{ fontSize: 11, color }}>Predicted: {fmtNum(predicted)}</Text>
      </div>
      <Progress percent={Math.min(pct, 100)} strokeColor={color} size="small" format={() => pct + '%'} />
    </div>
  );
};

export default function AiInsightsPage() {
  const { can } = usePermissions();
  const canGenerate = can('mold-ai_insights-create_edit_delete');
  const canFeedback = can('mold-ai_insights-create_edit_delete');

  const [molds,          setMolds]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [search,         setSearch]         = useState('');
  const [confFilter,     setConfFilter]     = useState(null);
  const [generating,     setGenerating]     = useState({});

  // Detail drawer
  const [drawerOpen,      setDrawerOpen]     = useState(false);
  const [drawerMold,      setDrawerMold]     = useState(null);
  const [drawerData,      setDrawerData]     = useState(null);
  const [drawerLoading,   setDrawerLoading]  = useState(false);

  // Feedback modal
  const [feedbackOpen,    setFeedbackOpen]   = useState(false);
  const [feedbackPred,    setFeedbackPred]   = useState(null);
  const [feedbackMoldId,  setFeedbackMoldId] = useState(null);
  const [feedbackSaving,  setFeedbackSaving] = useState(false);
  const [feedbackForm]  = Form.useForm();

  // ── Load dashboard ───────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await moldAiApi.getDashboard();
      const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setMolds(rows);
    } catch (err) { message.error(err?.message || 'Failed to load AI insights dashboard'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // ── Generate prediction for one mold ────────────────────────────────────
  const handleGenerate = async (moldId, force = false) => {
    setGenerating((p) => ({ ...p, [moldId]: true }));
    try {
      await moldAiApi.generatePrediction(moldId, { force });
      message.success('Prediction generated');
      loadDashboard();
      // If drawer is open for this mold, refresh it too
      if (drawerMold?.id === moldId) openDrawer(drawerMold);
    } catch (err) {
      message.error(err?.message || 'Failed to generate prediction');
    } finally {
      setGenerating((p) => ({ ...p, [moldId]: false }));
    }
  };

  // ── Open detail drawer ───────────────────────────────────────────────────
  const openDrawer = async (mold) => {
    setDrawerMold(mold);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await moldAiApi.getMoldPrediction(mold.id);
      setDrawerData(res?.data || res);
    } catch (err) { message.error(err?.message || 'Failed to load mold prediction detail'); }
    finally   { setDrawerLoading(false); }
  };

  // ── Submit feedback ──────────────────────────────────────────────────────
  const openFeedback = (moldId, pred) => {
    setFeedbackMoldId(moldId);
    setFeedbackPred(pred);
    feedbackForm.resetFields();
    setFeedbackOpen(true);
  };

  const handleFeedbackSubmit = async () => {
    try {
      const vals = await feedbackForm.validateFields();
      setFeedbackSaving(true);
      await moldAiApi.submitFeedback(feedbackMoldId, feedbackPred.id, vals);
      message.success('Feedback submitted — thank you!');
      setFeedbackOpen(false);
      if (drawerOpen) openDrawer(drawerMold);
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed to submit feedback');
    } finally { setFeedbackSaving(false); }
  };

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = molds.filter((m) => {
    const q = search.toLowerCase();
    if (q && !(m.mold_code?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q))) return false;
    if (confFilter && m.latestPrediction?.confidence_level !== confFilter) return false;
    return true;
  });

  // ── Summary stats ────────────────────────────────────────────────────────
  const withPrediction  = molds.filter((m) => m.latestPrediction).length;
  const highConf        = molds.filter((m) => m.latestPrediction?.confidence_level === 'high').length;
  const actionNeeded    = molds.filter((m) => {
    const p = m.latestPrediction;
    if (!p || !p.rated_remaining_shots) return false;
    return p.predicted_remaining_shots / p.rated_remaining_shots < 0.85;
  }).length;

  // ── Table columns ────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Mold', key: 'mold', width: 180,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontWeight: 600, color: '#1d4ed8', fontSize: 13 }}>{r.mold_code}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280' }}>{r.name}</Text>
          <Tag style={{ fontSize: 10, marginTop: 2 }}>{r.Category?.name || '—'}</Tag>
        </Space>
      ),
    },
    {
      title: 'Current Shots', key: 'shots', width: 130, align: 'right',
      render: (_, r) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{fmtNum(r.current_shot_count)}</Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>of {fmtNum(r.expected_life_shots)}</Text>
          <Text style={{ fontSize: 11, color: '#1d4ed8' }}>
            {r.ShotSummary?.life_percentage != null ? r.ShotSummary.life_percentage + '% used' : '—'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Predicted vs Rated Remaining', key: 'prediction', width: 260,
      render: (_, r) => {
        const p = r.latestPrediction;
        if (!p) return <Text type="secondary" style={{ fontSize: 12 }}>No prediction yet</Text>;
        return <LifeRatioBar rated={p.rated_remaining_shots} predicted={p.predicted_remaining_shots} />;
      },
    },
    {
      title: 'Confidence', key: 'confidence', width: 160,
      render: (_, r) => {
        const p = r.latestPrediction;
        if (!p) return <Tag color="default">N/A</Tag>;
        return (
          <Space direction="vertical" size={2}>
            <ConfidenceBadge level={p.confidence_level} />
            <Text style={{ fontSize: 11, color: '#9ca3af' }}>
              {p.generated_at ? fmtDate(p.generated_at) : ''}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Predicted Replacement', key: 'replacement', width: 160,
      render: (_, r) => {
        const p = r.latestPrediction;
        if (!p) return <Text type="secondary">—</Text>;
        if (!p.predicted_replacement_date) {
          return (
            <Tooltip title="Date estimate requires avg shots/day data. Generate predictions after production runs begin to see this.">
              <Text type="secondary" style={{ fontSize: 11, cursor: 'default' }}>
                — <ClockCircleOutlined style={{ color: '#d1d5db' }} />
              </Text>
            </Tooltip>
          );
        }
        const daysLeft = dayjs(p.predicted_replacement_date).diff(dayjs(), 'day');
        const urgent   = daysLeft < 30;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12, color: urgent ? '#f5222d' : '#1d4ed8', fontWeight: 500 }}>
              {fmtDate(p.predicted_replacement_date)}
            </Text>
            <Text style={{ fontSize: 11, color: urgent ? '#f5222d' : '#9ca3af' }}>
              {daysLeft > 0 ? `in ${daysLeft} days` : 'overdue'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Recommendation', key: 'recommendation', width: 260,
      render: (_, r) => {
        const p = r.latestPrediction;
        if (!p?.recommended_action) return <Text type="secondary">—</Text>;
        const isUrgent = p.recommended_action.toLowerCase().startsWith('urgent');
        return (
          <Text style={{ fontSize: 11, color: isUrgent ? '#f5222d' : '#374151' }}>
            {p.recommended_action}
          </Text>
        );
      },
    },
    {
      title: 'Actions', key: 'actions', width: 160, fixed: 'right',
      render: (_, r) => (
        <Space size={4} direction="vertical">
          <Button size="small" icon={<InfoCircleOutlined />} onClick={() => openDrawer(r)}>
            Details
          </Button>
          {canGenerate && (
            <Button
              size="small"
              type="primary"
              icon={<RobotOutlined />}
              loading={!!generating[r.id]}
              onClick={() => handleGenerate(r.id, !!r.latestPrediction)}
            >
              {r.latestPrediction ? 'Regenerate' : 'Generate'}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Mold</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>AI Insights</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>
        <RobotOutlined style={{ marginRight: 8, color: '#1d4ed8' }} />
        AI Predictive Mold Life
      </Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Heuristic predictions of actual remaining mold life based on rejection trends, repair history, and production intensity.
      </Text>

      {/* Summary tiles */}
      <Row gutter={[12, 12]} style={{ marginTop: 16, marginBottom: 16 }}>
        <Col xs={12} sm={6} md={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e8eaed' }} bodyStyle={{ padding: '12px 16px' }}>
            <Statistic title="Total Molds" value={molds.length} valueStyle={{ fontSize: 22, fontWeight: 600 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e8eaed', borderLeft: '3px solid #1d4ed8' }} bodyStyle={{ padding: '12px 16px' }}>
            <Statistic title="With Predictions" value={withPrediction} valueStyle={{ fontSize: 22, fontWeight: 600, color: '#1d4ed8' }} prefix={<RobotOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e8eaed', borderLeft: '3px solid #52c41a' }} bodyStyle={{ padding: '12px 16px' }}>
            <Statistic title="High Confidence" value={highConf} valueStyle={{ fontSize: 22, fontWeight: 600, color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={6}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e8eaed', borderLeft: '3px solid #f5222d' }} bodyStyle={{ padding: '12px 16px' }}>
            <Statistic title="Action Needed" value={actionNeeded} valueStyle={{ fontSize: 22, fontWeight: 600, color: '#f5222d' }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search molds..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Confidence"
            value={confFilter}
            onChange={setConfFilter}
            allowClear
            style={{ width: 180 }}
            options={[
              { label: 'High Confidence',   value: 'high'   },
              { label: 'Medium Confidence', value: 'medium' },
              { label: 'Low Confidence',    value: 'low'    },
            ]}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={loadDashboard}>Refresh</Button>
        </div>

        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} molds` }}
        />
      </Card>

      {/* ── Detail Drawer ─────────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <RobotOutlined style={{ color: '#1d4ed8' }} />
            <Text style={{ fontWeight: 600 }}>{drawerMold?.mold_code} — AI Insights</Text>
          </Space>
        }
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDrawerMold(null); setDrawerData(null); }}
        width={640}
        destroyOnClose
      >
        {drawerLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Text type="secondary">Loading...</Text></div>
        ) : drawerData ? (
          <>
            {/* Latest prediction */}
            {drawerData.prediction ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontWeight: 600, fontSize: 15 }}>Latest Prediction</Text>
                  <Space>
                    <ConfidenceBadge level={drawerData.prediction.confidence_level} />
                    <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                      {fmtDate(drawerData.prediction.generated_at)}
                    </Text>
                  </Space>
                </div>

                <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                  <Descriptions.Item label="Rated Remaining">
                    <Text strong>{fmtNum(drawerData.prediction.rated_remaining_shots)} shots</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Predicted Remaining">
                    <Text strong style={{ color: drawerData.prediction.predicted_remaining_shots < drawerData.prediction.rated_remaining_shots * 0.85 ? '#f5222d' : '#52c41a' }}>
                      {fmtNum(drawerData.prediction.predicted_remaining_shots)} shots
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Predicted Replacement" span={2}>
                    {drawerData.prediction.predicted_replacement_date
                      ? <Text strong>{fmtDate(drawerData.prediction.predicted_replacement_date)}</Text>
                      : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Model Version" span={2}>
                    {drawerData.prediction.model_version || 'v1.0'}
                  </Descriptions.Item>
                </Descriptions>

                {/* Recommended action */}
                <Alert
                  message="Recommended Action"
                  description={drawerData.prediction.recommended_action}
                  type={drawerData.prediction.recommended_action?.toLowerCase().startsWith('urgent') ? 'error' : 'info'}
                  icon={<ThunderboltOutlined />}
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 8 }}
                />

                {/* Contributing signals */}
                <div style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>
                    <InfoCircleOutlined style={{ marginRight: 6, color: '#1d4ed8' }} />
                    Contributing Signals
                  </Text>
                  {(drawerData.prediction.contributing_signals || []).map((signal, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '6px 10px', background: '#f9fafb', borderRadius: 6 }}>
                      <Text style={{ fontSize: 12, color: '#374151' }}>{signal}</Text>
                    </div>
                  ))}
                </div>

                {/* Prediction life ratio bar */}
                <div style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>Rated vs Predicted Remaining Life</Text>
                  <LifeRatioBar
                    rated={drawerData.prediction.rated_remaining_shots}
                    predicted={drawerData.prediction.predicted_remaining_shots}
                  />
                </div>

                {/* Feedback buttons */}
                {canFeedback && (
                  <div style={{ marginBottom: 16 }}>
                    <Text style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8 }}>Was this prediction accurate?</Text>
                    <Space>
                      <Button
                        size="small"
                        icon={<LikeOutlined />}
                        onClick={() => openFeedback(drawerMold?.id, drawerData.prediction)}
                      >
                        Give Feedback
                      </Button>
                    </Space>
                  </div>
                )}

                <Divider />

                {/* Feedback history */}
                <div style={{ marginBottom: 12 }}>
                  <Text style={{ fontWeight: 600, fontSize: 13 }}>Feedback History ({(drawerData.feedback || []).length})</Text>
                </div>
                {(drawerData.feedback || []).length === 0 ? (
                  <Empty description="No feedback submitted yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Table
                    dataSource={drawerData.feedback}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={[
                      {
                        title: 'Type', dataIndex: 'feedback_type', key: 'type', width: 120,
                        render: (v) => {
                          const colors = { accurate: 'green', too_early: 'orange', too_late: 'red' };
                          return <Tag color={colors[v] || 'default'}>{(v || '').replace(/_/g, ' ').toUpperCase()}</Tag>;
                        },
                      },
                      { title: 'Notes', dataIndex: 'supervisor_notes', key: 'notes', ellipsis: true, render: (v) => v || '—' },
                      { title: 'By', key: 'by', width: 120, render: (_, r) => r.GivenBy?.name || '—' },
                      { title: 'Date', dataIndex: 'given_at', key: 'date', width: 110, render: (v) => fmtDate(v) },
                    ]}
                  />
                )}
              </>
            ) : (
              <Empty
                description={
                  <Space direction="vertical" align="center">
                    <Text>No prediction generated yet for this mold.</Text>
                    {canGenerate && (
                      <Button
                        type="primary"
                        icon={<RobotOutlined />}
                        loading={!!generating[drawerMold?.id]}
                        onClick={() => handleGenerate(drawerMold?.id)}
                      >
                        Generate First Prediction
                      </Button>
                    )}
                  </Space>
                }
              />
            )}
          </>
        ) : (
          <Empty description="No data" />
        )}
      </Drawer>

      {/* ── Feedback Modal ────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <LikeOutlined />
            <span>Prediction Feedback</span>
          </Space>
        }
        open={feedbackOpen}
        onCancel={() => setFeedbackOpen(false)}
        onOk={handleFeedbackSubmit}
        confirmLoading={feedbackSaving}
        okText="Submit Feedback"
        width={440}
        destroyOnClose
      >
        <Form form={feedbackForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="feedback_type"
            label="How accurate was this prediction?"
            rules={[{ required: true, message: 'Please select a feedback type' }]}
          >
            <Select
              options={[
                { label: '✅ Accurate — prediction matched reality',      value: 'accurate'   },
                { label: '⚠️ Too Early — predicted EOL before actual EOL', value: 'too_early'  },
                { label: '⏰ Too Late — predicted EOL after actual EOL',   value: 'too_late'   },
              ]}
            />
          </Form.Item>
          <Form.Item name="supervisor_notes" label="Notes (optional)">
            <TextArea rows={3} placeholder="Any observations about this prediction..." maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
}
