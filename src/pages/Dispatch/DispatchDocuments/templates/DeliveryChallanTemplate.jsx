import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const DeliveryChallanTemplate = forwardRef(({ order, company }, ref) => {
  const items = order?.Items || [];
  const customer = order?.Customer || {};
  const challan = order?.Challans?.[0];
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
          <p className="doc-title">Delivery Challan</p>
          <p className="doc-number">{challan?.challan_number || `DC-${order?.order_number?.replace('DO-', '')}`}</p>
          <p className="doc-date">Date: {challan?.issued_date ? dayjs(challan.issued_date).format('DD MMM YYYY') : dayjs(order?.dispatch_date).format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">Consignor (From)</div>
          <p className="party-name">{company?.name}</p>
          <p className="party-detail">{order?.FromWarehouse?.name || 'Main Warehouse'}</p>
          <p className="party-detail">{order?.FromWarehouse?.Site?.address || company?.address}</p>
          <p className="party-detail">GSTIN: {company?.gstin}</p>
        </div>
        <div className="party-block">
          <div className="party-label">Consignee (To)</div>
          <p className="party-name">{customer.name || '—'}</p>
          <p className="party-detail">{order?.shipping_address || customer.shipping_address || customer.address || ''}</p>
          <p className="party-detail">GSTIN: {customer.gstin || '—'}</p>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-item"><label>Dispatch Order</label><span>{order?.order_number}</span></div>
        <div className="info-item"><label>Vehicle No</label><span>{order?.vehicle_number || '—'}</span></div>
        <div className="info-item"><label>Driver</label><span>{order?.driver_name || '—'}</span></div>
        <div className="info-item"><label>Transporter</label><span>{order?.Transporter?.name || '—'}</span></div>
        <div className="info-item"><label>Packages</label><span>{order?.total_packages || items.length}</span></div>
        <div className="info-item"><label>Gross Weight</label><span>{order?.total_weight || '—'} kg</span></div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Item Code</th>
            <th>Description</th>
            <th>HSN</th>
            <th className="right">Quantity</th>
            <th>Unit</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id || idx}>
              <td className="center">{idx + 1}</td>
              <td>{it.Item?.code || '—'}</td>
              <td>{it.Item?.name || '—'}</td>
              <td>{it.Item?.hsn_code || '—'}</td>
              <td className="right">{parseFloat(it.quantity).toLocaleString()}</td>
              <td>{it.unit || it.Item?.unit || 'pcs'}</td>
              <td>{it.notes || ''}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={4} style={{ textAlign: 'right' }}>TOTAL</td>
            <td className="right">{totalQty.toLocaleString()}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>

      <div className="declaration">
        This Delivery Challan is for the purpose of delivery of goods only and does not constitute a sale.
        The goods remain the property of the consignor until formally invoiced.
      </div>

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Dispatched By</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Transporter</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Received By</div></div>
      </div>

      <div className="doc-footer">This is a computer-generated document. | {company?.name}</div>
    </div>
  );
});

DeliveryChallanTemplate.displayName = 'DeliveryChallanTemplate';
export default DeliveryChallanTemplate;
