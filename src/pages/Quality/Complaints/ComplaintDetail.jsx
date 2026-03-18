import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography, Card, Button, Descriptions, Tag, message,
  Form, DatePicker, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, RightOutlined, LinkOutlined, BulbOutlined,
} from '@ant-design/icons';
import AppLayout          from '../../../components/AppLayout';
import usePermissions     from '../../../hooks/usePermissions';
import { complaintApi }   from '../../../api/quality.api';
import aiApi              from '../../../api/ai.api';
import useAiSuggestion    from '../../../hooks/useAiSuggestion';
import AiSuggestionCard   from '../../../components/AiSuggestion/AiSuggestionCard';

const { Title, Text } = Typography;

/**
 * Backend sometimes returns ai_insight as { raw_text: "```json\n{...}\n```" }
 * instead of a pre-parsed object. This helper normalises both cases.
 */
const parseInsight = (raw) => {
  if (!raw || typeof raw !== 'object') return {};
  if (!raw.raw_text) return raw; // already a parsed object
  try {
    const clean = raw.raw_text
      .replace(/^```json\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    return JSON.parse(clean);
  } catch {
    return raw;
  }
};

const STATUS_COLOR = {
  received: 'orange', acknowledged: 'blue', investigating: 'purple',
  resolved: 'cyan',   closed: 'green',       rejected: 'red',
};

const SEVERITY_COLOR = { critical: 'red', major: 'orange', minor: 'default' };

export default function ComplaintDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { can }  = usePermissions();
  const canWrite = can('quality-complaints-create_edit_delete');

  const [complaint, setComplaint] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [form]                    = Form.useForm();

  // ── AI: Closure summary ─────────────────────────────────────────────────────
  const aiSummary = useAiSuggestion(aiApi.getComplaintAiSummary);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await complaintApi.getById(id);
      setComplaint(data);
    } catch (err) { message.error(err?.message || 'Failed to load complaint'); }
    finally   { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Acknowledge ────────────────────────────────────────────────────────────
  const onAcknowledge = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const result = await complaintApi.acknowledge(id, {
        response_due: vals.response_due?.format('YYYY-MM-DD'),
      });
      message.success('Complaint acknowledged — response deadline set');
      if (result?.ncr_no) message.info(`NCR ${result.ncr_no} auto-created for this complaint`);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Acknowledge failed');
    } finally { setSaving(false); }
  };

  if (loading)    return <AppLayout><div style={{ padding: 40, color: '#6b7280' }}>Loading…</div></AppLayout>;
  if (!complaint) return <AppLayout><div style={{ padding: 40, color: '#ef4444' }}>Complaint not found.</div></AppLayout>;

  const capa             = complaint.CAPA ?? null;
  const showAcknowledge  = canWrite && complaint.status === 'received';

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text
          style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
          onClick={() => navigate('/quality/complaints')}
        >
          Customer Complaints
        </Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{complaint.complaint_no}</Text>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quality/complaints')}>Back</Button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Title level={3} style={{ margin: 0 }}>{complaint.complaint_no}</Title>
            <Tag color={STATUS_COLOR[complaint.status] ?? 'default'} style={{ fontSize: 13 }}>
              {complaint.status?.replace(/_/g, ' ')}
            </Tag>
            <Tag color={SEVERITY_COLOR[complaint.severity] ?? 'default'}>
              {complaint.severity}
            </Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>Customer Complaint Detail</Text>
        </div>
      </div>

      {/* Card 1 — Complaint Info */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
        bodyStyle={{ padding: '16px 20px' }}
        title="Complaint Information"
      >
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Complaint No.">{complaint.complaint_no}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={STATUS_COLOR[complaint.status] ?? 'default'}>{complaint.status?.replace(/_/g, ' ')}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Customer">
            {complaint.Customer?.name ?? complaint.customer_name ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Customer Ref. No.">{complaint.customer_ref_no || '—'}</Descriptions.Item>
          <Descriptions.Item label="Severity">
            <Tag color={SEVERITY_COLOR[complaint.severity] ?? 'default'}>{complaint.severity}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Received Date">{complaint.received_date || '—'}</Descriptions.Item>
          <Descriptions.Item label="Response Due">{complaint.response_due || '—'}</Descriptions.Item>
          <Descriptions.Item label="Raised By">{complaint.RaisedBy?.name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Part / Item">
            {complaint.Item ? `${complaint.Item.part_no} — ${complaint.Item.name}` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Qty Affected">{complaint.qty_affected ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Delivery Date">{complaint.delivery_date || '—'}</Descriptions.Item>
          <Descriptions.Item label="Vehicle Reg. No.">{complaint.vehicle_reg_no || '—'}</Descriptions.Item>
          <Descriptions.Item label="Complaint Description" span={2}>
            {complaint.complaint_description || '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* AI Closure Summary ──────────────────────────────────────────────── */}
      {!aiSummary.data && !aiSummary.loading && !aiSummary.error && (
        <div style={{ marginBottom: 16 }}>
          <Button
            icon={<BulbOutlined />}
            onClick={() => aiSummary.fetch(id)}
            style={{ borderColor: '#1677ff', color: '#1677ff' }}
          >
            AI Closure Summary
          </Button>
        </div>
      )}

      {(aiSummary.data || aiSummary.loading || aiSummary.error) && (
        <AiSuggestionCard
          title="Madad AI — Complaint Closure Summary"
          loading={aiSummary.loading}
          error={aiSummary.error}
          aiAvailable={aiSummary.aiAvailable}
          cached={aiSummary.cached}
          onDismiss={() => aiSummary.reset()}
          onRetry={() => aiSummary.fetch(id)}
          style={{ marginBottom: 16 }}
        >
          {aiSummary.data && (() => {
            // axios interceptor unwraps res.data; ai.api.js then calls .then(r=>r.data)
            // so the hook stores the inner data object directly — no extra .data needed
            const d       = aiSummary.data;
            const insight = parseInsight(d.ai_insight);
            const actions           = insight.actions_taken ?? [];
            const preventiveMeasures = insight.preventive_measures ?? [];
            const CLOSURE_COLOR = {
              ready_to_close:       'green',
              pending_actions:      'orange',
              requires_escalation:  'red',
            };
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Meta tags */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {insight.closure_recommendation && (
                    <Tag color={CLOSURE_COLOR[insight.closure_recommendation] ?? 'default'} style={{ fontSize: 12 }}>
                      {insight.closure_recommendation?.replace(/_/g, ' ')}
                    </Tag>
                  )}
                  {insight.confidence && (
                    <Tag color={{ high: 'green', medium: 'orange', low: 'red' }[insight.confidence] ?? 'default'} style={{ fontSize: 12 }}>
                      Confidence: {insight.confidence}
                    </Tag>
                  )}
                  {d.days_open != null && (
                    <Tag color="default" style={{ fontSize: 12 }}>Open {d.days_open} day{d.days_open !== 1 ? 's' : ''}</Tag>
                  )}
                </div>

                {insight.executive_summary && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Executive Summary</Text>
                    <div style={{
                      marginTop: 4, padding: '8px 12px', background: '#fff',
                      borderRadius: 6, border: '1px solid #dbeafe',
                      fontSize: 13, color: '#1e40af', lineHeight: 1.6,
                    }}>
                      {insight.executive_summary}
                    </div>
                  </div>
                )}
                {insight.timeline_summary && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Timeline</Text>
                    <div style={{
                      marginTop: 4, padding: '8px 12px', background: '#fff',
                      borderRadius: 6, border: '1px solid #e5e7eb',
                      fontSize: 13, color: '#374151', lineHeight: 1.6,
                    }}>
                      {insight.timeline_summary}
                    </div>
                  </div>
                )}
                {insight.root_cause_assessment && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Root Cause</Text>
                    <div style={{
                      marginTop: 4, padding: '8px 12px', background: '#fff',
                      borderRadius: 6, border: '1px solid #fef3c7',
                      fontSize: 13, color: '#92400e', lineHeight: 1.6,
                    }}>
                      {insight.root_cause_assessment}
                    </div>
                  </div>
                )}
                {actions.length > 0 && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Actions Taken</Text>
                    <div style={{
                      marginTop: 4, padding: '8px 12px', background: '#fff',
                      borderRadius: 6, border: '1px solid #dcfce7',
                    }}>
                      {actions.map((a, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#166534', lineHeight: 1.7 }}>
                          {i + 1}. {a}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {preventiveMeasures.length > 0 && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Preventive Measures</Text>
                    <div style={{
                      marginTop: 4, padding: '8px 12px', background: '#fff',
                      borderRadius: 6, border: '1px solid #ede9fe',
                    }}>
                      {preventiveMeasures.map((p, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#5b21b6', lineHeight: 1.7 }}>
                          {i + 1}. {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {insight.customer_communication_draft && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Customer Communication Draft</Text>
                    <div style={{
                      marginTop: 4, padding: '10px 12px', background: '#f9fafb',
                      borderRadius: 6, border: '1px solid #e5e7eb',
                      fontSize: 13, color: '#374151', lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {insight.customer_communication_draft}
                    </div>
                  </div>
                )}
                {d.ai_error && (
                  <Text type="secondary" style={{ fontSize: 12 }}>AI note: {d.ai_error}</Text>
                )}
              </div>
            );
          })()}
        </AiSuggestionCard>
      )}

      {/* Card 2 — Acknowledge (only if status = received) */}
      {showAcknowledge && (
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
          bodyStyle={{ padding: '16px 20px' }}
          title="Acknowledge Complaint"
        >
          <Alert
            type="info"
            showIcon
            message="This complaint has not been acknowledged yet. Set a response deadline to acknowledge it."
            style={{ marginBottom: 16 }}
          />

          <Form form={form} layout="inline" requiredMark={false}>
            <Form.Item name="response_due" label="Response Deadline" rules={[{ required: true, message: 'Required' }]}>
              <DatePicker format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" loading={saving} onClick={onAcknowledge}>
                Acknowledge &amp; Set Deadline
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            Acknowledging will auto-create a linked CAPA to track root cause and corrective action.
          </Text>
        </Card>
      )}

      {/* Card 3 — Linked NCR */}
      {complaint.ncr_id && complaint.NCR && (
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
          bodyStyle={{ padding: '16px 20px' }}
          title="Linked NCR"
          extra={
            <Button type="link" icon={<LinkOutlined />} onClick={() => navigate(`/quality/ncr/${complaint.ncr_id}`)}>
              Open NCR
            </Button>
          }
        >
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="NCR No.">{complaint.NCR?.ncr_no ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag>{complaint.NCR?.status?.replace(/_/g, ' ') ?? '—'}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Card 4 — Linked CAPA */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
        title="Linked CAPA"
        extra={capa && (
          <Button
            type="link"
            icon={<LinkOutlined />}
            onClick={() => navigate(`/quality/capa/${capa.id}`)}
          >
            Open CAPA
          </Button>
        )}
      >
        {capa ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="CAPA No.">{capa.capa_no}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={{ open: 'orange', in_progress: 'blue', effectiveness: 'purple', closed: 'green' }[capa.status] ?? 'default'}>
                {capa.status?.replace(/_/g, ' ')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Champion">{capa.Champion?.name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Target Date">{capa.due_date || '—'}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Alert
            type="info"
            showIcon
            message="No CAPA linked yet."
            description="A CAPA will be automatically created when this complaint is acknowledged."
          />
        )}
      </Card>
    </AppLayout>
  );
}
