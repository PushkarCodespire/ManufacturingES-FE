import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Select, Table, Tag, Tabs,
  message, Spin, Progress, Row, Col, Statistic, Divider, Input,
} from 'antd';
import {
  RightOutlined, ReloadOutlined, TrophyOutlined, SearchOutlined,
  BarChartOutlined, UnorderedListOutlined,
DownloadOutlined, } from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import AppLayout        from '../../../components/AppLayout';
import { vendorApi }    from '../../../api/procurement.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const RATING_CONFIG = {
  A: { color: '#16a34a', bg: '#f0fdf4', label: 'Excellent',   desc: 'Score >= 80' },
  B: { color: '#2563eb', bg: '#eff6ff', label: 'Good',        desc: 'Score 65-79' },
  C: { color: '#d97706', bg: '#fffbeb', label: 'Satisfactory',desc: 'Score 50-64' },
  D: { color: '#dc2626', bg: '#fef2f2', label: 'Poor',        desc: 'Score < 50' },
};

const COMPONENT_COLORS = {
  quality:  '#1d4ed8',
  delivery: '#16a34a',
  scar:     '#d97706',
  docs:     '#7c3aed',
  price:    '#0891b2',
};

// ── AVL Tab ──────────────────────────────────────────────────────────────────
function AvlTab({ onViewVendor }) {
  const [avl, setAvl]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vendorApi.avl();
      setAvl(res?.data ?? res ?? []);
    } catch { message.error('Failed to load AVL'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = avl.filter((v) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return v.name?.toLowerCase().includes(s) || v.partner_code?.toLowerCase().includes(s);
  });

  const columns = [
    {
      title: '#', key: 'rank', width: 50, align: 'center',
      render: (_, __, i) => <Text style={{ fontWeight: 600, color: '#6b7280' }}>{i + 1}</Text>,
    },
    {
      title: 'Vendor', dataIndex: 'name', key: 'name', width: 220,
      render: (v, r) => (
        <div>
          <Text style={{ fontWeight: 600 }}>{v}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.partner_code}</Text>
        </div>
      ),
    },
    {
      title: 'Score', dataIndex: 'total_score', key: 'score', width: 90, align: 'center',
      sorter: (a, b) => a.total_score - b.total_score,
      defaultSortOrder: 'descend',
      render: (v) => <Text style={{ fontWeight: 700, fontSize: 16 }}>{v}</Text>,
    },
    {
      title: 'Rating', dataIndex: 'rating', key: 'rating', width: 110, align: 'center',
      filters: [
        { text: 'A - Excellent', value: 'A' },
        { text: 'B - Good', value: 'B' },
        { text: 'C - Satisfactory', value: 'C' },
        { text: 'D - Poor', value: 'D' },
      ],
      onFilter: (value, record) => record.rating === value,
      render: (v) => {
        const cfg = RATING_CONFIG[v];
        return (
          <Tag color={cfg?.color} style={{ fontWeight: 700, fontSize: 13, padding: '2px 12px' }}>
            {v} - {cfg?.label}
          </Tag>
        );
      },
    },
    {
      title: 'Quality %', dataIndex: 'quality_pct', key: 'quality', width: 110, align: 'center',
      sorter: (a, b) => (a.quality_pct ?? -1) - (b.quality_pct ?? -1),
      render: (v) => v != null
        ? <Progress percent={v} size="small" strokeColor={COMPONENT_COLORS.quality} style={{ marginBottom: 0 }} />
        : <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Delivery %', dataIndex: 'delivery_pct', key: 'delivery', width: 110, align: 'center',
      sorter: (a, b) => (a.delivery_pct ?? -1) - (b.delivery_pct ?? -1),
      render: (v) => v != null
        ? <Progress percent={v} size="small" strokeColor={COMPONENT_COLORS.delivery} style={{ marginBottom: 0 }} />
        : <Text type="secondary">N/A</Text>,
    },
    {
      title: 'SCAR %', dataIndex: 'scar_pct', key: 'scar', width: 110, align: 'center',
      sorter: (a, b) => (a.scar_pct ?? -1) - (b.scar_pct ?? -1),
      render: (v) => v != null
        ? <Progress percent={v} size="small" strokeColor={COMPONENT_COLORS.scar} style={{ marginBottom: 0 }} />
        : <Text type="secondary">N/A</Text>,
    },
    {
      title: '', key: 'action', width: 100, align: 'center',
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => onViewVendor(r.id)}>
          View Scorecard
        </Button>
      ),
    },
  ];

  return (
    <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      bodyStyle={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <Input
          placeholder="Search vendor..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260, borderRadius: 8 }}
          allowClear
        />
        <div style={{ flex: 1 }} />
        <Tag color="blue">Total: {avl.length}</Tag>
        <Tag color="green">A-Rated: {avl.filter((v) => v.rating === 'A').length}</Tag>
        <Tag color="red">D-Rated: {avl.filter((v) => v.rating === 'D').length}</Tag>
        <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('supplier-scorecard.csv', filtered, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        columns={columns}
        size="small"
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ['15', '30', '50'] }}
        scroll={{ x: 900 }}
      />
    </Card>
  );
}

// ── Scorecard Tab ────────────────────────────────────────────────────────────
function ScorecardTab({ initialVendorId }) {
  const [vendors,    setVendors]    = useState([]);
  const [vendorId,   setVendorId]   = useState(initialVendorId || null);
  const [scorecard,  setScorecard]  = useState(null);
  const [trend,      setTrend]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [trendLoad,  setTrendLoad]  = useState(false);

  useEffect(() => {
    vendorApi.getAll({ type: 'vendor', is_active: true }).catch(() => ({ data: [] })).then((res) => {
      setVendors(Array.isArray(res) ? res : (res?.data ?? []));
    });
  }, []);

  useEffect(() => {
    if (initialVendorId) {
      setVendorId(initialVendorId);
    }
  }, [initialVendorId]);

  const onLoad = useCallback(async (id) => {
    const vid = id || vendorId;
    if (!vid) { message.warning('Select a vendor first'); return; }
    setLoading(true);
    setScorecard(null);
    setTrend(null);
    try {
      const [scRes, trRes] = await Promise.all([
        vendorApi.scorecard(vid),
        vendorApi.trend(vid),
      ]);
      setScorecard(scRes?.data ?? scRes);
      setTrend(trRes?.data ?? trRes);
    } catch (err) {
      message.error(err?.message || 'Failed to load scorecard');
    } finally { setLoading(false); }
  }, [vendorId]);

  // Auto-load when initialVendorId changes
  useEffect(() => {
    if (initialVendorId) onLoad(initialVendorId);
  }, [initialVendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const componentColumns = [
    {
      title: 'Component', dataIndex: 'label', key: 'label', width: 200,
      render: (v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: COMPONENT_COLORS[r.key] || '#6b7280' }} />
          <Text style={{ fontWeight: 600 }}>{v}</Text>
        </div>
      ),
    },
    {
      title: 'Weight', dataIndex: 'weight', key: 'weight', width: 80, align: 'center',
      render: (v) => <Tag>{v}%</Tag>,
    },
    {
      title: 'Score', key: 'score', width: 200,
      render: (_, r) => (
        <Progress
          percent={r.pct ?? (r.score != null ? Math.round((r.score / r.weight) * 100) : null)}
          size="small"
          strokeColor={COMPONENT_COLORS[r.key]}
          style={{ marginBottom: 0 }}
          format={(p) => p != null ? `${p}%` : 'N/A'}
        />
      ),
    },
    {
      title: 'Weighted', dataIndex: 'score', key: 'weighted', width: 90, align: 'right',
      render: (v) => v != null
        ? <Text style={{ fontWeight: 700, color: '#1d4ed8' }}>{v} pts</Text>
        : <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Detail', dataIndex: 'detail', key: 'detail',
      render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
  ];

  const rating = scorecard ? RATING_CONFIG[scorecard.rating] : null;

  // Build trend chart data
  const trendData = trend
    ? trend.months.map((m, i) => ({ month: m, Quality: trend.quality[i], Delivery: trend.delivery[i] }))
    : [];

  return (
    <>
      {/* Vendor selector */}
      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24 }}
        bodyStyle={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 260 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Vendor / Supplier</Text>
            <Select
              showSearch placeholder="Select vendor..." optionFilterProp="label"
              value={vendorId} onChange={setVendorId}
              options={vendors.map((v) => ({ value: v.id, label: v.partner_code ? `${v.name} (${v.partner_code})` : v.name }))}
              style={{ width: '100%' }} size="large"
            />
          </div>
          <Button type="primary" size="large" onClick={() => onLoad()} loading={loading}
            icon={<ReloadOutlined />} disabled={!vendorId}>
            Generate Scorecard
          </Button>
        </div>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>Computing scorecard...</Text>
        </div>
      )}

      {scorecard && !loading && (
        <>
          {/* Overall score */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card style={{ border: `2px solid ${rating?.color}`, borderRadius: 12, background: rating?.bg, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center' }}
                bodyStyle={{ padding: '24px 20px' }}>
                <TrophyOutlined style={{ fontSize: 32, color: rating?.color, marginBottom: 8 }} />
                <div style={{ fontSize: 56, fontWeight: 800, color: rating?.color, lineHeight: 1, marginBottom: 4 }}>
                  {scorecard.rating}
                </div>
                <Text style={{ fontSize: 15, fontWeight: 600, color: rating?.color }}>{rating?.label}</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{rating?.desc}</Text>
              </Card>
            </Col>
            <Col xs={24} sm={16}>
              <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', height: '100%' }}
                bodyStyle={{ padding: '20px 24px' }}>
                <Row gutter={[16, 16]} justify="space-around">
                  <Col span={12}>
                    <Statistic title="Total Score" value={scorecard.total_score} suffix="/ 100"
                      valueStyle={{ color: rating?.color, fontWeight: 700 }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="Vendor" value={scorecard.vendor?.name} valueStyle={{ fontSize: 16 }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="Partner Code" value={scorecard.vendor?.partner_code || '\u2014'} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="Period" value={scorecard.period} valueStyle={{ fontSize: 14 }} />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* Component breakdown */}
          <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24 }}
            bodyStyle={{ padding: '20px 24px' }}>
            <Divider orientation="left" style={{ fontWeight: 600, color: '#374151', fontSize: 13 }}>
              Score Components
            </Divider>
            <Table rowKey="key" dataSource={scorecard.components || []} columns={componentColumns}
              size="small" pagination={false} scroll={{ x: 700 }} />
          </Card>

          {/* Monthly Trend Chart */}
          {trendData.length > 0 && (
            <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              bodyStyle={{ padding: '20px 24px' }}>
              <Divider orientation="left" style={{ fontWeight: 600, color: '#374151', fontSize: 13 }}>
                Monthly Trend (Quality &amp; Delivery)
              </Divider>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => v != null ? `${v}%` : 'N/A'} />
                  <Legend />
                  <Line type="monotone" dataKey="Quality" stroke={COMPONENT_COLORS.quality}
                    strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="Delivery" stroke={COMPONENT_COLORS.delivery}
                    strokeWidth={2} dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SupplierScorecardPage() {
  const [activeTab, setActiveTab]             = useState('avl');
  const [selectedVendorId, setSelectedVendorId] = useState(null);

  const handleViewVendor = (vendorId) => {
    setSelectedVendorId(vendorId);
    setActiveTab('scorecard');
  };

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Supplier Scorecard</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Supplier Scorecard</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Evaluate vendor performance across Quality (40%), Delivery (25%), SCAR (20%), Documentation (10%), and Price (5%).
      </Text>

      <div style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'avl',
              label: (
                <span><UnorderedListOutlined style={{ marginRight: 6 }} />Approved Vendor List</span>
              ),
              children: <AvlTab onViewVendor={handleViewVendor} />,
            },
            {
              key: 'scorecard',
              label: (
                <span><BarChartOutlined style={{ marginRight: 6 }} />Vendor Scorecard</span>
              ),
              children: <ScorecardTab initialVendorId={selectedVendorId} />,
            },
          ]}
        />
      </div>
    </AppLayout>
  );
}
