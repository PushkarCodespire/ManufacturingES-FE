import React, { useRef } from 'react';
import { Modal, Button, Typography, Divider } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useReactToPrint } from 'react-to-print';

const { Text, Title } = Typography;

const QR_API = 'https://api.qrserver.com/v1/create-qr-code/';

/**
 * QrLabelPrint — modal with printable QR label.
 *
 * Props:
 *   open       : boolean
 *   onClose    : () => void
 *   type       : string  e.g. 'WO', 'GRN', 'INST'
 *   identifier : string  e.g. 'WO-2026-0001'
 *   title      : string  e.g. 'Work Order'
 *   subtitle   : string  optional extra line (item name, etc.)
 */
export default function QrLabelPrint({ open, onClose, type, identifier, title, subtitle }) {
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const qrData  = `DT:${type}:${identifier}`;
  const qrUrl   = `${QR_API}?size=180x180&data=${encodeURIComponent(qrData)}&ecc=M&margin=4`;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="QR Label Preview"
      width={420}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
          Print Label
        </Button>,
      ]}
    >
      <div
        ref={printRef}
        style={{
          border: '2px solid #e8eaed',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          background: '#fff',
        }}
      >
        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
          Dynatech ONE
        </Text>
        <Divider style={{ margin: '8px 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center' }}>
          <img
            src={qrUrl}
            alt={`QR: ${qrData}`}
            style={{ width: 140, height: 140 }}
            crossOrigin="anonymous"
          />
          <div style={{ textAlign: 'left' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{title}</Text>
            <Title level={4} style={{ margin: '4px 0', fontSize: 18 }}>{identifier}</Title>
            {subtitle && (
              <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>{subtitle}</Text>
            )}
          </div>
        </div>

        <Divider style={{ margin: '12px 0 4px' }} />
        <Text style={{ fontSize: 9, color: '#9ca3af' }}>{qrData}</Text>
      </div>
    </Modal>
  );
}
