import React from 'react';
import { Row, Col } from 'antd';
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

// ─── Role-specific config ─────────────────────────────────────────────────────
const ROLE_CONFIG = {
  plant_head: {
    title: 'Plant Head — Golden Dashboard',
    subtitle: 'Dept 10 · Morning Overview',
    icon: <SettingOutlined />,
    color: '#1d4ed8',
    stats: [
      { label: 'Customer Complaints', value: 0,     unit: 'this month', color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'OTD %',               value: '96.4', unit: '%',         color: '#2563eb', icon: <ClockCircleOutlined /> },
      { label: 'Rejection Rate',       value: '2.1',  unit: '%',         color: '#d97706', icon: <WarningOutlined /> },
      { label: 'Open Orders',          value: 14,    unit: 'active',    color: '#7c3aed', icon: <FileTextOutlined /> },
    ],
  },
  it_admin: {
    title: 'IT Admin — System Control',
    subtitle: 'Dept 10 · Admin Control Room',
    icon: <SettingOutlined />,
    color: '#1d4ed8',
    stats: [
      { label: 'Active Users',   value: 16,     unit: 'users',   color: '#16a34a', icon: <TeamOutlined /> },
      { label: 'Modules Active', value: 33,     unit: 'modules', color: '#2563eb', icon: <SettingOutlined /> },
      { label: 'System Health',  value: '99.9', unit: '%',       color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Audit Events',   value: 128,    unit: 'today',   color: '#d97706', icon: <FileTextOutlined /> },
    ],
  },
  qa_manager: {
    title: 'QA Manager Dashboard',
    subtitle: 'Dept 11 · Quality Overview',
    icon: <SafetyOutlined />,
    color: '#16a34a',
    stats: [
      { label: 'IQC Pending',       value: 3,     unit: 'lots',    color: '#d97706', icon: <ClockCircleOutlined /> },
      { label: 'OQC Cleared Today', value: 7,     unit: 'batches', color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Open CAPAs',        value: 2,     unit: 'actions', color: '#dc2626', icon: <WarningOutlined /> },
      { label: 'FPY This Week',     value: '97.2', unit: '%',      color: '#2563eb', icon: <SafetyOutlined /> },
    ],
  },
  npd_engineer: {
    title: 'NPD Engineer Dashboard',
    subtitle: 'Dept 11 · New Product Development',
    icon: <FileTextOutlined />,
    color: '#16a34a',
    stats: [
      { label: 'Active Projects',  value: 3, unit: 'NPD',      color: '#2563eb', icon: <FileTextOutlined /> },
      { label: 'PPAP Pending',     value: 1, unit: 'parts',    color: '#d97706', icon: <ClockCircleOutlined /> },
      { label: 'Drawings Updated', value: 8, unit: 'this week',color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'FMEA Actions Due', value: 2, unit: 'open',     color: '#dc2626', icon: <WarningOutlined /> },
    ],
  },
  iqc_inspector: {
    title: 'IQC Inspector Dashboard',
    subtitle: 'Dept 11 · Incoming Quality Control',
    icon: <SafetyOutlined />,
    color: '#16a34a',
    stats: [
      { label: 'Pending Inspections', value: 4, unit: 'lots',        color: '#d97706', icon: <ClockCircleOutlined /> },
      { label: 'Cleared Today',        value: 6, unit: 'lots',        color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Rejected Today',       value: 1, unit: 'lot',         color: '#dc2626', icon: <WarningOutlined /> },
      { label: 'Instruments Due',      value: 2, unit: 'calibration', color: '#7c3aed', icon: <ToolOutlined /> },
    ],
  },
  lqc_inspector: {
    title: 'LQC Inspector Dashboard',
    subtitle: 'Dept 11 · Line Quality Control',
    icon: <SafetyOutlined />,
    color: '#16a34a',
    stats: [
      { label: 'FPI Pending',      value: 2,  unit: 'WOs',        color: '#d97706', icon: <ClockCircleOutlined /> },
      { label: 'Hourly Checks',    value: 18, unit: 'done today',  color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Tool Wear Alerts', value: 1,  unit: 'machines',   color: '#dc2626', icon: <WarningOutlined /> },
      { label: 'Rejections',       value: 3,  unit: 'pieces today',color: '#d97706', icon: <WarningOutlined /> },
    ],
  },
  pqc_inspector: {
    title: 'PQC Inspector Dashboard',
    subtitle: 'Dept 11 · Pre-Dispatch Quality',
    icon: <SafetyOutlined />,
    color: '#16a34a',
    stats: [
      { label: 'Pending Final Inspection', value: 3, unit: 'batches', color: '#d97706', icon: <ClockCircleOutlined /> },
      { label: 'Cleared for Packing',      value: 5, unit: 'batches', color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Packing Spec Fails',       value: 0, unit: 'today',   color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'OQC Queue',                value: 4, unit: 'waiting', color: '#7c3aed', icon: <ClockCircleOutlined /> },
    ],
  },
  oqc_inspector: {
    title: 'OQC Inspector Dashboard',
    subtitle: 'Dept 11 · Outgoing Quality Control',
    icon: <SafetyOutlined />,
    color: '#16a34a',
    stats: [
      { label: 'Pending OQC',         value: 4, unit: 'lots',  color: '#d97706', icon: <ClockCircleOutlined /> },
      { label: 'Released Today',       value: 6, unit: 'lots',  color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Test Certs Generated', value: 6, unit: 'today', color: '#2563eb', icon: <FileTextOutlined /> },
      { label: 'COC Issued',           value: 6, unit: 'today', color: '#7c3aed', icon: <FileTextOutlined /> },
    ],
  },
  procurement_manager: {
    title: 'Procurement Dashboard',
    subtitle: 'Dept 12 · Supply Chain',
    icon: <ShoppingCartOutlined />,
    color: '#b45309',
    stats: [
      { label: 'Open POs',           value: 8, unit: 'orders',   color: '#2563eb', icon: <FileTextOutlined /> },
      { label: 'Overdue Deliveries', value: 2, unit: 'suppliers', color: '#dc2626', icon: <WarningOutlined /> },
      { label: 'Low Stock Alerts',   value: 3, unit: 'items',    color: '#d97706', icon: <WarningOutlined /> },
      { label: 'SCARs Open',         value: 1, unit: 'action',   color: '#7c3aed', icon: <FileTextOutlined /> },
    ],
  },
  store_manager: {
    title: 'Store / Warehouse Dashboard',
    subtitle: 'Dept 13 · Inventory Management',
    icon: <DatabaseOutlined />,
    color: '#7c3aed',
    stats: [
      { label: 'GRN Pending',   value: 3,   unit: 'deliveries', color: '#d97706', icon: <ClockCircleOutlined /> },
      { label: 'Stock Alerts',  value: 2,   unit: 'reorder',    color: '#dc2626', icon: <WarningOutlined /> },
      { label: 'Issued to WOs', value: 12,  unit: 'today',      color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Total SKUs',    value: 340, unit: 'active',     color: '#2563eb', icon: <DatabaseOutlined /> },
    ],
  },
  production_planner: {
    title: 'Production Planner Dashboard',
    subtitle: 'Dept 14 · Work Order Management',
    icon: <ToolOutlined />,
    color: '#dc2626',
    stats: [
      { label: 'Active Work Orders', value: 8, unit: 'WOs',   color: '#2563eb', icon: <FileTextOutlined /> },
      { label: 'On Schedule',        value: 6, unit: 'WOs',   color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Delayed',            value: 2, unit: 'WOs',   color: '#dc2626', icon: <WarningOutlined /> },
      { label: 'Material Shortage',  value: 1, unit: 'alert', color: '#d97706', icon: <WarningOutlined /> },
    ],
  },
  production_supervisor: {
    title: 'Production Supervisor',
    subtitle: 'Dept 14 · Floor Supervision',
    icon: <ToolOutlined />,
    color: '#dc2626',
    stats: [
      { label: 'Active Job Cards', value: 5, unit: 'running', color: '#2563eb', icon: <ToolOutlined /> },
      { label: 'Completed Today',  value: 9, unit: 'jobs',    color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Scrap Today',      value: 2, unit: 'pieces',  color: '#dc2626', icon: <WarningOutlined /> },
      { label: 'FPI Waiting',      value: 1, unit: 'batch',   color: '#d97706', icon: <ClockCircleOutlined /> },
    ],
  },
  operator: {
    title: 'Operator Dashboard',
    subtitle: 'Dept 14 · My Job Cards',
    icon: <ToolOutlined />,
    color: '#dc2626',
    stats: [
      { label: 'My Active Jobs',  value: 2, unit: 'in progress', color: '#2563eb', icon: <ToolOutlined /> },
      { label: 'Completed Today', value: 4, unit: 'jobs',        color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'Drawing Loaded',  value: 1, unit: 'current WO',  color: '#7c3aed', icon: <FileTextOutlined /> },
      { label: 'Scrap Raised',    value: 0, unit: 'today',       color: '#16a34a', icon: <CheckCircleOutlined /> },
    ],
  },
  dispatch_manager: {
    title: 'Dispatch Manager Dashboard',
    subtitle: 'Dept 15 · Logistics & Dispatch',
    icon: <CarOutlined />,
    color: '#0d9488',
    stats: [
      { label: 'Pending Shipments', value: 3,     unit: 'orders',  color: '#d97706', icon: <ClockCircleOutlined /> },
      { label: 'Dispatched Today',  value: 5,     unit: 'orders',  color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'OTD This Month',    value: '94.8', unit: '%',      color: '#2563eb', icon: <FileTextOutlined /> },
      { label: 'POD Pending',       value: 2,     unit: 'confirm', color: '#7c3aed', icon: <WarningOutlined /> },
    ],
  },
  accounts_manager: {
    title: 'Accounts Dashboard',
    subtitle: 'Dept 16 · Finance & Tally',
    icon: <DollarOutlined />,
    color: '#1d4ed8',
    stats: [
      { label: 'Tally Sync',      value: 'Live',  unit: '',         color: '#16a34a', icon: <CheckCircleOutlined /> },
      { label: 'COPQ This Month', value: '₹1.2L', unit: '',         color: '#dc2626', icon: <DollarOutlined /> },
      { label: 'GRN Pending',     value: 4,       unit: 'entries',  color: '#d97706', icon: <FileTextOutlined /> },
      { label: 'Debit Notes',     value: 2,       unit: 'this week',color: '#7c3aed', icon: <FileTextOutlined /> },
    ],
  },
  hr_admin: {
    title: 'HR Admin Dashboard',
    subtitle: 'Dept 17 · HR & Administration',
    icon: <TeamOutlined />,
    color: '#92400e',
    stats: [
      { label: 'Total Employees', value: 48, unit: 'active',     color: '#16a34a', icon: <TeamOutlined /> },
      { label: 'Training Due',    value: 5,  unit: 'employees',  color: '#d97706', icon: <ClockCircleOutlined /> },
      { label: 'Competency Gaps', value: 3,  unit: 'identified', color: '#dc2626', icon: <WarningOutlined /> },
      { label: 'Evaluations Due', value: 8,  unit: 'pending',    color: '#7c3aed', icon: <FileTextOutlined /> },
    ],
  },
};

const DEFAULT_CONFIG = {
  title: 'Dashboard',
  subtitle: 'Dynatech ONE',
  icon: <SettingOutlined />,
  color: '#1d4ed8',
  stats: [],
};

// ─── Component ────────────────────────────────────────────────────────────────
const RoleDashboard = ({ user }) => {
  const config = ROLE_CONFIG[user?.role?.name] || DEFAULT_CONFIG;

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
        icon={config.icon}
        title={config.title}
        subtitle={config.subtitle}
        tag={user?.department?.name}
        color={config.color}
      />

      {config.stats.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {config.stats.map((stat, i) => (
            <Col xs={24} sm={12} xl={6} key={i}>
              <StatCard {...stat} />
            </Col>
          ))}
        </Row>
      )}

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
