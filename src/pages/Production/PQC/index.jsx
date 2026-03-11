import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, Divider, message, Tooltip,
  Popconfirm, Row, Col, Switch, Tabs,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, RightOutlined, PlusCircleOutlined,
  MinusCircleOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { BarChartOutlined } from '@ant-design/icons';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { pqcApi, workOrderApi } from '../../../api/production.api';
import { itemApi }    from '../../../api/item.api';
import { userApi }    from '../../../api/user.api';
import { packageApi } from '../../../api/package.api';
import aiApi          from '../../../api/ai.api';
import useAiSuggestion from '../../../hooks/useAiSuggestion';
import AiSuggestionCard from '../../../components/AiSuggestion/AiSuggestionCard';

const { Title, Text } = Typography;

const TYPE_CONFIG = {
  visual_dimensional: { color: 'purple', label: 'Visual / Dimensional' },
  packing_spec:       { color: 'cyan',   label: 'Packing Spec'         },
};

const RESULT_CONFIG = {
  pending:     { color: 'orange', label: 'Pending'     },
  pass:        { color: 'green',  label: 'Pass'        },
  fail:        { color: 'red',    label: 'Fail'        },
  conditional: { color: 'gold',   label: 'Conditional' },
};

const emptyParam = () => ({
  _key:           Date.now() + Math.random(),
  parameter_name: '',
  specification:  '',
  actual_value:   '',
  result:         'pass',
});

export default function PQCPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-quality_level-pqc-create_edit_delete');

  const [inspections,  setInspections]  = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [items,        setItems]        = useState([]);
  const [users,        setUsers]        = useState([]);
  const [packages,     setPackages]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [dateFrom,     setDateFrom]     = useState(null);
  const [dateTo,       setDateTo]       = useState(null);
  const [resultFilter, setResultFilter] = useState(null);
  const [activeTab,    setActiveTab]    = useState('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [params,     setParams]     = useState([emptyParam()]);

  const [form] = Form.useForm();
  const formType = Form.useWatch('type', form);
  const [defectVisible, setDefectVisible] = useState(false);
  const aiDefects = useAiSuggestion(aiApi.getDefectPatterns);

  // ── Load inspections ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (resultFilter)       p.result = resultFilter;
      if (dateFrom)           p.from   = dateFrom.format('YYYY-MM-DD');
      if (dateTo)             p.to     = dateTo.format('YYYY-MM-DD');
      if (activeTab !== 'all') p.type  = activeTab;
      const data = await pqcApi.getAll(p);
      let rows = Array.isArray(data) ? data : (data?.data ?? []);
      if (search) {
        rows = rows.filter((r) =>
          r.inspection_no?.toLowerCase().includes(search.toLowerCase()) ||
          r.Item?.name?.toLowerCase().includes(search.toLowerCase()) ||
          r.batch_no?.toLowerCase().includes(search.toLowerCase())
        );
      }
      setInspections(rows);
    } catch { message.error('Failed to load PQC inspections'); }
    finally { setLoading(false); }
  }, [search, resultFilter, dateFrom, dateTo, activeTab]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      workOrderApi.getAll({ limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      userApi.getAll({ limit: 500 }).catch(() => []),
      packageApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
    ]).then(([wo, i, u, pkg]) => {
      setWorkOrders(Array.isArray(wo) ? wo : (wo?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setUsers(Array.isArray(u) ? u : (u?.data ?? []));
      setPackages(Array.isArray(pkg) ? pkg : (pkg?.data ?? []));
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total     = inspections.length;
  const countPend = inspections.filter((r) => r.result === 'pending').length;
  const countPass = inspections.filter((r) => r.result === 'pass').length;
  const countFail = inspections.filter((r) => r.result === 'fail').length;

  const PACKING_PARAMS = [
    { parameter_name: 'Box seal integrity',     specification: 'Sealed, no damage',   actual_value: '', result: 'pass' },
    { parameter_name: 'Label placement',        specification: 'As per spec',         actual_value: '', result: 'pass' },
    { parameter_name: 'Qty per box',            specification: 'Match packing list',  actual_value: '', result: 'pass' },
    { parameter_name: 'Orientation / stacking', specification: 'As per instruction',  actual_value: '', result: 'pass' },
    { parameter_name: 'Desiccant / protection', specification: 'Present if required', actual_value: '', result: 'pass' },
  ];

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    form.resetFields();
    form.setFieldsValue({ type: 'visual_dimensional', inspection_date: dayjs(), label_verified: false });
    setParams([emptyParam()]);
    setDrawerOpen(true);
  };

  const onTypeChange = (type) => {
    if (type === 'packing_spec') {
      setParams(PACKING_PARAMS.map((p) => ({ ...p, _key: Date.now() + Math.random() })));
    }
  };

  const onPackageSelect = (pkgId) => {
    if (!pkgId) return;
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const dims = pkg.pack_length || pkg.pack_width || pkg.pack_height
      ? `${pkg.pack_length || '–'} × ${pkg.pack_width || '–'} × ${pkg.pack_height || '–'} in`
      : '';
    const spec = [
      `Package: ${pkg.name}`,
      pkg.type_of_package ? `Type: ${pkg.type_of_package}` : '',
      dims ? `Dimensions: ${dims}` : '',
      pkg.tare_weight ? `Tare Weight: ${pkg.tare_weight} kg` : '',
    ].filter(Boolean).join('\n');
    form.setFieldsValue({
      box_type: pkg.type_of_package || null,
      packing_standard: spec,
    });
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        type:             vals.type,
        inspection_date:  vals.inspection_date.format('YYYY-MM-DD'),
        item_id:          vals.item_id          || null,
        work_order_id:    vals.work_order_id    || null,
        batch_no:         vals.batch_no         || null,
        qty_inspected:    vals.qty_inspected    ?? 0,
        qty_rejected:     vals.qty_rejected     ?? 0,
        qty_accepted:     vals.qty_accepted     ?? 0,
        package_id:       vals.package_id       || null,
        packing_standard: vals.packing_standard || null,
        label_verified:   vals.label_verified   ?? false,
        box_type:         vals.box_type         || null,
        qty_per_box:      vals.qty_per_box      ?? null,
        gross_weight:     vals.gross_weight     ?? null,
        net_weight:       vals.net_weight       ?? null,
        inspector_id:     vals.inspector_id     || null,
        notes:            vals.notes            || null,
        results:          params.map(({ _key, ...p }) => p),
      };
      await pqcApi.create(payload);
      message.success('PQC inspection created');
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onResult = async (id, result) => {
    try {
      await pqcApi.updateResult(id, result);
      message.success(`Result set to ${RESULT_CONFIG[result]?.label || result}`);
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Update failed'); }
  };

  const onDelete = async (id) => {
    try {
      await pqcApi.delete(id);
      message.success('Inspection deleted');
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Delete failed'); }
  };

  // ── Parameter row helpers ──────────────────────────────────────────────────
  const addParam    = () => setParams((p) => [...p, emptyParam()]);
  const removeParam = (key) => setParams((p) => p.filter((r) => r._key !== key));
  const updateParam = (key, field, value) =>
    setParams((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Inspection No', dataIndex: 'inspection_no', key: 'no', width: 155,
      render: (no) => <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{no}</Text>,
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type', width: 155,
      render: (t) => {
        const cfg = TYPE_CONFIG[t] || { color: 'default', label: t };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
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
      title: 'Batch No', dataIndex: 'batch_no', key: 'batch', width: 110,
      render: (v) => <Text style={{ fontSize: 13 }}>{v || '—'}</Text>,
    },
    {
      title: 'Qty Insp.', dataIndex: 'qty_inspected', key: 'qty_i', width: 90, align: 'right',
      render: (v) => v ?? '—',
    },
    {
      title: 'Qty Rej.', dataIndex: 'qty_rejected', key: 'qty_r', width: 90, align: 'right',
      render: (v) => v > 0 ? <Text style={{ color: '#dc2626' }}>{v}</Text> : v ?? '—',
    },
    {
      title: 'Package', key: 'package', width: 120,
      render: (_, r) => r.Package?.name
        ? <Text style={{ fontSize: 13 }}>{r.Package.name}</Text>
        : <Text style={{ fontSize: 13, color: '#9ca3af' }}>—</Text>,
    },
    {
      title: 'Box Type', dataIndex: 'box_type', key: 'box', width: 90,
      render: (v) => v || '—',
    },
    {
      title: 'Label ✓', dataIndex: 'label_verified', key: 'lbl', width: 80, align: 'center',
      render: (v) => v ? <Tag color="green">Yes</Tag> : <Tag color="default">No</Tag>,
    },
    {
      title: 'Inspector', key: 'inspector', width: 120,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Inspector?.name || '—'}</Text>,
    },
    {
      title: 'Result', dataIndex: 'result', key: 'result', width: 110,
      render: (res) => {
        const cfg = RESULT_CONFIG[res] || { color: 'default', label: res };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 180, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.result === 'pending' && (
            <>
              <Tooltip title="Pass">
                <Button size="small" type="primary" ghost
                  icon={<CheckOutlined />}
                  style={{ borderColor: '#16a34a', color: '#16a34a' }}
                  onClick={() => onResult(r.id, 'pass')}
                />
              </Tooltip>
              <Tooltip title="Fail">
                <Button size="small" danger ghost
                  icon={<CloseOutlined />}
                  onClick={() => onResult(r.id, 'fail')}
                />
              </Tooltip>
              <Tooltip title="Conditional">
                <Button size="small"
                  style={{ borderColor: '#d97706', color: '#d97706' }}
                  onClick={() => onResult(r.id, 'conditional')}
                >
                  Cond.
                </Button>
              </Tooltip>
              <Popconfirm
                title="Delete this inspection?"
                onConfirm={() => onDelete(r.id)}
                okText="Delete" okType="danger"
              >
                <Tooltip title="Delete">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    }] : []),
  ];

  const tabItems = [
    { key: 'all',               label: 'All'                   },
    { key: 'visual_dimensional', label: 'Visual / Dimensional' },
    { key: 'packing_spec',       label: 'Packing Spec'         },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>PQC Inspection</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>PQC — Packing Quality Control</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        100% packing inspection and packing specification verification before dispatch.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Pending: {countPend}</Tag>
        <Tag color="green">Pass: {countPass}</Tag>
        <Tag color="red">Fail: {countFail}</Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ padding: '0 20px' }}
          tabBarStyle={{ marginBottom: 0 }}
        />

        <div style={{ padding: '16px 20px' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search inspection no, item, batch..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 260, borderRadius: 8 }}
              allowClear
            />
            <DatePicker placeholder="From date" value={dateFrom} onChange={setDateFrom} format="DD MMM YYYY" style={{ width: 140 }} />
            <DatePicker placeholder="To date"   value={dateTo}   onChange={setDateTo}   format="DD MMM YYYY" style={{ width: 140 }} />
            <Select
              placeholder="Result" allowClear value={resultFilter} onChange={setResultFilter}
              options={Object.entries(RESULT_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
              style={{ width: 140 }}
            />
            <div style={{ flex: 1 }} />
            <Button icon={<BarChartOutlined />} onClick={() => { setDefectVisible(true); aiDefects.fetch(); }}>Defect Analytics</Button>
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New PQC Inspection</Button>
            )}
          </div>

          {defectVisible && (
            <AiSuggestionCard
              title="Defect Pattern Analytics"
              loading={aiDefects.loading}
              error={aiDefects.error}
              aiAvailable={aiDefects.aiAvailable}
              cached={aiDefects.cached}
              onDismiss={() => setDefectVisible(false)}
              onRetry={() => aiDefects.fetch()}
            >
              {aiDefects.data?.patterns?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong>Top Defect Patterns:</strong>
                  {aiDefects.data.patterns.map((p, i) => (
                    <div key={i} style={{ margin: '6px 0', padding: '6px 10px', background: 'rgba(255,255,255,0.5)', borderRadius: 6 }}>
                      <div style={{ fontWeight: 600 }}>{i + 1}. {p.defect_type} — {p.frequency} occurrences ({p.percentage}%)</div>
                      {p.root_cause && <div style={{ fontSize: 12, color: '#555' }}>Root cause: {p.root_cause}</div>}
                      {p.action && <div style={{ fontSize: 12, color: '#1677ff' }}>Action: {p.action}</div>}
                    </div>
                  ))}
                </div>
              )}
              {aiDefects.data?.summary && <div style={{ marginTop: 8, fontStyle: 'italic' }}>{aiDefects.data.summary}</div>}
            </AiSuggestionCard>
          )}

          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={inspections}
            size="small"
            scroll={{ x: 1600 }}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          />
        </div>
      </Card>

      {/* ── Create Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title="New PQC Inspection"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>Create Inspection</Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="Inspection Type" rules={[{ required: true }]}>
            <Select
              onChange={onTypeChange}
              options={[
                { value: 'visual_dimensional', label: 'Visual / Dimensional' },
                { value: 'packing_spec',       label: 'Packing Specification' },
              ]}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inspection_date" label="Inspection Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="item_id" label="Item" rules={[{ required: true, message: 'Select item' }]}>
                <Select showSearch optionFilterProp="label" allowClear
                  placeholder="Select item"
                  options={items.map((i) => ({ value: i.id, label: `${i.name}${i.code ? ` (${i.code})` : ''}` }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="work_order_id" label="Work Order">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select WO"
                  options={workOrders.map((wo) => ({ value: wo.id, label: wo.wo_no }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="batch_no" label="Batch / Lot No.">
                <Input placeholder="e.g. LOT-2026-001" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="qty_inspected" label="Qty Inspected">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="qty_rejected" label="Qty Rejected">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="qty_accepted" label="Qty Accepted">
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
          </Row>

          {formType === 'packing_spec' && (
            <>
              <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 8 }}>
                Packing Details
              </Divider>

              <Form.Item name="package_id" label="Package (from Master)">
                <Select showSearch optionFilterProp="label" allowClear
                  placeholder="Select package to auto-fill specs"
                  options={packages.map((p) => ({ value: p.id, label: `${p.name}${p.type_of_package ? ` (${p.type_of_package})` : ''}` }))}
                  onChange={onPackageSelect}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="box_type" label="Box / Package Type">
                    <Select allowClear placeholder="Select type"
                      options={['Box', 'Bag', 'Pallet', 'Crate', 'Drum', 'Tray', 'Blister', 'Pouch', 'Other']
                        .map((t) => ({ value: t, label: t }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="qty_per_box" label="Qty per Box">
                    <Input type="number" min={0} placeholder="e.g. 50" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="gross_weight" label="Gross Weight (kg)">
                    <Input type="number" min={0} step={0.001} placeholder="e.g. 12.5" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="net_weight" label="Net Weight (kg)">
                    <Input type="number" min={0} step={0.001} placeholder="e.g. 10.2" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="packing_standard" label="Packing Specification / Standard">
                <Input.TextArea rows={3} placeholder="Auto-filled from package master or enter manually" />
              </Form.Item>

              <Form.Item name="label_verified" label="Label Verified" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </>
          )}

          {formType !== 'packing_spec' && (
            <Form.Item name="packing_standard" label="Packing Specification / Standard">
              <Input.TextArea rows={2} placeholder="Describe packing requirements, box type, label spec, etc." />
            </Form.Item>
          )}

          <Row gutter={16}>
            {formType !== 'packing_spec' && (
              <Col span={12}>
                <Form.Item name="label_verified" label="Label Verified" valuePropName="checked">
                  <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
              </Col>
            )}
            <Col span={formType === 'packing_spec' ? 24 : 12}>
              <Form.Item name="inspector_id" label="Inspector">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select inspector"
                  options={users.map((u) => ({ value: u.id, label: u.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Observations, notes…" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Inspection Parameters
          </Divider>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px 28px', gap: 6, marginBottom: 6 }}>
            {['Parameter Name', 'Specification', 'Actual Value', 'Result', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {params.map((row) => (
            <div key={row._key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px 28px', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <Input size="small" placeholder="e.g. Box seal" value={row.parameter_name}
                onChange={(e) => updateParam(row._key, 'parameter_name', e.target.value)} />
              <Input size="small" placeholder="Spec" value={row.specification}
                onChange={(e) => updateParam(row._key, 'specification', e.target.value)} />
              <Input size="small" placeholder="Actual" value={row.actual_value}
                onChange={(e) => updateParam(row._key, 'actual_value', e.target.value)} />
              <Select size="small" value={row.result}
                onChange={(v) => updateParam(row._key, 'result', v)}
                options={[{ value: 'pass', label: 'Pass' }, { value: 'fail', label: 'Fail' }]}
              />
              <Button size="small" type="text" danger icon={<MinusCircleOutlined />}
                onClick={() => removeParam(row._key)} disabled={params.length === 1} />
            </div>
          ))}

          <Button type="dashed" onClick={addParam} icon={<PlusCircleOutlined />} style={{ width: '100%', marginTop: 4 }}>
            Add Parameter
          </Button>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
