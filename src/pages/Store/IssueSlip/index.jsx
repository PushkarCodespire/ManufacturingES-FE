import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, Divider, message, Tooltip,
  Popconfirm, Badge, Row, Col, Modal,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, RightOutlined,
  PlusCircleOutlined, MinusCircleOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout             from '../../../components/AppLayout';
import ResponsiveTable       from '../../../components/ResponsiveTable';
import usePermissions        from '../../../hooks/usePermissions';
import { issueSlipApi, materialRequestApi } from '../../../api/store.api';
import { itemApi }           from '../../../api/item.api';
import { warehouseApi }      from '../../../api/warehouse.api';
import { userApi }           from '../../../api/user.api';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal        from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

// ── CSV Upload config ─────────────────────────────────────────────────────────
const IS_CSV_HEADERS = ['Warehouse', 'Issue Date', 'Issued To (Employee ID)', 'Material Request No', 'Item Code', 'Description', 'Qty', 'Unit', 'Lot No', 'Notes'];
const IS_CSV_SAMPLE = [
  { 'Warehouse': 'Main Store', 'Issue Date': '2025-06-15', 'Issued To (Employee ID)': 'DT10002', 'Material Request No': 'MR-001', 'Item Code': 'ITM-001', 'Description': 'Shaft Assembly', 'Qty': '10', 'Unit': 'pcs', 'Lot No': 'LOT-001', 'Notes': '' },
];
const IS_CSV_VALIDATION = [
  { field: 'Warehouse', required: true },
  { field: 'Item Code', required: true },
  { field: 'Qty', required: true, validate: (v) => isNaN(parseFloat(v)) ? 'Qty must be a number' : null },
];

const { Title, Text } = Typography;

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  issued:    { color: 'green',   label: 'Issued'    },
  cancelled: { color: 'default', label: 'Cancelled' },
};

// ── Empty line item ───────────────────────────────────────────────────────────
const emptyItem = () => ({
  _key:        Date.now() + Math.random(),
  item_id:     null,
  description: '',
  qty:         1,
  unit:        'pcs',
  lot_no:      '',
});

export default function IssueSlipPage() {
  const { can } = usePermissions();
  const canWrite = can('store-transactions-issue_slip-create_edit_delete');

  const [slips,          setSlips]          = useState([]);
  const [warehouses,     setWarehouses]      = useState([]);
  const [items,          setItems]           = useState([]);
  const [materialReqs,   setMaterialReqs]    = useState([]);
  const [users,          setUsers]           = useState([]);
  const [loading,        setLoading]         = useState(false);
  const [search,         setSearch]          = useState('');
  const [statusFilter,   setStatusFilter]    = useState(null);
  const [csvModalOpen,   setCsvModalOpen]    = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [lineItems,  setLineItems]  = useState([emptyItem()]);

  const [form] = Form.useForm();

  // ── Load slips ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await issueSlipApi.getAll(params);
      setSlips(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load issue slips'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookup data ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      warehouseApi.getAll({ limit: 100 }).catch(() => []),
      materialRequestApi.getAll({ status: 'approved', limit: 200 }).catch(() => []),
      userApi.getAll({ limit: 500 }).catch(() => []),
    ]).then(([i, w, mr, u]) => {
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setWarehouses(Array.isArray(w) ? w : (w?.data ?? []));
      setMaterialReqs(Array.isArray(mr) ? mr : (mr?.data ?? []));
      setUsers(Array.isArray(u) ? u : (u?.data ?? []));
    });
  }, []);

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    form.resetFields();
    form.setFieldsValue({ issued_date: dayjs() });
    setLineItems([emptyItem()]);
    setDrawerOpen(true);
  };

  const onSave = async (fifoOverride = false, fifoReason = '') => {
    try {
      const vals = await form.validateFields();
      if (!lineItems.length) { message.error('Add at least one item'); return; }
      setSaving(true);
      const payload = {
        warehouse_id:        vals.warehouse_id,
        issued_date:         vals.issued_date.format('YYYY-MM-DD'),
        material_request_id: vals.material_request_id || null,
        issued_to:           vals.issued_to            || null,
        notes:               vals.notes               || '',
        items:               lineItems.map(({ _key, ...it }) => it),
        ...(fifoOverride ? { fifo_override: true, fifo_override_reason: fifoReason } : {}),
      };
      await issueSlipApi.create(payload);
      message.success('Issue slip created');
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      // FIFO violation — ask user for override reason
      if (err?.message?.includes('FIFO violation') || err?.response?.data?.fifo_warnings) {
        const warnings = err?.response?.data?.fifo_warnings || [];
        Modal.confirm({
          title: 'FIFO Violation Detected',
          width: 520,
          content: (
            <div>
              <p style={{ marginBottom: 8 }}>The following items are not being issued from the oldest batch:</p>
              {warnings.map((w, i) => (
                <div key={i} style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 12 }}>
                  <b>{w.item_name || w.item_code}</b> — Issued lot: <code>{w.issued_lot}</code>, Oldest: <code>{w.oldest_lot?.lot_no}</code>
                </div>
              ))}
              <p style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>Click <b>Override</b> to proceed anyway.</p>
            </div>
          ),
          okText: 'Override & Issue',
          okType: 'primary',
          cancelText: 'Cancel',
          onOk: () => onSave(true, 'Manager approved FIFO override'),
        });
        return;
      }
      message.error(err?.response?.data?.message || err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await issueSlipApi.delete(id);
      message.success('Issue slip deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── CSV Import handler ────────────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    // Group rows by Warehouse + Issue Date to create one slip per group
    const groups = {};
    for (const row of rows) {
      const key = `${(row['Warehouse'] || '').trim()}||${(row['Issue Date'] || '').trim()}||${(row['Issued To (Employee ID)'] || '').trim()}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    for (const [, groupRows] of Object.entries(groups)) {
      try {
        const first = groupRows[0];
        const whName = (first['Warehouse'] || '').trim();
        const wh = warehouses.find((w) => w.name?.toLowerCase() === whName.toLowerCase());
        if (!wh) throw new Error(`Warehouse "${whName}" not found`);
        const empId = (first['Issued To (Employee ID)'] || '').trim();
        const user = empId ? users.find((u) => u.employee_id?.toLowerCase() === empId.toLowerCase()) : null;
        const mrNo = (first['Material Request No'] || '').trim();
        const mr = mrNo ? materialReqs.find((m) => (m.request_no || '')?.toLowerCase() === mrNo.toLowerCase()) : null;
        const slipItems = groupRows.map((row) => {
          const itemCode = (row['Item Code'] || '').trim();
          const item = items.find((i) => i.code?.toLowerCase() === itemCode.toLowerCase() || i.name?.toLowerCase() === itemCode.toLowerCase());
          return {
            item_id:     item?.id || null,
            description: row['Description'] || item?.name || '',
            qty:         parseFloat(row['Qty']) || 1,
            unit:        row['Unit'] || 'pcs',
            lot_no:      row['Lot No'] || '',
          };
        });
        await issueSlipApi.create({
          warehouse_id:        wh.id,
          issued_date:         first['Issue Date'] || dayjs().format('YYYY-MM-DD'),
          material_request_id: mr?.id || null,
          issued_to:           user?.id || null,
          notes:               first['Notes'] || '',
          items:               slipItems,
        });
        success += groupRows.length;
      } catch (err) {
        failed += groupRows.length;
        errors.push(`Slip "${groupRows[0]['Warehouse']}": ${err?.response?.data?.message || err.message}`);
      }
    }
    load();
    return { success, failed, errors };
  };

  // ── Line item helpers ──────────────────────────────────────────────────────
  const addLine    = () => setLineItems((p) => [...p, emptyItem()]);
  const removeLine = (key) => setLineItems((p) => p.filter((r) => r._key !== key));
  const updateLine = (key, field, value) =>
    setLineItems((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  const onItemSelect = (key, itemId) => {
    const found = items.find((i) => i.id === itemId);
    setLineItems((prev) => prev.map((r) =>
      r._key === key
        ? {
            ...r,
            item_id:     itemId,
            description: found?.name || r.description || '',
            unit:        found?.unit || r.unit || 'pcs',
          }
        : r
    ));
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total  = slips.length;
  const issued = slips.filter((r) => r.status === 'issued').length;

  const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Slip No', dataIndex: 'slip_no', key: 'slip_no', width: 150,
      render: (no) => (
        <Text style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8' }}>{no}</Text>
      ),
    },
    {
      title: 'Date', dataIndex: 'issued_date', key: 'issued_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Warehouse', key: 'warehouse', width: 140,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Warehouse?.name || '—'}</Text>,
    },
    {
      title: 'Material Req', key: 'mr', width: 130,
      render: (_, r) => r.MaterialRequest ? (
        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
          {r.MaterialRequest.request_no}
        </Text>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Issued To', key: 'issued_to', width: 130,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.IssuedTo?.name || '—'}</Text>,
    },
    {
      title: 'Items', key: 'items', width: 70, align: 'center',
      render: (_, r) => (
        <Badge count={r.Items?.length || 0} style={{ backgroundColor: '#e0e7ff', color: '#1d4ed8' }} />
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => {
        const cfg = STATUS_CONFIG[s] || { color: 'default', label: s };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Created By', key: 'creator', width: 110,
      render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Creator?.name || '—'}</Text>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 80,
      render: (_, r) => (
        <Space size={4}>
          {r.status !== 'issued' ? (
            <Popconfirm title="Delete this issue slip?" onConfirm={() => onDelete(r.id)} okText="Delete" okType="danger">
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          ) : (
            <Tooltip title="Cannot delete an issued slip">
              <Button size="small" danger icon={<DeleteOutlined />} disabled />
            </Tooltip>
          )}
        </Space>
      ),
    }] : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Store</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Issue Slip</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Issue Slip</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Issue materials from the store to production or other departments.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="green">Issued: {issued}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search slip no, issued to…"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            style={{ width: 160 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('issue-slip.csv', slips, columns)}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)}>Upload CSV</Button>}
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Issue Slip</Button>
          )}
        </div>

        <ResponsiveTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={slips}
          size="small"
          scroll={{ x: 1050 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create Drawer (no edit — issue slips are immutable) ───────────── */}
      <Drawer
        title="New Issue Slip"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                Create Issue Slip
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="warehouse_id" label="Warehouse" rules={[{ required: true, message: 'Select a warehouse' }]}>
                <Select
                  showSearch
                  placeholder="Select warehouse"
                  optionFilterProp="label"
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="issued_date" label="Issue Date" rules={[{ required: true, message: 'Select a date' }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="material_request_id" label="Material Request (optional)">
                <Select
                  showSearch
                  placeholder="Link to a material request"
                  optionFilterProp="label"
                  allowClear
                  onChange={async (mrId) => {
                    if (!mrId) return;
                    try {
                      const mr = await materialRequestApi.getById(mrId);
                      const mrData = mr?.data ?? mr;
                      if (mrData.warehouse_id) {
                        form.setFieldsValue({ warehouse_id: mrData.warehouse_id });
                      }
                      const mrItems = mrData.Items || mrData.items || [];
                      if (mrItems.length > 0) {
                        setLineItems(mrItems.map((it, idx) => ({
                          _key: Date.now() + idx,
                          item_id: it.item_id,
                          description: it.Item?.name || it.description || '',
                          qty: parseFloat(it.qty_requested || it.qty || 1),
                          unit: it.unit || it.Item?.unit || 'pcs',
                          lot_no: '',
                        })));
                        message.success(`${mrItems.length} item(s) loaded from material request`);
                      }
                    } catch (e) {
                      console.warn('Failed to load MR details:', e);
                    }
                  }}
                  options={materialReqs.map((mr) => ({
                    value: mr.id,
                    label: `${mr.request_no} — ${mr.Warehouse?.name || ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="issued_to" label="Issued To">
                <Select
                  showSearch
                  placeholder="Select person"
                  optionFilterProp="label"
                  allowClear
                  options={users.map((u) => ({
                    value: u.id,
                    label: `${u.name}${u.employee_id ? ` (${u.employee_id})` : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Internal notes…" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Line Items
          </Divider>

          <div className="res-line-items">
          {/* Header — drawer 760px - 48px padding = 712px content */}
          {/* Grid: 150px 1fr 60px 50px 90px 28px */}
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 60px 50px 90px 28px', gap: 6, marginBottom: 6 }}>
            {['Item', 'Description', 'Qty', 'Unit', 'Lot No', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {lineItems.map((row) => (
            <div
              key={row._key}
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr 60px 50px 90px 28px',
                gap: 6,
                marginBottom: 8,
                alignItems: 'center',
              }}
            >
              <Select
                showSearch
                placeholder="Select item"
                optionFilterProp="label"
                size="small"
                value={row.item_id}
                onChange={(v) => onItemSelect(row._key, v)}
                allowClear
                options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.code || ''})` }))}
              />
              <Input
                size="small"
                placeholder="Description"
                value={row.description}
                onChange={(e) => updateLine(row._key, 'description', e.target.value)}
              />
              <InputNumber
                size="small"
                min={0}
                precision={3}
                value={row.qty}
                onChange={(v) => updateLine(row._key, 'qty', v)}
                style={{ width: '100%' }}
              />
              <Input
                size="small"
                placeholder="unit"
                value={row.unit}
                onChange={(e) => updateLine(row._key, 'unit', e.target.value)}
              />
              <Input
                size="small"
                placeholder="Lot / Batch No"
                value={row.lot_no}
                onChange={(e) => updateLine(row._key, 'lot_no', e.target.value)}
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
          </div>
        </Form>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Issue Slips"
        entityName="Issue Slip"
        sampleHeaders={IS_CSV_HEADERS}
        sampleRows={IS_CSV_SAMPLE}
        validationRules={IS_CSV_VALIDATION}
      />
    </AppLayout>
  );
}
