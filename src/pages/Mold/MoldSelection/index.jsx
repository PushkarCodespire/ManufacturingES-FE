import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Typography, Tag, Button, Space, Select, InputNumber,
  Progress, Drawer, Descriptions, Alert, Tooltip, Spin,
  Modal, Form, Input, Divider, Row, Col, message, Empty, Badge,
} from 'antd';
import {
  ReloadOutlined, StarFilled, CheckCircleOutlined,
  WarningOutlined, CloseCircleOutlined, RightOutlined, LockOutlined,
  UnlockOutlined, ExperimentOutlined, BarsOutlined, RobotOutlined, SearchOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { moldAiApi }   from '../../../api/mold.api';
import { itemApi }     from '../../../api/item.api';
import { workOrderApi } from '../../../api/production.api';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ── Score colour helper ───────────────────────────────────────────────────────
const scoreColor = (score, max) => {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8)  return '#16a34a';
  if (pct >= 0.5)  return '#ca8a04';
  return '#dc2626';
};

const totalColor = (total) => {
  if (total >= 80) return 'success';
  if (total >= 55) return 'warning';
  return 'error';
};

// ── Score breakdown row ───────────────────────────────────────────────────────
const ScoreRow = ({ label, score, max, note }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
      <Text style={{ fontSize: 12 }}>{label}</Text>
      <Text strong style={{ fontSize: 12, color: scoreColor(score, max) }}>
        {score} / {max}
      </Text>
    </div>
    <Progress
      percent={max > 0 ? Math.round((score / max) * 100) : 0}
      size="small"
      showInfo={false}
      strokeColor={scoreColor(score, max)}
    />
    {note && <Text type="secondary" style={{ fontSize: 11 }}>{note}</Text>}
  </div>
);

// ── Status badge for mold ─────────────────────────────────────────────────────
const MoldStatusTag = ({ status }) => {
  const map = {
    production_ready: { color: 'green',   label: 'Production Ready' },
    in_storage:       { color: 'blue',    label: 'In Storage'       },
    in_production:    { color: 'orange',  label: 'In Production'    },
    repair_needed:    { color: 'red',     label: 'Repair Needed'    },
    in_repair:        { color: 'volcano', label: 'In Repair'        },
    trial_pending:    { color: 'purple',  label: 'Trial Pending'    },
    end_of_life:      { color: 'default', label: 'End of Life'      },
  };
  const cfg = map[status] || { color: 'default', label: status };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
};

export default function MoldSelectionPage() {
  const { can } = usePermissions();
  const canWrite = can('mold-selection-create_edit_delete');

  // ── Items dropdown state ─────────────────────────────────────────────────
  const [items,        setItems]        = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // ── Work Orders dropdown (for reserve modal) ─────────────────────────────
  const [workOrders,    setWorkOrders]    = useState([]);
  const [woLoading,     setWoLoading]     = useState(false);

  // ── Part search state ─────────────────────────────────────────────────────
  const [partId,    setPartId]    = useState(null);
  const [partLabel, setPartLabel] = useState('');
  const [woQty,     setWoQty]     = useState(1000);
  const [loading,   setLoading]   = useState(false);
  const [options,   setOptions]   = useState(null); // null = not searched yet
  const [aiRec,     setAiRec]     = useState(null);

  // ── Reservations state ───────────────────────────────────────────────────
  const [reservations,    setReservations]    = useState([]);
  const [resLoading,      setResLoading]      = useState(false);

  // ── Drawer state ─────────────────────────────────────────────────────────
  const [detailMold,  setDetailMold]  = useState(null);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  // ── Reserve modal ────────────────────────────────────────────────────────
  const [reserveModal, setReserveModal]   = useState(false);
  const [reserveTarget, setReserveTarget] = useState(null);
  const [reserveForm] = Form.useForm();
  const [reserving, setReserving] = useState(false);

  // ── Release confirm ───────────────────────────────────────────────────────
  const [releasing, setReleasing] = useState(null); // moldId-woId key

  const fetchReservations = useCallback(async () => {
    setResLoading(true);
    try {
      const res = await moldAiApi.getReservations();
      setReservations(Array.isArray(res) ? res : (res?.data ?? []));
    } catch {
      // silently ignore
    } finally {
      setResLoading(false);
    }
  }, []);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // ── Load items for dropdown ───────────────────────────────────────────────
  const fetchItems = useCallback(async (search = '') => {
    setItemsLoading(true);
    try {
      const res = await itemApi.getAll({ search, limit: 50 });
      const list = res?.data ?? res ?? [];
      setItems(Array.isArray(list) ? list : list?.rows ?? []);
    } catch {
      // silently ignore
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Load work orders for reserve dropdown ─────────────────────────────────
  const fetchWorkOrders = useCallback(async (search = '') => {
    setWoLoading(true);
    try {
      const res = await workOrderApi.getAll({ search, limit: 30 });
      const data = res?.data ?? res ?? [];
      const rows = Array.isArray(data) ? data : (data?.rows ?? []);
      setWorkOrders(rows);
    } catch {
      // silently ignore
    } finally {
      setWoLoading(false);
    }
  }, []);

  // ── Search mold options for part ─────────────────────────────────────────
  const handleSearch = async () => {
    if (!partId) {
      message.warning('Select a Part / Item to search');
      return;
    }
    setLoading(true);
    setOptions(null);
    setAiRec(null);
    try {
      const res = await moldAiApi.getMoldOptions(partId, { wo_qty: woQty });
      // .then(r=>r.data) in api file unwraps → { part, wo_qty, options, ai_recommendation }
      const payload = res?.options !== undefined ? res : res?.data;
      setOptions(payload?.options || []);
      setAiRec(payload?.ai_recommendation || null);
    } catch (err) {
      message.error(err?.message || 'Failed to fetch mold options');
    } finally {
      setLoading(false);
    }
  };

  // ── Open detail drawer ────────────────────────────────────────────────────
  const openDetail = (row) => {
    setDetailMold(row);
    setDrawerOpen(true);
  };

  // ── Open reserve modal ────────────────────────────────────────────────────
  const openReserve = (row) => {
    setReserveTarget(row);
    reserveForm.resetFields();
    setReserveModal(true);
    fetchWorkOrders();
  };

  const handleReserve = async (values) => {
    if (!reserveTarget) return;
    setReserving(true);
    try {
      await moldAiApi.reserveMold(
        reserveTarget.mold_id,          // flat field — was reserveTarget.mold.id
        values.work_order_id,
        { override_reason: values.override_reason || undefined }
      );
      message.success(`Mold ${reserveTarget.mold_code} reserved successfully`);
      setReserveModal(false);
      fetchReservations();
      if (partId) handleSearch();
    } catch (err) {
      message.error(err?.message || err?.message || 'Failed to reserve mold');
    } finally {
      setReserving(false);
    }
  };

  // ── Release reservation ───────────────────────────────────────────────────
  const handleRelease = async (moldId, woId, key) => {
    setReleasing(key);
    try {
      await moldAiApi.releaseReservation(moldId, woId);
      message.success('Reservation released');
      fetchReservations();
    } catch (err) {
      message.error(err?.message || 'Failed to release reservation');
    } finally {
      setReleasing(null);
    }
  };

  // ── Mold options table columns ────────────────────────────────────────────
  const optionColumns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 72,
      render: (_, r, idx) => (
        <div style={{ textAlign: 'center' }}>
          {idx === 0 ? (
            <Space direction="vertical" size={2}>
              <StarFilled style={{ color: '#f59e0b', fontSize: 18 }} />
              <Tag
                color="gold"
                style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}
              >
                AI Pick
              </Tag>
            </Space>
          ) : (
            <Text style={{ color: '#6b7280' }}>#{idx + 1}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Mold',
      key: 'mold',
      render: (_, r) => (
        <div>
          <Text strong style={{ color: '#1d4ed8' }}>{r.mold_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.mold_name}</Text>
          {r.is_primary_mold && (
            <Tag color="blue" style={{ fontSize: 10, marginTop: 2, display: 'block', width: 'fit-content' }}>
              Primary
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <MoldStatusTag status={r.status} />
          {r.is_reserved && (
            <Tag color="orange" icon={<LockOutlined />} style={{ fontSize: 10 }}>Reserved</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Life Remaining',
      key: 'life',
      width: 130,
      render: (_, r) => {
        // backend returns life_pct = ShotSummary.life_percentage (% used)
        const usedPct    = r.life_pct != null ? parseFloat(r.life_pct) : null;
        const remaining  = usedPct != null ? Math.max(0, 100 - usedPct).toFixed(1) : null;
        return remaining !== null ? (
          <div style={{ width: 110 }}>
            <Progress
              percent={parseFloat(remaining)}
              size="small"
              status={parseFloat(remaining) < 15 ? 'exception' : 'normal'}
              format={(p) => `${p}%`}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {remaining}% remaining
            </Text>
          </div>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
    {
      title: 'Score',
      key: 'score',
      width: 110,
      sorter: (a, b) => b.total_score - a.total_score,
      defaultSortOrder: 'ascend',
      render: (_, r) => (
        <div>
          <Tag
            color={totalColor(r.total_score)}
            style={{ fontWeight: 600, fontSize: 13 }}
          >
            {r.total_score} / 100
          </Tag>
          {r.blockers?.length > 0 && (
            <Tooltip title={r.blockers.join(' · ')}>
              <WarningOutlined style={{ color: '#dc2626', marginLeft: 4 }} />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Eligible',
      key: 'eligible',
      width: 80,
      align: 'center',
      render: (_, r) =>
        r.blockers?.length === 0
          ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 16 }} />
          : (
            <Tooltip title={r.blockers?.join(' · ')}>
              <CloseCircleOutlined style={{ color: '#dc2626', fontSize: 16 }} />
            </Tooltip>
          ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => openDetail(r)}>Details</Button>
          {canWrite && r.blockers?.length === 0 && !r.is_reserved && (
            <Button
              type="primary"
              size="small"
              icon={<LockOutlined />}
              onClick={() => openReserve(r)}
            >
              Reserve
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // ── Reservations table columns ────────────────────────────────────────────
  const resColumns = [
    {
      title: 'Mold',
      key: 'mold',
      width: 160,
      render: (_, r) => (
        <div>
          <Text strong style={{ color: '#1d4ed8' }}>{r.Mold?.mold_code || '—'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.Mold?.name || ''}</Text>
        </div>
      ),
    },
    {
      title: 'Work Order',
      key: 'wo',
      width: 160,
      render: (_, r) => (
        <div>
          <Text strong style={{ color: '#374151' }}>
            {r.WorkOrder?.wo_no || <Text type="secondary">—</Text>}
          </Text>
          <br />
          {r.WorkOrder?.status && (
            <Tag style={{ fontSize: 10, marginTop: 2 }}>{r.WorkOrder.status}</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Mold Status',
      key: 'mold_status',
      width: 140,
      render: (_, r) => r.Mold?.status ? <MoldStatusTag status={r.Mold.status} /> : '—',
    },
    {
      title: 'Reserved By',
      key: 'by',
      width: 130,
      render: (_, r) => (
        <div>
          <Text>{r.ReservedBy?.name || '—'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.ReservedBy?.employee_id || ''}</Text>
        </div>
      ),
    },
    {
      title: 'Reserved At',
      key: 'at',
      width: 140,
      render: (_, r) =>
        r.reserved_at ? (
          <Text style={{ fontSize: 12 }}>{dayjs(r.reserved_at).format('DD MMM YYYY HH:mm')}</Text>
        ) : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) => (
        <Tag
          color={v === 'active' ? 'green' : v === 'released' ? 'blue' : 'default'}
          style={{ fontWeight: 500 }}
        >
          {v === 'active' ? 'Active' : v === 'released' ? 'Released' : v}
        </Tag>
      ),
    },
    ...(canWrite ? [{
      title: 'Action',
      key: 'action',
      width: 100,
      render: (_, r) =>
        r.status === 'active' ? (
          <Button
            size="small"
            danger
            icon={<UnlockOutlined />}
            loading={releasing === `${r.mold_id}-${r.work_order_id}`}
            onClick={() => handleRelease(r.mold_id, r.work_order_id, `${r.mold_id}-${r.work_order_id}`)}
          >
            Release
          </Button>
        ) : null,
    }] : []),
  ];

  const [resSearch, setResSearch] = useState('');

  const activeRes = reservations.filter(r => r.status === 'active');

  const filteredRes = reservations.filter((r) => {
    if (!resSearch) return true;
    const q = resSearch.toLowerCase();
    return (
      r.Mold?.mold_code?.toLowerCase().includes(q) ||
      r.WorkOrder?.wo_no?.toLowerCase().includes(q) ||
      r.ReservedBy?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>

      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Mold Management</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Mold Selection Optimizer</Text>
      </div>

      {/* ── Title ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <RobotOutlined style={{ fontSize: 22, color: '#7c3aed' }} />
        <Title level={3} style={{ margin: 0 }}>Mold Selection Optimizer</Title>
        <Tag color="purple" style={{ marginLeft: 4 }}>MOL-014</Tag>
      </div>
      <Text type="secondary" style={{ fontSize: 13 }}>
        AI-powered mold ranking for a given part — scored on life sufficiency, quality, PM compliance,
        AI health, location, and recency. The ⭐ <strong>AI Pick</strong> is the top-ranked eligible mold for your Work Order.
      </Text>

      {/* ── Active reservations chip ────────────────────────────────── */}
      <div style={{ marginTop: 10, marginBottom: 20 }}>
        <Tag color={activeRes.length > 0 ? 'blue' : 'default'} icon={<LockOutlined />}>
          {activeRes.length} Active Reservation{activeRes.length !== 1 ? 's' : ''}
        </Tag>
      </div>

      {/* ── Search panel ──────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div>
          <div style={{ marginBottom: 4 }}>
            <Text strong style={{ fontSize: 13 }}>Part / Item</Text>
          </div>
          <Select
            showSearch
            placeholder={
              <span>
                <SearchOutlined style={{ marginRight: 6, color: '#9ca3af' }} />
                Search and select a Part / Item...
              </span>
            }
            value={partId}
            onSearch={(v) => fetchItems(v)}
            onChange={(val, opt) => { setPartId(val); setPartLabel(opt?.label || ''); }}
            loading={itemsLoading}
            filterOption={false}
            style={{ width: '100%', borderRadius: 8, marginBottom: 12 }}
            options={items.map(i => ({ value: i.id, label: `${i.code} — ${i.name}` }))}
            allowClear
            onClear={() => { setPartId(null); setPartLabel(''); setOptions(null); setAiRec(null); }}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ marginBottom: 4 }}>
                <Text strong style={{ fontSize: 13 }}>WO Quantity</Text>
              </div>
              <InputNumber
                min={1}
                value={woQty}
                onChange={v => setWoQty(v)}
                placeholder="WO Qty"
                style={{ width: 130, borderRadius: 8 }}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => v.replace(/,/g, '')}
              />
            </div>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleSearch}
              loading={loading}
              style={{ borderRadius: 8, minWidth: 140 }}
            >
              Find Best Mold
            </Button>
          </div>
        </div>

        {/* ── AI recommendation banner ─────────────────────────────────── */}
        {aiRec && (
          <Alert
            style={{ marginTop: 14, borderRadius: 8 }}
            type="success"
            icon={<TrophyOutlined />}
            showIcon
            message={
              <span>
                <Text strong>AI Recommendation: </Text>
                <Text code style={{ fontWeight: 600 }}>{aiRec.mold_code}</Text>
                {' '}—{' '}
                <Text>{aiRec.mold_name}</Text>
                <Tag color="green" style={{ marginLeft: 8, fontWeight: 600 }}>
                  Score: {aiRec.total_score} / 100
                </Tag>
              </span>
            }
            description="This mold has the highest combined score for life sufficiency, quality, and availability. It is the optimal choice for this work order."
          />
        )}
      </Card>

      {/* ── Results table ─────────────────────────────────────────────── */}
      {options !== null && (
        <Card
          title={
            <span>
              <BarsOutlined style={{ marginRight: 8, color: '#7c3aed' }} />
              Mold Options
              {partLabel && <Tag color="purple" style={{ marginLeft: 8 }}>{partLabel}</Tag>}
              <Tag style={{ marginLeft: 4 }}>WO Qty: {woQty?.toLocaleString()}</Tag>
            </span>
          }
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          {options.length === 0 ? (
            <Empty description="No molds mapped to this part. Add mold-part mappings in Mold Master." />
          ) : (
            <Table
              dataSource={options}
              columns={optionColumns}
              rowKey={(r) => r.mold_id}
              loading={loading}
              pagination={{ pageSize: 20, showTotal: (t) => `${t} molds`, showSizeChanger: false }}
              size="small"
              scroll={{ x: 900 }}
              onRow={(_, idx) => ({
                style: idx === 0 ? { background: '#fefce8' } : {},
              })}
            />
          )}
        </Card>
      )}

      {/* ── Scoring legend ────────────────────────────────────────────── */}
      <Card
        title={<span><ExperimentOutlined style={{ marginRight: 8 }} />Scoring Criteria</span>}
        size="small"
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}
        bodyStyle={{ padding: '12px 20px' }}
      >
        <Row gutter={16}>
          {[
            { label: 'Life Sufficiency',   max: 25, desc: 'Remaining shots ≥ WO qty × 1.2 safety margin' },
            { label: 'Rejection Rate',     max: 25, desc: '0% reject = full score; 5% reject = 0 pts (linear)' },
            { label: 'PM Compliance',      max: 15, desc: 'Healthy status (production_ready / in_storage)' },
            { label: 'AI Health Score',    max: 15, desc: 'Based on AI prediction ratio (predicted ÷ rated)' },
            { label: 'Location Proximity', max: 10, desc: 'In-storage = 10 pts, in-production = 3 pts' },
            { label: 'Recency',            max: 10, desc: 'Used within 7 days = 10 pts; never used = 5 pts' },
          ].map(c => (
            <Col xs={24} sm={12} md={8} key={c.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12 }}>{c.label}</Text>
                <Tag>{c.max} pts</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>{c.desc}</Text>
            </Col>
          ))}
        </Row>
      </Card>

      {/* ── Active reservations ───────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <LockOutlined style={{ color: '#1d4ed8', fontSize: 15 }} />
          <Text style={{ fontWeight: 600, fontSize: 14 }}>
            Active Reservations
          </Text>
          <Badge
            count={activeRes.length}
            style={{ backgroundColor: activeRes.length > 0 ? '#1d4ed8' : '#d9d9d9' }}
          />
          <div style={{ flex: 1 }} />
          <Input
            placeholder="Search mold or WO..."
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={resSearch}
            onChange={(e) => setResSearch(e.target.value)}
            style={{ width: 220, borderRadius: 8 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchReservations} loading={resLoading}>
            Refresh
          </Button>
        </div>

        <Table
          dataSource={filteredRes}
          columns={resColumns}
          rowKey="id"
          loading={resLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} reservation(s)` }}
          size="small"
          scroll={{ x: 860 }}
          locale={{ emptyText: 'No reservations found. Use "Reserve" on a mold option above to create one.' }}
        />
      </Card>

      {/* ── Score detail drawer ──────────────────────────────────────── */}
      <Drawer
        title={
          detailMold ? (
            <span>
              <BarsOutlined style={{ marginRight: 8 }} />
              Score Breakdown — {detailMold.mold_code}
            </span>
          ) : 'Score Breakdown'
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        extra={
          canWrite && detailMold?.blockers?.length === 0 && !detailMold?.is_reserved && (
            <Button
              type="primary"
              icon={<LockOutlined />}
              onClick={() => { setDrawerOpen(false); openReserve(detailMold); }}
            >
              Reserve This Mold
            </Button>
          )
        }
      >
        {detailMold && (
          <div>
            {/* Header chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <MoldStatusTag status={detailMold.status} />
              <Tag color={totalColor(detailMold.total_score)} style={{ fontWeight: 600 }}>
                Total: {detailMold.total_score} / 100
              </Tag>
              {detailMold.blockers?.length === 0
                ? <Tag color="green" icon={<CheckCircleOutlined />}>Eligible</Tag>
                : <Tag color="red"   icon={<CloseCircleOutlined />}>Not Eligible</Tag>
              }
              {detailMold.is_primary_mold && <Tag color="blue">Primary Mold</Tag>}
            </div>

            {/* Blockers */}
            {detailMold.blockers?.length > 0 && (
              <Alert
                type="error"
                style={{ marginBottom: 16 }}
                message="Eligibility Blockers"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {detailMold.blockers.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                }
              />
            )}

            {/* Score breakdown */}
            <Divider orientation="left" plain>Score Breakdown</Divider>
            {detailMold.breakdown && (
              <div>
                <ScoreRow
                  label="Life Sufficiency"
                  score={detailMold.breakdown.life_sufficiency?.score ?? 0}
                  max={25}
                  note={
                    detailMold.breakdown.life_sufficiency
                      ? `Need ${(detailMold.breakdown.life_sufficiency.shots_needed || 0).toLocaleString()} shots — Remaining: ${(detailMold.breakdown.life_sufficiency.rated_remaining || 0).toLocaleString()}`
                      : undefined
                  }
                />
                <ScoreRow
                  label="Rejection Rate"
                  score={detailMold.breakdown.rejection_rate?.score ?? 0}
                  max={25}
                  note={
                    detailMold.breakdown.rejection_rate?.runs_checked
                      ? `${detailMold.breakdown.rejection_rate.reject_pct}% reject rate over ${detailMold.breakdown.rejection_rate.runs_checked} run(s)`
                      : 'No shot run data'
                  }
                />
                <ScoreRow
                  label="PM Compliance"
                  score={detailMold.breakdown.pm_compliance?.score ?? 0}
                  max={15}
                  note={detailMold.breakdown.pm_compliance?.pass ? 'Mold is in a healthy status' : `Status: ${detailMold.breakdown.pm_compliance?.status || '—'}`}
                />
                <ScoreRow
                  label="AI Health Score"
                  score={detailMold.breakdown.ai_health?.score ?? 0}
                  max={15}
                  note={
                    detailMold.breakdown.ai_health?.has_prediction
                      ? `Prediction ratio: ${(detailMold.breakdown.ai_health.prediction_ratio * 100).toFixed(0)}% | Confidence: ${detailMold.breakdown.ai_health.confidence}`
                      : 'No AI prediction generated yet — using neutral score (10 pts)'
                  }
                />
                <ScoreRow
                  label="Location Proximity"
                  score={detailMold.breakdown.location?.score ?? 0}
                  max={10}
                  note={`Mold is currently: ${detailMold.breakdown.location?.status || detailMold.status}`}
                />
                <ScoreRow
                  label="Recency"
                  score={detailMold.breakdown.recency?.score ?? 0}
                  max={10}
                  note={
                    detailMold.breakdown.recency?.days_since_last != null
                      ? `Last used ${detailMold.breakdown.recency.days_since_last} day(s) ago`
                      : 'Never used in production'
                  }
                />
              </div>
            )}

            {/* Mold details */}
            <Divider orientation="left" plain>Mold Details</Divider>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Mold Code">{detailMold.mold_code}</Descriptions.Item>
              <Descriptions.Item label="Name">{detailMold.mold_name}</Descriptions.Item>
              <Descriptions.Item label="Category">{detailMold.category || '—'}</Descriptions.Item>
              <Descriptions.Item label="Current Shots">
                {(detailMold.current_shots || 0).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Expected Life">
                {detailMold.expected_life ? detailMold.expected_life.toLocaleString() + ' shots' : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Life Used">
                {detailMold.life_pct != null ? `${parseFloat(detailMold.life_pct).toFixed(1)}%` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Active Cavities">
                {detailMold.active_cavities || '—'}
              </Descriptions.Item>
            </Descriptions>

            {/* AI health details from score breakdown */}
            {detailMold.breakdown?.ai_health?.has_prediction && (
              <>
                <Divider orientation="left" plain>AI Health Signal</Divider>
                <Alert
                  type={
                    detailMold.breakdown.ai_health.confidence === 'high' ? 'success' :
                    detailMold.breakdown.ai_health.confidence === 'medium' ? 'warning' : 'info'
                  }
                  message={`AI Confidence: ${(detailMold.breakdown.ai_health.confidence || 'low').toUpperCase()}`}
                  description={
                    detailMold.breakdown.ai_health.prediction_ratio != null
                      ? `Predicted remaining life is ${(detailMold.breakdown.ai_health.prediction_ratio * 100).toFixed(0)}% of rated remaining life`
                      : 'No prediction ratio available'
                  }
                  style={{ borderRadius: 8 }}
                />
              </>
            )}
          </div>
        )}
      </Drawer>

      {/* ── Reserve modal ────────────────────────────────────────────── */}
      <Modal
        title={
          reserveTarget ? (
            <span>
              <LockOutlined style={{ marginRight: 8, color: '#1d4ed8' }} />
              Reserve Mold — {reserveTarget.mold_code}
            </span>
          ) : 'Reserve Mold'
        }
        open={reserveModal}
        onCancel={() => setReserveModal(false)}
        footer={null}
        width={480}
        destroyOnClose
      >
        {reserveTarget && (
          <div>
            <Alert
              type="info"
              showIcon
              message={`Score: ${reserveTarget.total_score}/100 — ${reserveTarget.mold_name}`}
              description="Reserving this mold will prevent it from being issued to any other Work Order until released."
              style={{ marginBottom: 16 }}
            />
            <Form form={reserveForm} layout="vertical" onFinish={handleReserve}>
              <Form.Item
                label="Work Order"
                name="work_order_id"
                rules={[{ required: true, message: 'Select a Work Order' }]}
              >
                <Select
                  showSearch
                  placeholder="Search Work Order..."
                  onSearch={(v) => fetchWorkOrders(v)}
                  filterOption={false}
                  loading={woLoading}
                  options={workOrders.map(wo => ({
                    value: wo.id,
                    label: `${wo.wo_no} — ${wo.status || ''}`,
                  }))}
                  notFoundContent={woLoading ? <Spin size="small" /> : 'No work orders found'}
                />
              </Form.Item>

              {reserveTarget.blockers?.length > 0 && (
                <Form.Item
                  label="Override Reason"
                  name="override_reason"
                  rules={[{ required: true, message: 'Override reason required for ineligible molds' }]}
                  extra="This mold has eligibility blockers. Provide a reason to override."
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="Explain why this mold should be reserved despite blockers..."
                  />
                </Form.Item>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Button onClick={() => setReserveModal(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={reserving} icon={<LockOutlined />}>
                  Confirm Reservation
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Modal>

    </AppLayout>
  );
}
