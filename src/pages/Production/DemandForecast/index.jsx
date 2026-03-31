import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Typography, Button, Select, Space, Tabs,
  message, Row, Col, Statistic, Spin, Tooltip,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, LineChartOutlined,
DownloadOutlined, } from '@ant-design/icons';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend, ComposedChart, Area,
} from 'recharts';
import AppLayout           from '../../../components/AppLayout';
import { demandForecastApi } from '../../../api/production.api';
import api                   from '../../../api/axios';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function DemandForecastPage() {
  const [activeTab, setActiveTab] = useState('forecast');

  // Forecast tab
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastData,    setForecastData]    = useState([]);
  const [selectedItem,    setSelectedItem]    = useState(null);
  const [historyMonths,   setHistoryMonths]   = useState(6);

  // Monthly summary tab
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthly,        setMonthly]        = useState([]);

  // Open orders tab
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [openOrders,    setOpenOrders]    = useState([]);

  // Lookups
  const [items, setItems] = useState([]);

  const loadForecast = useCallback(async () => {
    setForecastLoading(true);
    try {
      const params = { months_history: historyMonths };
      if (selectedItem) params.item_id = selectedItem;
      const res = await demandForecastApi.getForecast(params);
      setForecastData(res.data || []);
    } catch { message.error('Failed to load forecast'); }
    finally { setForecastLoading(false); }
  }, [selectedItem, historyMonths]);

  const loadMonthly = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const res = await demandForecastApi.getMonthlySummary({ months: historyMonths });
      setMonthly(res.data || []);
    } catch { message.error('Failed to load monthly summary'); }
    finally { setMonthlyLoading(false); }
  }, [historyMonths]);

  const loadOpenOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await demandForecastApi.getOpenOrders();
      setOpenOrders(res.data || []);
    } catch { message.error('Failed to load open orders'); }
    finally { setOrdersLoading(false); }
  }, []);

  useEffect(() => { loadForecast(); }, [loadForecast]);
  useEffect(() => {
    if (activeTab === 'monthly') loadMonthly();
  }, [activeTab, loadMonthly]);
  useEffect(() => {
    if (activeTab === 'open') loadOpenOrders();
  }, [activeTab, loadOpenOrders]);

  useEffect(() => {
    api.get('/items', { params: { limit: 500 } })
      .then((r) => setItems(r.data || []))
      .catch(() => {});
  }, []);

  // Build chart data for selected item or first item
  const chartItem = forecastData.find((d) => d.item_id === selectedItem) || forecastData[0];
  const chartData = chartItem
    ? [
        ...( chartItem.history || []).map((h) => ({ week: h.week, actual: h.qty,     type: 'actual' })),
        ...( chartItem.forecast || []).map((f) => ({ week: f.week, forecast: f.forecast_qty, type: 'forecast' })),
      ]
    : [];

  const forecastTableColumns = [
    { title: 'Item',        render: (_, r) => `${r.item_code} — ${r.item_name}` },
    { title: 'Avg Weekly',  dataIndex: 'avg_weekly',        align: 'right' },
    { title: 'Total (hist.)', dataIndex: 'total_historical', align: 'right' },
    {
      title: 'Next 4-wk Forecast',
      render: (_, r) => {
        const total = (r.forecast || []).reduce((s, f) => s + f.forecast_qty, 0);
        return total.toFixed(2);
      },
      align: 'right',
    },
    {
      title: 'Week 1',
      render: (_, r) => r.forecast?.[0]?.forecast_qty ?? '—',
      align: 'right',
    },
    {
      title: 'Week 2',
      render: (_, r) => r.forecast?.[1]?.forecast_qty ?? '—',
      align: 'right',
    },
    {
      title: 'Week 3',
      render: (_, r) => r.forecast?.[2]?.forecast_qty ?? '—',
      align: 'right',
    },
    {
      title: 'Week 4',
      render: (_, r) => r.forecast?.[3]?.forecast_qty ?? '—',
      align: 'right',
    },
  ];

  const openOrdersColumns = [
    { title: 'Item',           render: (_, r) => `${r.item_code} — ${r.item_name}` },
    { title: 'Committed Qty',  dataIndex: 'committed_qty',  align: 'right' },
    { title: 'WO Count',       dataIndex: 'wo_count',       align: 'right' },
    { title: 'Earliest Date',  dataIndex: 'earliest_date' },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Demand Forecast</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Demand Forecast</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Moving-average weekly forecast from closed work orders + committed open-order demand.
      </Text>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Filter by item"
          style={{ width: 280 }}
          value={selectedItem}
          onChange={setSelectedItem}
          options={items.map((i) => ({ value: i.id, label: `${i.code} – ${i.name}` }))}
        />
        <Select
          value={historyMonths}
          onChange={setHistoryMonths}
          style={{ width: 160 }}
          options={[
            { value: 3,  label: 'Last 3 months'  },
            { value: 6,  label: 'Last 6 months'  },
            { value: 12, label: 'Last 12 months' },
          ]}
        />
        <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('demand-forecast.csv', forecastData, forecastTableColumns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={loadForecast}>Refresh</Button>
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>

          {/* ── Forecast Tab ─────────────────────────────────────────── */}
          <TabPane tab="Weekly Forecast" key="forecast">
            <Spin spinning={forecastLoading}>
              {chartData.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    {chartItem?.item_code} — {chartItem?.item_name}
                  </Text>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                      <YAxis />
                      <ReTooltip />
                      <Legend />
                      <Bar    dataKey="actual"   name="Actual"   fill="#1d4ed8" barSize={14} />
                      <Line  dataKey="forecast"  name="Forecast" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" dot />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              <Table
                size="small"
                columns={forecastTableColumns}
                dataSource={forecastData}
                rowKey="item_id"
                pagination={false}
                scroll={{ x: 700 }}
                rowClassName={(r) => r.item_id === selectedItem ? 'ant-table-row-selected' : ''}
              />
            </Spin>
          </TabPane>

          {/* ── Monthly Summary Tab ───────────────────────────────────── */}
          <TabPane tab="Monthly Summary" key="monthly">
            <Spin spinning={monthlyLoading}>
              {monthly.length > 0 && (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ReTooltip />
                    <Legend />
                    <Bar dataKey="total_qty" name="Total Qty Produced" fill="#1d4ed8" />
                    <Bar dataKey="wo_count"  name="Work Orders"        fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <Table
                style={{ marginTop: 16 }}
                size="small"
                dataSource={monthly}
                rowKey="month"
                columns={[
                  { title: 'Month',     dataIndex: 'month' },
                  { title: 'Total Qty', dataIndex: 'total_qty', align: 'right', render: (v) => v.toFixed(2) },
                  { title: 'WO Count',  dataIndex: 'wo_count',  align: 'right' },
                ]}
                pagination={false}
                scroll={{ x: 800 }}
              />
            </Spin>
          </TabPane>

          {/* ── Open Orders Tab ───────────────────────────────────────── */}
          <TabPane tab="Committed Demand" key="open">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Button icon={<ReloadOutlined />} onClick={loadOpenOrders}>Refresh</Button>
            </div>
            <Spin spinning={ordersLoading}>
              <Table
                size="small"
                columns={openOrdersColumns}
                dataSource={openOrders}
                rowKey="item_id"
                pagination={false}
                scroll={{ x: 800 }}
              />
            </Spin>
          </TabPane>

        </Tabs>
      </Card>
    </AppLayout>
  );
}
