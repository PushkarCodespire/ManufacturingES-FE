import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space,
  Drawer, Form, Select, DatePicker, message, Tooltip,
  Popconfirm, Row, Col, Steps,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, RightOutlined, EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { scarApi, vendorApi } from '../../../api/procurement.api';

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
  const [activeScar, setActiveScar] = useState(null);
  const [saving,    setSaving]    = useState(false);

  const [form]       = Form.useForm();
  const [updateForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (statusFilter)   p.status   = statusFilter;
      if (severityFilter) p.severity = severityFilter;
      const res = await scarApi.getAll(p);
      const arr = Array.isArray(res) ? res : (res?.data ?? []);
      const filtered = search
        ? arr.filter((s) =>
            s.scar_no?.toLowerCase().includes(search.toLowerCase()) ||
            s.Vendor?.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.defect_desc?.toLowerCase().includes(search.toLowerCase())
          )
        : arr;
      setScars(filtered);
    } catch { message.error('Failed to load SCARs'); }
    finally { setLoading(false); }
  }, [search, statusFilter, severityFilter]);

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
      title: 'Response Due', dataIndex: 'required_response_date', key: 'required_response_date', width: 120,
      render: (d) => {
        if (!d) return <Text type="secondary">—</Text>;
        const isOverdue = new Date(d) < new Date() && !['accepted', 'rejected', 'closed'].includes('');
        return <Text style={{ color: isOverdue ? '#dc2626' : undefined }}>{dayjs(d).format('DD MMM YYYY')}</Text>;
      },
    },
    {
      title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 120,
      render: (_, r) => (
        <Space size={4}>
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
    </AppLayout>
  );
}
