import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const COMPANY = {
  name:    'Dynatech Engineering Pvt. Ltd.',
  address: 'Plot No. 45, MIDC Industrial Area, Pune, Maharashtra 411026',
  gstin:   '27AABCD1234E1Z5',
  phone:   '+91 20 2712 3456',
};

const OqcCOCTemplate = forwardRef(({ inspection }, ref) => {
  const item     = inspection?.Item || {};
  const customer = inspection?.Customer || {};
  const wo       = inspection?.WorkOrder;

  return (
    <div ref={ref} className="print-document">
      <div className="doc-header">
        <div className="company-info">
          <p className="company-name">{COMPANY.name}</p>
          <p className="company-detail">{COMPANY.address}</p>
          <p className="company-detail">GSTIN: {COMPANY.gstin} | Phone: {COMPANY.phone}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">Certificate of Conformance</p>
          <p className="doc-number">{inspection?.coc_no || '—'}</p>
          <p className="doc-date">Date: {dayjs(inspection?.inspection_date).format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">Issued To</div>
          <p className="party-name">{customer.name || '—'}</p>
        </div>
        <div className="party-block">
          <div className="party-label">Reference</div>
          <p className="party-name">Inspection: {inspection?.inspection_no}</p>
          {wo && <p className="party-detail">Work Order: {wo.wo_no}</p>}
          {inspection?.batch_no && <p className="party-detail">Batch: {inspection.batch_no}</p>}
        </div>
      </div>

      <table className="items-table">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Part No.</th>
            <th>Description</th>
            <th className="right">Qty Supplied</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{item.code || '—'}</td>
            <td>{item.part_no || '—'}</td>
            <td>{item.name || '—'}</td>
            <td className="right">{inspection?.qty_accepted ?? inspection?.qty_inspected ?? '—'}</td>
          </tr>
        </tbody>
      </table>

      <div className="declaration" style={{ fontStyle: 'normal' }}>
        <strong>DECLARATION OF CONFORMANCE</strong>
        <br /><br />
        We, <strong>{COMPANY.name}</strong>, hereby certify and declare that the product listed above:
        <br /><br />
        1. Has been manufactured and inspected in accordance with our Quality Management System (IATF 16949 certified).
        <br />
        2. Conforms to all applicable drawings, specifications, and purchase order requirements.
        <br />
        3. Has undergone all required quality checks including incoming inspection, in-process inspection,
        and final outgoing inspection (OQC Ref: {inspection?.inspection_no}).
        <br />
        4. Is free from defects in materials and workmanship.
        <br />
        5. Meets all regulatory and statutory requirements applicable to this product.
        <br /><br />
        This certificate is issued based on the inspection and testing records maintained at our facility.
      </div>

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Quality Manager</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Plant Head</div></div>
      </div>

      <div className="doc-footer">This is a computer-generated document. | {COMPANY.name} | IATF 16949 Certified</div>
    </div>
  );
});

OqcCOCTemplate.displayName = 'OqcCOCTemplate';
export default OqcCOCTemplate;
