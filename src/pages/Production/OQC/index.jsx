import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, Divider, message, Tooltip,
  Popconfirm, Row, Col, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, RightOutlined, PlusCircleOutlined,
  MinusCircleOutlined, CheckOutlined, CloseOutlined,
  FileDoneOutlined, SafetyCertificateOutlined, PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { oqcApi, workOrderApi } from '../../../api/production.api';
import { itemApi }    from '../../../api/item.api';
import { userApi }    from '../../../api/user.api';
import { vendorApi }  from '../../../api/vendor.api';
import aiApi          from '../../../api/ai.api';
import useAiSuggestion from '../../../hooks/useAiSuggestion';
import AiSuggestionCard from '../../../components/AiSuggestion/AiSuggestionCard';
import OqcTestCertTemplate from './templates/OqcTestCertTemplate';
import OqcCOCTemplate      from './templates/OqcCOCTemplate';
import '../../../pages/Dispatch/DispatchDocuments/printStyles.css';

const { Title, Text } = Typography;

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

export default function OQCPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-quality_level-oqc-create_edit_delete');

  const [inspections,  setInspections]  = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [items,        setItems]        = useState([]);
  const [users,        setUsers]        = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [dateFrom,     setDateFrom]     = useState(null);
  const [dateTo,       setDateTo]       = useState(null);
  const [resultFilter, setResultFilter] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [params,     setParams]     = useState([emptyParam()]);

  const [form] = Form.useForm();
  const [priorityMap, setPriorityMap] = useState({});
  const aiPriority = useAiSuggestion(aiApi.getOqcPriority);
  const aiStandards = useAiSuggestion(aiApi.detectStandards);
  const [standardsVisible, setStandardsVisible] = useState(false);

  // Load AI priority on mount
  useEffect(() => {
    aiPriority.fetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build priority map from AI response
  useEffect(() => {
    if (aiPriority.data?.data?.prioritized) {
      const map = {};
      aiPriority.data.data.prioritized.forEach((p) => { map[p.inspection_id] = p; });
      setPriorityMap(map);
    }
  }, [aiPriority.data]);

  const handleDetectStandards = () => {
    const itemId = form.getFieldValue('item_id');
    if (!itemId) { message.warning('Select an item first'); return; }
    setStandardsVisible(true);
    aiStandards.fetch({ item_id: itemId, parameters: params });
  };

  // ── Print state ───────────────────────────────────────────────────────────
  const [printData,  setPrintData]  = useState(null);
  const [printType,  setPrintType]  = useState(null); // 'cert' | 'coc'
  const tcRef  = useRef(null);
  const cocRef = useRef(null);

  const handlePrintTC  = useReactToPrint({ contentRef: tcRef,  documentTitle: `TC-${printData?.cert_no || ''}` });
  const handlePrintCOC = useReactToPrint({ contentRef: cocRef, documentTitle: `COC-${printData?.coc_no || ''}` });

  const onPrint = async (id, type) => {
    try {
      const res = await oqcApi.getById(id);
      const data = res?.data || res;
      setPrintData(data);
      setPrintType(type);
    } catch (err) { message.error(err?.message || 'Failed to load inspection data for printing'); }
  };

  useEffect(() => {
    if (!printData || !printType) return;
    const timer = setTimeout(() => {
      if (printType === 'cert') handlePrintTC();
      else handlePrintCOC();
      setPrintData(null);
      setPrintType(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [printData, printType]);

  // ── Load inspections ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (resultFilter) p.result = resultFilter;
      if (dateFrom)     p.from   = dateFrom.format('YYYY-MM-DD');
      if (dateTo)       p.to     = dateTo.format('YYYY-MM-DD');
      const data = await oqcApi.getAll(p);
      let rows = Array.isArray(data) ? data : (data?.data ?? []);
      if (search) {
        rows = rows.filter((r) =>
          r.inspection_no?.toLowerCase().includes(search.toLowerCase()) ||
          r.Item?.name?.toLowerCase().includes(search.toLowerCase()) ||
          r.Customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
          r.batch_no?.toLowerCase().includes(search.toLowerCase())
        );
      }
      setInspections(rows);
    } catch (err) { message.error(err?.message || 'Failed to load OQC inspections'); }
    finally { setLoading(false); }
  }, [search, resultFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // ── Load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      workOrderApi.getAll({ limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      userApi.getAll({ limit: 500, roles: 'oqc_inspector,qa_manager' }).catch(() => []),
      vendorApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
    ]).then(([wo, i, u, v]) => {
      setWorkOrders(Array.isArray(wo) ? wo : (wo?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setUsers(Array.isArray(u) ? u : (u?.data ?? []));
      const vendors = Array.isArray(v) ? v : (v?.data ?? []);
      setCustomers(vendors.filter((vnd) => vnd.type === 'customer'));
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total     = inspections.length;
  const countPend = inspections.filter((r) => r.result === 'pending').length;
  const countPass = inspections.filter((r) => r.result === 'pass').length;
  const countFail = inspections.filter((r) => r.result === 'fail').length;

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    form.resetFields();
    form.setFieldsValue({ inspection_date: dayjs() });
    setParams([emptyParam()]);
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        inspection_date: vals.inspection_date.format('YYYY-MM-DD'),
        item_id:         vals.item_id         || null,
        customer_id:     vals.customer_id     || null,
        work_order_id:   vals.work_order_id   || null,
        batch_no:        vals.batch_no        || null,
        qty_inspected:   vals.qty_inspected   ?? 0,
        qty_rejected:    vals.qty_rejected    ?? 0,
        qty_accepted:    vals.qty_accepted    ?? 0,
        inspector_id:    vals.inspector_id    || null,
        notes:           vals.notes           || null,
        results:         params.map(({ _key, ...p }) => p),
      };
      await oqcApi.create(payload);
      message.success('OQC inspection created');
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onResult = async (id, result) => {
    try {
      await oqcApi.updateResult(id, result);
      message.success(`Result set to ${RESULT_CONFIG[result]?.label || result}`);
      load();
    } catch (err) { message.error(err?.message || 'Update failed'); }
  };

  const onGenerateDoc = async (id, type) => {
    try {
      await oqcApi.generateDoc(id, type);
      message.success(type === 'cert' ? 'Test Certificate generated' : 'COC generated');
      load();
    } catch (err) { message.error(err?.message || 'Failed to generate document'); }
  };

  const onDelete = async (id) => {
    try {
      await oqcApi.delete(id);
      message.success('Inspection deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Parameter row helpers ──────────────────────────────────────────────────
  const addParam    = () => setParams((p) => [...p, emptyParam()]);
  const removeParam = (key) => setParams((p) => p.filter((r) => r._key !== key));
  const updateParam = (key, field, value) =>
    setParams((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  // ── Auto-load quality params when item is selected ─────────────────────────
  const onItemSelect = async (itemId) => {
    if (!itemId) return;
    try {
      const data = await itemApi.getQualityParams(itemId);
      const qps  = Array.isArray(data) ? data : (data?.data ?? []);
      if (qps.length > 0) {
        setParams(qps.map((p) => ({
          _key:           Date.now() + Math.random(),
          parameter_name: p.param_name,
          specification:  p.specification || '',
          actual_value:   '',
          result:         'pass',
        })));
        message.success(`${qps.length} quality parameter(s) loaded from item master`);
      }
    } catch { /* silently ignore */ }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Inspection No', dataIndex: 'inspection_no', key: 'no', width: 155,
      render: (no, rec) => {
        const prio = priorityMap[rec.id];
        return (
          <Space size={4}>
            {prio && <Tag color={prio.priority === 'urgent' ? 'red' : prio.priority === 'high' ? 'orange' : 'default'} style={{ fontSize: 10, lineHeight: '16px', height: 16, margin: 0 }}>{prio.priority}</Tag>}
            <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{no}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Date', dataIndex: 'inspection_date', key: 'date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Item', key: 'item', width: 150,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Item?.name || '—'}</Text>,
    },
    {
      title: 'Customer', key: 'customer', width: 140,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Customer?.name || '—'}</Text>,
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
      title: 'Result', dataIndex: 'result', key: 'result', width: 110,
      render: (res) => {
        const cfg = RESULT_CONFIG[res] || { color: 'default', label: res };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Test Cert', key: 'cert', width: 130, align: 'center',
      render: (_, r) => r.cert_generated
        ? <Space size={4}>
            <Tag color="green">{r.cert_no}</Tag>
            <Tooltip title="Print TC"><Button size="small" type="text" icon={<PrinterOutlined />} onClick={() => onPrint(r.id, 'cert')} /></Tooltip>
          </Space>
        : <Tag color="default">—</Tag>,
    },
    {
      title: 'COC', key: 'coc', width: 130, align: 'center',
      render: (_, r) => r.coc_generated
        ? <Space size={4}>
            <Tag color="green">{r.coc_no}</Tag>
            <Tooltip title="Print COC"><Button size="small" type="text" icon={<PrinterOutlined />} onClick={() => onPrint(r.id, 'coc')} /></Tooltip>
          </Space>
        : <Tag color="default">—</Tag>,
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 220, fixed: 'right',
      render: (_, r) => (
        <Space size={4} wrap>
          {r.result === 'pending' && (
            <>
              <Tooltip title="Pass">
                <Button size="small" type="primary" ghost icon={<CheckOutlined />}
                  style={{ borderColor: '#16a34a', color: '#16a34a' }}
                  onClick={() => onResult(r.id, 'pass')}
                />
              </Tooltip>
              <Tooltip title="Fail">
                <Button size="small" danger ghost icon={<CloseOutlined />}
                  onClick={() => onResult(r.id, 'fail')}
                />
              </Tooltip>
              <Tooltip title="Conditional">
                <Button size="small"
                  style={{ borderColor: '#d97706', color: '#d97706' }}
                  onClick={() => onResult(r.id, 'conditional')}
                >Cond.</Button>
              </Tooltip>
              <Popconfirm title="Delete this inspection?" onConfirm={() => onDelete(r.id)}
                okText="Delete" okType="danger">
                <Tooltip title="Delete">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          {r.result === 'pass' && !r.cert_generated && (
            <Tooltip title="Generate Test Certificate">
              <Button size="small" icon={<SafetyCertificateOutlined />}
                onClick={() => onGenerateDoc(r.id, 'cert')}
                style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
              >
                Test Cert
              </Button>
            </Tooltip>
          )}
          {r.result === 'pass' && !r.coc_generated && (
            <Tooltip title="Generate Certificate of Conformance">
              <Button size="small" icon={<FileDoneOutlined />}
                onClick={() => onGenerateDoc(r.id, 'coc')}
                style={{ borderColor: '#0369a1', color: '#0369a1' }}
              >
                COC
              </Button>
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
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>OQC Inspection</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>OQC — Outgoing Quality Control</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Final outgoing inspection before dispatch. Generate Test Certificates and Certificates of Conformance.
      </Text>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {total}</Tag>
        <Tag color="orange">Pending: {countPend}</Tag>
        <Tag color="green">Pass: {countPass}</Tag>
        <Tag color="red">Fail: {countFail}</Tag>
        <Tag color="purple">
          Certs: {inspections.filter((r) => r.cert_generated).length}
        </Tag>
        <Tag color="geekblue">
          COCs: {inspections.filter((r) => r.coc_generated).length}
        </Tag>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search inspection no, item, customer..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
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
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New OQC Inspection</Button>
          )}
        </div>

        <Alert
          type="info"
          showIcon
          message="Test Certificates and COC are generated after a Pass result. Click the buttons in the Actions column."
          style={{ marginBottom: 12, borderRadius: 8 }}
        />

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={inspections}
          size="small"
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
        />
      </Card>

      {/* ── Create Drawer ────────────────────────────────────────────────── */}
      <Drawer
        title="New OQC Inspection"
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
                  onChange={onItemSelect}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customer_id" label="Customer">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select customer"
                  options={customers.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="work_order_id" label="Work Order">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select WO"
                  options={workOrders.map((wo) => ({ value: wo.id, label: wo.wo_no }))}
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

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Observations, notes…" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151', flex: 1 }}>
              Inspection Parameters
            </Divider>
            <Button size="small" type="dashed" onClick={handleDetectStandards} loading={aiStandards.loading} style={{ marginLeft: 8 }}>
              Detect Standards
            </Button>
          </div>

          {standardsVisible && (
            <AiSuggestionCard
              title="QMS Standards"
              loading={aiStandards.loading}
              error={aiStandards.error}
              aiAvailable={aiStandards.aiAvailable}
              onDismiss={() => setStandardsVisible(false)}
              onRetry={handleDetectStandards}
              style={{ marginBottom: 8 }}
            >
              {aiStandards.data?.data && (
                <div style={{ fontSize: 12 }}>
                  {(aiStandards.data.data.suggested_standards || []).map((s, i) => (
                    <Tag key={i} color={s.relevance === 'high' ? 'blue' : 'default'} style={{ marginBottom: 4 }}>
                      {s.standard} {s.clause && `(${s.clause})`}
                    </Tag>
                  ))}
                  {(aiStandards.data.data.missing_parameters || []).length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <Text type="warning" style={{ fontSize: 11 }}>Missing parameters: </Text>
                      {aiStandards.data.data.missing_parameters.map((p, i) => (
                        <Tag key={i} color="orange" style={{ fontSize: 10, marginBottom: 2 }}>{p.parameter_name}</Tag>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </AiSuggestionCard>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px 28px', gap: 6, marginBottom: 6 }}>
            {['Parameter Name', 'Specification', 'Actual Value', 'Result', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {params.map((row) => (
            <div key={row._key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px 28px', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <Input size="small" placeholder="e.g. Diameter" value={row.parameter_name}
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

      {/* Hidden print templates */}
      <div style={{ display: 'none' }}>
        <OqcTestCertTemplate ref={tcRef}  inspection={printData} />
        <OqcCOCTemplate      ref={cocRef} inspection={printData} />
      </div>
    </AppLayout>
  );
}
