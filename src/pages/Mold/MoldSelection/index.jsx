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
} from '@ant-design/icons';
import { moldAiApi } from '../../../api/mold.api';
import { itemApi }   from '../../../api/item.api';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

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
  const [itemSearch,   setItemSearch]   = useState('');

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
      // interceptor unwraps res.data → { success, data:[...] }
      // .then(r=>r.data) in mold.api.js unwraps again → array directly
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
      // interceptor unwraps res.data → { success, data:{...} }
      // .then(r=>r.data) unwraps again → { part, wo_qty, options, ai_recommendation }
      const payload = res?.options !== undefined ? res : res?.data;
      setOptions(payload?.options || []);
      setAiRec(payload?.ai_recommendation || null);
    } catch (err) {
      // interceptor rejects with response body, not full axios error
      message.error(err?.message || 'Failed to fetch mold options');
    } finally {
      setLoading(false);
    }
  };

  // ── Open detail drawer ────────────────────────────────────────────────────
  const openDetail = (mold) => {
    setDetailMold(mold);
    setDrawerOpen(true);
  };

  // ── Open reserve modal ────────────────────────────────────────────────────
  const openReserve = (mold) => {
    setReserveTarget(mold);
    reserveForm.resetFields();
    setReserveModal(true);
  };

  const handleReserve = async (values) => {
    if (!reserveTarget) return;
    setReserving(true);
    try {
      await moldAiApi.reserveMold(
        reserveTarget.mold.id,
        values.work_order_id,
        { override_reason: values.override_reason || undefined }
      );
      message.success(`Mold ${reserveTarget.mold.mold_code} reserved successfully`);
      setReserveModal(false);
      fetchReservations();
      // Refresh options if we were in a search
      if (partId) handleSearch();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to reserve mold');
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
      message.error(err?.response?.data?.message || 'Failed to release reservation');
    } finally {
      setReleasing(null);
    }
  };

  // ── Mold options table columns ────────────────────────────────────────────
  const optionColumns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 60,
      render: (_, __, idx) => (
        <div style={{ textAlign: 'center' }}>
          {idx === 0
            ? <StarFilled style={{ color: '#f59e0b', fontSize: 18 }} />
            : <Text style={{ color: '#6b7280' }}>#{idx + 1}</Text>
          }
        </div>
      ),
    },
    {
      title: 'Mold',
      key: 'mold',
      render: (_, r) => (
        <div>
          <Text strong>{r.mold.mold_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.mold.name}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => <MoldStatusTag status={r.mold.status} />,
    },
    {
      title: 'Life Remaining',
      key: 'life',
      render: (_, r) => {
        const pct = r.mold.ShotSummary?.life_percentage
          ? (100 - parseFloat(r.mold.ShotSummary.life_percentage)).toFixed(1)
          : null;
        return pct !== null
          ? (
            <div style={{ width: 100 }}>
              <Progress percent={parseFloat(pct)} size="small" status={pct < 15 ? 'exception' : 'normal'} />
              <Text type="secondary" style={{ fontSize: 11 }}>{pct}% left</Text>
            </div>
          )
          : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Score',
      key: 'score',
      sorter: (a, b) => b.total_score - a.total_score,
      defaultSortOrder: 'ascend',
      render: (_, r) => (
        <div>
          <Tag color={totalColor(r.total_score)} style={{ fontWeight: 600, fontSize: 13 }}>
            {r.total_score} / 100
          </Tag>
          {r.blockers?.length > 0 && (
            <Tooltip title={r.blockers.join(' · ')}>
              <WarningOutlined style={{ color: '#dc2626', marginLeft: 6 }} />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Eligible',
      key: 'eligible',
      render: (_, r) =>
        r.is_eligible
          ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 16 }} />
          : <Tooltip title={r.blockers?.join(' · ')}><CloseCircleOutlined style={{ color: '#dc2626', fontSize: 16 }} /></Tooltip>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => openDetail(r)}>Details</Button>
          {canWrite && r.is_eligible && (
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
      render: (_, r) => (
        <div>
          <Text strong>{r.Mold?.mold_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.Mold?.name}</Text>
        </div>
      ),
    },
    {
      title: 'Work Order',
      dataIndex: 'work_order_id',
      key: 'wo',
      render: (v) => <Text code>{v}</Text>,
    },
    {
      title: 'Reserved By',
      key: 'by',
      render: (_, r) => r.ReservedBy?.name || '—',
    },
    {
      title: 'Reserved At',
      key: 'at',
      render: (_, r) => r.reserved_at ? dayjs(r.reserved_at).format('DD MMM YYYY HH:mm') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v) => <Tag color={v === 'active' ? 'green' : v === 'released' ? 'blue' : 'default'}>{v}</Tag>,
    },
    ...(canWrite ? [{
      title: 'Action',
      key: 'action',
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

  const activeRes = reservations.filter(r => r.status === 'active');

  return (
    <AppLayout>
    <div style={{ padding: '24px 28px', background: '#f4f6f9', minHeight: '100vh' }}>

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
        AI health, location, and recency. Reserve the best mold for your Work Order.
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
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 13 }}>Part / Item</Text>
            </div>
            <Select
              showSearch
              placeholder={<span><SearchOutlined style={{ marginRight: 6, color: '#9ca3af' }} />Search and select a Part / Item...</span>}
              value={partId}
              onSearch={(v) => { setItemSearch(v); fetchItems(v); }}
              onChange={(val, opt) => { setPartId(val); setPartLabel(opt?.label || ''); }}
              loading={itemsLoading}
              filterOption={false}
              style={{ width: '100%', borderRadius: 8 }}
              options={items.map(i => ({ value: i.id, label: `${i.code} — ${i.name}` }))}
              allowClear
              onClear={() => { setPartId(null); setPartLabel(''); }}
            />
          </Col>
          <Col>
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
          </Col>
          <Col style={{ paddingTop: 20 }}>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleSearch}
              loading={loading}
              style={{ borderRadius: 8, minWidth: 140 }}
            >
              Find Best Mold
            </Button>
          </Col>
        </Row>

        {/* AI recommendation banner */}
        {aiRec && (
          <Alert
            style={{ marginTop: 14 }}
            type="success"
            icon={<StarFilled />}
            showIcon
            message={
              <span>
                <Text strong>AI Recommendation: </Text>
                <Text code>{aiRec.mold_code}</Text>
                {' '}—{' '}
                <Text>{aiRec.name}</Text>
                {' '}
                <Tag color="green" style={{ marginLeft: 8 }}>Score: {aiRec.total_score} / 100</Tag>
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
              {partId && <Tag color="purple" style={{ marginLeft: 8 }}>{partLabel || `Part #${partId}`}</Tag>}
              <Tag style={{ marginLeft: 4 }}>WO Qty: {woQty?.toLocaleString()}</Tag>
            </span>
          }
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}
          bodyStyle={{ padding: '0 0 8px 0' }}
        >
          {options.length === 0 ? (
            <Empty
              style={{ padding: 32 }}
              description="No molds mapped to this part. Add mold-part mappings in Mold Master."
            />
          ) : (
            <Table
              dataSource={options}
              columns={optionColumns}
              rowKey={(r) => r.mold.id}
              loading={loading}
              pagination={false}
              size="small"
              rowClassName={(r) => !r.is_eligible ? 'ant-table-row-disabled' : ''}
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
            { label: 'Life Sufficiency',  max: 25, desc: 'Predicted remaining shots ≥ WO quantity' },
            { label: 'Rejection Rate',    max: 25, desc: 'Lower rejection rate = higher score'     },
            { label: 'PM Compliance',     max: 15, desc: 'No overdue PM schedules'                 },
            { label: 'AI Health Score',   max: 15, desc: 'Based on AI prediction confidence & ratio' },
            { label: 'Location Proximity',max: 10, desc: 'In-storage molds ranked higher'          },
            { label: 'Recency',           max: 10, desc: 'Recently used molds (calibrated state)'  },
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
        title={
          <span>
            <LockOutlined style={{ marginRight: 8, color: '#1d4ed8' }} />
            Active Reservations
            <Badge count={activeRes.length} style={{ marginLeft: 8 }} />
          </span>
        }
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchReservations} loading={resLoading}>
            Refresh
          </Button>
        }
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '0 0 8px 0' }}
      >
        <Table
          dataSource={reservations}
          columns={resColumns}
          rowKey="id"
          loading={resLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="small"
          locale={{ emptyText: 'No active reservations' }}
        />
      </Card>

      {/* ── Score detail drawer ──────────────────────────────────────── */}
      <Drawer
        title={
          detailMold ? (
            <span>
              <BarsOutlined style={{ marginRight: 8 }} />
              Score Breakdown — {detailMold.mold.mold_code}
            </span>
          ) : 'Score Breakdown'
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        extra={
          canWrite && detailMold?.is_eligible && (
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
              <MoldStatusTag status={detailMold.mold.status} />
              <Tag color={totalColor(detailMold.total_score)} style={{ fontWeight: 600 }}>
                Total: {detailMold.total_score} / 100
              </Tag>
              {detailMold.is_eligible
                ? <Tag color="green" icon={<CheckCircleOutlined />}>Eligible</Tag>
                : <Tag color="red" icon={<CloseCircleOutlined />}>Not Eligible</Tag>
              }
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
            {detailMold.score_breakdown && (
              <div>
                <ScoreRow
                  label="Life Sufficiency"
                  score={detailMold.score_breakdown.life_sufficiency ?? 0}
                  max={25}
                  note={`Remaining shots: ${detailMold.mold.ShotSummary?.estimated_remaining_days ?? '?'} days estimated`}
                />
                <ScoreRow
                  label="Rejection Rate"
                  score={detailMold.score_breakdown.rejection_rate ?? 0}
                  max={25}
                />
                <ScoreRow
                  label="PM Compliance"
                  score={detailMold.score_breakdown.pm_compliance ?? 0}
                  max={15}
                />
                <ScoreRow
                  label="AI Health Score"
                  score={detailMold.score_breakdown.ai_health ?? 0}
                  max={15}
                />
                <ScoreRow
                  label="Location Proximity"
                  score={detailMold.score_breakdown.location ?? 0}
                  max={10}
                />
                <ScoreRow
                  label="Recency"
                  score={detailMold.score_breakdown.recency ?? 0}
                  max={10}
                />
              </div>
            )}

            {/* Mold details */}
            <Divider orientation="left" plain>Mold Details</Divider>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Mold Code">{detailMold.mold.mold_code}</Descriptions.Item>
              <Descriptions.Item label="Name">{detailMold.mold.name}</Descriptions.Item>
              <Descriptions.Item label="Category">{detailMold.mold.Category?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Current Shots">
                {detailMold.mold.current_shot_count?.toLocaleString() || '0'}
              </Descriptions.Item>
              <Descriptions.Item label="Expected Life">
                {detailMold.mold.expected_life_shots?.toLocaleString() || '—'} shots
              </Descriptions.Item>
              <Descriptions.Item label="Life Remaining">
                {detailMold.mold.ShotSummary
                  ? `${(100 - parseFloat(detailMold.mold.ShotSummary.life_percentage || 0)).toFixed(1)}%`
                  : '—'
                }
              </Descriptions.Item>
              <Descriptions.Item label="Est. Remaining Days">
                {detailMold.mold.ShotSummary?.estimated_remaining_days ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Storage Location">
                {detailMold.mold.StorageLocation
                  ? `${detailMold.mold.StorageLocation.rack_number} / ${detailMold.mold.StorageLocation.shelf_number}`
                  : 'Not in storage'
                }
              </Descriptions.Item>
            </Descriptions>

            {/* AI prediction if available */}
            {detailMold.ai_prediction && (
              <>
                <Divider orientation="left" plain>AI Prediction</Divider>
                <Alert
                  type={
                    detailMold.ai_prediction.confidence_level === 'high' ? 'success' :
                    detailMold.ai_prediction.confidence_level === 'medium' ? 'warning' : 'info'
                  }
                  message={`Confidence: ${detailMold.ai_prediction.confidence_level?.toUpperCase()}`}
                  description={detailMold.ai_prediction.recommended_action}
                  style={{ marginBottom: 12 }}
                />
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="Predicted Remaining">
                    {detailMold.ai_prediction.predicted_remaining_shots?.toLocaleString() || '—'} shots
                  </Descriptions.Item>
                  <Descriptions.Item label="Rated Remaining">
                    {detailMold.ai_prediction.rated_remaining_shots?.toLocaleString() || '—'} shots
                  </Descriptions.Item>
                  <Descriptions.Item label="Predicted Replacement">
                    {detailMold.ai_prediction.predicted_replacement_date
                      ? dayjs(detailMold.ai_prediction.predicted_replacement_date).format('DD MMM YYYY')
                      : '—'
                    }
                  </Descriptions.Item>
                </Descriptions>
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
              Reserve Mold — {reserveTarget.mold.mold_code}
            </span>
          ) : 'Reserve Mold'
        }
        open={reserveModal}
        onCancel={() => setReserveModal(false)}
        footer={null}
        width={460}
      >
        {reserveTarget && (
          <div>
            <Alert
              type="info"
              showIcon
              message={`Score: ${reserveTarget.total_score}/100`}
              description={`Reserving this mold will prevent it from being issued to any other Work Order until released.`}
              style={{ marginBottom: 16 }}
            />
            <Form
              form={reserveForm}
              layout="vertical"
              onFinish={handleReserve}
            >
              <Form.Item
                label="Work Order ID"
                name="work_order_id"
                rules={[{ required: true, message: 'Enter the Work Order ID' }]}
              >
                <Input placeholder="Enter Work Order ID (e.g. WO-2026-0042)" />
              </Form.Item>

              {!reserveTarget.is_eligible && (
                <Form.Item
                  label="Override Reason"
                  name="override_reason"
                  rules={[{ required: true, message: 'Override reason is required for ineligible molds' }]}
                  extra="This mold has eligibility blockers. Provide a reason to override."
                >
                  <Input.TextArea rows={3} placeholder="Explain why this mold should be reserved despite blockers..." />
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

    </div>
    </AppLayout>
  );
}
