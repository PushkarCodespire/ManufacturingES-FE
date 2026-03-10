import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const DispatchNoteTemplate = forwardRef(({ order, company }, ref) => {
  const items = order?.Items || [];
  const customer = order?.Customer || {};
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
  const totalWeight = items.reduce((s, i) => s + parseFloat(i.weight || 0), 0);

  return (
    <div ref={ref} className="print-document">
      <div className="doc-header">
        <div className="company-info">
          <p className="company-name">{company?.name}</p>
          <p className="company-detail">{company?.address}</p>
          <p className="company-detail">Phone: {company?.phone} | Email: {company?.email}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">Dispatch Note</p>
          <p className="doc-number">{order?.order_number}</p>
          <p className="doc-date">Date: {order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : dayjs().format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="info-item"><label>Customer</label><span>{customer.name || '—'}</span></div>
        <div className="info-item"><label>Destination</label><span>{order?.shipping_address || customer.shipping_address || '—'}</span></div>
        <div className="info-item"><label>Transporter</label><span>{order?.Transporter?.name || '—'}</span></div>
        <div className="info-item"><label>Vehicle No</label><span>{order?.vehicle_number || '—'}</span></div>
        <div className="info-item"><label>Driver Name</label><span>{order?.driver_name || '—'}</span></div>
        <div className="info-item"><label>Driver Phone</label><span>{order?.driver_phone || '—'}</span></div>
        <div className="info-item"><label>Expected Delivery</label><span>{order?.expected_delivery_date ? dayjs(order.expected_delivery_date).format('DD MMM YYYY') : '—'}</span></div>
        <div className="info-item"><label>Status</label><span>{order?.status?.toUpperCase() || '—'}</span></div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Item Code</th>
            <th>Description</th>
            <th className="right">Qty</th>
            <th>Unit</th>
            <th className="right">Weight (kg)</th>
            <th>Remarks</th>
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
              <td className="right">{it.weight ? parseFloat(it.weight).toFixed(2) : '—'}</td>
              <td>{it.notes || ''}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL</td>
            <td className="right">{totalQty.toLocaleString()}</td>
            <td />
            <td className="right">{totalWeight.toFixed(2)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="info-item"><label>Total Items</label><span>{items.length}</span></div>
        <div className="info-item"><label>Total Packages</label><span>{order?.total_packages || items.length}</span></div>
        <div className="info-item"><label>Gross Weight</label><span>{order?.total_weight || totalWeight.toFixed(2)} kg</span></div>
      </div>

      {order?.notes && (
        <div className="notes-section">
          <div className="notes-title">Special Instructions</div>
          {order.notes}
        </div>
      )}

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Prepared By</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Dispatch Incharge</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Security</div></div>
      </div>

      <div className="doc-footer">This is a computer-generated document. | {company?.name}</div>
    </div>
  );
});

DispatchNoteTemplate.displayName = 'DispatchNoteTemplate';
export default DispatchNoteTemplate;
