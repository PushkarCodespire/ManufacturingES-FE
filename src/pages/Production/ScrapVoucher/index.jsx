import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, message, Tooltip,
  Popconfirm, Row, Col,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, RightOutlined,
  CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout       from '../../../components/AppLayout';
import usePermissions  from '../../../hooks/usePermissions';
import { scrapApi, workOrderApi } from '../../../api/production.api';
import { itemApi }     from '../../../api/item.api';
import { machineApi }  from '../../../api/machine.api';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  pending:    { color: 'orange',  label: 'Pending'    },
  authorized: { color: 'green',   label: 'Authorized' },
  rejected:   { color: 'red',     label: 'Rejected'   },
};

export default function ScrapVoucherPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-dpr-rejection_entry-create_edit_delete');

  const [vouchers,     setVouchers]     = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [items,        setItems]        = useState([]);
  const [machines,     setMachines]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [itemFilter,   setItemFilter]   = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [saving,     setSaving]     = useState(false);

  // Live total cost display in drawer
  const [liveQty,     setLiveQty]     = useState(null);
  const [liveCost,    setLiveCost]    = useState(null);

  const [form] = Form.useForm();

  // ── Load vouchers ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (search)       p.search  = search;
      if (itemFilter)   p.item_id = itemFilter;
      if (statusFilter) p.status  = statusFilter;
      const data = await scrapApi.getAll(p);
      setVouchers(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load scrap vouchers'); }
    finally { setLoading(false); }
  }, [search, itemFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      workOrderApi.getAll({ limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      machineApi.getAll({ limit: 500 }).catch(() => []),
    ]).then(([wo, i, m]) => {
      setWorkOrders(Array.isArray(wo) ? wo : (wo?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setMachines(Array.isArray(m) ? m : (m?.data ?? []));
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total         = vouchers.length;
  const countPending  = vouchers.filter((r) => r.status === 'pending').length;
  const countAuth     = vouchers.filter((r) => r.status === 'authorized').length;
  const totalCost     = vouchers
    .filter((r) => r.status === 'authorized')
    .reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0);

  const formatInr = (v) =>
    `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ scrap_date: dayjs() });
    setLiveQty(null);
    setLiveCost(null);
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    const qty  = parseFloat(record.qty_scrapped)   || null;
    const cost = parseFloat(record.cost_per_unit)  || null;
    form.setFieldsValue({
      scrap_date:    record.scrap_date ? dayjs(record.scrap_date) : null,
      item_id:       record.item_id,
      machine_id:    record.machine_id,
      work_order_id: record.work_order_id,
      qty_scrapped:  qty,
      cost_per_unit: cost,
      reason:        record.reason,
      notes:         record.notes,
    });
    setLiveQty(qty);
    setLiveCost(cost);
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        scrap_date:    vals.scrap_date?.format('YYYY-MM-DD'),
        item_id:       vals.item_id,
        machine_id:    vals.machine_id    || null,
        work_order_id: vals.work_order_id || null,
        qty_scrapped:  vals.qty_scrapped,
        cost_per_unit: vals.cost_per_unit || 0,
        reason:        vals.reason,
        notes:         vals.notes || '',
      };
      if (editing) {
        await scrapApi.update(editing.id, payload);
        message.success('Scrap voucher updated');
      } else {
        await scrapApi.create(payload);
        message.success('Scrap voucher created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onAuthorize = async (id) => {
    try {
      const res = await scrapApi.authorize(id);
      const body = res?.data ?? res;
      message.success('Scrap voucher authorized');
      if (body?.copq_id) {
        const voucher = vouchers.find((v) => v.id === id);
        const cost = voucher ? formatInr(parseFloat(voucher.total_cost) || 0) : '';
        message.info(`COPQ entry created${cost ? `: ${cost}` : ''} — linked to Cost of Poor Quality`);
      }
      load();
    } catch (err) { message.error(err?.message || 'Authorization failed'); }
  };

  const onReject = async (id) => {
    try {
      await scrapApi.reject(id);
      message.success('Scrap voucher rejected');
      load();
    } catch (err) { message.error(err?.message || 'Rejection failed'); }
  };

  const onDelete = async (id) => {
    try {
      await scrapApi.delete(id);
      message.success('Scrap voucher deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Voucher No', dataIndex: 'voucher_no', key: 'voucher_no', width: 150,
      render: (no, r) => (
        <Text
          style={{ color: '#1d4ed8', fontWeight: 600, cursor: canWrite && r.status === 'pending' ? 'pointer' : 'default' }}
          onClick={() => canWrite && r.status === 'pending' && openEdit(r)}
        >
          {no}
        </Text>
      ),
    },
    {
      title: 'Date', dataIndex: 'scrap_date', key: 'scrap_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Item', key: 'item', width: 200,
      render: (_, r) => r.Item ? (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Item.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Item.code}</Text>
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Machine', key: 'machine', width: 120,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Machine?.name || '—'}</Text>,
    },
    {
      title: 'Work Order', key: 'work_order', width: 130,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.WorkOrder?.wo_no || '—'}</Text>,
    },
    {
      title: 'Qty Scrapped', dataIndex: 'qty_scrapped', key: 'qty_scrapped', width: 110, align: 'right',
      render: (v) => v != null ? parseFloat(v).toLocaleString() : '—',
    },
    {
      title: 'Cost/Unit', dataIndex: 'cost_per_unit', key: 'cost_per_unit', width: 100, align: 'right',
      render: (v) => v != null ? `₹${parseFloat(v).toFixed(2)}` : '—',
    },
    {
      title: 'Total Cost', dataIndex: 'total_cost', key: 'total_cost', width: 110, align: 'right',
      render: (v) => v != null ? formatInr(parseFloat(v)) : '—',
    },
    {
      title: 'Reason', dataIndex: 'reason', key: 'reason', width: 180,
      render: (v) => v ? (
        <Tooltip title={v}>
          <Text style={{ fontSize: 12 }}>
            {v.length > 50 ? `${v.substring(0, 50)}…` : v}
          </Text>
        </Tooltip>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Authorized By', key: 'authorizer', width: 120,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Authorizer?.name || '—'}</Text>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 170,
      render: (_, r) => {
        const isPending = r.status === 'pending';
        return (
          <Space size={4}>
            {isPending && (
              <Popconfirm
                title="Authorize this scrap voucher?"
                onConfirm={() => onAuthorize(r.id)}
                okText="Authorize"
                okType="primary"
              >
                <Tooltip title="Authorize">
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<CheckOutlined />}
                    style={{ borderColor: '#16a34a', color: '#16a34a' }}
                  />
                </Tooltip>
              </Popconfirm>
            )}
            {isPending && (
              <Popconfirm
                title="Reject this scrap voucher?"
                onConfirm={() => onReject(r.id)}
                okText="Reject"
                okType="danger"
              >
                <Tooltip title="Reject">
                  <Button size="small" danger ghost icon={<CloseOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
            {isPending && (
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
            )}
            {isPending && (
              <Popconfirm
                title="Delete this scrap voucher?"
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
        );
      },
    }] : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Scrap Authorization</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Scrap Authorization</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Record and authorize scrapped parts with cost tracking.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Pending: {countPending}</Tag>
        <Tag color="green">Authorized: {countAuth}</Tag>
        <Tag color="red">Total Cost: {formatInr(totalCost)}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search voucher no..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by item"
            allowClear
            value={itemFilter}
            onChange={setItemFilter}
            showSearch
            optionFilterProp="label"
            options={items.map((i) => ({ value: i.id, label: i.name }))}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 150 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              New Scrap Entry
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={vouchers}
          size="small"
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create / Edit Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Edit Scrap Voucher — ${editing.voucher_no}` : 'New Scrap Entry'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                {editing ? 'Update' : 'Create Scrap Entry'}
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scrap_date"
                label="Scrap Date"
                rules={[{ required: true, message: 'Select date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="item_id"
                label="Item"
                rules={[{ required: true, message: 'Select item' }]}
              >
                <Select
                  showSearch
                  placeholder="Select item"
                  optionFilterProp="label"
                  options={items.map((i) => ({
                    value: i.id,
                    label: `${i.name}${i.code ? ` (${i.code})` : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="machine_id" label="Machine">
                <Select
                  showSearch
                  placeholder="Select machine"
                  optionFilterProp="label"
                  options={machines.map((m) => ({ value: m.id, label: m.name }))}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="work_order_id" label="Work Order (optional)">
                <Select
                  showSearch
                  placeholder="Select work order"
                  optionFilterProp="label"
                  options={workOrders.map((wo) => ({ value: wo.id, label: wo.wo_no }))}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="qty_scrapped"
                label="Qty Scrapped"
                rules={[{ required: true, message: 'Enter qty' }]}
              >
                <InputNumber
                  min={1}
                  precision={0}
                  style={{ width: '100%' }}
                  onChange={(v) => setLiveQty(v)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cost_per_unit" label="Cost Per Unit (₹)">
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="₹ 0.00"
                  onChange={(v) => setLiveCost(v)}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Live total cost display */}
          {(liveQty || liveCost) && (
            <div
              style={{
                background:   '#fef3c7',
                border:       '1px solid #fcd34d',
                borderRadius: 8,
                padding:      '8px 12px',
                marginBottom: 16,
                display:      'flex',
                alignItems:   'center',
                gap:          8,
              }}
            >
              <Text style={{ fontSize: 13, color: '#92400e' }}>
                Total Cost: <strong>
                  {formatInr((liveQty || 0) * (liveCost || 0))}
                </strong>
              </Text>
            </div>
          )}

          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, message: 'Enter reason for scrap' }]}
          >
            <Input.TextArea rows={3} placeholder="Reason for scrapping…" />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Additional notes…" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
