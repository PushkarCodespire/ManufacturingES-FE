import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const fmt = (v) => v ? `₹${parseFloat(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

const InvoiceTemplate = forwardRef(({ order, invoice, company }, ref) => {
  const items = order?.Items || [];
  const customer = order?.Customer || {};
  const challan = order?.Challans?.[0];

  const subtotal = invoice?.subtotal || items.reduce((s, i) => s + (parseFloat(i.quantity) * (parseFloat(i.Item?.gst_rate) > 0 ? parseFloat(i.weight || i.quantity) * 100 : 0)), 0);
  const gst = invoice?.gst_amount || 0;
  const total = invoice?.total_amount || subtotal + parseFloat(gst);

  return (
    <div ref={ref} className="print-document">
      <div className="doc-header">
        <div className="company-info">
          <p className="company-name">{company?.name}</p>
          <p className="company-detail">{company?.address}</p>
          <p className="company-detail">GSTIN: {company?.gstin} | PAN: {company?.pan}</p>
          <p className="company-detail">Phone: {company?.phone} | Email: {company?.email}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">Tax Invoice</p>
          <p className="doc-number">{invoice?.invoice_no || `INV-${order?.order_number?.replace('DO-', '')}`}</p>
          <p className="doc-date">Date: {invoice?.invoice_date ? dayjs(invoice.invoice_date).format('DD MMM YYYY') : dayjs(order?.dispatch_date).format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">Bill To</div>
          <p className="party-name">{customer.name || '—'}</p>
          <p className="party-detail">{customer.address || ''}</p>
          <p className="party-detail">GSTIN: {customer.gstin || '—'}</p>
        </div>
        <div className="party-block">
          <div className="party-label">Ship To</div>
          <p className="party-name">{customer.name || '—'}</p>
          <p className="party-detail">{order?.shipping_address || customer.shipping_address || customer.address || ''}</p>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-item"><label>Dispatch Order</label><span>{order?.order_number}</span></div>
        <div className="info-item"><label>Challan No</label><span>{challan?.challan_number || '—'}</span></div>
        <div className="info-item"><label>Vehicle No</label><span>{order?.vehicle_number || '—'}</span></div>
        <div className="info-item"><label>Dispatch Date</label><span>{order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : '—'}</span></div>
        <div className="info-item"><label>Due Date</label><span>{invoice?.due_date ? dayjs(invoice.due_date).format('DD MMM YYYY') : '—'}</span></div>
        <div className="info-item"><label>Payment Terms</label><span>As per PO</span></div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Item Code</th>
            <th>Description</th>
            <th>HSN</th>
            <th className="right">Qty</th>
            <th>Unit</th>
            <th className="right">Rate</th>
            <th className="right">GST %</th>
            <th className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const rate = parseFloat(it.weight || 0) * 100 || 0;
            const amt = parseFloat(it.quantity) * rate;
            return (
              <tr key={it.id || idx}>
                <td className="center">{idx + 1}</td>
                <td>{it.Item?.code || '—'}</td>
                <td>{it.Item?.name || '—'}</td>
                <td>{it.Item?.hsn_code || '—'}</td>
                <td className="right">{parseFloat(it.quantity).toLocaleString()}</td>
                <td>{it.unit || it.Item?.unit || 'pcs'}</td>
                <td className="right">{fmt(rate)}</td>
                <td className="right">{it.Item?.gst_rate || 0}%</td>
                <td className="right">{fmt(amt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="totals-block">
        <table className="totals-table">
          <tbody>
            <tr><td>Subtotal</td><td>{fmt(subtotal)}</td></tr>
            <tr><td>CGST</td><td>{fmt(parseFloat(gst) / 2)}</td></tr>
            <tr><td>SGST</td><td>{fmt(parseFloat(gst) / 2)}</td></tr>
            <tr className="grand-total"><td>Grand Total</td><td>{fmt(total)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="declaration">
        We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        Subject to jurisdiction of courts at Pune, Maharashtra.
      </div>

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Prepared By</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Authorized Signatory</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Received By</div></div>
      </div>

      <div className="doc-footer">
        This is a computer-generated document. | {company?.name} | CIN: {company?.cin}
      </div>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';
export default InvoiceTemplate;
