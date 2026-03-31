import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Typography, Button, Select, Input, Tag,
  Tooltip, Row, Col, Statistic, Space, DatePicker, message,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, SafetyOutlined,
  LoginOutlined, LogoutOutlined, KeyOutlined,
  LockOutlined, ExclamationCircleOutlined, UserOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout  from '../../../components/AppLayout';
import { auditApi } from '../../../api/audit.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ── Action config ─────────────────────────────────────────────────────────────
const ACTION_CONFIG = {
  LOGIN:           { color: 'green',   icon: <LoginOutlined />,              label: 'Login'           },
  LOGOUT:          { color: 'default', icon: <LogoutOutlined />,             label: 'Logout'          },
  FAILED_LOGIN:    { color: 'red',     icon: <ExclamationCircleOutlined />,  label: 'Failed Login'    },
  PASSWORD_CHANGE: { color: 'blue',    icon: <KeyOutlined />,                label: 'Password Change' },
  PASSWORD_RESET:  { color: 'orange',  icon: <KeyOutlined />,                label: 'Password Reset'  },
  ACCOUNT_LOCKED:  { color: 'volcano', icon: <LockOutlined />,               label: 'Account Locked'  },
};

const ACTION_OPTIONS = Object.entries(ACTION_CONFIG).map(([val, cfg]) => ({
  value: val, label: cfg.label,
}));

const fmtDt = (iso) => {
  if (!iso) return '—';
  return dayjs(iso).format('DD MMM YYYY HH:mm:ss');
};

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, color }) {
  return (
    <Card
      size="small"
      style={{ borderTop: `3px solid ${color}`, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
        {label}
      </Text>
      <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuditLogPage() {
  const [logs,        setLogs]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(20);
  const [actionFilter, setActionFilter] = useState(undefined);
  const [empSearch,   setEmpSearch]   = useState('');
  const [empInput,    setEmpInput]    = useState('');

  // Summary stats derived from loaded data
  const loginCount    = logs.filter((l) => l.action === 'LOGIN').length;
  const failedCount   = logs.filter((l) => l.action === 'FAILED_LOGIN').length;
  const lockedCount   = logs.filter((l) => l.action === 'ACCOUNT_LOCKED').length;
  const uniqueUsers   = new Set(logs.map((l) => l.employee_id).filter(Boolean)).size;

  const load = useCallback(async (p = page, ps = pageSize, act = actionFilter, emp = empSearch) => {
    setLoading(true);
    try {
      const params = { page: p, limit: ps };
      if (act) params.action      = act;
      if (emp) params.employee_id = emp;

      const data = await auditApi.getAllLogs(params);
      setLogs(data?.logs       ?? []);
      setTotal(data?.total     ?? 0);
    } catch {
      message.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, empSearch]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = () => {
    setEmpSearch(empInput);
    setPage(1);
  };

  const handleReset = () => {
    setActionFilter(undefined);
    setEmpSearch('');
    setEmpInput('');
    setPage(1);
  };

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      key: 'ts',
      width: 170,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{fmtDt(v)}</Text>,
    },
    {
      title: 'Employee',
      key: 'user',
      width: 200,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {r.User?.name ?? '—'}
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.employee_id}
            {r.User?.Department?.name && ` · ${r.User.Department.name}`}
          </Text>
        </div>
      ),
    },
    {
      title: 'Role',
      key: 'role',
      width: 130,
      render: (_, r) => r.User?.Role?.label
        ? <Tag style={{ borderRadius: 20, fontSize: 11 }}>{r.User.Role.label}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 160,
      render: (v) => {
        const cfg = ACTION_CONFIG[v] || { color: 'default', icon: <UserOutlined />, label: v };
        return (
          <Tag color={cfg.color} icon={cfg.icon} style={{ borderRadius: 20 }}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v) => (
        <Tag color={v === 'SUCCESS' ? 'green' : 'red'} style={{ borderRadius: 20, fontSize: 11 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip',
      width: 130,
      render: (v) => <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>{v || '—'}</Text>,
    },
    {
      title: 'Details',
      dataIndex: 'metadata',
      key: 'meta',
      ellipsis: true,
      render: (v) => {
        if (!v) return <Text type="secondary">—</Text>;
        const txt = typeof v === 'string' ? v : JSON.stringify(v);
        return (
          <Tooltip title={txt}>
            <Text style={{ fontSize: 12, color: '#6b7280' }}>
              {txt.length > 60 ? `${txt.slice(0, 60)}…` : txt}
            </Text>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <div style={{ padding: '0 0 24px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Admin</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Audit Log</Text>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SafetyOutlined style={{ fontSize: 22, color: '#1d4ed8' }} />
              <Title level={3} style={{ margin: 0 }}>Audit Log</Title>
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Immutable record of all security-relevant user actions. IT Admin / Plant Head only.
            </Text>
          </div>
        </div>

        {/* Summary tiles */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}>
            <StatTile label="Total Events (this page)" value={logs.length}  color="#1d4ed8" />
          </Col>
          <Col xs={12} sm={6}>
            <StatTile label="Successful Logins"  value={loginCount}   color="#16a34a" />
          </Col>
          <Col xs={12} sm={6}>
            <StatTile label="Failed Attempts"    value={failedCount}  color="#dc2626" />
          </Col>
          <Col xs={12} sm={6}>
            <StatTile label="Locked Accounts"    value={lockedCount}  color="#d97706" />
          </Col>
        </Row>

        {/* Filters + Table */}
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <Input
              placeholder="Search by employee ID..."
              prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
              value={empInput}
              onChange={(e) => setEmpInput(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 220, borderRadius: 8 }}
              allowClear
              onClear={() => { setEmpInput(''); setEmpSearch(''); setPage(1); }}
            />
            <Select
              placeholder="Filter by action"
              value={actionFilter}
              onChange={(v) => { setActionFilter(v); setPage(1); }}
              allowClear
              options={ACTION_OPTIONS}
              style={{ width: 180 }}
            />
            <Button onClick={handleSearch} type="primary" ghost>
              Search
            </Button>
            <Button onClick={handleReset}>
              Reset
            </Button>
            <div style={{ flex: 1 }} />
            <Tag style={{ borderRadius: 20, fontSize: 12 }}>
              {total.toLocaleString()} total events
            </Tag>
            <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('audit-log.csv', logs, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={() => load()}>
              Refresh
            </Button>
          </div>

          <Table
            dataSource={logs}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 900 }}
            rowClassName={(r) => r.action === 'FAILED_LOGIN' || r.action === 'ACCOUNT_LOCKED' ? 'audit-row-alert' : ''}
            pagination={{
              current:    page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ['20', '50', '100'],
              showTotal:  (t) => `${t} events`,
              onChange:   (p, ps) => { setPage(p); setPageSize(ps); },
            }}
          />
        </Card>

        <style>{`
          .audit-row-alert td { background: #fff7f7 !important; }
          .audit-row-alert:hover td { background: #fef2f2 !important; }
        `}</style>
      </div>
    </AppLayout>
  );
}
