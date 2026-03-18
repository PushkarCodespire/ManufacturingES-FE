import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space,
  Drawer, Form, Select, DatePicker, message, Tooltip,
  Popconfirm, Row, Col, Steps, Alert, Divider,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, RightOutlined, EditOutlined,
  CheckCircleOutlined, SendOutlined, WarningOutlined,
  BulbOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout          from '../../../components/AppLayout';
import usePermissions     from '../../../hooks/usePermissions';
import { scarApi, vendorApi } from '../../../api/procurement.api';
import aiApi              from '../../../api/ai.api';
import useAiSuggestion    from '../../../hooks/useAiSuggestion';
import AiSuggestionCard   from '../../../components/AiSuggestion/AiSuggestionCard';

// Strip markdown code fences and parse JSON
const parseInsight = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object' && !raw.raw_text) return raw;
  const text = raw.raw_text ?? raw;
  if (typeof text !== 'string') return raw;
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```[\s\S]*$/, '').trim();
  try { return JSON.parse(stripped); } catch {}
  try { return JSON.parse(text.trim()); } catch {}
  return null;
};

const { Title, Text, Paragraph } = Typography;

const STATUS_CONFIG = {
  created:          { color: 'default',  label: 'Created'         },
  sent:             { color: 'blue',     label: 'Sent'            },
  response_received:{ color: 'cyan',     label: 'Response Rcvd'   },
  under_review:     { color: 'purple',   label: 'Under Review'    },
  accepted:         { color: 'green',    label: 'Accepted'        },
  rejected:         { color: 'red',      label: 'Rejected'        },
  closed:           { color: 'success',  label: 'Closed'          },
};

const SEVERITY_CONFIG = {
  critical: { color: 'red',    label: 'Critical' },
  major:    { color: 'orange', label: 'Major'    },
  minor:    { color: 'default',label: 'Minor'    },
};

const STATUS_STEPS = ['created', 'sent', 'response_received', 'under_review', 'accepted', 'closed'];

export default function SCARPage() {
  const { can } = usePermissions();
  const canWrite = can('plan-scar-scar-create_edit_delete');

  const [scars,     setScars]     = useState([]);
  const [vendors,   setVendors]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [severityFilter, setSeverityFilter] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [updateDrawerOpen, setUpdateDrawerOpen] = useState(false);
  const [respondDrawerOpen, setRespondDrawerOpen] = useState(false);
  const [activeScar, setActiveScar] = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [overdueFilter, setOverdueFilter] = useState(false);

  const [form]        = Form.useForm();
  const [updateForm]  = Form.useForm();
  const [respondForm] = Form.useForm();

  // AI state
  const aiDraft = useAiSuggestion(aiApi.getScarAiDraft);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiScarRecord, setAiScarRecord] = useState(null);

  const openAiDrawer = (scar) => {
    setAiScarRecord(scar);
    setAiDrawerOpen(true);
    aiDraft.reset();
    aiDraft.fetch(scar.id);
  };
  const closeAiDrawer = () => {
    setAiDrawerOpen(false);
    setAiScarRecord(null);
    aiDraft.reset();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (overdueFilter) {
        res = await scarApi.getOverdue();
      } else {
        const p = {};
        if (statusFilter)   p.status   = statusFilter;
        if (severityFilter) p.severity = severityFilter;
        res = await scarApi.getAll(p);
      }
      const arr = Array.isArray(res) ? res : (res?.data ?? []);
      const filtered = search
        ? arr.filter((s) =>
            s.scar_no?.toLowerCase().includes(search.toLowerCase()) ||
            s.Vendor?.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.defect_desc?.toLowerCase().includes(search.toLowerCase())
          )
        : arr;
      setScars(filtered);
    } catch (err) { message.error(err?.message || 'Failed to load SCARs'); }
    finally { setLoading(false); }
  }, [search, statusFilter, severityFilter, overdueFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    vendorApi.getAll({ type: 'vendor', is_active: true }).catch(() => ({ data: [] })).then((res) => {
      const arr = Array.isArray(res) ? res : (res?.data ?? []);
      setVendors(arr);
    });
  }, []);

  const openCreate = () => {
    form.resetFields();
    setDrawerOpen(true);
  };

  const openUpdate = (scar) => {
    setActiveScar(scar);
    updateForm.setFieldsValue({
      status:             scar.status,
      severity:           scar.severity,
      response_notes:     scar.response_notes || '',
      root_cause:         scar.root_cause || '',
      corrective_action:  scar.corrective_action || '',
      notes:              scar.notes || '',
      required_response_date: scar.required_response_date ? dayjs(scar.required_response_date) : null,
    });
    setUpdateDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        vendor_id:             vals.vendor_id,
        defect_desc:           vals.defect_desc,
        severity:              vals.severity || 'major',
        affected_qty:          vals.affected_qty || null,
        source_type:           vals.source_type || null,
        notes:                 vals.notes || '',
        required_response_date: vals.required_response_date
          ? vals.required_response_date.format('YYYY-MM-DD')
          : null,
      };
      await scarApi.create(payload);
      message.success('SCAR created successfully');
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onUpdate = async () => {
    try {
      const vals = await updateForm.validateFields();
      setSaving(true);
      const payload = {};
      if (vals.status)             payload.status             = vals.status;
      if (vals.severity)           payload.severity           = vals.severity;
      if (vals.response_notes)     payload.response_notes     = vals.response_notes;
      if (vals.root_cause)         payload.root_cause         = vals.root_cause;
      if (vals.corrective_action)  payload.corrective_action  = vals.corrective_action;
      if (vals.notes)              payload.notes              = vals.notes;
      if (vals.required_response_date)
        payload.required_response_date = vals.required_response_date.format('YYYY-MM-DD');
      await scarApi.update(activeScar.id, payload);
      message.success('SCAR updated');
      setUpdateDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await scarApi.delete(id);
      message.success('SCAR deleted');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Delete failed'); }
  };

  const openRespond = (scar) => {
    setActiveScar(scar);
    respondForm.resetFields();
    respondForm.setFieldsValue({
      response_notes:    scar.response_notes || '',
      root_cause:        scar.root_cause || '',
      corrective_action: scar.corrective_action || '',
    });
    setRespondDrawerOpen(true);
  };

  const onRespond = async () => {
    try {
      const vals = await respondForm.validateFields();
      setSaving(true);
      await scarApi.respond(activeScar.id, {
        response_notes:    vals.response_notes,
        root_cause:        vals.root_cause,
        corrective_action: vals.corrective_action,
      });
      message.success('SCAR response recorded');
      setRespondDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Respond failed');
    } finally { setSaving(false); }
  };

  const onClose = async (id) => {
    try {
      await scarApi.close(id);
      message.success('SCAR closed successfully');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Close failed'); }
  };

  const isOverdue = (scar) => {
    if (!scar.required_response_date) return false;
    if (['closed', 'accepted', 'rejected'].includes(scar.status)) return false;
    if (['response_received', 'under_review'].includes(scar.status)) return false;
    return new Date(scar.required_response_date) < new Date();
  };

  const columns = [
    {
      title: 'SCAR No', dataIndex: 'scar_no', key: 'scar_no', width: 160,
      render: (no) => <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{no}</Text>,
    },
    {
      title: 'Vendor', key: 'vendor', width: 180,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Vendor?.name || '—'}</Text>,
    },
    {
      title: 'Severity', dataIndex: 'severity', key: 'severity', width: 90,
      render: (s) => {
        const cfg = SEVERITY_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Defect Description', dataIndex: 'defect_desc', key: 'defect_desc', width: 260,
      render: (v) => (
        <Paragraph ellipsis={{ rows: 2, expandable: false }} style={{ margin: 0, fontSize: 12 }}>
          {v}
        </Paragraph>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Response Due', dataIndex: 'required_response_date', key: 'required_response_date', width: 140,
      render: (d, r) => {
        if (!d) return <Text type="secondary">—</Text>;
        const overdue = isOverdue(r);
        return (
          <Space size={4}>
            <Text style={{ color: overdue ? '#dc2626' : undefined, fontWeight: overdue ? 600 : 400 }}>
              {dayjs(d).format('DD MMM YYYY')}
            </Text>
            {overdue && <Tag color="red" style={{ margin: 0, fontSize: 10, lineHeight: '16px', height: 16 }}>OVERDUE</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'AI', key: 'ai', width: 54, align: 'center',
      render: (_, r) => (
        <Tooltip title="AI Draft Suggestions">
          <Button
            size="small"
            icon={<BulbOutlined />}
            style={{ color: '#7c3aed', borderColor: '#7c3aed' }}
            onClick={() => openAiDrawer(r)}
          />
        </Tooltip>
      ),
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 180,
      render: (_, r) => (
        <Space size={4}>
          {['created', 'sent'].includes(r.status) && (
            <Tooltip title="Record vendor response">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<SendOutlined />}
                onClick={() => openRespond(r)}
              />
            </Tooltip>
          )}
          {['response_received', 'under_review', 'accepted'].includes(r.status) && (
            <Popconfirm
              title="Close this SCAR?"
              description="This marks the SCAR as resolved."
              onConfirm={() => onClose(r.id)}
              okText="Close"
            >
              <Tooltip title="Close SCAR">
                <Button
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ borderColor: '#16a34a', color: '#16a34a' }}
                />
              </Tooltip>
            </Popconfirm>
          )}
          <Tooltip title="Update SCAR">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openUpdate(r)}
            />
          </Tooltip>
          {['created', 'sent'].includes(r.status) && (
            <Popconfirm
              title="Delete this SCAR?"
              onConfirm={() => onDelete(r.id)}
              okText="Delete"
              okType="danger"
            >
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  const totals = {
    total:    scars.length,
    open:     scars.filter((s) => !['accepted', 'rejected', 'closed'].includes(s.status)).length,
    critical: scars.filter((s) => s.severity === 'critical').length,
    overdue:  scars.filter((s) => isOverdue(s)).length,
    closed:   scars.filter((s) => s.status === 'closed').length,
  };

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>SCAR</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Supplier Corrective Action Requests</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Raise and track corrective action requests to vendors for quality defects.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {totals.total}</Tag>
        <Tag color="orange">Open: {totals.open}</Tag>
        <Tag color="red">Critical: {totals.critical}</Tag>
        {totals.overdue > 0 && (
          <Tag
            color="volcano"
            style={{ cursor: 'pointer' }}
            icon={<WarningOutlined />}
            onClick={() => setOverdueFilter(!overdueFilter)}
          >
            Overdue: {totals.overdue} {overdueFilter ? '(filtered)' : ''}
          </Tag>
        )}
        <Tag color="green">Closed: {totals.closed}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search SCAR no, vendor, defect..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 160 }}
          />
          <Select
            placeholder="Severity"
            allowClear
            value={severityFilter}
            onChange={setSeverityFilter}
            options={Object.entries(SEVERITY_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 120 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Raise SCAR
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={scars}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          expandable={{
            expandedRowRender: (r) => (
              <div style={{ padding: '8px 16px' }}>
                <Steps
                  size="small"
                  current={STATUS_STEPS.indexOf(r.status)}
                  items={STATUS_STEPS.map((s) => ({ title: STATUS_CONFIG[s]?.label || s }))}
                  style={{ marginBottom: 12 }}
                />
                {r.response_notes && (
                  <div style={{ marginBottom: 8 }}>
                    <Text style={{ fontWeight: 600, fontSize: 12 }}>Vendor Response: </Text>
                    <Text style={{ fontSize: 12 }}>{r.response_notes}</Text>
                  </div>
                )}
                {r.root_cause && (
                  <div style={{ marginBottom: 8 }}>
                    <Text style={{ fontWeight: 600, fontSize: 12 }}>Root Cause: </Text>
                    <Text style={{ fontSize: 12 }}>{r.root_cause}</Text>
                  </div>
                )}
                {r.corrective_action && (
                  <div>
                    <Text style={{ fontWeight: 600, fontSize: 12 }}>Corrective Action: </Text>
                    <Text style={{ fontSize: 12 }}>{r.corrective_action}</Text>
                  </div>
                )}
              </div>
            ),
          }}
        />
      </Card>

      {/* ── Create Drawer ──────────────────────────────────────────────────── */}
      <Drawer
        title="Raise New SCAR"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={560}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              Raise SCAR
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="vendor_id" label="Vendor" rules={[{ required: true, message: 'Select vendor' }]}>
            <Select
              showSearch
              placeholder="Select vendor"
              optionFilterProp="label"
              options={vendors.map((v) => ({
                value: v.id,
                label: v.partner_code ? `${v.name} (${v.partner_code})` : v.name,
              }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="severity" label="Severity" initialValue="major">
                <Select options={Object.entries(SEVERITY_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="affected_qty" label="Affected Qty">
                <Input type="number" min={0} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source_type" label="Source">
                <Select
                  allowClear
                  placeholder="Source"
                  options={[
                    { value: 'iqc',       label: 'IQC Inspection' },
                    { value: 'grn',       label: 'GRN' },
                    { value: 'complaint', label: 'Customer Complaint' },
                    { value: 'audit',     label: 'Audit' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="required_response_date" label="Response Due">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="defect_desc"
            label="Defect Description"
            rules={[{ required: true, message: 'Describe the defect' }]}
          >
            <Input.TextArea rows={4} placeholder="Describe the defect in detail…" />
          </Form.Item>

          <Form.Item name="notes" label="Internal Notes">
            <Input.TextArea rows={2} placeholder="Any internal notes…" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Update / Progress Drawer ───────────────────────────────────────── */}
      <Drawer
        title={`Update SCAR — ${activeScar?.scar_no || ''}`}
        open={updateDrawerOpen}
        onClose={() => setUpdateDrawerOpen(false)}
        width={560}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setUpdateDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onUpdate}>
              Save Changes
            </Button>
          </div>
        }
      >
        {activeScar && (
          <Form form={updateForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="status" label="Status">
                  <Select options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="severity" label="Severity">
                  <Select options={Object.entries(SEVERITY_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="required_response_date" label="Response Due Date">
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>

            <Form.Item name="response_notes" label="Vendor Response">
              <Input.TextArea rows={3} placeholder="Vendor response details…" />
            </Form.Item>

            <Form.Item name="root_cause" label="Root Cause (from vendor)">
              <Input.TextArea rows={3} placeholder="Root cause identified…" />
            </Form.Item>

            <Form.Item name="corrective_action" label="Corrective Action Plan">
              <Input.TextArea rows={3} placeholder="Actions taken / planned…" />
            </Form.Item>

            <Form.Item name="notes" label="Internal Notes">
              <Input.TextArea rows={2} placeholder="Internal notes…" />
            </Form.Item>
          </Form>
        )}
      </Drawer>
      {/* ── Respond Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={`Respond to SCAR — ${activeScar?.scar_no || ''}`}
        open={respondDrawerOpen}
        onClose={() => setRespondDrawerOpen(false)}
        width={560}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRespondDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onRespond}>
              Submit Response
            </Button>
          </div>
        }
      >
        <Form form={respondForm} layout="vertical">
          <Form.Item
            name="response_notes"
            label="Vendor Response Details"
            rules={[{ required: true, message: 'Enter vendor response' }]}
          >
            <Input.TextArea rows={4} placeholder="Vendor's response to the SCAR…" />
          </Form.Item>

          <Form.Item
            name="root_cause"
            label="Root Cause Identified"
            rules={[{ required: true, message: 'Enter root cause' }]}
          >
            <Input.TextArea rows={3} placeholder="Root cause analysis from vendor…" />
          </Form.Item>

          <Form.Item
            name="corrective_action"
            label="Corrective Action Plan"
            rules={[{ required: true, message: 'Enter corrective action' }]}
          >
            <Input.TextArea rows={3} placeholder="Actions taken / planned by vendor…" />
          </Form.Item>
        </Form>
      </Drawer>
      {/* ── AI Draft Drawer ─────────────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <BulbOutlined style={{ color: '#7c3aed' }} />
            <span>AI Draft — {aiScarRecord?.scar_no}</span>
          </Space>
        }
        open={aiDrawerOpen}
        onClose={closeAiDrawer}
        width={520}
      >
        {aiScarRecord && (
          <>
            {/* Context tags */}
            <Space wrap style={{ marginBottom: 16 }}>
              <Tag color="blue">{aiScarRecord.scar_no}</Tag>
              {aiScarRecord.Vendor && <Tag color="purple">{aiScarRecord.Vendor.name}</Tag>}
              <Tag color={SEVERITY_CONFIG[aiScarRecord.severity]?.color || 'default'}>
                {SEVERITY_CONFIG[aiScarRecord.severity]?.label || aiScarRecord.severity}
              </Tag>
              <Tag>{STATUS_CONFIG[aiScarRecord.status]?.label || aiScarRecord.status}</Tag>
            </Space>

            <AiSuggestionCard
              loading={aiDraft.loading}
              error={aiDraft.error}
              aiAvailable={aiDraft.aiAvailable}
              cached={aiDraft.cached}
              onRetry={() => aiDraft.fetch(aiScarRecord.id)}
              onDismiss={closeAiDrawer}
            >
              {(() => {
                const d = aiDraft.data;
                if (!d) return null;
                const insight = parseInsight(d.ai_insight);
                if (!insight) return null;
                return (
                  <div style={{ fontSize: 13 }}>
                    {/* Supplier risk + confidence */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {insight.supplier_risk_level && (
                        <Tag color={
                          insight.supplier_risk_level === 'high' ? 'red' :
                          insight.supplier_risk_level === 'medium' ? 'orange' : 'green'
                        } style={{ fontWeight: 600 }}>
                          Supplier Risk: {insight.supplier_risk_level?.toUpperCase()}
                        </Tag>
                      )}
                      {insight.confidence && (
                        <Tag color="geekblue">Confidence: {insight.confidence}</Tag>
                      )}
                      {insight.escalation_recommended && (
                        <Tag color="red" icon={<ExclamationCircleOutlined />}>Escalation Recommended</Tag>
                      )}
                    </div>

                    {/* Professional issue statement */}
                    {insight.professional_issue_statement && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>Issue Statement</Text>
                        <div style={{
                          marginTop: 4, padding: '8px 12px',
                          background: '#f8fafc', border: '1px solid #e2e8f0',
                          borderRadius: 6, fontSize: 12, lineHeight: 1.6, color: '#374151',
                          fontStyle: 'italic',
                        }}>
                          {insight.professional_issue_statement}
                        </div>
                      </div>
                    )}

                    {/* Recurrence pattern */}
                    {insight.recurrence_pattern && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>
                          Recurrence Pattern
                          {d.history_count != null && (
                            <Tag style={{ marginLeft: 8 }} color="orange">{d.history_count} prior SCARs</Tag>
                          )}
                        </Text>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#4b5563' }}>
                          {insight.recurrence_pattern}
                        </div>
                      </div>
                    )}

                    <Divider style={{ margin: '10px 0' }} />

                    {/* Root cause areas */}
                    {Array.isArray(insight.suggested_root_cause_areas) && insight.suggested_root_cause_areas.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>Suggested Root Cause Areas</Text>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {insight.suggested_root_cause_areas.map((item, i) => (
                            <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Corrective actions */}
                    {Array.isArray(insight.suggested_corrective_actions) && insight.suggested_corrective_actions.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>Suggested Corrective Actions</Text>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {insight.suggested_corrective_actions.map((item, i) => (
                            <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Preventive actions */}
                    {Array.isArray(insight.suggested_preventive_actions) && insight.suggested_preventive_actions.length > 0 && (
                      <div style={{ marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 12, color: '#374151' }}>Suggested Preventive Actions</Text>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {insight.suggested_preventive_actions.map((item, i) => (
                            <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* raw_text fallback */}
                    {insight.raw_text && (
                      <div style={{ fontSize: 12, color: '#4b5563', whiteSpace: 'pre-wrap' }}>
                        {insight.raw_text}
                      </div>
                    )}
                  </div>
                );
              })()}
            </AiSuggestionCard>
          </>
        )}
      </Drawer>
    </AppLayout>
  );
}
