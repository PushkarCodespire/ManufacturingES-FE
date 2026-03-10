import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Card, Row, Col, Button, Spin, Modal, message, Tag, Tooltip } from 'antd';
import {
  RightOutlined, PrinterOutlined, EyeOutlined, ArrowLeftOutlined,
  FileTextOutlined, FileDoneOutlined, CarOutlined, SafetyCertificateOutlined,
  AuditOutlined, SendOutlined, SwapOutlined, SecurityScanOutlined,
  TruckOutlined, BellOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import { dispatchOrderApi } from '../../../api/dispatchOrder.api';
import './printStyles.css';

import InvoiceTemplate         from './templates/InvoiceTemplate';
import PackingListTemplate     from './templates/PackingListTemplate';
import DeliveryChallanTemplate from './templates/DeliveryChallanTemplate';
import EWayBillTemplate        from './templates/EWayBillTemplate';
import TestCertificateTemplate from './templates/TestCertificateTemplate';
import COCTemplate             from './templates/COCTemplate';
import DispatchNoteTemplate    from './templates/DispatchNoteTemplate';
import MaterialTransferTemplate from './templates/MaterialTransferTemplate';
import GatePassTemplate        from './templates/GatePassTemplate';
import LorryReceiptTemplate    from './templates/LorryReceiptTemplate';
import CustomerNotificationTemplate from './templates/CustomerNotificationTemplate';

const { Title, Text } = Typography;

const DOC_TYPES = [
  { key: 'invoice',            label: 'Tax Invoice',                icon: <DollarOutlined />,         color: '#d97706', Component: InvoiceTemplate },
  { key: 'packing_list',       label: 'Packing List',               icon: <FileTextOutlined />,       color: '#1d4ed8', Component: PackingListTemplate },
  { key: 'delivery_challan',   label: 'Delivery Challan',           icon: <FileDoneOutlined />,       color: '#16a34a', Component: DeliveryChallanTemplate },
  { key: 'eway_bill',          label: 'E-Way Bill',                 icon: <CarOutlined />,            color: '#7c3aed', Component: EWayBillTemplate },
  { key: 'test_certificate',   label: 'Test Certificate',           icon: <SafetyCertificateOutlined />, color: '#0891b2', Component: TestCertificateTemplate },
  { key: 'coc',                label: 'Certificate of Conformance', icon: <AuditOutlined />,          color: '#0d9488', Component: COCTemplate },
  { key: 'dispatch_note',      label: 'Dispatch Note',              icon: <SendOutlined />,           color: '#6366f1', Component: DispatchNoteTemplate },
  { key: 'material_transfer',  label: 'Material Transfer Note',     icon: <SwapOutlined />,           color: '#ea580c', Component: MaterialTransferTemplate },
  { key: 'gate_pass',          label: 'Gate Pass',                  icon: <SecurityScanOutlined />,   color: '#dc2626', Component: GatePassTemplate },
  { key: 'lorry_receipt',      label: 'Lorry Receipt (LR)',         icon: <TruckOutlined />,          color: '#78716c', Component: LorryReceiptTemplate },
  { key: 'customer_notification', label: 'Customer Notification',   icon: <BellOutlined />,           color: '#be185d', Component: CustomerNotificationTemplate },
];

const DispatchDocumentsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Create refs for each doc type
  const printRefs = useRef({});
  DOC_TYPES.forEach((d) => {
    if (!printRefs.current[d.key]) printRefs.current[d.key] = React.createRef();
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dispatchOrderApi.getDocumentsData(id);
      setData(res);
    } catch {
      message.error('Failed to load dispatch order data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = useReactToPrint({
    contentRef: printRefs.current[previewDoc],
    documentTitle: previewDoc ? `${DOC_TYPES.find((d) => d.key === previewDoc)?.label} - ${data?.order?.order_number}` : 'Document',
  });

  const handlePrintSingle = (key) => {
    const ref = printRefs.current[key];
    if (!ref?.current) { message.warning('Document not ready'); return; }
    // Temporarily set for printing
    setPreviewDoc(key);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip="Loading dispatch order..." />
        </div>
      </AppLayout>
    );
  }

  if (!data?.order) {
    return (
      <AppLayout>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Text type="secondary" style={{ fontSize: 16 }}>Dispatch order not found</Text>
          <br />
          <Button type="link" onClick={() => navigate('/dispatch/orders')}>Back to Orders</Button>
        </div>
      </AppLayout>
    );
  }

  const { order, invoice, company } = data;

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={() => navigate('/dispatch/orders')}>Dispatch</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={() => navigate('/dispatch/orders')}>Orders</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{order.order_number}</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Documents</Text>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/dispatch/orders')} />
            <Title level={3} style={{ margin: 0 }}>Dispatch Documents</Title>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, marginLeft: 40 }}>
            <Tag color="blue">{order.order_number}</Tag>
            <Tag>{order.Customer?.name || 'No Customer'}</Tag>
            <Tag color="default">{order.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : 'No date'}</Tag>
            <Tag color={order.status === 'delivered' ? 'green' : order.status === 'dispatched' ? 'purple' : 'default'}>
              {order.status?.toUpperCase()}
            </Tag>
          </div>
        </div>
      </div>

      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 20 }}>
        Generate and print all 11 dispatch documents. Click Preview to view or Print to send directly to printer.
      </Text>

      {/* Document Cards Grid */}
      <Row gutter={[16, 16]}>
        {DOC_TYPES.map((doc) => (
          <Col xs={24} sm={12} lg={8} key={doc.key}>
            <Card
              style={{ borderRadius: 12, border: '1px solid #e8eaed', height: '100%', cursor: 'default' }}
              bodyStyle={{ padding: 20 }}
              hoverable
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, background: `${doc.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {React.cloneElement(doc.icon, { style: { fontSize: 20, color: doc.color } })}
                </div>
                <div style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: 600, color: '#111827', display: 'block' }}>{doc.label}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>Ready to generate</Text>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Tooltip title="Preview document">
                  <Button
                    icon={<EyeOutlined />}
                    size="small"
                    style={{ borderRadius: 6, flex: 1 }}
                    onClick={() => setPreviewDoc(doc.key)}
                  >
                    Preview
                  </Button>
                </Tooltip>
                <Tooltip title="Print document">
                  <Button
                    icon={<PrinterOutlined />}
                    type="primary"
                    size="small"
                    style={{ borderRadius: 6, flex: 1 }}
                    onClick={() => handlePrintSingle(doc.key)}
                  >
                    Print
                  </Button>
                </Tooltip>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Preview Modal */}
      <Modal
        open={!!previewDoc}
        onCancel={() => setPreviewDoc(null)}
        width={860}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {DOC_TYPES.find((d) => d.key === previewDoc)?.icon}
            <span>{DOC_TYPES.find((d) => d.key === previewDoc)?.label}</span>
          </div>
        }
        footer={[
          <Button key="close" onClick={() => setPreviewDoc(null)}>Close</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>,
        ]}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', background: '#f3f4f6', padding: 16 } }}
      >
        <div style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: 4 }}>
          {previewDoc && DOC_TYPES.map((doc) => (
            <div key={doc.key} style={{ display: previewDoc === doc.key ? 'block' : 'none' }}>
              <doc.Component ref={printRefs.current[doc.key]} order={order} invoice={invoice} company={company} />
            </div>
          ))}
        </div>
      </Modal>

      {/* Hidden print targets (for direct print without preview) */}
      <div style={{ display: 'none' }}>
        {DOC_TYPES.map((doc) => (
          <doc.Component key={doc.key} ref={printRefs.current[doc.key]} order={order} invoice={invoice} company={company} />
        ))}
      </div>
    </AppLayout>
  );
};

export default DispatchDocumentsPage;
