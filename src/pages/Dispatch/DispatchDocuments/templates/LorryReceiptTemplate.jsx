import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const LorryReceiptTemplate = forwardRef(({ order, company }, ref) => {
  const items = order?.Items || [];
  const customer = order?.Customer || {};
  const transporter = order?.Transporter || {};
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);

  return (
    <div ref={ref} className="print-document">
      <div className="doc-header">
        <div className="company-info">
          <p className="company-name">{transporter.name || 'Transporter'}</p>
          <p className="company-detail">{transporter.address || ''}</p>
          <p className="company-detail">GSTIN: {transporter.gstin || '—'} | Phone: {transporter.phone || '—'}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">Lorry Receipt (LR)</p>
          <p className="doc-number">LR-{order?.order_number?.replace('DO-', '')}</p>
          <p className="doc-date">Date: {order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : dayjs().format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">Consignor (Sender)</div>
          <p className="party-name">{company?.name}</p>
          <p className="party-detail">{company?.address}</p>
          <p className="party-detail">GSTIN: {company?.gstin}</p>
        </div>
        <div className="party-block">
          <div className="party-label">Consignee (Receiver)</div>
          <p className="party-name">{customer.name || '—'}</p>
          <p className="party-detail">{order?.shipping_address || customer.shipping_address || customer.address || ''}</p>
          <p className="party-detail">GSTIN: {customer.gstin || '—'}</p>
        </div>
      </div>

      <div className="info-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="info-item"><label>Vehicle Number</label><span style={{ fontSize: 13, fontWeight: 700 }}>{order?.vehicle_number || '—'}</span></div>
        <div className="info-item"><label>Driver</label><span>{order?.driver_name || '—'} ({order?.driver_phone || ''})</span></div>
        <div className="info-item"><label>From</label><span>{order?.FromWarehouse?.name || company?.name}</span></div>
        <div className="info-item"><label>To</label><span>{customer.name || '—'}</span></div>
        <div className="info-item"><label>Delivery Challan</label><span>{order?.Challans?.[0]?.challan_number || '—'}</span></div>
        <div className="info-item"><label>Invoice No</label><span>{order?.order_number}</span></div>
        <div className="info-item"><label>Freight Payment</label><span>To Pay / Paid / To Be Billed</span></div>
        <div className="info-item"><label>Goods Value (Declared)</label><span>As per Invoice</span></div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Description of Goods</th>
            <th className="right">No. of Pkgs</th>
            <th className="right">Quantity</th>
            <th>Unit</th>
            <th className="right">Weight (kg)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id || idx}>
              <td className="center">{idx + 1}</td>
              <td>{it.Item?.name || '—'} ({it.Item?.code || ''})</td>
              <td className="right">1</td>
              <td className="right">{parseFloat(it.quantity).toLocaleString()}</td>
              <td>{it.unit || it.Item?.unit || 'pcs'}</td>
              <td className="right">{it.weight ? parseFloat(it.weight).toFixed(2) : '—'}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={2} style={{ textAlign: 'right' }}>TOTAL</td>
            <td className="right">{order?.total_packages || items.length}</td>
            <td className="right">{totalQty.toLocaleString()}</td>
            <td />
            <td className="right">{order?.total_weight || '—'}</td>
          </tr>
        </tbody>
      </table>

      <div className="declaration">
        The consignment is booked at owner's risk. The carrier is not responsible for leakage, breakage, or any damage to goods.
        All disputes are subject to the jurisdiction of courts at the place of origin.
      </div>

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Consignor</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Transporter / Driver</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Consignee</div></div>
      </div>

      <div className="doc-footer">Lorry Receipt | {transporter.name || 'Transporter'} | Consignment from {company?.name}</div>
    </div>
  );
});

LorryReceiptTemplate.displayName = 'LorryReceiptTemplate';
export default LorryReceiptTemplate;
