import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const PackingListTemplate = forwardRef(({ order, company }, ref) => {
  const items = order?.Items || [];
  const customer = order?.Customer || {};
  const totalWeight = items.reduce((s, i) => s + parseFloat(i.weight || 0), 0);
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);

  return (
    <div ref={ref} className="print-document">
      <div className="doc-header">
        <div className="company-info">
          <p className="company-name">{company?.name}</p>
          <p className="company-detail">{company?.address}</p>
          <p className="company-detail">GSTIN: {company?.gstin} | Phone: {company?.phone}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">Packing List</p>
          <p className="doc-number">{order?.order_number}</p>
          <p className="doc-date">Date: {order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : dayjs().format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">Consignee</div>
          <p className="party-name">{customer.name || '—'}</p>
          <p className="party-detail">{order?.shipping_address || customer.shipping_address || customer.address || ''}</p>
        </div>
        <div className="party-block">
          <div className="party-label">Shipped From</div>
          <p className="party-name">{order?.FromWarehouse?.name || 'Main Warehouse'}</p>
          <p className="party-detail">{order?.FromWarehouse?.Site?.address || company?.address}</p>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-item"><label>Vehicle No</label><span>{order?.vehicle_number || '—'}</span></div>
        <div className="info-item"><label>Total Packages</label><span>{order?.total_packages || items.length}</span></div>
        <div className="info-item"><label>Gross Weight</label><span>{order?.total_weight || totalWeight.toFixed(2)} kg</span></div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Item Code</th>
            <th>Description</th>
            <th className="right">Quantity</th>
            <th>Unit</th>
            <th className="right">Net Weight (kg)</th>
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

      {order?.notes && (
        <div className="notes-section">
          <div className="notes-title">Remarks</div>
          {order.notes}
        </div>
      )}

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Packed By</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Checked By</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Received By</div></div>
      </div>

      <div className="doc-footer">This is a computer-generated document. | {company?.name}</div>
    </div>
  );
});

PackingListTemplate.displayName = 'PackingListTemplate';
export default PackingListTemplate;
