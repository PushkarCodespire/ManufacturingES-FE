import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Modal, Button, Typography, Divider } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';

const { Text, Title } = Typography;

/**
 * QrLabelPrint — modal with printable QR label.
 * Uses canvas-based QR and converts to data URL for reliable printing.
 */
export default function QrLabelPrint({ open, onClose, type, identifier, code, title, subtitle }) {
  const canvasContainerRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const id = identifier || code || '';
  const qrData = `DT:${type}:${id}`;

  // After the QRCodeCanvas renders, grab its data URL
  useEffect(() => {
    if (!open) { setQrDataUrl(null); return; }
    // Small delay to let QRCodeCanvas render
    const timer = setTimeout(() => {
      const canvas = canvasContainerRef.current?.querySelector('canvas');
      if (canvas) {
        setQrDataUrl(canvas.toDataURL('image/png'));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [open, qrData]);

  const handlePrint = useCallback(() => {
    if (!qrDataUrl) return;

    const printWindow = window.open('', '_blank', 'width=500,height=500');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Label — ${id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            display: flex;
            justify-content: center;
          }
          .label {
            border: 2px solid #ccc;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            max-width: 380px;
            width: 100%;
          }
          .header {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #888;
          }
          .divider {
            border: none;
            border-top: 1px solid #e0e0e0;
            margin: 10px 0;
          }
          .content {
            display: flex;
            align-items: center;
            gap: 18px;
            justify-content: center;
          }
          .qr-img { width: 140px; height: 140px; }
          .info { text-align: left; }
          .info .label-text { font-size: 11px; color: #888; display: block; }
          .info .id-text { font-size: 20px; font-weight: 700; margin: 4px 0; display: block; }
          .info .sub-text { font-size: 12px; color: #666; display: block; }
          .footer { font-size: 9px; color: #aaa; }
          @media print {
            body { padding: 10px; }
            .label { border: 1px solid #999; }
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">Dynatech ONE</div>
          <hr class="divider" />
          <div class="content">
            <img class="qr-img" src="${qrDataUrl}" alt="QR Code" />
            <div class="info">
              <span class="label-text">${title || ''}</span>
              <span class="id-text">${id}</span>
              ${subtitle ? `<span class="sub-text">${subtitle}</span>` : ''}
            </div>
          </div>
          <hr class="divider" />
          <div class="footer">${qrData}</div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }, [qrDataUrl, id, title, subtitle, qrData]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="QR Label Preview"
      width={420}
      destroyOnClose
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint} disabled={!qrDataUrl}>
          Print Label
        </Button>,
      ]}
    >
      {/* Hidden canvas for generating QR data URL */}
      <div ref={canvasContainerRef} style={{ position: 'absolute', left: -9999, top: -9999 }}>
        <QRCodeCanvas value={qrData} size={280} level="M" includeMargin={false} />
      </div>

      {/* Visible preview */}
      <div
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
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" style={{ width: 140, height: 140 }} />
          ) : (
            <div style={{ width: 140, height: 140, background: '#f5f5f5', borderRadius: 8 }} />
          )}
          <div style={{ textAlign: 'left' }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{title}</Text>
            <Title level={4} style={{ margin: '4px 0', fontSize: 18 }}>{id}</Title>
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
