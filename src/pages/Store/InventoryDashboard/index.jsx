import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Table, Tag, Space, Select, Tabs,
  Row, Col, Statistic, message, Tooltip,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, WarningOutlined,
  ClockCircleOutlined, InboxOutlined, BarChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { inventoryApi }  from '../../../api/store.api';
import { warehouseApi }  from '../../../api/warehouse.api';

const { Title, Text } = Typography;

// ── Bucket colors ────────────────────────────────────────────────────────────
const BUCKET_COLOR = {
  '0-30':    'green',
  '31-60':   'blue',
  '61-90':   'orange',
  '90+':     'red',
  'unknown': 'default',
};

export default function InventoryDashboardPage() {
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = useState('overview');

  // ── Overview state ─────────────────────────────────────────────────────────
  const [dashboard,   setDashboard]   = useState(null);
  const [dashLoading, setDashLoading] = useState(false);

  // ── Stock Age state ────────────────────────────────────────────────────────
  const [stockAge,      setStockAge]      = useState({ data: [], summary: {} });
  const [ageLoading,    setAgeLoading]    = useState(false);
  const [ageWarehouse,  setAgeWarehouse]  = useState(null);

  // ── Dead Stock state ───────────────────────────────────────────────────────
  const [deadStock,     setDeadStock]     = useState({ data: [], summary: {} });
  const [deadLoading,   setDeadLoading]   = useState(false);
  const [deadDays,      setDeadDays]      = useState(90);

  // ── Lookups ────────────────────────────────────────────────────────────────
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    warehouseApi.getAll({ limit: 100 }).catch(() => []).then((w) => {
      setWarehouses(Array.isArray(w) ? w : (w?.data ?? []));
    });
  }, []);

  // ── Load Dashboard ─────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const res = await inventoryApi.getDashboard();
      setDashboard(res?.data ?? null);
    } catch { message.error('Failed to load dashboard'); }
    finally { setDashLoading(false); }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // ── Load Stock Age ─────────────────────────────────────────────────────────
  const loadStockAge = useCallback(async () => {
    setAgeLoading(true);
    try {
      const params = {};
      if (ageWarehouse) params.warehouse_id = ageWarehouse;
      const res = await inventoryApi.getStockAge(params);
      setStockAge({ data: res?.data ?? [], summary: res?.summary ?? {} });
    } catch { message.error('Failed to load stock age'); }
    finally { setAgeLoading(false); }
  }, [ageWarehouse]);

  useEffect(() => {
    if (activeTab === 'stock-age') loadStockAge();
  }, [activeTab, loadStockAge]);

  // ── Load Dead Stock ────────────────────────────────────────────────────────
  const loadDeadStock = useCallback(async () => {
    setDeadLoading(true);
    try {
      const res = await inventoryApi.getDeadStock({ days: deadDays });
      setDeadStock({ data: res?.data ?? [], summary: res?.summary ?? {} });
    } catch { message.error('Failed to load dead stock'); }
    finally { setDeadLoading(false); }
  }, [deadDays]);

  useEffect(() => {
    if (activeTab === 'dead-stock') loadDeadStock();
  }, [activeTab, loadDeadStock]);

  // ── Tab: Overview ──────────────────────────────────────────────────────────
  const tabOverview = () => {
    const s = dashboard?.summary || {};
    const lowStock = dashboard?.lowStock || [];
    const recentTxns = dashboard?.recentTransactions || [];
    const byWarehouse = dashboard?.stockByWarehouse || [];

    return (
      <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
              <Statistic title="Items in Stock" value={s.totalItems || 0}
                valueStyle={{ color: '#1d4ed8', fontSize: 22 }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
              <Statistic title="Total Quantity" value={s.totalQty || 0}
                valueStyle={{ color: '#16a34a', fontSize: 22 }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
              <Statistic title="Zero Stock Items" value={s.zeroStockCount || 0}
                valueStyle={{ color: '#dc2626', fontSize: 22 }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
              <Statistic title="Low Stock Alerts" value={lowStock.length}
                prefix={lowStock.length > 0 ? <WarningOutlined /> : null}
                valueStyle={{ color: lowStock.length > 0 ? '#d97706' : '#16a34a', fontSize: 22 }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          {/* Low Stock */}
          <Col span={14}>
            <Card
              title={<><WarningOutlined style={{ color: '#d97706', marginRight: 6 }} />Low Stock Items</>}
              size="small"
              style={{ borderRadius: 10, marginBottom: 16 }}
              bodyStyle={{ padding: 0 }}
            >
              <Table
                rowKey="item_id"
                dataSource={lowStock}
                size="small"
                pagination={false}
                scroll={{ y: 300 }}
                columns={[
                  { title: 'Item', dataIndex: 'item_name', key: 'name', width: 180, ellipsis: true },
                  { title: 'Code', dataIndex: 'item_code', key: 'code', width: 100 },
                  { title: 'Warehouse', dataIndex: 'warehouse', key: 'wh', width: 120 },
                  { title: 'On Hand', dataIndex: 'qty_on_hand', key: 'qty', width: 80, align: 'right',
                    render: (v) => <Text style={{ color: '#dc2626', fontWeight: 600 }}>{v}</Text>,
                  },
                  { title: 'Reorder Pt', dataIndex: 'reorder_point', key: 'rp', width: 90, align: 'right' },
                  { title: 'Deficit', dataIndex: 'deficit', key: 'def', width: 80, align: 'right',
                    render: (v) => <Tag color="red">{v}</Tag>,
                  },
                ]}
              />
            </Card>
          </Col>

          {/* Stock by Warehouse */}
          <Col span={10}>
            <Card
              title={<><InboxOutlined style={{ color: '#7c3aed', marginRight: 6 }} />Stock by Warehouse</>}
              size="small"
              style={{ borderRadius: 10, marginBottom: 16 }}
              bodyStyle={{ padding: 0 }}
            >
              <Table
                rowKey="warehouse"
                dataSource={byWarehouse}
                size="small"
                pagination={false}
                columns={[
                  { title: 'Warehouse', dataIndex: 'warehouse', key: 'wh', width: 160 },
                  { title: 'Items', dataIndex: 'item_count', key: 'items', width: 70, align: 'right' },
                  { title: 'Total Qty', dataIndex: 'total_qty', key: 'qty', width: 100, align: 'right',
                    render: (v) => Math.round(v * 100) / 100,
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>

        {/* Recent Transactions */}
        <Card
          title="Recent Transactions"
          size="small"
          style={{ borderRadius: 10 }}
          bodyStyle={{ padding: 0 }}
          extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadDashboard}>Refresh</Button>}
        >
          <Table
            rowKey="id"
            dataSource={recentTxns}
            size="small"
            pagination={false}
            scroll={{ y: 260 }}
            columns={[
              { title: 'Date', dataIndex: 'created_at', key: 'date', width: 110,
                render: (d) => d ? dayjs(d).format('DD MMM HH:mm') : '—',
              },
              { title: 'Type', dataIndex: 'txn_type', key: 'type', width: 120,
                render: (v) => <Tag>{v}</Tag>,
              },
              { title: 'Item', key: 'item', width: 180,
                render: (_, r) => <Text style={{ fontSize: 12 }}>{r.Item?.name || '—'}</Text>,
              },
              { title: 'Warehouse', key: 'wh', width: 120,
                render: (_, r) => r.Warehouse?.name || '—',
              },
              { title: 'Qty Change', dataIndex: 'qty_change', key: 'change', width: 100, align: 'right',
                render: (v) => {
                  const val = parseFloat(v);
                  return <Text style={{ color: val > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {val > 0 ? '+' : ''}{val}
                  </Text>;
                },
              },
              { title: 'Ref', dataIndex: 'ref_no', key: 'ref', width: 140 },
            ]}
          />
        </Card>
      </>
    );
  };

  // ── Tab: Stock Age ─────────────────────────────────────────────────────────
  const tabStockAge = () => {
    const summary = stockAge.summary;
    return (
      <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {Object.entries(BUCKET_COLOR).filter(([k]) => k !== 'unknown').map(([bucket, color]) => (
            <Col span={6} key={bucket}>
              <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
                <Statistic title={`${bucket} days`} value={summary[bucket] || 0}
                  valueStyle={{ color: color === 'green' ? '#16a34a' : color === 'blue' ? '#1d4ed8' : color === 'orange' ? '#d97706' : '#dc2626', fontSize: 22 }} />
              </Card>
            </Col>
          ))}
        </Row>

        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <Select
              placeholder="All Warehouses"
              allowClear
              value={ageWarehouse}
              onChange={setAgeWarehouse}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
              style={{ width: 200 }}
            />
            <div style={{ flex: 1 }} />
            <Button icon={<ReloadOutlined />} onClick={loadStockAge}>Refresh</Button>
          </div>

          <Table
            rowKey={(r) => `${r.item_id}-${r.warehouse_id}`}
            loading={ageLoading}
            dataSource={stockAge.data}
            size="small"
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} items` }}
            columns={[
              { title: 'Item', dataIndex: 'item_name', key: 'name', width: 200, ellipsis: true },
              { title: 'Code', dataIndex: 'item_code', key: 'code', width: 100 },
              { title: 'Warehouse', dataIndex: 'warehouse', key: 'wh', width: 130 },
              { title: 'Qty', dataIndex: 'qty_on_hand', key: 'qty', width: 80, align: 'right' },
              { title: 'Received', dataIndex: 'received_date', key: 'rcvd', width: 120,
                render: (d) => d ? dayjs(d).format('DD MMM YYYY') : <Text type="secondary">Unknown</Text>,
              },
              { title: 'Age (days)', dataIndex: 'age_days', key: 'age', width: 100, align: 'right',
                sorter: (a, b) => (a.age_days || 0) - (b.age_days || 0),
                render: (v) => v !== null ? v : '—',
              },
              { title: 'Bucket', dataIndex: 'bucket', key: 'bucket', width: 100,
                filters: Object.keys(BUCKET_COLOR).map((b) => ({ text: b, value: b })),
                onFilter: (val, r) => r.bucket === val,
                render: (b) => <Tag color={BUCKET_COLOR[b] || 'default'}>{b}</Tag>,
              },
            ]}
          />
        </Card>
      </>
    );
  };

  // ── Tab: Dead Stock ────────────────────────────────────────────────────────
  const tabDeadStock = () => (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Dead Stock Items" value={deadStock.summary.total_dead_items || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#dc2626', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center' }}>
            <Statistic title="Threshold" value={`${deadStock.summary.threshold_days || deadDays} days`}
              valueStyle={{ color: '#6b7280', fontSize: 22 }} />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 13 }}>No movement for</Text>
          <Select
            value={deadDays}
            onChange={setDeadDays}
            options={[
              { value: 30,  label: '30 days'  },
              { value: 60,  label: '60 days'  },
              { value: 90,  label: '90 days'  },
              { value: 180, label: '180 days' },
              { value: 365, label: '365 days' },
            ]}
            style={{ width: 120 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={loadDeadStock}>Refresh</Button>
        </div>

        <Table
          rowKey={(r) => `${r.item_id}-${r.warehouse_id}`}
          loading={deadLoading}
          dataSource={deadStock.data}
          size="small"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} items` }}
          columns={[
            { title: 'Item', dataIndex: 'item_name', key: 'name', width: 200, ellipsis: true },
            { title: 'Code', dataIndex: 'item_code', key: 'code', width: 100 },
            { title: 'Warehouse', dataIndex: 'warehouse', key: 'wh', width: 130 },
            { title: 'Qty', dataIndex: 'qty_on_hand', key: 'qty', width: 80, align: 'right',
              render: (v) => <Text style={{ fontWeight: 600 }}>{v}</Text>,
            },
            { title: 'Last Transaction', dataIndex: 'last_txn_at', key: 'last', width: 140,
              render: (d) => d ? dayjs(d).format('DD MMM YYYY') : <Text type="secondary">Never</Text>,
            },
            { title: 'Idle Days', dataIndex: 'idle_days', key: 'idle', width: 100, align: 'right',
              sorter: (a, b) => (a.idle_days || 999) - (b.idle_days || 999),
              render: (v) => v !== null
                ? <Text style={{ color: v > 180 ? '#dc2626' : '#d97706', fontWeight: 600 }}>{v}</Text>
                : <Text type="secondary">N/A</Text>,
            },
          ]}
        />
      </Card>
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Store</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Inventory Dashboard</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Inventory Dashboard</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Overview of stock levels, aging analysis, and dead stock identification.
      </Text>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 12 }}
        items={[
          { key: 'overview',    label: 'Overview',    children: <div style={{ paddingTop: 8 }}>{tabOverview()}</div> },
          { key: 'stock-age',   label: 'Stock Age',   children: <div style={{ paddingTop: 8 }}>{tabStockAge()}</div> },
          { key: 'dead-stock',  label: 'Dead Stock',  children: <div style={{ paddingTop: 8 }}>{tabDeadStock()}</div> },
        ]}
      />
    </AppLayout>
  );
}
