import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Row, Col, Progress, Alert, Descriptions, Badge, Statistic,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  LockOutlined, EyeOutlined, ExclamationCircleOutlined,
  DollarOutlined, CheckCircleOutlined, WarningOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout       from '../../../components/AppLayout';
import usePermissions  from '../../../hooks/usePermissions';
import { budgetApi }   from '../../../api/procurement.api';
import { userApi }     from '../../../api/user.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

// ── Configs ───────────────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  raw_material: { color: 'blue',    label: 'Raw Material' },
  packaging:    { color: 'cyan',    label: 'Packaging'    },
  services:     { color: 'purple',  label: 'Services'     },
  capex:        { color: 'orange',  label: 'CAPEX'        },
  utilities:    { color: 'geekblue',label: 'Utilities'    },
  other:        { color: 'default', label: 'Other'        },
};

const PERIOD_LABELS = {
  annual:    'Annual',
  quarterly: 'Quarterly',
  monthly:   'Monthly',
};

const STATUS_CONFIG = {
  active: { color: 'green',   label: 'Active' },
  closed: { color: 'default', label: 'Closed' },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));
const PERIOD_OPTIONS   = Object.entries(PERIOD_LABELS).map(([v, l]) => ({ value: v, label: l }));

const fmtCcy = (v) =>
  v != null
    ? `₹${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    : '₹0';

const utilizationColor = (pct) => {
  if (pct >= 100) return '#dc2626';
  if (pct >= 80)  return '#f59e0b';
  return '#16a34a';
};

const utilizationStatus = (pct) => {
  if (pct >= 100) return 'exception';
  if (pct >= 80)  return 'active';
  return 'normal';
};

// ─────────────────────────────────────────────────────────────────────────────
export default function BudgetManagementPage() {
  const { can } = usePermissions();
  const canWrite = can('plan-budget-management-budget_management-create_edit_delete');

  // ── Data ────────────────────────────────────────────────────────────────────
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [statusFil, setStatusFil] = useState('');
  const [catFil,    setCatFil]    = useState('');

  const [departments,   setDepartments]   = useState([]);

  // ── Drawer / Modal state ────────────────────────────────────────────────────
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [editRecord,    setEditRecord]    = useState(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailRec,     setDetailRec]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [form]                            = Form.useForm();

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFil) params.status   = statusFil;
      if (catFil)    params.category = catFil;
      const res = await budgetApi.getAll(params);
      setRecords(res.data || []);
    } catch { message.error('Failed to load budgets'); }
    finally  { setLoading(false); }
  }, [statusFil, catFil]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    userApi.getDepartments()
      .then(r => setDepartments(Array.isArray(r) ? r : (r?.data || [])))
      .catch(() => {});
  }, []);

  const loadDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await budgetApi.getById(id);
      setDetailRec(res.data);
    } catch { message.error('Failed to load budget detail'); }
    finally  { setDetailLoading(false); }
  };

  // ── Filtered records ──────────────────────────────────────────────────────────
  const filtered = records.filter(r =>
    !search ||
    r.budget_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.Department?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const totalAllocated = records.reduce((s, r) => s + parseFloat(r.allocated_amount || 0), 0);
  const totalSpent     = records.reduce((s, r) => s + parseFloat(r.actual_spend || 0), 0);
  const overrunCount   = records.filter(r => parseFloat(r.actual_spend || 0) > parseFloat(r.allocated_amount)).length;
  const nearLimit      = records.filter(r => {
    const pct = (parseFloat(r.actual_spend || 0) / parseFloat(r.allocated_amount)) * 100;
    return pct >= 80 && pct < 100;
  }).length;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditRecord(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (rec) => {
    setEditRecord(rec);
    form.setFieldsValue({
      department_id:    rec.department_id || undefined,
      category:         rec.category,
      period_type:      rec.period_type,
      start_date:       dayjs(rec.start_date),
      end_date:         dayjs(rec.end_date),
      allocated_amount: parseFloat(rec.allocated_amount),
      notes:            rec.notes,
    });
    setDrawerOpen(true);
  };

  const openDetail = async (rec) => {
    setDetailRec(rec);
    setDetailOpen(true);
    await loadDetail(rec.id);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    let values;
    try { values = await form.validateFields(); }
    catch { return; }

    const payload = {
      ...values,
      start_date: values.start_date.format('YYYY-MM-DD'),
      end_date:   values.end_date.format('YYYY-MM-DD'),
    };

    setSaving(true);
    try {
      if (editRecord) {
        await budgetApi.update(editRecord.id, payload);
        message.success('Budget updated');
      } else {
        await budgetApi.create(payload);
        message.success('Budget created');
      }
      setDrawerOpen(false);
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  // ── Close budget ──────────────────────────────────────────────────────────────
  const handleClose = async (rec) => {
    try {
      await budgetApi.close(rec.id);
      message.success('Budget closed');
      load();
      if (detailOpen && detailRec?.id === rec.id) loadDetail(rec.id);
    } catch (e) { message.error(e?.response?.data?.message || 'Failed to close'); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await budgetApi.delete(id);
      message.success('Budget deleted');
      load();
    } catch (e) { message.error(e?.response?.data?.message || 'Delete failed'); }
  };

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Budget No', dataIndex: 'budget_no', key: 'budget_no', width: 160,
      render: (v, r) => <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(r)}>{v}</Button>,
    },
    {
      title: 'Category', dataIndex: 'category', key: 'category', width: 130,
      render: (v) => {
        const cfg = CATEGORY_CONFIG[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Department', key: 'dept', ellipsis: true,
      render: (_, r) => r.Department?.name || <Text type="secondary">All Departments</Text>,
    },
    {
      title: 'Period', key: 'period', width: 100,
      render: (_, r) => PERIOD_LABELS[r.period_type] || r.period_type,
    },
    {
      title: 'Date Range', key: 'dates', width: 200,
      render: (_, r) =>
        `${dayjs(r.start_date).format('DD MMM YY')} — ${dayjs(r.end_date).format('DD MMM YY')}`,
    },
    {
      title: 'Allocated', dataIndex: 'allocated_amount', key: 'allocated', width: 120,
      render: (v) => <Text strong>{fmtCcy(v)}</Text>,
    },
    {
      title: 'Spent / Utilization', key: 'utilization', width: 200,
      render: (_, r) => {
        const spent = parseFloat(r.actual_spend || 0);
        const total = parseFloat(r.allocated_amount || 1);
        const pct   = Math.min((spent / total) * 100, 100);
        return (
          <div style={{ minWidth: 140 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: 12 }}>{fmtCcy(spent)}</Text>
              <Text style={{ fontSize: 12, color: utilizationColor((spent / total) * 100) }}>
                {((spent / total) * 100).toFixed(1)}%
              </Text>
            </div>
            <Progress
              percent={pct}
              size="small"
              strokeColor={utilizationColor((spent / total) * 100)}
              status={utilizationStatus((spent / total) * 100)}
              showInfo={false}
            />
          </div>
        );
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: (v) => {
        const cfg = STATUS_CONFIG[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Actions', key: 'actions', width: 150, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View Detail">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
          </Tooltip>
          {canWrite && r.status === 'active' && (
            <>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
              <Tooltip title="Close Budget">
                <Popconfirm title="Close this budget period?" onConfirm={() => handleClose(r)} okText="Close">
                  <Button size="small" icon={<LockOutlined />} />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="Delete">
                <Popconfirm title="Delete this budget?" onConfirm={() => handleDelete(r.id)} okText="Delete" okType="danger">
                  <Button size="small" icon={<DeleteOutlined />} danger />
                </Popconfirm>
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ padding: '24px 24px 0' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Budget Management</Text>
        </div>

        <Title level={3} style={{ margin: 0 }}>Budget Management</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Track allocated budgets by department and category, monitor actual spend, and control overruns.
        </Text>

        {/* KPI Row */}
        <Row gutter={[12, 12]} style={{ marginTop: 14, marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card styles={{ body: { padding: '14px 16px' } }}
              style={{ border: '1px solid #e8eaed', borderRadius: 10, background: '#eff6ff' }}>
              <Statistic title="Total Allocated" value={fmtCcy(totalAllocated)} valueStyle={{ fontSize: 18, color: '#1d4ed8' }} prefix={<DollarOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card styles={{ body: { padding: '14px 16px' } }}
              style={{ border: '1px solid #e8eaed', borderRadius: 10, background: '#f0fdf4' }}>
              <Statistic title="Total Spent" value={fmtCcy(totalSpent)} valueStyle={{ fontSize: 18, color: '#16a34a' }} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card styles={{ body: { padding: '14px 16px' } }}
              style={{ border: '1px solid #e8eaed', borderRadius: 10, background: '#fffbeb' }}>
              <Statistic title="Near Limit (≥80%)" value={nearLimit} valueStyle={{ fontSize: 18, color: '#d97706' }} suffix="budgets" prefix={<WarningOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card styles={{ body: { padding: '14px 16px' } }}
              style={{ border: '1px solid #e8eaed', borderRadius: 10, background: '#fef2f2' }}>
              <Statistic title="Overrun" value={overrunCount} valueStyle={{ fontSize: 18, color: '#dc2626' }} suffix="budgets" prefix={<ExclamationCircleOutlined />} />
            </Card>
          </Col>
        </Row>

        {/* Main table card */}
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          styles={{ body: { padding: '16px 20px' } }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search budget no / department..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 260, borderRadius: 8 }}
              allowClear
            />
            <Select
              placeholder="Category"
              value={catFil || undefined}
              onChange={v => setCatFil(v || '')}
              allowClear
              style={{ width: 150 }}
              options={CATEGORY_OPTIONS}
            />
            <Select
              placeholder="Status"
              value={statusFil || undefined}
              onChange={v => setStatusFil(v || '')}
              allowClear
              style={{ width: 110 }}
              options={[{ value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }]}
            />
            <div style={{ flex: 1 }} />
            <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('budget-management.csv', filtered, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                New Budget
              </Button>
            )}
          </div>

          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 1100 }}
            rowClassName={(r) => {
              const pct = (parseFloat(r.actual_spend || 0) / parseFloat(r.allocated_amount || 1)) * 100;
              if (pct >= 100) return 'ant-table-row-danger';
              return '';
            }}
            pagination={{ pageSize: 15, showSizeChanger: false, showTotal: t => `${t} budgets` }}
          />
        </Card>
      </div>

      {/* ── Create / Edit Drawer ─────────────────────────────────────────────── */}
      <Drawer
        title={editRecord ? `Edit Budget — ${editRecord.budget_no}` : 'New Budget'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        footer={
          <div style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {editRecord ? 'Update' : 'Create Budget'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select placeholder="Select category" options={CATEGORY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="period_type" label="Period Type" rules={[{ required: true }]}>
                <Select placeholder="Select period" options={PERIOD_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="department_id" label="Department (leave blank for all)">
            <Select
              placeholder="All departments"
              allowClear
              showSearch
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              options={departments.map(d => ({ value: d.id, label: `${d.name}${d.code ? ` (${d.code})` : ''}` }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_date" label="Start Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="End Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="allocated_amount" label="Allocated Amount (₹)" rules={[{ required: true, message: 'Enter an amount' }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              precision={2}
              placeholder="0.00"
              formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/₹\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ────────────────────────────────────────────────────── */}
      <Drawer
        title={
          detailRec
            ? <Space>
                <Text strong>{detailRec.budget_no}</Text>
                <Tag color={STATUS_CONFIG[detailRec.status]?.color}>{STATUS_CONFIG[detailRec.status]?.label}</Tag>
                {detailRec.category && (
                  <Tag color={CATEGORY_CONFIG[detailRec.category]?.color}>
                    {CATEGORY_CONFIG[detailRec.category]?.label}
                  </Tag>
                )}
              </Space>
            : 'Budget Detail'
        }
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={680}
        loading={detailLoading}
        extra={
          detailRec && canWrite && detailRec.status === 'active' && (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detailRec); }}>Edit</Button>
              <Popconfirm title="Close this budget period?" onConfirm={() => handleClose(detailRec)} okText="Close">
                <Button icon={<LockOutlined />}>Close Budget</Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {detailRec && (() => {
          const spent      = parseFloat(detailRec.actual_spend || 0);
          const allocated  = parseFloat(detailRec.allocated_amount || 1);
          const remaining  = allocated - spent;
          const pct        = (spent / allocated) * 100;
          const isOverrun  = spent > allocated;
          const isNearLimit = pct >= 80 && !isOverrun;

          return (
            <>
              {isOverrun && (
                <Alert type="error" showIcon icon={<ExclamationCircleOutlined />}
                  message={`Budget overrun by ${fmtCcy(spent - allocated)}`}
                  style={{ marginBottom: 16 }}
                />
              )}
              {isNearLimit && (
                <Alert type="warning" showIcon icon={<WarningOutlined />}
                  message={`Budget is ${pct.toFixed(1)}% utilized — nearing limit`}
                  style={{ marginBottom: 16 }}
                />
              )}

              {/* Progress bar */}
              <Card styles={{ body: { padding: '16px 20px' } }}
                style={{ border: '1px solid #e8eaed', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text>Spend Utilization</Text>
                  <Text strong style={{ color: utilizationColor(pct) }}>{pct.toFixed(1)}%</Text>
                </div>
                <Progress
                  percent={Math.min(pct, 100)}
                  strokeColor={utilizationColor(pct)}
                  status={utilizationStatus(pct)}
                  size={['100%', 12]}
                />
                <Row gutter={16} style={{ marginTop: 12 }}>
                  <Col span={8} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Allocated</div>
                    <div style={{ fontWeight: 700, color: '#1d4ed8' }}>{fmtCcy(allocated)}</div>
                  </Col>
                  <Col span={8} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Spent</div>
                    <div style={{ fontWeight: 700, color: utilizationColor(pct) }}>{fmtCcy(spent)}</div>
                  </Col>
                  <Col span={8} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Remaining</div>
                    <div style={{ fontWeight: 700, color: remaining >= 0 ? '#16a34a' : '#dc2626' }}>
                      {remaining >= 0 ? fmtCcy(remaining) : `-${fmtCcy(Math.abs(remaining))}`}
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* Budget info */}
              <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Category">
                  <Tag color={CATEGORY_CONFIG[detailRec.category]?.color}>
                    {CATEGORY_CONFIG[detailRec.category]?.label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Period">{PERIOD_LABELS[detailRec.period_type]}</Descriptions.Item>
                <Descriptions.Item label="Start Date">{dayjs(detailRec.start_date).format('DD MMM YYYY')}</Descriptions.Item>
                <Descriptions.Item label="End Date">{dayjs(detailRec.end_date).format('DD MMM YYYY')}</Descriptions.Item>
                <Descriptions.Item label="Department" span={2}>
                  {detailRec.Department?.name || <Text type="secondary">All Departments</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="Created By">{detailRec.Creator?.name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={STATUS_CONFIG[detailRec.status]?.color}>{STATUS_CONFIG[detailRec.status]?.label}</Tag>
                </Descriptions.Item>
                {detailRec.notes && (
                  <Descriptions.Item label="Notes" span={2}>{detailRec.notes}</Descriptions.Item>
                )}
              </Descriptions>

              {/* Linked POs */}
              <Divider orientation="left" style={{ margin: '8px 0 12px' }}>
                Linked Purchase Orders ({(detailRec.linkedPOs || []).length})
              </Divider>
              <Table
                size="small"
                dataSource={detailRec.linkedPOs || []}
                rowKey="id"
                pagination={{ pageSize: 8, showSizeChanger: false }}
                columns={[
                  { title: 'PO No',   dataIndex: 'po_no',      key: 'po',     width: 140 },
                  { title: 'Vendor',  dataIndex: 'vendor_name', key: 'vendor', ellipsis: true },
                  {
                    title: 'Date', dataIndex: 'createdAt', key: 'date', width: 110,
                    render: v => dayjs(v).format('DD MMM YY'),
                  },
                  {
                    title: 'Status', dataIndex: 'status', key: 'status', width: 90,
                    render: v => <Tag color={v === 'received' ? 'green' : v === 'cancelled' ? 'red' : 'blue'}>{v}</Tag>,
                  },
                  {
                    title: 'Value', dataIndex: 'po_value', key: 'value', width: 110,
                    render: v => <Text strong>{fmtCcy(v)}</Text>,
                  },
                ]}
              />
            </>
          );
        })()}
      </Drawer>
    </AppLayout>
  );
}
