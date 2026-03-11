import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const COMPANY = {
  name:    'Dynatech Engineering Pvt. Ltd.',
  address: 'Plot No. 45, MIDC Industrial Area, Pune, Maharashtra 411026',
  gstin:   '27AABCD1234E1Z5',
  phone:   '+91 20 2712 3456',
};

const OqcTestCertTemplate = forwardRef(({ inspection }, ref) => {
  const results  = inspection?.Results || [];
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
          <p className="doc-title">Test Certificate</p>
          <p className="doc-number">{inspection?.cert_no || '—'}</p>
          <p className="doc-date">Date: {dayjs(inspection?.inspection_date).format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">Customer</div>
          <p className="party-name">{customer.name || '—'}</p>
        </div>
        <div className="party-block">
          <div className="party-label">Reference</div>
          <p className="party-name">Inspection: {inspection?.inspection_no}</p>
          {wo && <p className="party-detail">Work Order: {wo.wo_no}</p>}
          {inspection?.batch_no && <p className="party-detail">Batch: {inspection.batch_no}</p>}
        </div>
      </div>

      <div style={{ margin: '12px 0 4px', fontSize: 11, fontWeight: 600 }}>PRODUCT DETAILS</div>
      <table className="items-table">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Part No.</th>
            <th>Description</th>
            <th className="right">Qty Inspected</th>
            <th className="right">Qty Accepted</th>
            <th className="right">Qty Rejected</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{item.code || '—'}</td>
            <td>{item.part_no || '—'}</td>
            <td>{item.name || '—'}</td>
            <td className="right">{inspection?.qty_inspected ?? '—'}</td>
            <td className="right">{inspection?.qty_accepted ?? '—'}</td>
            <td className="right">{inspection?.qty_rejected ?? 0}</td>
          </tr>
        </tbody>
      </table>

      {results.length > 0 && (
        <>
          <div style={{ margin: '12px 0 4px', fontSize: 11, fontWeight: 600 }}>INSPECTION RESULTS</div>
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Parameter</th>
                <th>Specification</th>
                <th>Actual Value</th>
                <th style={{ width: 80 }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr key={r.id || idx}>
                  <td className="center">{idx + 1}</td>
                  <td>{r.parameter_name}</td>
                  <td>{r.specification || '—'}</td>
                  <td>{r.actual_value || '—'}</td>
                  <td style={{ color: r.result === 'pass' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {r.result?.toUpperCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="declaration">
        <strong>VERDICT: {(inspection?.result || 'pending').toUpperCase()}</strong>
        <br /><br />
        We hereby certify that the above product has been inspected and tested as per applicable quality standards
        and customer specifications. Testing was carried out using calibrated instruments in accordance with
        our QMS procedures (IATF 16949).
        {inspection?.notes && (<><br /><br /><strong>Notes:</strong> {inspection.notes}</>)}
      </div>

      <div className="signatures">
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">QC Inspector<br />{inspection?.Inspector?.name || ''}</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">QA Manager</div></div>
        <div className="sig-block"><div className="sig-line" /><div className="sig-label">Plant Head</div></div>
      </div>

      <div className="doc-footer">This is a computer-generated document. | {COMPANY.name} | IATF 16949 Certified</div>
    </div>
  );
});

OqcTestCertTemplate.displayName = 'OqcTestCertTemplate';
export default OqcTestCertTemplate;
