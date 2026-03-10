import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const MaterialTransferTemplate = forwardRef(({ order, company }, ref) => {
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
          <p className="doc-title">Material Transfer Note</p>
          <p className="doc-number">MTN-{order?.order_number?.replace('DO-', '')}</p>
          <p className="doc-date">Date: {order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : dayjs().format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">Transfer From</div>
          <p className="party-name">{order?.FromWarehouse?.name || 'Main Warehouse'}</p>
          <p className="party-detail">Code: {order?.FromWarehouse?.code || '—'}</p>
          <p className="party-detail">{order?.FromWarehouse?.Site?.address || company?.address}</p>
        </div>
        <div className="party-block">
          <div className="party-label">Transfer To</div>
          <p className="party-name">{customer.name || '—'}</p>
          <p className="party-detail">{order?.shipping_address || customer.shipping_address || customer.address || ''}</p>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-item"><label>Dispatch Order</label><span>{order?.order_number}</span></div>
        <div className="info-item"><label>Transfer Type</label><span>Outward — Customer Delivery</span></div>
        <div className="info-item"><label>Vehicle</label><span>{order?.vehicle_number || '—'}</span></div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Item Code</th>
            <th>Description</th>
            <th>Type</th>
            <th className="right">Qty</th>
            <th>Unit</th>
            <th className="right">Weight (kg)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id || idx}>
              <td className="center">{idx + 1}</td>
              <td>{it.Item?.code || '—'}</td>
              <td>{it.Item?.name || '—'}</td>
              <td>{it.Item?.item_type || '—'}</td>
              <td className="right">{parseFloat(it.quantity).toLocaleString()}</td>
              <td>{it.unit || it.Item?.unit || 'pcs'}</td>
              <td className="right">{it.weight ? parseFloat(it.weight).toFixed(2) : '—'}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={4} style={{ textAlign: 'right' }}>TOTAL</td>
            <td className="right">{totalQty.toLocaleString()}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Issued By (Store)</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Approved By</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Received By</div></div>
      </div>

      <div className="doc-footer">This is a computer-generated document. | {company?.name}</div>
    </div>
  );
});

MaterialTransferTemplate.displayName = 'MaterialTransferTemplate';
export default MaterialTransferTemplate;
