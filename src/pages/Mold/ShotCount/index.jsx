import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Card, Row, Col, Tag,
  Drawer, message, Progress, Tooltip, InputNumber, Radio, Modal, Spin,
} from 'antd';
import {
  ReloadOutlined, SearchOutlined, RightOutlined,
  ToolOutlined, DashboardOutlined, TableOutlined, AppstoreOutlined,
  SlidersOutlined, HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { moldShotCountApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

const LIFE_STAGE_COLOR = {
  normal: 'green', plan_replacement: 'gold', urgent_replacement: 'orange',
  critical: 'red', end_of_life: 'magenta', extended_life: 'purple',
};
const fmtLabel = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '\u2014';
const fmtDate = (iso) => iso ? dayjs(iso).format('DD MMM YYYY') : '\u2014';
const fmtDateTime = (iso) => iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '\u2014';

const getLifeColor = (pct) => pct < 70 ? '#52c41a' : pct < 85 ? '#faad14' : pct < 95 ? '#fa8c16' : '#f5222d';

const ShotCountDashboardPage = () => {
  const { can } = usePermissions();
  const canWrite = can('mold-shot_count-create_edit_delete');

  const [dashboard, setDashboard] = useState(null);
  const [moldList, setMoldList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [search, setSearch] = useState('');

  // Shot history drawer
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMold, setHistoryMold] = useState(null);
  const [shotHistory, setShotHistory] = useState([]);
  const [shotLoading, setShotLoading] = useState(false);
  const [shotPage, setShotPage] = useState(1);
  const [shotTotal, setShotTotal] = useState(0);

  // Adjust modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMoldId, setAdjustMoldId] = useState(null);
  const [adjustForm] = Form.useForm();
  const [adjusting, setAdjusting] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await moldShotCountApi.getDashboard(params);
      // API interceptor + .then(r=>r.data) fully unwraps: res IS the molds array directly
      const molds = Array.isArray(res) ? res : (res?.molds ?? res?.data ?? []);
      setDashboard(res);
      setMoldList(molds);
    } catch { message.error('Failed to load shot count dashboard'); }
    finally { setLoading(false); }
  }, [debouncedSearch]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Fetch shot history for a specific mold
  const openHistory = async (mold) => {
    setHistoryMold(mold);
    setHistoryOpen(true);
    setShotPage(1);
    setShotLoading(true);
    try {
      const res = await moldShotCountApi.getShotHistory(mold.id ?? mold.mold_id, { page: 1, pageSize: 20 });
      // backend: { success, data: { rows, total, ... } } → after unwrap: { rows, total, ... }
      setShotHistory(res?.rows ?? (Array.isArray(res) ? res : []));
      setShotTotal(res?.total ?? 0);
    } catch { message.error('Failed to load shot history'); }
    finally { setShotLoading(false); }
  };

  const fetchHistoryPage = async (p) => {
    setShotPage(p);
    setShotLoading(true);
    try {
      const mid = historyMold?.id ?? historyMold?.mold_id;
      const res = await moldShotCountApi.getShotHistory(mid, { page: p, pageSize: 20 });
      setShotHistory(res?.rows ?? (Array.isArray(res) ? res : []));
      setShotTotal(res?.total ?? 0);
    } catch { /* ignore */ }
    finally { setShotLoading(false); }
  };

  const handleAdjust = async () => {
    try {
      const values = await adjustForm.validateFields();
      setAdjusting(true);
      await moldShotCountApi.adjustShotCount(adjustMoldId, values);
      message.success('Shot count adjusted');
      setAdjustOpen(false); adjustForm.resetFields();
      fetchDashboard();
    } catch (err) { if (!err?.errorFields) message.error('Failed to adjust shot count'); }
    finally { setAdjusting(false); }
  };

  // Stats from dashboard
  const totalMolds = dashboard?.total_molds ?? moldList.length;
  const avgLifePct = dashboard?.avg_life_pct ?? (moldList.length > 0 ? Math.round(moldList.reduce((acc, m) => {
    const pct = (m.expected_life_shots ?? 1) > 0 ? ((m.current_shot_count ?? 0) / (m.expected_life_shots ?? 1)) * 100 : 0;
    return acc + pct;
  }, 0) / moldList.length) : 0);
  const moldsOver85 = dashboard?.molds_over_85 ?? moldList.filter((m) => {
    const pct = (m.expected_life_shots ?? 1) > 0 ? ((m.current_shot_count ?? 0) / (m.expected_life_shots ?? 1)) * 100 : 0;
    return pct > 85;
  }).length;
  const moldsEOL = dashboard?.molds_eol ?? moldList.filter((m) => m.life_stage === 'end_of_life').length;

  // Filtered list
  const filteredMolds = debouncedSearch
    ? moldList.filter((m) => {
        const q = debouncedSearch.toLowerCase();
        return (m.mold_code ?? '').toLowerCase().includes(q) || (m.name ?? '').toLowerCase().includes(q);
      })
    : moldList;

  const tableColumns = [
    { title: 'Mold Code', dataIndex: 'mold_code', key: 'mold_code', width: 130,
      render: (v) => <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>{v}</Text> },
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Current Shots', dataIndex: 'current_shot_count', key: 'current_shots', width: 130,
      render: (v) => (v ?? 0).toLocaleString() },
    { title: 'Expected Life', dataIndex: 'expected_life_shots', key: 'expected_life', width: 130,
      render: (v) => (v ?? 0).toLocaleString() },
    { title: 'Life %', key: 'life_pct', width: 140,
      render: (_, r) => {
        const pct = (r.expected_life_shots ?? 1) > 0 ? Math.round(((r.current_shot_count ?? 0) / (r.expected_life_shots ?? 1)) * 100) : 0;
        return <Progress percent={Math.min(pct, 100)} size="small" strokeColor={getLifeColor(pct)} format={() => `${pct}%`} />;
      } },
    { title: 'Life Stage', dataIndex: 'life_stage', key: 'life_stage', width: 150,
      render: (v) => v ? <Tag color={LIFE_STAGE_COLOR[v] ?? 'default'} style={{ borderRadius: 20, fontSize: 11 }}>{fmtLabel(v)}</Tag> : '\u2014' },
    { title: 'Remaining Days', key: 'remaining', width: 130,
      render: (_, r) => { const v = (r.ShotSummary ?? r.shot_summary)?.estimated_remaining_days; return v != null ? `${v} days` : '\u2014'; } },
    { title: 'Last Shot', key: 'last_shot', width: 120,
      render: (_, r) => fmtDate((r.ShotSummary ?? r.shot_summary)?.last_shot_date) },
    { title: 'Actions', key: 'actions', width: 120, render: (_, r) => (
      <div style={{ display: 'flex', gap: 4 }}>
        <Tooltip title="Shot History"><Button size="small" icon={<HistoryOutlined />} onClick={() => openHistory(r)} /></Tooltip>
        {canWrite && <Tooltip title="Adjust"><Button size="small" icon={<SlidersOutlined />} onClick={() => { setAdjustMoldId(r.id ?? r.mold_id); setAdjustOpen(true); }} /></Tooltip>}
      </div>
    ) },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Mold</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Shot Count Dashboard</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Shot Count Dashboard</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Monitor mold shot counts, life percentages and replacement schedules.</Text>
      </div>

      {/* Summary cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Molds', value: totalMolds, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Avg Life %', value: `${avgLifePct}%`, color: '#6b7280', bg: '#f9fafb' },
          { label: 'Molds > 85% Life', value: moldsOver85, color: '#f97316', bg: '#fff7ed' },
          { label: 'Molds at EOL', value: moldsEOL, color: '#ef4444', bg: '#fef2f2' },
        ].map((s) => (
          <Col xs={12} sm={6} key={s.label}>
            <Card size="small" style={{ border: `1px solid ${s.color}30`, borderRadius: 10, background: s.bg, textAlign: 'center' }}>
              <Text style={{ color: s.color, fontWeight: 700, fontSize: 22, display: 'block' }}>{s.value}</Text>
              <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Toolbar */}
      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Input placeholder="Search mold code / name..." prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240, borderRadius: 8 }} allowClear />
          <div style={{ flex: 1 }} />
          <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} optionType="button" buttonStyle="solid" size="small">
            <Radio.Button value="card"><AppstoreOutlined /> Cards</Radio.Button>
            <Radio.Button value="table"><TableOutlined /> Table</Radio.Button>
          </Radio.Group>
          <Button icon={<ReloadOutlined />} onClick={fetchDashboard} style={{ borderRadius: 8 }}>Refresh</Button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> : viewMode === 'table' ? (
          <Table rowKey={(r) => r.id ?? r.mold_id ?? r.mold_code} columns={tableColumns} dataSource={filteredMolds}
            pagination={{ pageSize: 20, showTotal: (t) => `${t} molds`, showSizeChanger: true, style: { marginBottom: 0 } }}
            scroll={{ x: 1000 }} size="middle" style={{ borderRadius: 8, overflow: 'hidden' }}
            onRow={(r) => ({ onClick: () => openHistory(r), style: { cursor: 'pointer' } })} />
        ) : (
          <Row gutter={[16, 16]}>
            {filteredMolds.map((m) => {
              const pct = (m.expected_life_shots ?? 1) > 0 ? Math.round(((m.current_shot_count ?? 0) / (m.expected_life_shots ?? 1)) * 100) : 0;
              const color = getLifeColor(pct);
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={m.id ?? m.mold_id ?? m.mold_code}>
                  <Card hoverable size="small" onClick={() => openHistory(m)}
                    style={{ borderRadius: 12, border: `1px solid ${color}40`, cursor: 'pointer' }}
                    bodyStyle={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>{m.mold_code}</Text>
                      {m.life_stage && <Tag color={LIFE_STAGE_COLOR[m.life_stage] ?? 'default'} style={{ borderRadius: 20, fontSize: 10, margin: 0 }}>{fmtLabel(m.life_stage)}</Tag>}
                    </div>
                    <Text style={{ fontWeight: 500, fontSize: 13, display: 'block', marginBottom: 8 }}>{m.name}</Text>
                    <Text style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                      {(m.current_shot_count ?? 0).toLocaleString()} / {(m.expected_life_shots ?? 0).toLocaleString()} shots
                    </Text>
                    <Progress percent={Math.min(pct, 100)} size="small" strokeColor={color} format={() => `${pct}%`} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                        {(m.ShotSummary ?? m.shot_summary)?.estimated_remaining_days != null
                          ? `${(m.ShotSummary ?? m.shot_summary).estimated_remaining_days} days left` : ''}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate((m.ShotSummary ?? m.shot_summary)?.last_shot_date)}</Text>
                    </div>
                    {canWrite && (
                      <Button size="small" icon={<SlidersOutlined />} style={{ marginTop: 8, borderRadius: 6, fontSize: 11, width: '100%' }}
                        onClick={(e) => { e.stopPropagation(); setAdjustMoldId(m.id ?? m.mold_id); setAdjustOpen(true); }}>
                        <SlidersOutlined style={{ marginRight: 4 }} />Manual Adjustment
                      </Button>
                    )}
                  </Card>
                </Col>
              );
            })}
            {filteredMolds.length === 0 && (
              <Col span={24}><div style={{ textAlign: 'center', padding: 40 }}><DashboardOutlined style={{ fontSize: 32, color: '#d1d5db', marginBottom: 12 }} /><br /><Text type="secondary">No molds found</Text></div></Col>
            )}
          </Row>
        )}
      </Card>

      {/* Shot History Drawer */}
      <Drawer title={historyMold ? `Shot History - ${historyMold.mold_code}` : 'Shot History'}
        width={640} open={historyOpen} onClose={() => { setHistoryOpen(false); setHistoryMold(null); setShotHistory([]); }} destroyOnClose>
        {historyMold && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>{historyMold.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Current: {(historyMold.current_shot_count ?? 0).toLocaleString()} / {(historyMold.expected_life_shots ?? 0).toLocaleString()} shots
            </Text>
          </div>
        )}
        <Table rowKey="id" size="small" dataSource={shotHistory} loading={shotLoading}
          pagination={{ current: shotPage, pageSize: 20, total: shotTotal, onChange: fetchHistoryPage, showTotal: (t) => `${t} records`, size: 'small', style: { marginBottom: 0 } }}
          columns={[
            { title: 'Date', dataIndex: 'logged_at', key: 'logged_at', width: 140, render: (v) => fmtDateTime(v) },
            { title: 'Shots', dataIndex: 'shots_this_run', key: 'shots', width: 80, render: (v) => (v ?? 0).toLocaleString() },
            { title: 'Cumulative', dataIndex: 'cumulative_total', key: 'cumulative', width: 100, render: (v) => (v ?? 0).toLocaleString() },
            { title: 'OK', dataIndex: 'ok_qty', key: 'ok', width: 70, render: (v) => (v ?? 0).toLocaleString() },
            { title: 'Reject', dataIndex: 'reject_qty', key: 'reject', width: 70, render: (v) => v > 0 ? <Text type="danger">{v}</Text> : '0' },
            { title: 'Machine', key: 'machine', render: (_, r) => r.machine?.name ?? r.machine_name ?? '\u2014' },
          ]}
        />
      </Drawer>

      {/* Manual Adjustment Modal */}
      <Modal title="Manual Shot Count Adjustment" open={adjustOpen}
        onCancel={() => { setAdjustOpen(false); adjustForm.resetFields(); }}
        onOk={handleAdjust} okText="Apply Adjustment" confirmLoading={adjusting}>
        <Form form={adjustForm} layout="vertical">
          <Form.Item name="adjustment" label="Adjustment (+/-)" rules={[{ required: true, message: 'Enter adjustment value' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="e.g. +500 or -200" />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Provide a reason for adjustment' }]}>
            <Input.TextArea rows={3} placeholder="Reason for manual adjustment" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
};

export default ShotCountDashboardPage;
