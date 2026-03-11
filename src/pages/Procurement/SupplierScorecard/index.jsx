import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Button, Select, Table, Tag,
  message, Spin, Progress, Row, Col, Statistic, Divider,
} from 'antd';
import {
  RightOutlined, ReloadOutlined, TrophyOutlined,
} from '@ant-design/icons';
import AppLayout        from '../../../components/AppLayout';
import { vendorApi }    from '../../../api/procurement.api';

const { Title, Text } = Typography;

const RATING_CONFIG = {
  A: { color: '#16a34a', bg: '#f0fdf4', label: 'Excellent',   desc: 'Score ≥ 80' },
  B: { color: '#2563eb', bg: '#eff6ff', label: 'Good',        desc: 'Score 65–79' },
  C: { color: '#d97706', bg: '#fffbeb', label: 'Satisfactory',desc: 'Score 50–64' },
  D: { color: '#dc2626', bg: '#fef2f2', label: 'Poor',        desc: 'Score < 50' },
};

const COMPONENT_COLORS = {
  quality:  '#1d4ed8',
  delivery: '#16a34a',
  scar:     '#d97706',
  docs:     '#7c3aed',
  price:    '#0891b2',
};

export default function SupplierScorecardPage() {
  const [vendors,  setVendors]  = useState([]);
  const [vendorId, setVendorId] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    vendorApi.getAll({ type: 'vendor', is_active: true }).catch(() => ({ data: [] })).then((res) => {
      const arr = Array.isArray(res) ? res : (res?.data ?? []);
      setVendors(arr);
    });
  }, []);

  const onLoad = async () => {
    if (!vendorId) { message.warning('Select a vendor first'); return; }
    setLoading(true);
    setScorecard(null);
    try {
      const res = await vendorApi.scorecard(vendorId);
      setScorecard(res?.data ?? res);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to load scorecard');
    } finally { setLoading(false); }
  };

  const columns = [
    {
      title: 'Component',
      dataIndex: 'label',
      key: 'label',
      width: 200,
      render: (v, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: COMPONENT_COLORS[r.key] || '#6b7280',
            }}
          />
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
          percent={r.pct ?? (r.score != null ? Math.round((r.score / (r.weight)) * 100) : null)}
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

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '20px 24px' }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 260 }}>
              <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                Vendor / Supplier
              </Text>
              <Select
                showSearch
                placeholder="Select vendor..."
                optionFilterProp="label"
                value={vendorId}
                onChange={setVendorId}
                options={vendors.map((v) => ({
                  value: v.id,
                  label: v.partner_code ? `${v.name} (${v.partner_code})` : v.name,
                }))}
                style={{ width: '100%' }}
                size="large"
              />
            </div>
            <Button
              type="primary"
              size="large"
              onClick={onLoad}
              loading={loading}
              icon={<ReloadOutlined />}
              disabled={!vendorId}
            >
              Generate Scorecard
            </Button>
          </div>
        </Card>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            Computing scorecard...
          </Text>
        </div>
      )}

      {scorecard && !loading && (
        <>
          {/* Overall score card */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card
                style={{
                  border: `2px solid ${rating?.color}`,
                  borderRadius: 12,
                  background: rating?.bg,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  textAlign: 'center',
                }}
                bodyStyle={{ padding: '24px 20px' }}
              >
                <TrophyOutlined style={{ fontSize: 32, color: rating?.color, marginBottom: 8 }} />
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 800,
                    color: rating?.color,
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  {scorecard.rating}
                </div>
                <Text style={{ fontSize: 15, fontWeight: 600, color: rating?.color }}>
                  {rating?.label}
                </Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                  {rating?.desc}
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={16}>
              <Card
                style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', height: '100%' }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <Row gutter={[16, 16]} justify="space-around">
                  <Col span={12}>
                    <Statistic
                      title="Total Score"
                      value={scorecard.total_score}
                      suffix="/ 100"
                      valueStyle={{ color: rating?.color, fontWeight: 700 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Vendor"
                      value={scorecard.vendor?.name}
                      valueStyle={{ fontSize: 16 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Partner Code"
                      value={scorecard.vendor?.partner_code || '—'}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Period"
                      value={scorecard.period}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* Component breakdown */}
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <Divider orientation="left" style={{ fontWeight: 600, color: '#374151', fontSize: 13 }}>
              Score Components
            </Divider>
            <Table
              rowKey="key"
              dataSource={scorecard.components || []}
              columns={columns}
              size="small"
              pagination={false}
              scroll={{ x: 700 }}
            />
          </Card>
        </>
      )}
    </AppLayout>
  );
}
