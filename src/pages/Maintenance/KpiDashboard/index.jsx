import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Tag, Space, Typography, Row, Col, Statistic,
  Progress, Table, Divider, message, DatePicker, Tabs,
} from 'antd';
import {
  ReloadOutlined, ToolOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, DollarOutlined, ClockCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { maintenanceKpiApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function healthColor(val, good, warn) {
  if (val >= good) return '#16a34a';
  if (val >= warn) return '#d97706';
  return '#dc2626';
}

export default function KpiDashboardPage() {
  const [summary, setSummary]       = useState(null);
  const [mtbf, setMtbf]             = useState([]);
  const [mttr, setMttr]             = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [costReport, setCostReport] = useState({ data: [], summary: [] });
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState('summary');
  const [dateRange, setDateRange]   = useState([]);

  const buildParams = () => {
    const params = {};
    if (dateRange[0]) params.from = dateRange[0].format('YYYY-MM-DD');
    if (dateRange[1]) params.to   = dateRange[1].format('YYYY-MM-DD');
    return params;
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const params = buildParams();

    // Run all calls independently so one failure doesn't blank the whole page
    const [sumRes, mtbfRes, mttrRes, compRes, costRes] = await Promise.allSettled([
      maintenanceKpiApi.getDashboard(params),
      maintenanceKpiApi.getMtbf(params),
      maintenanceKpiApi.getMttr(params),
      maintenanceKpiApi.getPmCompliance(params),
      maintenanceKpiApi.getCostReport(params),
    ]);

    // Helper to extract value or log the real server error
    const unwrap = (result, label) => {
      if (result.status === 'fulfilled') return result.value;
      const errMsg = result.reason?.message || result.reason?.error || JSON.stringify(result.reason);
      console.error(`[KPI] ${label} failed:`, result.reason);
      message.error(`KPI ${label}: ${errMsg}`);
      return null;
    };

    const sumData  = unwrap(sumRes,  'Dashboard');
    const mtbfData = unwrap(mtbfRes, 'MTBF');
    const mttrData = unwrap(mttrRes, 'MTTR');
    const compData = unwrap(compRes, 'PM Compliance');
    const costData = unwrap(costRes, 'Cost Report');

    // After axios interceptor success path returns res.data (the JSON body)
    if (sumData  !== null) setSummary(sumData);
    if (mtbfData !== null) setMtbf(Array.isArray(mtbfData) ? mtbfData : (mtbfData?.data ?? []));
    if (mttrData !== null) setMttr(Array.isArray(mttrData) ? mttrData : (mttrData?.data ?? []));
    if (compData !== null) setCompliance(Array.isArray(compData) ? compData : (compData?.data ?? []));
    // getCostReport returns full body { data: rows[], summary: [...] } (no .data strip in API)
    if (costData !== null) setCostReport({ data: costData?.data || [], summary: costData?.summary || [] });

    setLoading(false);
  }, [dateRange]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const mtbfColumns = [
    { title: 'Equipment', render: (_, r) => <><Text strong>{r.equipment_code}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.name}</Text></> },
    { title: 'Breakdowns', dataIndex: 'breakdown_count', render: (v) => <Tag color={v > 5 ? 'red' : v > 2 ? 'orange' : 'green'}>{v}</Tag> },
    {
      title: 'MTBF (hours)',
      dataIndex: 'mtbf_hours',
      render: (v) => v !== null
        ? <Text strong style={{ color: healthColor(v, 100, 48) }}>{v}h</Text>
        : <Text type="secondary">Insufficient data</Text>,
    },
    {
      title: 'Reliability',
      dataIndex: 'mtbf_hours',
      render: (v) => v !== null
        ? <Progress percent={Math.min(100, Math.round((v / 200) * 100))} strokeColor={healthColor(v, 100, 48)} size="small" style={{ width: 120 }} />
        : '—',
    },
  ];

  const mttrColumns = [
    { title: 'Equipment', render: (_, r) => <><Text strong>{r.equipment_code}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.name}</Text></> },
    { title: 'Repairs', dataIndex: 'repair_count', render: (v) => <Tag>{v}</Tag> },
    {
      title: 'MTTR (hours)',
      dataIndex: 'mttr_hours',
      render: (v) => <Text strong style={{ color: v > 8 ? '#dc2626' : v > 4 ? '#d97706' : '#16a34a' }}>{v}h</Text>,
    },
    {
      title: 'Repair Speed',
      dataIndex: 'mttr_hours',
      render: (v) => <Progress percent={Math.max(0, 100 - Math.round((v / 24) * 100))} strokeColor={v > 8 ? '#dc2626' : v > 4 ? '#d97706' : '#16a34a'} size="small" style={{ width: 120 }} />,
    },
  ];

  const complianceColumns = [
    { title: 'Equipment', render: (_, r) => <><Text strong>{r.equipment_code}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.name}</Text></> },
    { title: 'PM Due', dataIndex: 'total', render: (v) => <Tag>{v}</Tag> },
    { title: 'On Time', dataIndex: 'onTime', render: (v) => <Tag color="green">{v}</Tag> },
    {
      title: 'Compliance %',
      dataIndex: 'compliance_pct',
      render: (v) => (
        <Space>
          <Progress percent={v} strokeColor={healthColor(v, 80, 60)} size="small" style={{ width: 100 }} />
          <Text strong style={{ color: healthColor(v, 80, 60) }}>{v}%</Text>
        </Space>
      ),
    },
  ];

  const costColumns = [
    { title: 'Equipment', render: (_, r) => <><Text strong>{r.equipment?.equipment_code || '—'}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.equipment?.name}</Text></> },
    { title: 'Total Cost', dataIndex: 'total', render: (v) => <Text strong>${parseFloat(v || 0).toFixed(2)}</Text> },
    {
      title: 'By Type',
      dataIndex: 'byType',
      render: (v) => (
        <Space wrap>
          {Object.entries(v || {}).map(([type, amt]) => (
            <Tag key={type} color={type === 'contract' ? 'purple' : type === 'labor' ? 'blue' : type === 'parts' ? 'orange' : 'default'}>
              {type}: ${parseFloat(amt).toFixed(0)}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><BarChartOutlined /> Maintenance KPI Dashboard</Title>
        <Space wrap>
          <RangePicker onChange={(dates) => setDateRange(dates || [])} />
          <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>Refresh</Button>
        </Space>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={6}>
          <Card>
            <Statistic title="PM Compliance" value={`${summary?.pmCompliance ?? 0}%`}
              valueStyle={{ color: healthColor(summary?.pmCompliance ?? 0, 80, 60) }}
              prefix={<CheckCircleOutlined />}
            />
            <Progress percent={summary?.pmCompliance ?? 0} strokeColor={healthColor(summary?.pmCompliance ?? 0, 80, 60)} size="small" style={{ marginTop: 8 }} />
          </Card>
        </Col>
        <Col xs={6}>
          <Card>
            <Statistic title="Total Breakdowns" value={summary?.totalBreakdowns ?? 0}
              valueStyle={{ color: '#dc2626' }} prefix={<ExclamationCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{summary?.resolvedBreakdowns ?? 0} resolved</Text>
          </Card>
        </Col>
        <Col xs={6}>
          <Card>
            <Statistic title="Downtime Hours" value={summary?.totalDowntimeHours ?? 0}
              valueStyle={{ color: '#d97706' }} prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={6}>
          <Card>
            <Statistic title="Maintenance Cost" value={`$${(summary?.totalCost ?? 0).toFixed(0)}`}
              valueStyle={{ color: '#2563eb' }} prefix={<DollarOutlined />}
            />
            <Space wrap style={{ marginTop: 4 }}>
              {(summary?.costByType || []).map((c) => (
                <Tag key={c.cost_type} style={{ fontSize: 10 }}>{c.cost_type}: ${parseFloat(c.total).toFixed(0)}</Tag>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={6}><Card><Statistic title="Open Corrective WOs" value={summary?.openCorrective ?? 0} valueStyle={{ color: '#2563eb' }} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Open PM WOs" value={summary?.openPm ?? 0} valueStyle={{ color: '#d97706' }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="PM WOs Due" value={summary?.pmTotal ?? 0} /></Card></Col>
        <Col xs={6}><Card><Statistic title="PM WOs Completed" value={summary?.pmCompleted ?? 0} valueStyle={{ color: '#16a34a' }} /></Card></Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'summary',
            label: 'Summary',
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="MTBF — Top 5 Worst" size="small">
                    {mtbf.slice(0, 5).map((eq) => (
                      <div key={eq.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12 }}>{eq.equipment_code} — {eq.name}</Text>
                          <Text strong style={{ color: eq.mtbf_hours ? healthColor(eq.mtbf_hours, 100, 48) : '#888', fontSize: 12 }}>
                            {eq.mtbf_hours ? `${eq.mtbf_hours}h` : 'N/A'}
                          </Text>
                        </div>
                        <Progress percent={eq.mtbf_hours ? Math.min(100, Math.round((eq.mtbf_hours / 200) * 100)) : 0} strokeColor={eq.mtbf_hours ? healthColor(eq.mtbf_hours, 100, 48) : '#d9d9d9'} size="small" showInfo={false} />
                      </div>
                    ))}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="PM Compliance — Worst 5" size="small">
                    {compliance.slice(0, 5).map((eq) => (
                      <div key={eq.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12 }}>{eq.equipment_code} — {eq.name}</Text>
                          <Text strong style={{ color: healthColor(eq.compliance_pct, 80, 60), fontSize: 12 }}>{eq.compliance_pct}%</Text>
                        </div>
                        <Progress percent={eq.compliance_pct} strokeColor={healthColor(eq.compliance_pct, 80, 60)} size="small" showInfo={false} />
                      </div>
                    ))}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'mtbf',
            label: 'MTBF',
            children: <Table columns={mtbfColumns} dataSource={mtbf} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} scroll={{ x: 800 }} />,
          },
          {
            key: 'mttr',
            label: 'MTTR',
            children: <Table columns={mttrColumns} dataSource={mttr} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} scroll={{ x: 800 }} />,
          },
          {
            key: 'compliance',
            label: 'PM Compliance',
            children: <Table columns={complianceColumns} dataSource={compliance} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} scroll={{ x: 800 }} />,
          },
          {
            key: 'cost',
            label: 'Cost Report',
            children: <Table columns={costColumns} dataSource={costReport.summary} rowKey={(r) => r.equipment?.id || 'unknown'} loading={loading} pagination={{ pageSize: 15 }} scroll={{ x: 800 }} />,
          },
        ]}
      />
    </AppLayout>
  );
}
