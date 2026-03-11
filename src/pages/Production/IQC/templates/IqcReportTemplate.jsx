import React, { forwardRef } from 'react';
import dayjs from 'dayjs';

const COMPANY = {
  name:    'Dynatech Engineering Pvt. Ltd.',
  address: 'Plot No. 45, MIDC Industrial Area, Pune, Maharashtra 411026',
  gstin:   '27AABCD1234E1Z5',
  phone:   '+91 20 2712 3456',
};

const IqcReportTemplate = forwardRef(({ inspection }, ref) => {
  const results = inspection?.Results || [];
  const item    = inspection?.Item    || {};
  const vendor  = inspection?.Vendor  || {};
  const grn     = inspection?.Grn     || {};

  const resultLabel = { pending: 'PENDING', pass: 'PASS', fail: 'FAIL', conditional: 'CONDITIONAL' };

  return (
    <div ref={ref} className="print-document">
      <style>{`
        .print-document { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; padding: 20px; max-width: 210mm; }
        .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 10px; }
        .company-name { font-size: 16px; font-weight: 700; margin: 0; }
        .company-detail { font-size: 9px; color: #555; margin: 2px 0; }
        .doc-title-block { text-align: right; }
        .doc-title { font-size: 14px; font-weight: 700; text-transform: uppercase; margin: 0; color: #1a5276; }
        .doc-number { font-size: 12px; font-weight: 600; margin: 2px 0; }
        .doc-date { font-size: 10px; color: #555; margin: 0; }
        .party-row { display: flex; gap: 20px; margin: 10px 0; }
        .party-block { flex: 1; background: #f7f7f7; padding: 8px 10px; border-radius: 4px; }
        .party-label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 600; margin-bottom: 2px; }
        .party-name { font-weight: 600; margin: 0 0 2px; }
        .party-detail { font-size: 10px; color: #555; margin: 1px 0; }
        .section-title { font-size: 11px; font-weight: 600; margin: 12px 0 4px; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
        .items-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px; }
        .items-table th { background: #2c3e50; color: #fff; padding: 5px 6px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; }
        .items-table td { padding: 4px 6px; border-bottom: 1px solid #e0e0e0; }
        .items-table tr:nth-child(even) td { background: #fafafa; }
        .right { text-align: right; }
        .center { text-align: center; }
        .result-pass { color: #16a34a; font-weight: 700; }
        .result-fail { color: #dc2626; font-weight: 700; }
        .result-conditional { color: #d97706; font-weight: 700; }
        .verdict-box { text-align: center; padding: 10px; margin: 12px 0; border: 2px solid; border-radius: 6px; font-size: 14px; font-weight: 700; text-transform: uppercase; }
        .verdict-pass { border-color: #16a34a; color: #16a34a; background: #f0fdf4; }
        .verdict-fail { border-color: #dc2626; color: #dc2626; background: #fef2f2; }
        .verdict-conditional { border-color: #d97706; color: #d97706; background: #fffbeb; }
        .verdict-pending { border-color: #9ca3af; color: #9ca3af; background: #f9fafb; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
        .sig-block { width: 200px; text-align: center; }
        .sig-line { border-top: 1px solid #1a1a1a; margin-top: 40px; padding-top: 4px; font-size: 10px; font-weight: 600; }
        .sig-role { font-size: 9px; color: #666; }
        .footer { margin-top: 20px; padding-top: 6px; border-top: 1px solid #ddd; font-size: 8px; color: #999; text-align: center; }
        @media print { body { margin: 0; } .print-document { padding: 10mm; } }
      `}</style>

      <div className="doc-header">
        <div>
          <p className="company-name">{COMPANY.name}</p>
          <p className="company-detail">{COMPANY.address}</p>
          <p className="company-detail">GSTIN: {COMPANY.gstin} | Phone: {COMPANY.phone}</p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">IQC Inspection Report</p>
          <p className="doc-number">{inspection?.inspection_no || '—'}</p>
          <p className="doc-date">Date: {dayjs(inspection?.inspection_date).format('DD MMM YYYY')}</p>
        </div>
      </div>

      <div className="party-row">
        <div className="party-block">
          <div className="party-label">Vendor / Supplier</div>
          <p className="party-name">{vendor.name || '—'}</p>
        </div>
        <div className="party-block">
          <div className="party-label">GRN Reference</div>
          <p className="party-name">{grn.grn_no || '—'}</p>
          <p className="party-detail">Received: {grn.received_date ? dayjs(grn.received_date).format('DD MMM YYYY') : '—'}</p>
        </div>
        <div className="party-block">
          <div className="party-label">Batch / Lot</div>
          <p className="party-name">{inspection?.batch_no || '—'}</p>
        </div>
      </div>

      <div className="section-title">Item Details</div>
      <table className="items-table">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Description</th>
            <th className="right">Qty Received</th>
            <th className="right">Qty Inspected</th>
            <th className="right">Qty Accepted</th>
            <th className="right">Qty Rejected</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{item.code || '—'}</td>
            <td>{item.name || '—'}</td>
            <td className="right">{inspection?.qty_received ?? '—'}</td>
            <td className="right">{inspection?.qty_inspected ?? '—'}</td>
            <td className="right">{inspection?.qty_accepted ?? '—'}</td>
            <td className="right" style={{ color: parseFloat(inspection?.qty_rejected) > 0 ? '#dc2626' : undefined, fontWeight: parseFloat(inspection?.qty_rejected) > 0 ? 700 : undefined }}>
              {inspection?.qty_rejected ?? '—'}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="section-title">Inspection Results</div>
      {results.length > 0 ? (
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Parameter</th>
              <th>Specification</th>
              <th>Actual Value</th>
              <th className="center" style={{ width: 60 }}>Result</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.id || i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{r.parameter_name}</td>
                <td>{r.specification || '—'}</td>
                <td>{r.actual_value || '—'}</td>
                <td className={`center result-${r.result}`}>{(r.result || '').toUpperCase()}</td>
                <td>{r.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#999', fontStyle: 'italic' }}>No inspection parameters recorded.</p>
      )}

      <div className={`verdict-box verdict-${inspection?.result || 'pending'}`}>
        {resultLabel[inspection?.result] || 'PENDING'}
        {inspection?.disposition && (
          <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4 }}>
            Disposition: {inspection.disposition.replace(/_/g, ' ').toUpperCase()}
          </div>
        )}
      </div>

      {inspection?.notes && (
        <div style={{ margin: '8px 0', padding: '6px 10px', background: '#f9fafb', borderRadius: 4, fontSize: 10 }}>
          <strong>Notes:</strong> {inspection.notes}
        </div>
      )}

      <div className="signatures">
        <div className="sig-block">
          <div className="sig-line">{inspection?.Inspector?.name || '________________'}</div>
          <div className="sig-role">IQC Inspector</div>
        </div>
        <div className="sig-block">
          <div className="sig-line">________________</div>
          <div className="sig-role">Quality Manager</div>
        </div>
        <div className="sig-block">
          <div className="sig-line">________________</div>
          <div className="sig-role">Plant Head</div>
        </div>
      </div>

      <div className="footer">
        This is a system-generated document from Dynatech One ERP. Printed on {dayjs().format('DD MMM YYYY HH:mm')}.
      </div>
    </div>
  );
});

IqcReportTemplate.displayName = 'IqcReportTemplate';
export default IqcReportTemplate;
