import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Select, InputNumber, Table, Tag,
  Alert, Spin, Divider, Space, Tooltip, Skeleton,
} from 'antd';
import {
  RightOutlined, CheckCircleOutlined, WarningOutlined,
  PlusOutlined, DeleteOutlined, FileAddOutlined, ThunderboltOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout  from '../../../components/AppLayout';
import { bomApi } from '../../../api/bom.api';
import { itemApi } from '../../../api/item.api';

const { Title, Text } = Typography;

let _seq = 0;
const uid = () => ++_seq;

const UNIT_OPTIONS = [
  'piece','kg','gram','ton','liter','ml','meter','mm','cm',
  'foot','inch','square_meter','cubic_meter','roll','sheet','set','pair','box',
].map((v) => ({ value: v, label: v }));

const emptyComponent = () => ({ key: uid(), componentItemId: null, qtyPerUnit: 1, unit: 'piece' });

const emptyCard = () => ({
  key:        uid(),
  itemId:     null,
  plannedQty: 1,
  components: [],
  bomStatus:  null,   // null | 'draft' | 'finalized'
  bomId:      null,
  loadingBom: false,
});

// ── Result card (per finished good) ─────────────────────────────────────────
const COMP_COLS = [
  {
    title: 'Component', key: 'comp', width: 200,
    render: (_, r) => (
      <div>
        <Text style={{ fontWeight: 600, fontSize: 13 }}>{r.item?.name || '—'}</Text>
        {r.item?.code && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.item.code}</Text>}
      </div>
    ),
  },
  {
    title: 'Qty / Unit', key: 'bom_qty', width: 100, align: 'right',
    render: (_, r) => <Text>{r.bom_qty_per_unit} {r.unit || ''}</Text>,
  },
  {
    title: 'Gross Req', dataIndex: 'gross_req', key: 'gross_req', width: 110, align: 'right',
    render: (v, r) => <Text style={{ fontWeight: 600 }}>{v} {r.unit || ''}</Text>,
  },
  {
    title: 'In Stock', dataIndex: 'current_stock', key: 'stock', width: 110, align: 'right',
    render: (v, r) => (
      <Text style={{ color: v > 0 ? '#16a34a' : '#9ca3af' }}>{v} {r.unit || ''}</Text>
    ),
  },
  {
    title: 'Net Req', dataIndex: 'net_req', key: 'net_req', width: 110, align: 'right',
    render: (v, r) => (
      <Text style={{ fontWeight: 700, color: r.shortage ? '#dc2626' : '#16a34a' }}>
        {v} {r.unit || ''}
      </Text>
    ),
    onCell: (r) => ({ style: { background: r.shortage ? '#fef2f2' : undefined } }),
  },
  {
    title: 'Status', key: 'status', width: 100, align: 'center',
    render: (_, r) => r.shortage
      ? <Tag color="red"   icon={<WarningOutlined />}>Shortage</Tag>
      : <Tag color="green" icon={<CheckCircleOutlined />}>OK</Tag>,
  },
];

const ResultCard = ({ result, navigate }) => {
  if (result.noBom) {
    return (
      <Card style={{ border: '1px solid #fde68a', borderRadius: 10, background: '#fffbeb', marginBottom: 14 }}
        bodyStyle={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <WarningOutlined style={{ color: '#d97706', fontSize: 22 }} />
          <div style={{ flex: 1 }}>
            <Text style={{ fontWeight: 700, color: '#92400e', display: 'block' }}>
              No BOM found for "{result.itemName}"
            </Text>
            <Text style={{ color: '#6b7280', fontSize: 13 }}>
              Add at least one component above and click Explode to create and calculate.
            </Text>
          </div>
          <Button size="small" icon={<FileAddOutlined />} onClick={() => navigate('/masters/items')}
            style={{ borderRadius: 6, fontWeight: 600 }}>
            Manage BOMs
          </Button>
        </div>
      </Card>
    );
  }
  if (result.error) {
    return (
      <Card style={{ border: '1px solid #fecaca', borderRadius: 10, background: '#fef2f2', marginBottom: 14 }}
        bodyStyle={{ padding: '14px 20px' }}>
        <Text style={{ color: '#dc2626', fontWeight: 600 }}>{result.itemName}: {result.error}</Text>
      </Card>
    );
  }
  const d = result.data;
  return (
    <Card style={{ border: '1px solid #e8eaed', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 14 }}
      bodyStyle={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <Text style={{ fontWeight: 700, fontSize: 15 }}>{d.item?.name}</Text>
        {d.item?.code && <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.item.code}</Tag>}
        <Tag color="blue">Planned: {d.planned_qty}</Tag>
        <Tag color={d.bom_status === 'finalized' ? 'green' : 'orange'}>BOM: {d.bom_status}</Tag>
        <div style={{ flex: 1 }} />
        {d.has_shortage
          ? <Tag color="red"   icon={<WarningOutlined />}     style={{ fontWeight: 600 }}>Has Shortage</Tag>
          : <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontWeight: 600 }}>All Stocked</Tag>}
      </div>
      {d.has_shortage && (
        <Alert type="warning" showIcon message="Material shortage detected — raise a PO or MR for highlighted items."
          style={{ marginBottom: 12 }} />
      )}
      <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 8 }}>
        {d.explosion?.length || 0} component{(d.explosion?.length || 0) !== 1 ? 's' : ''}
      </Text>
      <Table rowKey="component_item_id" dataSource={d.explosion || []} columns={COMP_COLS}
        size="small" pagination={false} scroll={{ x: 730 }} />
    </Card>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────
export default function BOMExplosionPage() {
  const navigate = useNavigate();

  const [allItems, setAllItems] = useState([]);
  const [cards,    setCards]    = useState([emptyCard()]);
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    itemApi.getAll({ limit: 1000 }).catch(() => ({})).then((res) => {
      setAllItems(Array.isArray(res) ? res : (res?.data ?? []));
    });
  }, []);

  // ── Card helpers ───────────────────────────────────────────────────────────
  const updateCard = (cardKey, patch) =>
    setCards((prev) => prev.map((c) => c.key === cardKey ? { ...c, ...patch } : c));

  const addCard = () => setCards((prev) => [...prev, emptyCard()]);

  const removeCard = (cardKey) =>
    setCards((prev) => prev.length === 1 ? [emptyCard()] : prev.filter((c) => c.key !== cardKey));

  // When a finished good is selected → auto-load its existing BOM components
  const handleItemSelect = useCallback(async (cardKey, itemId) => {
    updateCard(cardKey, { itemId, components: [], bomStatus: null, bomId: null, loadingBom: true });
    setResults([]);
    try {
      const res = await bomApi.getByItemId(itemId);
      const bom = res?.data ?? res;
      if (bom && bom.id) {
        const components = (bom.Lines || []).map((ln) => ({
          key:             uid(),
          componentItemId: ln.component_item_id,
          qtyPerUnit:      parseFloat(ln.quantity),
          unit:            ln.unit || 'piece',
        }));
        updateCard(cardKey, { components, bomStatus: bom.status, bomId: bom.id, loadingBom: false });
      } else {
        updateCard(cardKey, { components: [], bomStatus: null, bomId: null, loadingBom: false });
      }
    } catch {
      updateCard(cardKey, { loadingBom: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Component helpers (per card) ───────────────────────────────────────────
  const addComponent = (cardKey) =>
    setCards((prev) => prev.map((c) =>
      c.key === cardKey ? { ...c, components: [...c.components, emptyComponent()] } : c
    ));

  const removeComponent = (cardKey, compKey) =>
    setCards((prev) => prev.map((c) =>
      c.key === cardKey ? { ...c, components: c.components.filter((cp) => cp.key !== compKey) } : c
    ));

  const updateComponent = (cardKey, compKey, field, val) =>
    setCards((prev) => prev.map((c) =>
      c.key === cardKey
        ? { ...c, components: c.components.map((cp) => cp.key === compKey ? { ...cp, [field]: val } : cp) }
        : c
    ));

  // ── Explode ────────────────────────────────────────────────────────────────
  const onExplode = useCallback(async () => {
    const validCards = cards.filter((c) => c.itemId);
    if (!validCards.length) return;

    setLoading(true);
    setResults([]);

    const settled = await Promise.allSettled(
      validCards.map(async (card) => {
        const itemName = allItems.find((i) => i.id === card.itemId)?.name || '';
        try {
          // If components defined and BOM is not finalized → save first
          const hasComponents = card.components.some((cp) => cp.componentItemId);
          if (hasComponents && card.bomStatus !== 'finalized') {
            const lines = card.components
              .filter((cp) => cp.componentItemId && cp.qtyPerUnit)
              .map((cp) => ({
                component_item_id: cp.componentItemId,
                quantity:          cp.qtyPerUnit,
                unit:              cp.unit,
              }));
            await bomApi.createOrUpdate({ item_id: card.itemId, lines });
          }
          // Explode
          const res = await bomApi.explode({ item_id: card.itemId, planned_qty: card.plannedQty });
          return { key: card.key, itemId: card.itemId, itemName, data: res?.data ?? res };
        } catch (err) {
          const msg = err?.response?.data?.message || 'Failed';
          return {
            key:      card.key,
            itemId:   card.itemId,
            itemName,
            noBom:    msg.toLowerCase().includes('no bom'),
            error:    msg.toLowerCase().includes('no bom') ? null : msg,
          };
        }
      })
    );

    setResults(settled.map((s) => s.value ?? s.reason));
    setLoading(false);
  }, [cards, allItems]);

  const usedItemIds = cards.map((c) => c.itemId).filter(Boolean);
  const hasValid    = cards.some((c) => c.itemId);

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Procurement</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>BOM Explosion</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>BOM Explosion</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Select finished goods, define their components (or load from saved BOM), enter planned quantities, then explode to see net material requirements.
      </Text>

      <div style={{ marginTop: 16 }}>
        {/* ── Finished Good Cards ─────────────────────────────────────────── */}
        {cards.map((card, cardIdx) => (
          <Card
            key={card.key}
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,.05)', marginBottom: 14 }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            {/* ── Card header: FG select + planned qty + remove ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>{cardIdx + 1}</Text>
                </div>
                <Text style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>Finished Good</Text>
              </div>

              <Select
                showSearch
                placeholder="Select finished good / item…"
                optionFilterProp="label"
                value={card.itemId ?? undefined}
                onChange={(val) => handleItemSelect(card.key, val)}
                options={allItems.map((i) => ({
                  value:    i.id,
                  label:    i.code ? `${i.name} (${i.code})` : i.name,
                  disabled: usedItemIds.includes(i.id) && i.id !== card.itemId,
                }))}
                style={{ flex: 1, minWidth: 240 }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Planned Qty</Text>
                <InputNumber
                  min={0.001} step={1}
                  value={card.plannedQty}
                  onChange={(val) => { updateCard(card.key, { plannedQty: val || 1 }); setResults([]); }}
                  style={{ width: 100 }}
                />
              </div>

              {card.bomStatus && (
                <Tag color={card.bomStatus === 'finalized' ? 'green' : 'orange'} style={{ marginLeft: 4 }}>
                  BOM: {card.bomStatus}
                </Tag>
              )}

              <div style={{ flex: 1 }} />

              <Tooltip title="Remove this item">
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeCard(card.key)} />
              </Tooltip>
            </div>

            {/* ── Components section ── */}
            <div style={{ background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AppstoreOutlined style={{ color: '#6b7280', fontSize: 13 }} />
                <Text style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>
                  Components (Raw Materials / Sub-parts)
                </Text>
                {card.bomStatus === 'finalized' && (
                  <Tag color="green" style={{ fontSize: 11 }}>Loaded from finalized BOM</Tag>
                )}
              </div>

              {card.loadingBom ? (
                <Skeleton active paragraph={{ rows: 2 }} style={{ padding: '4px 0' }} />
              ) : (
                <>
                  {card.components.length === 0 && (
                    <Text style={{ color: '#9ca3af', fontSize: 12, display: 'block', marginBottom: 8 }}>
                      No components yet — add the raw materials that go into this finished good.
                    </Text>
                  )}

                  {/* Component rows */}
                  {card.components.map((comp, compIdx) => (
                    <div key={comp.key}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 11, color: '#9ca3af', width: 20, textAlign: 'right' }}>
                        {compIdx + 1}
                      </Text>
                      <Select
                        showSearch
                        placeholder="Select component item…"
                        optionFilterProp="label"
                        value={comp.componentItemId ?? undefined}
                        onChange={(val) => updateComponent(card.key, comp.key, 'componentItemId', val)}
                        disabled={card.bomStatus === 'finalized'}
                        options={allItems
                          .filter((i) => i.id !== card.itemId) // can't use FG as its own component
                          .map((i) => ({ value: i.id, label: i.code ? `${i.name} (${i.code})` : i.name }))}
                        style={{ flex: 1, minWidth: 200 }}
                        size="small"
                      />
                      <Text style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Qty/unit</Text>
                      <InputNumber
                        min={0.001} step={0.5}
                        value={comp.qtyPerUnit}
                        onChange={(val) => updateComponent(card.key, comp.key, 'qtyPerUnit', val || 1)}
                        disabled={card.bomStatus === 'finalized'}
                        style={{ width: 80 }}
                        size="small"
                      />
                      <Select
                        value={comp.unit}
                        onChange={(val) => updateComponent(card.key, comp.key, 'unit', val)}
                        disabled={card.bomStatus === 'finalized'}
                        options={UNIT_OPTIONS}
                        style={{ width: 100 }}
                        size="small"
                      />
                      {card.bomStatus !== 'finalized' && (
                        <Tooltip title="Remove component">
                          <Button type="text" danger icon={<DeleteOutlined />} size="small"
                            onClick={() => removeComponent(card.key, comp.key)} />
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </>
              )}

              {card.bomStatus !== 'finalized' && (
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => addComponent(card.key)}
                  style={{ marginTop: 4, borderRadius: 6 }}
                >
                  Add Component
                </Button>
              )}
            </div>
          </Card>
        ))}

        {/* ── Bottom toolbar ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Button icon={<PlusOutlined />} onClick={addCard} style={{ borderRadius: 8, fontWeight: 600 }}>
            Add Another Item
          </Button>
          <div style={{ flex: 1 }} />
          <Button
            type="primary" size="large"
            icon={<ThunderboltOutlined />}
            onClick={onExplode}
            loading={loading}
            disabled={!hasValid}
            style={{ borderRadius: 8, fontWeight: 700, minWidth: 160 }}
          >
            Explode BOM
          </Button>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
              Saving BOMs and computing material requirements…
            </Text>
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        {!loading && results.length > 0 && (
          <>
            <Divider orientation="left" style={{ fontWeight: 700, color: '#374151', fontSize: 13 }}>
              Results — {results.length} item{results.length !== 1 ? 's' : ''}
            </Divider>

            <Space style={{ marginBottom: 14 }} wrap>
              {results.filter((r) => r.data?.has_shortage).length > 0 && (
                <Tag color="red" icon={<WarningOutlined />} style={{ fontSize: 12, padding: '2px 10px' }}>
                  {results.filter((r) => r.data?.has_shortage).length} item(s) with shortage
                </Tag>
              )}
              {results.filter((r) => r.data && !r.data.has_shortage).length > 0 && (
                <Tag color="green" icon={<CheckCircleOutlined />} style={{ fontSize: 12, padding: '2px 10px' }}>
                  {results.filter((r) => r.data && !r.data.has_shortage).length} item(s) fully stocked
                </Tag>
              )}
            </Space>

            {results.map((r) => <ResultCard key={r.key} result={r} navigate={navigate} />)}
          </>
        )}
      </div>
    </AppLayout>
  );
}
