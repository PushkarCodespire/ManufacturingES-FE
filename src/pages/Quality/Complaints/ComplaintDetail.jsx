import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography, Card, Button, Descriptions, Tag, message,
  Form, DatePicker, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, RightOutlined, LinkOutlined,
} from '@ant-design/icons';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { complaintApi } from '../../../api/quality.api';

const { Title, Text } = Typography;

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await complaintApi.getById(id);
      setComplaint(data);
    } catch { message.error('Failed to load complaint'); }
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
