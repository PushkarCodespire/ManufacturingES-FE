import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Typography, Card, Row, Col, Tag, Button, Table, message, Statistic, Badge, Space, Select, Modal } from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  RightOutlined,
  ReloadOutlined,
  ApiOutlined,
  CodeOutlined,
  RetweetOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import { tallySyncApi } from '../../../api/accounts.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const SYNC_TYPES = [
  { key: 'supplier_po',   label: 'Supplier PO',        icon: '\uD83D\uDCE6', desc: 'Purchase Orders synced to Tally',      color: '#1d4ed8', direction: 'push' },
  { key: 'grn',           label: 'GRN',                 icon: '\uD83D\uDCE5', desc: 'Goods Receipt Notes synced to Tally',  color: '#16a34a', direction: 'push' },
  { key: 'sales_invoice', label: 'Sales Invoice',       icon: '\uD83E\uDDFE', desc: 'Customer invoices synced to Tally',    color: '#d97706', direction: 'push' },
  { key: 'debit_credit',  label: 'Debit/Credit Notes',  icon: '\uD83D\uDCC4', desc: 'Debit & Credit notes synced to Tally', color: '#7c3aed', direction: 'push' },
  { key: 'payment',       label: 'Payment Status',      icon: '\uD83D\uDCB0', desc: 'Payment status synced from Tally',     color: '#dc2626', direction: 'pull' },
];

const AUTO_REFRESH_MS = 30_000;

const TallySyncPage = () => {
  /* ── state ─────────────────────────────────────────────── */
  const [dashboard, setDashboard]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState({});

  // logs
  const [logs, setLogs]             = useState([]);
  const [logTotal, setLogTotal]     = useState(0);
  const [logPage, setLogPage]       = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [logFilter, setLogFilter]   = useState(undefined);
  const [logsLoading, setLogsLoading] = useState(false);

  // test connection
  const [testing, setTesting]       = useState(false);

  // preview XML modal
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [previewXml, setPreviewXml]     = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // retry
  const [retrying, setRetrying]     = useState(false);

  const timerRef = useRef(null);

  /* ── fetch dashboard ───────────────────────────────────── */
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await tallySyncApi.getDashboard();
      setDashboard(res);
    } catch {
      // silent — auto-refresh will retry
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── fetch logs ────────────────────────────────────────── */
  const fetchLogs = useCallback(async (page = logPage, pageSize = logPageSize, syncType = logFilter) => {
    setLogsLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (syncType) params.sync_type = syncType;
      const res = await tallySyncApi.getLogs(params);
      setLogs(res.rows || []);
      setLogTotal(res.count || 0);
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, [logPage, logPageSize, logFilter]);

  /* ── mount + auto-refresh ──────────────────────────────── */
  useEffect(() => {
    fetchDashboard();
    fetchLogs(1, logPageSize, logFilter);

    timerRef.current = setInterval(() => {
      fetchDashboard();
    }, AUTO_REFRESH_MS);

    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── re-fetch logs when page/filter changes ────────────── */
  useEffect(() => {
    fetchLogs(logPage, logPageSize, logFilter);
  }, [logPage, logPageSize, logFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── sync trigger ──────────────────────────────────────── */
  const onSync = async (key) => {
    const label = SYNC_TYPES.find((t) => t.key === key)?.label;
    setSyncing((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await tallySyncApi.triggerSync(key);
      const count = res?.records_synced ?? 0;
      const failed = res?.records_failed ?? 0;
      if (count > 0) {
        message.success(`${label}: ${count} record${count > 1 ? 's' : ''} synced${failed > 0 ? `, ${failed} failed` : ''}`);
      } else if (failed > 0) {
        message.error(`${label}: ${failed} record(s) failed to sync`);
      } else {
        message.info(`${label}: No pending records to sync`);
      }
      await Promise.all([fetchDashboard(), fetchLogs(1, logPageSize, logFilter)]);
      setLogPage(1);
    } catch (err) {
      message.error(`${label} sync failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSyncing((prev) => ({ ...prev, [key]: false }));
    }
  };

  /* ── test connection ───────────────────────────────────── */
  const onTestConnection = async () => {
    setTesting(true);
    try {
      const res = await tallySyncApi.testConnection();
      if (res.success !== false) {
        const companies = res.companies || [];
        message.success(
          res.message || `Connected! ${companies.length > 0 ? `Companies: ${companies.join(', ')}` : ''}`,
          5,
        );
      } else {
        message.error(res.message || 'Connection failed');
      }
    } catch (err) {
      message.error(`Connection test failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  /* ── preview XML ───────────────────────────────────────── */
  const onPreviewXml = async (key) => {
    const label = SYNC_TYPES.find((t) => t.key === key)?.label;
    setPreviewLoading(true);
    setPreviewTitle(`XML Preview — ${label}`);
    setPreviewOpen(true);
    setPreviewXml('Loading...');
    try {
      const res = await tallySyncApi.previewXml(key);
      setPreviewXml(res.xml || '<!-- No XML generated -->');
    } catch (err) {
      setPreviewXml(`<!-- Error: ${err?.message || 'Failed to generate preview'} -->`);
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ── retry failed ──────────────────────────────────────── */
  const onRetryFailed = async () => {
    setRetrying(true);
    try {
      const res = await tallySyncApi.retryFailed();
      const count = res.total_reset ?? 0;
      if (count > 0) {
        message.success(`${count} error record(s) re-queued for sync`);
      } else {
        message.info('No error records to retry');
      }
      await Promise.all([fetchDashboard(), fetchLogs(1, logPageSize, logFilter)]);
      setLogPage(1);
    } catch (err) {
      message.error(`Retry failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setRetrying(false);
    }
  };

  /* ── helpers ───────────────────────────────────────────── */
  const getTypeData = (key) => dashboard?.types?.[key] || { synced: 0, pending: 0, errors: 0, lastSync: null };

  const tallyInfo = dashboard?.tally || {};

  const summaryTotals = () => {
    if (!dashboard?.types) return { synced: 0, pending: 0, error: 0 };
    return Object.values(dashboard.types).reduce(
      (acc, t) => ({ synced: acc.synced + (t.synced || 0), pending: acc.pending + (t.pending || 0), error: acc.error + (t.errors || t.error || 0) }),
      { synced: 0, pending: 0, error: 0 },
    );
  };

  const statusBadge = (info) => {
    if ((info.errors || info.error) > 0)   return <Badge status="error"   text="Has errors" />;
    if (info.pending > 0) return <Badge status="warning"  text="Pending" />;
    if (info.synced > 0)  return <Badge status="success"  text="Synced" />;
    return <Badge status="default" text="No records" />;
  };

  /* ── log table columns ─────────────────────────────────── */
  const logColumns = [
    {
      title: 'Type', dataIndex: 'sync_type', key: 'sync_type', width: 160,
      render: (t) => {
        const st = SYNC_TYPES.find((s) => s.key === t);
        return <Tag color={st?.color || 'default'}>{st?.label || t}</Tag>;
      },
    },
    {
      title: 'Direction', dataIndex: 'direction', key: 'direction', width: 100,
      render: (d) => d === 'push'
        ? <Tag color="blue">Push</Tag>
        : <Tag color="green">Pull</Tag>,
    },
    {
      title: 'Records', dataIndex: 'records_affected', key: 'records_affected', width: 90, align: 'center',
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (s) => {
        if (s === 'success')  return <Tag icon={<CheckCircleOutlined />} color="success">Success</Tag>;
        if (s === 'error')    return <Tag icon={<WarningOutlined />} color="error">Error</Tag>;
        return <Tag icon={<ClockCircleOutlined />} color="default">Pending</Tag>;
      },
    },
    {
      title: 'Synced By', dataIndex: 'SyncedBy', key: 'synced_by', width: 140,
      render: (u) => u?.name || '—',
    },
    {
      title: 'Time', dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (t) => t ? dayjs(t).format('DD MMM YYYY HH:mm') : '—',
    },
    {
      title: 'Error', dataIndex: 'error_message', key: 'error_message', ellipsis: true,
      render: (msg) => msg || '—',
    },
  ];

  /* ── totals ────────────────────────────────────────────── */
  const totals = summaryTotals();

  /* ── render ────────────────────────────────────────────── */
  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Accounts</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Tally Sync</Text>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Tally Sync Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Bi-directional sync with Tally ERP. Monitor sync status, trigger manual syncs, and view sync history.
          </Text>
        </div>
        <Space>
          <Button
            icon={<ApiOutlined />}
            onClick={onTestConnection}
            loading={testing}
            size="small"
          >
            Test Connection
          </Button>
          {totals.error > 0 && (
            <Button
              icon={<RetweetOutlined />}
              onClick={onRetryFailed}
              loading={retrying}
              size="small"
              danger
            >
              Retry Failed ({totals.error})
            </Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('tally-sync.csv', logs, logColumns)}>Export CSV</Button>
        <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => { setLoading(true); fetchDashboard(); fetchLogs(1, logPageSize, logFilter); }}
            size="small"
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Status tags */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Tag color="blue" icon={<SyncOutlined />}>Dynatech ONE &rarr; Tally: PO, GRN, Invoice, DN/CN</Tag>
        <Tag color="green" icon={<SyncOutlined />}>Tally &rarr; Dynatech ONE: Payment Status</Tag>
        {tallyInfo.mock_mode && <Tag color="orange">Mock Mode Active</Tag>}
        {tallyInfo.is_enabled ? (
          <Tag color="success">Tally: {tallyInfo.host}:{tallyInfo.port}</Tag>
        ) : (
          <Tag color="default">Tally: Not Enabled</Tag>
        )}
      </div>

      {/* Summary stats row */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #16a34a' }} styles={{ body: { padding: '12px 16px' } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Total Synced</Text>}
              value={totals.synced}
              valueStyle={{ fontSize: 22, fontWeight: 600, color: '#16a34a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #d97706' }} styles={{ body: { padding: '12px 16px' } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Total Pending</Text>}
              value={totals.pending}
              valueStyle={{ fontSize: 22, fontWeight: 600, color: '#d97706' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #dc2626' }} styles={{ body: { padding: '12px 16px' } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Total Errors</Text>}
              value={totals.error}
              valueStyle={{ fontSize: 22, fontWeight: 600, color: '#dc2626' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Sync type cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {SYNC_TYPES.map((st) => {
          const info = getTypeData(st.key);
          return (
            <Col xs={24} sm={12} lg={8} xl={Math.floor(24 / SYNC_TYPES.length)} key={st.key}>
              <Card
                style={{ borderRadius: 12, border: '1px solid #e8eaed', height: '100%' }}
                styles={{ body: { padding: 20 } }}
                loading={loading}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <Text style={{ fontSize: 20 }}>{st.icon}</Text>
                    <Title level={5} style={{ margin: '4px 0 2px' }}>{st.label}</Title>
                    <Text type="secondary" style={{ fontSize: 11 }}>{st.desc}</Text>
                  </div>
                  {statusBadge(info)}
                </div>
                <Row gutter={8} style={{ marginBottom: 12 }}>
                  <Col span={8}><Statistic title="Synced"  value={info.synced  || 0} valueStyle={{ fontSize: 18, color: '#16a34a' }} /></Col>
                  <Col span={8}><Statistic title="Pending" value={info.pending || 0} valueStyle={{ fontSize: 18, color: '#d97706' }} /></Col>
                  <Col span={8}><Statistic title="Errors"  value={info.errors  || 0} valueStyle={{ fontSize: 18, color: '#dc2626' }} /></Col>
                </Row>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {info.lastSync ? `Last: ${dayjs(info.lastSync).format('DD MMM HH:mm')}` : 'Never synced'}
                  </Text>
                  <Space size={4}>
                    <Button
                      size="small"
                      icon={<CodeOutlined />}
                      onClick={() => onPreviewXml(st.key)}
                      title="Preview XML"
                    />
                    <Button
                      size="small"
                      type={info.pending > 0 ? 'primary' : 'default'}
                      icon={<SyncOutlined spin={syncing[st.key]} />}
                      loading={syncing[st.key]}
                      onClick={() => onSync(st.key)}
                      disabled={loading}
                    >
                      Sync Now
                    </Button>
                  </Space>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Sync History */}
      <Card
        title="Sync History"
        style={{ borderRadius: 12, border: '1px solid #e8eaed' }}
        styles={{ body: { padding: '16px 20px' } }}
        extra={
          <Select
            allowClear
            placeholder="Filter by type"
            style={{ width: 180 }}
            value={logFilter}
            onChange={(v) => { setLogFilter(v); setLogPage(1); }}
            options={SYNC_TYPES.map((s) => ({ value: s.key, label: s.label }))}
            size="small"
          />
        }
      >
        <Table
          rowKey="id"
          columns={logColumns}
          dataSource={logs}
          size="small"
          loading={logsLoading}
          scroll={{ x: 800 }}
          locale={{ emptyText: 'No sync activity yet. Click "Sync Now" on a type above to start syncing.' }}
          pagination={{
            current: logPage,
            pageSize: logPageSize,
            total: logTotal,
            showSizeChanger: true,
            showTotal: (t) => `${t} records`,
            onChange: (p, ps) => { setLogPage(p); setLogPageSize(ps); },
          }}
        />
      </Card>

      {/* Preview XML Modal */}
      <Modal
        title={previewTitle}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={700}
      >
        <pre style={{
          background: '#1e293b',
          color: '#e2e8f0',
          padding: 16,
          borderRadius: 8,
          fontSize: 12,
          maxHeight: 500,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {previewLoading ? 'Loading...' : previewXml}
        </pre>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          This is the XML that will be sent to Tally when you click "Sync Now". In mock mode, no actual request is made.
        </Text>
      </Modal>
    </AppLayout>
  );
};

export default TallySyncPage;
