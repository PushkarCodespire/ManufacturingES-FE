import React, { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Avatar, Tag, Table, Badge, Tooltip,
  Typography, Space, Button, Select, Spin, Alert,
} from 'antd';
import {
  LoginOutlined,
  LogoutOutlined,
  LockOutlined,
  WarningOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
DownloadOutlined, } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auditApi } from '../../api/audit.api';
import AppLayout from '../../components/AppLayout';
import { exportTableToCsv } from '../../utils/exportCsv';

const { Title, Text } = Typography;
const { Option } = Select;

// ── Department accent colors ───────────────────────────────────────────────────
const DEPT_COLORS = {
  10: '#1d4ed8', 11: '#16a34a', 12: '#b45309', 13: '#7c3aed',
  14: '#dc2626', 15: '#0d9488', 16: '#1d4ed8', 17: '#92400e',
};

// ── Action config: icon, label, color ─────────────────────────────────────────
const ACTION_CONFIG = {
  LOGIN:           { icon: <LoginOutlined />,       label: 'Login',            color: '#16a34a', bg: '#f0fdf4' },
  LOGOUT:          { icon: <LogoutOutlined />,      label: 'Logout',           color: '#6b7280', bg: '#f9fafb' },
  PASSWORD_CHANGE: { icon: <KeyOutlined />,         label: 'Password Changed', color: '#2563eb', bg: '#eff6ff' },
  PASSWORD_RESET:  { icon: <KeyOutlined />,         label: 'Password Reset',   color: '#7c3aed', bg: '#f5f3ff' },
  FAILED_LOGIN:    { icon: <WarningOutlined />,     label: 'Failed Login',     color: '#dc2626', bg: '#fef2f2' },
  ACCOUNT_LOCKED:  { icon: <LockOutlined />,        label: 'Account Locked',   color: '#d97706', bg: '#fffbeb' },
};

const DEFAULT_ACTION = { icon: <ClockCircleOutlined />, label: 'Unknown', color: '#6b7280', bg: '#f9fafb' };

// ── Format timestamp ──────────────────────────────────────────────────────────
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
};

// ── Stat mini-card ────────────────────────────────────────────────────────────
const MiniStat = ({ label, value, color = '#1d4ed8', icon }) => (
  <Card
    style={{
      background: '#ffffff',
      border: '1px solid #e8eaed',
      borderRadius: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}
    bodyStyle={{ padding: '16px 20px' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          width: 42, height: 42, borderRadius: 10,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, fontSize: 18, flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <Text style={{ color: '#6b7280', fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>
          {label}
        </Text>
        <Text style={{ color, fontSize: 22, fontWeight: 700, display: 'block', lineHeight: 1.2 }}>
          {value ?? '—'}
        </Text>
      </div>
    </div>
  </Card>
);

// ── Profile info row ──────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }) => (
  <div
    style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid #f3f4f6',
    }}
  >
    <span style={{ color: '#9ca3af', fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
    <Text style={{ color: '#6b7280', fontSize: 13, width: 110, flexShrink: 0 }}>{label}</Text>
    <Text style={{ color: '#111827', fontSize: 13, fontWeight: 500 }}>{value || '—'}</Text>
  </div>
);

// ── Main ProfilePage ──────────────────────────────────────────────────────────
const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [logs,        setLogs]        = useState([]);
  const [summary,     setSummary]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [tableLoad,   setTableLoad]   = useState(false);
  const [error,       setError]       = useState('');
  const [pagination,  setPagination]  = useState({ current: 1, pageSize: 10, total: 0 });
  const [actionFilter, setActionFilter] = useState(undefined);

  const deptColor = DEPT_COLORS[user?.department?.code] || '#1d4ed8';
  const initials  = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  // ── Fetch summary ────────────────────────────────────────────────────────
  useEffect(() => {
    auditApi.getSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Fetch logs ───────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (page = 1, action = actionFilter) => {
    setTableLoad(true);
    setError('');
    try {
      const data = await auditApi.getMyLogs({
        page,
        limit: pagination.pageSize,
        ...(action ? { action } : {}),
      });
      setLogs(data.logs);
      setPagination((p) => ({ ...p, current: page, total: data.total }));
    } catch {
      setError('Failed to load audit log. Please try again.');
    } finally {
      setTableLoad(false);
    }
  }, [actionFilter, pagination.pageSize]);

  useEffect(() => { fetchLogs(1, actionFilter); }, [actionFilter]);

  // ── Table columns ────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Action',
      key: 'action',
      width: 220,
      render: (_, row) => {
        const cfg = ACTION_CONFIG[row.action] || DEFAULT_ACTION;
        return (
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: cfg.bg,
              border: `1px solid ${cfg.color}30`,
              borderRadius: 20,
              padding: '4px 12px',
            }}
          >
            <span style={{ color: cfg.color, fontSize: 14 }}>{cfg.icon}</span>
            <Text style={{ color: cfg.color, fontSize: 13, fontWeight: 500 }}>{cfg.label}</Text>
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) =>
        status === 'SUCCESS' ? (
          <Tag
            icon={<CheckCircleOutlined />}
            style={{ color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, fontWeight: 500 }}
          >
            Success
          </Tag>
        ) : (
          <Tag
            icon={<CloseCircleOutlined />}
            style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, fontWeight: 500 }}
          >
            Failed
          </Tag>
        ),
    },
    {
      title: 'Date',
      key: 'date',
      width: 130,
      render: (_, row) => {
        const dt = fmtDateTime(row.createdAt);
        return <Text style={{ color: '#374151', fontSize: 13 }}>{dt.date}</Text>;
      },
    },
    {
      title: 'Time',
      key: 'time',
      width: 110,
      render: (_, row) => {
        const dt = fmtDateTime(row.createdAt);
        return <Text style={{ color: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}>{dt.time}</Text>;
      },
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 150,
      render: (ip) => (
        <Text style={{ color: '#6b7280', fontSize: 13, fontFamily: 'monospace' }}>
          {ip || '—'}
        </Text>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'metadata',
      key: 'metadata',
      render: (meta) => {
        if (!meta) return <Text style={{ color: '#9ca3af', fontSize: 12 }}>—</Text>;
        const entries = Object.entries(meta);
        if (!entries.length) return null;
        return (
          <Tooltip
            title={
              <div>
                {entries.map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12 }}>
                    <strong>{k}:</strong> {String(v)}
                  </div>
                ))}
              </div>
            }
          >
            <Tag style={{ cursor: 'pointer', fontSize: 11, borderRadius: 4 }}>
              {entries.length} field{entries.length > 1 ? 's' : ''}
            </Tag>
          </Tooltip>
        );
      },
    },
  ];

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <Spin size="large" />
        </div>
      </AppLayout>
    );
  }

  const lastLoginDT = summary?.lastLogin ? fmtDateTime(summary.lastLogin.createdAt) : null;

  return (
    <AppLayout>
      {/* ── Page heading ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>My Profile</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Account details and activity audit trail</Text>
      </div>

      <Row gutter={[20, 20]}>
        {/* ── LEFT: Profile card ─────────────────────────────────────────── */}
        <Col xs={24} lg={8}>
          <Card
            style={{
              background: '#ffffff',
              border: '1px solid #e8eaed',
              borderRadius: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              textAlign: 'center',
            }}
            bodyStyle={{ padding: '32px 24px' }}
          >
            {/* Avatar */}
            <Avatar
              size={80}
              style={{
                background: deptColor,
                fontWeight: 700,
                fontSize: 28,
                marginBottom: 14,
                boxShadow: `0 4px 16px ${deptColor}40`,
              }}
            >
              {initials}
            </Avatar>

            <Title level={4} style={{ margin: '0 0 4px', color: '#111827', fontWeight: 700 }}>
              {user?.name}
            </Title>
            <Text style={{ color: '#6b7280', fontSize: 13 }}>{user?.employee_id}</Text>

            <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Tag
                style={{
                  background: `${deptColor}12`,
                  border: `1px solid ${deptColor}40`,
                  color: deptColor,
                  borderRadius: 20,
                  padding: '2px 12px',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                {user?.role?.label}
              </Tag>
              <Tag
                icon={<CheckCircleOutlined />}
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#16a34a',
                  borderRadius: 20,
                  padding: '2px 10px',
                  fontSize: 12,
                }}
              >
                Active
              </Tag>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #f3f4f6', margin: '16px 0' }} />

            {/* Info rows */}
            <div style={{ textAlign: 'left' }}>
              <InfoRow icon={<TeamOutlined />}    label="Department"  value={`${user?.department?.name} (Dept ${user?.department?.code})`} />
              <InfoRow icon={<MailOutlined />}    label="Email"       value={user?.email} />
              <InfoRow icon={<PhoneOutlined />}   label="Phone"       value={user?.phone} />
              <InfoRow icon={<IdcardOutlined />}  label="Employee ID" value={user?.employee_id} />
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                }}
              >
                <span style={{ color: '#9ca3af', fontSize: 16, width: 20, textAlign: 'center' }}>
                  <LockOutlined />
                </span>
                <Text style={{ color: '#6b7280', fontSize: 13, width: 110, flexShrink: 0 }}>First Login</Text>
                {user?.is_first_login ? (
                  <Tag style={{ color: '#d97706', background: '#fffbeb', border: '1px solid #fed7aa', borderRadius: 20, fontSize: 11 }}>Pending</Tag>
                ) : (
                  <Tag icon={<CheckCircleOutlined />} style={{ color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, fontSize: 11 }}>Completed</Tag>
                )}
              </div>
            </div>
          </Card>
        </Col>

        {/* ── RIGHT: Stats + Activity table ──────────────────────────────── */}
        <Col xs={24} lg={16}>
          {/* Summary stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={12} md={8}>
              <MiniStat
                label="Total Logins"
                value={summary?.totalLogins ?? '—'}
                color="#16a34a"
                icon={<LoginOutlined />}
              />
            </Col>
            <Col xs={12} md={8}>
              <MiniStat
                label="Failed Attempts"
                value={summary?.failedLogins ?? '—'}
                color="#dc2626"
                icon={<WarningOutlined />}
              />
            </Col>
            <Col xs={24} md={8}>
              <MiniStat
                label="Last Login"
                value={lastLoginDT ? lastLoginDT.date : '—'}
                color="#1d4ed8"
                icon={<ClockCircleOutlined />}
              />
            </Col>
          </Row>

          {/* Audit log table */}
          <Card
            style={{
              background: '#ffffff',
              border: '1px solid #e8eaed',
              borderRadius: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
            bodyStyle={{ padding: 0 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <Text style={{ color: '#111827', fontWeight: 600, fontSize: 15 }}>
                    Activity Audit Log
                  </Text>
                  <Text style={{ color: '#6b7280', fontSize: 12, display: 'block' }}>
                    All security events for your account
                  </Text>
                </div>
                <Space>
                  <Select
                    placeholder="Filter by action"
                    allowClear
                    style={{ width: 180 }}
                    size="small"
                    value={actionFilter}
                    onChange={(v) => setActionFilter(v)}
                  >
                    {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                      <Option key={key} value={key}>{cfg.label}</Option>
                    ))}
                  </Select>
                  <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('profile.csv', logs, columns)}>Export CSV</Button>
        <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => fetchLogs(1, actionFilter)}
                    loading={tableLoad}
                  >
                    Refresh
                  </Button>
                </Space>
              </div>
            }
            headStyle={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6', padding: '12px 20px' }}
          >
            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                closable
                onClose={() => setError('')}
                style={{ margin: '16px 20px 0', borderRadius: 6 }}
              />
            )}
            <Table
              dataSource={logs}
              columns={columns}
              rowKey="id"
              loading={tableLoad}
              scroll={{ x: 700 }}
              size="middle"
              pagination={{
                current:   pagination.current,
                pageSize:  pagination.pageSize,
                total:     pagination.total,
                showSizeChanger: false,
                showTotal: (total, range) => (
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>
                    {range[0]}–{range[1]} of {total} events
                  </Text>
                ),
                onChange: (page) => fetchLogs(page, actionFilter),
              }}
              rowClassName={(row) =>
                row.status === 'FAILED' ? 'audit-row-failed' : ''
              }
              style={{ borderRadius: '0 0 12px 12px', overflow: 'hidden' }}
            />
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
};

export default ProfilePage;
