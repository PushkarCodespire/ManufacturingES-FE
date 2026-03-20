import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Tag, Typography, Row, Col, Space, Table, Tabs,
  Progress, Tooltip, Badge, Select, Statistic, message,
  Alert, Empty, Spin,
} from 'antd';
import {
  RobotOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, WarningOutlined, ThunderboltOutlined,
  CalendarOutlined, ToolOutlined, RightOutlined, ArrowUpOutlined,
  ArrowDownOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { maintenanceAiApi, equipmentApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;

/* ── helpers ─────────────────────────────────────────────────────────────── */
const sevColor  = { high: 'red', medium: 'orange', low: 'blue' };
const sevIcon   = { high: <ExclamationCircleOutlined />, medium: <WarningOutlined />, low: <CheckCircleOutlined /> };
const actionColor = { tighten: 'red', scheduling_issue: 'orange', extend: 'green', maintain: 'blue' };
const actionLabel = { tighten: 'Tighten', scheduling_issue: 'Sched. Issue', extend: 'Extend', maintain: 'Maintain' };
const critColor = { A: '#dc2626', B: '#d97706', C: '#2563eb' };

function scoreBar(val, total = 1) {
  const pct = Math.round((val / total) * 100);
  return <Progress percent={pct} size="small" showInfo={false} strokeColor={pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'} />;
}

/* ── Tab 1: Smart PM Schedule ────────────────────────────────────────────── */
function SmartScheduleTab() {
  const [data, setData]       = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await maintenanceAiApi.getSmartSchedule();
      setData(Array.isArray(res) ? res : (res?.data ?? []));
      setSummary(res?.summary ?? null);
    } catch { message.error('Failed to load smart schedule'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cols = [
    {
      title: 'WO #', dataIndex: 'wo_number', width: 120,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>{v}</Text>
          {r.is_overdue && <Tag color="red" style={{ fontSize: 10, padding: '0 4px' }}>OVERDUE</Tag>}
        </Space>
      ),
    },
    {
      title: 'Equipment', dataIndex: 'equipment_name', ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{v}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.equipment_code}</Text>
        </Space>
      ),
    },
    {
      title: 'Crit.', dataIndex: 'criticality', width: 56, align: 'center',
      render: (v) => <Tag color={critColor[v] ?? 'default'} style={{ fontWeight: 700 }}>{v}</Tag>,
    },
    {
      title: 'Priority Score', dataIndex: 'composite_score', width: 160,
      render: (v, r) => (
        <Tooltip title={
          <div style={{ fontSize: 11 }}>
            <div>Production gap: {(r.score_breakdown?.production_gap * 100).toFixed(0)}%</div>
            <div>Equipment risk: {(r.score_breakdown?.equipment_risk * 100).toFixed(0)}%</div>
            <div>Tech load: {(r.score_breakdown?.technician_load * 100).toFixed(0)}%</div>
            <div>Parts ready: {(r.score_breakdown?.parts_readiness * 100).toFixed(0)}%</div>
          </div>
        }>
          <div>
            <Progress percent={Math.round(v * 100)} size="small"
              strokeColor={v >= 0.7 ? '#dc2626' : v >= 0.4 ? '#d97706' : '#16a34a'}
              format={(p) => <Text style={{ fontSize: 11 }}>{p}%</Text>} />
          </div>
        </Tooltip>
      ),
      sorter: (a, b) => b.composite_score - a.composite_score,
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Rec. Date', dataIndex: 'recommended_date', width: 110,
      render: (v) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Planned Date', dataIndex: 'planned_date', width: 110,
      render: (v) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text>,
    },
    {
      title: '', width: 80,
      render: (_, r) => (
        <Space>
          {r.batch_eligible && <Tooltip title="Batch eligible"><Tag color="purple" style={{ fontSize: 10, padding: '0 4px' }}>BATCH</Tag></Tooltip>}
          {!r.parts_ready && <Tooltip title="Spare parts not fully stocked"><Tag color="orange" style={{ fontSize: 10, padding: '0 4px' }}>PARTS</Tag></Tooltip>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {summary && (
        <Row gutter={12} style={{ marginBottom: 16 }}>
          {[
            { label: 'Open WOs', value: summary.total_open_wos, icon: <CalendarOutlined />, color: '#1d4ed8' },
            { label: 'Overdue', value: summary.overdue_count, icon: <ExclamationCircleOutlined />, color: '#dc2626' },
            { label: 'Parts Not Ready', value: summary.parts_not_ready, icon: <WarningOutlined />, color: '#d97706' },
            { label: 'Batch Groups', value: summary.batch_groups?.length ?? 0, icon: <ToolOutlined />, color: '#7c3aed' },
          ].map((s) => (
            <Col key={s.label} xs={12} sm={6}>
              <Card size="small" style={{ borderRadius: 10, border: '1px solid #e8eaed' }} bodyStyle={{ padding: '10px 14px' }}>
                <Statistic title={s.label} value={s.value} prefix={s.icon}
                  valueStyle={{ color: s.color, fontSize: 22 }} />
              </Card>
            </Col>
          ))}
        </Row>
      )}
      {summary?.batch_groups?.length > 0 && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12, borderRadius: 8 }}
          message={`${summary.batch_groups.length} batch opportunit${summary.batch_groups.length === 1 ? 'y' : 'ies'}: ${summary.batch_groups.map((g) => g.equipment).join(' · ')}`}
        />
      )}
      <Table
        columns={cols} dataSource={data} rowKey="wo_id"
        loading={loading} size="small" pagination={{ pageSize: 15 }}
        rowClassName={(r) => r.is_overdue ? 'ant-table-row-overdue' : ''}
      />
    </div>
  );
}

/* ── Tab 2: Failure Patterns ─────────────────────────────────────────────── */
function FailurePatternsTab() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await maintenanceAiApi.getFailurePatterns();
      setData(Array.isArray(res) ? res : []);
    } catch { message.error('Failed to load failure patterns'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cols = [
    {
      title: 'Equipment', dataIndex: 'equipment_name', ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.equipment_code}</Text>
        </Space>
      ),
    },
    {
      title: 'Crit.', dataIndex: 'equipment_criticality', width: 56, align: 'center',
      render: (v) => v ? <Tag color={critColor[v]}>{v}</Tag> : '—',
    },
    {
      title: 'Failure Mode', dataIndex: 'failure_name',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{v}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.failure_category} · {r.typical_cause}</Text>
        </Space>
      ),
    },
    {
      title: 'Severity', dataIndex: 'severity', width: 90, align: 'center',
      render: (v) => <Tag color={sevColor[v]} icon={sevIcon[v]}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Occurrences (90d)', dataIndex: 'occurrences_90d', width: 130, align: 'center',
      render: (v) => <Badge count={v} color="#1d4ed8" overflowCount={99} />,
      sorter: (a, b) => b.occurrences_90d - a.occurrences_90d,
    },
    {
      title: 'Avg Interval', dataIndex: 'avg_interval_days', width: 110, align: 'center',
      render: (v, r) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'center' }}>
          <Text style={{ fontSize: 13 }}>{v}d</Text>
          {r.is_periodic && <Tag color="purple" style={{ fontSize: 10, padding: '0 4px' }}>PERIODIC</Tag>}
        </Space>
      ),
    },
    {
      title: 'Recommendation', dataIndex: 'recommendation', ellipsis: true,
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
  ];

  return (
    <div>
      {data.length === 0 && !loading && (
        <Empty description="No recurring failure patterns detected in the last 90 days" />
      )}
      <Table columns={cols} dataSource={data} rowKey={(r) => `${r.equipment_id}-${r.failure_code_id}`}
        loading={loading} size="small" pagination={{ pageSize: 15 }} />
    </div>
  );
}

/* ── Tab 3: PM Optimization ──────────────────────────────────────────────── */
function PmOptimizationTab() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await maintenanceAiApi.getPmOptimization();
      setData(Array.isArray(res) ? res : []);
    } catch { message.error('Failed to load PM optimization'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cols = [
    {
      title: 'Equipment', dataIndex: 'equipment_name', ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.equipment_code} · {r.template_name}</Text>
        </Space>
      ),
    },
    {
      title: 'Crit.', dataIndex: 'equipment_criticality', width: 56, align: 'center',
      render: (v) => v ? <Tag color={critColor[v]}>{v}</Tag> : '—',
    },
    {
      title: 'Recommendation', dataIndex: 'action', width: 130, align: 'center',
      render: (v) => <Tag color={actionColor[v]} style={{ fontWeight: 600 }}>{actionLabel[v] ?? v}</Tag>,
      filters: Object.entries(actionLabel).map(([value, text]) => ({ value, text })),
      onFilter: (v, r) => r.action === v,
    },
    {
      title: 'Current Interval', dataIndex: 'current_interval_days', width: 120, align: 'center',
      render: (v, r) => <Text>{v}d ({r.current_frequency_type})</Text>,
    },
    {
      title: 'Suggested Interval', dataIndex: 'suggested_interval_days', width: 130, align: 'center',
      render: (v, r) => {
        const diff = v - r.current_interval_days;
        return (
          <Space>
            <Text style={{ fontWeight: diff !== 0 ? 700 : 400, color: diff < 0 ? '#dc2626' : diff > 0 ? '#16a34a' : undefined }}>{v}d</Text>
            {diff !== 0 && (diff < 0 ? <ArrowDownOutlined style={{ color: '#dc2626', fontSize: 11 }} /> : <ArrowUpOutlined style={{ color: '#16a34a', fontSize: 11 }} />)}
          </Space>
        );
      },
    },
    {
      title: 'PM Compliance', dataIndex: 'pm_compliance_pct', width: 130,
      render: (v) => <Progress percent={v} size="small" strokeColor={v >= 80 ? '#16a34a' : v >= 60 ? '#d97706' : '#dc2626'} />,
    },
    {
      title: 'Breakdowns (6m)', dataIndex: 'breakdowns_6m', width: 120, align: 'center',
      render: (v) => <Badge count={v} color={v > 3 ? '#dc2626' : v > 0 ? '#d97706' : '#16a34a'} showZero />,
    },
    {
      title: 'Reason', dataIndex: 'reason', ellipsis: true,
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
  ];

  return (
    <Table columns={cols} dataSource={data} rowKey="schedule_id"
      loading={loading} size="small" pagination={{ pageSize: 15 }} />
  );
}

/* ── Tab 4: Downtime Analysis ────────────────────────────────────────────── */
function DowntimeAnalysisTab() {
  const [data, setData]       = useState(null);
  const [days, setDays]       = useState(90);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d) => {
    setLoading(true);
    try {
      const res = await maintenanceAiApi.getDowntimePatterns(d);
      setData(res);
    } catch { message.error('Failed to load downtime patterns'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  const maxHrMin  = data ? Math.max(1, ...data.by_hour.map((h) => h.minutes)) : 1;
  const maxDayMin = data ? Math.max(1, ...data.by_day.map((d) => d.minutes)) : 1;

  const topEquipCols = [
    {
      title: 'Equipment', dataIndex: 'equipment_name',
      render: (v, r) => <Space direction="vertical" size={0}><Text strong style={{ fontSize: 13 }}>{v}</Text><Text type="secondary" style={{ fontSize: 11 }}>{r.equipment_code}</Text></Space>,
    },
    { title: 'Crit.', dataIndex: 'criticality', width: 56, align: 'center', render: (v) => v ? <Tag color={critColor[v]}>{v}</Tag> : '—' },
    { title: 'Events', dataIndex: 'event_count', width: 80, align: 'center', render: (v) => <Badge count={v} color="#1d4ed8" /> },
    { title: 'Total Downtime', dataIndex: 'total_minutes', width: 130, render: (v) => <Text>{(v / 60).toFixed(1)} hrs ({v} min)</Text> },
  ];

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Text strong>Period:</Text>
        <Select value={days} onChange={(v) => { setDays(v); load(v); }} style={{ width: 130 }}
          options={[{ value: 30, label: 'Last 30 days' }, { value: 60, label: 'Last 60 days' }, { value: 90, label: 'Last 90 days' }, { value: 180, label: 'Last 6 months' }]} />
        {data && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {data.total_events} events · {(data.total_unplanned_minutes / 60).toFixed(1)} hrs total unplanned downtime
            {data.worst_day && ` · Most on ${data.worst_day.day_name}`}
          </Text>
        )}
      </div>

      {data && (
        <Row gutter={16}>
          {/* By-hour heatmap bar */}
          <Col span={24} style={{ marginBottom: 16 }}>
            <Card size="small" title="Unplanned Downtime by Hour of Day" style={{ borderRadius: 10, border: '1px solid #e8eaed' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, padding: '4px 0' }}>
                {data.by_hour.map((h) => {
                  const pct = (h.minutes / maxHrMin) * 100;
                  const isPeak = data.peak_hours?.includes(h.hour);
                  return (
                    <Tooltip key={h.hour} title={`${h.label}: ${h.minutes} min (${h.events} events)`}>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '100%', background: isPeak ? '#dc2626' : '#bfdbfe', borderRadius: '3px 3px 0 0', height: `${Math.max(2, pct)}%`, minHeight: pct > 0 ? 3 : 1 }} />
                        {h.hour % 4 === 0 && <Text style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{h.hour}h</Text>}
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
              {data.peak_hours?.length > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ExclamationCircleOutlined style={{ color: '#dc2626', marginRight: 4 }} />
                  Peak hours: {data.peak_hours.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ')}
                </Text>
              )}
            </Card>
          </Col>

          {/* By-day */}
          <Col xs={24} md={10} style={{ marginBottom: 16 }}>
            <Card size="small" title="Downtime by Day of Week" style={{ borderRadius: 10, border: '1px solid #e8eaed' }}>
              {data.by_day.map((d) => (
                <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Text style={{ width: 36, fontSize: 12, color: '#6b7280' }}>{d.day_name.slice(0, 3)}</Text>
                  <div style={{ flex: 1 }}>
                    <Progress
                      percent={Math.round((d.minutes / maxDayMin) * 100)}
                      size="small" showInfo={false}
                      strokeColor={d.day === data.worst_day?.day ? '#dc2626' : '#3b82f6'}
                    />
                  </div>
                  <Text style={{ fontSize: 11, width: 60, textAlign: 'right', color: '#374151' }}>
                    {(d.minutes / 60).toFixed(1)}h
                  </Text>
                </div>
              ))}
            </Card>
          </Col>

          {/* Top equipment */}
          <Col xs={24} md={14} style={{ marginBottom: 16 }}>
            <Card size="small" title="Top Equipment by Downtime" style={{ borderRadius: 10, border: '1px solid #e8eaed' }}>
              {data.top_equipment.length === 0
                ? <Empty description="No unplanned downtime recorded" />
                : <Table columns={topEquipCols} dataSource={data.top_equipment} rowKey="equipment_id" size="small" pagination={false} />
              }
            </Card>
          </Col>
        </Row>
      )}
    </Spin>
  );
}

/* ── Tab 5: Spare Part Anomalies ─────────────────────────────────────────── */
function SpareAnomaliesTab() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await maintenanceAiApi.getSparePartAnomalies();
      setData(Array.isArray(res) ? res : []);
    } catch { message.error('Failed to load spare part anomalies'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cols = [
    {
      title: 'Part', dataIndex: 'name',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.part_code} · {r.unit_of_measure}</Text>
        </Space>
      ),
    },
    {
      title: 'Recent 30d', dataIndex: 'recent_30d', width: 110, align: 'center',
      render: (v, r) => <Text strong style={{ color: '#dc2626' }}>{v} {r.unit_of_measure}</Text>,
    },
    {
      title: 'Monthly Avg', dataIndex: 'monthly_avg', width: 110, align: 'center',
      render: (v, r) => <Text>{v} {r.unit_of_measure}</Text>,
    },
    {
      title: 'Spike Ratio', dataIndex: 'ratio', width: 110, align: 'center',
      render: (v) => <Tag color={v >= 4 ? 'red' : 'orange'} style={{ fontWeight: 700 }}>{v}×</Tag>,
      sorter: (a, b) => b.ratio - a.ratio,
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Current Stock', dataIndex: 'current_stock', width: 120, align: 'center',
      render: (v, r) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'center' }}>
          <Text>{v}</Text>
          {v < r.min_stock && <Tag color="red" style={{ fontSize: 10, padding: '0 4px' }}>BELOW MIN</Tag>}
        </Space>
      ),
    },
    {
      title: 'Min Stock', dataIndex: 'min_stock', width: 90, align: 'center',
    },
  ];

  return (
    <div>
      {data.length > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12, borderRadius: 8 }}
          message={`${data.length} spare part${data.length === 1 ? '' : 's'} consuming at 2× or more their normal rate — investigate root cause or stock up.`} />
      )}
      {data.length === 0 && !loading && (
        <Alert type="success" showIcon style={{ borderRadius: 8 }}
          message="No consumption anomalies detected. All spare parts are within normal usage ranges." />
      )}
      <Table columns={cols} dataSource={data} rowKey="spare_part_id"
        loading={loading} size="small" pagination={{ pageSize: 15 }} />
    </div>
  );
}

/* ── Tab 6: Spare Demand Forecast ────────────────────────────────────────── */
function SpareForecastTab() {
  const [equipment, setEquipment] = useState([]);
  const [equipId, setEquipId]     = useState(null);
  const [forecast, setForecast]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [equipLoading, setEquipLoading] = useState(false);

  useEffect(() => {
    setEquipLoading(true);
    equipmentApi.getAll({ limit: 200 })
      .then((res) => setEquipment(Array.isArray(res) ? res : (res?.rows ?? [])))
      .catch(() => {})
      .finally(() => setEquipLoading(false));
  }, []);

  const load = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await maintenanceAiApi.getSpareDemandForecast(id);
      // NOTE: getSpareDemandForecast returns full axios response to preserve summary
      const body = res?.data ?? res;
      setForecast({ data: body?.data ?? [], summary: body?.summary ?? null });
    } catch { message.error('Failed to load spare demand forecast'); }
    finally { setLoading(false); }
  }, []);

  const actionColor2 = { stock_up: 'red', monitor: 'orange', adequate: 'green', no_consumption_history: 'default' };
  const actionLabel2 = { stock_up: 'Stock Up', monitor: 'Monitor', adequate: 'Adequate', no_consumption_history: 'No History' };

  const cols = [
    {
      title: 'Part', dataIndex: 'part_name',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.part_code} · {r.unit_of_measure}</Text>
        </Space>
      ),
    },
    { title: 'Action', dataIndex: 'action', width: 110, align: 'center', render: (v) => <Tag color={actionColor2[v]}>{actionLabel2[v] ?? v}</Tag> },
    { title: 'Current Stock', dataIndex: 'current_stock', width: 110, align: 'center' },
    { title: '3-Month Forecast', dataIndex: 'forecast_3m', width: 130, align: 'center', render: (v) => <Text strong>{v}</Text> },
    {
      title: 'Shortfall', dataIndex: 'shortfall', width: 100, align: 'center',
      render: (v) => v > 0 ? <Text strong style={{ color: '#dc2626' }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    { title: 'Monthly Avg', dataIndex: 'monthly_avg', width: 100, align: 'center' },
    {
      title: 'Replenishment Cost', dataIndex: 'replenishment_cost', width: 150, align: 'right',
      render: (v) => v ? <Text strong>₹{v.toLocaleString()}</Text> : <Text type="secondary">—</Text>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Text strong>Equipment:</Text>
        <Select
          showSearch loading={equipLoading} placeholder="Select equipment…"
          style={{ width: 300 }} value={equipId}
          onChange={(v) => { setEquipId(v); load(v); }}
          filterOption={(input, opt) => opt.label?.toLowerCase().includes(input.toLowerCase())}
          options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
        />
      </div>

      {!equipId && <Empty description="Select equipment to view 3-month spare parts demand forecast" />}

      {forecast && (
        <>
          {forecast.summary && (
            <Row gutter={12} style={{ marginBottom: 14 }}>
              {[
                { label: 'Parts in BOM', value: forecast.summary.parts_count },
                { label: 'Need Stock Up', value: forecast.summary.stock_up_count, color: forecast.summary.stock_up_count > 0 ? '#dc2626' : undefined },
                { label: 'Age Factor', value: forecast.summary.age_factor + '×' },
                { label: 'Replenishment Cost', value: `₹${(forecast.summary.total_replenishment_cost || 0).toLocaleString()}` },
              ].map((s) => (
                <Col key={s.label} xs={12} sm={6}>
                  <Card size="small" style={{ borderRadius: 10, border: '1px solid #e8eaed' }} bodyStyle={{ padding: '10px 14px' }}>
                    <Statistic title={s.label} value={s.value} valueStyle={{ fontSize: 20, color: s.color }} />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
          <Table columns={cols} dataSource={forecast.data} rowKey="spare_part_id"
            loading={loading} size="small" pagination={{ pageSize: 15 }} />
        </>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function MaintenanceAiInsightsPage() {
  const [activeTab, setActiveTab] = useState('smart-schedule');

  const tabItems = [
    {
      key: 'smart-schedule',
      label: (
        <span><ThunderboltOutlined style={{ marginRight: 4 }} />Smart PM Schedule</span>
      ),
      children: <SmartScheduleTab />,
    },
    {
      key: 'failure-patterns',
      label: (
        <span><ExclamationCircleOutlined style={{ marginRight: 4 }} />Failure Patterns</span>
      ),
      children: <FailurePatternsTab />,
    },
    {
      key: 'pm-optimization',
      label: (
        <span><ToolOutlined style={{ marginRight: 4 }} />PM Optimization</span>
      ),
      children: <PmOptimizationTab />,
    },
    {
      key: 'downtime-analysis',
      label: (
        <span><BarChartOutlined style={{ marginRight: 4 }} />Downtime Analysis</span>
      ),
      children: <DowntimeAnalysisTab />,
    },
    {
      key: 'spare-anomalies',
      label: (
        <span><WarningOutlined style={{ marginRight: 4 }} />Spare Anomalies</span>
      ),
      children: <SpareAnomaliesTab />,
    },
    {
      key: 'spare-forecast',
      label: (
        <span><CalendarOutlined style={{ marginRight: 4 }} />Demand Forecast</span>
      ),
      children: <SpareForecastTab />,
    },
  ];

  return (
    <AppLayout>
      <div style={{ padding: '0 0 24px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Maintenance</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>AI Insights</Text>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <RobotOutlined style={{ fontSize: 22, color: '#1d4ed8' }} />
          <Title level={3} style={{ margin: 0 }}>AI Insights</Title>
        </div>
        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
          Rule-based and pattern-detection intelligence across PM scheduling, failure analysis, spare parts, and downtime.
        </Text>

        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '4px 20px 20px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="small"
          />
        </Card>
      </div>
    </AppLayout>
  );
}
