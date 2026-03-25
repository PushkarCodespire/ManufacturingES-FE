import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Descriptions, Table, Tag, Steps, Spin, Button, Space, Divider, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, RightOutlined, CheckCircleFilled, ClockCircleFilled,
  CloseCircleFilled, MinusCircleFilled, ReloadOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import { customerOrderApi } from '../../../api/orders.api';
import aiApi              from '../../../api/ai.api';
import useAiSuggestion    from '../../../hooks/useAiSuggestion';
import AiSuggestionCard   from '../../../components/AiSuggestion/AiSuggestionCard';

const { Title, Text } = Typography;

const STATUS_COLORS = {
  active: 'blue', in_production: 'orange', ready: 'cyan', dispatched: 'geekblue',
  closed: 'green', cancelled: 'red',
};

const fmtDate = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';
const fmtCurrency = (v) => v != null
  ? `₹ ${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  : '—';

const STEP_ICON = {
  completed:   <CheckCircleFilled style={{ color: '#16a34a' }} />,
  in_progress: <ClockCircleFilled style={{ color: '#d97706' }} />,
  failed:      <CloseCircleFilled style={{ color: '#dc2626' }} />,
  pending:     <MinusCircleFilled style={{ color: '#9ca3af' }} />,
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const aiHealth = useAiSuggestion(aiApi.getHealthSummary);

  const load = async () => {
    setLoading(true);
    try {
      const res = await customerOrderApi.getDetail(id);
      setData(res?.data || res);
    } catch { /* handled below */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <AppLayout><Spin size="large" style={{ display: 'block', margin: '100px auto' }} /></AppLayout>;
  if (!data?.order) return <AppLayout><Alert type="error" message="Order not found" showIcon /></AppLayout>;

  const { order, workOrders = [], oqcInspections = [], pqcInspections = [], dispatchOrders = [], timeline = [] } = data;
  const customer = order.Customer || {};
  const items    = order.Items || [];

  // Delivery status
  const daysLeft = order.delivery_date
    ? dayjs(order.delivery_date).diff(dayjs(), 'day')
    : null;

  const woColumns = [
    { title: 'WO No', dataIndex: 'wo_no', key: 'wo', render: (v) => <Text strong style={{ color: '#1d4ed8' }}>{v}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'st', render: (s) => <Tag color={s === 'completed' ? 'green' : s === 'in_progress' ? 'orange' : 'default'}>{s}</Tag> },
    { title: 'Planned Qty', dataIndex: 'planned_qty', key: 'pq', align: 'right' },
    { title: 'Produced Qty', dataIndex: 'produced_qty', key: 'prq', align: 'right' },
    { title: 'Start Date', dataIndex: 'start_date', key: 'sd', render: fmtDate },
    { title: 'End Date', dataIndex: 'end_date', key: 'ed', render: fmtDate },
  ];

  const qcColumns = [
    { title: 'Inspection No', dataIndex: 'inspection_no', key: 'no', render: (v) => <Text strong>{v}</Text> },
    { title: 'Type', key: 'type', render: (_, r) => <Tag>{r.inspection_no?.startsWith('OQC') ? 'OQC' : r.type || 'PQC'}</Tag> },
    { title: 'Item', key: 'item', render: (_, r) => r.Item?.name || '—' },
    { title: 'Date', dataIndex: 'inspection_date', key: 'date', render: fmtDate },
    { title: 'Qty Insp.', dataIndex: 'qty_inspected', key: 'qi', align: 'right' },
    { title: 'Qty Rej.', dataIndex: 'qty_rejected', key: 'qr', align: 'right', render: (v) => v > 0 ? <Text type="danger">{v}</Text> : v ?? 0 },
    { title: 'Result', dataIndex: 'result', key: 'res', render: (r) => <Tag color={r === 'pass' ? 'green' : r === 'fail' ? 'red' : 'orange'}>{r?.toUpperCase()}</Tag> },
    { title: 'Cert', key: 'cert', render: (_, r) => r.cert_no ? <Tag color="purple">{r.cert_no}</Tag> : '—' },
  ];

  const dispatchColumns = [
    { title: 'Dispatch No', dataIndex: 'order_number', key: 'no', render: (v) => <Text strong style={{ color: '#1d4ed8' }}>{v}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'st', render: (s) => <Tag color={s === 'delivered' ? 'green' : s === 'dispatched' ? 'blue' : 'default'}>{s}</Tag> },
    { title: 'Dispatch Date', dataIndex: 'dispatch_date', key: 'dd', render: fmtDate },
    { title: 'Expected Delivery', dataIndex: 'expected_delivery_date', key: 'ed', render: fmtDate },
    { title: 'Actual Delivery', dataIndex: 'actual_delivery_date', key: 'ad', render: fmtDate },
  ];

  const allQc = [...oqcInspections, ...pqcInspections].sort((a, b) =>
    new Date(b.inspection_date) - new Date(a.inspection_date)
  );

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={() => navigate('/orders/customer-po')}>
          Customer PO
        </Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{order.order_no}</Text>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders/customer-po')} style={{ marginRight: 8 }} />
            Order {order.order_no}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Customer PO: {order.customer_po_no} | {customer.name || '—'}
          </Text>
        </div>
        <Space>
          <Tag color={STATUS_COLORS[order.status] || 'default'} style={{ fontSize: 13, padding: '2px 12px' }}>
            {order.status?.replace('_', ' ').toUpperCase()}
          </Tag>
          <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        </Space>
      </div>

      {/* AI Health Summary */}
      <AiSuggestionCard
        title="Madad Health Summary"
        loading={aiHealth.loading}
        error={aiHealth.error}
        aiAvailable={aiHealth.aiAvailable}
        cached={aiHealth.cached}
        onDismiss={() => aiHealth.reset()}
        onRetry={() => aiHealth.fetch(id)}
        style={{ marginBottom: 16 }}
      >
        {aiHealth.data?.data ? (
          <div>
            <Tag color={aiHealth.data.data.health_status === 'green' ? 'success' : aiHealth.data.data.health_status === 'yellow' ? 'warning' : 'error'}>
              {aiHealth.data.data.health_status?.toUpperCase()}
            </Tag>
            <Text style={{ fontSize: 12, whiteSpace: 'pre-line', display: 'block', marginTop: 6 }}>
              {aiHealth.data.data.summary_hinglish}
            </Text>
            {aiHealth.data.data.alerts?.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {aiHealth.data.data.alerts.map((a, i) => <Tag key={i} color="volcano" style={{ fontSize: 11 }}>{a}</Tag>)}
              </div>
            )}
          </div>
        ) : !aiHealth.loading && (
          <Button size="small" type="primary" onClick={() => aiHealth.fetch(id)}>Get Health Summary</Button>
        )}
      </AiSuggestionCard>

      {/* Order Info */}
      <Card style={{ marginBottom: 16, border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: 20 }}>
        <Descriptions column={4} size="small">
          <Descriptions.Item label="Order Date">{fmtDate(order.order_date)}</Descriptions.Item>
          <Descriptions.Item label="Delivery Date">
            <span style={{ color: daysLeft != null && daysLeft < 0 ? '#dc2626' : daysLeft != null && daysLeft <= 3 ? '#d97706' : '#16a34a' }}>
              {fmtDate(order.delivery_date)}
              {daysLeft != null && ` (${daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})`}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Amount">{fmtCurrency(order.total_amount)}</Descriptions.Item>
          <Descriptions.Item label="Quotation">{order.Quotation?.quotation_no || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Traceability Timeline */}
      <Card
        title="Order Progress"
        style={{ marginBottom: 16, border: '1px solid #e8eaed', borderRadius: 12 }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <Steps
          current={timeline.findIndex((s) => s.status === 'in_progress' || s.status === 'pending') - 1}
          items={timeline.map((step) => ({
            title: step.step,
            description: step.date ? fmtDate(step.date) : step.count ? `${step.count} record(s)` : null,
            icon: STEP_ICON[step.status] || STEP_ICON.pending,
            status: step.status === 'completed' ? 'finish' : step.status === 'in_progress' ? 'process' : step.status === 'failed' ? 'error' : 'wait',
          }))}
        />
      </Card>

      {/* Order Items */}
      <Card
        title={`Order Items (${items.length})`}
        style={{ marginBottom: 16, border: '1px solid #e8eaed', borderRadius: 12 }}
        bodyStyle={{ padding: '12px 20px' }}
      >
        <Table
          rowKey="id" size="small" pagination={false} scroll={{ x: 800 }} dataSource={items}
          columns={[
            { title: 'Item Code', key: 'code', render: (_, r) => r.Item?.code || '—' },
            { title: 'Description', key: 'desc', render: (_, r) => r.Item?.name || r.description || '—' },
            { title: 'Qty Ordered', dataIndex: 'qty_ordered', align: 'right' },
            { title: 'Qty Delivered', dataIndex: 'qty_delivered', align: 'right',
              render: (v, r) => <Text style={{ color: v >= r.qty_ordered ? '#16a34a' : '#d97706' }}>{v ?? 0}</Text> },
            { title: 'Unit', dataIndex: 'unit' },
            { title: 'Unit Price', dataIndex: 'unit_price', align: 'right', render: fmtCurrency },
          ]}
        />
      </Card>

      {/* Work Orders */}
      {workOrders.length > 0 && (
        <Card
          title={`Work Orders (${workOrders.length})`}
          style={{ marginBottom: 16, border: '1px solid #e8eaed', borderRadius: 12 }}
          bodyStyle={{ padding: '12px 20px' }}
        >
          <Table rowKey="id" size="small" pagination={false} scroll={{ x: 800 }} dataSource={workOrders} columns={woColumns} />
        </Card>
      )}

      {/* Quality Inspections */}
      {allQc.length > 0 && (
        <Card
          title={`Quality Inspections (${allQc.length})`}
          style={{ marginBottom: 16, border: '1px solid #e8eaed', borderRadius: 12 }}
          bodyStyle={{ padding: '12px 20px' }}
        >
          <Table rowKey="id" size="small" pagination={false} scroll={{ x: 800 }} dataSource={allQc} columns={qcColumns} />
        </Card>
      )}

      {/* Dispatch */}
      {dispatchOrders.length > 0 && (
        <Card
          title={`Dispatch Records (${dispatchOrders.length})`}
          style={{ marginBottom: 16, border: '1px solid #e8eaed', borderRadius: 12 }}
          bodyStyle={{ padding: '12px 20px' }}
        >
          <Table rowKey="id" size="small" pagination={false} scroll={{ x: 800 }} dataSource={dispatchOrders} columns={dispatchColumns} />
        </Card>
      )}

      {/* Empty state */}
      {!workOrders.length && !allQc.length && !dispatchOrders.length && (
        <Alert
          type="info" showIcon
          message="No linked production, quality, or dispatch records yet."
          description="Records will appear here as work orders, inspections, and dispatch orders are created for this customer order."
          style={{ borderRadius: 8 }}
        />
      )}
    </AppLayout>
  );
}
