import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography, Card, Row, Col, Tag, Input, Select, Table, Statistic, Badge,
  Button, message, Spin,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, SearchOutlined, DashboardOutlined,
DownloadOutlined, } from '@ant-design/icons';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import api            from '../../../api/axios';
import { warehouseApi } from '../../../api/warehouse.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { Option }      = Select;

// ── Type configuration ──────────────────────────────────────────────────────
const TYPE_CONFIG = {
  RM:  { label: 'Raw Materials',      color: '#1d4ed8', bg: '#eff6ff',  border: '#bfdbfe' },
  SFG: { label: 'Semi-Finished (WIP)', color: '#ea580c', bg: '#fff7ed',  border: '#fed7aa' },
  FG:  { label: 'Finished Goods',     color: '#16a34a', bg: '#f0fdf4',  border: '#bbf7d0' },
  MRO: { label: 'MRO / Consumables',  color: '#7c3aed', bg: '#f5f3ff',  border: '#ddd6fe' },
  PKG: { label: 'Packaging',          color: '#0891b2', bg: '#ecfeff',  border: '#a5f3fc' },
};

const TYPE_TAG_COLORS = {
  RM:  'blue',
  SFG: 'orange',
  FG:  'green',
  MRO: 'purple',
  PKG: 'cyan',
  WIP: 'orange',
  SVC: 'default',
};

// ── Helper: stock status ────────────────────────────────────────────────────
function getStockStatus(qty, reorderLevel) {
  const q = parseFloat(qty) || 0;
  const r = parseFloat(reorderLevel);
  if (q === 0) return { text: 'Out of Stock', color: 'red' };
  if (r && q <= r) return { text: 'Low', color: 'orange' };
  return { text: 'OK', color: 'green' };
}

export default function StockOverviewPage() {
  const { can } = usePermissions();

  // ── State ───────────────────────────────────────────────────────────────
  const [summary,        setSummary]        = useState({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [items,          setItems]          = useState([]);
  const [itemsLoading,   setItemsLoading]   = useState(false);
  const [pagination,     setPagination]     = useState({ total: 0, page: 1, limit: 50, pages: 1 });
  const [warehouses,     setWarehouses]     = useState([]);

  // Filters
  const [search,       setSearch]       = useState('');
  const [filterType,   setFilterType]   = useState(undefined);
  const [filterWH,     setFilterWH]     = useState(undefined);

  // ── Load warehouses ─────────────────────────────────────────────────────
  useEffect(() => {
    warehouseApi.getAll({ limit: 200 }).catch(() => []).then((res) => {
      const list = Array.isArray(res) ? res : (res?.data ?? res?.rows ?? []);
      setWarehouses(list);
    });
  }, []);

  // ── Load summary ────────────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/stock-dashboard/summary');
      setSummary(res?.data ?? {});
    } catch (err) {
      message.error('Failed to load stock summary');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // ── Load items ──────────────────────────────────────────────────────────
  const loadItems = useCallback(async (pg = 1) => {
    setItemsLoading(true);
    try {
      const params = { page: pg, limit: pagination.limit };
      if (filterType) params.item_type = filterType;
      if (filterWH)   params.warehouse_id = filterWH;
      if (search)     params.search = search;

      const res = await api.get('/stock-dashboard/items', { params });
      setItems(res?.data ?? []);
      setPagination(res?.pagination ?? { total: 0, page: pg, limit: 50, pages: 1 });
    } catch (err) {
      message.error('Failed to load stock items');
    } finally {
      setItemsLoading(false);
    }
  }, [filterType, filterWH, search, pagination.limit]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadItems(1); }, [loadItems]);

  const handleRefresh = () => {
    loadSummary();
    loadItems(1);
  };

  // ── Summary cards ─────────────────────────────────────────────────────────
  const summaryCards = useMemo(() => {
    return Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
      const data = summary[type] || { total_qty: 0, item_count: 0 };
      return { type, ...cfg, ...data };
    });
  }, [summary]);

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Item Code',
      dataIndex: ['Item', 'code'],
      key: 'code',
      width: 130,
      sorter: (a, b) => (a.Item?.code || '').localeCompare(b.Item?.code || ''),
    },
    {
      title: 'Item Name',
      dataIndex: ['Item', 'name'],
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => (a.Item?.name || '').localeCompare(b.Item?.name || ''),
    },
    {
      title: 'Type',
      dataIndex: ['Item', 'item_type'],
      key: 'item_type',
      width: 110,
      render: (v) => <Tag color={TYPE_TAG_COLORS[v] || 'default'}>{v || '-'}</Tag>,
      filters: Object.entries(TYPE_CONFIG).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (value, record) => record.Item?.item_type === value,
    },
    {
      title: 'Group',
      dataIndex: ['Item', 'item_group'],
      key: 'item_group',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'Warehouse',
      dataIndex: ['Warehouse', 'name'],
      key: 'warehouse',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Unit',
      dataIndex: ['Item', 'unit'],
      key: 'unit',
      width: 80,
    },
    {
      title: 'Qty On Hand',
      dataIndex: 'qty_on_hand',
      key: 'qty_on_hand',
      width: 120,
      align: 'right',
      sorter: (a, b) => (parseFloat(a.qty_on_hand) || 0) - (parseFloat(b.qty_on_hand) || 0),
      render: (v) => {
        const num = parseFloat(v) || 0;
        return <Text strong>{num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</Text>;
      },
    },
    {
      title: 'Reorder Level',
      dataIndex: ['Item', 'reorder_point'],
      key: 'reorder_level',
      width: 120,
      align: 'right',
      render: (v) => {
        const num = parseFloat(v);
        return num ? num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : '-';
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const status = getStockStatus(record.qty_on_hand, record.Item?.reorder_point);
        return <Tag color={status.color}>{status.text}</Tag>;
      },
      filters: [
        { text: 'OK',           value: 'OK' },
        { text: 'Low',          value: 'Low' },
        { text: 'Out of Stock', value: 'Out of Stock' },
      ],
      onFilter: (value, record) => {
        const status = getStockStatus(record.qty_on_hand, record.Item?.reorder_point);
        return status.text === value;
      },
    },
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Store</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Stock Overview</Text>
      </div>

      {/* Title */}
      <Title level={3} style={{ margin: 0 }}>Stock Overview</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Real-time visibility of stock levels across Raw Material, WIP, Finished Goods, MRO, and Packaging.
      </Text>

      {/* ── Summary Cards ────────────────────────────────────────────────────── */}
      <Spin spinning={summaryLoading}>
        <Row gutter={[16, 16]} style={{ marginTop: 20, marginBottom: 24 }}>
          {summaryCards.map((c) => (
            <Col xs={24} sm={12} md={8} lg={4} xl={4} key={c.type}>
              <Card
                size="small"
                style={{
                  border: `1px solid ${c.border}`,
                  borderRadius: 12,
                  background: c.bg,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                }}
                styles={{ body: { padding: '16px 18px' } }}
                hoverable
                onClick={() => {
                  setFilterType(filterType === c.type ? undefined : c.type);
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  <Text strong style={{ color: c.color, fontSize: 13 }}>{c.label}</Text>
                </div>
                <Statistic
                  value={c.total_qty}
                  precision={0}
                  valueStyle={{ fontSize: 22, fontWeight: 700, color: c.color }}
                />
                <div style={{ marginTop: 4 }}>
                  <Tag color={TYPE_TAG_COLORS[c.type]}>{c.item_count} items</Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      {/* ── Filters + Table Card ─────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search item name or code..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="All Types"
            value={filterType}
            onChange={(v) => setFilterType(v)}
            style={{ width: 180 }}
            allowClear
          >
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <Option key={k} value={k}>{v.label}</Option>
            ))}
          </Select>
          <Select
            placeholder="All Warehouses"
            value={filterWH}
            onChange={(v) => setFilterWH(v)}
            style={{ width: 200 }}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {warehouses.map((w) => (
              <Option key={w.id} value={w.id}>{w.name}</Option>
            ))}
          </Select>

          <div style={{ flex: 1 }} />

          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('stock-overview.csv', items, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>Refresh</Button>
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={itemsLoading}
          size="small"
          scroll={{ x: 1100 }}
          pagination={{
            current:   pagination.page,
            pageSize:  pagination.limit,
            total:     pagination.total,
            showTotal: (total) => `Total ${total} records`,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100'],
            onChange: (pg, size) => {
              setPagination((prev) => ({ ...prev, limit: size }));
              loadItems(pg);
            },
          }}
        />
      </Card>
    </AppLayout>
  );
}
