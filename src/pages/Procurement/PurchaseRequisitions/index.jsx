import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col, Modal, Alert, Descriptions, Progress,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  PlusCircleOutlined, MinusCircleOutlined,
  SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, ShoppingCartOutlined, AuditOutlined,
  ExclamationCircleOutlined, ClockCircleOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout        from '../../../components/AppLayout';
import ResponsiveTable  from '../../../components/ResponsiveTable';
import usePermissions   from '../../../hooks/usePermissions';
import { prApi }        from '../../../api/procurement.api';
import { itemApi }      from '../../../api/item.api';
import { vendorApi }    from '../../../api/vendor.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

// ── Configs ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:     { color: 'default', label: 'Draft',     icon: null },
  submitted: { color: 'gold',    label: 'Submitted', icon: <ClockCircleOutlined /> },
  approved:  { color: 'green',   label: 'Approved',  icon: <CheckCircleOutlined /> },
  rejected:  { color: 'red',     label: 'Rejected',  icon: <CloseCircleOutlined /> },
  converted: { color: 'blue',    label: 'Converted', icon: <ShoppingCartOutlined /> },
};

const PRIORITY_CONFIG = {
  low:    { color: 'default', label: 'Low'    },
  medium: { color: 'blue',    label: 'Medium' },
  high:   { color: 'orange',  label: 'High'   },
  urgent: { color: 'red',     label: 'Urgent' },
};

const emptyLine = () => ({
  _key:            Date.now() + Math.random(),
  item_id:         null,
  qty_requested:   null,
  unit:            'pcs',
  estimated_price: null,
  justification:   '',
});

const fmtCcy = (v) =>
  v != null && v > 0
    ? `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

const estTotal = (items) =>
  (items || []).reduce(
    (s, it) => s + (parseFloat(it.qty_requested || 0) * parseFloat(it.estimated_price || 0)), 0
  );

// ─────────────────────────────────────────────────────────────────────────────

export default function PurchaseRequisitionsPage() {
  const { can, isAdmin } = usePermissions();
  const canWrite   = can('plan-pr-purchase_requisition-create_edit_delete');
  const canApprove = can('plan-pr-approve_pr-approve_reject') || isAdmin;

  const [prs,            setPRs]           = useState([]);
  const [items,          setItems]         = useState([]);
  const [vendors,        setVendors]       = useState([]);
  const [loading,        setLoading]       = useState(false);
  const [search,         setSearch]        = useState('');
  const [statusFilter,   setStatusFilter]  = useState(null);
  const [priorityFilter, setPriorityFilter]= useState(null);

  // Create/Edit drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [lineItems,  setLineItems]  = useState([emptyLine()]);
  const [form] = Form.useForm();

  // Detail drawer
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailRecord,  setDetailRecord]  = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reject modal
  const [rejectModal,  setRejectModal]  = useState(false);
  const [rejectingPR,  setRejectingPR]  = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);

  // Convert to PO modal
  const [convertModal,  setConvertModal]  = useState(false);
  const [convertingPR,  setConvertingPR]  = useState(null);
  const [convertSaving, setConvertSaving] = useState(false);
  const [convertLines,  setConvertLines]  = useState([]);
  const [convertForm] = Form.useForm();

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (search)         p.search   = search;
      if (statusFilter)   p.status   = statusFilter;
      if (priorityFilter) p.priority = priorityFilter;
      const data = await prApi.getAll(p);
      setPRs(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { message.error('Failed to load purchase requisitions'); }
    finally { setLoading(false); }
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      vendorApi.getAll({ limit: 500 }).catch(() => []),
    ]).then(([i, v]) => {
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setVendors(Array.isArray(v) ? v : (v?.data ?? []));
    });
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const countDraft     = prs.filter((r) => r.status === 'draft').length;
  const countSubmitted = prs.filter((r) => r.status === 'submitted').length;
  const countApproved  = prs.filter((r) => r.status === 'approved').length;
  const countUrgent    = prs.filter((r) => r.priority === 'urgent' && !['converted', 'rejected'].includes(r.status)).length;

  // ── Detail ────────────────────────────────────────────────────────────────
  const openDetail = async (pr) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const data = await prApi.getById(pr.id);
      setDetailRecord(data?.data ?? data);
    } catch { message.error('Failed to load details'); }
    finally { setDetailLoading(false); }
  };

  // ── Create/Edit ───────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ priority: 'medium' });
    setLineItems([emptyLine()]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      department_id: record.department_id,
      required_date: record.required_date ? dayjs(record.required_date) : null,
      priority:      record.priority || 'medium',
      notes:         record.notes,
    });
    const lines = (record.Items || []).map((it) => ({
      _key:            it.id || Date.now() + Math.random(),
      item_id:         it.item_id,
      qty_requested:   parseFloat(it.qty_requested) || null,
      unit:            it.unit || 'pcs',
      estimated_price: it.estimated_price ? parseFloat(it.estimated_price) : null,
      justification:   it.justification || '',
    }));
    setLineItems(lines.length ? lines : [emptyLine()]);
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        department_id: vals.department_id || null,
        required_date: vals.required_date?.format('YYYY-MM-DD') || null,
        priority:      vals.priority || 'medium',
        notes:         vals.notes || '',
        items:         lineItems.map(({ _key, ...it }) => it),
      };
      if (editing) {
        await prApi.update(editing.id, payload);
        message.success('Purchase requisition updated');
      } else {
        await prApi.create(payload);
        message.success('Purchase requisition created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const onSubmit = async (id) => {
    try {
      await prApi.submit(id);
      message.success('Submitted for approval');
      load();
    } catch (err) { message.error(err?.message || 'Submit failed'); }
  };

  const onApprove = async (id) => {
    try {
      await prApi.approve(id);
      message.success('Requisition approved');
      load();
      if (detailRecord?.id === id) openDetail({ id });
    } catch (err) { message.error(err?.message || 'Approve failed'); }
  };

  const onReject = async () => {
    if (!rejectReason.trim()) { message.error('Rejection reason is required'); return; }
    setRejectSaving(true);
    try {
      await prApi.reject(rejectingPR.id, { approval_notes: rejectReason });
      message.success('Requisition rejected');
      setRejectModal(false);
      load();
    } catch (err) { message.error(err?.message || 'Reject failed'); }
    finally { setRejectSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await prApi.delete(id);
      message.success('Deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Open Convert Modal ────────────────────────────────────────────────────
  const openConvertModal = (pr) => {
    setConvertingPR(pr);
    convertForm.resetFields();
    convertForm.setFieldsValue({ order_date: dayjs() });
    const lines = (pr.Items || []).map((it) => ({
      id:              it.id,
      item_id:         it.item_id,
      item_name:       it.Item?.name || `Item #${it.item_id}`,
      item_code:       it.Item?.code || '',
      qty_requested:   parseFloat(it.qty_requested) || 1,
      unit:            it.unit || 'pcs',
      unit_price:      it.estimated_price ? parseFloat(it.estimated_price) : 0,
      estimated_price: it.estimated_price ? parseFloat(it.estimated_price) : 0,
    }));
    setConvertLines(lines);
    setConvertModal(true);
  };

  const onConvert = async () => {
    try {
      const vals = await convertForm.validateFields();
      setConvertSaving(true);
      const payload = {
        vendor_id:     vals.vendor_id,
        order_date:    vals.order_date?.format('YYYY-MM-DD'),
        expected_date: vals.expected_date?.format('YYYY-MM-DD') || null,
        notes:         vals.notes || '',
        items:         convertLines.map((it) => ({
          item_id:    it.item_id,
          qty_ordered: it.qty_requested,
          unit_price:  it.unit_price || 0,
          unit:        it.unit || 'pcs',
        })),
      };
      const result = await prApi.convertToPo(convertingPR.id, payload);
      const poNo = result?.data?.po?.po_no || result?.po?.po_no;
      message.success(`PO ${poNo} created successfully`);
      setConvertModal(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Conversion failed');
    } finally { setConvertSaving(false); }
  };

  // ── Line item helpers ─────────────────────────────────────────────────────
  const addLine    = () => setLineItems((p) => [...p, emptyLine()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));
  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'PR No', dataIndex: 'pr_no', key: 'pr_no', width: 140,
      render: (no, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => openDetail(r)}
        >
          {no}
        </Text>
      ),
    },
    {
      title: 'Requested By', key: 'requester', width: 150,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>{r.Requester?.name || '—'}</Text>
          {r.Department && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.Department.name}</Text></div>}
        </div>
      ),
    },
    {
      title: 'Required By', dataIndex: 'required_date', key: 'required_date', width: 110,
      render: (d) => {
        if (!d) return <Text type="secondary">—</Text>;
        const isUrgent = dayjs(d).isBefore(dayjs().add(3, 'day'));
        return <Text style={{ color: isUrgent ? '#dc2626' : undefined }}>{dayjs(d).format('DD MMM YYYY')}</Text>;
      },
    },
    {
      title: 'Priority', dataIndex: 'priority', key: 'priority', width: 90,
      render: (p) => {
        const cfg = PRIORITY_CONFIG[p] || { color: 'default', label: p };
        return <Tag color={cfg.color} style={{ fontSize: 11 }}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Items', key: 'items', width: 60, align: 'center',
      render: (_, r) => <Badge count={(r.Items || []).length} style={{ backgroundColor: '#e0e7ff', color: '#1d4ed8' }} />,
    },
    {
      title: 'Est. Value', key: 'value', width: 110, align: 'right',
      render: (_, r) => <Text style={{ fontSize: 12 }}>{fmtCcy(estTotal(r.Items || []))}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 11 }}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Actions', key: 'actions', width: 200,
      render: (_, r) => {
        const isDraft     = r.status === 'draft';
        const isSubmitted = r.status === 'submitted';
        const isApproved  = r.status === 'approved';
        const isRejected  = r.status === 'rejected';
        return (
          <Space size={3} wrap>
            <Tooltip title="View Detail">
              <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
            </Tooltip>

            {/* Submit */}
            {(isDraft || isRejected) && (
              <Tooltip title="Submit for Approval">
                <Popconfirm title="Submit this requisition for approval?" onConfirm={() => onSubmit(r.id)} okText="Submit">
                  <Button size="small" icon={<SendOutlined />} style={{ color: '#d97706', borderColor: '#d97706' }} />
                </Popconfirm>
              </Tooltip>
            )}

            {/* Approve / Reject (approvers only) */}
            {canApprove && isSubmitted && (
              <>
                <Tooltip title="Approve">
                  <Popconfirm title="Approve this requisition?" onConfirm={() => onApprove(r.id)} okText="Approve" okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}>
                    <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#16a34a', borderColor: '#16a34a' }} />
                  </Popconfirm>
                </Tooltip>
                <Tooltip title="Reject">
                  <Button
                    size="small" icon={<CloseCircleOutlined />} danger
                    onClick={() => { setRejectingPR(r); setRejectReason(''); setRejectModal(true); }}
                  />
                </Tooltip>
              </>
            )}

            {/* Convert to PO */}
            {isApproved && (
              <Tooltip title="Convert to Purchase Order">
                <Button
                  size="small"
                  icon={<ShoppingCartOutlined />}
                  type="primary"
                  onClick={() => openConvertModal(r)}
                >
                  Create PO
                </Button>
              </Tooltip>
            )}

            {/* Edit */}
            {(isDraft || isRejected) && (
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
            )}

            {/* Delete */}
            {isDraft && (
              <Popconfirm title="Delete this requisition?" onConfirm={() => onDelete(r.id)} okType="danger" okText="Delete">
                <Tooltip title="Delete">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Purchase Requisitions</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Purchase Requisitions</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Raise internal purchase requests — approved requisitions convert to Purchase Orders.</Text>

      {/* Stat tiles */}
      <Row gutter={12} style={{ marginTop: 12, marginBottom: 16 }}>
        {[
          { label: 'Total PRs',          value: prs.length,    color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Draft',              value: countDraft,    color: '#6b7280', bg: '#f9fafb' },
          { label: 'Pending Approval',   value: countSubmitted,color: '#d97706', bg: '#fffbeb' },
          { label: 'Approved (Open)',     value: countApproved, color: '#059669', bg: '#f0fdf4' },
          { label: 'Urgent',             value: countUrgent,   color: '#dc2626', bg: '#fef2f2' },
        ].map((t) => (
          <Col key={t.label} xs={12} sm={4}>
            <Card
              size="small"
              style={{ background: t.bg, border: `1px solid ${t.color}20`, borderRadius: 10 }}
              styles={{ body: { padding: '10px 14px' } }}
            >
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{t.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.color }}>{t.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search PR number..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Status"
            allowClear value={statusFilter} onChange={setStatusFilter}
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 140 }}
          />
          <Select
            placeholder="Priority"
            allowClear value={priorityFilter} onChange={setPriorityFilter}
            options={Object.entries(PRIORITY_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 120 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('purchase-requisitions.csv', prs, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Requisition</Button>
        </div>

        <ResponsiveTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={prs}
          size="small"
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <Text strong>{detailRecord?.pr_no}</Text>
            {detailRecord && <Tag color={STATUS_CONFIG[detailRecord.status]?.color}>{STATUS_CONFIG[detailRecord.status]?.label}</Tag>}
            {detailRecord && <Tag color={PRIORITY_CONFIG[detailRecord.priority]?.color}>{PRIORITY_CONFIG[detailRecord.priority]?.label} Priority</Tag>}
          </Space>
        }
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailRecord(null); }}
        width={680}
        extra={
          detailRecord?.status === 'approved' && (
            <Button
              type="primary" icon={<ShoppingCartOutlined />}
              onClick={() => { setDetailOpen(false); openConvertModal(detailRecord); }}
            >
              Create PO
            </Button>
          )
        }
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : detailRecord ? (
          <div style={{ fontSize: 13 }}>
            {detailRecord.status === 'rejected' && detailRecord.approval_notes && (
              <Alert type="warning" showIcon message={`Rejected: ${detailRecord.approval_notes}`} style={{ marginBottom: 16 }} />
            )}
            <Descriptions size="small" bordered column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Requested By">{detailRecord.Requester?.name || '—'} <Text type="secondary" style={{ fontSize: 11 }}>({detailRecord.Requester?.employee_id})</Text></Descriptions.Item>
              <Descriptions.Item label="Department">{detailRecord.Department?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Required By">{detailRecord.required_date ? dayjs(detailRecord.required_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Priority"><Tag color={PRIORITY_CONFIG[detailRecord.priority]?.color}>{PRIORITY_CONFIG[detailRecord.priority]?.label}</Tag></Descriptions.Item>
              {detailRecord.approved_by && <Descriptions.Item label="Approved By">{detailRecord.Approver?.name || '—'}</Descriptions.Item>}
              {detailRecord.approved_at && <Descriptions.Item label="Approved On">{dayjs(detailRecord.approved_at).format('DD MMM YYYY HH:mm')}</Descriptions.Item>}
              {detailRecord.notes && <Descriptions.Item label="Notes" span={2}>{detailRecord.notes}</Descriptions.Item>}
            </Descriptions>

            <Divider orientation="left" style={{ fontSize: 12, fontWeight: 600 }}>Requested Items</Divider>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailRecord.Items || []}
              columns={[
                {
                  title: 'Item', key: 'item',
                  render: (_, r) => (
                    <div>
                      <Text style={{ fontWeight: 500 }}>{r.Item?.name || '—'}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>{r.Item?.code}</Text>
                    </div>
                  ),
                },
                { title: 'Qty Requested', dataIndex: 'qty_requested', width: 110, align: 'right', render: (v, r) => `${parseFloat(v).toLocaleString()} ${r.unit}` },
                { title: 'Est. Price', dataIndex: 'estimated_price', width: 100, align: 'right', render: fmtCcy },
                { title: 'Est. Amount', width: 110, align: 'right', render: (_, r) => fmtCcy(parseFloat(r.qty_requested) * parseFloat(r.estimated_price || 0)) },
                { title: 'Justification', dataIndex: 'justification', render: (v) => v || <Text type="secondary">—</Text> },
              ]}
              summary={() => {
                const total = estTotal(detailRecord.Items || []);
                if (!total) return null;
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Estimated Total</Table.Summary.Cell>
                    <Table.Summary.Cell style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>{fmtCcy(total)}</Table.Summary.Cell>
                    <Table.Summary.Cell />
                  </Table.Summary.Row>
                );
              }}
            />
          </div>
        ) : null}
      </Drawer>

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit — ${editing.pr_no}` : 'New Purchase Requisition'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onSave}>
              {editing ? 'Update' : 'Create Requisition'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="required_date" label="Required By Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
                <Select
                  options={Object.entries(PRIORITY_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes / Purpose">
            <Input.TextArea rows={2} placeholder="Why is this purchase needed?" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600 }}>Items Required</Divider>

          <div className="res-line-items">
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 80px 80px 90px 80px 28px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Qty', 'Unit', 'Est. Price', 'Justification', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => (
            <div
              key={row._key}
              style={{ display: 'grid', gridTemplateColumns: '1.5fr 80px 80px 90px 80px 28px', gap: 6, marginBottom: 8, alignItems: 'center' }}
            >
              <Select
                showSearch size="small" placeholder="Select item" optionFilterProp="label"
                value={row.item_id}
                onChange={(v) => {
                  const master = items.find((i) => i.id === v);
                  setLineItems((prev) => prev.map((r) =>
                    r._key === row._key ? { ...r, item_id: v ?? null, unit: master?.unit || r.unit || 'pcs' } : r
                  ));
                }}
                allowClear
                options={items.map((i) => ({ value: i.id, label: `${i.name}${i.code ? ` (${i.code})` : ''}` }))}
              />
              <InputNumber size="small" min={0} precision={0} value={row.qty_requested} onChange={(v) => updateLine(row._key, 'qty_requested', v)} style={{ width: '100%' }} />
              <Input size="small" placeholder="pcs" value={row.unit} onChange={(e) => updateLine(row._key, 'unit', e.target.value)} />
              <InputNumber size="small" min={0} precision={2} placeholder="₹" value={row.estimated_price} onChange={(v) => updateLine(row._key, 'estimated_price', v)} style={{ width: '100%' }} />
              <Input size="small" placeholder="Why needed?" value={row.justification} onChange={(e) => updateLine(row._key, 'justification', e.target.value)} />
              <Button size="small" type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeLine(row._key)} disabled={lineItems.length === 1} />
            </div>
          ))}

          <Button type="dashed" onClick={addLine} icon={<PlusCircleOutlined />} style={{ width: '100%', marginTop: 4 }}>
            Add Item
          </Button>

          {estTotal(lineItems) > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, textAlign: 'right' }}>
              <Text strong style={{ color: '#1d4ed8' }}>
                Estimated Total: {fmtCcy(estTotal(lineItems))}
              </Text>
            </div>
          )}
          </div>
        </Form>
      </Drawer>

      {/* ── Reject Modal ──────────────────────────────────────────────────── */}
      <Modal
        title={<Space><CloseCircleOutlined style={{ color: '#dc2626' }} /><span>Reject Requisition — {rejectingPR?.pr_no}</span></Space>}
        open={rejectModal}
        onCancel={() => setRejectModal(false)}
        onOk={onReject}
        okText="Reject"
        okButtonProps={{ danger: true, loading: rejectSaving }}
        okType="danger"
      >
        <Alert type="error" showIcon message="The requisition will be returned to the requester for rework." style={{ marginBottom: 12 }} />
        <Input.TextArea
          rows={3}
          placeholder="Rejection reason (required)..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      {/* ── Convert to PO Modal ───────────────────────────────────────────── */}
      <Modal
        title={<Space><ShoppingCartOutlined style={{ color: '#1d4ed8' }} /><span>Convert to Purchase Order — {convertingPR?.pr_no}</span></Space>}
        open={convertModal}
        onCancel={() => setConvertModal(false)}
        onOk={onConvert}
        okText="Create Purchase Order"
        okButtonProps={{ loading: convertSaving, type: 'primary' }}
        width={760}
      >
        <Form form={convertForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="vendor_id" label="Vendor" rules={[{ required: true, message: 'Select a vendor' }]}>
                <Select
                  showSearch placeholder="Select vendor" optionFilterProp="label"
                  options={vendors.map((v) => ({ value: v.id, label: `${v.name}${v.partner_code ? ` (${v.partner_code})` : ''}` }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="order_date" label="PO Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="expected_date" label="Expected Delivery">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="PO Notes">
            <Input.TextArea rows={2} placeholder="Terms, delivery instructions…" />
          </Form.Item>
        </Form>

        <Divider orientation="left" style={{ fontSize: 12, fontWeight: 600 }}>Line Items — adjust prices before creating PO</Divider>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={convertLines}
          columns={[
            {
              title: 'Item', key: 'item',
              render: (_, r) => (
                <div>
                  <Text style={{ fontWeight: 500 }}>{r.item_name}</Text>
                  {r.item_code && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.item_code}</Text>}
                </div>
              ),
            },
            {
              title: 'Qty', dataIndex: 'qty_requested', width: 90, align: 'right',
              render: (v, r) => `${parseFloat(v).toLocaleString()} ${r.unit}`,
            },
            {
              title: 'Unit Price',
              width: 120,
              render: (_, row) => (
                <InputNumber
                  size="small"
                  min={0}
                  precision={2}
                  prefix="₹"
                  value={row.unit_price}
                  onChange={(v) =>
                    setConvertLines((p) => p.map((r) => r.id === row.id ? { ...r, unit_price: v || 0 } : r))
                  }
                  style={{ width: '100%' }}
                />
              ),
            },
            {
              title: 'Amount', width: 110, align: 'right',
              render: (_, r) => <Text strong>{fmtCcy(r.qty_requested * (r.unit_price || 0))}</Text>,
            },
          ]}
          summary={() => {
            const total = convertLines.reduce((s, r) => s + r.qty_requested * (r.unit_price || 0), 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total PO Value</Table.Summary.Cell>
                <Table.Summary.Cell style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmtCcy(total)}</Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Modal>
    </AppLayout>
  );
}
