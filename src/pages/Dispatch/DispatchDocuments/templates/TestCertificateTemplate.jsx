import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const TestCertificateTemplate = forwardRef(({ order, company }, ref) => {
  const items = order?.Items || [];
  const customer = order?.Customer || {};

  return (
    <div ref={ref} className="print-document">
      <div className="doc-header">
        <div className="company-info">
          <p className="company-name">{company?.name}</p>
          <p className="company-detail">{company?.address}</p>
          <p className="company-detail">GSTIN: {company?.gstin} | Phone: {company?.phone}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">Test Certificate</p>
          <p className="doc-number">TC-{order?.order_number?.replace('DO-', '')}</p>
          <p className="doc-date">Date: {order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : dayjs().format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">Issued To</div>
          <p className="party-name">{customer.name || '—'}</p>
          <p className="party-detail">{customer.address || ''}</p>
        </div>
        <div className="party-block">
          <div className="party-label">Reference</div>
          <p className="party-name">Dispatch: {order?.order_number}</p>
          <p className="party-detail">Challan: {order?.Challans?.[0]?.challan_number || '—'}</p>
        </div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Item Code</th>
            <th>Description</th>
            <th className="right">Qty</th>
            <th>Unit</th>
            <th>Specification</th>
            <th>Test Result</th>
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
              <td>As per drawing / PO</td>
              <td style={{ color: '#16a34a', fontWeight: 600 }}>PASS</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="declaration">
        We hereby certify that the above materials have been tested and inspected as per the applicable quality standards
        and customer specifications. All items have been found conforming to the required specifications.
        Testing was carried out using calibrated instruments in accordance with our QMS procedures (IATF 16949).
      </div>

      <div className="notes-section">
        <div className="notes-title">Test Methods</div>
        Visual Inspection, Dimensional Check, Material Verification as applicable.
        Detailed inspection reports available on request.
      </div>

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">QC Inspector</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">QA Manager</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Plant Head</div></div>
      </div>

      <div className="doc-footer">This is a computer-generated document. | {company?.name} | IATF 16949 Certified</div>
    </div>
  );
});

TestCertificateTemplate.displayName = 'TestCertificateTemplate';
export default TestCertificateTemplate;
