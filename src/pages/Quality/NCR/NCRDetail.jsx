import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography, Card, Button, Descriptions, Tag, Space, message,
  Tabs, Form, Select, DatePicker, Input, Popconfirm, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, RightOutlined, CheckCircleOutlined, LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout    from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { ncrApi }   from '../../../api/quality.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR   = {
  raised: 'orange', under_review: 'blue', dispositioned: 'purple', closed: 'green', cancelled: 'default',
};
const NCR_TYPE_COLOR = { process: 'purple', material: 'gold', product: 'red', system: 'cyan' };

const LOCATION_LABELS = {
  iqc: 'IQC', lqc: 'LQC', pqc: 'PQC', oqc: 'OQC', production: 'Production', store: 'Store',
};

const DECISION_OPTS = [
  { value: 'use_as_is',          label: 'Use As Is (Concession)' },
  { value: 'rework',             label: 'Rework'                 },
  { value: 'scrap',              label: 'Scrap'                  },
  { value: 'return_to_supplier', label: 'Return to Supplier'     },
  { value: 'sort_and_use',       label: 'Sort and Use'           },
];

const DECISION_COLOR = {
  use_as_is: 'blue', rework: 'orange', scrap: 'red',
  return_to_supplier: 'purple', sort_and_use: 'cyan',
};

export default function NCRDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { can }  = usePermissions();
  const canWrite = can('quality-ncr-create_edit_delete');

  const [ncr,     setNcr]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [decision, setDecision] = useState(null);
  const [form]                  = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ncrApi.getById(id);
      setNcr(data);
    } catch { message.error('Failed to load NCR'); }
    finally   { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Record disposition ─────────────────────────────────────────────────────
  const onRecordDisposition = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const result = await ncrApi.addDisposition(id, {
        ...vals,
        decision_date: vals.decision_date?.format('YYYY-MM-DD'),
      });
      message.success('Disposition recorded');
      if (result?.capa_no) message.info(`CAPA ${result.capa_no} auto-created for this NCR`);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  // ── Close NCR ──────────────────────────────────────────────────────────────
  const onClose = async () => {
    try {
      await ncrApi.close(id);
      message.success('NCR closed successfully');
      load();
    } catch (err) { message.error(err?.message || 'Close failed'); }
  };

  if (loading) return <AppLayout><div style={{ padding: 40, color: '#6b7280' }}>Loading…</div></AppLayout>;
  if (!ncr)    return <AppLayout><div style={{ padding: 40, color: '#ef4444' }}>NCR not found.</div></AppLayout>;

  const disposition = ncr.Disposition ?? null;
  const canDispose  = canWrite && ncr.status !== 'dispositioned' && ncr.status !== 'closed' && ncr.status !== 'cancelled';
  const totalCost   = (parseFloat(ncr.qty_affected) || 0) * (parseFloat(ncr.cost_per_unit) || 0);

  const tabItems = [
    // ── Tab 1: NCR Details ────────────────────────────────────────────────────
    {
      key:      'details',
      label:    'NCR Details',
      children: (
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="NCR No.">{ncr.ncr_no}</Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color={NCR_TYPE_COLOR[ncr.ncr_type] ?? 'default'}>{ncr.ncr_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Location Found">
              {LOCATION_LABELS[ncr.location_found] ?? ncr.location_found ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[ncr.status] ?? 'default'}>{ncr.status?.replace(/_/g, ' ')}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Part / Item">
              {ncr.Item ? `${ncr.Item.code} — ${ncr.Item.name}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Raised By">{ncr.RaisedBy?.name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Lot No.">{ncr.lot_no || '—'}</Descriptions.Item>
            <Descriptions.Item label="Qty Affected">{ncr.qty_affected ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Cost / Unit">
              {ncr.cost_per_unit ? `₹ ${parseFloat(ncr.cost_per_unit).toLocaleString('en-IN')}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Total Cost (Est.)">
              {totalCost > 0 ? `₹ ${totalCost.toLocaleString('en-IN')}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Defect Description" span={2}>
              {ncr.defect_desc || '—'}
            </Descriptions.Item>
            {ncr.notes && (
              <Descriptions.Item label="Notes" span={2}>{ncr.notes}</Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      ),
    },

    // ── Tab 2: MRB Disposition ────────────────────────────────────────────────
    {
      key:   'disposition',
      label: `MRB Disposition${disposition ? ' ✓' : ''}`,
      children: (
        <div>
          {/* Show existing disposition read-only */}
          {disposition && (
            <Card
              style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
              bodyStyle={{ padding: '16px 20px' }}
              title="Disposition Decision"
            >
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Decision">
                  <Tag color={DECISION_COLOR[disposition.decision] ?? 'default'}>
                    {DECISION_OPTS.find((o) => o.value === disposition.decision)?.label ?? disposition.decision}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Decision Date">{disposition.decision_date || '—'}</Descriptions.Item>
                <Descriptions.Item label="Reason" span={2}>{disposition.reason || '—'}</Descriptions.Item>
                {disposition.rework_notes && (
                  <Descriptions.Item label="Rework Notes" span={2}>{disposition.rework_notes}</Descriptions.Item>
                )}
                {disposition.material_hold_notes && (
                  <Descriptions.Item label="Concession Notes" span={2}>{disposition.material_hold_notes}</Descriptions.Item>
                )}
                <Descriptions.Item label="Decided By">{disposition.DecidedBy?.name ?? '—'}</Descriptions.Item>
              </Descriptions>

              {/* Close NCR button */}
              {ncr.status === 'dispositioned' && canWrite && (
                <div style={{ marginTop: 16 }}>
                  <Popconfirm
                    title="Close this NCR?"
                    description="Closing marks this NCR as fully resolved."
                    onConfirm={onClose}
                    okText="Close NCR"
                  >
                    <Button type="primary" icon={<CheckCircleOutlined />}>Close NCR</Button>
                  </Popconfirm>
                </div>
              )}
            </Card>
          )}

          {/* Form to record disposition — shown only if not yet dispositioned/closed */}
          {canDispose && (
            <Card
              style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              bodyStyle={{ padding: '16px 20px' }}
              title="Record MRB Disposition"
            >
              <Alert
                type="info"
                showIcon
                message="This NCR requires a Material Review Board (MRB) disposition decision."
                style={{ marginBottom: 16 }}
              />

              <Form form={form} layout="vertical" requiredMark={false}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Form.Item name="decision" label="Disposition Decision" rules={[{ required: true }]}>
                    <Select
                      options={DECISION_OPTS}
                      placeholder="Select decision"
                      onChange={(v) => setDecision(v)}
                    />
                  </Form.Item>
                  <Form.Item name="decision_date" label="Decision Date" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" defaultValue={dayjs()} />
                  </Form.Item>
                </div>

                <Form.Item name="reason" label="Reason / Justification" rules={[{ required: true }]}>
                  <TextArea rows={3} placeholder="Explain the basis for this decision..." />
                </Form.Item>

                {decision === 'rework' && (
                  <Form.Item name="rework_notes" label="Rework Instructions">
                    <TextArea rows={3} placeholder="Describe rework steps required..." />
                  </Form.Item>
                )}

                {decision === 'use_as_is' && (
                  <Form.Item name="material_hold_notes" label="Concession / Use-As-Is Notes">
                    <TextArea rows={3} placeholder="Justification for using material as-is..." />
                  </Form.Item>
                )}

                <Button type="primary" loading={saving} onClick={onRecordDisposition}>
                  Record Disposition
                </Button>
              </Form>
            </Card>
          )}

          {!canDispose && !disposition && (
            <Alert type="warning" showIcon message="No disposition recorded yet." />
          )}

          {ncr.status === 'closed' && (
            <Alert type="success" showIcon message="This NCR has been closed." />
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={() => navigate('/quality/ncr')}>
          Internal NCR
        </Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{ncr.ncr_no}</Text>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quality/ncr')}>Back</Button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Title level={3} style={{ margin: 0 }}>{ncr.ncr_no}</Title>
            <Tag color={STATUS_COLOR[ncr.status] ?? 'default'} style={{ fontSize: 13 }}>
              {ncr.status?.replace(/_/g, ' ')}
            </Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {LOCATION_LABELS[ncr.location_found] ?? ncr.location_found} — {ncr.ncr_type} NCR
          </Text>
        </div>
      </div>

      {(ncr.complaint_id || ncr.capa_id) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {ncr.complaint_id && (
            <Button size="small" icon={<LinkOutlined />} onClick={() => navigate(`/quality/complaints/${ncr.complaint_id}`)}>
              Source Complaint
            </Button>
          )}
          {ncr.capa_id && (
            <Button size="small" icon={<LinkOutlined />} onClick={() => navigate(`/quality/capa/${ncr.capa_id}`)}>
              Linked CAPA
            </Button>
          )}
        </div>
      )}

      <Tabs items={tabItems} defaultActiveKey="details" />
    </AppLayout>
  );
}
