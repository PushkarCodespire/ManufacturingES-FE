import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Typography, Row, Col, Statistic, Select, DatePicker,
  Space, Button, Drawer, Progress, Tooltip, Spin, message,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, LineChartOutlined, DashboardOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import api            from '../../../api/axios';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function oeeColor(v) {
  if (v >= 85) return '#16a34a';
  if (v >= 65) return '#ca8a04';
  return '#dc2626';
}

function OeeBar({ value, label }) {
  return (
    <Tooltip title={`${label}: ${value}%`}>
      <Progress
        percent={value}
        size="small"
        strokeColor={oeeColor(value)}
        format={(p) => `${p}%`}
        style={{ marginBottom: 4 }}
      />
    </Tooltip>
  );
}

export default function OeeDashboardPage() {
  const [loading,    setLoading]    = useState(false);
  const [data,       setData]       = useState(null);
  const [dateRange,  setDateRange]  = useState([dayjs().subtract(7, 'day'), dayjs()]);

  // Machine detail drawer
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [detailMachine, setDetailMachine] = useState(null);
  const [detailData,  setDetailData]  = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.date_to   = dateRange[1].format('YYYY-MM-DD');
      const res = await api.get('/oee/dashboard', { params });
      setData(res.data);
    } catch {
      message.error('Failed to load OEE data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  const openMachineDetail = async (machine) => {
    setDetailMachine(machine);
    setDrawerOpen(true);
    setDetailLoading(true);
    try {
      const params = {};
      if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.date_to   = dateRange[1].format('YYYY-MM-DD');
      const res = await api.get(`/oee/machine/${machine.machine_id}`, { params });
      setDetailData(res.data);
    } catch {
      message.error('Failed to load machine detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const overall = data?.overall;
  const machines = data?.machines || [];

  const columns = [
    {
      title:     'Machine',
      dataIndex: 'machine_name',
      render:    (v, r) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openMachineDetail(r)}>{v}</Button>
      ),
    },
    {
      title: 'OEE',
      dataIndex: 'oee',
      sorter: (a, b) => a.oee - b.oee,
      render: (v) => (
        <Tag color={v >= 85 ? 'green' : v >= 65 ? 'gold' : 'red'} style={{ fontWeight: 600 }}>
          {v}%
        </Tag>
      ),
    },
    {
      title: 'Availability',
      dataIndex: 'availability',
      render: (v) => <OeeBar value={v} label="Availability" />,
      width: 150,
    },
    {
      title: 'Performance',
      dataIndex: 'performance',
      render: (v) => <OeeBar value={v} label="Performance" />,
      width: 150,
    },
    {
      title: 'Quality',
      dataIndex: 'quality',
      render: (v) => <OeeBar value={v} label="Quality" />,
      width: 150,
    },
    { title: 'Sched. Min', dataIndex: 'scheduled_min', align: 'right' },
    { title: 'Run Min',    dataIndex: 'run_min',        align: 'right' },
    { title: 'Produced',   dataIndex: 'qty_produced',   align: 'right' },
    { title: 'Rejected',   dataIndex: 'qty_rejected',   align: 'right' },
    { title: 'Job Cards',  dataIndex: 'job_card_count', align: 'right' },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>OEE Dashboard</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>OEE Dashboard</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Overall Equipment Effectiveness — Availability × Performance × Quality
      </Text>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <RangePicker
          value={dateRange}
          onChange={setDateRange}
          allowClear={false}
          style={{ width: 280 }}
        />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Overall KPI row */}
      {overall && (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          {[
            { label: 'OEE', value: overall.oee, suffix: '%' },
            { label: 'Availability', value: overall.availability, suffix: '%' },
            { label: 'Performance', value: overall.performance, suffix: '%' },
            { label: 'Quality', value: overall.quality, suffix: '%' },
            { label: 'Machines', value: machines.length },
            { label: 'Total Produced', value: overall.qty_produced },
          ].map(({ label, value, suffix }) => (
            <Col key={label} xs={12} sm={8} md={4}>
              <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
                <Statistic
                  title={label}
                  value={value}
                  suffix={suffix}
                  valueStyle={{ color: suffix ? oeeColor(value) : undefined, fontSize: 20 }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Machine table */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <DashboardOutlined style={{ marginRight: 8, color: '#1d4ed8' }} />
          <Text strong>Per-Machine OEE</Text>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            Click a machine name to see daily trend
          </Text>
        </div>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={machines}
            rowKey="machine_id"
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
          />
        </Spin>
      </Card>

      {/* Machine detail drawer */}
      <Drawer
        title={detailMachine ? `${detailMachine.machine_name} — OEE Trend` : ''}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={700}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin /></div>
        ) : detailData ? (
          <>
            {/* Overall card for this machine */}
            <Row gutter={12} style={{ marginBottom: 20 }}>
              {['oee', 'availability', 'performance', 'quality'].map((k) => (
                <Col key={k} span={6}>
                  <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                    <Statistic
                      title={k.charAt(0).toUpperCase() + k.slice(1)}
                      value={detailData.overall?.[k]}
                      suffix="%"
                      valueStyle={{ fontSize: 16, color: oeeColor(detailData.overall?.[k] || 0) }}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            {/* Daily trend chart */}
            <Text strong style={{ display: 'block', marginBottom: 10 }}>Daily OEE Trend</Text>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={detailData.trend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <ReTooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Line type="monotone" dataKey="oee"          name="OEE"          stroke="#1d4ed8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="availability" name="Availability" stroke="#16a34a" dot={false} />
                <Line type="monotone" dataKey="performance"  name="Performance"  stroke="#ca8a04" dot={false} />
                <Line type="monotone" dataKey="quality"      name="Quality"      stroke="#dc2626" dot={false} />
              </LineChart>
            </ResponsiveContainer>

            {/* Trend table */}
            <Table
              style={{ marginTop: 16 }}
              size="small"
              dataSource={detailData.trend || []}
              rowKey="date"
              columns={[
                { title: 'Date',         dataIndex: 'date' },
                { title: 'OEE %',        dataIndex: 'oee',          render: (v) => <Tag color={v >= 85 ? 'green' : v >= 65 ? 'gold' : 'red'}>{v}%</Tag> },
                { title: 'Avail %',      dataIndex: 'availability', render: (v) => `${v}%` },
                { title: 'Perf %',       dataIndex: 'performance',  render: (v) => `${v}%` },
                { title: 'Quality %',    dataIndex: 'quality',      render: (v) => `${v}%` },
                { title: 'Produced',     dataIndex: 'qty_produced' },
                { title: 'Job Cards',    dataIndex: 'job_card_count' },
              ]}
              pagination={false}
            />
          </>
        ) : null}
      </Drawer>
    </AppLayout>
  );
}
