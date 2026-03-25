import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Typography, Tag, Input, Button, Select,
  Drawer, Row, Col, Progress, Statistic, Tooltip, Space,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, RightOutlined,
} from '@ant-design/icons';
import AppLayout         from '../../../components/AppLayout';
import ResponsiveTable   from '../../../components/ResponsiveTable';
import api               from '../../../api/axios';
import usePermissions    from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option }      = Select;

const fmtMin = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : `${n.toFixed(1)} min`;
};

export default function TimeStandardsPage() {
  const { can } = usePermissions();

  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState('');
  const [filterItem,  setFilterItem]  = useState(undefined);
  const [filterWC,    setFilterWC]    = useState(undefined);
  const [items,       setItems]       = useState([]);
  const [workCenters, setWorkCenters] = useState([]);

  // Drill-down drawer
  const [histDrawer, setHistDrawer] = useState(false);
  const [selStep,    setSelStep]    = useState(null);
  const [history,    setHistory]    = useState([]);
  const [histLoad,   setHistLoad]   = useState(false);

  // Reference data
  useEffect(() => {
    api.get('/items',        { params: { limit: 500 } }).then(d => setItems(d?.data || [])).catch(() => {});
    api.get('/work-centers', { params: { limit: 200 } }).then(d => setWorkCenters(d?.data || [])).catch(() => {});
  }, []);

  // Main data
  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filterItem) params.item_id        = filterItem;
    if (filterWC)   params.work_center_id = filterWC;
    api.get('/routings/steps/time-analysis', { params })
      .then(d => setRows(d?.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [filterItem, filterWC]);

  useEffect(() => { load(); }, [load]);

  const displayed = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.operation_name?.toLowerCase().includes(s) ||
      r.Routing?.name?.toLowerCase().includes(s)  ||
      r.Routing?.Item?.name?.toLowerCase().includes(s)
    );
  });

  const total    = displayed.length;
  const withJobs = displayed.filter(r => r.stats?.job_count > 0).length;
  const avgEff   = (() => {
    const eff = displayed.map(r => r.stats?.efficiency_pct).filter(e => e !== null);
    if (!eff.length) return null;
    return Math.round(eff.reduce((a, b) => a + b, 0) / eff.length);
  })();

  const openHistory = (step) => {
    setSelStep(step);
    setHistDrawer(true);
    setHistLoad(true);
    api.get(`/routings/steps/${step.id}/job-card-history`, { params: { limit: 50 } })
      .then(d => setHistory(d?.data || []))
      .catch(() => setHistory([]))
      .finally(() => setHistLoad(false));
  };

  const columns = [
    { title: 'Step', width: 60, dataIndex: 'step_no', render: v => <Tag color="geekblue">{v}</Tag> },
    {
      title: 'Operation', dataIndex: 'operation_name',
      render: (v, r) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Routing?.name} · {r.Routing?.Item?.name}</Text>
        </div>
      ),
    },
    { title: 'Work Centre', width: 140, dataIndex: ['WorkCenter', 'name'], render: v => v || '—' },
    { title: 'Labor Type',  width: 100, dataIndex: 'labor_type', render: v => <Tag>{v || 'machine'}</Tag> },
    { title: 'Plan Setup',  width: 110, dataIndex: 'setup_time_min', render: fmtMin },
    {
      title: 'Plan Cycle', width: 110, dataIndex: 'cycle_time_min',
      render: v => <Text style={{ color: '#1d4ed8' }}>{fmtMin(v)}</Text>,
    },
    {
      title: 'Avg Actual Cycle', width: 140,
      render: (_, r) => {
        const v = r.stats?.avg_cycle_actual;
        return v ? <Text style={{ color: '#059669' }}>{fmtMin(v)}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Efficiency', width: 130,
      render: (_, r) => {
        const pct = r.stats?.efficiency_pct;
        if (pct === null) return <Text type="secondary">No data</Text>;
        return (
          <Tooltip title={`${pct}% (planned ÷ actual × 100)`}>
            <Progress
              percent={Math.min(pct, 100)}
              size="small"
              status={pct < 70 ? 'exception' : pct < 90 ? 'normal' : 'success'}
              format={() => `${pct}%`}
            />
          </Tooltip>
        );
      },
    },
    { title: 'Jobs Done',    width: 90,  render: (_, r) => r.stats?.job_count || 0 },
    { title: 'Total Produced', width: 120, render: (_, r) => r.stats?.total_produced?.toFixed(0) || '—' },
    {
      title: 'Actions', width: 90,
      render: (_, r) => <Button size="small" type="link" onClick={() => openHistory(r)}>History</Button>,
    },
  ];

  const histCols = [
    { title: 'Job No',            dataIndex: 'job_no',            width: 120 },
    {
      title: 'Status', dataIndex: 'status', width: 90,
      render: v => <Tag color={v === 'closed' ? 'green' : v === 'cancelled' ? 'red' : 'blue'}>{v}</Tag>,
    },
    { title: 'Plan Cycle (min)',   dataIndex: 'cycle_time_min',    width: 130, render: fmtMin },
    { title: 'Actual Cycle (min)', dataIndex: 'cycle_time_actual', width: 140, render: fmtMin },
    { title: 'Qty Produced', dataIndex: 'qty_produced', width: 110 },
    { title: 'Qty Rejected', dataIndex: 'qty_rejected', width: 110 },
    { title: 'Date', dataIndex: 'created_at', width: 130, render: v => v ? new Date(v).toLocaleDateString() : '—' },
  ];

  return (
    <AppLayout>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Time Standards</Text>
        </div>

        <Title level={3} style={{ margin: 0 }}>Operation Time Standards</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Planned vs actual cycle &amp; setup time per routing operation.
        </Text>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 16 }}>
          <Tag color="blue">Operations: {total}</Tag>
          <Tag color="green">With data: {withJobs}</Tag>
          {avgEff !== null && (
            <Tag color={avgEff >= 90 ? 'green' : avgEff >= 70 ? 'orange' : 'red'}>
              Avg Efficiency: {avgEff}%
            </Tag>
          )}
        </div>

        {/* Filters */}
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input
              placeholder="Search operation, routing, item…"
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 260, borderRadius: 8 }}
              allowClear
            />
            <Select
              placeholder="Filter by Item"
              value={filterItem}
              onChange={v => setFilterItem(v)}
              allowClear style={{ width: 200 }}
              showSearch optionFilterProp="children"
            >
              {items.map(i => <Option key={i.id} value={i.id}>{i.name}</Option>)}
            </Select>
            <Select
              placeholder="Filter by Work Centre"
              value={filterWC}
              onChange={v => setFilterWC(v)}
              allowClear style={{ width: 200 }}
              showSearch optionFilterProp="children"
            >
              {workCenters.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
            <div style={{ flex: 1 }} />
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
          </div>
        </Card>

        {/* Table */}
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <ResponsiveTable
            columns={columns}
            dataSource={displayed}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 25, showSizeChanger: true, showTotal: t => `${t} operations` }}
          />
        </Card>

        {/* History Drawer */}
        <Drawer
          title={
            <div>
              <div style={{ fontWeight: 600 }}>{selStep?.operation_name}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selStep?.Routing?.name} · Step {selStep?.step_no}
              </Text>
            </div>
          }
          open={histDrawer}
          onClose={() => setHistDrawer(false)}
          width={820}
        >
          {selStep && (
            <>
              <Row gutter={16} style={{ marginBottom: 20 }}>
                <Col span={6}><Statistic title="Planned Cycle"   value={fmtMin(selStep.cycle_time_min)} /></Col>
                <Col span={6}><Statistic title="Planned Setup"   value={fmtMin(selStep.setup_time_min)} /></Col>
                <Col span={6}>
                  <Statistic
                    title="Avg Actual Cycle"
                    value={fmtMin(selStep.stats?.avg_cycle_actual)}
                    valueStyle={{ color: '#059669' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Efficiency"
                    value={selStep.stats?.efficiency_pct != null ? `${selStep.stats.efficiency_pct}%` : '—'}
                    valueStyle={{
                      color: selStep.stats?.efficiency_pct >= 90 ? '#059669'
                           : selStep.stats?.efficiency_pct >= 70 ? '#d97706' : '#dc2626',
                    }}
                  />
                </Col>
              </Row>
              <Table
                columns={histCols}
                dataSource={history}
                rowKey="id"
                loading={histLoad}
                size="small"
                pagination={{ pageSize: 20 }}
                scroll={{ x: 700 }}
              />
            </>
          )}
        </Drawer>
    </AppLayout>
  );
}
