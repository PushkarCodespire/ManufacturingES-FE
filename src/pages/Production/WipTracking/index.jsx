import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Row, Col, Tag, Typography, Button, Space, Table, Tabs,
  Progress, Tooltip, Spin, message, Empty, Select, Timeline, Badge,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, TableOutlined, AppstoreOutlined,
  ClockCircleOutlined, UserOutlined, LoginOutlined, LogoutOutlined,
  EnvironmentOutlined, SwapOutlined,
DownloadOutlined, } from '@ant-design/icons';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import api from '../../../api/axios';
import { wipApi, workOrderApi } from '../../../api/production.api';
import { workCenterApi } from '../../../api/workCenter.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const REFRESH_SECS = 30;

function oeeColor(v) {
  if (v >= 85) return '#16a34a';
  if (v >= 65) return '#ca8a04';
  return '#dc2626';
}

function fmtElapsed(minutes) {
  if (minutes == null) return '-';
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function queueColor(min) {
  if (min == null) return '#e8eaed';
  if (min < 30) return '#16a34a';
  if (min < 60) return '#ca8a04';
  return '#dc2626';
}

function progressColor(pct) {
  if (pct >= 80) return '#16a34a';
  if (pct >= 50) return '#ca8a04';
  return '#dc2626';
}

// ── WIP Board Tab (Kanban) ───────────────────────────────────────────────────
function WipBoardTab() {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wipApi.getBoard();
      setBoard(res?.data ?? res);
    } catch { message.error('Failed to load WIP board'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_SECS * 1000);
    return () => clearInterval(t);
  }, [load]);

  const columns = board?.columns || [];
  const unassigned = board?.unassigned || [];
  const totalActive = board?.total_active || 0;
  const totalInWc = columns.reduce((s, c) => s + c.wos.length, 0);

  const WoCard = ({ wo }) => {
    const borderColor = queueColor(wo.queue_minutes);
    const pct = wo.planned_qty > 0 ? Math.round((wo.produced_qty / wo.planned_qty) * 100) : 0;
    return (
      <Card size="small" style={{ borderLeft: `4px solid ${borderColor}`, borderRadius: 8, marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 13 }}>{wo.wo_no}</Text>
          {wo.queue_minutes != null && (
            <Tag color={wo.queue_minutes < 30 ? 'green' : wo.queue_minutes < 60 ? 'gold' : 'red'} style={{ margin: 0, fontSize: 11 }}>
              <ClockCircleOutlined style={{ marginRight: 3 }} />{fmtElapsed(wo.queue_minutes)}
            </Tag>
          )}
        </div>
        <Text style={{ fontSize: 12, display: 'block', marginTop: 2 }} ellipsis>
          {wo.item_code} — <Text type="secondary" style={{ fontSize: 11 }}>{wo.item_name}</Text>
        </Text>
        {wo.planned_qty > 0 && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <Text style={{ fontSize: 11 }}>Progress</Text>
              <Text style={{ fontSize: 11 }}>{wo.produced_qty}/{wo.planned_qty}</Text>
            </div>
            <Progress percent={pct} size="small" strokeColor={progressColor(pct)} style={{ margin: 0 }} format={(p) => `${p}%`} />
          </div>
        )}
        {wo.performer && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <UserOutlined style={{ fontSize: 10, color: '#9ca3af' }} />
            <Text type="secondary" style={{ fontSize: 11 }}>{wo.performer}</Text>
          </div>
        )}
      </Card>
    );
  };

  const ColumnCard = ({ title, type, count, children }) => (
    <Card
      size="small"
      style={{ borderRadius: 10, border: '1px solid #e8eaed', minHeight: 200, background: '#fafbfc' }}
      headStyle={{ padding: '8px 12px', minHeight: 36, background: '#f4f6f9', borderRadius: '10px 10px 0 0' }}
      bodyStyle={{ padding: '8px 10px', maxHeight: 500, overflowY: 'auto' }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 13 }}>{title}</Text>
          <Badge count={count} style={{ backgroundColor: count > 0 ? '#1d4ed8' : '#d1d5db' }} />
        </div>
      }
    >
      {children}
    </Card>
  );

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tag color="blue">Total Active: {totalActive}</Tag>
        <Tag color="green">At Work Centers: {totalInWc}</Tag>
        <Tag color="default">Unassigned: {unassigned.length}</Tag>
        <div style={{ flex: 1 }} />
        <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('wip-tracking.csv', live, tableColumns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      <Spin spinning={loading && !board}>
        {columns.length === 0 && unassigned.length === 0 ? (
          <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: 40 }}>
            <Empty description="No active work orders" />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {/* Unassigned column */}
            <Col xs={24} sm={12} md={8} lg={6}>
              <ColumnCard title="Unassigned" count={unassigned.length}>
                {unassigned.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', padding: 16 }}>
                    All WOs assigned
                  </Text>
                ) : (
                  unassigned.map((wo) => <WoCard key={wo.id} wo={wo} />)
                )}
              </ColumnCard>
            </Col>

            {/* Work center columns */}
            {columns.map((col) => (
              <Col key={col.work_center_id} xs={24} sm={12} md={8} lg={6}>
                <ColumnCard title={col.work_center_name} type={col.work_center_type} count={col.wos.length}>
                  {col.wos.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', padding: 16 }}>
                      No WOs here
                    </Text>
                  ) : (
                    col.wos.map((wo) => <WoCard key={wo.id} wo={wo} />)
                  )}
                </ColumnCard>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </>
  );
}

// ── Check In/Out Tab ─────────────────────────────────────────────────────────
function CheckInOutTab() {
  const [workOrders, setWorkOrders]     = useState([]);
  const [workCenters, setWorkCenters]   = useState([]);
  const [selectedWo, setSelectedWo]     = useState(null);
  const [selectedWc, setSelectedWc]     = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [history, setHistory]           = useState([]);
  const [histLoading, setHistLoading]   = useState(false);

  useEffect(() => {
    Promise.all([
      workOrderApi.getAll({ status: 'released' }).catch(() => []),
      workOrderApi.getAll({ status: 'in_progress' }).catch(() => []),
    ]).then(([r1, r2]) => {
      const a1 = r1?.data ?? (Array.isArray(r1) ? r1 : []);
      const a2 = r2?.data ?? (Array.isArray(r2) ? r2 : []);
      setWorkOrders([...a1, ...a2]);
    });
    workCenterApi.getAll().then((res) => {
      const arr = res?.data ?? (Array.isArray(res) ? res : []);
      setWorkCenters(arr.filter((wc) => wc.is_active !== false));
    }).catch(() => {});
  }, []);

  const loadHistory = useCallback(async (woId) => {
    if (!woId) { setHistory([]); return; }
    setHistLoading(true);
    try {
      const res = await wipApi.getHistory(woId);
      setHistory(res?.data ?? res ?? []);
    } catch { setHistory([]); }
    finally { setHistLoading(false); }
  }, []);

  useEffect(() => { loadHistory(selectedWo); }, [selectedWo, loadHistory]);

  const handleAction = async (action) => {
    if (!selectedWo || !selectedWc) { message.warning('Select both Work Order and Work Center'); return; }
    setSubmitting(true);
    try {
      const fn = action === 'check_in' ? wipApi.checkIn : wipApi.checkOut;
      const res = await fn({ work_order_id: selectedWo, work_center_id: selectedWc });
      message.success(res?.message || `${action === 'check_in' ? 'Checked in' : 'Checked out'} successfully`);
      loadHistory(selectedWo);
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'Action failed');
    } finally { setSubmitting(false); }
  };

  return (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '20px 24px' }}>
          <Text style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 16 }}>
            <SwapOutlined style={{ marginRight: 8 }} />Check In / Check Out
          </Text>

          <div style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Work Order</Text>
            <Select
              showSearch placeholder="Select work order..." optionFilterProp="label"
              value={selectedWo} onChange={setSelectedWo}
              options={workOrders.map((w) => ({ value: w.id, label: `${w.wo_no}${w.Item ? ' — ' + w.Item.name : ''}` }))}
              style={{ width: '100%' }} size="large" allowClear
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Work Center</Text>
            <Select
              showSearch placeholder="Select work center..." optionFilterProp="label"
              value={selectedWc} onChange={setSelectedWc}
              options={workCenters.map((wc) => ({ value: wc.id, label: `${wc.code} — ${wc.name}` }))}
              style={{ width: '100%' }} size="large" allowClear
            />
          </div>

          <Space size={12}>
            <Button type="primary" size="large" icon={<LoginOutlined />}
              onClick={() => handleAction('check_in')} loading={submitting}
              disabled={!selectedWo || !selectedWc}>
              Check In
            </Button>
            <Button size="large" icon={<LogoutOutlined />}
              onClick={() => handleAction('check_out')} loading={submitting}
              disabled={!selectedWo || !selectedWc}>
              Check Out
            </Button>
          </Space>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '20px 24px' }}>
          <Text style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 16 }}>
            <ClockCircleOutlined style={{ marginRight: 8 }} />Movement History
          </Text>

          {!selectedWo ? (
            <Text type="secondary" style={{ fontSize: 12 }}>Select a work order to see history</Text>
          ) : histLoading ? (
            <Spin size="small" />
          ) : history.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>No movements recorded yet</Text>
          ) : (
            <Timeline
              items={history.map((m) => ({
                color: m.action === 'check_in' ? 'green' : 'blue',
                children: (
                  <div>
                    <Tag color={m.action === 'check_in' ? 'green' : 'blue'} style={{ fontSize: 11 }}>
                      {m.action === 'check_in' ? 'IN' : 'OUT'}
                    </Tag>
                    <Text strong style={{ fontSize: 12 }}>{m.WorkCenter?.name || '-'}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(m.createdAt).toLocaleString()} {m.Performer ? `by ${m.Performer.name}` : ''}
                    </Text>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      </Col>
    </Row>
  );
}

// ── Live View Tab (existing functionality) ───────────────────────────────────
function LiveViewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('cards');
  const [countdown, setCountdown] = useState(REFRESH_SECS);
  const timerRef = useRef(null);
  const countRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setCountdown(REFRESH_SECS);
    try {
      const res = await api.get('/oee/live');
      setData(res.data);
    } catch { message.error('Failed to load live data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, REFRESH_SECS * 1000);
    countRef.current = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : REFRESH_SECS)), 1000);
    return () => { clearInterval(timerRef.current); clearInterval(countRef.current); };
  }, [load]);

  const live = data?.live || [];
  const produced = live.reduce((s, c) => s + (c.qty_produced || 0), 0);
  const rejected = live.reduce((s, c) => s + (c.qty_rejected || 0), 0);
  const avgOee = live.length > 0 ? (live.reduce((s, c) => s + c.oee, 0) / live.length).toFixed(1) : '-';

  const MachineCard = ({ card }) => (
    <Card size="small" style={{ borderRadius: 10, border: '1px solid #e8eaed', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
      headStyle={{ padding: '8px 12px', minHeight: 38 }}
      bodyStyle={{ padding: '10px 12px' }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 13 }}>{card.machine_name}</Text>
          <Tag color="processing" style={{ margin: 0, fontSize: 11 }}>
            <ClockCircleOutlined style={{ marginRight: 3 }} />{fmtElapsed(card.elapsed_min)}
          </Tag>
        </div>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 12 }}>{card.job_no}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{card.wo_no}</Text>
      </div>
      <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }} ellipsis>
        <Text style={{ fontWeight: 600, fontSize: 12 }}>{card.item_code}</Text>
        {' — '}<Text type="secondary" style={{ fontSize: 11 }}>{card.item_name}</Text>
      </Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <UserOutlined style={{ fontSize: 11, color: '#9ca3af' }} />
        <Text type="secondary" style={{ fontSize: 11 }}>{card.operator_name}</Text>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ fontSize: 11 }}>Produced</Text>
          <Text style={{ fontSize: 11, fontWeight: 600 }}>{card.qty_produced} / {card.planned_qty > 0 ? card.planned_qty : '-'} pcs</Text>
        </div>
        <Progress percent={card.progress_pct} size="small" strokeColor={progressColor(card.progress_pct)} format={(p) => `${p}%`} style={{ margin: 0 }} />
      </div>
      <div style={{ background: '#f8fafc', borderRadius: 6, padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Text style={{ fontSize: 10, color: '#9ca3af', display: 'block' }}>OEE</Text>
          <Text style={{ fontSize: 20, fontWeight: 700, color: oeeColor(card.oee), lineHeight: 1.2 }}>{card.oee}%</Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          {[['A', card.availability], ['P', card.performance], ['Q', card.quality]].map(([k, v]) => (
            <div key={k} style={{ fontSize: 11 }}>
              <Text type="secondary">{k}: </Text>
              <Text style={{ color: oeeColor(v), fontWeight: 600 }}>{v}%</Text>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );

  const tableColumns = [
    { title: 'Machine', dataIndex: 'machine_name', width: 140 },
    { title: 'Operator', dataIndex: 'operator_name', width: 130 },
    { title: 'Job No', dataIndex: 'job_no', width: 130, render: (v) => <Text style={{ color: '#1d4ed8', fontWeight: 600 }}>{v}</Text> },
    { title: 'WO No', dataIndex: 'wo_no', width: 130 },
    { title: 'Item', key: 'item', width: 180, render: (_, r) => <><Text strong>{r.item_code}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.item_name}</Text></> },
    { title: 'Produced', dataIndex: 'qty_produced', width: 90, align: 'right' },
    { title: 'Target', dataIndex: 'planned_qty', width: 80, align: 'right' },
    { title: 'Progress', dataIndex: 'progress_pct', width: 90, align: 'center', render: (v) => <Tag color={v >= 80 ? 'green' : v >= 50 ? 'gold' : 'red'}>{v}%</Tag> },
    { title: 'Elapsed', dataIndex: 'elapsed_min', width: 90, render: (v) => fmtElapsed(v) },
    { title: 'OEE %', dataIndex: 'oee', width: 80, align: 'right', render: (v) => <Text style={{ color: oeeColor(v), fontWeight: 700 }}>{v}%</Text> },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tag color="blue">Active: {live.length}</Tag>
        <Tag color="green">Produced: {produced}</Tag>
        {rejected > 0 && <Tag color="red">Rejected: {rejected}</Tag>}
        <Tag color={avgOee !== '-' && parseFloat(avgOee) >= 65 ? 'green' : 'orange'}>Avg OEE: {avgOee}{avgOee !== '-' ? '%' : ''}</Tag>
        <div style={{ flex: 1 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>Auto-refresh in {countdown}s</Text>
        <Button.Group>
          <Button icon={<AppstoreOutlined />} type={viewMode === 'cards' ? 'primary' : 'default'} onClick={() => setViewMode('cards')}>Cards</Button>
          <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
        </Button.Group>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      <Spin spinning={loading && !data}>
        {viewMode === 'cards' ? (
          live.length === 0 ? (
            <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: 40 }}>
              <Empty description={<><Text type="secondary">No active job cards right now</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>All machines are idle</Text></>} />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {live.map((card) => (
                <Col key={card.job_card_id} xs={24} sm={12} md={8} lg={6}>
                  <MachineCard card={card} />
                </Col>
              ))}
            </Row>
          )
        ) : (
          <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
            <Table rowKey="job_card_id" columns={tableColumns} dataSource={live} size="small" scroll={{ x: 1200 }} pagination={false} locale={{ emptyText: 'No active job cards' }} />
          </Card>
        )}
      </Spin>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function WipTrackingPage() {
  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>WIP Tracking</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>WIP Tracking</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Track work orders across work centers. Check in/out WOs and monitor queue times in real time.
      </Text>

      <div style={{ marginTop: 16 }}>
        <Tabs
          defaultActiveKey="board"
          items={[
            {
              key: 'board',
              label: <span><EnvironmentOutlined style={{ marginRight: 6 }} />WIP Board</span>,
              children: <WipBoardTab />,
            },
            {
              key: 'checkinout',
              label: <span><SwapOutlined style={{ marginRight: 6 }} />Check In / Out</span>,
              children: <CheckInOutTab />,
            },
            {
              key: 'live',
              label: <span><AppstoreOutlined style={{ marginRight: 6 }} />Live View</span>,
              children: <LiveViewTab />,
            },
          ]}
        />
      </div>
    </AppLayout>
  );
}
