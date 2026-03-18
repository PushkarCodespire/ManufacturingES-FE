import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, message, Tooltip, Popconfirm, Row, Col, Statistic,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, DeleteOutlined,
  RightOutlined, FolderOpenOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate }  from 'react-router-dom';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { iqcApi }       from '../../../api/production.api';
import { itemApi }      from '../../../api/item.api';
import { userApi }      from '../../../api/user.api';
import { vendorApi }    from '../../../api/vendor.api';
import { grnApi }       from '../../../api/store.api';

const { Title, Text } = Typography;

const RESULT_CONFIG = {
  pending:     { color: 'orange', label: 'Pending'     },
  pass:        { color: 'green',  label: 'Pass'        },
  fail:        { color: 'red',    label: 'Fail'        },
  conditional: { color: 'gold',   label: 'Conditional' },
};

export default function IQCPage() {
  const { can }  = usePermissions();
  const navigate = useNavigate();
  const canWrite = can('prod-quality_level-iqc-create_edit_delete');

  const [inspections,  setInspections]  = useState([]);
  const [items,        setItems]        = useState([]);
  const [users,        setUsers]        = useState([]);
  const [vendors,      setVendors]      = useState([]);
  const [grns,         setGrns]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [resultFilter, setResultFilter] = useState(null);
  const [vendorFilter, setVendorFilter] = useState(null);
  const [dateFrom,     setDateFrom]     = useState(null);
  const [dateTo,       setDateTo]       = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [form]                      = Form.useForm();

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (resultFilter) p.result    = resultFilter;
      if (vendorFilter) p.vendor_id = vendorFilter;
      if (dateFrom)     p.from      = dateFrom.format('YYYY-MM-DD');
      if (dateTo)       p.to        = dateTo.format('YYYY-MM-DD');
      const data = await iqcApi.getAll(p);
      let rows = Array.isArray(data) ? data : (data?.data ?? []);
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((r) =>
          r.inspection_no?.toLowerCase().includes(s) ||
          r.Item?.name?.toLowerCase().includes(s) ||
          r.Vendor?.name?.toLowerCase().includes(s) ||
          r.batch_no?.toLowerCase().includes(s)
        );
      }
      setInspections(rows);
    } catch (err) { message.error(err?.message || 'Failed to load IQC inspections'); }
    finally { setLoading(false); }
  }, [search, resultFilter, vendorFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // ── Lookups ────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      userApi.getAll({ limit: 500 }).catch(() => []),
      vendorApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      grnApi.getAll({ limit: 200, status: 'approved' }).catch(() => ({ data: [] })),
    ]).then(([i, u, v, g]) => {
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setUsers(Array.isArray(u) ? u : (u?.data ?? []));
      const allVendors = Array.isArray(v) ? v : (v?.data ?? []);
      setVendors(allVendors.filter((x) => x.type !== 'customer'));
      setGrns(Array.isArray(g) ? g : (g?.data ?? []));
    });
  }, []);

  // ── Stats (IQC-008) ────────────────────────────────────────────────────────
  const total      = inspections.length;
  const pending    = inspections.filter((r) => r.result === 'pending').length;
  const pass       = inspections.filter((r) => r.result === 'pass').length;
  const fail       = inspections.filter((r) => r.result === 'fail').length;
  const onHold     = inspections.filter((r) => r.on_hold).length;
  const rejRate    = total > 0 ? ((fail / total) * 100).toFixed(1) : '0.0';

  // ── Create ─────────────────────────────────────────────────────────────────
  const openAdd = () => {
    form.resetFields();
    form.setFieldsValue({ inspection_date: dayjs() });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      await iqcApi.create({
        item_id:         vals.item_id         || null,
        vendor_id:       vals.vendor_id       || null,
        grn_id:          vals.grn_id          || null,
        batch_no:        vals.batch_no        || null,
        qty_received:    vals.qty_received    ?? 0,
        qty_inspected:   vals.qty_inspected   ?? 0,
        inspector_id:    vals.inspector_id    || null,
        inspection_date: vals.inspection_date.format('YYYY-MM-DD'),
        notes:           vals.notes           || null,
      });
      message.success('IQC inspection created — open it to enter measurements');
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try {
      await iqcApi.delete(id);
      message.success('Inspection deleted');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Delete failed'); }
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Inspection No', dataIndex: 'inspection_no', key: 'no', width: 155,
      render: (no) => <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{no}</Text>,
    },
    {
      title: 'Date', dataIndex: 'inspection_date', key: 'date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Item', key: 'item', width: 160,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Item?.name || '—'}</Text>,
    },
    {
      title: 'Vendor / Supplier', key: 'vendor', width: 150,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Vendor?.name || '—'}</Text>,
    },
    {
      title: 'GRN No', key: 'grn', width: 120,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Grn?.grn_no || '—'}</Text>,
    },
    {
      title: 'Batch', dataIndex: 'batch_no', key: 'batch', width: 110,
      render: (v) => <Text style={{ fontSize: 13 }}>{v || '—'}</Text>,
    },
    {
      title: 'Qty Insp.', dataIndex: 'qty_inspected', key: 'qty_i', width: 90, align: 'right',
      render: (v) => v ?? '—',
    },
    {
      title: 'Qty Rej.', dataIndex: 'qty_rejected', key: 'qty_r', width: 90, align: 'right',
      render: (v) => v > 0 ? <Text style={{ color: '#dc2626', fontWeight: 600 }}>{v}</Text> : (v ?? '—'),
    },
    {
      title: 'Result', dataIndex: 'result', key: 'result', width: 110,
      render: (res) => {
        const cfg = RESULT_CONFIG[res] || { color: 'default', label: res };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'On Hold', dataIndex: 'on_hold', key: 'hold', width: 85, align: 'center',
      render: (v) => v
        ? <Tag color="red" icon={<WarningOutlined />}>Hold</Tag>
        : <Tag color="default">—</Tag>,
    },
    {
      title: 'CAPA', key: 'capa', width: 80, align: 'center',
      render: (_, r) => r.capa_id
        ? <Tag color="purple">Linked</Tag>
        : <Tag color="default">—</Tag>,
    },
    {
      title: '', key: 'open', width: 80, fixed: 'right',
      render: (_, r) => (
        <Button size="small" type="link" icon={<FolderOpenOutlined />}
          onClick={() => navigate(`/production/iqc/${r.id}`)}>
          Open
        </Button>
      ),
    },
    ...(canWrite ? [{
      title: 'Del.', key: 'del', width: 60, fixed: 'right',
      render: (_, r) => r.result === 'pending' ? (
        <Popconfirm title="Delete this inspection?" onConfirm={() => onDelete(r.id)}
          okText="Delete" okType="danger">
          <Tooltip title="Delete"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
        </Popconfirm>
      ) : null,
    }] : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>IQC Inspection</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>IQC — Incoming Quality Control</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Inspect incoming material from suppliers. Load check-sheets, enter measurements, set verdict, and trigger CAPA on rejections.
      </Text>

      {/* Dashboard stats (IQC-008) */}
      <Row gutter={16} style={{ marginTop: 16, marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Total" value={total} valueStyle={{ color: '#1d4ed8', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Pending" value={pending} valueStyle={{ color: '#d97706', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Pass" value={pass} valueStyle={{ color: '#16a34a', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Fail" value={fail} valueStyle={{ color: '#dc2626', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="On Hold" value={onHold} valueStyle={{ color: '#7c3aed', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center', background: fail > 0 ? '#fef2f2' : undefined }}>
            <Statistic title="Rejection %" value={`${rejRate}%`}
              valueStyle={{ color: fail > 0 ? '#dc2626' : '#16a34a', fontSize: 22 }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search inspection no, item, vendor, batch..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300, borderRadius: 8 }}
            allowClear
          />
          <Select placeholder="Vendor" allowClear value={vendorFilter} onChange={setVendorFilter}
            showSearch optionFilterProp="label"
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            style={{ width: 180 }}
          />
          <DatePicker placeholder="From date" value={dateFrom} onChange={setDateFrom} format="DD MMM YYYY" style={{ width: 140 }} />
          <DatePicker placeholder="To date"   value={dateTo}   onChange={setDateTo}   format="DD MMM YYYY" style={{ width: 140 }} />
          <Select placeholder="Result" allowClear value={resultFilter} onChange={setResultFilter}
            options={Object.entries(RESULT_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
            style={{ width: 140 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New IQC Inspection</Button>
          )}
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={inspections}
          size="small"
          scroll={{ x: 1500 }}
          rowClassName={(r) => r.on_hold ? 'ant-table-row-danger' : ''}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title="New IQC Inspection"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={560}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>Create & Open</Button>
            )}
          </div>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          Create the inspection header. You'll enter measurements and set the verdict in the detail view.
        </Text>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_date" label="Inspection Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="item_id" label="Item" rules={[{ required: true, message: 'Select item' }]}>
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select item"
                  options={items.map((i) => ({ value: i.id, label: `${i.name}${i.code ? ` (${i.code})` : ''}` }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vendor_id" label="Vendor / Supplier">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select vendor"
                  options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="grn_id" label="GRN Reference">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Link to GRN (optional)"
                  options={grns.map((g) => ({ value: g.id, label: g.grn_no }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="batch_no" label="Batch / Lot No.">
                <Input placeholder="e.g. LOT-2026-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inspector_id" label="Inspector">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select inspector"
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="qty_received" label="Qty Received">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="qty_inspected" label="Qty to Inspect">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Initial notes…" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
