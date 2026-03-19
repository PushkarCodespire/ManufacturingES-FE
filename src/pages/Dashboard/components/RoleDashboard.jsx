import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Spin, Card, Tag, Typography, Progress, Button,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, FileTextOutlined,
  ToolOutlined, CarOutlined, DollarOutlined, TeamOutlined, SettingOutlined,
  SafetyOutlined, ShoppingCartOutlined, DatabaseOutlined, ReloadOutlined,
  ThunderboltOutlined, AlertOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import dashboardApi from '../../../api/dashboard.api';
import StatCard from '../../../components/StatCard';

const { Title, Text } = Typography;

// ── KPI Tile ──────────────────────────────────────────────────────────────────
const KpiTile = ({ label, value, unit, icon, color, showProgress }) => (
  <Card
    size="small"
    style={{
      borderTop: `3px solid ${color}`,
      borderRadius: 10,
      height: '100%',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    }}
    bodyStyle={{ padding: '14px 16px' }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <Text style={{
          fontSize: 10, color: '#9ca3af', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block',
        }}>
          {label}
        </Text>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>
            {value ?? '—'}
          </span>
          {unit && <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{unit}</span>}
        </div>
        {showProgress && typeof value === 'number' && (
          <Progress
            percent={value}
            showInfo={false}
            strokeColor={color}
            trailColor="#f3f4f6"
            size="small"
            style={{ marginTop: 6, marginBottom: 0 }}
          />
        )}
      </div>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginLeft: 10,
      }}>
        {React.cloneElement(icon, { style: { fontSize: 18, color } })}
      </div>
    </div>
  </Card>
);

// ── Mini Stat (inside section cards) ─────────────────────────────────────────
const MiniStat = ({ label, value, color = '#374151', unit }) => (
  <div style={{ textAlign: 'center', padding: '8px 6px' }}>
    <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value ?? '—'}</div>
    {unit && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{unit}</div>}
    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{label}</div>
  </div>
);

// ── 2 or 4-col mini grid inside section cards ─────────────────────────────────
const StatGrid = ({ items }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
    gap: 1,
    background: '#f3f4f6',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #f3f4f6',
  }}>
    {items.map((item, i) => (
      <div key={i} style={{ background: '#fff', padding: '2px 0' }}>
        <MiniStat {...item} />
      </div>
    ))}
  </div>
);

// ── Section Card wrapper ──────────────────────────────────────────────────────
const SectionCard = ({ title, icon, color = '#1d4ed8', extra, children }) => (
  <Card
    style={{
      border: '1px solid #e8eaed', borderRadius: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', height: '100%',
    }}
    bodyStyle={{ padding: '16px 20px' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {React.cloneElement(icon, { style: { fontSize: 15, color } })}
        </div>
        <Text style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</Text>
      </div>
      {extra}
    </div>
    {children}
  </Card>
);

// ── Single alert row ──────────────────────────────────────────────────────────
const AlertRow = ({ label, value, severity, icon }) => {
  if (!value) return null;
  const palettes = {
    red:    { bg: '#fef2f2', border: '#fca5a5', tag: 'red' },
    orange: { bg: '#fff7ed', border: '#fed7aa', tag: 'orange' },
    blue:   { bg: '#eff6ff', border: '#93c5fd', tag: 'blue' },
  };
  const p = palettes[severity] || palettes.orange;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 10px', background: p.bg, borderRadius: 8,
      border: `1px solid ${p.border}`, marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {React.cloneElement(icon, { style: { fontSize: 13, color: p.tag === 'red' ? '#dc2626' : p.tag === 'orange' ? '#d97706' : '#2563eb' } })}
        <Text style={{ fontSize: 12, color: '#374151' }}>{label}</Text>
      </div>
      <Tag color={p.tag} style={{ fontWeight: 700 }}>{value}</Tag>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN DASHBOARD — plant_head / it_admin
// ─────────────────────────────────────────────────────────────────────────────
const GoldenDashboard = ({ data, loading, onRefresh, user }) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="Loading dashboard…" />
      </div>
    );
  }

  const k   = data?.kpis       || {};
  const p   = data?.production  || {};
  const q   = data?.quality     || {};
  const inv = data?.inventory   || {};
  const dis = data?.dispatch    || {};
  const mnt = data?.maintenance || {};
  const hr  = data?.hr          || {};

  const alertCount =
    (q.instruments_due || 0) +
    (mnt.open_breakdowns || 0) +
    (inv.low_stock_alerts || 0) +
    (p.delayed_wos || 0) +
    (q.open_ncrs || 0) +
    (q.open_capas || 0);

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>
              {user?.department?.name || 'Plant Management'}
            </Text>
          </div>
          <Title level={3} style={{ margin: 0 }}>Golden Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {dayjs().format('dddd, D MMMM YYYY')} &nbsp;·&nbsp; {data?.month || dayjs().format('YYYY-MM')} monthly overview
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <Tag color="green" style={{ borderRadius: 8 }}>Live</Tag>
          {alertCount > 0 && (
            <Tag color="red" style={{ borderRadius: 8 }}>{alertCount} Alert{alertCount !== 1 ? 's' : ''}</Tag>
          )}
          <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>Refresh</Button>
        </div>
      </div>

      {/* ── KPI Banner ── */}
      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={8} md={4}>
          <KpiTile
            label="Open Orders"
            value={k.open_orders ?? '—'}
            unit="active"
            icon={<FileTextOutlined />}
            color="#1d4ed8"
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiTile
            label="Complaints"
            value={k.customer_complaints ?? '—'}
            unit="this month"
            icon={<AlertOutlined />}
            color={(k.customer_complaints || 0) === 0 ? '#16a34a' : '#dc2626'}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiTile
            label="On-Time Delivery"
            value={k.otd_pct ?? '—'}
            unit="%"
            icon={<CarOutlined />}
            color={k.otd_pct == null ? '#6b7280' : k.otd_pct >= 95 ? '#16a34a' : k.otd_pct >= 80 ? '#d97706' : '#dc2626'}
            showProgress
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiTile
            label="First Pass Yield"
            value={k.fpy_pct ?? '—'}
            unit="%"
            icon={<SafetyOutlined />}
            color={k.fpy_pct == null ? '#6b7280' : k.fpy_pct >= 95 ? '#16a34a' : k.fpy_pct >= 85 ? '#d97706' : '#dc2626'}
            showProgress
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiTile
            label="COPQ This Month"
            value={k.copq_amount > 0 ? `₹${(k.copq_amount / 100000).toFixed(1)}L` : '₹0'}
            icon={<DollarOutlined />}
            color={k.copq_amount > 500000 ? '#dc2626' : k.copq_amount > 0 ? '#d97706' : '#16a34a'}
          />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiTile
            label="Instruments Due"
            value={k.instruments_due ?? '—'}
            unit="calibration"
            icon={<ExperimentOutlined />}
            color={(k.instruments_due || 0) > 0 ? '#dc2626' : '#16a34a'}
          />
        </Col>
      </Row>

      {/* ── Production + Quality ── */}
      <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>
        <Col xs={24} lg={12}>
          <SectionCard
            title="Production"
            icon={<ToolOutlined />}
            color="#dc2626"
            extra={
              <div style={{ display: 'flex', gap: 4 }}>
                {(p.delayed_wos || 0) > 0 && <Tag color="red">{p.delayed_wos} Delayed</Tag>}
                {(p.fpi_waiting || 0) > 0 && <Tag color="orange">{p.fpi_waiting} FPI</Tag>}
              </div>
            }
          >
            <StatGrid items={[
              { label: 'Active WOs',     value: p.active_wos,      color: '#1d4ed8' },
              { label: 'In Progress',    value: p.in_progress_wos, color: '#7c3aed' },
              { label: 'Delayed WOs',    value: p.delayed_wos,     color: (p.delayed_wos || 0) > 0 ? '#dc2626' : '#16a34a', unit: 'overdue' },
              { label: 'Open Job Cards', value: p.open_job_cards,  color: '#d97706' },
            ]} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Tag style={{ borderRadius: 8, padding: '2px 8px', fontSize: 11 }}>
                WOs Closed Today: <b>{p.completed_wos_today ?? 0}</b>
              </Tag>
              <Tag style={{ borderRadius: 8, padding: '2px 8px', fontSize: 11 }}>
                Jobs Done Today: <b>{p.closed_job_cards_today ?? 0}</b>
              </Tag>
              {(p.scrap_today || 0) > 0 && (
                <Tag color="red" style={{ borderRadius: 8, padding: '2px 8px', fontSize: 11 }}>
                  Scrap Today: {p.scrap_today}
                </Tag>
              )}
            </div>
          </SectionCard>
        </Col>

        <Col xs={24} lg={12}>
          <SectionCard
            title="Quality Pipeline"
            icon={<SafetyOutlined />}
            color="#16a34a"
            extra={
              <div style={{ display: 'flex', gap: 4 }}>
                {(q.open_ncrs || 0) > 0 && <Tag color="red">{q.open_ncrs} NCRs</Tag>}
                {(q.open_capas || 0) > 0 && <Tag color="orange">{q.open_capas} CAPAs</Tag>}
              </div>
            }
          >
            <StatGrid items={[
              { label: 'IQC Pending', value: q.iqc_pending,      color: (q.iqc_pending || 0) > 0 ? '#d97706' : '#16a34a', unit: 'lots' },
              { label: 'LQC Checks',  value: q.lqc_checks_today, color: '#1d4ed8',                                          unit: 'today' },
              { label: 'PQC Pending', value: q.pqc_pending,      color: (q.pqc_pending || 0) > 0 ? '#d97706' : '#16a34a', unit: 'batches' },
              { label: 'OQC Pending', value: q.oqc_pending,      color: (q.oqc_pending || 0) > 0 ? '#d97706' : '#16a34a', unit: 'lots' },
            ]} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Tag color={(q.complaints_month || 0) === 0 ? 'green' : 'red'} style={{ borderRadius: 8, fontSize: 11 }}>
                Complaints: {q.complaints_month ?? 0}
              </Tag>
              <Tag color={(q.open_ncrs || 0) === 0 ? 'green' : 'orange'} style={{ borderRadius: 8, fontSize: 11 }}>
                Open NCRs: {q.open_ncrs ?? 0}
              </Tag>
              <Tag color={(q.open_capas || 0) === 0 ? 'green' : 'orange'} style={{ borderRadius: 8, fontSize: 11 }}>
                Open CAPAs: {q.open_capas ?? 0}
              </Tag>
            </div>
          </SectionCard>
        </Col>
      </Row>

      {/* ── Inventory + Dispatch + Maintenance ── */}
      <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>
        <Col xs={24} md={8}>
          <SectionCard title="Inventory & Store" icon={<DatabaseOutlined />} color="#7c3aed">
            <StatGrid items={[
              { label: 'GRN Pending', value: inv.grn_pending,     color: (inv.grn_pending || 0) > 0 ? '#d97706' : '#16a34a', unit: 'deliveries' },
              { label: 'Low Stock',   value: inv.low_stock_alerts, color: (inv.low_stock_alerts || 0) > 0 ? '#dc2626' : '#16a34a', unit: 'items' },
            ]} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Tag style={{ borderRadius: 8, fontSize: 11 }}>
                Mat. Requests: <b>{inv.pending_material_requests ?? 0}</b>
              </Tag>
              <Tag color="blue" style={{ borderRadius: 8, fontSize: 11 }}>
                Total SKUs: <b>{inv.total_skus ?? 0}</b>
              </Tag>
            </div>
          </SectionCard>
        </Col>

        <Col xs={24} md={8}>
          <SectionCard title="Dispatch & Logistics" icon={<CarOutlined />} color="#0d9488">
            <StatGrid items={[
              { label: 'Pending Shipments', value: dis.pending_shipments, color: (dis.pending_shipments || 0) > 0 ? '#d97706' : '#374151', unit: 'orders' },
              { label: 'Dispatched Today',  value: dis.dispatched_today,  color: '#16a34a', unit: 'orders' },
            ]} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Tag color={(dis.pod_pending || 0) > 0 ? 'orange' : 'green'} style={{ borderRadius: 8, fontSize: 11 }}>
                POD Pending: {dis.pod_pending ?? 0}
              </Tag>
              <Tag color={dis.otd_pct == null ? 'default' : dis.otd_pct >= 95 ? 'green' : 'orange'} style={{ borderRadius: 8, fontSize: 11 }}>
                OTD: {dis.otd_pct ?? '—'}%
              </Tag>
            </div>
          </SectionCard>
        </Col>

        <Col xs={24} md={8}>
          <SectionCard title="Maintenance" icon={<ThunderboltOutlined />} color="#b45309">
            <StatGrid items={[
              { label: 'Open Breakdowns', value: mnt.open_breakdowns, color: (mnt.open_breakdowns || 0) > 0 ? '#dc2626' : '#16a34a', unit: 'requests' },
              { label: 'Open MWOs',       value: mnt.open_mwos,       color: (mnt.open_mwos || 0) > 5 ? '#d97706' : '#374151',        unit: 'work orders' },
            ]} />
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Tag color={(mnt.downtime_events_today || 0) > 0 ? 'orange' : 'green'} style={{ borderRadius: 8, fontSize: 11 }}>
                Downtime Events: {mnt.downtime_events_today ?? 0} today
              </Tag>
            </div>
          </SectionCard>
        </Col>
      </Row>

      {/* ── Alerts + HR ── */}
      <Row gutter={[10, 10]}>
        <Col xs={24} md={alertCount > 0 ? 16 : 24}>
          <SectionCard title="HR Overview" icon={<TeamOutlined />} color="#92400e">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', padding: '6px 24px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{hr.total_employees ?? '—'}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Active Employees</div>
              </div>
              <div style={{
                textAlign: 'center', padding: '6px 24px', borderRadius: 10,
                background: (hr.training_expired || 0) > 0 ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${(hr.training_expired || 0) > 0 ? '#fca5a5' : '#bbf7d0'}`,
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: (hr.training_expired || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                  {hr.training_expired ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Training Expired</div>
              </div>
              {alertCount === 0 && (
                <Tag color="green" style={{ borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
                  ✓ No active alerts — all systems normal
                </Tag>
              )}
            </div>
          </SectionCard>
        </Col>

        {alertCount > 0 && (
          <Col xs={24} md={8}>
            <SectionCard title="Active Alerts" icon={<AlertOutlined />} color="#dc2626">
              <AlertRow label="Instruments due for calibration" value={q.instruments_due || 0} severity="red"    icon={<ExperimentOutlined />} />
              <AlertRow label="Open breakdown requests"         value={mnt.open_breakdowns || 0} severity="red"    icon={<ThunderboltOutlined />} />
              <AlertRow label="Items below reorder level"       value={inv.low_stock_alerts || 0} severity="orange" icon={<WarningOutlined />} />
              <AlertRow label="Delayed work orders"             value={p.delayed_wos || 0}        severity="orange" icon={<ClockCircleOutlined />} />
              <AlertRow label="Open NCRs"                       value={q.open_ncrs || 0}          severity="orange" icon={<WarningOutlined />} />
              <AlertRow label="Open CAPAs"                      value={q.open_capas || 0}         severity="blue"   icon={<FileTextOutlined />} />
            </SectionCard>
          </Col>
        )}
      </Row>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE STAT TEMPLATES (all other roles)
// ─────────────────────────────────────────────────────────────────────────────
const STAT_TEMPLATES = {
  qa_manager: (d) => [
    { label: 'Open NCRs',         value: d.open_ncrs         ?? '-', unit: 'items',     color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Open CAPAs',        value: d.open_capas        ?? '-', unit: 'actions',   color: '#d97706', icon: <FileTextOutlined /> },
    { label: 'Instruments Due',   value: d.instruments_due   ?? '-', unit: 'calibration', color: '#7c3aed', icon: <ExperimentOutlined /> },
    { label: 'Complaints',        value: d.complaints_month  ?? '-', unit: 'this month', color: (d.complaints_month || 0) === 0 ? '#16a34a' : '#dc2626', icon: <AlertOutlined /> },
  ],
  quality_manager: (d) => [
    { label: 'Open NCRs',         value: d.open_ncrs         ?? '-', unit: 'items',       color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Open CAPAs',        value: d.open_capas        ?? '-', unit: 'actions',     color: '#d97706', icon: <FileTextOutlined /> },
    { label: 'Instruments Due',   value: d.instruments_due   ?? '-', unit: 'calibration', color: '#7c3aed', icon: <ExperimentOutlined /> },
    { label: 'Complaints',        value: d.complaints_month  ?? '-', unit: 'this month',  color: (d.complaints_month || 0) === 0 ? '#16a34a' : '#dc2626', icon: <AlertOutlined /> },
  ],
  iqc_inspector: (d) => [
    { label: 'Pending Inspections', value: d.pending_inspections ?? '-', unit: 'lots',        color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Cleared Today',       value: d.cleared_today       ?? '-', unit: 'lots',        color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Rejected Today',      value: d.rejected_today      ?? '-', unit: 'lot',         color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Instruments Due',     value: d.instruments_due     ?? '-', unit: 'calibration', color: '#7c3aed', icon: <ExperimentOutlined /> },
  ],
  lqc_inspector: (d) => [
    { label: 'FPI Pending',   value: d.fpi_pending         ?? '-', unit: 'WOs',          color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Hourly Checks', value: d.hourly_checks_today ?? '-', unit: 'done today',   color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Rejections',    value: d.rejections_today    ?? '-', unit: 'pieces today', color: '#d97706', icon: <WarningOutlined /> },
  ],
  pqc_inspector: (d) => [
    { label: 'Pending Final Inspection', value: d.pending_final ?? '-', unit: 'batches', color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Cleared for Packing',      value: d.cleared_today ?? '-', unit: 'batches', color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'OQC Queue',                value: d.oqc_queue     ?? '-', unit: 'waiting', color: '#7c3aed', icon: <ClockCircleOutlined /> },
  ],
  oqc_inspector: (d) => [
    { label: 'Pending OQC',         value: d.pending_oqc    ?? '-', unit: 'lots',  color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Released Today',      value: d.released_today ?? '-', unit: 'lots',  color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Test Certs Generated', value: d.certs_today   ?? '-', unit: 'today', color: '#2563eb', icon: <FileTextOutlined /> },
    { label: 'COC Issued',          value: d.cocs_today     ?? '-', unit: 'today', color: '#7c3aed', icon: <FileTextOutlined /> },
  ],
  procurement_manager: (d) => [
    { label: 'Open Orders',       value: d.open_pos      ?? '-', unit: 'orders',    color: '#2563eb', icon: <FileTextOutlined /> },
    { label: 'Overdue SCARs',     value: d.overdue_scars ?? '-', unit: 'suppliers', color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Low Stock Alerts',  value: d.low_stock     ?? '-', unit: 'items',     color: '#d97706', icon: <WarningOutlined /> },
    { label: 'SCARs Open',        value: d.scars_open    ?? '-', unit: 'action',    color: '#7c3aed', icon: <FileTextOutlined /> },
  ],
  store_manager: (d) => [
    { label: 'GRN Pending',   value: d.grn_pending   ?? '-', unit: 'deliveries', color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Stock Alerts',  value: d.stock_alerts  ?? '-', unit: 'reorder',    color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Issued to WOs', value: d.issued_today  ?? '-', unit: 'today',      color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Total SKUs',    value: d.total_skus    ?? '-', unit: 'active',     color: '#2563eb', icon: <DatabaseOutlined /> },
  ],
  store_incharge: (d) => [
    { label: 'GRN Pending',   value: d.grn_pending   ?? '-', unit: 'deliveries', color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Stock Alerts',  value: d.stock_alerts  ?? '-', unit: 'reorder',    color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Issued to WOs', value: d.issued_today  ?? '-', unit: 'today',      color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Total SKUs',    value: d.total_skus    ?? '-', unit: 'active',     color: '#2563eb', icon: <DatabaseOutlined /> },
  ],
  production_planner: (d) => [
    { label: 'Active Work Orders', value: d.active_wos      ?? '-', unit: 'WOs',   color: '#2563eb', icon: <FileTextOutlined /> },
    { label: 'On Schedule',        value: d.on_schedule     ?? '-', unit: 'WOs',   color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Delayed',            value: d.delayed         ?? '-', unit: 'WOs',   color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Material Shortage',  value: d.shortage_alerts ?? '-', unit: 'alert', color: '#d97706', icon: <WarningOutlined /> },
  ],
  production_supervisor: (d) => [
    { label: 'Active Job Cards', value: d.active_jobs      ?? '-', unit: 'running', color: '#2563eb', icon: <ToolOutlined /> },
    { label: 'Completed Today',  value: d.completed_today  ?? '-', unit: 'jobs',    color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Scrap Today',      value: d.scrap_today      ?? '-', unit: 'pieces',  color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'FPI Waiting',      value: d.fpi_waiting      ?? '-', unit: 'batch',   color: '#d97706', icon: <ClockCircleOutlined /> },
  ],
  production_manager: (d) => [
    { label: 'Active Job Cards', value: d.active_jobs      ?? '-', unit: 'running', color: '#2563eb', icon: <ToolOutlined /> },
    { label: 'Completed Today',  value: d.completed_today  ?? '-', unit: 'jobs',    color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Scrap Today',      value: d.scrap_today      ?? '-', unit: 'pieces',  color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'FPI Waiting',      value: d.fpi_waiting      ?? '-', unit: 'batch',   color: '#d97706', icon: <ClockCircleOutlined /> },
  ],
  dispatch_manager: (d) => [
    { label: 'Pending Shipments', value: d.pending_shipments ?? '-', unit: 'orders',  color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Dispatched Today',  value: d.dispatched_today  ?? '-', unit: 'orders',  color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'POD Pending',       value: d.pod_pending       ?? '-', unit: 'confirm', color: '#7c3aed', icon: <WarningOutlined /> },
  ],
  accounts_manager: (d) => [
    { label: 'COPQ This Month', value: d.copq_month ? `₹${(d.copq_month / 100000).toFixed(1)}L` : '-', unit: '', color: '#dc2626', icon: <DollarOutlined /> },
    { label: 'GRN Pending',     value: d.grn_pending  ?? '-', unit: 'entries',    color: '#d97706', icon: <FileTextOutlined /> },
    { label: 'Debit Notes',     value: d.debit_notes  ?? '-', unit: 'this month', color: '#7c3aed', icon: <FileTextOutlined /> },
  ],
  hr_admin: (d) => [
    { label: 'Active Employees',  value: d.total_employees  ?? '-', unit: 'active',  color: '#16a34a', icon: <TeamOutlined /> },
    { label: 'Training Expired',  value: d.training_expired ?? '-', unit: 'records', color: (d.training_expired || 0) > 0 ? '#dc2626' : '#16a34a', icon: <WarningOutlined /> },
  ],
  hr_manager: (d) => [
    { label: 'Active Employees',  value: d.total_employees  ?? '-', unit: 'active',  color: '#16a34a', icon: <TeamOutlined /> },
    { label: 'Training Expired',  value: d.training_expired ?? '-', unit: 'records', color: (d.training_expired || 0) > 0 ? '#dc2626' : '#16a34a', icon: <WarningOutlined /> },
  ],
};

// ── Role layout config ────────────────────────────────────────────────────────
const ROLE_LAYOUT = {
  qa_manager:             { title: 'Quality Manager Dashboard',      subtitle: 'Quality, NCRs, CAPAs, Compliance',   icon: <SafetyOutlined />,       color: '#16a34a' },
  quality_manager:        { title: 'Quality Manager Dashboard',      subtitle: 'Quality, NCRs, CAPAs, Compliance',   icon: <SafetyOutlined />,       color: '#16a34a' },
  npd_engineer:           { title: 'NPD Engineer Dashboard',         subtitle: 'New Product Development',            icon: <FileTextOutlined />,     color: '#16a34a' },
  iqc_inspector:          { title: 'IQC Inspector Dashboard',        subtitle: 'Incoming Quality Control',           icon: <SafetyOutlined />,       color: '#16a34a' },
  lqc_inspector:          { title: 'LQC Inspector Dashboard',        subtitle: 'Line Quality Control',               icon: <SafetyOutlined />,       color: '#16a34a' },
  pqc_inspector:          { title: 'PQC Inspector Dashboard',        subtitle: 'Pre-Dispatch Quality',               icon: <SafetyOutlined />,       color: '#16a34a' },
  oqc_inspector:          { title: 'OQC Inspector Dashboard',        subtitle: 'Outgoing Quality Control',           icon: <SafetyOutlined />,       color: '#16a34a' },
  procurement_manager:    { title: 'Procurement Dashboard',          subtitle: 'Supply Chain & Vendors',             icon: <ShoppingCartOutlined />, color: '#b45309' },
  store_manager:          { title: 'Store / Warehouse Dashboard',    subtitle: 'Inventory Management',               icon: <DatabaseOutlined />,     color: '#7c3aed' },
  store_incharge:         { title: 'Store Dashboard',                subtitle: 'Inventory & Warehouse Operations',   icon: <DatabaseOutlined />,     color: '#7c3aed' },
  production_planner:     { title: 'Production Planner Dashboard',   subtitle: 'Work Order Management',              icon: <ToolOutlined />,         color: '#dc2626' },
  production_supervisor:  { title: 'Production Supervisor',          subtitle: 'Floor Supervision & Job Cards',      icon: <ToolOutlined />,         color: '#dc2626' },
  production_manager:     { title: 'Production Manager Dashboard',   subtitle: 'Production Operations',              icon: <ToolOutlined />,         color: '#dc2626' },
  operator:               { title: 'Operator Dashboard',             subtitle: 'My Job Cards & Tasks',               icon: <ToolOutlined />,         color: '#dc2626' },
  dispatch_manager:       { title: 'Dispatch Manager Dashboard',     subtitle: 'Logistics & Dispatch',               icon: <CarOutlined />,          color: '#0d9488' },
  accounts_manager:       { title: 'Accounts Dashboard',             subtitle: 'Finance & Cost Tracking',            icon: <DollarOutlined />,       color: '#1d4ed8' },
  hr_admin:               { title: 'HR Admin Dashboard',             subtitle: 'HR & Administration',                icon: <TeamOutlined />,         color: '#92400e' },
  hr_manager:             { title: 'HR Manager Dashboard',           subtitle: 'Human Resources',                    icon: <TeamOutlined />,         color: '#92400e' },
};

const DEFAULT_LAYOUT = { title: 'Dashboard', subtitle: 'Dynatech ONE MES', icon: <SettingOutlined />, color: '#1d4ed8' };
const GOLDEN_ROLES   = ['plant_head', 'it_admin'];

// ── Mini KPI strip for non-admin roles ───────────────────────────────────────
const MiniKpiStrip = ({ kpis }) => {
  if (!kpis) return null;
  const items = [
    { label: 'Open Orders',    value: kpis.open_orders ?? '—',         color: '#1d4ed8' },
    { label: 'Complaints',     value: kpis.customer_complaints ?? '—', color: (kpis.customer_complaints || 0) === 0 ? '#16a34a' : '#dc2626' },
    { label: 'OTD',            value: kpis.otd_pct != null ? `${kpis.otd_pct}%` : '—', color: '#0d9488' },
    { label: 'FPY',            value: kpis.fpy_pct != null ? `${kpis.fpy_pct}%` : '—', color: '#16a34a' },
    { label: 'COPQ',           value: kpis.copq_amount > 0 ? `₹${(kpis.copq_amount / 100000).toFixed(1)}L` : '₹0', color: '#d97706' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16,
      background: '#f8fafc', borderRadius: 10, padding: '10px 14px',
      border: '1px solid #e8eaed',
    }}>
      <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, alignSelf: 'center', marginRight: 4 }}>
        PLANT KPIs:
      </Text>
      {items.map((item) => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: '#fff', borderRadius: 8, padding: '4px 10px',
          border: '1px solid #e8eaed',
        }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{item.label}:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const RoleDashboard = ({ user }) => {
  const roleName  = user?.role?.name;
  const isGolden  = GOLDEN_ROLES.includes(roleName);
  const layout    = ROLE_LAYOUT[roleName] || DEFAULT_LAYOUT;

  const [fullData,  setFullData]  = useState(null);
  const [roleStats, setRoleStats] = useState({});
  const [kpis,      setKpis]      = useState(null);
  const [loading,   setLoading]   = useState(true);

  const fetchData = useCallback(async () => {
    if (!roleName) { setLoading(false); return; }
    setLoading(true);
    try {
      if (isGolden) {
        // Full dashboard data in a single call
        // Axios interceptor unwraps res.data, then .then(r => r.data) extracts the inner data
        // so the result IS the data object directly (no .success wrapper)
        const res = await dashboardApi.getFullDashboard();
        setFullData(res ?? null);
      } else {
        // Role-specific stats + mini KPI strip
        const promises = [dashboardApi.getKpis()];
        if (STAT_TEMPLATES[roleName]) {
          promises.push(dashboardApi.getRoleStats(roleName));
        }
        const [kpiRes, roleRes] = await Promise.all(promises);
        if (kpiRes)  setKpis(kpiRes);
        if (roleRes) setRoleStats(roleRes);
      }
    } catch (err) {
      console.warn('[RoleDashboard] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [roleName, isGolden]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Golden Dashboard ──────────────────────────────────────────────────────
  if (isGolden) {
    return (
      <GoldenDashboard
        data={fullData}
        loading={loading}
        onRefresh={fetchData}
        user={user}
      />
    );
  }

  // ── Role Dashboard ────────────────────────────────────────────────────────
  const builder    = STAT_TEMPLATES[roleName];
  const statCards  = builder ? builder(roleStats) : [];
  const profileRows = [
    ['Employee ID',  user?.employee_id],
    ['Full Name',    user?.name],
    ['Email',        user?.email],
    ['Phone',        user?.phone],
    ['Role',         user?.role?.label],
    ['Department',   user?.department?.name ? `${user.department.code} — ${user.department.name}` : '—'],
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>{user?.department?.name || 'Dashboard'}</Text>
          </div>
          <Title level={3} style={{ margin: 0 }}>{layout.title}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {layout.subtitle} &nbsp;·&nbsp; {dayjs().format('D MMM YYYY')}
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ borderRadius: 8, marginTop: 6 }}>Refresh</Button>
      </div>

      <Spin spinning={loading}>
        {/* Mini KPI strip */}
        <MiniKpiStrip kpis={kpis} />

        {/* Role stat cards */}
        {statCards.length > 0 && (
          <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
            {statCards.map((stat, i) => (
              <Col xs={24} sm={12} xl={6} key={i}>
                <StatCard {...stat} />
              </Col>
            ))}
          </Row>
        )}

        {/* Profile */}
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}
          title={<Text style={{ fontSize: 13, fontWeight: 700 }}>My Profile</Text>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px 24px' }}>
            {profileRows.map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <Text style={{ fontSize: 12, color: '#9ca3af', minWidth: 100 }}>{label}</Text>
                <Text style={{ fontSize: 12, color: '#111827', fontWeight: 500 }}>{value || '—'}</Text>
              </div>
            ))}
          </div>
        </Card>
      </Spin>
    </div>
  );
};

export default RoleDashboard;
