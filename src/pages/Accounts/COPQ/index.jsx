import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Button, Input, Table, Tag, Space, Drawer, Form, Select, DatePicker, InputNumber, message, Popconfirm, Row, Col, Statistic, Divider } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, RightOutlined, WarningOutlined, DollarOutlined, BulbOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import { copqEntryApi } from '../../../api/accounts.api';
import { itemApi } from '../../../api/item.api';
import { userApi } from '../../../api/user.api';
import aiApi from '../../../api/ai.api';
import useAiSuggestion from '../../../hooks/useAiSuggestion';
import AiSuggestionCard from '../../../components/AiSuggestion/AiSuggestionCard';

const parseInsight = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object' && !raw.raw_text) return raw;
  const text = raw.raw_text ?? raw;
  if (typeof text !== 'string') return raw;

  // 1. Try to extract JSON from within a fenced code block (handles trailing content after ```)
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      // Capture any trailing text after the closing ``` as a note
      const closingIdx = text.indexOf('```', text.indexOf(fenced[1]) + fenced[1].length);
      const after = closingIdx >= 0 ? text.slice(closingIdx + 3).trim() : '';
      if (after) parsed._note = after.replace(/\*\*/g, ''); // strip markdown bold
      return parsed;
    } catch {}
  }

  // 2. Try stripping fences from start only (closing ``` may be mid-string)
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```[\s\S]*$/, '').trim();
  try { return JSON.parse(stripped); } catch {}

  // 3. Try parsing directly
  try { return JSON.parse(text.trim()); } catch {}

  return null; // give up — nothing to show
};

const { Title, Text } = Typography;

const CATEGORIES = [
  { value: 'scrap',            label: 'Scrap',           color: 'red' },
  { value: 'rework',           label: 'Rework',          color: 'orange' },
  { value: 'customer_return',  label: 'Customer Return', color: 'volcano' },
  { value: 'containment',      label: 'Containment',     color: 'purple' },
  { value: 'warranty',         label: 'Warranty',        color: 'magenta' },
];
const REF_TYPES = [
  { value: 'scrap_voucher',      label: 'Scrap Voucher' },
  { value: 'job_card',           label: 'Job Card' },
  { value: 'customer_complaint', label: 'Customer Complaint' },
  { value: 'manual',            label: 'Manual Entry' },
];

const catColor = (c) => CATEGORIES.find((x) => x.value === c)?.color || 'default';

const COPQPage = () => {
  const [rows, setRows]             = useState([]);
  const [items, setItems]           = useState([]);
  const [departments, setDepartments] = useState([]);
  const [summary, setSummary]       = useState({ byCategory: [], byMonth: [] });
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form] = Form.useForm();

  // AI narrative state
  const aiNarrative = useAiSuggestion(aiApi.getCopqAiNarrative);
  const [aiNarrativeFrom, setAiNarrativeFrom] = useState(dayjs().startOf('month'));
  const [aiNarrativeTo, setAiNarrativeTo] = useState(dayjs());
  const [aiNarrativeVisible, setAiNarrativeVisible] = useState(false);

  const fetchAiNarrative = () => {
    setAiNarrativeVisible(true);
    aiNarrative.fetch({
      from: aiNarrativeFrom.format('YYYY-MM-DD'),
      to:   aiNarrativeTo.format('YYYY-MM-DD'),
    });
  };

  const currentMonth = dayjs().format('YYYY-MM');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)    params.search   = search;
      if (catFilter) params.category = catFilter;
      const data = await copqEntryApi.getAll(params);
      setRows(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load COPQ entries'); }
    finally { setLoading(false); }
  }, [search, catFilter]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await copqEntryApi.getSummary({});
      if (data) setSummary(data);
    } catch { /* summary is optional */ }
  }, []);

  useEffect(() => { load(); loadSummary(); }, [load, loadSummary]);

  useEffect(() => {
    itemApi.getAll({ limit: 500 }).catch(() => ({})).then((v) => {
      const arr = Array.isArray(v) ? v : (v?.data ?? []);
      setItems(arr);
    });
    userApi.getDepartments().catch(() => []).then((v) => {
      const arr = Array.isArray(v) ? v : (v?.data ?? []);
      setDepartments(arr);
    });
  }, []);

  const openAdd = () => {
    setEditing(null); form.resetFields();
    form.setFieldsValue({ entry_date: dayjs(), category: 'scrap' });
    setDrawerOpen(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      category:      r.category,
      item_id:       r.item_id,
      department_id: r.department_id,
      ref_type:      r.ref_type,
      ref_no:        r.ref_no,
      entry_date:    r.entry_date ? dayjs(r.entry_date) : null,
      cost_amount:   r.cost_amount,
      qty:           r.qty,
      description:   r.description,
    });
    setDrawerOpen(true);
  };

  const onSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        category:      vals.category,
        item_id:       vals.item_id || null,
        department_id: vals.department_id || null,
        ref_type:      vals.ref_type || null,
        ref_no:        vals.ref_no || null,
        entry_date:    vals.entry_date?.format('YYYY-MM-DD'),
        cost_amount:   vals.cost_amount || 0,
        qty:           vals.qty || 0,
        description:   vals.description || '',
      };
      if (editing) { await copqEntryApi.update(editing.id, payload); message.success('Entry updated'); }
      else         { await copqEntryApi.create(payload); message.success('Entry created'); }
      setDrawerOpen(false); load(); loadSummary();
    } catch (err) { if (err?.errorFields) return; message.error(err?.message || err?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const onDelete = async (id) => {
    try { await copqEntryApi.delete(id); message.success('Entry deleted'); load(); loadSummary(); }
    catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // Summary stats
  const getCatTotal = (cat) => {
    const found = summary.byCategory?.find((s) => s.category === cat);
    return found ? parseFloat(found.total_cost) : 0;
  };
  const grandTotal = summary.byCategory?.reduce((s, r) => s + parseFloat(r.total_cost || 0), 0) || 0;

  const columns = [
    { title: 'Entry No', dataIndex: 'entry_no', key: 'entry_no', width: 150,
      render: (v, r) => <Text style={{ color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(r)}>{v}</Text>,
    },
    { title: 'Date', dataIndex: 'entry_date', key: 'entry_date', width: 110,
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    { title: 'Category', dataIndex: 'category', key: 'category', width: 130,
      render: (c) => <Tag color={catColor(c)}>{CATEGORIES.find((x) => x.value === c)?.label || c}</Tag>,
    },
    { title: 'Item', key: 'item', width: 160,
      render: (_, r) => r.Item ? <Text style={{ fontSize: 13 }}>{r.Item.name}</Text> : <Text type="secondary">—</Text>,
    },
    { title: 'Dept', key: 'dept', width: 120,
      render: (_, r) => r.Department ? <Tag>{r.Department.name}</Tag> : '—',
    },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 80, align: 'right',
      render: (v) => v ? parseFloat(v).toLocaleString() : '—',
    },
    { title: 'Cost (₹)', dataIndex: 'cost_amount', key: 'cost_amount', width: 120, align: 'right',
      render: (v) => <Text strong style={{ color: '#dc2626' }}>{v ? `₹${parseFloat(v).toLocaleString('en-IN')}` : '—'}</Text>,
    },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Delete?" onConfirm={() => onDelete(r.id)} okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Accounts</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>COPQ</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Cost of Poor Quality (COPQ)</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Track and analyze quality costs: scrap, rework, returns, containment, and warranty.</Text>

      {/* Summary cards */}
      <Row gutter={[16, 16]} style={{ marginTop: 16, marginBottom: 20 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #dc2626' }}>
            <Statistic title="Scrap" value={getCatTotal('scrap')} prefix="₹" precision={0} valueStyle={{ fontSize: 18, color: '#dc2626' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #d97706' }}>
            <Statistic title="Rework" value={getCatTotal('rework')} prefix="₹" precision={0} valueStyle={{ fontSize: 18, color: '#d97706' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #ea580c' }}>
            <Statistic title="Returns" value={getCatTotal('customer_return')} prefix="₹" precision={0} valueStyle={{ fontSize: 18, color: '#ea580c' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #7c3aed' }}>
            <Statistic title="Containment" value={getCatTotal('containment')} prefix="₹" precision={0} valueStyle={{ fontSize: 18, color: '#7c3aed' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #be185d' }}>
            <Statistic title="Warranty" value={getCatTotal('warranty')} prefix="₹" precision={0} valueStyle={{ fontSize: 18, color: '#be185d' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #111827', background: '#f9fafb' }}>
            <Statistic title="Total COPQ" value={grandTotal} prefix="₹" precision={0} valueStyle={{ fontSize: 18, fontWeight: 700 }} />
          </Card>
        </Col>
      </Row>

      {/* Entries table */}
      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Input placeholder="Search entry, ref, desc..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260, borderRadius: 8 }} allowClear />
          <Select placeholder="Category" allowClear value={catFilter} onChange={setCatFilter}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} style={{ width: 160 }} />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={() => { load(); loadSummary(); }}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>New Entry</Button>
        </div>

        {/* AI Narrative panel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <BulbOutlined style={{ color: '#7c3aed', fontSize: 15 }} />
          <Text style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>AI Narrative</Text>
          <DatePicker
            size="small"
            value={aiNarrativeFrom}
            onChange={(v) => v && setAiNarrativeFrom(v)}
            format="DD MMM YYYY"
            placeholder="From"
            style={{ width: 130 }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>to</Text>
          <DatePicker
            size="small"
            value={aiNarrativeTo}
            onChange={(v) => v && setAiNarrativeTo(v)}
            format="DD MMM YYYY"
            placeholder="To"
            style={{ width: 130 }}
          />
          <Button
            size="small"
            icon={<BulbOutlined />}
            style={{ color: '#7c3aed', borderColor: '#7c3aed' }}
            loading={aiNarrative.loading}
            onClick={fetchAiNarrative}
          >
            Generate Narrative
          </Button>
          {aiNarrativeVisible && (
            <Button
              size="small"
              type="text"
              onClick={() => { setAiNarrativeVisible(false); aiNarrative.reset(); }}
            >
              Hide
            </Button>
          )}
        </div>

        {aiNarrativeVisible && (
          <AiSuggestionCard
            loading={aiNarrative.loading}
            error={aiNarrative.error}
            aiAvailable={aiNarrative.aiAvailable}
            cached={aiNarrative.cached}
            onRetry={fetchAiNarrative}
            onDismiss={() => { setAiNarrativeVisible(false); aiNarrative.reset(); }}
          >
            {(() => {
              const d = aiNarrative.data;
              if (!d) return null;
              const insight = parseInsight(d.ai_insight);
              if (!insight) return null;
              return (
                <div style={{ fontSize: 13 }}>
                  {/* Period + context */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {d.period && (
                      <Tag color="blue">
                        {typeof d.period === 'object'
                          ? `${d.period.from || ''} — ${d.period.to || ''}`
                          : String(d.period)}
                      </Tag>
                    )}
                    {d.total_cost != null && (
                      <Tag color="red">Total COPQ: ₹{parseFloat(d.total_cost).toLocaleString('en-IN')}</Tag>
                    )}
                    {d.top_category && <Tag color="orange">Top: {String(d.top_category)}</Tag>}
                    {insight.confidence && <Tag color="geekblue">Confidence: {insight.confidence}</Tag>}
                  </div>

                  {/* Executive summary */}
                  {insight.executive_summary && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 12, color: '#374151' }}>Executive Summary</Text>
                      <div style={{
                        marginTop: 4, padding: '8px 12px',
                        background: '#f8fafc', border: '1px solid #e2e8f0',
                        borderRadius: 6, fontSize: 12, lineHeight: 1.6, color: '#374151',
                      }}>
                        {insight.executive_summary}
                      </div>
                    </div>
                  )}

                  {/* Benchmarking */}
                  {insight.benchmarking_insight && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 12, color: '#374151' }}>Benchmarking</Text>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#4b5563' }}>
                        {insight.benchmarking_insight}
                      </div>
                    </div>
                  )}

                  <Divider style={{ margin: '10px 0' }} />

                  {/* Key findings */}
                  {Array.isArray(insight.key_findings) && insight.key_findings.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 12, color: '#374151' }}>Key Findings</Text>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {insight.key_findings.map((item, i) => (
                          <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Cost drivers */}
                  {Array.isArray(insight.cost_drivers) && insight.cost_drivers.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 12, color: '#374151' }}>Cost Drivers</Text>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {insight.cost_drivers.map((item, i) => (
                          <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improvement opportunities */}
                  {Array.isArray(insight.improvement_opportunities) && insight.improvement_opportunities.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 12, color: '#374151' }}>Improvement Opportunities</Text>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {insight.improvement_opportunities.map((item, i) => (
                          <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Priority actions */}
                  {Array.isArray(insight.priority_actions) && insight.priority_actions.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 12, color: '#374151' }}>Priority Actions</Text>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {insight.priority_actions.map((item, i) => (
                          <li key={i} style={{ fontSize: 12, color: '#4b5563', marginBottom: 2 }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {insight._note && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, fontSize: 11, color: '#92400e', fontStyle: 'italic' }}>
                      {insight._note}
                    </div>
                  )}
                </div>
              );
            })()}
          </AiSuggestionCard>
        )}

        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} size="small" scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }} />
      </Card>

      <Drawer title={editing ? `Edit — ${editing.entry_no}` : 'New COPQ Entry'} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={540}
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={onSave}>{editing ? 'Update' : 'Create'}</Button>
        </div>}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="entry_date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="item_id" label="Item">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select item"
                  options={items.map((i) => ({ value: i.id, label: `${i.name}${i.code ? ` (${i.code})` : ''}` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department_id" label="Department">
                <Select showSearch optionFilterProp="label" allowClear placeholder="Select department"
                  options={departments.map((d) => ({ value: d.id, label: d.name }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cost_amount" label="Cost Amount (₹)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="qty" label="Quantity">
                <InputNumber style={{ width: '100%' }} min={0} precision={3} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="ref_type" label="Reference Type"><Select allowClear options={REF_TYPES} /></Form.Item></Col>
            <Col span={12}><Form.Item name="ref_no" label="Reference No"><Input placeholder="Scrap voucher no, etc." /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="Description"><Input.TextArea rows={3} placeholder="Describe the quality cost..." /></Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
};

export default COPQPage;
