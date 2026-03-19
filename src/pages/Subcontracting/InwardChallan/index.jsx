import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, RightOutlined, EyeOutlined,
  PlusCircleOutlined, MinusCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout       from '../../../components/AppLayout';
import usePermissions  from '../../../hooks/usePermissions';
import { subcontractApi }  from '../../../api/subcontracting.api';
import { vendorApi }       from '../../../api/vendor.api';
import { itemApi }         from '../../../api/item.api';
import { workOrderApi }    from '../../../api/production.api';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  pending:   { color: 'orange',  label: 'Pending'   },
  received:  { color: 'green',   label: 'Received'  },
  cancelled: { color: 'default', label: 'Cancelled' },
};

const emptyLine = () => ({
  _key:    Date.now() + Math.random(),
  item_id: null,
  qty:     null,
  unit:    'pcs',
});

export default function InwardChallanPage() {
  const { can } = usePermissions();
  const canWrite = can('plan-subcontracting-inward_challan-create_edit_delete');

  const [challans,     setChallans]     = useState([]);
  const [vendors,      setVendors]      = useState([]);
  const [items,        setItems]        = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [vendorFilter, setVendorFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [lineItems,  setLineItems]  = useState([emptyLine()]);

  // Detail drawer
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRecord,  setDetailRecord]  = useState(null);

  const [form] = Form.useForm();

  // ── Load challans ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = { type: 'inward' };
      if (search)       p.search    = search;
      if (vendorFilter) p.vendor_id = vendorFilter;
      if (statusFilter) p.status    = statusFilter;
      const data = await subcontractApi.getAll(p);
      setChallans(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load inward challans'); }
    finally { setLoading(false); }
  }, [search, vendorFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      vendorApi.getAll({ limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      workOrderApi.getAll({ limit: 500 }).catch(() => []),
    ]).then(([v, i, wo]) => {
      setVendors(Array.isArray(v) ? v : (v?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setWorkOrders(Array.isArray(wo) ? wo : (wo?.data ?? []));
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total         = challans.length;
  const countPending  = challans.filter((r) => r.status === 'pending').length;
  const countReceived = challans.filter((r) => r.status === 'received').length;
  const countCancelled= challans.filter((r) => r.status === 'cancelled').length;

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    form.resetFields();
    form.setFieldsValue({ challan_date: dayjs() });
    setLineItems([emptyLine()]);
    setDrawerOpen(true);
  };

  const openDetail = async (record) => {
    setDetailRecord(record);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await subcontractApi.getById(record.id);
      setDetailRecord(res?.data ?? res);
    } catch { /* keep list-level data */ }
    finally { setDetailLoading(false); }
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        type:          'inward',
        vendor_id:     vals.vendor_id,
        challan_date:  vals.challan_date?.format('YYYY-MM-DD'),
        work_order_id: vals.work_order_id || null,
        notes:         vals.notes || '',
        items:         lineItems.map(({ _key, ...it }) => it),
      };
      await subcontractApi.create(payload);
      message.success('Inward challan created');
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onCancel = async (id) => {
    try {
      await subcontractApi.cancel(id);
      message.success('Challan cancelled');
      load();
    } catch (err) { message.error(err?.message || 'Cancel failed'); }
  };

  const onDelete = async (id) => {
    try {
      await subcontractApi.delete(id);
      message.success('Challan deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Line item helpers ──────────────────────────────────────────────────────
  const addLine    = () => setLineItems((p) => [...p, emptyLine()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));
  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  const onWorkOrderSelect = (woId) => {
    if (!woId) return;
    const wo = workOrders.find((w) => w.id === woId);
    if (wo?.item_id) {
      setLineItems([{
        _key:    Date.now() + Math.random(),
        item_id: wo.item_id,
        qty:     parseFloat(wo.planned_qty) || 1,
        unit:    'pcs',
      }]);
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Challan No', dataIndex: 'challan_no', key: 'challan_no', width: 160,
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
      title: 'Vendor', key: 'vendor', width: 200,
      render: (_, r) => r.Vendor ? (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Vendor.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Vendor.partner_code}</Text>
        </div>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Date', dataIndex: 'challan_date', key: 'challan_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Work Order', key: 'work_order', width: 130,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.WorkOrder?.wo_no || '—'}</Text>,
    },
    {
      title: 'Items', key: 'items', width: 70, align: 'center',
      render: (_, r) => (
        <Badge
          count={(r.Items || []).length}
          style={{ backgroundColor: '#e0e7ff', color: '#1d4ed8' }}
        />
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 120,
      render: (_, r) => {
        const isPending = r.status === 'pending';
        return (
          <Space size={4}>
            {isPending && (
              <Popconfirm
                title="Cancel this inward challan?"
                onConfirm={() => onCancel(r.id)}
                okText="Cancel"
                okType="danger"
              >
                <Tooltip title="Cancel">
                  <Button size="small" icon={<StopOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
            {isPending && (
              <Popconfirm
                title="Delete this challan?"
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
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Subcontracting</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Inward Challan</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Inward Challan</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Record materials received back from sub-contractors.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Pending: {countPending}</Tag>
        <Tag color="green">Received: {countReceived}</Tag>
        <Tag color="default">Cancelled: {countCancelled}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search challan no..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by vendor"
            allowClear
            value={vendorFilter}
            onChange={setVendorFilter}
            showSearch
            optionFilterProp="label"
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
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
              New Inward Challan
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={challans}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create Drawer ──────────────────────────────────────────────────── */}
      <Drawer
        title="New Inward Challan"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                Create Inward Challan
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="vendor_id"
                label="Sub-Contractor / Vendor"
                rules={[{ required: true, message: 'Select a vendor' }]}
              >
                <Select
                  showSearch
                  placeholder="Select vendor"
                  optionFilterProp="label"
                  options={vendors.map((v) => ({
                    value: v.id,
                    label: `${v.name}${v.partner_code ? ` (${v.partner_code})` : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="challan_date"
                label="Received Date"
                rules={[{ required: true, message: 'Select date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="work_order_id" label="Work Order (optional)">
            <Select
              showSearch
              placeholder="Link to work order"
              optionFilterProp="label"
              options={workOrders.map((wo) => ({ value: wo.id, label: wo.wo_no }))}
              allowClear
              onChange={onWorkOrderSelect}
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Inspection notes, remarks…" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Items Received
          </Divider>

          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 70px 28px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Qty', 'Unit', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => (
            <div
              key={row._key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 70px 28px',
                gap: 6,
                marginBottom: 8,
                alignItems: 'center',
              }}
            >
              <Select
                showSearch
                size="small"
                placeholder="Select item"
                optionFilterProp="label"
                value={row.item_id}
                onChange={(v) => updateLine(row._key, 'item_id', v)}
                allowClear
                options={items.map((i) => ({
                  value: i.id,
                  label: `${i.name}${i.code ? ` (${i.code})` : ''}`,
                }))}
              />
              <InputNumber
                size="small"
                min={0}
                precision={0}
                value={row.qty}
                onChange={(v) => updateLine(row._key, 'qty', v)}
                style={{ width: '100%' }}
              />
              <Input
                size="small"
                placeholder="pcs"
                value={row.unit}
                onChange={(e) => updateLine(row._key, 'unit', e.target.value)}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => removeLine(row._key)}
                disabled={lineItems.length === 1}
              />
            </div>
          ))}

          <Button
            type="dashed"
            onClick={addLine}
            icon={<PlusCircleOutlined />}
            style={{ width: '100%', marginTop: 4 }}
          >
            Add Item
          </Button>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ──────────────────────────────────────────────────── */}
      <Drawer
        title={detailRecord?.challan_no || 'Challan Details'}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailRecord(null); }}
        width={600}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : detailRecord ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 20 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Challan No</Text>
                <div><Text strong>{detailRecord.challan_no}</Text></div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Status</Text>
                <div>
                  <Tag color={STATUS_CONFIG[detailRecord.status]?.color || 'default'}>
                    {STATUS_CONFIG[detailRecord.status]?.label || detailRecord.status}
                  </Tag>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Vendor</Text>
                <div><Text>{detailRecord.Vendor?.name || '—'}</Text></div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Received Date</Text>
                <div><Text>{detailRecord.challan_date ? dayjs(detailRecord.challan_date).format('DD MMM YYYY') : '—'}</Text></div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Work Order</Text>
                <div><Text>{detailRecord.WorkOrder?.wo_no || '—'}</Text></div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Created By</Text>
                <div><Text>{detailRecord.Creator?.name || '—'}</Text></div>
              </div>
              {detailRecord.notes && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Notes</Text>
                  <div><Text>{detailRecord.notes}</Text></div>
                </div>
              )}
            </div>

            <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '12px 0' }}>
              Items ({(detailRecord.Items || []).length})
            </Divider>

            <Table
              rowKey="id"
              dataSource={detailRecord.Items || []}
              size="small"
              pagination={false}
              columns={[
                {
                  title: 'Item', key: 'item', width: 220,
                  render: (_, it) => (
                    <div>
                      <Text style={{ fontWeight: 500, fontSize: 13 }}>{it.Item?.name || '—'}</Text>
                      {it.Item?.code && (
                        <div><Text type="secondary" style={{ fontSize: 11 }}>{it.Item.code}</Text></div>
                      )}
                    </div>
                  ),
                },
                { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 80, align: 'right',
                  render: (v) => <Text strong>{v ?? '—'}</Text>,
                },
                { title: 'Unit', key: 'unit', width: 70,
                  render: (_, it) => <Text>{it.unit || it.Item?.unit || 'pcs'}</Text>,
                },
                { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true,
                  render: (v) => v || '—',
                },
              ]}
            />
          </>
        ) : null}
      </Drawer>
    </AppLayout>
  );
}
