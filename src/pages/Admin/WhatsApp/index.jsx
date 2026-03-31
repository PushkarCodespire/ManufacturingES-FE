import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Table, Typography, Button, Tag, Input, Select,
  Row, Col, Badge, Form, Divider, message as antdMessage, Alert,
} from 'antd';
import {
  RightOutlined, SendOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
  WhatsAppOutlined, UserOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import { whatsappApi } from '../../../api/admin.api';
import { userApi } from '../../../api/user.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

// Notification types that auto-trigger WhatsApp
const CRITICAL_TYPES = [
  'BREAKDOWN', 'ACCOUNT_LOCKED', 'TALLY_SYNC_ERRORS',
  'MOLD_LIFE_CRITICAL', 'MOLD_LIFE_URGENT', 'MAINTENANCE_OVERDUE',
  'LOW_STOCK_CRITICAL',
];

const STATUS_COLOR = { sent: 'success', failed: 'error', skipped: 'default' };
const STATUS_ICON  = {
  sent:    <CheckCircleOutlined />,
  failed:  <CloseCircleOutlined />,
  skipped: <ExclamationCircleOutlined />,
};

export default function WhatsAppPage() {
  const [status,      setStatus]      = useState(null);
  const [statusLoad,  setStatusLoad]  = useState(true);
  const [logs,        setLogs]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [logsLoad,    setLogsLoad]    = useState(false);
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(20);
  const [statusFilt,  setStatusFilt]  = useState(undefined);
  const [sending,     setSending]     = useState(false);
  const [form]                        = Form.useForm();

  // Employee dropdown for test send
  const [empOptions,   setEmpOptions]   = useState([]);
  const [empSearching, setEmpSearching] = useState(false);
  const searchTimer                     = useRef(null);

  const loadStatus = useCallback(async () => {
    setStatusLoad(true);
    try {
      const res = await whatsappApi.getStatus();
      setStatus(res);
    } catch {
      antdMessage.error('Failed to load WhatsApp status');
    } finally {
      setStatusLoad(false);
    }
  }, []);

  const loadLogs = useCallback(async (p = page, ps = pageSize, sf = statusFilt) => {
    setLogsLoad(true);
    try {
      const params = { page: p, pageSize: ps };
      if (sf) params.status = sf;
      const res = await whatsappApi.getLogs(params);
      setLogs(res.rows ?? []);
      setTotal(res.total ?? 0);
    } catch {
      antdMessage.error('Failed to load logs');
    } finally {
      setLogsLoad(false);
    }
  }, [page, pageSize, statusFilt]);

  useEffect(() => { loadStatus(); loadLogs(); loadEmployees(); }, []); // eslint-disable-line

  // Load employees with phone numbers (initial + on search)
  const loadEmployees = useCallback(async (search = '') => {
    setEmpSearching(true);
    try {
      const params = { limit: 50, is_active: true };
      if (search) params.search = search;
      const res = await userApi.getAll(params);
      const list = Array.isArray(res) ? res : (res?.rows ?? res?.data ?? []);
      setEmpOptions(
        list
          .filter((u) => u.phone)
          .map((u) => ({
            value: u.phone,
            label: `${u.name} (${u.employee_id}) — ${u.phone}`,
            name:  u.name,
            phone: u.phone,
          })),
      );
    } catch {
      // silent
    } finally {
      setEmpSearching(false);
    }
  }, []);

  const handleEmpSearch = (val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadEmployees(val), 300);
  };

  const handleTestSend = async (values) => {
    setSending(true);
    try {
      const res = await whatsappApi.sendTest({ to: values.to, message: values.message });
      if (res.status === 'sent') {
        antdMessage.success(`Test message sent to ${values.to}`);
      } else if (res.status === 'skipped') {
        antdMessage.warning('WhatsApp not configured — message skipped. Set Twilio env variables on the server.');
      } else {
        antdMessage.error(res.message || 'Send failed');
      }
      form.resetFields(['message']);
      loadLogs(1, pageSize, statusFilt);
      setPage(1);
    } catch (e) {
      antdMessage.error(e?.message || 'Failed to send test message');
    } finally {
      setSending(false);
    }
  };

  const columns = [
    {
      title: 'Time', dataIndex: 'created_at', key: 'ts', width: 160,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{dayjs(v).format('DD MMM HH:mm:ss')}</Text>,
    },
    {
      title: 'To', dataIndex: 'to_number', key: 'to', width: 140,
      render: (v) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'User', key: 'user', width: 160,
      render: (_, r) => r.User
        ? <div><div style={{ fontWeight: 600, fontSize: 12 }}>{r.User.name}</div><Text type="secondary" style={{ fontSize: 11 }}>{r.User.employee_id}</Text></div>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type', width: 180,
      render: (v) => <Tag style={{ borderRadius: 20, fontSize: 11 }}>{v}</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (v) => (
        <Tag color={STATUS_COLOR[v]} icon={STATUS_ICON[v]} style={{ borderRadius: 20, fontSize: 11 }}>
          {v?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Message', dataIndex: 'message', key: 'msg', ellipsis: true,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{v?.slice(0, 80)}{v?.length > 80 ? '…' : ''}</Text>,
    },
    {
      title: 'Error', dataIndex: 'error_msg', key: 'err', ellipsis: true,
      render: (v) => v ? <Text type="danger" style={{ fontSize: 12 }}>{v.slice(0, 60)}</Text> : <Text type="secondary">—</Text>,
    },
  ];

  const configured = status?.configured;

  return (
    <AppLayout>
      <div style={{ padding: '0 0 24px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Admin</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>WhatsApp Notifications</Text>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <WhatsAppOutlined style={{ fontSize: 22, color: '#25d366' }} />
              <Title level={3} style={{ margin: 0 }}>WhatsApp Notifications</Title>
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Critical alerts sent via WhatsApp using Twilio. Configure credentials in server <code>.env</code> file.
            </Text>
          </div>
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('whats-app.csv', logs, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { loadStatus(); loadLogs(); }}>Refresh</Button>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {/* Connection Status */}
          <Col xs={24} lg={12}>
            <Card
              loading={statusLoad}
              style={{ border: '1px solid #e8eaed', borderRadius: 12, height: '100%' }}
              bodyStyle={{ padding: '16px 20px' }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge status={configured ? 'success' : 'error'} />
                  <Text style={{ fontWeight: 700, fontSize: 13 }}>Connection Status</Text>
                </div>
              }
            >
              {status && (
                <>
                  <Alert
                    type={configured ? 'success' : 'warning'}
                    message={configured ? 'Twilio credentials configured' : 'Twilio not configured'}
                    description={status.note}
                    showIcon
                    style={{ marginBottom: 16, borderRadius: 8 }}
                  />
                  {configured && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Tag color="blue">Account: {status.account_sid_hint}</Tag>
                      <Tag color="green">From: {status.from_number}</Tag>
                    </div>
                  )}
                  {status.stats_30d && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                      <div style={{ textAlign: 'center', padding: '8px 20px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{status.stats_30d.sent}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Sent (30d)</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '8px 20px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{status.stats_30d.failed}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Failed (30d)</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '8px 20px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#6b7280' }}>{status.stats_30d.skipped}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Skipped (30d)</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </Col>

          {/* Test Send + Critical Types */}
          <Col xs={24} lg={12}>
            <Card
              style={{ border: '1px solid #e8eaed', borderRadius: 12, height: '100%' }}
              bodyStyle={{ padding: '16px 20px' }}
              title={<Text style={{ fontWeight: 700, fontSize: 13 }}>Send Test Message</Text>}
            >
              <Form form={form} layout="vertical" onFinish={handleTestSend} size="small">
                <Form.Item
                  name="to"
                  label="Send To Employee"
                  rules={[{ required: true, message: 'Select an employee' }]}
                  style={{ marginBottom: 12 }}
                >
                  <Select
                    showSearch
                    placeholder="Search by name or employee ID…"
                    filterOption={false}
                    onSearch={handleEmpSearch}
                    loading={empSearching}
                    options={empOptions}
                    style={{ borderRadius: 8 }}
                    suffixIcon={<UserOutlined style={{ color: '#9ca3af' }} />}
                    notFoundContent={
                      empSearching ? 'Searching…' : 'No employees with phone numbers found'
                    }
                  />
                </Form.Item>
                <Form.Item name="message" label="Custom Message (optional)" style={{ marginBottom: 12 }}>
                  <Input.TextArea rows={2} placeholder="Leave blank for default test message" style={{ borderRadius: 8 }} />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={sending}
                  style={{ background: '#25d366', borderColor: '#25d366' }}
                >
                  Send Test
                </Button>
              </Form>

              <Divider style={{ margin: '16px 0 12px' }} />
              <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 8 }}>
                Auto-triggered for these critical notification types:
              </Text>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CRITICAL_TYPES.map((t) => (
                  <Tag key={t} style={{ borderRadius: 20, fontSize: 10, marginBottom: 4 }}>{t}</Tag>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Logs */}
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12 }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <Text style={{ fontWeight: 700, fontSize: 14 }}>Send Log</Text>
            <div style={{ flex: 1 }} />
            <Select
              placeholder="Filter by status"
              value={statusFilt}
              onChange={(v) => { setStatusFilt(v); setPage(1); loadLogs(1, pageSize, v); }}
              allowClear
              style={{ width: 160 }}
              options={[
                { value: 'sent',    label: 'Sent' },
                { value: 'failed',  label: 'Failed' },
                { value: 'skipped', label: 'Skipped' },
              ]}
            />
            <Tag style={{ borderRadius: 20, fontSize: 12 }}>{total.toLocaleString()} entries</Tag>
          </div>

          <Table
            dataSource={logs}
            columns={columns}
            rowKey="id"
            loading={logsLoad}
            size="small"
            scroll={{ x: 900 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ['20', '50', '100'],
              showTotal: (t) => `${t} records`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); loadLogs(p, ps, statusFilt); },
            }}
          />
        </Card>

        {/* Setup guide */}
        <Card
          style={{ border: '1px solid #fde68a', borderRadius: 12, background: '#fffbeb', marginTop: 16 }}
          bodyStyle={{ padding: '14px 18px' }}
        >
          <Text style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>Setup Instructions</Text>
          <div style={{ marginTop: 8, fontSize: 12, color: '#78350f', lineHeight: 1.7 }}>
            <div>1. Create a <strong>Twilio</strong> account at twilio.com and enable the WhatsApp Sandbox.</div>
            <div>2. Add these variables to your <code>api/.env</code> file:</div>
            <pre style={{ background: '#fef3c7', padding: '8px 12px', borderRadius: 6, margin: '8px 0', fontSize: 11 }}>
{`TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=+14155238886`}
            </pre>
            <div>3. Employees must have their <strong>WhatsApp phone number</strong> set in their profile (Masters → Employees → Phone).</div>
            <div>4. Critical alerts (breakdowns, account locks, mold life critical, etc.) are automatically forwarded via WhatsApp.</div>
            <div>5. Use the <strong>Send Test</strong> panel above to verify the connection is working.</div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
