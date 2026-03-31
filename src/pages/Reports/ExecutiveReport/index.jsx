import React, { useRef, useState, useEffect, useCallback } from 'react';
import { printContent } from '../../../utils/printContent';
import {
  Button, Spin, Row, Col, Tag, Typography, Select,
} from 'antd';
import {
  PrinterOutlined, RightOutlined, ReloadOutlined,
  ToolOutlined, SafetyOutlined, DatabaseOutlined,
  ThunderboltOutlined, TeamOutlined, CarOutlined, DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import dashboardApi from '../../../api/dashboard.api';

const { Title, Text } = Typography;

// ── Print-only styles ─────────────────────────────────────────────────────────
const PRINT_STYLES = `
  @media print {
    body { margin: 0; background: #fff !important; }
    .no-print { display: none !important; }
    .print-page { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 20px 28px !important; }
    @page { size: A4 portrait; margin: 12mm 14mm; }
  }
`;

// ── Small reusable sub-components ─────────────────────────────────────────────
const KpiBox = ({ label, value, unit, color = '#1d4ed8', alert = false }) => (
  <div style={{
    padding: '10px 14px',
    borderRadius: 10,
    background: alert ? '#fef2f2' : '#f8fafc',
    border: `1.5px solid ${alert ? '#fca5a5' : '#e5e7eb'}`,
    textAlign: 'center',
    minWidth: 110,
  }}>
    <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value ?? '—'}</div>
    {unit && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{unit}</div>}
    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{label}</div>
  </div>
);

const Section = ({ title, icon, color, children }) => (
  <div style={{
    border: `1px solid #e5e7eb`,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
    breakInside: 'avoid',
  }}>
    <div style={{
      background: color,
      padding: '8px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 7,
    }}>
      {React.cloneElement(icon, { style: { fontSize: 14, color: '#fff' } })}
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{title}</span>
    </div>
    <div style={{ padding: '12px 14px', background: '#fff' }}>
      {children}
    </div>
  </div>
);

const DataRow = ({ label, value, alert = false }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: '5px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 12,
  }}>
    <span style={{ color: '#6b7280' }}>{label}</span>
    <span style={{ fontWeight: 600, color: alert ? '#dc2626' : '#111827' }}>{value ?? '—'}</span>
  </div>
);

const Grid4 = ({ items }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
    {items.map((item) => (
      <KpiBox key={item.label} {...item} />
    ))}
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExecutiveReportPage() {
  const printRef      = useRef(null);
  const [data,        setData]    = useState(null);
  const [loading,     setLoading] = useState(true);
  const [reportMonth, setMonth]   = useState(dayjs().format('YYYY-MM'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getFullDashboard();
      setData(res);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePrint = useCallback(() => {
    printContent(printRef.current, {
      title: `Dynatech ONE — Executive Report ${reportMonth}`,
    });
  }, [reportMonth]);

  const k   = data?.kpis       || {};
  const p   = data?.production || {};
  const q   = data?.quality    || {};
  const inv = data?.inventory  || {};
  const dis = data?.dispatch   || {};
  const mnt = data?.maintenance || {};
  const hr  = data?.hr         || {};

  const fmtPct = (v) => v != null ? `${v}%` : '—';
  const fmtRs  = (v) => v > 0 ? `₹${(v / 100000).toFixed(1)}L` : '₹0';

  // Month picker options (last 6 months)
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const m = dayjs().subtract(i, 'month');
    return { value: m.format('YYYY-MM'), label: m.format('MMM YYYY') };
  });

  return (
    <AppLayout>
      <style>{PRINT_STYLES}</style>

      {/* ── Screen toolbar (hidden on print) ── */}
      <div className="no-print" style={{ padding: '0 0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Reports</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Executive Report</Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Executive Report</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Plant-wide KPI summary for senior management — printable / PDF export.
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select
              value={reportMonth}
              onChange={setMonth}
              options={monthOptions}
              style={{ width: 130 }}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              disabled={loading}
              style={{ background: '#1d4ed8', borderColor: '#1d4ed8' }}
            >
              Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Printable Report Content ── */}
      <Spin spinning={loading}>
        <div
          ref={printRef}
          className="print-page"
          style={{
            background:    '#fff',
            borderRadius:  12,
            border:        '1px solid #e8eaed',
            boxShadow:     '0 1px 4px rgba(0,0,0,0.06)',
            padding:       '28px 32px',
            maxWidth:      860,
          }}
        >
          {/* Report Header */}
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'flex-start',
            paddingBottom:  16,
            borderBottom:   '2px solid #1d4ed8',
            marginBottom:   20,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <img src="/codespire-logo.png" alt="Logo" style={{ height: 32, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>Dynatech ONE</div>
                  <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.05em' }}>OPERATIONS 'N' EVERYTHING</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1d4ed8' }}>Executive Report</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Period: {dayjs(reportMonth).format('MMMM YYYY')}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                Generated: {dayjs().format('DD MMM YYYY, HH:mm')}
              </div>
            </div>
          </div>

          {/* KPI Banner */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              KEY PERFORMANCE INDICATORS
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <KpiBox label="On-Time Delivery"    value={fmtPct(k.otd_pct)}   color={k.otd_pct == null ? '#6b7280' : k.otd_pct >= 95 ? '#16a34a' : k.otd_pct >= 80 ? '#d97706' : '#dc2626'} />
              <KpiBox label="First Pass Yield"    value={fmtPct(k.fpy_pct)}   color={k.fpy_pct == null ? '#6b7280' : k.fpy_pct >= 95 ? '#16a34a' : k.fpy_pct >= 85 ? '#d97706' : '#dc2626'} />
              <KpiBox label="Customer Complaints" value={k.customer_complaints ?? '—'} unit="this month" alert={(k.customer_complaints || 0) > 0} color={(k.customer_complaints || 0) === 0 ? '#16a34a' : '#dc2626'} />
              <KpiBox label="COPQ"                value={fmtRs(k.copq_amount)} color={(k.copq_amount || 0) > 500000 ? '#dc2626' : '#d97706'} />
              <KpiBox label="Open Orders"         value={k.open_orders ?? '—'} unit="active" color="#1d4ed8" />
            </div>
          </div>

          {/* 2-column sections */}
          <Row gutter={[14, 0]}>
            <Col xs={24} md={12}>
              {/* Production */}
              <Section title="Production" icon={<ToolOutlined />} color="#dc2626">
                <DataRow label="Active Work Orders"    value={p.active_wos} />
                <DataRow label="In Progress WOs"       value={p.in_progress_wos} />
                <DataRow label="Delayed WOs"           value={p.delayed_wos}    alert={(p.delayed_wos || 0) > 0} />
                <DataRow label="WOs Closed Today"      value={p.completed_wos_today} />
                <DataRow label="Open Job Cards"        value={p.open_job_cards} />
                <DataRow label="Jobs Closed Today"     value={p.closed_job_cards_today} />
                <DataRow label="Scrap Events Today"    value={p.scrap_today}    alert={(p.scrap_today || 0) > 0} />
                <DataRow label="FPI Pending"           value={p.fpi_waiting}    alert={(p.fpi_waiting || 0) > 0} />
              </Section>

              {/* Dispatch */}
              <Section title="Dispatch & Logistics" icon={<CarOutlined />} color="#0d9488">
                <DataRow label="Pending Shipments"    value={dis.pending_shipments}  alert={(dis.pending_shipments || 0) > 5} />
                <DataRow label="Dispatched Today"     value={dis.dispatched_today} />
                <DataRow label="POD Pending"          value={dis.pod_pending}        alert={(dis.pod_pending || 0) > 0} />
                <DataRow label="OTD This Month"       value={fmtPct(dis.otd_pct)} />
              </Section>

              {/* HR */}
              <Section title="HR Overview" icon={<TeamOutlined />} color="#92400e">
                <DataRow label="Active Employees"  value={hr.total_employees} />
                <DataRow label="Training Expired"  value={hr.training_expired} alert={(hr.training_expired || 0) > 0} />
              </Section>
            </Col>

            <Col xs={24} md={12}>
              {/* Quality */}
              <Section title="Quality" icon={<SafetyOutlined />} color="#16a34a">
                <DataRow label="IQC Pending"          value={q.iqc_pending}       alert={(q.iqc_pending || 0) > 0} />
                <DataRow label="LQC Checks Today"     value={q.lqc_checks_today} />
                <DataRow label="PQC Pending"          value={q.pqc_pending}       alert={(q.pqc_pending || 0) > 0} />
                <DataRow label="OQC Pending"          value={q.oqc_pending}       alert={(q.oqc_pending || 0) > 0} />
                <DataRow label="Open NCRs"            value={q.open_ncrs}         alert={(q.open_ncrs || 0) > 0} />
                <DataRow label="Open CAPAs"           value={q.open_capas}        alert={(q.open_capas || 0) > 0} />
                <DataRow label="Complaints (month)"   value={q.complaints_month}  alert={(q.complaints_month || 0) > 0} />
                <DataRow label="Instruments Due"      value={q.instruments_due}   alert={(q.instruments_due || 0) > 0} />
              </Section>

              {/* Inventory */}
              <Section title="Inventory & Store" icon={<DatabaseOutlined />} color="#7c3aed">
                <DataRow label="GRN Pending"           value={inv.grn_pending}               alert={(inv.grn_pending || 0) > 0} />
                <DataRow label="Low Stock Alerts"      value={inv.low_stock_alerts}           alert={(inv.low_stock_alerts || 0) > 0} />
                <DataRow label="Pending Material Req." value={inv.pending_material_requests}  alert={(inv.pending_material_requests || 0) > 5} />
                <DataRow label="Total Active SKUs"     value={inv.total_skus} />
              </Section>

              {/* Maintenance */}
              <Section title="Maintenance" icon={<ThunderboltOutlined />} color="#b45309">
                <DataRow label="Open Breakdowns"      value={mnt.open_breakdowns}       alert={(mnt.open_breakdowns || 0) > 0} />
                <DataRow label="Open MWOs"            value={mnt.open_mwos}             alert={(mnt.open_mwos || 0) > 5} />
                <DataRow label="Downtime Events Today" value={mnt.downtime_events_today} alert={(mnt.downtime_events_today || 0) > 0} />
              </Section>
            </Col>
          </Row>

          {/* Footer */}
          <div style={{
            marginTop: 20,
            paddingTop: 12,
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 10, color: '#9ca3af' }}>
              Dynatech ONE — Confidential — For internal use only
            </Text>
            <Text style={{ fontSize: 10, color: '#9ca3af' }}>
              Data as of {dayjs().format('DD MMM YYYY HH:mm')}
            </Text>
          </div>
        </div>
      </Spin>
    </AppLayout>
  );
}
