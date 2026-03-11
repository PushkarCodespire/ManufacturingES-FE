import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const COCTemplate = forwardRef(({ order, company }, ref) => {
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
          <p className="doc-title">Certificate of Conformance</p>
          <p className="doc-number">COC-{order?.order_number?.replace('DO-', '')}</p>
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
          <p className="party-detail">Date: {order?.dispatch_date ? dayjs(order.dispatch_date).format('DD MMM YYYY') : '—'}</p>
        </div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Item Code</th>
            <th>Description</th>
            <th>Type</th>
            <th className="right">Qty Supplied</th>
            <th>Unit</th>
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
            </tr>
          ))}
        </tbody>
      </table>

      <div className="declaration" style={{ fontStyle: 'normal' }}>
        <strong>DECLARATION OF CONFORMANCE</strong>
        <br /><br />
        We, <strong>{company?.name}</strong>, hereby certify and declare that the materials / products listed above:
        <br /><br />
        1. Have been manufactured and inspected in accordance with our Quality Management System (IATF 16949 certified).
        <br />
        2. Conform to all applicable drawings, specifications, and purchase order requirements.
        <br />
        3. Have undergone all required quality checks including incoming inspection, in-process inspection, and final inspection.
        <br />
        4. Are free from defects in materials and workmanship.
        <br />
        5. Meet all regulatory and statutory requirements applicable to these products.
        <br /><br />
        This certificate is issued based on the inspection and testing records maintained at our facility.
      </div>

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Quality Manager</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Plant Head</div></div>
      </div>

      <div className="doc-footer">This is a computer-generated document. | {company?.name} | IATF 16949 Certified</div>
    </div>
  );
});

COCTemplate.displayName = 'COCTemplate';
export default COCTemplate;
