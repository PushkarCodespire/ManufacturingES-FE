import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const CustomerNotificationTemplate = forwardRef(({ order, company }, ref) => {
  const items = order?.Items || [];
  const customer = order?.Customer || {};
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);

  return (
    <div ref={ref} className="print-document">
      <div className="doc-header">
        <div className="company-info">
          <p className="company-name">{company?.name}</p>
          <p className="company-detail">{company?.address}</p>
          <p className="company-detail">Phone: {company?.phone} | Email: {company?.email}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">Dispatch Notification</p>
          <p className="doc-number">{order?.order_number}</p>
          <p className="doc-date">Date: {order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : dayjs().format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, margin: '0 0 4px' }}>To,</p>
        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>{customer.name || '—'}</p>
        <p style={{ fontSize: 12, color: '#374151', margin: '0 0 2px' }}>{customer.address || ''}</p>
        {customer.email && <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>Email: {customer.email}</p>}
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 16 }}>
        <p>Dear Sir/Madam,</p>
        <p>
          We are pleased to inform you that your order has been dispatched from our facility.
          Please find the shipment details below:
        </p>
      </div>

      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="info-item"><label>Dispatch Order No</label><span>{order?.order_number}</span></div>
        <div className="info-item"><label>Dispatch Date</label><span>{order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : '—'}</span></div>
        <div className="info-item"><label>Expected Delivery</label><span style={{ fontWeight: 700, color: '#1d4ed8' }}>{order?.expected_delivery_date ? dayjs(order.expected_delivery_date).format('DD MMM YYYY') : '—'}</span></div>
        <div className="info-item"><label>Transporter</label><span>{order?.Transporter?.name || '—'}</span></div>
        <div className="info-item"><label>Vehicle Number</label><span>{order?.vehicle_number || '—'}</span></div>
        <div className="info-item"><label>Driver Contact</label><span>{order?.driver_name || '—'} ({order?.driver_phone || ''})</span></div>
        <div className="info-item"><label>Challan No</label><span>{order?.Challans?.[0]?.challan_number || '—'}</span></div>
        <div className="info-item"><label>Total Packages</label><span>{order?.total_packages || items.length}</span></div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Item Code</th>
            <th>Description</th>
            <th className="right">Qty Dispatched</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id || idx}>
              <td className="center">{idx + 1}</td>
              <td>{it.Item?.code || '—'}</td>
              <td>{it.Item?.name || '—'}</td>
              <td className="right">{parseFloat(it.quantity).toLocaleString()}</td>
              <td>{it.unit || it.Item?.unit || 'pcs'}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL</td>
            <td className="right">{totalQty.toLocaleString()}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: 12, lineHeight: 1.8, marginBottom: 16, color: '#374151' }}>
        <p>
          Please acknowledge receipt of goods upon delivery. For any queries or concerns regarding this
          shipment, please contact our dispatch department at {company?.phone} or email {company?.email}.
        </p>
        <p style={{ marginTop: 8 }}>
          Thank you for your business.
        </p>
        <p style={{ marginTop: 16 }}>
          Warm regards,<br />
          <strong>{company?.name}</strong><br />
          Dispatch Department
        </p>
      </div>

      <div className="doc-footer">This is a computer-generated notification. | {company?.name}</div>
    </div>
  );
});

CustomerNotificationTemplate.displayName = 'CustomerNotificationTemplate';
export default CustomerNotificationTemplate;
