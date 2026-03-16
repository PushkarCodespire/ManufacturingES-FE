import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography, Card, Button, Descriptions, Tag, Space, message,
  Tabs, Form, Input, InputNumber, Select, DatePicker, Radio,
  Table, Drawer, Checkbox, Popconfirm, Result, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, RightOutlined, PlusOutlined, DeleteOutlined,
  SaveOutlined, CheckCircleOutlined, EditOutlined, BulbOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout    from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { capaApi }  from '../../../api/quality.api';
import { userApi }  from '../../../api/user.api';
import useAiSuggestion  from '../../../hooks/useAiSuggestion';
import AiSuggestionCard  from '../../../components/AiSuggestion/AiSuggestionCard';
import aiApi              from '../../../api/ai.api';

const { Title, Text, Paragraph } = Typography;
const { TextArea }               = Input;

const STATUS_COLOR  = {
  open: 'orange', in_progress: 'blue', effectiveness: 'purple', closed: 'green', cancelled: 'default',
};
const ACTION_STATUS_COLOR = { open: 'orange', in_progress: 'blue', completed: 'green' };
const ACTION_STATUS_OPTS  = [
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed'   },
];
const SOURCE_LABELS = {
  customer_complaint: 'Customer Complaint', internal_audit: 'Internal Audit',
  ncr: 'NCR', warranty: 'Warranty', production_rejection: 'Production Rejection',
  supplier_rejection: 'Supplier Rejection', other: 'Other',
};
const FISHBONE_CATS = ['Man', 'Machine', 'Material', 'Method', 'Measurement', 'Mother Nature'];
const PERIOD_OPTS   = [
  { value: 30, label: '30 Days' },
  { value: 60, label: '60 Days' },
  { value: 90, label: '90 Days' },
];

let _wId = 0;
const blankWhy = (level) => ({ _id: ++_wId, why_level: level, why_question: '', why_answer: '', is_root: false });

// Parse fishbone array → { Man: [...], Machine: [...], ... }
const parseFishbone = (arr = []) =>
  FISHBONE_CATS.reduce((acc, cat) => {
    acc[cat] = (Array.isArray(arr) ? arr : []).filter((f) => f.category === cat).map((f) => f.cause);
    return acc;
  }, {});

// Flatten fishbone state → [{ category, cause }]
const flattenFishbone = (fb) =>
  FISHBONE_CATS.flatMap((cat) => (fb[cat] ?? []).map((cause) => ({ category: cat, cause })));

export default function CAPADetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { can }  = usePermissions();
  const canWrite = can('quality-capa-create_edit_delete');

  const [capa,    setCapa]    = useState(null);
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  // ── D2-D3 Containment ──────────────────────────────────────────────────────
  const [contSaving, setContSaving] = useState(false);
  const [contForm]                  = Form.useForm();

  // ── D4 Root Cause ──────────────────────────────────────────────────────────
  const [whys,       setWhys]       = useState([blankWhy(1)]);
  const [fishbone,   setFishbone]   = useState(parseFishbone([]));
  const [fbInputs,   setFbInputs]   = useState(FISHBONE_CATS.reduce((a, c) => ({ ...a, [c]: '' }), {}));
  const [d4Saving,   setD4Saving]   = useState(false);

  // ── D5-D6 Actions ─────────────────────────────────────────────────────────
  const [actions,       setActions]       = useState([]);
  const [actionDrawer,  setActionDrawer]  = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [actionType,    setActionType]    = useState('corrective');
  const [actionSaving,  setActionSaving]  = useState(false);
  const [d56Saving,     setD56Saving]     = useState(false);
  const [actionForm]                      = Form.useForm();

  // ── D7 Prevention ──────────────────────────────────────────────────────────
  const [prevText,     setPrevText]     = useState('');
  const [prevSaving,   setPrevSaving]   = useState(false);
  const [effForm]                       = Form.useForm();
  const [effSaving,    setEffSaving]    = useState(false);

  // ── D8 Closure ─────────────────────────────────────────────────────────────
  const [closureNotes, setClosureNotes] = useState('');
  const [closeSaving,  setCloseSaving]  = useState(false);

  // ── AI Hooks ──────────────────────────────────────────────────────────────
  const aiRootCause     = useAiSuggestion(aiApi.getRootCauseSuggestion);
  const aiEffectiveness = useAiSuggestion(aiApi.getEffectivenessPrediction);

  // ─────────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await capaApi.getById(id);
      setCapa(data);

      // Containment
      contForm.setFieldsValue({
        containment_action: data.containment_action,
        containment_date:   data.containment_date ? dayjs(data.containment_date) : null,
      });

      // D4
      const rawWhys = data.root_causes ?? data.d4_root_causes ?? [];
      setWhys(
        rawWhys.length
          ? rawWhys.map((w) => ({ ...w, _id: ++_wId }))
          : [blankWhy(1)],
      );
      setFishbone(parseFishbone(data.fishbone ?? data.d4_fishbone ?? []));

      // Actions
      setActions(Array.isArray(data.CAPAActions) ? data.CAPAActions : []);

      // D7
      setPrevText(data.prevention_action ?? '');

      // D8
      setClosureNotes(data.closure_notes ?? '');

    } catch { message.error('Failed to load CAPA'); }
    finally   { setLoading(false); }
  }, [id, contForm]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    userApi.getAll({ limit: 500, is_active: true }).catch(() => [])
      .then((d) => setUsers(Array.isArray(d) ? d : []));
  }, []);

  // ── D2-D3 Save ────────────────────────────────────────────────────────────
  const saveContainment = async () => {
    try {
      const vals = await contForm.validateFields();
      setContSaving(true);
      await capaApi.update(id, {
        containment_action: vals.containment_action,
        containment_date:   vals.containment_date?.format('YYYY-MM-DD'),
      });
      message.success('Containment saved');
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setContSaving(false); }
  };

  // ── D4 Helpers ─────────────────────────────────────────────────────────────
  const updateWhy = (key, field, val) =>
    setWhys((prev) => prev.map((w) => (w._id === key ? { ...w, [field]: val } : w)));

  const addWhy = () => {
    if (whys.length >= 5) { message.warning('Maximum 5 Whys'); return; }
    setWhys((prev) => [...prev, blankWhy(prev.length + 1)]);
  };

  const removeWhy = (key) => setWhys((prev) => prev.filter((w) => w._id !== key));

  const addFbCause = (cat) => {
    const txt = (fbInputs[cat] || '').trim();
    if (!txt) return;
    setFishbone((prev) => ({ ...prev, [cat]: [...(prev[cat] ?? []), txt] }));
    setFbInputs((prev) => ({ ...prev, [cat]: '' }));
  };

  const removeFbCause = (cat, idx) =>
    setFishbone((prev) => ({ ...prev, [cat]: prev[cat].filter((_, i) => i !== idx) }));

  const saveD4 = async () => {
    setD4Saving(true);
    try {
      await capaApi.updateD4(id, {
        root_causes: whys.map(({ why_level, why_question, why_answer, is_root }) => ({
          why_level, why_question, why_answer, is_root,
        })),
        fishbone: flattenFishbone(fishbone),
      });
      message.success('Root Cause Analysis saved');
    } catch (err) { message.error(err?.message || 'Save failed'); }
    finally { setD4Saving(false); }
  };

  // ── D5-D6 Helpers ──────────────────────────────────────────────────────────
  const openAddAction = (type) => {
    setActionType(type);
    setEditingAction(null);
    actionForm.resetFields();
    actionForm.setFieldsValue({ status: 'open' });
    setActionDrawer(true);
  };

  const openEditAction = (a) => {
    setEditingAction(a);
    setActionType(a.action_type);
    actionForm.setFieldsValue({
      action_desc:     a.action_desc,
      responsible_id:  a.responsible_id,
      target_date:     a.target_date ? dayjs(a.target_date) : null,
      status:          a.status,
      completed_date:  a.completed_date ? dayjs(a.completed_date) : null,
      evidence:        a.evidence,
    });
    setActionDrawer(true);
  };

  const saveActionLocal = async () => {
    try {
      const vals = await actionForm.validateFields();
      setActionSaving(true);
      const row = {
        ...(editingAction ?? {}),
        ...vals,
        action_type:    actionType,
        target_date:    vals.target_date?.format('YYYY-MM-DD'),
        completed_date: vals.completed_date?.format('YYYY-MM-DD'),
        _tempKey:       editingAction?._tempKey ?? Date.now(),
      };
      if (editingAction) {
        setActions((prev) => prev.map((a) => (a._tempKey === editingAction._tempKey || a.id === editingAction.id) ? row : a));
      } else {
        setActions((prev) => [...prev, row]);
      }
      setActionDrawer(false);
    } catch (err) {
      if (err?.errorFields) return;
      message.error('Form error');
    } finally { setActionSaving(false); }
  };

  const removeAction = (key) =>
    setActions((prev) => prev.filter((a) => a._tempKey !== key && a.id !== key));

  const saveD56 = async () => {
    setD56Saving(true);
    try {
      await capaApi.updateD5D6(id, {
        actions: actions.map(({ action_desc, responsible_id, target_date, status, completed_date, evidence, action_type }) => ({
          action_desc, responsible_id, target_date, status, completed_date, evidence, action_type,
        })),
        prevention_action: prevText,
      });
      message.success('Actions saved');
      load();
    } catch (err) { message.error(err?.message || 'Save failed'); }
    finally { setD56Saving(false); }
  };

  // ── D7 Helpers ─────────────────────────────────────────────────────────────
  const savePrevention = async () => {
    setPrevSaving(true);
    try {
      await capaApi.update(id, { prevention_action: prevText });
      message.success('Prevention action saved');
    } catch (err) { message.error(err?.message || 'Save failed'); }
    finally { setPrevSaving(false); }
  };

  const submitEffectivenessCheck = async () => {
    try {
      const vals = await effForm.validateFields();
      setEffSaving(true);
      await capaApi.addEffectiveness(id, {
        ...vals,
        check_date: vals.check_date?.format('YYYY-MM-DD'),
      });
      message.success('Effectiveness check recorded');
      effForm.resetFields();
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setEffSaving(false); }
  };

  // ── D8 Close ───────────────────────────────────────────────────────────────
  const closeCapa = async () => {
    setCloseSaving(true);
    try {
      await capaApi.update(id, { closure_notes: closureNotes });
      await capaApi.close(id);
      message.success('CAPA closed successfully');
      load();
    } catch (err) { message.error(err?.message || 'Close failed'); }
    finally { setCloseSaving(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <AppLayout><div style={{ padding: 40, color: '#6b7280' }}>Loading…</div></AppLayout>;
  if (!capa)   return <AppLayout><div style={{ padding: 40, color: '#ef4444' }}>CAPA not found.</div></AppLayout>;

  const corrective  = actions.filter((a) => a.action_type !== 'preventive');
  const preventive  = actions.filter((a) => a.action_type === 'preventive');
  const effChecks   = capa.EffectivenessChecks ?? [];
  const isClosed    = capa.status === 'closed';

  // ── Action table columns ───────────────────────────────────────────────────
  const actionCols = [
    { title: 'Description',    dataIndex: 'action_desc',   key: 'desc',   ellipsis: true },
    { title: 'Responsible',    key: 'resp', width: 130,
      render: (_, a) => a.Responsible?.name ?? users.find((u) => u.id === a.responsible_id)?.name ?? '—' },
    { title: 'Target Date',    dataIndex: 'target_date',   key: 'tgt',    width: 100 },
    { title: 'Status',         dataIndex: 'status',        key: 'status', width: 100,
      render: (v) => <Tag color={ACTION_STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Completed',      dataIndex: 'completed_date',key: 'done',   width: 100 },
    ...(canWrite ? [{
      title: '', key: 'acts', width: 80,
      render: (_, a) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditAction(a)} />
          <Button size="small" danger type="text" icon={<DeleteOutlined />}
            onClick={() => removeAction(a._tempKey ?? a.id)} />
        </Space>
      ),
    }] : []),
  ];

  // ── Effectiveness checks columns ───────────────────────────────────────────
  const effCols = [
    { title: 'Period',     dataIndex: 'check_period', key: 'period', width: 80,
      render: (v) => `${v} days` },
    { title: 'Check Date', dataIndex: 'check_date',   key: 'date',   width: 110 },
    { title: 'Effective',  dataIndex: 'is_effective', key: 'eff',    width: 90,
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Tag> },
    { title: 'Findings',   dataIndex: 'findings',     key: 'find',   ellipsis: true },
    { title: 'By',         key: 'by', width: 120,
      render: (_, r) => r.CheckedBy?.name ?? '—' },
  ];

  const tabItems = [
    // ── D0-D1 Overview ───────────────────────────────────────────────────────
    {
      key:   'd01',
      label: 'D0-D1 Overview',
      children: (
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="CAPA No.">{capa.capa_no}</Descriptions.Item>
            <Descriptions.Item label="Source">
              {SOURCE_LABELS[capa.source_type] ?? capa.source_type ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[capa.status] ?? 'default'}>{capa.status?.replace(/_/g, ' ')}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Champion">{capa.Champion?.name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Target Date">{capa.target_date ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Created By">{capa.Creator?.name ?? '—'}</Descriptions.Item>
            {capa.problem_title && (
              <Descriptions.Item label="Problem Title" span={2}>
                {capa.problem_title}
              </Descriptions.Item>
            )}
            {capa.problem_desc && (
              <Descriptions.Item label="Problem Description (5W2H)" span={2}>
                {capa.problem_desc}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      ),
    },

    // ── D2-D3 Containment ────────────────────────────────────────────────────
    {
      key:   'd23',
      label: 'D2-D3 Containment',
      children: (
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '16px 20px' }}
          title="D2-D3 — Containment Action"
          extra={canWrite && (
            <Button type="primary" icon={<SaveOutlined />} loading={contSaving} onClick={saveContainment}>
              Save Containment
            </Button>
          )}
        >
          <Form form={contForm} layout="vertical" requiredMark={false}>
            <Form.Item name="containment_action" label="Containment Action" rules={[{ required: true }]}>
              <TextArea rows={4}
                disabled={!canWrite}
                placeholder="Describe immediate containment steps taken to protect the customer..." />
            </Form.Item>
            <Form.Item name="containment_date" label="Containment Date">
              <DatePicker format="DD-MMM-YYYY" disabled={!canWrite} />
            </Form.Item>
          </Form>
        </Card>
      ),
    },

    // ── D4 Root Cause ─────────────────────────────────────────────────────────
    {
      key:   'd4',
      label: 'D4 Root Cause',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* AI Root Cause Suggestion */}
          {canWrite && (
            <div style={{ marginBottom: 0 }}>
              <Button icon={<BulbOutlined />} onClick={() => aiRootCause.fetch(id)}>
                AI Suggest Root Causes
              </Button>
            </div>
          )}
          {(aiRootCause.data || aiRootCause.loading || aiRootCause.error) && (
            <AiSuggestionCard
              title="AI Root Cause Analysis"
              loading={aiRootCause.loading}
              error={aiRootCause.error}
              aiAvailable={aiRootCause.aiAvailable}
              cached={aiRootCause.cached}
              onDismiss={() => aiRootCause.reset()}
              onRetry={() => aiRootCause.fetch(id)}
              style={{ marginBottom: 0 }}
            >
              {aiRootCause.data?.data && (() => {
                const d = aiRootCause.data.data;
                const fiveWhys = d.five_whys ?? [];
                const fishboneData = d.fishbone ?? {};
                return (
                  <>
                    {fiveWhys.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ display: 'block', marginBottom: 6 }}>5-Why Suggestions</Text>
                        {fiveWhys.map((w, i) => (
                          <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                            <Text strong>Why {i + 1}:</Text> {w.question} → <Text type="secondary">{w.answer}</Text>
                          </div>
                        ))}
                        <Button size="small" type="dashed" style={{ marginTop: 8 }}
                          onClick={() => {
                            setWhys(fiveWhys.map((w, i) => ({
                              _id: ++_wId,
                              why_level: i + 1,
                              why_question: w.question,
                              why_answer: w.answer,
                              is_root: i === fiveWhys.length - 1,
                            })));
                            message.success('AI 5-Why suggestions applied');
                          }}>
                          Apply 5-Why
                        </Button>
                      </div>
                    )}
                    {Object.keys(fishboneData).length > 0 && (
                      <div>
                        <Text strong style={{ display: 'block', marginBottom: 6 }}>Fishbone Suggestions</Text>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          {Object.entries(fishboneData).map(([cat, causes]) => (
                            <div key={cat} style={{ fontSize: 12 }}>
                              <Text strong>{cat}:</Text>
                              {(Array.isArray(causes) ? causes : []).map((c, i) => (
                                <div key={i} style={{ paddingLeft: 8, color: '#6b7280' }}>• {c}</div>
                              ))}
                            </div>
                          ))}
                        </div>
                        <Button size="small" type="dashed" style={{ marginTop: 8 }}
                          onClick={() => {
                            const newFb = {};
                            Object.entries(fishboneData).forEach(([cat, causes]) => {
                              newFb[cat] = Array.isArray(causes) ? causes : [];
                            });
                            setFishbone((prev) => {
                              const merged = { ...prev };
                              Object.entries(newFb).forEach(([cat, causes]) => {
                                merged[cat] = [...new Set([...(merged[cat] ?? []), ...causes])];
                              });
                              return merged;
                            });
                            message.success('AI fishbone suggestions merged');
                          }}>
                          Merge Fishbone
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </AiSuggestionCard>
          )}

          {/* 5-Why */}
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
            title="5-Why Analysis"
            extra={canWrite && (
              <Space>
                <Button onClick={addWhy} icon={<PlusOutlined />} disabled={whys.length >= 5}>Add Why</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={d4Saving} onClick={saveD4}>
                  Save Root Cause
                </Button>
              </Space>
            )}
          >
            <Table
              rowKey="_id"
              dataSource={whys}
              size="small"
              pagination={false}
              columns={[
                { title: 'Level', dataIndex: 'why_level', key: 'lvl', width: 60 },
                { title: 'Why Question', key: 'q', width: 220,
                  render: (_, w) => (
                    <Input size="small" value={w.why_question} disabled={!canWrite}
                      placeholder="Ask the next why..."
                      onChange={(e) => updateWhy(w._id, 'why_question', e.target.value)} />
                  )},
                { title: 'Answer / Finding', key: 'a',
                  render: (_, w) => (
                    <Input size="small" value={w.why_answer} disabled={!canWrite}
                      placeholder="Answer..."
                      onChange={(e) => updateWhy(w._id, 'why_answer', e.target.value)} />
                  )},
                { title: 'Root?', key: 'root', width: 70,
                  render: (_, w) => (
                    <Checkbox checked={w.is_root} disabled={!canWrite}
                      onChange={(e) => updateWhy(w._id, 'is_root', e.target.checked)} />
                  )},
                ...(canWrite ? [{
                  title: '', key: 'del', width: 40,
                  render: (_, w) => (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}
                      onClick={() => removeWhy(w._id)} disabled={whys.length <= 1} />
                  ),
                }] : []),
              ]}
            />
          </Card>

          {/* Fishbone */}
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
            title="Fishbone (Ishikawa) Diagram — Cause Categories"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {FISHBONE_CATS.map((cat) => (
                <div key={cat} style={{ border: '1px solid #e8eaed', borderRadius: 8, padding: '10px 12px' }}>
                  <Text strong style={{ display: 'block', marginBottom: 8, color: '#1d4ed8' }}>{cat}</Text>
                  {(fishbone[cat] ?? []).map((cause, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, flex: 1 }}>{cause}</Text>
                      {canWrite && (
                        <Button size="small" type="text" danger icon={<DeleteOutlined />}
                          onClick={() => removeFbCause(cat, i)} />
                      )}
                    </div>
                  ))}
                  {canWrite && (
                    <Input.Search
                      size="small"
                      value={fbInputs[cat]}
                      placeholder="Add cause..."
                      enterButton={<PlusOutlined />}
                      onChange={(e) => setFbInputs((p) => ({ ...p, [cat]: e.target.value }))}
                      onSearch={() => addFbCause(cat)}
                      onPressEnter={() => addFbCause(cat)}
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </Space>
      ),
    },

    // ── D5-D6 Actions ─────────────────────────────────────────────────────────
    {
      key:   'd56',
      label: 'D5-D6 Actions',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* AI Effectiveness Prediction */}
          {canWrite && (
            <div style={{ marginBottom: 0 }}>
              <Button icon={<BulbOutlined />} onClick={() => aiEffectiveness.fetch(id)}>
                Predict Effectiveness
              </Button>
            </div>
          )}
          {(aiEffectiveness.data || aiEffectiveness.loading || aiEffectiveness.error) && (
            <AiSuggestionCard
              title="Effectiveness Prediction"
              loading={aiEffectiveness.loading}
              error={aiEffectiveness.error}
              aiAvailable={aiEffectiveness.aiAvailable}
              cached={aiEffectiveness.cached}
              onDismiss={() => aiEffectiveness.reset()}
              onRetry={() => aiEffectiveness.fetch(id)}
              style={{ marginBottom: 0 }}
            >
              {aiEffectiveness.data?.data && (() => {
                const d = aiEffectiveness.data.data;
                return (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>Confidence: </Text>
                      <Tag color={d.confidence >= 0.7 ? 'green' : d.confidence >= 0.4 ? 'orange' : 'red'}>
                        {Math.round((d.confidence ?? 0) * 100)}%
                      </Tag>
                    </div>
                    {d.reasoning && <div style={{ marginBottom: 8 }}><Text strong>Reasoning: </Text><Text type="secondary">{d.reasoning}</Text></div>}
                    {d.recommendations?.length > 0 && (
                      <div>
                        <Text strong>Recommendations:</Text>
                        {d.recommendations.map((r, i) => (
                          <div key={i} style={{ paddingLeft: 12, color: '#6b7280', fontSize: 12 }}>• {r}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </AiSuggestionCard>
          )}

          {/* Corrective actions */}
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
            title={`D5 — Corrective Actions (${corrective.length})`}
            extra={canWrite && (
              <Space>
                <Button icon={<PlusOutlined />} onClick={() => openAddAction('corrective')}>Add Corrective Action</Button>
              </Space>
            )}
          >
            <Table rowKey={(a) => a._tempKey ?? a.id} dataSource={corrective}
              columns={actionCols} size="small" pagination={false}
              locale={{ emptyText: 'No corrective actions yet' }} />
          </Card>

          {/* Preventive actions */}
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
            title={`D6 — Preventive Actions (${preventive.length})`}
            extra={canWrite && (
              <Button icon={<PlusOutlined />} onClick={() => openAddAction('preventive')}>Add Preventive Action</Button>
            )}
          >
            <Table rowKey={(a) => a._tempKey ?? a.id} dataSource={preventive}
              columns={actionCols} size="small" pagination={false}
              locale={{ emptyText: 'No preventive actions yet' }} />
          </Card>

          {canWrite && (
            <Button type="primary" icon={<SaveOutlined />} loading={d56Saving} onClick={saveD56}>
              Save All Actions
            </Button>
          )}
        </Space>
      ),
    },

    // ── D7 Prevention & Effectiveness ─────────────────────────────────────────
    {
      key:   'd7',
      label: 'D7 Prevention',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* Prevention action text */}
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
            title="D7 — Prevention Action (Systemize the Fix)"
            extra={canWrite && (
              <Button type="primary" icon={<SaveOutlined />} loading={prevSaving} onClick={savePrevention}>
                Save Prevention
              </Button>
            )}
          >
            <TextArea
              rows={4}
              value={prevText}
              disabled={!canWrite}
              placeholder="How will this fix be implemented company-wide to prevent recurrence in similar processes?"
              onChange={(e) => setPrevText(e.target.value)}
            />
          </Card>

          {/* Effectiveness checks */}
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
            title={`Effectiveness Checks (${effChecks.length})`}
          >
            <Table rowKey="id" dataSource={effChecks} columns={effCols} size="small"
              pagination={false} locale={{ emptyText: 'No checks recorded yet' }} />

            {canWrite && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#f8faff', borderRadius: 8, border: '1px solid #e0e7ff' }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>Add Effectiveness Check</Text>
                <Form form={effForm} layout="inline" requiredMark={false}>
                  <Form.Item name="check_period" label="Period" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                    <Select options={PERIOD_OPTS} placeholder="Select" style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item name="check_date" label="Check Date" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                    <DatePicker format="DD-MMM-YYYY" />
                  </Form.Item>
                  <Form.Item name="is_effective" label="Effective?" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                    <Radio.Group>
                      <Radio value={true}>Yes</Radio>
                      <Radio value={false}>No</Radio>
                    </Radio.Group>
                  </Form.Item>
                  <Form.Item name="findings" label="Findings" style={{ marginBottom: 8 }}>
                    <Input placeholder="Findings / observations..." style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 8 }}>
                    <Button type="primary" loading={effSaving} onClick={submitEffectivenessCheck}>
                      Submit Check
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            )}
          </Card>
        </Space>
      ),
    },

    // ── D8 Closure ────────────────────────────────────────────────────────────
    {
      key:   'd8',
      label: 'D8 Closure',
      children: (
        isClosed ? (
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Result
              status="success"
              title="CAPA Closed Successfully"
              subTitle={`Closed on ${capa.closed_at ? dayjs(capa.closed_at).format('DD-MMM-YYYY') : '—'} by ${capa.ClosedBy?.name ?? '—'}`}
              extra={capa.closure_notes && (
                <div style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto' }}>
                  <Text strong>Closure Notes:</Text>
                  <Paragraph style={{ marginTop: 8 }}>{capa.closure_notes}</Paragraph>
                </div>
              )}
            />
          </Card>
        ) : (
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}
            title="D8 — Congratulate the Team & Close CAPA"
          >
            {!canWrite ? (
              <Alert type="info" showIcon message="You do not have permission to close this CAPA." />
            ) : (
              <>
                <Alert
                  type="warning"
                  showIcon
                  message="Closing is permanent. Ensure all D1–D7 steps are verified before closing."
                  style={{ marginBottom: 16 }}
                />
                <Form layout="vertical">
                  <Form.Item label="Closure Notes">
                    <TextArea
                      rows={4}
                      value={closureNotes}
                      onChange={(e) => setClosureNotes(e.target.value)}
                      placeholder="Summarize lessons learned, team acknowledgments, documents updated..."
                    />
                  </Form.Item>
                </Form>
                <Popconfirm
                  title="Close this CAPA?"
                  description="This action is permanent and cannot be undone."
                  onConfirm={closeCapa}
                  okText="Yes, Close CAPA"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger type="primary" icon={<CheckCircleOutlined />} loading={closeSaving}>
                    Close CAPA
                  </Button>
                </Popconfirm>
              </>
            )}
          </Card>
        )
      ),
    },
  ];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={() => navigate('/quality/capa')}>
          CAPA / 8D
        </Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{capa.capa_no}</Text>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quality/capa')}>Back</Button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Title level={3} style={{ margin: 0 }}>{capa.capa_no}</Title>
            <Tag color={STATUS_COLOR[capa.status] ?? 'default'} style={{ fontSize: 13 }}>
              {capa.status?.replace(/_/g, ' ')}
            </Tag>
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {SOURCE_LABELS[capa.source_type] ?? capa.source_type}
          </Text>
        </div>
      </div>

      {/* 8D Tabs */}
      <Tabs items={tabItems} defaultActiveKey="d01" />

      {/* Action Drawer */}
      <Drawer
        title={`${editingAction ? 'Edit' : 'Add'} ${actionType === 'preventive' ? 'Preventive' : 'Corrective'} Action`}
        width={480}
        open={actionDrawer}
        onClose={() => setActionDrawer(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setActionDrawer(false)}>Cancel</Button>
            <Button type="primary" loading={actionSaving} onClick={saveActionLocal}>
              {editingAction ? 'Save Changes' : 'Add Action'}
            </Button>
          </div>
        }
      >
        <Form form={actionForm} layout="vertical" requiredMark={false}>
          <Form.Item name="action_desc" label="Action Description" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Describe the action to be taken..." />
          </Form.Item>

          <Form.Item name="responsible_id" label="Responsible Person">
            <Select
              showSearch allowClear placeholder="Assign to..."
              filterOption={(i, o) => o?.label?.toLowerCase().includes(i.toLowerCase())}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="target_date" label="Target Date">
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="completed_date" label="Completed Date">
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </div>

          <Form.Item name="status" label="Status">
            <Select options={ACTION_STATUS_OPTS} placeholder="Select status" />
          </Form.Item>

          <Form.Item name="evidence" label="Evidence / Verification">
            <TextArea rows={2} placeholder="How was this action verified as complete?" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
