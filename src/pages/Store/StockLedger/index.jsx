import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Select, Space,
  message, Tabs,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, RightOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout        from '../../../components/AppLayout';
import ResponsiveTable  from '../../../components/ResponsiveTable';
import { inventoryApi } from '../../../api/store.api';
import { warehouseApi } from '../../../api/warehouse.api';

const { Title, Text } = Typography;

// ── Transaction type config ───────────────────────────────────────────────────
const TXN_COLORS = {
  grn_in:         { color: 'green',  label: 'GRN In'       },
  issue_out:      { color: 'red',    label: 'Issue Out'    },
  adjustment_in:  { color: 'cyan',   label: 'Adj In'       },
  adjustment_out: { color: 'orange', label: 'Adj Out'      },
  transfer_in:    { color: 'blue',   label: 'Transfer In'  },
  transfer_out:   { color: 'purple', label: 'Transfer Out' },
  return_in:      { color: 'lime',   label: 'Return In'    },
};

export default function StockLedgerPage() {
  const [stock,           setStock]           = useState([]);
  const [ledger,          setLedger]          = useState([]);
  const [warehouses,      setWarehouses]       = useState([]);
  const [loading,         setLoading]          = useState(false);
  const [search,          setSearch]           = useState('');
  const [warehouseFilter, setWarehouseFilter]  = useState(null);
  const [activeTab,       setActiveTab]        = useState('stock');

  // ── Load current stock ────────────────────────────────────────────────────
  const loadStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)          params.search       = search;
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      const data = await inventoryApi.getStock(params);
      setStock(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load stock'); }
    finally { setLoading(false); }
  }, [search, warehouseFilter]);

  // ── Load transaction ledger ───────────────────────────────────────────────
  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      const data = await inventoryApi.getLedger(params);
      setLedger(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load ledger'); }
    finally { setLoading(false); }
  }, [warehouseFilter]);

  useEffect(() => {
    if (activeTab === 'stock')  loadStock();
    if (activeTab === 'ledger') loadLedger();
  }, [activeTab, loadStock, loadLedger]);

  // ── Load warehouses ───────────────────────────────────────────────────────
  useEffect(() => {
    warehouseApi.getAll({ limit: 100 }).then((d) => {
      setWarehouses(Array.isArray(d) ? d : (d?.data ?? []));
    }).catch(() => {});
  }, []);

  // ── Stock table columns ───────────────────────────────────────────────────
  const stockColumns = [
    {
      title: 'Item Code', key: 'code', width: 120,
      render: (_, r) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.Item?.code || '—'}</Text>
      ),
    },
    {
      title: 'Item Name', key: 'name',
      render: (_, r) => <Text style={{ fontWeight: 500 }}>{r.Item?.name || '—'}</Text>,
    },
    {
      title: 'Warehouse', key: 'warehouse', width: 150,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Warehouse?.name || '—'}</Text>,
    },
    {
      title: 'Unit', key: 'unit', width: 70,
      render: (_, r) => <Text type="secondary">{r.Item?.unit || '—'}</Text>,
    },
    {
      title: 'Qty On Hand', dataIndex: 'qty_on_hand', key: 'qty', width: 130, align: 'right',
      render: (v) => {
        const qty   = parseFloat(v || 0);
        const color = qty <= 0 ? '#dc2626' : qty < 10 ? '#d97706' : '#16a34a';
        return <Text style={{ fontWeight: 700, color, fontSize: 14 }}>{qty.toLocaleString()}</Text>;
      },
    },
    {
      title: 'Last Updated', dataIndex: 'last_txn_at', key: 'last_txn', width: 140,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY HH:mm') : '—',
    },
  ];

  // ── Ledger table columns ──────────────────────────────────────────────────
  const ledgerColumns = [
    {
      title: 'Date', dataIndex: 'created_at', key: 'date', width: 140,
      render: (d) => dayjs(d).format('DD MMM YYYY HH:mm'),
    },
    {
      title: 'Item', key: 'item', width: 200,
      render: (_, r) => (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.Item?.name || '—'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.Item?.code}</Text>
        </div>
      ),
    },
    {
      title: 'Warehouse', key: 'warehouse', width: 130,
      render: (_, r) => <Text style={{ fontSize: 13 }}>{r.Warehouse?.name || '—'}</Text>,
    },
    {
      title: 'Type', dataIndex: 'txn_type', key: 'type', width: 120,
      render: (t) => {
        const cfg = TXN_COLORS[t] || { color: 'default', label: t };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Ref', key: 'ref', width: 130,
      render: (_, r) => r.ref_no ? (
        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#1d4ed8' }}>{r.ref_no}</Text>
      ) : '—',
    },
    {
      title: 'Before', dataIndex: 'qty_before', key: 'before', width: 90, align: 'right',
      render: (v) => <Text style={{ fontSize: 12 }}>{parseFloat(v || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Change', dataIndex: 'qty_change', key: 'change', width: 100, align: 'right',
      render: (v) => {
        const n     = parseFloat(v || 0);
        const color = n > 0 ? '#16a34a' : '#dc2626';
        const icon  = n > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
        return <Text style={{ color, fontWeight: 600 }}>{icon} {Math.abs(n).toLocaleString()}</Text>;
      },
    },
    {
      title: 'After', dataIndex: 'qty_after', key: 'after', width: 90, align: 'right',
      render: (v) => <Text style={{ fontWeight: 700 }}>{parseFloat(v || 0).toLocaleString()}</Text>,
    },
  ];

  const refreshFn = activeTab === 'stock' ? loadStock : loadLedger;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Store</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Stock Ledger</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Stock Ledger</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Real-time inventory visibility — current stock levels and full transaction history.
      </Text>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 16 }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          {activeTab === 'stock' && (
            <Input
              placeholder="Search item name or code…"
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240, borderRadius: 8 }}
              allowClear
            />
          )}
          <Select
            placeholder="All Warehouses"
            allowClear
            value={warehouseFilter}
            onChange={setWarehouseFilter}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            style={{ width: 200 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={refreshFn} loading={loading}>Refresh</Button>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'stock',
              label: `Current Stock (${stock.length})`,
              children: (
                <ResponsiveTable
                  rowKey="id"
                  loading={loading}
                  columns={stockColumns}
                  dataSource={stock}
                  size="small"
                  scroll={{ x: 800 }}
                  pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} items` }}
                  rowClassName={(r) => parseFloat(r.qty_on_hand) <= 0 ? 'row-overdue' : ''}
                />
              ),
            },
            {
              key: 'ledger',
              label: 'Transaction Ledger',
              children: (
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={ledgerColumns}
                  dataSource={ledger}
                  size="small"
                  scroll={{ x: 1000 }}
                  pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} transactions` }}
                />
              ),
            },
          ]}
        />
      </Card>
    </AppLayout>
  );
}
