import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const GatePassTemplate = forwardRef(({ order, company }, ref) => {
  const items = order?.Items || [];
  const customer = order?.Customer || {};
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);

  return (
    <div ref={ref} className="print-document">
      <div className="doc-header">
        <div className="company-info">
          <p className="company-name">{company?.name}</p>
          <p className="company-detail">{company?.address}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">Gate Pass</p>
          <p className="doc-number">GP-{order?.order_number?.replace('DO-', '')}</p>
          <p className="doc-date">Date: {order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : dayjs().format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div style={{ border: '2px solid #dc2626', borderRadius: 8, padding: '12px 16px', marginBottom: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', margin: 0 }}>OUTWARD GATE PASS — MATERIAL EXIT AUTHORIZATION</p>
      </div>

      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="info-item"><label>Vehicle Number</label><span style={{ fontSize: 14, fontWeight: 700 }}>{order?.vehicle_number || '—'}</span></div>
        <div className="info-item"><label>Driver Name</label><span>{order?.driver_name || '—'}</span></div>
        <div className="info-item"><label>Driver Phone</label><span>{order?.driver_phone || '—'}</span></div>
        <div className="info-item"><label>Transporter</label><span>{order?.Transporter?.name || '—'}</span></div>
        <div className="info-item"><label>Destination</label><span>{customer.name || '—'}</span></div>
        <div className="info-item"><label>Dispatch Order</label><span>{order?.order_number}</span></div>
        <div className="info-item"><label>Challan No</label><span>{order?.Challans?.[0]?.challan_number || '—'}</span></div>
        <div className="info-item"><label>Total Packages</label><span>{order?.total_packages || items.length}</span></div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Description</th>
            <th className="right">Quantity</th>
            <th>Unit</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id || idx}>
              <td className="center">{idx + 1}</td>
              <td>{it.Item?.name || '—'} ({it.Item?.code || ''})</td>
              <td className="right">{parseFloat(it.quantity).toLocaleString()}</td>
              <td>{it.unit || it.Item?.unit || 'pcs'}</td>
              <td>{it.notes || ''}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={2} style={{ textAlign: 'right' }}>TOTAL QUANTITY</td>
            <td className="right">{totalQty.toLocaleString()}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>

      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="info-item"><label>Vehicle Out Time</label><span>_______________</span></div>
        <div className="info-item"><label>Seal Number</label><span>_______________</span></div>
      </div>

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Dispatch Incharge</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Security Guard</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Driver</div></div>
      </div>

      <div className="doc-footer">This is a computer-generated document. | {company?.name}</div>
    </div>
  );
});

GatePassTemplate.displayName = 'GatePassTemplate';
export default GatePassTemplate;
