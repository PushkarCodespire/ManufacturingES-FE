import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Button, Select, InputNumber, Table, Tag,
  message, Alert, Spin, Descriptions, Divider,
} from 'antd';
import {
  RightOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import AppLayout      from '../../../components/AppLayout';
import { bomApi }     from '../../../api/bom.api';
import { itemApi }    from '../../../api/item.api';

const { Title, Text } = Typography;

export default function BOMExplosionPage() {
  const [items,       setItems]       = useState([]);
  const [itemId,      setItemId]      = useState(null);
  const [plannedQty,  setPlannedQty]  = useState(1);
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    itemApi.getAll({ limit: 1000 }).catch(() => ({ data: [] })).then((res) => {
      const arr = Array.isArray(res) ? res : (res?.data ?? []);
      setItems(arr);
    });
  }, []);

  const onExplode = async () => {
    if (!itemId) { message.warning('Select an item first'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await bomApi.explode({ item_id: itemId, planned_qty: plannedQty });
      setResult(res?.data ?? res);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Explosion failed');
    } finally { setLoading(false); }
  };

  const SHORTAGE_COL_COLOR = (row) => row.shortage ? '#fef2f2' : undefined;

  const columns = [
    {
      title: 'Component', key: 'component', width: 220,
      render: (_, r) => (
        <div>
          <Text style={{ fontWeight: 600, fontSize: 13 }}>{r.item?.name || '—'}</Text>
          {r.item?.code && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.item.code}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'BOM Qty/Unit', key: 'bom_qty', width: 120, align: 'right',
      render: (_, r) => (
        <Text>{r.bom_qty_per_unit} {r.unit || ''}</Text>
      ),
    },
    {
      title: 'Gross Requirement', dataIndex: 'gross_req', key: 'gross_req', width: 140, align: 'right',
      render: (v, r) => <Text style={{ fontWeight: 600 }}>{v} {r.unit || ''}</Text>,
    },
    {
      title: 'Current Stock', dataIndex: 'current_stock', key: 'current_stock', width: 130, align: 'right',
      render: (v, r) => (
        <Text style={{ color: v > 0 ? '#16a34a' : '#6b7280' }}>
          {v} {r.unit || ''}
        </Text>
      ),
    },
    {
      title: 'Net Requirement', dataIndex: 'net_req', key: 'net_req', width: 140, align: 'right',
      render: (v, r) => (
        <Text style={{ fontWeight: 700, color: r.shortage ? '#dc2626' : '#16a34a' }}>
          {v} {r.unit || ''}
        </Text>
      ),
      onCell: (r) => ({ style: { background: SHORTAGE_COL_COLOR(r) } }),
    },
    {
      title: 'Status', key: 'status', width: 110, align: 'center',
      render: (_, r) => r.shortage
        ? <Tag color="red" icon={<WarningOutlined />}>Shortage</Tag>
        : <Tag color="green" icon={<CheckCircleOutlined />}>OK</Tag>,
    },
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>BOM Explosion</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>BOM Explosion</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Explode a BOM to calculate gross and net material requirements for a planned production quantity.
      </Text>

      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '20px 24px' }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 220 }}>
              <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                Finished Good / Item
              </Text>
              <Select
                showSearch
                placeholder="Select item to explode..."
                optionFilterProp="label"
                value={itemId}
                onChange={setItemId}
                options={items.map((i) => ({
                  value: i.id,
                  label: i.code ? `${i.name} (${i.code})` : i.name,
                }))}
                style={{ width: '100%' }}
                size="large"
              />
            </div>
            <div style={{ flex: 0 }}>
              <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>
                Planned Qty
              </Text>
              <InputNumber
                min={0.001}
                step={1}
                value={plannedQty}
                onChange={(v) => setPlannedQty(v || 1)}
                size="large"
                style={{ width: 120 }}
              />
            </div>
            <Button
              type="primary"
              size="large"
              onClick={onExplode}
              loading={loading}
              icon={<ReloadOutlined />}
              disabled={!itemId}
            >
              Explode BOM
            </Button>
          </div>
        </Card>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
            Computing material requirements...
          </Text>
        </div>
      )}

      {result && !loading && (
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '20px 24px' }}
        >
          {/* Summary header */}
          <Descriptions
            bordered
            size="small"
            column={3}
            style={{ marginBottom: 20 }}
          >
            <Descriptions.Item label="Item">
              <Text style={{ fontWeight: 600 }}>
                {result.item?.name}
                {result.item?.code && (
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                    ({result.item.code})
                  </Text>
                )}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Planned Qty">
              <Text style={{ fontWeight: 600, fontSize: 15 }}>{result.planned_qty}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="BOM Status">
              <Tag color={result.bom_status === 'finalized' ? 'green' : 'orange'}>
                {result.bom_status}
              </Tag>
            </Descriptions.Item>
          </Descriptions>

          {result.has_shortage && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              message="Material Shortage Detected"
              description="One or more components have insufficient stock. Issue material requests or purchase orders for highlighted items."
              style={{ marginBottom: 16 }}
            />
          )}
          {!result.has_shortage && (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              message="Sufficient Stock Available"
              description="All components have enough stock to fulfill the planned quantity."
              style={{ marginBottom: 16 }}
            />
          )}

          <Divider orientation="left" style={{ fontWeight: 600, color: '#374151', fontSize: 13 }}>
            Component Requirements ({result.explosion?.length || 0} components)
          </Divider>

          <Table
            rowKey="component_item_id"
            dataSource={result.explosion || []}
            columns={columns}
            size="small"
            pagination={false}
            scroll={{ x: 860 }}
            rowClassName={(r) => r.shortage ? 'shortage-row' : ''}
          />
        </Card>
      )}
    </AppLayout>
  );
}
