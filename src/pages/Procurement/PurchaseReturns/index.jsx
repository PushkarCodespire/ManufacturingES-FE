import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Typography, Space, Modal, Form,
  Input, Select, DatePicker, InputNumber, Drawer, Descriptions,
  message, Tooltip, Divider, Row, Col, Statistic, Popconfirm,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, RightOutlined,
  SendOutlined, CheckOutlined, LockOutlined, DeleteOutlined,
  EyeOutlined, EditOutlined, MinusCircleOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';
import usePermissions from '../../../hooks/usePermissions';
import { purchaseReturnApi } from '../../../api/procurement.api';
import { purchaseOrderApi } from '../../../api/procurement.api';
import { vendorApi } from '../../../api/procurement.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const STATUS_COLOR = {
  draft:        'default',
  sent:         'blue',
  acknowledged: 'orange',
  closed:       'green',
};

const REASON_LABELS = {
  defective:         'Defective',
  excess_qty:        'Excess Quantity',
  wrong_item:        'Wrong Item',
  quality_rejection: 'Quality Rejection',
  other:             'Other',
};

export default function PurchaseReturnsPage() {
  const { can } = usePermissions();
  const canWrite = can('plan-purchase-returns-purchase_returns-create_edit_delete');

  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');

  /* ── Drawers ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRec,  setDetailRec]  = useState(null);
  const [editRec,    setEditRec]    = useState(null);

  /* ── Vendors + POs for selects ── */
  const [vendors,  setVendors]  = useState([]);
  const [pos,      setPos]      = useState([]);
  const [grnItems, setGrnItems] = useState([]);  // items from selected PO's GRN
  const [poItems,  setPoItems]  = useState([]);  // items from selected PO (always available)

  const [form] = Form.useForm();

  /* ─────────────────────── data fetch ─────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search    = search;
      if (statusFilter) params.status    = statusFilter;
      const data = await purchaseReturnApi.getAll(params);
      setRows(data?.data || []);
    } catch { message.error('Failed to load purchase returns'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    vendorApi.getAll({ limit: 500 }).then(d => setVendors(d?.data || [])).catch(() => {});
    // Load POs that have been sent to vendor (sent/partial/received) — these can have returns
    purchaseOrderApi.getAll({ limit: 500 }).then(d => {
      const all = d?.data || [];
      setPos(all.filter(p => ['sent', 'partial', 'received'].includes(p.status)));
    }).catch(() => {});
  }, []);

  /* ─────────────────────── helpers ─────────────────────── */
  const openDetail = async (id) => {
    try {
      const rec = await purchaseReturnApi.getById(id);
      setDetailRec(rec?.data);
      setDetailOpen(true);
    } catch { message.error('Failed to load details'); }
  };

  const openEdit = (rec) => {
    setEditRec(rec);
    form.setFieldsValue({
      po_id:       rec.po_id,
      vendor_id:   rec.vendor_id,
      grn_id:      rec.grn_id,
      return_date: rec.return_date ? dayjs(rec.return_date) : null,
      reason:      rec.reason,
      notes:       rec.notes,
      items:       rec.Items?.map(i => ({
        item_id:      i.item_id,
        qty_returned: parseFloat(i.qty_returned),
        unit_price:   parseFloat(i.unit_price),
        reason:       i.reason,
      })) || [],
    });
    setCreateOpen(true);
  };

  const handlePoChange = async (poId) => {
    form.setFieldValue('grn_id', undefined);
    setGrnItems([]);
    setPoItems([]);
    if (!poId) return;
    // Set vendor from PO
    const po = pos.find(p => p.id === poId);
    if (po) form.setFieldValue('vendor_id', po.vendor_id);
    try {
      const res = await purchaseReturnApi.getPoGrnItems(poId);
      const grn    = res?.data?.grn;
      const rawPos = res?.data?.poItems || [];
      setPoItems(rawPos);  // always store PO items for the dropdown

      if (grn) {
        form.setFieldValue('grn_id', grn.id);
        // Pre-fill items from GRN with received quantities
        const poItemMap = {};
        rawPos.forEach(pi => { poItemMap[pi.item_id] = pi.unit_price; });
        const prefilledItems = grn.Items?.map(gi => ({
          item_id:      gi.item_id,
          qty_returned: parseFloat(gi.qty_received) || 0,
          unit_price:   parseFloat(poItemMap[gi.item_id] || gi.unit_price || 0),
          reason:       '',
        })) || [];
        form.setFieldValue('items', prefilledItems);
        setGrnItems(grn.Items || []);
      } else if (rawPos.length) {
        // No GRN yet — pre-fill from PO items so user can still create a return
        const prefilledItems = rawPos.map(pi => ({
          item_id:      pi.item_id,
          qty_returned: 0,
          unit_price:   parseFloat(pi.unit_price) || 0,
          reason:       '',
        }));
        form.setFieldValue('items', prefilledItems);
      }
    } catch { /* network error — let user fill manually */ }
  };

  const handleSubmit = async (vals) => {
    try {
      const payload = {
        ...vals,
        return_date: vals.return_date?.format('YYYY-MM-DD'),
        items: vals.items?.map(i => ({
          ...i,
          amount: parseFloat(i.qty_returned) * parseFloat(i.unit_price),
        })),
      };
      if (editRec) {
        await purchaseReturnApi.update(editRec.id, payload);
        message.success('Purchase return updated');
      } else {
        await purchaseReturnApi.create(payload);
        message.success('Purchase return created');
      }
      setCreateOpen(false);
      setEditRec(null);
      form.resetFields();
      setGrnItems([]);
      setPoItems([]);
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save');
    }
  };

  const handleAction = async (action, id, label) => {
    try {
      await purchaseReturnApi[action](id);
      message.success(`Return ${label}`);
      load();
      if (detailRec?.id === id) {
        const rec = await purchaseReturnApi.getById(id);
        setDetailRec(rec?.data);
      }
    } catch (e) {
      message.error(e?.response?.data?.message || `Failed to ${label}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await purchaseReturnApi.delete(id);
      message.success('Deleted');
      load();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to delete');
    }
  };

  /* ─────────────────────── stats ─────────────────────── */
  const stats = {
    total:        rows.length,
    draft:        rows.filter(r => r.status === 'draft').length,
    sent:         rows.filter(r => r.status === 'sent').length,
    acknowledged: rows.filter(r => r.status === 'acknowledged').length,
    closed:       rows.filter(r => r.status === 'closed').length,
  };

  /* ─────────────────────── columns ─────────────────────── */
  const columns = [
    { title: 'Return No', dataIndex: 'return_no', width: 130,
      render: v => <Text strong style={{ fontFamily: 'monospace' }}>{v}</Text> },
    { title: 'Vendor', dataIndex: ['Vendor', 'name'], ellipsis: true },
    { title: 'PO No',  dataIndex: ['PurchaseOrder', 'po_no'],
      render: v => v ? <Tag>{v}</Tag> : '-' },
    { title: 'Return Date', dataIndex: 'return_date',
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' },
    { title: 'Reason', dataIndex: 'reason',
      render: v => REASON_LABELS[v] || v },
    { title: 'Items', key: 'items_count',
      render: (_, r) => r.Items?.length ?? '-' },
    { title: 'Total Amt', key: 'total',
      render: (_, r) => {
        const total = r.Items?.reduce((s, i) => s + parseFloat(i.amount || 0), 0) || 0;
        return `₹ ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      },
    },
    { title: 'Status', dataIndex: 'status',
      render: v => <Tag color={STATUS_COLOR[v]}>{v?.toUpperCase()}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 200,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="View"><Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)} /></Tooltip>
          {canWrite && r.status === 'draft' && (
            <>
              <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
              <Tooltip title="Send to Vendor">
                <Button size="small" icon={<SendOutlined />} type="primary" onClick={() => handleAction('send', r.id, 'sent')} />
              </Tooltip>
              <Tooltip title="Delete">
                <Popconfirm title="Delete this return?" onConfirm={() => handleDelete(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          {canWrite && r.status === 'sent' && (
            <Tooltip title="Mark Acknowledged">
              <Button size="small" icon={<CheckOutlined />} onClick={() => handleAction('acknowledge', r.id, 'acknowledged')} />
            </Tooltip>
          )}
          {canWrite && ['sent', 'acknowledged'].includes(r.status) && (
            <Tooltip title="Close Return">
              <Button size="small" icon={<LockOutlined />} onClick={() => handleAction('close', r.id, 'closed')} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  /* ─────────────────────── render ─────────────────────── */
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Purchase Returns</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Purchase Returns</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Manage returns sent back to vendors with debit note tracking.</Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Tag color="blue">Total: {stats.total}</Tag>
        <Tag color="default">Draft: {stats.draft}</Tag>
        <Tag color="blue">Sent: {stats.sent}</Tag>
        <Tag color="orange">Acknowledged: {stats.acknowledged}</Tag>
        <Tag color="green">Closed: {stats.closed}</Tag>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        styles={{ body: { padding: '16px 20px' } }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input placeholder="Search return no..." prefix={<SearchOutlined />} value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 220, borderRadius: 8 }} allowClear />
          <Select placeholder="Status" value={statusFilter || undefined} onChange={v => setStatus(v || '')}
            allowClear style={{ width: 150 }}>
            {Object.entries(STATUS_COLOR).map(([k]) => (
              <Option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</Option>
            ))}
          </Select>
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('purchase-returns.csv', rows, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditRec(null); form.resetFields(); setGrnItems([]); setPoItems([]); setCreateOpen(true); }}>
              Create Return
            </Button>
          )}
        </div>
        <ResponsiveTable
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 800 }}
          pagination={{ pageSize: 12, showSizeChanger: false }}
        />
      </Card>

      {/* ── Create / Edit Drawer ── */}
      <Drawer
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditRec(null); form.resetFields(); setGrnItems([]); setPoItems([]); }}
        title={editRec ? `Edit Return — ${editRec.return_no}` : 'Create Purchase Return'}
        width={680}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setCreateOpen(false); setEditRec(null); form.resetFields(); }}>Cancel</Button>
            <Button type="primary" onClick={() => form.submit()}>
              {editRec ? 'Save Changes' : 'Create Return'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="po_id" label="Purchase Order" rules={[{ required: true, message: 'Select PO' }]}>
                <Select
                  showSearch
                  placeholder="Select PO"
                  optionFilterProp="children"
                  onChange={handlePoChange}
                  disabled={!!editRec}
                >
                  {pos.map(p => (
                    <Option key={p.id} value={p.id}>{p.po_no}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="vendor_id" label="Vendor" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="children" placeholder="Vendor (auto-filled from PO)">
                  {vendors.map(v => <Option key={v.id} value={v.id}>{v.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="return_date" label="Return Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="reason" label="Return Reason" rules={[{ required: true }]}>
                <Select placeholder="Select reason">
                  {Object.entries(REASON_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="grn_id" label="GRN Reference" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Internal notes..." />
          </Form.Item>

          <Divider>Return Items</Divider>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <Row gutter={8} align="middle">
                      <Col xs={24} sm={6}>
                        <Form.Item {...rest} name={[name, 'item_id']} label="Item" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                          <Select showSearch optionFilterProp="children" placeholder={poItems.length ? 'Select item' : 'Select PO first'} size="small" disabled={!poItems.length && !grnItems.length}>
                            {/* Prefer GRN items (with received qty info), fall back to PO items */}
                            {(grnItems.length ? grnItems : poItems).map(it => {
                              const id   = it.item_id;
                              const name = it.Item?.name || `Item #${id}`;
                              return <Option key={id} value={id}>{name}</Option>;
                            })}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={4}>
                        <Form.Item {...rest} name={[name, 'qty_returned']} label="Qty" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                          <InputNumber min={0} style={{ width: '100%' }} size="small" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={5}>
                        <Form.Item {...rest} name={[name, 'unit_price']} label="Unit Price" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                          <InputNumber min={0} prefix="₹" style={{ width: '100%' }} size="small" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={7}>
                        <Form.Item {...rest} name={[name, 'reason']} label="Item Reason" style={{ marginBottom: 0 }}>
                          <Input placeholder="e.g. cracked" size="small" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={2} style={{ textAlign: 'right', paddingTop: 22 }}>
                        <Button danger size="small" icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                  Add Item
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ── */}
      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`Return — ${detailRec?.return_no || ''}`}
        width={680}
        extra={
          canWrite && detailRec?.status === 'draft' && (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detailRec); }}>Edit</Button>
              <Button type="primary" icon={<SendOutlined />} onClick={() => handleAction('send', detailRec.id, 'sent')}>Send</Button>
            </Space>
          )
        }
      >
        {detailRec && (
          <>
            {/* Status banner */}
            <div style={{ marginBottom: 16 }}>
              <Tag color={STATUS_COLOR[detailRec.status]} style={{ fontSize: 13, padding: '2px 12px' }}>
                {detailRec.status?.toUpperCase()}
              </Tag>
              {canWrite && detailRec.status === 'sent' && (
                <Button size="small" icon={<CheckOutlined />} style={{ marginLeft: 8 }}
                  onClick={() => handleAction('acknowledge', detailRec.id, 'acknowledged')}>
                  Acknowledge
                </Button>
              )}
              {canWrite && ['sent', 'acknowledged'].includes(detailRec.status) && (
                <Button size="small" icon={<LockOutlined />} style={{ marginLeft: 8 }}
                  onClick={() => handleAction('close', detailRec.id, 'closed')}>
                  Close Return
                </Button>
              )}
            </div>

            {/* Summary cards */}
            <Row gutter={12} style={{ marginBottom: 20 }}>
              {[
                { label: 'Items',      value: detailRec.Items?.length || 0 },
                { label: 'Total Qty',  value: detailRec.Items?.reduce((s, i) => s + parseFloat(i.qty_returned || 0), 0).toFixed(2) },
                { label: 'Total Amt',  value: `₹ ${detailRec.Items?.reduce((s, i) => s + parseFloat(i.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
              ].map(c => (
                <Col span={8} key={c.label}>
                  <Card size="small" style={{ textAlign: 'center', background: '#f8fafc' }}
                    styles={{ body: { padding: '10px 8px' } }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{c.label}</Text>
                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{c.value}</div>
                  </Card>
                </Col>
              ))}
            </Row>

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Return No">{detailRec.return_no}</Descriptions.Item>
              <Descriptions.Item label="Vendor">{detailRec.Vendor?.name}</Descriptions.Item>
              <Descriptions.Item label="PO No">{detailRec.PurchaseOrder?.po_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="GRN No">{detailRec.GRN?.grn_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="Return Date">{detailRec.return_date ? dayjs(detailRec.return_date).format('DD MMM YYYY') : '-'}</Descriptions.Item>
              <Descriptions.Item label="Reason">{REASON_LABELS[detailRec.reason] || detailRec.reason}</Descriptions.Item>
              <Descriptions.Item label="Notes" span={2}>{detailRec.notes || '-'}</Descriptions.Item>
              <Descriptions.Item label="Created By">{detailRec.Creator?.name || '-'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 8 }}>Return Line Items</Title>
            <Table
              dataSource={detailRec.Items || []}
              rowKey="id"
              size="small"
              scroll={{ x: 800 }}
              pagination={false}
              columns={[
                { title: 'Item', dataIndex: ['Item', 'name'], ellipsis: true },
                { title: 'Code', dataIndex: ['Item', 'code'] },
                { title: 'Unit', dataIndex: ['Item', 'unit'] },
                { title: 'Qty Returned', dataIndex: 'qty_returned',
                  render: v => parseFloat(v).toFixed(3) },
                { title: 'Unit Price', dataIndex: 'unit_price',
                  render: v => `₹ ${parseFloat(v).toFixed(2)}` },
                { title: 'Amount', dataIndex: 'amount',
                  render: v => <Text strong>₹ {parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text> },
                { title: 'Reason', dataIndex: 'reason', ellipsis: true, render: v => v || '-' },
              ]}
            />
          </>
        )}
      </Drawer>
    </AppLayout>
  );
}
