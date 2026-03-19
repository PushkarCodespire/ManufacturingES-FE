import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col, Modal, Alert, Progress, Descriptions,
  Timeline, Empty,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  PlusCircleOutlined, MinusCircleOutlined,
  SendOutlined, InboxOutlined, BulbOutlined,
  WarningOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FilePdfOutlined, EyeOutlined, StopOutlined, AuditOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout            from '../../../components/AppLayout';
import usePermissions       from '../../../hooks/usePermissions';
import { purchaseOrderApi } from '../../../api/procurement.api';
import { vendorApi }        from '../../../api/vendor.api';
import { itemApi }          from '../../../api/item.api';
import aiApi                from '../../../api/ai.api';
import useAiSuggestion      from '../../../hooks/useAiSuggestion';
import AiSuggestionCard     from '../../../components/AiSuggestion/AiSuggestionCard';

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

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  draft:     { color: 'default', label: 'Draft'     },
  sent:      { color: 'blue',    label: 'Sent'      },
  partial:   { color: 'orange',  label: 'Partial'   },
  received:  { color: 'green',   label: 'Received'  },
  cancelled: { color: 'red',     label: 'Cancelled' },
};

const APPROVAL_CONFIG = {
  pending_approval: { color: 'gold',    label: 'Pending Approval', icon: <ClockCircleOutlined /> },
  approved:         { color: 'green',   label: 'Approved',         icon: <CheckCircleOutlined /> },
  rejected:         { color: 'red',     label: 'Rejected',         icon: <CloseCircleOutlined /> },
};

const emptyLine = () => ({
  _key:        Date.now() + Math.random(),
  item_id:     null,
  qty_ordered: null,
  unit_price:  null,
  unit:        'pcs',
});

const fmtCcy = (v) =>
  v != null ? `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const isOverdue = (r) =>
  r.expected_date &&
  !['received', 'cancelled'].includes(r.status) &&
  dayjs(r.expected_date).isBefore(dayjs(), 'day');

const poTotal = (items) =>
  (items || []).reduce((s, it) => s + parseFloat(it.qty_ordered || 0) * parseFloat(it.unit_price || 0), 0);

// ── Print PO ─────────────────────────────────────────────────────────────────
const printPO = (po, items) => {
  const lines = items.map((it) => `
    <tr>
      <td>${it.Item?.code || '—'}</td>
      <td>${it.Item?.name || '—'}</td>
      <td style="text-align:right">${parseFloat(it.qty_ordered).toLocaleString()}</td>
      <td>${it.unit || 'pcs'}</td>
      <td style="text-align:right">₹${parseFloat(it.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td style="text-align:right">₹${(parseFloat(it.qty_ordered || 0) * parseFloat(it.unit_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('');
  const total = poTotal(items);
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Purchase Order — ${po.po_no}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; color: #111; }
      h1 { font-size: 22px; margin: 0; } h2 { font-size: 14px; margin: 0; color: #555; }
      .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; font-size: 12px; }
      .meta-label { color: #888; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #1d4ed8; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      .total-row { font-weight: bold; background: #f0fdf4; }
      .total-row td { border-top: 2px solid #16a34a; font-size: 13px; }
      .footer { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
      .sig-box { border-top: 1px solid #ccc; padding-top: 8px; font-size: 11px; color: #555; }
      @media print { button { display: none; } }
    </style>
  </head><body>
    <div class="header">
      <div><h1>Purchase Order</h1><h2>${po.po_no}</h2></div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#888">Order Date</div>
        <div>${po.order_date ? dayjs(po.order_date).format('DD MMM YYYY') : '—'}</div>
        <div style="font-size:11px;color:#888;margin-top:6px">Expected Delivery</div>
        <div>${po.expected_date ? dayjs(po.expected_date).format('DD MMM YYYY') : '—'}</div>
      </div>
    </div>
    <div class="meta">
      <div><div class="meta-label">Vendor</div><strong>${po.Vendor?.name || '—'}</strong></div>
      <div><div class="meta-label">Partner Code</div>${po.Vendor?.partner_code || '—'}</div>
      <div><div class="meta-label">GSTIN</div>${po.Vendor?.gstin || '—'}</div>
      <div><div class="meta-label">Address</div>${[po.Vendor?.address, po.Vendor?.city, po.Vendor?.state].filter(Boolean).join(', ') || '—'}</div>
    </div>
    ${po.notes ? `<div style="background:#fffbeb;border:1px solid #fef08a;padding:8px 12px;border-radius:4px;margin-bottom:16px;font-size:11px;"><strong>Notes:</strong> ${po.notes}</div>` : ''}
    <table>
      <thead><tr><th>#</th><th>Description</th><th style="text-align:right">Qty</th><th>Unit</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${lines}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="5" style="text-align:right">Total Order Value</td>
          <td style="text-align:right">₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <div class="sig-box">Prepared By<br><br><br>${po.Creator?.name || ''}</div>
      <div class="sig-box">Authorised Signatory<br><br><br>&nbsp;</div>
    </div>
    <script>window.onload = () => window.print();</script>
  </body></html>`);
  win.document.close();
};

// ─────────────────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const { can, isAdmin } = usePermissions();
  const canWrite  = can('plan-po-create_po-create_edit_delete');
  const canApprove = can('plan-po-approve_po-approve_reject') || isAdmin;

  const [pos,          setPOs]          = useState([]);
  const [vendors,      setVendors]      = useState([]);
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [vendorFilter, setVendorFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [approvalFilter, setApprovalFilter] = useState(null);

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

  // Receive modal
  const [receiveModal,  setReceiveModal]  = useState(false);
  const [receivingPO,   setReceivingPO]   = useState(null);
  const [receiveLines,  setReceiveLines]  = useState([]);
  const [receiveSaving, setReceiveSaving] = useState(false);

  // Cancel modal
  const [cancelModal,  setCancelModal]  = useState(false);
  const [cancellingPO, setCancellingPO] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  // Approve modal
  const [approveModal,  setApproveModal]  = useState(false);
  const [approvingPO,   setApprovingPO]   = useState(null);
  const [approveNotes,  setApproveNotes]  = useState('');
  const [approveSaving, setApproveSaving] = useState(false);

  // Reject modal
  const [rejectModal,  setRejectModal]  = useState(false);
  const [rejectingPO,  setRejectingPO]  = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);

  // AI
  const aiRisk = useAiSuggestion(aiApi.getPoAiRiskFlag);
  const [aiPoDrawerOpen, setAiPoDrawerOpen] = useState(false);
  const [aiPoRecord,     setAiPoRecord]     = useState(null);

  const openAiPoDrawer = (po) => {
    setAiPoRecord(po); setAiPoDrawerOpen(true); aiRisk.reset(); aiRisk.fetch(po.id);
  };
  const closeAiPoDrawer = () => { setAiPoDrawerOpen(false); setAiPoRecord(null); aiRisk.reset(); };

  // ── Load POs ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (search)         p.search          = search;
      if (vendorFilter)   p.vendor_id       = vendorFilter;
      if (statusFilter)   p.status          = statusFilter;
      if (approvalFilter) p.approval_status = approvalFilter;
      const data = await purchaseOrderApi.getAll(p);
      setPOs(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { message.error('Failed to load purchase orders'); }
    finally { setLoading(false); }
  }, [search, vendorFilter, statusFilter, approvalFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      vendorApi.getAll({ limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
    ]).then(([v, i]) => {
      setVendors(Array.isArray(v) ? v : (v?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const countDraft    = pos.filter((r) => r.status === 'draft').length;
  const countPending  = pos.filter((r) => r.approval_status === 'pending_approval' && r.status === 'draft').length;
  const countOverdue  = pos.filter(isOverdue).length;
  const totalValue    = pos.reduce((s, r) => s + poTotal(r.Items || []), 0);

  // ── Detail Drawer ──────────────────────────────────────────────────────────
  const openDetail = async (po) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const data = await purchaseOrderApi.getById(po.id);
      setDetailRecord(data?.data ?? data);
    } catch { message.error('Failed to load PO details'); }
    finally { setDetailLoading(false); }
  };

  // ── Create/Edit helpers ────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ order_date: dayjs() });
    setLineItems([emptyLine()]);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      vendor_id:     record.vendor_id,
      order_date:    record.order_date    ? dayjs(record.order_date)    : null,
      expected_date: record.expected_date ? dayjs(record.expected_date) : null,
      notes:         record.notes,
    });
    const lines = (record.Items || []).map((it) => ({
      _key:        it.id || Date.now() + Math.random(),
      item_id:     it.item_id,
      qty_ordered: parseFloat(it.qty_ordered) || null,
      unit_price:  parseFloat(it.unit_price)  || null,
      unit:        it.unit || 'pcs',
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
        vendor_id:     vals.vendor_id,
        order_date:    vals.order_date?.format('YYYY-MM-DD'),
        expected_date: vals.expected_date?.format('YYYY-MM-DD') || null,
        notes:         vals.notes || '',
        items:         lineItems.map(({ _key, ...it }) => it),
      };
      if (editing) {
        await purchaseOrderApi.update(editing.id, payload);
        message.success('Purchase order updated');
      } else {
        await purchaseOrderApi.create(payload);
        message.success('Purchase order created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  // ── Action handlers ────────────────────────────────────────────────────────
  const onSubmitApproval = async (id) => {
    try {
      await purchaseOrderApi.submitForApproval(id);
      message.success('Submitted for approval');
      load();
      if (detailRecord?.id === id) openDetail({ id });
    } catch (err) { message.error(err?.message || 'Failed'); }
  };

  const onApprove = async () => {
    setApproveSaving(true);
    try {
      await purchaseOrderApi.approve(approvingPO.id, { approval_notes: approveNotes || undefined });
      message.success('Purchase order approved');
      setApproveModal(false);
      load();
      if (detailRecord?.id === approvingPO.id) openDetail({ id: approvingPO.id });
    } catch (err) { message.error(err?.message || 'Approve failed'); }
    finally { setApproveSaving(false); }
  };

  const onReject = async () => {
    if (!rejectReason.trim()) { message.error('Rejection reason is required'); return; }
    setRejectSaving(true);
    try {
      await purchaseOrderApi.reject(rejectingPO.id, { approval_notes: rejectReason });
      message.success('Purchase order rejected');
      setRejectModal(false);
      load();
      if (detailRecord?.id === rejectingPO.id) openDetail({ id: rejectingPO.id });
    } catch (err) { message.error(err?.message || 'Reject failed'); }
    finally { setRejectSaving(false); }
  };

  const onSend = async (id) => {
    try {
      await purchaseOrderApi.send(id);
      message.success('Purchase order sent to vendor');
      load();
    } catch (err) { message.error(err?.message || 'Send failed'); }
  };

  const openReceiveModal = (record) => {
    setReceivingPO(record);
    const lines = (record.Items || []).map((it) => ({
      id:           it.id,
      item_name:    it.Item?.name || `Item #${it.item_id}`,
      qty_ordered:  parseFloat(it.qty_ordered) || 0,
      qty_received: 0,
    }));
    setReceiveLines(lines);
    setReceiveModal(true);
  };

  const onReceive = async () => {
    setReceiveSaving(true);
    try {
      await purchaseOrderApi.receive(receivingPO.id, {
        items: receiveLines.map(({ id, qty_received }) => ({ id, qty_received })),
      });
      message.success('Receipt recorded');
      setReceiveModal(false);
      load();
    } catch (err) { message.error(err?.message || 'Receive failed'); }
    finally { setReceiveSaving(false); }
  };

  const onCancel = async () => {
    if (!cancelReason.trim()) { message.error('Cancel reason is required'); return; }
    setCancelSaving(true);
    try {
      await purchaseOrderApi.cancel(cancellingPO.id, { cancel_reason: cancelReason });
      message.success('Purchase order cancelled');
      setCancelModal(false);
      setCancelReason('');
      load();
    } catch (err) { message.error(err?.message || 'Cancel failed'); }
    finally { setCancelSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await purchaseOrderApi.delete(id);
      message.success('Purchase order deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Line item helpers ──────────────────────────────────────────────────────
  const addLine    = () => setLineItems((p) => [...p, emptyLine()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));
  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  const lineTotal = lineItems.reduce(
    (s, r) => s + ((r.qty_ordered || 0) * (r.unit_price || 0)), 0
  );

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'PO No', dataIndex: 'po_no', key: 'po_no', width: 160,
      render: (no, r) => (
        <div>
          <Text
            style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', display: 'block' }}
            onClick={() => openDetail(r)}
          >
            {no}
          </Text>
          {isOverdue(r) && (
            <Tag color="red" style={{ fontSize: 10, marginTop: 2, lineHeight: '16px' }}>
              <ExclamationCircleOutlined /> OVERDUE
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Vendor', key: 'vendor', width: 180,
      render: (_, r) => r.Vendor ? (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Vendor.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Vendor.partner_code}</Text>
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Order Date', dataIndex: 'order_date', key: 'order_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Expected', dataIndex: 'expected_date', key: 'expected_date', width: 110,
      render: (d, r) => {
        if (!d) return <Text type="secondary">—</Text>;
        const overdue = isOverdue(r);
        return (
          <Text style={{ color: overdue ? '#dc2626' : undefined, fontWeight: overdue ? 600 : undefined }}>
            {dayjs(d).format('DD MMM YYYY')}
          </Text>
        );
      },
    },
    {
      title: 'Value', key: 'value', width: 120, align: 'right',
      render: (_, r) => {
        const v = poTotal(r.Items || []);
        return <Text style={{ fontWeight: 500, fontSize: 12 }}>{v > 0 ? fmtCcy(v) : '—'}</Text>;
      },
    },
    {
      title: 'Approval', key: 'approval', width: 130,
      render: (_, r) => {
        const cfg = APPROVAL_CONFIG[r.approval_status];
        if (!cfg) return null;
        return <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 11 }}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 95,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'AI', key: 'ai', width: 44, align: 'center',
      render: (_, r) => (
        <Tooltip title="AI Risk Analysis">
          <Button
            size="small"
            icon={<BulbOutlined />}
            style={{ color: '#7c3aed', borderColor: '#7c3aed' }}
            onClick={() => openAiPoDrawer(r)}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Actions', key: 'actions', width: 200,
      render: (_, r) => {
        const isDraft    = r.status === 'draft';
        const canReceive = ['sent', 'partial'].includes(r.status);
        const canCancel  = !['received', 'cancelled'].includes(r.status);
        const isPendingApproval = r.approval_status === 'pending_approval';
        const isApproved        = r.approval_status === 'approved';
        return (
          <Space size={3} wrap>
            {/* View detail */}
            <Tooltip title="View Detail">
              <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
            </Tooltip>

            {/* Print */}
            <Tooltip title="Print PO">
              <Button
                size="small"
                icon={<FilePdfOutlined />}
                style={{ color: '#0891b2', borderColor: '#0891b2' }}
                onClick={() => printPO(r, r.Items || [])}
              />
            </Tooltip>

            {/* Approval actions */}
            {canWrite && isDraft && !isApproved && (
              <Tooltip title="Submit for Approval">
                <Button
                  size="small"
                  icon={<AuditOutlined />}
                  style={{ color: '#d97706', borderColor: '#d97706' }}
                  onClick={() => onSubmitApproval(r.id)}
                />
              </Tooltip>
            )}
            {canApprove && isPendingApproval && (
              <>
                <Tooltip title="Approve">
                  <Button
                    size="small"
                    icon={<CheckCircleOutlined />}
                    style={{ color: '#16a34a', borderColor: '#16a34a' }}
                    onClick={() => { setApprovingPO(r); setApproveNotes(''); setApproveModal(true); }}
                  />
                </Tooltip>
                <Tooltip title="Reject">
                  <Button
                    size="small"
                    icon={<CloseCircleOutlined />}
                    danger
                    onClick={() => { setRejectingPO(r); setRejectReason(''); setRejectModal(true); }}
                  />
                </Tooltip>
              </>
            )}

            {/* Send to vendor */}
            {canWrite && isDraft && isApproved && (
              <Popconfirm title="Send to vendor?" onConfirm={() => onSend(r.id)} okText="Send">
                <Tooltip title="Send to Vendor">
                  <Button size="small" type="primary" ghost icon={<SendOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}

            {/* Record receipt */}
            {canWrite && canReceive && (
              <Tooltip title="Record Receipt">
                <Button
                  size="small"
                  icon={<InboxOutlined />}
                  style={{ borderColor: '#16a34a', color: '#16a34a' }}
                  onClick={() => openReceiveModal(r)}
                />
              </Tooltip>
            )}

            {/* Edit */}
            {canWrite && ['draft', 'rejected'].includes(r.status) && (
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
            )}

            {/* Cancel */}
            {canWrite && canCancel && r.status !== 'draft' && (
              <Tooltip title="Cancel PO">
                <Button
                  size="small"
                  icon={<StopOutlined />}
                  danger
                  onClick={() => { setCancellingPO(r); setCancelReason(''); setCancelModal(true); }}
                />
              </Tooltip>
            )}

            {/* Delete (draft only) */}
            {canWrite && isDraft && (
              <Popconfirm title="Delete this purchase order?" onConfirm={() => onDelete(r.id)} okType="danger" okText="Delete">
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Purchase Orders</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Purchase Orders</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Raise, approve and track purchase orders to vendors.</Text>

      {/* Stat tiles */}
      <Row gutter={12} style={{ marginTop: 12, marginBottom: 16 }}>
        {[
          { label: 'Total POs',        value: pos.length,   color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Draft',            value: countDraft,   color: '#6b7280', bg: '#f9fafb' },
          { label: 'Pending Approval', value: countPending, color: '#d97706', bg: '#fffbeb' },
          { label: 'Overdue',          value: countOverdue, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Total Value',      value: fmtCcy(totalValue), color: '#059669', bg: '#f0fdf4', wide: true },
        ].map((t) => (
          <Col key={t.label} span={t.wide ? 6 : 4}>
            <Card
              size="small"
              style={{ background: t.bg, border: `1px solid ${t.color}20`, borderRadius: 10 }}
              bodyStyle={{ padding: '10px 14px' }}
            >
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{t.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.color }}>{t.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search PO number..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Vendor"
            allowClear value={vendorFilter} onChange={setVendorFilter}
            showSearch optionFilterProp="label"
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            style={{ width: 180 }}
          />
          <Select
            placeholder="Status"
            allowClear value={statusFilter} onChange={setStatusFilter}
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 130 }}
          />
          <Select
            placeholder="Approval"
            allowClear value={approvalFilter} onChange={setApprovalFilter}
            options={Object.entries(APPROVAL_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 150 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New PO</Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={pos}
          size="small"
          scroll={{ x: 1400 }}
          rowStyle={(r) => isOverdue(r) ? { background: '#fff5f5' } : undefined}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Detail Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <Text strong>{detailRecord?.po_no}</Text>
            {detailRecord && <Tag color={STATUS_CONFIG[detailRecord.status]?.color}>{STATUS_CONFIG[detailRecord.status]?.label}</Tag>}
            {detailRecord && APPROVAL_CONFIG[detailRecord.approval_status] && (
              <Tag color={APPROVAL_CONFIG[detailRecord.approval_status].color}>
                {APPROVAL_CONFIG[detailRecord.approval_status].label}
              </Tag>
            )}
          </Space>
        }
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailRecord(null); }}
        width={760}
        extra={
          detailRecord && (
            <Button
              icon={<FilePdfOutlined />}
              style={{ color: '#0891b2', borderColor: '#0891b2' }}
              onClick={() => printPO(detailRecord, detailRecord.Items || [])}
            >
              Print PO
            </Button>
          )
        }
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : detailRecord ? (
          <div style={{ fontSize: 13 }}>
            {/* Overdue alert */}
            {isOverdue(detailRecord) && (
              <Alert
                type="error" showIcon icon={<WarningOutlined />}
                message={`Overdue by ${dayjs().diff(dayjs(detailRecord.expected_date), 'day')} day(s) — expected ${dayjs(detailRecord.expected_date).format('DD MMM YYYY')}`}
                style={{ marginBottom: 16 }}
              />
            )}
            {/* Rejection notes */}
            {detailRecord.approval_status === 'rejected' && detailRecord.approval_notes && (
              <Alert
                type="warning" showIcon message={`Rejected: ${detailRecord.approval_notes}`}
                style={{ marginBottom: 16 }}
              />
            )}
            {/* Cancel reason */}
            {detailRecord.status === 'cancelled' && detailRecord.cancel_reason && (
              <Alert
                type="error" showIcon message={`Cancelled: ${detailRecord.cancel_reason}`}
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Summary */}
            <Descriptions size="small" bordered column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Vendor" span={2}>
                <div>
                  <Text strong>{detailRecord.Vendor?.name}</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>{detailRecord.Vendor?.partner_code}</Text>
                  {detailRecord.Vendor?.gstin && <div style={{ fontSize: 11 }}>GSTIN: {detailRecord.Vendor.gstin}</div>}
                  {detailRecord.Vendor?.city && <div style={{ fontSize: 11, color: '#6b7280' }}>{[detailRecord.Vendor.address, detailRecord.Vendor.city, detailRecord.Vendor.state].filter(Boolean).join(', ')}</div>}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Order Date">{dayjs(detailRecord.order_date).format('DD MMM YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Expected Delivery">{detailRecord.expected_date ? dayjs(detailRecord.expected_date).format('DD MMM YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Created By">{detailRecord.Creator?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Approved By">{detailRecord.Approver?.name || '—'}</Descriptions.Item>
              {detailRecord.notes && <Descriptions.Item label="Notes" span={2}>{detailRecord.notes}</Descriptions.Item>}
            </Descriptions>

            {/* Line Items — with reconciliation */}
            <Divider orientation="left" style={{ fontSize: 12, fontWeight: 600 }}>Line Items — Ordered vs Received</Divider>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailRecord.Items || []}
              columns={[
                { title: 'Item', key: 'item', render: (_, r) => <div><Text style={{ fontWeight: 500 }}>{r.Item?.name || '—'}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.Item?.code}</Text></div> },
                { title: 'Ordered', dataIndex: 'qty_ordered', width: 80, align: 'right', render: (v, r) => `${parseFloat(v).toLocaleString()} ${r.unit}` },
                { title: 'Received', dataIndex: 'qty_received', width: 80, align: 'right', render: (v, r) => `${parseFloat(v || 0).toLocaleString()} ${r.unit}` },
                {
                  title: 'Pending', width: 80, align: 'right',
                  render: (_, r) => {
                    const pending = parseFloat(r.qty_ordered) - parseFloat(r.qty_received || 0);
                    return <Text style={{ color: pending > 0 ? '#d97706' : '#16a34a', fontWeight: 600 }}>{pending.toLocaleString()} {r.unit}</Text>;
                  },
                },
                {
                  title: 'Receipt %', width: 90,
                  render: (_, r) => {
                    const pct = Math.round((parseFloat(r.qty_received || 0) / parseFloat(r.qty_ordered)) * 100);
                    return <Progress percent={pct} size="small" strokeColor={pct === 100 ? '#16a34a' : '#d97706'} />;
                  },
                },
                { title: 'Unit Price', dataIndex: 'unit_price', width: 90, align: 'right', render: (v) => fmtCcy(v) },
                { title: 'Amount', width: 100, align: 'right', render: (_, r) => <Text strong>{fmtCcy(parseFloat(r.qty_ordered) * parseFloat(r.unit_price || 0))}</Text> },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={6} style={{ textAlign: 'right', fontWeight: 700 }}>Total Order Value</Table.Summary.Cell>
                  <Table.Summary.Cell style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmtCcy(poTotal(detailRecord.Items || []))}</Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />

            {/* GRN History */}
            {(detailRecord.GRNs || []).length > 0 && (
              <>
                <Divider orientation="left" style={{ fontSize: 12, fontWeight: 600 }}>GRN History</Divider>
                {(detailRecord.GRNs || []).map((grn) => (
                  <Card
                    key={grn.id}
                    size="small"
                    style={{ marginBottom: 10, border: '1px solid #e5e7eb', borderRadius: 8 }}
                    title={
                      <Space>
                        <Text strong style={{ fontSize: 12 }}>{grn.grn_no}</Text>
                        <Tag color={grn.status === 'approved' ? 'green' : 'orange'} style={{ fontSize: 10 }}>{grn.status}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>{grn.received_date ? dayjs(grn.received_date).format('DD MMM YYYY') : ''}</Text>
                        {grn.invoice_no && <Text type="secondary" style={{ fontSize: 11 }}>Invoice: {grn.invoice_no}</Text>}
                      </Space>
                    }
                  >
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={grn.Items || []}
                      columns={[
                        { title: 'Item', key: 'item', render: (_, r) => r.Item?.name || r.item_id },
                        { title: 'Qty Received', dataIndex: 'qty_received', align: 'right', width: 100, render: (v, r) => `${parseFloat(v).toLocaleString()} ${r.unit}` },
                        { title: 'Unit Price', dataIndex: 'unit_price', align: 'right', width: 90, render: fmtCcy },
                        { title: 'Lot No.', dataIndex: 'lot_no', width: 90, render: (v) => v || '—' },
                      ]}
                    />
                  </Card>
                ))}
              </>
            )}
            {(detailRecord.GRNs || []).length === 0 && detailRecord.status !== 'draft' && (
              <div style={{ marginTop: 16 }}>
                <Divider orientation="left" style={{ fontSize: 12, fontWeight: 600 }}>GRN History</Divider>
                <Empty description="No GRNs received yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </div>
        ) : null}
      </Drawer>

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit PO — ${editing.po_no}` : 'New Purchase Order'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update PO' : 'Create PO'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="vendor_id" label="Vendor" rules={[{ required: true, message: 'Select a vendor' }]}>
            <Select
              showSearch placeholder="Select vendor" optionFilterProp="label"
              options={vendors.map((v) => ({ value: v.id, label: `${v.name}${v.partner_code ? ` (${v.partner_code})` : ''}` }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="order_date" label="Order Date" rules={[{ required: true, message: 'Select order date' }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expected_date" label="Expected Delivery Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Terms, notes…" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600 }}>Line Items</Divider>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 60px 28px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Qty', 'Unit Price', 'Unit', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => (
            <div
              key={row._key}
              style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 60px 28px', gap: 6, marginBottom: 8, alignItems: 'center' }}
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
              <InputNumber size="small" min={0} precision={0} value={row.qty_ordered} onChange={(v) => updateLine(row._key, 'qty_ordered', v)} style={{ width: '100%' }} />
              <InputNumber size="small" min={0} precision={2} placeholder="₹" value={row.unit_price} onChange={(v) => updateLine(row._key, 'unit_price', v)} style={{ width: '100%' }} />
              <Tooltip title={row.item_id && items.find((i) => i.id === row.item_id)?.unit ? 'Unit from item master' : null}>
                <Input
                  size="small" placeholder="pcs" value={row.unit}
                  disabled={!!(row.item_id && items.find((i) => i.id === row.item_id)?.unit)}
                  onChange={(e) => updateLine(row._key, 'unit', e.target.value)}
                  style={{ background: (row.item_id && items.find((i) => i.id === row.item_id)?.unit) ? '#f3f4f6' : undefined }}
                />
              </Tooltip>
              <Button size="small" type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeLine(row._key)} disabled={lineItems.length === 1} />
            </div>
          ))}

          <Button type="dashed" onClick={addLine} icon={<PlusCircleOutlined />} style={{ width: '100%', marginTop: 4 }}>
            Add Item
          </Button>

          {lineTotal > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, textAlign: 'right' }}>
              <Text strong style={{ color: '#166534' }}>
                Order Total: ₹{lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </Text>
            </div>
          )}
        </Form>
      </Drawer>

      {/* ── Receive Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={`Record Receipt — ${receivingPO?.po_no}`}
        open={receiveModal}
        onCancel={() => setReceiveModal(false)}
        onOk={onReceive}
        okText="Record Receipt"
        okButtonProps={{ loading: receiveSaving }}
        width={600}
      >
        <Table
          rowKey="id" size="small" pagination={false} dataSource={receiveLines}
          columns={[
            { title: 'Item', dataIndex: 'item_name' },
            { title: 'Qty Ordered', dataIndex: 'qty_ordered', width: 110, align: 'right', render: (v) => v.toLocaleString() },
            {
              title: 'Qty Receiving', width: 130,
              render: (_, row) => (
                <InputNumber
                  size="small" min={0} max={row.qty_ordered} precision={0}
                  value={row.qty_received}
                  onChange={(v) => setReceiveLines((p) => p.map((r) => r.id === row.id ? { ...r, qty_received: v || 0 } : r))}
                  style={{ width: 90 }}
                />
              ),
            },
          ]}
        />
      </Modal>

      {/* ── Cancel Modal ──────────────────────────────────────────────────── */}
      <Modal
        title={<Space><StopOutlined style={{ color: '#dc2626' }} /><span>Cancel PO — {cancellingPO?.po_no}</span></Space>}
        open={cancelModal}
        onCancel={() => setCancelModal(false)}
        onOk={onCancel}
        okText="Cancel PO"
        okButtonProps={{ danger: true, loading: cancelSaving }}
        okType="danger"
      >
        <Alert type="warning" showIcon message="This action cannot be undone. Please provide a reason." style={{ marginBottom: 12 }} />
        <Input.TextArea
          rows={3}
          placeholder="Reason for cancellation (required)..."
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Modal>

      {/* ── Approve Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={<Space><CheckCircleOutlined style={{ color: '#16a34a' }} /><span>Approve PO — {approvingPO?.po_no}</span></Space>}
        open={approveModal}
        onCancel={() => setApproveModal(false)}
        onOk={onApprove}
        okText="Approve"
        okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' }, loading: approveSaving }}
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Vendor: <strong>{approvingPO?.Vendor?.name}</strong> &nbsp;|&nbsp; Value: <strong>{fmtCcy(poTotal(approvingPO?.Items || []))}</strong></Text>
        </div>
        <Input.TextArea
          rows={3}
          placeholder="Approval notes (optional)..."
          value={approveNotes}
          onChange={(e) => setApproveNotes(e.target.value)}
        />
      </Modal>

      {/* ── Reject Modal ──────────────────────────────────────────────────── */}
      <Modal
        title={<Space><CloseCircleOutlined style={{ color: '#dc2626' }} /><span>Reject PO — {rejectingPO?.po_no}</span></Space>}
        open={rejectModal}
        onCancel={() => setRejectModal(false)}
        onOk={onReject}
        okText="Reject"
        okButtonProps={{ danger: true, loading: rejectSaving }}
        okType="danger"
      >
        <Alert type="error" showIcon message="The PO will be returned to the creator for rework." style={{ marginBottom: 12 }} />
        <Input.TextArea
          rows={3}
          placeholder="Rejection reason (required)..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      {/* ── AI Risk Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title={<Space><BulbOutlined style={{ color: '#7c3aed' }} /><span>AI Risk Analysis — {aiPoRecord?.po_no}</span></Space>}
        open={aiPoDrawerOpen}
        onClose={closeAiPoDrawer}
        width={500}
      >
        {aiPoRecord && (
          <>
            <Space wrap style={{ marginBottom: 16 }}>
              <Tag color="blue">{aiPoRecord.po_no}</Tag>
              {aiPoRecord.Vendor && <Tag color="purple">{aiPoRecord.Vendor.name}</Tag>}
              <Tag color={STATUS_CONFIG[aiPoRecord.status]?.color || 'default'}>{STATUS_CONFIG[aiPoRecord.status]?.label || aiPoRecord.status}</Tag>
              {aiPoRecord.expected_date && <Tag>Due: {dayjs(aiPoRecord.expected_date).format('DD MMM YYYY')}</Tag>}
            </Space>
            <AiSuggestionCard
              loading={aiRisk.loading}
              error={aiRisk.error}
              aiAvailable={aiRisk.aiAvailable}
              cached={aiRisk.cached}
              onRetry={() => aiRisk.fetch(aiPoRecord.id)}
              onDismiss={closeAiPoDrawer}
            >
              {(() => {
                const d = aiRisk.data;
                if (!d) return null;
                const insight = parseInsight(d.ai_insight);
                if (!insight) return null;
                return (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {insight.overall_risk && (
                        <Tag color={insight.overall_risk === 'high' ? 'red' : insight.overall_risk === 'medium' ? 'orange' : 'green'} style={{ fontWeight: 600 }}>
                          Overall Risk: {insight.overall_risk?.toUpperCase()}
                        </Tag>
                      )}
                      {insight.delivery_risk && (
                        <Tag color={insight.delivery_risk === 'high' ? 'red' : insight.delivery_risk === 'medium' ? 'orange' : 'green'}>
                          Delivery: {insight.delivery_risk}
                        </Tag>
                      )}
                      {insight.confidence && <Tag color="geekblue">Confidence: {insight.confidence}</Tag>}
                    </div>
                    {(d.days_to_delivery != null || d.total_value != null || d.overdue_pos_for_vendor != null) && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                        {d.days_to_delivery != null && (
                          <div style={{ padding: '6px 10px', background: d.days_to_delivery < 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>Days to Delivery</div>
                            <div style={{ fontWeight: 700, color: d.days_to_delivery < 0 ? '#dc2626' : '#166534' }}>
                              {d.days_to_delivery < 0 ? `${Math.abs(d.days_to_delivery)} overdue` : d.days_to_delivery}
                            </div>
                          </div>
                        )}
                        {d.total_value != null && (
                          <div style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>PO Value</div>
                            <div style={{ fontWeight: 700, color: '#1d4ed8' }}>₹{parseFloat(d.total_value).toLocaleString('en-IN')}</div>
                          </div>
                        )}
                        {d.overdue_pos_for_vendor != null && (
                          <div style={{ padding: '6px 10px', background: d.overdue_pos_for_vendor > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: 6, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>Vendor Overdue POs</div>
                            <div style={{ fontWeight: 700, color: d.overdue_pos_for_vendor > 0 ? '#d97706' : '#166534' }}>{d.overdue_pos_for_vendor}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {insight.expedite_required && (
                      <Alert type="warning" showIcon icon={<WarningOutlined />} message="Expedite Required" description="This PO requires expedited follow-up with the vendor." style={{ marginBottom: 12, fontSize: 12 }} />
                    )}
                    {Array.isArray(insight.risk_factors) && insight.risk_factors.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ fontSize: 12 }}>Risk Factors</Text>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {insight.risk_factors.map((item, i) => <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(insight.recommended_actions) && insight.recommended_actions.length > 0 && (
                      <div>
                        <Text strong style={{ fontSize: 12 }}>Recommended Actions</Text>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {insight.recommended_actions.map((item, i) => <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>)}
                        </ul>
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
