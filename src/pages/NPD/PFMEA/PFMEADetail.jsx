import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography, Card, Button, Descriptions, Tag, Space, message,
  Table, Drawer, Form, Input, InputNumber, Select, DatePicker, Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined, RightOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  BulbOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { pfmeaApi }   from '../../../api/quality.api';
import { userApi }    from '../../../api/user.api';
import useAiSuggestion  from '../../../hooks/useAiSuggestion';
import AiSuggestionCard  from '../../../components/AiSuggestion/AiSuggestionCard';
import aiApi              from '../../../api/ai.api';
import { exportToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const STATUS_COLOR        = { draft: 'default', active: 'green', under_review: 'blue', obsolete: 'red' };
const ACTION_STATUS_COLOR = { open: 'orange', in_progress: 'blue', completed: 'green' };
const ACTION_STATUS_OPTS  = [
  { value: 'open',        label: 'Open'        },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed'   },
];

const calcAP  = (s, o, d) => (s || 0) * (o || 0) * (d || 0);
const apColor = (ap)       => ap >= 100 ? 'red' : ap >= 50 ? 'orange' : 'green';

export default function PFMEADetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { can }  = usePermissions();
  const canWrite = can('npd-pfmea-create_edit_delete');

  const [pfmea,         setPfmea]         = useState(null);
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(true);

  // AI failure mode suggestion
  const aiFailureMode = useAiSuggestion(aiApi.getFailureModeSuggestion);

  // Item (process step) drawer
  const [itemDrawer,  setItemDrawer]  = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemSaving,  setItemSaving]  = useState(false);
  const [itemForm]                    = Form.useForm();

  // Action drawer
  const [actionDrawer,  setActionDrawer]  = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [curItemId,     setCurItemId]     = useState(null);
  const [actionSaving,  setActionSaving]  = useState(false);
  const [actionForm]                      = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pfmeaApi.getById(id);
      setPfmea(data);
    } catch (err) { message.error(err?.message || 'Failed to load PFMEA'); }
    finally   { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    userApi.getAll({ limit: 500, is_active: true }).catch(() => [])
      .then((d) => setUsers(Array.isArray(d) ? d : []));
  }, []);

  // ── Item helpers ───────────────────────────────────────────────────────────
  const openAddItem = () => {
    setEditingItem(null);
    itemForm.resetFields();
    itemForm.setFieldsValue({ severity: 5, occurrence: 5, detection: 5 });
    setItemDrawer(true);
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    itemForm.setFieldsValue({
      process_step:     item.process_step,
      process_function: item.process_function,
      failure_mode:     item.failure_mode,
      failure_effect:   item.failure_effect,
      failure_cause:    item.failure_cause,
      severity:         item.severity,
      occurrence:       item.occurrence,
      detection:        item.detection,
      current_controls: item.current_controls,
    });
    setItemDrawer(true);
  };

  const saveItem = async () => {
    try {
      const vals = await itemForm.validateFields();
      setItemSaving(true);
      if (editingItem) {
        await pfmeaApi.updateItem(id, editingItem.id, vals);
        message.success('Process step updated');
      } else {
        await pfmeaApi.addItem(id, vals);
        message.success('Process step added');
      }
      setItemDrawer(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setItemSaving(false); }
  };

  const deleteItem = async (itemId) => {
    try {
      await pfmeaApi.deleteItem(id, itemId);
      message.success('Process step deleted');
      load();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Action helpers ─────────────────────────────────────────────────────────
  const openAddAction = (itemId) => {
    setCurItemId(itemId);
    setEditingAction(null);
    actionForm.resetFields();
    actionForm.setFieldsValue({ status: 'open' });
    setActionDrawer(true);
  };

  const openEditAction = (itemId, action) => {
    setCurItemId(itemId);
    setEditingAction(action);
    actionForm.setFieldsValue({
      action_desc:      action.action_desc,
      responsible_id:   action.responsible_id,
      target_date:      action.target_date ? dayjs(action.target_date) : null,
      severity_after:   action.severity_after,
      occurrence_after: action.occurrence_after,
      detection_after:  action.detection_after,
      status:           action.status,
      evidence:         action.evidence,
    });
    setActionDrawer(true);
  };

  const saveAction = async () => {
    try {
      const vals = await actionForm.validateFields();
      setActionSaving(true);
      const payload = { ...vals, target_date: vals.target_date?.format('YYYY-MM-DD') };
      if (editingAction) {
        await pfmeaApi.updateAction(id, curItemId, editingAction.id, payload);
        message.success('Action updated');
      } else {
        await pfmeaApi.addAction(id, curItemId, payload);
        message.success('Action added');
      }
      setActionDrawer(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Save failed');
    } finally { setActionSaving(false); }
  };

  // ── Expandable row (actions) ───────────────────────────────────────────────
  const expandedRowRender = (item) => {
    const actions = item.Actions ?? item.PfmeaActions ?? [];
    const cols = [
      { title: 'Action Description', dataIndex: 'action_desc',  key: 'desc',  ellipsis: true },
      { title: 'Responsible', key: 'resp', width: 130,
        render: (_, a) => a.Responsible?.name ?? '—' },
      { title: 'Target Date', dataIndex: 'target_date', key: 'tgt', width: 100 },
      { title: 'S / O / D (after)', key: 'sod', width: 120,
        render: (_, a) => a.severity_after
          ? `${a.severity_after}/${a.occurrence_after}/${a.detection_after}`
          : '—' },
      { title: 'AP (after)', key: 'ap', width: 90,
        render: (_, a) => {
          if (!a.severity_after) return '—';
          const ap = calcAP(a.severity_after, a.occurrence_after, a.detection_after);
          return <Tag color={apColor(ap)}>{ap}</Tag>;
        }},
      { title: 'Status', dataIndex: 'status', key: 'status', width: 110,
        render: (v) => <Tag color={ACTION_STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
      ...(canWrite ? [{
        title: '', key: 'edit', width: 60,
        render: (_, a) => (
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditAction(item.id, a)} />
        ),
      }] : []),
    ];

    return (
      <div style={{ padding: '8px 16px', background: '#fafafa', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13 }}>Corrective Actions ({actions.length})</Text>
          {canWrite && (
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => openAddAction(item.id)}>
              Add Action
            </Button>
          )}
        </div>
        <Table
          rowKey="id"
          dataSource={actions}
          columns={cols}
          size="small"
          pagination={false}
          scroll={{ x: 800 }}
          locale={{ emptyText: 'No actions yet — click "Add Action"' }}
        />
      </div>
    );
  };

  // ── Process step columns ───────────────────────────────────────────────────
  const itemCols = [
    { title: 'Process Step',  dataIndex: 'process_step',  key: 'step',   width: 150, ellipsis: true },
    { title: 'Failure Mode',  dataIndex: 'failure_mode',  key: 'mode',   width: 170, ellipsis: true },
    { title: 'Effect',        dataIndex: 'failure_effect',key: 'effect', ellipsis: true },
    { title: 'S / O / D', key: 'sod', width: 90,
      render: (_, r) => `${r.severity ?? '?'}/${r.occurrence ?? '?'}/${r.detection ?? '?'}` },
    { title: 'AP', key: 'ap', width: 80,
      render: (_, r) => {
        const ap = calcAP(r.severity, r.occurrence, r.detection);
        return ap > 0 ? <Tag color={apColor(ap)}>{ap}</Tag> : '—';
      }},
    { title: 'Controls', dataIndex: 'current_controls', key: 'ctrl', width: 130, ellipsis: true },
    { title: 'Actions', key: 'acts_cnt', width: 70,
      render: (_, r) => <Tag color="blue">{(r.Actions ?? r.PfmeaActions)?.length ?? 0}</Tag> },
    ...(canWrite ? [{
      title: '', key: 'acts', width: 90,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditItem(r)} />
          <Popconfirm title="Delete this process step?" onConfirm={() => deleteItem(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  if (loading) return <AppLayout><div style={{ padding: 40, color: '#6b7280' }}>Loading…</div></AppLayout>;
  if (!pfmea)  return <AppLayout><div style={{ padding: 40, color: '#ef4444' }}>PFMEA not found.</div></AppLayout>;

  const items = pfmea.Items ?? pfmea.PfmeaItems ?? [];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>NPD</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={() => navigate('/quality/pfmea')}>
          PFMEA
        </Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{pfmea.pfmea_no}</Text>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quality/pfmea')}>Back</Button>
        <div>
          <Title level={3} style={{ margin: 0 }}>{pfmea.pfmea_no} — {pfmea.title}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Process FMEA (AIAG-VDA)</Text>
        </div>
      </div>

      {/* Card 1 — PFMEA Info */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
        bodyStyle={{ padding: '16px 20px' }}
        title="PFMEA Header"
      >
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="PFMEA No.">{pfmea.pfmea_no}</Descriptions.Item>
          <Descriptions.Item label="Title">{pfmea.title}</Descriptions.Item>
          <Descriptions.Item label="Process Name">{pfmea.process_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Part / Item">
            {pfmea.Item ? `${pfmea.Item.part_no} — ${pfmea.Item.name}` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Revision">{pfmea.revision || '—'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={STATUS_COLOR[pfmea.status] ?? 'default'}>{pfmea.status?.replace(/_/g, ' ')}</Tag>
          </Descriptions.Item>
          {pfmea.scope && (
            <Descriptions.Item label="Scope" span={2}>{pfmea.scope}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* AI Failure Mode Suggestions */}
      {canWrite && (
        <div style={{ marginBottom: 16 }}>
          <Button icon={<BulbOutlined />} onClick={() => aiFailureMode.fetch(id)}>
            AI Suggest Failure Modes
          </Button>
        </div>
      )}
      {(aiFailureMode.data || aiFailureMode.loading || aiFailureMode.error) && (
        <AiSuggestionCard
          title="AI Failure Mode Suggestions"
          loading={aiFailureMode.loading}
          error={aiFailureMode.error}
          aiAvailable={aiFailureMode.aiAvailable}
          cached={aiFailureMode.cached}
          onDismiss={() => aiFailureMode.reset()}
          onRetry={() => aiFailureMode.fetch(id)}
          style={{ marginBottom: 16 }}
        >
          {aiFailureMode.data?.data?.suggestions && (
            <div>
              {aiFailureMode.data.data.suggestions.map((s, i) => (
                <div key={i} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 13 }}>
                    <Text strong>Mode: </Text>{s.failure_mode}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Effect: {s.failure_effect} | Cause: {s.failure_cause}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    S: {s.severity} / O: {s.occurrence} / D: {s.detection} | Controls: {s.current_controls}
                  </div>
                  {canWrite && (
                    <Button size="small" type="dashed" style={{ marginTop: 4 }}
                      onClick={() => {
                        itemForm.setFieldsValue({
                          process_step: s.process_step ?? '',
                          failure_mode: s.failure_mode,
                          failure_effect: s.failure_effect,
                          failure_cause: s.failure_cause,
                          severity: s.severity ?? 5,
                          occurrence: s.occurrence ?? 5,
                          detection: s.detection ?? 5,
                          current_controls: s.current_controls ?? '',
                        });
                        setEditingItem(null);
                        setItemDrawer(true);
                        message.success('Suggestion loaded into form');
                      }}>
                      Use This
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </AiSuggestionCard>
      )}

      {/* Card 2 — Process Steps */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
        title={`Process Steps / Failure Modes (${items.length})`}
        extra={canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddItem}>Add Process Step</Button>
        )}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Tag color="red">AP ≥ 100 — High</Tag>
          <Tag color="orange">AP 50–99 — Medium</Tag>
          <Tag color="green">AP &lt; 50 — Low</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>— AP = S × O × D  |  Click ▶ to expand actions</Text>
        </div>

        <Table
          rowKey="id"
          dataSource={items}
          columns={itemCols}
          size="small"
          expandable={{ expandedRowRender }}
          pagination={false}
          scroll={{ x: 800 }}
          locale={{ emptyText: canWrite ? 'No steps — click "Add Process Step"' : 'No steps defined' }}
        />
      </Card>

      {/* ── Process Step Drawer ───────────────────────────────────────────────── */}
      <Drawer
        title={editingItem ? `Edit — ${editingItem.process_step}` : 'Add Process Step'}
        width={560}
        open={itemDrawer}
        onClose={() => setItemDrawer(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setItemDrawer(false)}>Cancel</Button>
            <Button type="primary" loading={itemSaving} onClick={saveItem}>
              {editingItem ? 'Save Changes' : 'Add Step'}
            </Button>
          </div>
        }
      >
        <Form form={itemForm} layout="vertical" requiredMark={false}>
          <Form.Item name="process_step" label="Process Step" rules={[{ required: true }]}>
            <Input placeholder="e.g. Welding, Machining, Final Assembly" />
          </Form.Item>

          <Form.Item name="process_function" label="Process Function">
            <TextArea rows={2} placeholder="What is this step supposed to achieve?" />
          </Form.Item>

          <Form.Item name="failure_mode" label="Failure Mode" rules={[{ required: true }]}>
            <TextArea rows={2} placeholder="How could this process step fail?" />
          </Form.Item>

          <Form.Item name="failure_effect" label="Effect of Failure" rules={[{ required: true }]}>
            <TextArea rows={2} placeholder="Impact on customer / downstream process?" />
          </Form.Item>

          <Form.Item name="failure_cause" label="Potential Cause(s)">
            <TextArea rows={2} placeholder="Root causes of this failure mode..." />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="severity" label="Severity (S)" rules={[{ required: true }]}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="occurrence" label="Occurrence (O)" rules={[{ required: true }]}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="detection" label="Detection (D)" rules={[{ required: true }]}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="current_controls" label="Current Process Controls">
            <TextArea rows={2} placeholder="Controls preventing or detecting this failure..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Action Drawer ─────────────────────────────────────────────────────── */}
      <Drawer
        title={editingAction ? 'Edit Action' : 'Add Corrective Action'}
        width={480}
        open={actionDrawer}
        onClose={() => setActionDrawer(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setActionDrawer(false)}>Cancel</Button>
            <Button type="primary" loading={actionSaving} onClick={saveAction}>
              {editingAction ? 'Save Changes' : 'Add Action'}
            </Button>
          </div>
        }
      >
        <Form form={actionForm} layout="vertical" requiredMark={false}>
          <Form.Item name="action_desc" label="Action Description" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Describe the corrective or preventive action..." />
          </Form.Item>

          <Form.Item name="responsible_id" label="Responsible Person">
            <Select
              showSearch allowClear placeholder="Assign to..."
              filterOption={(i, o) => o?.label?.toLowerCase().includes(i.toLowerCase())}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>

          <Form.Item name="target_date" label="Target Date">
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="severity_after" label="S (after)">
              <InputNumber min={1} max={10} style={{ width: '100%' }} placeholder="1–10" />
            </Form.Item>
            <Form.Item name="occurrence_after" label="O (after)">
              <InputNumber min={1} max={10} style={{ width: '100%' }} placeholder="1–10" />
            </Form.Item>
            <Form.Item name="detection_after" label="D (after)">
              <InputNumber min={1} max={10} style={{ width: '100%' }} placeholder="1–10" />
            </Form.Item>
          </div>

          <Form.Item name="status" label="Action Status">
            <Select options={ACTION_STATUS_OPTS} placeholder="Select status" />
          </Form.Item>

          <Form.Item name="evidence" label="Evidence / Notes">
            <TextArea rows={2} placeholder="Evidence that the action was completed..." />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
