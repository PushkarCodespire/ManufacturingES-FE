import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Radio, Input, Modal, message,
  Tabs, Tag, Space, Card, Tooltip, Select, Badge,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { trainingEffectivenessApi } from '../../../api/trainingEffectiveness.api';
import AppLayout                    from '../../../components/AppLayout';
import usePermissions               from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

const EVAL_TYPE_LABELS = { day_30: 'Day 30', day_60: 'Day 60', day_90: 'Day 90' };
const EVAL_TYPE_COLORS = { day_30: 'blue', day_60: 'purple', day_90: 'magenta' };
const RESULT_COLORS    = {
  pending:              'default',
  effective:            'green',
  partially_effective:  'orange',
  not_effective:        'red',
};
const RESULT_LABELS    = {
  pending:              'Pending',
  effective:            'Effective',
  partially_effective:  'Partially Effective',
  not_effective:        'Not Effective',
};

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY') : '—');

// ── EVALUATION MODAL ─────────────────────────────────────────────────────────
const EvaluationModal = ({ item, onClose, onDone }) => {
  const [form]    = Form.useForm();
  const [saving, setSaving] = useState(false);

  if (!item) return null;

  const ai = item.ai_metrics || {};
  const hasAI = Object.keys(ai).length > 0 && (ai.before || ai.after);

  const handleSubmit = async () => {
    let values; try { values = await form.validateFields(); } catch { return; }
    setSaving(true);
    try {
      await trainingEffectivenessApi.evaluate(item.id, { result: values.result, evidence: values.evidence, notes: values.notes });
      message.success('Evaluation submitted');
      form.resetFields();
      onDone();
    } catch (err) {
      message.error(err?.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!item}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircleOutlined style={{ color: '#1d4ed8' }} />
          <span style={{ fontWeight: 700 }}>Submit Evaluation</span>
        </div>
      }
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="submit" type="primary" loading={saving} onClick={handleSubmit} style={{ fontWeight: 600 }}>
          Submit Evaluation
        </Button>,
      ]}
      width={600}
    >
      {/* Header info */}
      <div style={{ background: '#f8fafc', border: '1px solid #e8eaed', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>Employee</Text>
            <Text style={{ fontSize: 13, fontWeight: 600 }}>{item.TrainingRecord?.Employee?.name || '—'}</Text>
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>Topic</Text>
            <Text style={{ fontSize: 13, fontWeight: 600 }}>{item.TrainingRecord?.Topic?.name || '—'}</Text>
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>Training Date</Text>
            <Text style={{ fontSize: 13 }}>{fmtDate(item.TrainingRecord?.training_date)}</Text>
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>Evaluation Type</Text>
            <Tag color={EVAL_TYPE_COLORS[item.evaluation_type] || 'default'}>
              {EVAL_TYPE_LABELS[item.evaluation_type] || item.evaluation_type}
            </Tag>
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>Due Date</Text>
            <Text style={{ fontSize: 13, color: dayjs(item.scheduled_date).isBefore(dayjs()) ? '#dc2626' : '#374151' }}>
              {fmtDate(item.scheduled_date)}
            </Text>
          </div>
        </div>
      </div>

      {/* AI Metrics */}
      <div style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
          AI Performance Metrics
        </Text>
        {hasAI ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '6px 10px', border: '1px solid #e8eaed', textAlign: 'left' }}>Metric</th>
                <th style={{ padding: '6px 10px', border: '1px solid #e8eaed', textAlign: 'center', color: '#6b7280' }}>Before</th>
                <th style={{ padding: '6px 10px', border: '1px solid #e8eaed', textAlign: 'center', color: '#16a34a' }}>After</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(ai.before || ai.after || {}).map((key) => (
                <tr key={key}>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8eaed', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8eaed', textAlign: 'center', color: '#6b7280' }}>{ai.before?.[key] ?? '—'}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #e8eaed', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{ai.after?.[key] ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ background: '#f9fafb', border: '1px solid #e8eaed', borderRadius: 6, padding: '10px 14px', textAlign: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>Insufficient data yet</Text>
          </div>
        )}
      </div>

      {/* Form */}
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="result"
          label={<span style={{ fontWeight: 500, fontSize: 13 }}>Evaluation Result *</span>}
          rules={[{ required: true, message: 'Please select a result' }]}
        >
          <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Radio value="effective">
              <Tag color="green">Effective</Tag>
              <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>Training objectives fully met</Text>
            </Radio>
            <Radio value="partially_effective">
              <Tag color="orange">Partially Effective</Tag>
              <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>Some objectives met, improvement needed</Text>
            </Radio>
            <Radio value="not_effective">
              <Tag color="red">Not Effective</Tag>
              <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>Objectives not met, re-training required</Text>
            </Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="evidence" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Evidence / Observations</span>}>
          <Input.TextArea rows={3} placeholder="Describe the evidence for your evaluation…" />
        </Form.Item>

        <Form.Item name="notes" label={<span style={{ fontWeight: 500, fontSize: 13 }}>Additional Notes</span>}>
          <Input.TextArea rows={2} placeholder="Any additional notes…" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ── PENDING TAB ──────────────────────────────────────────────────────────────
const PendingTab = ({ canWrite }) => {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [evalItem, setEvalItem] = useState(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await trainingEffectivenessApi.getPending();
      setItems(res?.data ?? res ?? []);
    } catch (err) { message.error(err?.message || 'Failed to load pending evaluations'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const columns = [
    {
      title: 'Employee', key: 'employee', width: 160,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>{r.TrainingRecord?.Employee?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{r.TrainingRecord?.Employee?.employee_id}</Text>
        </div>
      ),
    },
    {
      title: 'Topic', key: 'topic', width: 150,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 13, display: 'block' }}>{r.TrainingRecord?.Topic?.name || '—'}</Text>
          <Tag color="blue" style={{ fontSize: 10 }}>{r.TrainingRecord?.Topic?.category}</Tag>
        </div>
      ),
    },
    {
      title: 'Training Date', key: 'training_date', width: 130,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{fmtDate(r.TrainingRecord?.training_date)}</Text>,
    },
    {
      title: 'Eval Type', dataIndex: 'evaluation_type', key: 'eval_type', width: 100,
      render: (v) => <Tag color={EVAL_TYPE_COLORS[v] || 'default'}>{EVAL_TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Due Date', dataIndex: 'scheduled_date', key: 'due_date', width: 130,
      render: (v) => {
        const overdue = dayjs(v).isBefore(dayjs(), 'day');
        return (
          <Space size={4}>
            <Text style={{ fontSize: 12, color: overdue ? '#dc2626' : '#374151', fontWeight: overdue ? 600 : 400 }}>
              {fmtDate(v)}
            </Text>
            {overdue && <Badge status="error" text={<Text style={{ fontSize: 10, color: '#dc2626' }}>Overdue</Text>} />}
          </Space>
        );
      },
    },
    {
      title: 'Action', key: 'action', width: 110, align: 'center',
      render: (_, r) => canWrite ? (
        <Button
          type="primary"
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={() => setEvalItem(r)}
          style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}
        >
          Evaluate
        </Button>
      ) : <Text style={{ color: '#9ca3af', fontSize: 12 }}>Read-only</Text>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <Tag>Pending: {items.length}</Tag>
        <Tag color="red">Overdue: {items.filter((i) => dayjs(i.scheduled_date).isBefore(dayjs(), 'day')).length}</Tag>
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={fetchPending}>Refresh</Button>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} pending` }}
          scroll={{ x: 800 }}
          size="middle"
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <ClockCircleOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No pending evaluations — all caught up!</Text>
              </div>
            ),
          }}
        />
      </Card>

      <EvaluationModal
        item={evalItem}
        onClose={() => setEvalItem(null)}
        onDone={() => { setEvalItem(null); fetchPending(); }}
      />
    </div>
  );
};

// ── HISTORY TAB ──────────────────────────────────────────────────────────────
const HistoryTab = () => {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [resFilter, setResFilter] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (resFilter) params.result = resFilter;
      const res = await trainingEffectivenessApi.getHistory(params);
      setItems(res?.data ?? res ?? []);
    } catch (err) { message.error(err?.message || 'Failed to load history'); }
    finally { setLoading(false); }
  }, [resFilter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const columns = [
    {
      title: 'Employee', key: 'employee', width: 160,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>{r.TrainingRecord?.Employee?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{r.TrainingRecord?.Employee?.employee_id}</Text>
        </div>
      ),
    },
    {
      title: 'Topic', key: 'topic', width: 150,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.TrainingRecord?.Topic?.name || '—'}</Text>,
    },
    {
      title: 'Eval Type', dataIndex: 'evaluation_type', key: 'eval_type', width: 100,
      render: (v) => <Tag color={EVAL_TYPE_COLORS[v] || 'default'}>{EVAL_TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Result', dataIndex: 'result', key: 'result', width: 160,
      render: (v) => <Tag color={RESULT_COLORS[v] || 'default'}>{RESULT_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Completed', dataIndex: 'completed_date', key: 'completed_date', width: 130,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{fmtDate(v)}</Text>,
    },
    {
      title: 'Evaluator', key: 'evaluator', width: 140,
      render: (_, r) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{r.Evaluator?.name || '—'}</Text>,
    },
    {
      title: 'Evidence', dataIndex: 'evidence', key: 'evidence', ellipsis: true,
      render: (v) => <Text style={{ fontSize: 12, color: '#9ca3af' }}>{v || '—'}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          placeholder="Filter by result"
          allowClear
          options={[
            { value: 'effective',           label: 'Effective' },
            { value: 'partially_effective', label: 'Partially Effective' },
            { value: 'not_effective',       label: 'Not Effective' },
          ]}
          onChange={setResFilter}
          style={{ width: 180 }}
        />
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={fetchHistory} style={{ borderRadius: 8 }}>Refresh</Button>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          scroll={{ x: 900 }}
          size="middle"
          locale={{
            emptyText: (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No evaluation history yet</Text>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
const EffectivenessPage = () => {
  const { can } = usePermissions();
  const canWrite = can('other-effectiveness-create_edit_delete');

  const tabItems = [
    {
      key: 'pending',
      label: (
        <Space>
          <ClockCircleOutlined />
          Pending Evaluations
        </Space>
      ),
      children: <PendingTab canWrite={canWrite} />,
    },
    {
      key: 'history',
      label: (
        <Space>
          <CheckCircleOutlined />
          Evaluation History
        </Space>
      ),
      children: <HistoryTab />,
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>HR &amp; Training</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Effectiveness</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Training Effectiveness</Title>
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 20 }}>
        Evaluate 30/60/90-day effectiveness of completed training.
      </Text>

      <Tabs
        defaultActiveKey="pending"
        items={tabItems}
        style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8eaed', padding: '0 20px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      />
    </AppLayout>
  );
};

export default EffectivenessPage;
