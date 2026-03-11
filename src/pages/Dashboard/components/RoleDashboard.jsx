import React, { useState, useEffect } from 'react';
import { Row, Col, Spin } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
  ToolOutlined,
  CarOutlined,
  DollarOutlined,
  TeamOutlined,
  SettingOutlined,
  SafetyOutlined,
  ShoppingCartOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import StatCard from '../../../components/StatCard';
import PageHeader from '../../../components/PageHeader';
import InfoTable from '../../../components/InfoTable';
import dashboardApi from '../../../api/dashboard.api';

// ─── Stat template builders (icons + colors, values filled from API) ─────────
const STAT_TEMPLATES = {
  plant_head: (d) => [
    { label: 'Customer Complaints', value: d.customer_complaints ?? '-', unit: 'this month', color: (d.customer_complaints || 0) === 0 ? '#16a34a' : '#dc2626', icon: <CheckCircleOutlined /> },
    { label: 'OTD %',               value: d.otd_pct ?? '-',             unit: '%',          color: '#2563eb', icon: <ClockCircleOutlined /> },
    { label: 'Rejection Rate',       value: d.rejection_pct ?? '-',       unit: '%',          color: '#d97706', icon: <WarningOutlined /> },
    { label: 'Open Orders',          value: d.open_orders ?? '-',         unit: 'active',     color: '#7c3aed', icon: <FileTextOutlined /> },
  ],
  it_admin: (d) => [
    { label: 'Active Users',   value: d.total_employees ?? 16, unit: 'users',   color: '#16a34a', icon: <TeamOutlined /> },
    { label: 'Modules Active', value: 33,                      unit: 'modules', color: '#2563eb', icon: <SettingOutlined /> },
    { label: 'System Health',  value: '99.9',                  unit: '%',       color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Open Orders',    value: d.open_orders ?? '-',    unit: 'active',  color: '#d97706', icon: <FileTextOutlined /> },
  ],
  qa_manager: (d) => [
    { label: 'IQC Pending',       value: d.pending_inspections ?? '-', unit: 'lots',    color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'OQC Cleared Today', value: d.released_today ?? '-',     unit: 'batches', color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'FPY This Month',    value: d.fpy_pct ?? '-',            unit: '%',       color: '#2563eb', icon: <SafetyOutlined /> },
    { label: 'Rejection Rate',    value: d.rejection_pct ?? '-',      unit: '%',       color: '#dc2626', icon: <WarningOutlined /> },
  ],
  iqc_inspector: (d) => [
    { label: 'Pending Inspections', value: d.pending_inspections ?? '-', unit: 'lots',        color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Cleared Today',       value: d.cleared_today ?? '-',       unit: 'lots',        color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Rejected Today',      value: d.rejected_today ?? '-',      unit: 'lot',         color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Instruments Due',     value: d.instruments_due ?? '-',     unit: 'calibration', color: '#7c3aed', icon: <ToolOutlined /> },
  ],
  lqc_inspector: (d) => [
    { label: 'FPI Pending',   value: d.fpi_pending ?? '-',          unit: 'WOs',         color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Hourly Checks', value: d.hourly_checks_today ?? '-',  unit: 'done today',  color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Rejections',    value: d.rejections_today ?? '-',     unit: 'pieces today', color: '#d97706', icon: <WarningOutlined /> },
  ],
  pqc_inspector: (d) => [
    { label: 'Pending Final Inspection', value: d.pending_final ?? '-', unit: 'batches', color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Cleared for Packing',      value: d.cleared_today ?? '-', unit: 'batches', color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'OQC Queue',                value: d.oqc_queue ?? '-',     unit: 'waiting', color: '#7c3aed', icon: <ClockCircleOutlined /> },
  ],
  oqc_inspector: (d) => [
    { label: 'Pending OQC',         value: d.pending_oqc ?? '-',      unit: 'lots',  color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Released Today',       value: d.released_today ?? '-',   unit: 'lots',  color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Test Certs Generated', value: d.certs_today ?? '-',     unit: 'today', color: '#2563eb', icon: <FileTextOutlined /> },
    { label: 'COC Issued',           value: d.cocs_today ?? '-',      unit: 'today', color: '#7c3aed', icon: <FileTextOutlined /> },
  ],
  procurement_manager: (d) => [
    { label: 'Open POs',           value: d.open_pos ?? '-',      unit: 'orders',    color: '#2563eb', icon: <FileTextOutlined /> },
    { label: 'Overdue SCARs',      value: d.overdue_scars ?? '-', unit: 'suppliers', color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Low Stock Alerts',   value: d.low_stock ?? '-',     unit: 'items',     color: '#d97706', icon: <WarningOutlined /> },
    { label: 'SCARs Open',         value: d.scars_open ?? '-',    unit: 'action',    color: '#7c3aed', icon: <FileTextOutlined /> },
  ],
  store_manager: (d) => [
    { label: 'GRN Pending',   value: d.grn_pending ?? '-',   unit: 'deliveries', color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Stock Alerts',  value: d.stock_alerts ?? '-',  unit: 'reorder',    color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Issued to WOs', value: d.issued_today ?? '-',  unit: 'today',      color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Total SKUs',    value: d.total_skus ?? '-',    unit: 'active',     color: '#2563eb', icon: <DatabaseOutlined /> },
  ],
  production_planner: (d) => [
    { label: 'Active Work Orders', value: d.active_wos ?? '-',       unit: 'WOs',   color: '#2563eb', icon: <FileTextOutlined /> },
    { label: 'On Schedule',        value: d.on_schedule ?? '-',      unit: 'WOs',   color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Delayed',            value: d.delayed ?? '-',          unit: 'WOs',   color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'Material Shortage',  value: d.shortage_alerts ?? '-',  unit: 'alert', color: '#d97706', icon: <WarningOutlined /> },
  ],
  production_supervisor: (d) => [
    { label: 'Active Job Cards', value: d.active_jobs ?? '-',      unit: 'running', color: '#2563eb', icon: <ToolOutlined /> },
    { label: 'Completed Today',  value: d.completed_today ?? '-',  unit: 'jobs',    color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'Scrap Today',      value: d.scrap_today ?? '-',      unit: 'pieces',  color: '#dc2626', icon: <WarningOutlined /> },
    { label: 'FPI Waiting',      value: d.fpi_waiting ?? '-',      unit: 'batch',   color: '#d97706', icon: <ClockCircleOutlined /> },
  ],
  dispatch_manager: (d) => [
    { label: 'Pending Shipments', value: d.pending_shipments ?? '-',  unit: 'orders',  color: '#d97706', icon: <ClockCircleOutlined /> },
    { label: 'Dispatched Today',  value: d.dispatched_today ?? '-',   unit: 'orders',  color: '#16a34a', icon: <CheckCircleOutlined /> },
    { label: 'POD Pending',       value: d.pod_pending ?? '-',        unit: 'confirm', color: '#7c3aed', icon: <WarningOutlined /> },
  ],
  accounts_manager: (d) => [
    { label: 'COPQ This Month', value: d.copq_month ? `₹${(d.copq_month / 100000).toFixed(1)}L` : '-', unit: '', color: '#dc2626', icon: <DollarOutlined /> },
    { label: 'GRN Pending',     value: d.grn_pending ?? '-',   unit: 'entries',   color: '#d97706', icon: <FileTextOutlined /> },
    { label: 'Debit Notes',     value: d.debit_notes ?? '-',   unit: 'this month', color: '#7c3aed', icon: <FileTextOutlined /> },
  ],
  hr_admin: (d) => [
    { label: 'Total Employees', value: d.total_employees ?? '-', unit: 'active', color: '#16a34a', icon: <TeamOutlined /> },
  ],
};

// ─── Role layout config ─────────────────────────────────────────────────────
const ROLE_LAYOUT = {
  plant_head:             { title: 'Plant Head — Golden Dashboard',  subtitle: 'Dept 10 · Morning Overview',       icon: <SettingOutlined />,     color: '#1d4ed8' },
  it_admin:               { title: 'IT Admin — System Control',      subtitle: 'Dept 10 · Admin Control Room',     icon: <SettingOutlined />,     color: '#1d4ed8' },
  qa_manager:             { title: 'QA Manager Dashboard',           subtitle: 'Dept 11 · Quality Overview',       icon: <SafetyOutlined />,     color: '#16a34a' },
  npd_engineer:           { title: 'NPD Engineer Dashboard',         subtitle: 'Dept 11 · New Product Development', icon: <FileTextOutlined />,   color: '#16a34a' },
  iqc_inspector:          { title: 'IQC Inspector Dashboard',        subtitle: 'Dept 11 · Incoming Quality',       icon: <SafetyOutlined />,     color: '#16a34a' },
  lqc_inspector:          { title: 'LQC Inspector Dashboard',        subtitle: 'Dept 11 · Line Quality Control',   icon: <SafetyOutlined />,     color: '#16a34a' },
  pqc_inspector:          { title: 'PQC Inspector Dashboard',        subtitle: 'Dept 11 · Pre-Dispatch Quality',   icon: <SafetyOutlined />,     color: '#16a34a' },
  oqc_inspector:          { title: 'OQC Inspector Dashboard',        subtitle: 'Dept 11 · Outgoing Quality',       icon: <SafetyOutlined />,     color: '#16a34a' },
  procurement_manager:    { title: 'Procurement Dashboard',          subtitle: 'Dept 12 · Supply Chain',           icon: <ShoppingCartOutlined />, color: '#b45309' },
  store_manager:          { title: 'Store / Warehouse Dashboard',    subtitle: 'Dept 13 · Inventory Management',   icon: <DatabaseOutlined />,   color: '#7c3aed' },
  production_planner:     { title: 'Production Planner Dashboard',   subtitle: 'Dept 14 · Work Order Management',  icon: <ToolOutlined />,       color: '#dc2626' },
  production_supervisor:  { title: 'Production Supervisor',          subtitle: 'Dept 14 · Floor Supervision',      icon: <ToolOutlined />,       color: '#dc2626' },
  operator:               { title: 'Operator Dashboard',             subtitle: 'Dept 14 · My Job Cards',           icon: <ToolOutlined />,       color: '#dc2626' },
  dispatch_manager:       { title: 'Dispatch Manager Dashboard',     subtitle: 'Dept 15 · Logistics & Dispatch',   icon: <CarOutlined />,        color: '#0d9488' },
  accounts_manager:       { title: 'Accounts Dashboard',             subtitle: 'Dept 16 · Finance & Tally',        icon: <DollarOutlined />,     color: '#1d4ed8' },
  hr_admin:               { title: 'HR Admin Dashboard',             subtitle: 'Dept 17 · HR & Administration',    icon: <TeamOutlined />,       color: '#92400e' },
};

const DEFAULT_LAYOUT = { title: 'Dashboard', subtitle: 'Dynatech ONE', icon: <SettingOutlined />, color: '#1d4ed8' };

// Roles that use golden KPIs (plant_head, it_admin, qa_manager)
const KPI_ROLES = ['plant_head', 'it_admin', 'qa_manager'];

// ─── Component ──────────────────────────────────────────────────────────────
const RoleDashboard = ({ user }) => {
  const roleName = user?.role?.name;
  const layout = ROLE_LAYOUT[roleName] || DEFAULT_LAYOUT;
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleName) { setLoading(false); return; }

    const fetchStats = async () => {
      try {
        let data = {};

        if (KPI_ROLES.includes(roleName)) {
          // Golden KPIs — shared across plant_head, it_admin, qa_manager
          const kpiRes = await dashboardApi.getKpis();
          if (kpiRes.success) data = { ...data, ...kpiRes.data };
        }

        if (STAT_TEMPLATES[roleName]) {
          // Role-specific stats
          const roleRes = await dashboardApi.getRoleStats(roleName);
          if (roleRes.success) data = { ...data, ...roleRes.data };
        }

        const builder = STAT_TEMPLATES[roleName];
        if (builder) {
          setStats(builder(data));
        }
      } catch (err) {
        console.warn('[RoleDashboard] API failed, stats unavailable:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [roleName]);

  const profileRows = [
    ['Employee ID',  user?.employee_id],
    ['Full Name',    user?.name],
    ['Email',        user?.email],
    ['Phone',        user?.phone],
    ['Role',         user?.role?.label],
    ['Department',   `Dept ${user?.department?.code} — ${user?.department?.name}`],
  ];

  const systemRows = [
    ['Platform',      'Dynatech ONE v1.0'],
    ['Standard',      'IATF 16949 Compliant'],
    ['Total Modules', '33 modules'],
    ['AI System',     'Madad — 8 Agents (Coming Soon)'],
    ['Session',       '8-hour auto-logout (SYS-004)'],
    ['Build Date',    'March 2026'],
  ];

  return (
    <div>
      <PageHeader
        icon={layout.icon}
        title={layout.title}
        subtitle={layout.subtitle}
        tag={user?.department?.name}
        color={layout.color}
      />

      <Spin spinning={loading}>
        {stats.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {stats.map((stat, i) => (
              <Col xs={24} sm={12} xl={6} key={i}>
                <StatCard {...stat} />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <InfoTable title="My Profile" rows={profileRows} />
        </Col>
        <Col xs={24} md={12}>
          <InfoTable title="System Information" rows={systemRows} />
        </Col>
      </Row>
    </div>
  );
};

export default RoleDashboard;
