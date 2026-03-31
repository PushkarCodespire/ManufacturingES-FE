import React from 'react';
import { Typography, Card, Row, Col, Button } from 'antd';
import {
  RightOutlined,
  ToolOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  CarOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';

const { Title, Text } = Typography;

const REPORT_CARDS = [
  {
    key: 'production',
    title: 'Production Report',
    description: 'Work orders with date filters, status breakdown and cycle time analysis.',
    icon: <ToolOutlined style={{ fontSize: 28, color: '#dc2626' }} />,
    path: '/production/work-orders',
    color: '#fef2f2',
    border: '#fecaca',
  },
  {
    key: 'job-cards',
    title: 'Job Card Report',
    description: 'Job card completion, operator performance and machine utilisation data.',
    icon: <FileTextOutlined style={{ fontSize: 28, color: '#b45309' }} />,
    path: '/production/job-cards',
    color: '#fffbeb',
    border: '#fde68a',
  },
  {
    key: 'quality',
    title: 'Quality Report',
    description: 'IQC inspection results, pass/fail rates and supplier quality trends.',
    icon: <CheckCircleOutlined style={{ fontSize: 28, color: '#16a34a' }} />,
    path: '/production/iqc',
    color: '#f0fdf4',
    border: '#bbf7d0',
  },
  {
    key: 'inventory',
    title: 'Inventory Report',
    description: 'Stock levels, reorder alerts, item movement and valuation summary.',
    icon: <DatabaseOutlined style={{ fontSize: 28, color: '#7c3aed' }} />,
    path: '/store/inventory-dashboard',
    color: '#f5f3ff',
    border: '#ddd6fe',
  },
  {
    key: 'purchase-orders',
    title: 'Purchase Orders',
    description: 'PO status tracking, vendor-wise spend and delivery compliance.',
    icon: <ShoppingCartOutlined style={{ fontSize: 28, color: '#0d9488' }} />,
    path: '/procurement/purchase-orders',
    color: '#f0fdfa',
    border: '#99f6e4',
  },
  {
    key: 'grn',
    title: 'GRN Report',
    description: 'Goods received notes, pending inspections and supplier receipts.',
    icon: <InboxOutlined style={{ fontSize: 28, color: '#1d4ed8' }} />,
    path: '/store/grn',
    color: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    key: 'dispatch',
    title: 'Dispatch Report',
    description: 'Dispatch orders, shipment tracking and on-time delivery metrics.',
    icon: <CarOutlined style={{ fontSize: 28, color: '#92400e' }} />,
    path: '/dispatch/orders',
    color: '#fef3c7',
    border: '#fde68a',
  },
  {
    key: 'executive',
    title: 'Executive Report',
    description: 'Plant-wide KPI summary for senior management with print/PDF export.',
    icon: <LineChartOutlined style={{ fontSize: 28, color: '#1d4ed8' }} />,
    path: '/reports/executive',
    color: '#eff6ff',
    border: '#bfdbfe',
  },
];

export default function ReportsHub() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Home</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Reports</Text>
      </div>

      {/* Title */}
      <Title level={3} style={{ margin: 0 }}>Reports &amp; Data Export</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Generate reports and export data from any module.
      </Text>

      {/* Card Grid */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        {REPORT_CARDS.map((card) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={card.key}>
            <Card
              hoverable
              style={{
                border: `1px solid ${card.border}`,
                borderRadius: 12,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
              bodyStyle={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  background: card.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                {card.icon}
              </div>

              <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 6 }}>
                {card.title}
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', flex: 1, marginBottom: 16 }}>
                {card.description}
              </Text>

              <Button
                type="primary"
                block
                onClick={() => navigate(card.path)}
                style={{ background: '#1d4ed8', borderColor: '#1d4ed8', borderRadius: 8 }}
              >
                View &amp; Export
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </AppLayout>
  );
}
