import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, Divider, message, Tooltip,
  Popconfirm, Row, Col, Radio, Badge, Tabs, Spin, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  DeleteOutlined, RightOutlined, PlusCircleOutlined,
  MinusCircleOutlined, CheckOutlined, CloseOutlined,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, WarningOutlined, BulbOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout          from '../../../components/AppLayout';
import usePermissions     from '../../../hooks/usePermissions';
import { lqcApi, workOrderApi } from '../../../api/production.api';
import { itemApi }        from '../../../api/item.api';
import { machineApi }     from '../../../api/machine.api';
import { userApi }        from '../../../api/user.api';
import aiApi              from '../../../api/ai.api';
import useAiSuggestion    from '../../../hooks/useAiSuggestion';
import AiSuggestionCard   from '../../../components/AiSuggestion/AiSuggestionCard';

const { Title, Text } = Typography;

const TYPE_CONFIG = {
  fpi:    { color: 'purple', label: 'FPI'    },
  hourly: { color: 'blue',   label: 'Hourly' },
  lpi:    { color: 'cyan',   label: 'LPI'    },
};

const RESULT_CONFIG = {
  pending:     { color: 'orange', label: 'Pending'     },
  pass:        { color: 'green',  label: 'Pass'        },
  fail:        { color: 'red',    label: 'Fail'        },
  conditional: { color: 'gold',   label: 'Conditional' },
};

/**
 * Backend sometimes returns ai_insight as { raw_text: "```json\n{...}\n```" }
 * instead of a pre-parsed object. This helper normalises both cases.
 */
const parseInsight = (raw) => {
  if (!raw || typeof raw !== 'object') return {};
  if (!raw.raw_text) return raw;
  try {
    const clean = raw.raw_text
      .replace(/^```json\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    return JSON.parse(clean);
  } catch {
    return raw;
  }
};

const emptyParam = () => ({
  _key:           Date.now() + Math.random(),
  parameter_name: '',
  specification:  '',
  actual_value:   '',
  result:         'pass',
});

export default function LQCPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-quality_level-iqc-create_edit_delete');

  const [inspections,  setInspections]  = useState([]);
  const [workOrders,   setWorkOrders]   = useState([]);
  const [items,        setItems]        = useState([]);
  const [machines,     setMachines]     = useState([]);
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [dateFrom,     setDateFrom]     = useState(null);
  const [dateTo,       setDateTo]       = useState(null);
  const [resultFilter, setResultFilter] = useState(null);
  const [activeTab,    setActiveTab]    = useState('all');

  // ── AI: Spike alert (per-inspection) ──────────────────────────────────────
  const aiSpike = useAiSuggestion(aiApi.getLqcAiSpikeAlert);
  const [spikeDrawerOpen,   setSpikeDrawerOpen]   = useState(false);
  const [spikeDrawerRecord, setSpikeDrawerRecord] = useState(null);

  // ── Tool Wear Trend state (LQC-003) ────────────────────────────────────────
  const [twMachineId,  setTwMachineId]  = useState(null);
  const [twItemId,     setTwItemId]     = useState(null);
  const [trendData,    setTrendData]    = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [params,     setParams]     = useState([emptyParam()]);

  const [form] = Form.useForm();

  // ── Open / close spike drawer ─────────────────────────────────────────────
  const openSpikeDrawer = (record) => {
    setSpikeDrawerRecord(record);
    setSpikeDrawerOpen(true);
    aiSpike.reset();
    aiSpike.fetch(record.id);
  };
  const closeSpikeDrawer = () => {
    setSpikeDrawerOpen(false);
    setSpikeDrawerRecord(null);
    aiSpike.reset();
  };

  // ── Load inspections ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (activeTab === 'tool_wear') return;
    setLoading(true);
    try {
      const p = {};
      if (search)       p.search = search;
      if (resultFilter) p.result = resultFilter;
      if (dateFrom)     p.date_from = dateFrom.format('YYYY-MM-DD');
      if (dateTo)       p.date_to   = dateTo.format('YYYY-MM-DD');
      if (activeTab !== 'all') p.type = activeTab;
      const data = await lqcApi.getAll(p);
      setInspections(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load LQC inspections'); }
    finally { setLoading(false); }
  }, [search, resultFilter, dateFrom, dateTo, activeTab]);

  useEffect(() => { load(); }, [load]);

  // ── Load tool wear trend (LQC-003) ─────────────────────────────────────────
  const loadTrend = useCallback(async () => {
    if (!twMachineId && !twItemId) { setTrendData(null); return; }
    setTrendLoading(true);
    try {
      const p = {};
      if (twMachineId) p.machine_id = twMachineId;
      if (twItemId)    p.item_id    = twItemId;
      const res = await lqcApi.getToolWearTrend(p);
      setTrendData(res?.data ?? res);
    } catch (err) { message.error(err?.message || 'Failed to load trend data'); }
    finally { setTrendLoading(false); }
  }, [twMachineId, twItemId]);

  useEffect(() => { if (activeTab === 'tool_wear') loadTrend(); }, [activeTab, loadTrend]);

  // ── Load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      workOrderApi.getAll({ limit: 500 }).catch(() => []),
      itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      machineApi.getAll({ limit: 500 }).catch(() => []),
      userApi.getAll({ limit: 500 }).catch(() => []),
    ]).then(([wo, i, m, u]) => {
      setWorkOrders(Array.isArray(wo) ? wo : (wo?.data ?? []));
      setItems(Array.isArray(i) ? i : (i?.data ?? []));
      setMachines(Array.isArray(m) ? m : (m?.data ?? []));
      setUsers(Array.isArray(u) ? u : (u?.data ?? []));
    });
  }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total       = inspections.length;
  const countPend   = inspections.filter((r) => r.result === 'pending').length;
  const countPass   = inspections.filter((r) => r.result === 'pass').length;
  const countFail   = inspections.filter((r) => r.result === 'fail').length;

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    form.resetFields();
    form.setFieldsValue({
      type:             'fpi',
      inspection_date:  dayjs(),
    });
    setParams([emptyParam()]);
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        type:            vals.type,
        inspection_date: vals.inspection_date.format('YYYY-MM-DD'),
        work_order_id:   vals.work_order_id   || null,
        item_id:         vals.item_id         || null,
        machine_id:      vals.machine_id      || null,
        inspector_id:    vals.inspector_id    || null,
        notes:           vals.notes           || '',
        results:         params.map(({ _key, ...p }) => p),
      };
      await lqcApi.create(payload);
      message.success('LQC inspection created');
      setDrawerOpen(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const onResult = async (id, result, record) => {
    try {
      await lqcApi.updateResult(id, result);
      message.success(`Result set to ${RESULT_CONFIG[result]?.label || result}`);
      if (record?.type === 'fpi' && record?.WorkOrder?.wo_no) {
        const woNo = record.WorkOrder.wo_no;
        if (result === 'pass') {
          message.info(`Work Order ${woNo} FPI status updated to Pass — production can start`);
        } else if (result === 'fail') {
          message.warning(`Work Order ${woNo} FPI status updated to Fail — production blocked`);
        }
      }
      load();
    } catch (err) { message.error(err?.message || 'Update failed'); }
  };

  const onDelete = async (id) => {
    try {
      await lqcApi.delete(id);
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
    } catch { /* silently ignore — user can add params manually */ }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Inspection No', dataIndex: 'inspection_no', key: 'inspection_no', width: 160,
      render: (no) => <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{no}</Text>,
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type', width: 90,
      render: (t) => {
        const cfg = TYPE_CONFIG[t] || { color: 'default', label: t };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Date', dataIndex: 'inspection_date', key: 'inspection_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Item', key: 'item', width: 160,
      render: (_, r) => r.Item ? (
        <Text style={{ fontSize: 13 }}>{r.Item.name}</Text>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Machine', key: 'machine', width: 120,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Machine?.name || '—'}</Text>,
    },
    {
      title: 'Work Order', key: 'work_order', width: 120,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.WorkOrder?.wo_no || '—'}</Text>,
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
    {
      title: 'AI', key: 'ai_spike', width: 54,
      render: (_, r) => (
        <Tooltip title="AI Spike Analysis">
          <Button
            size="small"
            icon={<BulbOutlined />}
            style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
            onClick={() => openSpikeDrawer(r)}
          />
        </Tooltip>
      ),
    },
    ...(canWrite ? [{
      title: 'Actions', key: 'actions', width: 160,
      render: (_, r) => (
        <Space size={4}>
          {r.result === 'pending' && (
            <>
              <Tooltip title="Pass">
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<CheckOutlined />}
                  style={{ borderColor: '#16a34a', color: '#16a34a' }}
                  onClick={() => onResult(r.id, 'pass', r)}
                />
              </Tooltip>
              <Tooltip title="Fail">
                <Button
                  size="small"
                  danger
                  ghost
                  icon={<CloseOutlined />}
                  onClick={() => onResult(r.id, 'fail', r)}
                />
              </Tooltip>
              <Tooltip title="Conditional">
                <Button
                  size="small"
                  style={{ borderColor: '#d97706', color: '#d97706' }}
                  onClick={() => onResult(r.id, 'conditional', r)}
                >
                  Cond.
                </Button>
              </Tooltip>
            </>
          )}
          {r.result === 'pending' && (
            <Popconfirm
              title="Delete this inspection?"
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
      ),
    }] : []),
  ];

  const tabItems = [
    { key: 'all',       label: 'All'              },
    { key: 'fpi',       label: 'FPI'              },
    { key: 'hourly',    label: 'Hourly'           },
    { key: 'lpi',       label: 'LPI'              },
    { key: 'tool_wear', label: '⚙ Tool Wear Trend' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>LQC</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>LQC — In-Process Inspection</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Record First Piece Inspection (FPI), hourly checks, and Last Piece Inspection (LPI) to catch defects on the line.
      </Text>

      {/* Stat chips */}
      {activeTab !== 'tool_wear' ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
          <Tag color="blue">Total: {total}</Tag>
          <Tag color="orange">Pending: {countPend}</Tag>
          <Tag color="green">Pass: {countPass}</Tag>
          <Tag color="red">Fail: {countFail}</Tag>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }} />
      )}

      {/* ── Tab bar (shared) ─────────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
        bodyStyle={{ padding: 0 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ padding: '0 20px' }}
          tabBarStyle={{ marginBottom: 0 }}
        />
      </Card>

      {/* ── Inspection list (not tool_wear) ─────────────────────────────────── */}
      {activeTab !== 'tool_wear' && (
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search inspection no..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220, borderRadius: 8 }}
              allowClear
            />
            <DatePicker
              placeholder="From date"
              value={dateFrom}
              onChange={setDateFrom}
              format="DD MMM YYYY"
              style={{ width: 140 }}
            />
            <DatePicker
              placeholder="To date"
              value={dateTo}
              onChange={setDateTo}
              format="DD MMM YYYY"
              style={{ width: 140 }}
            />
            <Select
              placeholder="Result"
              allowClear
              value={resultFilter}
              onChange={setResultFilter}
              options={Object.entries(RESULT_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
              style={{ width: 140 }}
            />
            <div style={{ flex: 1 }} />
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                New Inspection
              </Button>
            )}
          </div>

          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={inspections}
            size="small"
            scroll={{ x: 1300 }}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          />
        </Card>
      )}

      {/* ── Tool Wear Trend Panel (LQC-003) ──────────────────────────────────── */}
      {activeTab === 'tool_wear' && (
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <Text style={{ fontWeight: 600, fontSize: 14 }}>Dimensional Trend Analysis</Text>
            <div style={{ flex: 1 }} />
            <Select
              showSearch
              placeholder="Filter by Machine"
              allowClear
              value={twMachineId}
              onChange={setTwMachineId}
              optionFilterProp="label"
              options={machines.map((m) => ({ value: m.id, label: m.name }))}
              style={{ width: 200 }}
            />
            <Select
              showSearch
              placeholder="Filter by Item"
              allowClear
              value={twItemId}
              onChange={setTwItemId}
              optionFilterProp="label"
              options={items.map((i) => ({ value: i.id, label: i.code ? `${i.name} (${i.code})` : i.name }))}
              style={{ width: 220 }}
            />
            <Button icon={<ReloadOutlined />} onClick={loadTrend} loading={trendLoading}>
              Refresh
            </Button>
          </div>

          {!twMachineId && !twItemId && (
            <Alert
              type="info"
              message="Select a machine or item to view dimensional trend data"
              showIcon
            />
          )}

          {(twMachineId || twItemId) && (
            <Spin spinning={trendLoading}>
              {trendData ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    {trendData.machine && (
                      <Tag color="blue">{trendData.machine.name}</Tag>
                    )}
                    {trendData.item && (
                      <Tag color="purple">{trendData.item.name} ({trendData.item.code})</Tag>
                    )}
                    <Tag>Inspections analysed: {trendData.total_inspections}</Tag>
                  </div>

                  {(!trendData.parameters || trendData.parameters.length === 0) && (
                    <Alert
                      type="warning"
                      message="No dimensional data found. Ensure inspections have numeric actual values recorded."
                      showIcon
                    />
                  )}

                  {(trendData.parameters || []).map((param) => (
                    <Card
                      key={param.parameter_name}
                      size="small"
                      style={{
                        marginBottom: 12,
                        border: param.warn ? '1px solid #fca5a5' : '1px solid #e8eaed',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Text style={{ fontWeight: 600, fontSize: 13 }}>{param.parameter_name}</Text>
                        {param.specification && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Spec: {param.specification}
                          </Text>
                        )}
                        <div style={{ flex: 1 }} />
                        {param.trend_direction === 'increasing' && (
                          <Tag color="red" icon={<ArrowUpOutlined />}>Increasing</Tag>
                        )}
                        {param.trend_direction === 'decreasing' && (
                          <Tag color="orange" icon={<ArrowDownOutlined />}>Decreasing</Tag>
                        )}
                        {param.trend_direction === 'stable' && (
                          <Tag color="green" icon={<MinusOutlined />}>Stable</Tag>
                        )}
                        {param.warn && (
                          <Tag color="red" icon={<WarningOutlined />}>Alert</Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {param.readings?.length} readings
                        </Text>
                      </div>
                      <Table
                        size="small"
                        rowKey={(r, i) => `${r.inspection_no}-${i}`}
                        dataSource={param.readings || []}
                        pagination={false}
                        scroll={{ x: 500 }}
                        columns={[
                          {
                            title: 'Inspection No', dataIndex: 'inspection_no', width: 160,
                            render: (v) => (
                              <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 12 }}>{v}</Text>
                            ),
                          },
                          {
                            title: 'Date', dataIndex: 'inspection_date', width: 130,
                            render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
                          },
                          {
                            title: 'Actual Value', dataIndex: 'actual_value', width: 120,
                            render: (v) => <Text style={{ fontWeight: 600 }}>{v}</Text>,
                          },
                          {
                            title: 'Result', dataIndex: 'result', width: 90,
                            render: (r) => (
                              <Tag
                                color={r === 'pass' ? 'green' : r === 'fail' ? 'red' : 'orange'}
                                style={{ fontSize: 11 }}
                              >
                                {r}
                              </Tag>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  ))}
                </>
              ) : (
                !trendLoading && (
                  <Alert type="info" message="Click Refresh to load trend data" showIcon />
                )
              )}
            </Spin>
          )}
        </Card>
      )}

      {/* ── AI Spike Drawer (per-inspection) ─────────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BulbOutlined style={{ color: '#7c3aed' }} />
            <span>AI Spike Analysis</span>
            {spikeDrawerRecord && (
              <Tag style={{ marginLeft: 4 }}>{spikeDrawerRecord.inspection_no}</Tag>
            )}
          </div>
        }
        open={spikeDrawerOpen}
        onClose={closeSpikeDrawer}
        width={520}
        destroyOnClose
      >
        {spikeDrawerRecord && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {spikeDrawerRecord.Machine?.name && (
                <Tag color="blue">{spikeDrawerRecord.Machine.name}</Tag>
              )}
              {spikeDrawerRecord.Item?.name && (
                <Tag color="purple">{spikeDrawerRecord.Item.name}</Tag>
              )}
              <Tag color={RESULT_CONFIG[spikeDrawerRecord.result]?.color ?? 'default'}>
                {RESULT_CONFIG[spikeDrawerRecord.result]?.label ?? spikeDrawerRecord.result}
              </Tag>
            </div>
          </div>
        )}

        <AiSuggestionCard
          title="Madad AI — Defect Spike Analysis"
          loading={aiSpike.loading}
          error={aiSpike.error}
          aiAvailable={aiSpike.aiAvailable}
          cached={aiSpike.cached}
          onDismiss={closeSpikeDrawer}
          onRetry={() => spikeDrawerRecord && aiSpike.fetch(spikeDrawerRecord.id)}
        >
          {aiSpike.data && (() => {
            // axios interceptor unwraps res.data; ai.api.js then calls .then(r=>r.data)
            // so the hook stores the inner data object directly — no extra .data needed
            const d       = aiSpike.data;
            const insight = parseInsight(d.ai_insight);
            const causes  = insight.likely_causes       ?? [];
            const actions = insight.immediate_actions   ?? [];
            const ALERT_COLOR = { critical: 'red', high: 'orange', medium: 'gold', low: 'green', normal: 'green' };
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Meta tags */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {insight.alert_level && (
                    <Tag color={ALERT_COLOR[insight.alert_level] ?? 'default'} style={{ fontSize: 12 }}>
                      Alert: {insight.alert_level?.toUpperCase()}
                    </Tag>
                  )}
                  {insight.confidence && (
                    <Tag color={{ high: 'green', medium: 'orange', low: 'red' }[insight.confidence] ?? 'default'} style={{ fontSize: 12 }}>
                      Confidence: {insight.confidence}
                    </Tag>
                  )}
                  <Tag
                    color={d.spike_detected ? 'red' : 'green'}
                    style={{ fontSize: 12 }}
                  >
                    {d.spike_detected ? '⚠ Spike Detected' : '✓ No Spike'}
                  </Tag>
                  {d.spike_severity && d.spike_detected && (
                    <Tag color={ALERT_COLOR[d.spike_severity] ?? 'default'} style={{ fontSize: 12 }}>
                      Severity: {d.spike_severity}
                    </Tag>
                  )}
                </div>

                {/* Fail rate comparison */}
                {(d.current_fail_rate != null || d.avg_fail_rate != null) && (
                  <div style={{
                    display: 'flex', gap: 24, padding: '8px 12px',
                    background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb',
                  }}>
                    {d.current_fail_rate != null && (
                      <div>
                        <Text style={{ fontSize: 11, color: '#6b7280' }}>This Inspection</Text>
                        <div style={{ fontSize: 18, fontWeight: 700, color: d.current_fail_rate > d.avg_fail_rate ? '#dc2626' : '#16a34a' }}>
                          {d.current_fail_rate}%
                        </div>
                      </div>
                    )}
                    {d.avg_fail_rate != null && (
                      <div>
                        <Text style={{ fontSize: 11, color: '#6b7280' }}>Rolling Avg ({d.history_count ?? '?'} inspections)</Text>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>
                          {d.avg_fail_rate}%
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Spike assessment */}
                {insight.spike_assessment && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Assessment</Text>
                    <div style={{
                      marginTop: 4, padding: '8px 12px', background: '#fff',
                      borderRadius: 6, border: '1px solid #dbeafe',
                      fontSize: 13, color: '#1e40af', lineHeight: 1.6,
                    }}>
                      {insight.spike_assessment}
                    </div>
                  </div>
                )}

                {/* Likely causes */}
                {causes.length > 0 && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Likely Causes</Text>
                    <div style={{
                      marginTop: 4, padding: '8px 12px', background: '#fff',
                      borderRadius: 6, border: '1px solid #fef3c7',
                    }}>
                      {causes.map((c, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#92400e', lineHeight: 1.7 }}>
                          {i + 1}. {c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Immediate actions */}
                {actions.length > 0 && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Immediate Actions</Text>
                    <div style={{
                      marginTop: 4, padding: '8px 12px', background: '#fff',
                      borderRadius: 6, border: '1px solid #dcfce7',
                    }}>
                      {actions.map((a, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#166534', lineHeight: 1.7 }}>
                          {i + 1}. {a}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Escalate / Hold banners */}
                {insight.escalate_to_supervisor && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Escalate to Supervisor"
                    description="This spike warrants supervisor review."
                  />
                )}
                {insight.hold_production && (
                  <Alert
                    type="error"
                    showIcon
                    message="Hold Production Recommended"
                    description="AI recommends halting production on this machine/part until root cause is identified."
                  />
                )}

                {/* History context */}
                {d.history_summary && (
                  <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>History Context</Text>
                    <div style={{
                      marginTop: 4, padding: '8px 12px', background: '#f9fafb',
                      borderRadius: 6, border: '1px solid #e5e7eb',
                      fontSize: 12, color: '#6b7280', lineHeight: 1.6,
                    }}>
                      {d.history_summary}
                    </div>
                  </div>
                )}

                {d.ai_error && (
                  <Text type="secondary" style={{ fontSize: 12 }}>AI note: {d.ai_error}</Text>
                )}
              </div>
            );
          })()}
        </AiSuggestionCard>
      </Drawer>

      {/* ── Create Drawer ──────────────────────────────────────────────────── */}
      <Drawer
        title="New LQC Inspection"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            {canWrite && (
              <Button type="primary" loading={saving} onClick={onSave}>
                Create Inspection
              </Button>
            )}
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="Inspection Type" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="fpi">FPI</Radio.Button>
              <Radio.Button value="hourly">Hourly</Radio.Button>
              <Radio.Button value="lpi">LPI</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="inspection_date"
                label="Inspection Date"
                rules={[{ required: true, message: 'Select date' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="work_order_id" label="Work Order">
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
              <Form.Item name="item_id" label="Item">
                <Select
                  showSearch
                  placeholder="Select item"
                  optionFilterProp="label"
                  options={items.map((i) => ({
                    value: i.id,
                    label: `${i.name}${i.code ? ` (${i.code})` : ''}`,
                  }))}
                  allowClear
                  onChange={onItemSelect}
                />
              </Form.Item>
            </Col>
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
          </Row>

          <Form.Item name="inspector_id" label="Inspector">
            <Select
              showSearch
              placeholder="Select inspector"
              optionFilterProp="label"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              allowClear
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Observations, notes…" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Inspection Parameters
          </Divider>

          {/* Parameter grid header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px 28px', gap: 6, marginBottom: 6 }}>
            {['Parameter Name', 'Specification', 'Actual Value', 'Result', ''].map((h) => (
              <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
            ))}
          </div>

          {params.map((row) => (
            <div
              key={row._key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 100px 28px',
                gap: 6,
                marginBottom: 8,
                alignItems: 'center',
              }}
            >
              <Input
                size="small"
                placeholder="e.g. Diameter"
                value={row.parameter_name}
                onChange={(e) => updateParam(row._key, 'parameter_name', e.target.value)}
              />
              <Input
                size="small"
                placeholder="e.g. 10±0.05mm"
                value={row.specification}
                onChange={(e) => updateParam(row._key, 'specification', e.target.value)}
              />
              <Input
                size="small"
                placeholder="Actual"
                value={row.actual_value}
                onChange={(e) => updateParam(row._key, 'actual_value', e.target.value)}
              />
              <Select
                size="small"
                value={row.result}
                onChange={(v) => updateParam(row._key, 'result', v)}
                options={[
                  { value: 'pass', label: 'Pass' },
                  { value: 'fail', label: 'Fail' },
                ]}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => removeParam(row._key)}
                disabled={params.length === 1}
              />
            </div>
          ))}

          <Button
            type="dashed"
            onClick={addParam}
            icon={<PlusCircleOutlined />}
            style={{ width: '100%', marginTop: 4 }}
          >
            Add Parameter
          </Button>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
