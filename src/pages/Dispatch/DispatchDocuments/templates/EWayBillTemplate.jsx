import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const fmt = (v) => v ? `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

const EWayBillTemplate = forwardRef(({ order, invoice, company }, ref) => {
  const items = order?.Items || [];
  const customer = order?.Customer || {};
  const totalValue = invoice?.total_amount || items.reduce((s, i) => s + parseFloat(i.quantity || 0) * parseFloat(i.weight || 0) * 100, 0);

  return (
    <div ref={ref} className="print-document">
      <div className="doc-header">
        <div className="company-info">
          <p className="company-name">E-Way Bill</p>
          <p className="company-detail">As per GST Rule 138 | Generated from {company?.name}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">E-Way Bill</p>
          <p className="doc-number">EWB-{order?.order_number?.replace('DO-', '')}</p>
          <p className="doc-date">Date: {order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : dayjs().format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div style={{ marginBottom: 16, padding: '8px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 10, color: '#1e40af' }}>
        Note: This is a draft E-Way Bill format. Actual E-Way Bill must be generated on the GST portal (ewaybillgst.gov.in) before transport.
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">From (Supplier)</div>
          <p className="party-name">{company?.name}</p>
          <p className="party-detail">{company?.address}</p>
          <p className="party-detail">GSTIN: {company?.gstin}</p>
        </div>
        <div className="party-block">
          <div className="party-label">To (Recipient)</div>
          <p className="party-name">{customer.name || '—'}</p>
          <p className="party-detail">{order?.shipping_address || customer.shipping_address || customer.address || ''}</p>
          <p className="party-detail">GSTIN: {customer.gstin || '—'}</p>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-item"><label>Document Type</label><span>Tax Invoice</span></div>
        <div className="info-item"><label>Document No</label><span>{invoice?.invoice_no || order?.order_number}</span></div>
        <div className="info-item"><label>Document Date</label><span>{order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : '—'}</span></div>
        <div className="info-item"><label>Vehicle No</label><span>{order?.vehicle_number || '—'}</span></div>
        <div className="info-item"><label>Transport Mode</label><span>Road</span></div>
        <div className="info-item"><label>Transporter</label><span>{order?.Transporter?.name || '—'}</span></div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>HSN Code</th>
            <th>Description</th>
            <th className="right">Qty</th>
            <th>Unit</th>
            <th className="right">Taxable Value</th>
            <th className="right">GST Rate</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id || idx}>
              <td className="center">{idx + 1}</td>
              <td>{it.Item?.hsn_code || '—'}</td>
              <td>{it.Item?.name || '—'}</td>
              <td className="right">{parseFloat(it.quantity).toLocaleString()}</td>
              <td>{it.unit || it.Item?.unit || 'pcs'}</td>
              <td className="right">{fmt(parseFloat(it.quantity) * parseFloat(it.weight || 0) * 100)}</td>
              <td className="right">{it.Item?.gst_rate || 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals-block">
        <table className="totals-table">
          <tbody>
            <tr><td>Total Consignment Value</td><td>{fmt(totalValue)}</td></tr>
            <tr><td>Total Packages</td><td>{order?.total_packages || items.length}</td></tr>
            <tr><td>Gross Weight (kg)</td><td>{order?.total_weight || '—'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="doc-footer">
        This is a draft format only. Official E-Way Bill must be generated on ewaybillgst.gov.in | {company?.name}
      </div>
    </div>
  );
});

EWayBillTemplate.displayName = 'EWayBillTemplate';
export default EWayBillTemplate;
