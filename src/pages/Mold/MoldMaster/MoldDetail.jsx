import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Card, Row, Col, Tabs,
  Descriptions, Tag, Modal, message, Progress, Tooltip, Popconfirm, Upload,
  InputNumber, Checkbox, Badge, Spin, Switch,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, ReloadOutlined, RightOutlined,
  DeleteOutlined, UploadOutlined, QrcodeOutlined, ToolOutlined,
  CheckCircleOutlined, StopOutlined, SwapOutlined,
DownloadOutlined, } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { moldMasterApi, moldCavityApi, moldShotCountApi, moldLifeApi } from '../../../api/mold.api';
import { itemApi } from '../../../api/item.api';
import { machineApi } from '../../../api/machine.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { exportToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const STATUS_COLOR = {
  registered: 'blue', trial_pending: 'orange', production_ready: 'green',
  in_production: 'cyan', in_storage: 'default', repair_needed: 'red',
  in_repair: 'volcano', end_of_life: 'magenta', decommissioned: 'default',
};
const LIFE_STAGE_COLOR = {
  normal: 'green', plan_replacement: 'gold', urgent_replacement: 'orange',
  critical: 'red', end_of_life: 'magenta', extended_life: 'purple',
};
const CAVITY_STATUS_COLOR = { active: 'green', blocked: 'red', flagged: 'orange', under_repair: 'blue', trial_pending: 'purple' };

// Valid status transitions — only show allowed next states
const VALID_TRANSITIONS = {
  registered:       ['trial_pending', 'in_storage'],
  trial_pending:    ['production_ready', 'repair_needed'],
  production_ready: ['in_production', 'in_storage'],
  in_production:    ['production_ready', 'in_storage', 'repair_needed'],
  in_storage:       ['in_production', 'production_ready', 'repair_needed'],
  repair_needed:    ['in_repair'],
  in_repair:        ['production_ready', 'in_storage', 'end_of_life'],
  end_of_life:      ['decommissioned'],
  decommissioned:   [],
};

const fmtLabel = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '\u2014';
const fmtDate = (iso) => iso ? dayjs(iso).format('DD MMM YYYY') : '\u2014';
const fmtDateTime = (iso) => iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '\u2014';

const MoldDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canWrite = can('mold-master-create_edit_delete');
  const canWriteCavity = can('mold-cavities-create_edit_delete');

  const [mold, setMold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('parts');

  // Parts tab
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [partForm] = Form.useForm();

  // Machines tab
  const [machineModalOpen, setMachineModalOpen] = useState(false);
  const [machines, setMachines] = useState([]);
  const [machineForm] = Form.useForm();

  // Documents tab
  const [docUploading, setDocUploading] = useState(false);
  const [docType, setDocType] = useState('manual');

  // Cavities tab
  const [cavities, setCavities] = useState([]);
  const [cavityLoading, setCavityLoading] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockCavityId, setBlockCavityId] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  // Shot history tab
  const [shotHistory, setShotHistory] = useState([]);
  const [shotLoading, setShotLoading] = useState(false);
  const [shotPage, setShotPage] = useState(1);
  const [shotTotal, setShotTotal] = useState(0);

  // Life config tab
  const [lifeConfig, setLifeConfig] = useState(null);
  const [lifeForm] = Form.useForm();
  const [lifeSaving, setLifeSaving] = useState(false);

  // Change status modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusForm] = Form.useForm();

  const fetchMold = useCallback(async () => {
    setLoading(true);
    try {
      const data = await moldMasterApi.getById(id);
      setMold(data);
    } catch (err) { message.error(err?.message || 'Failed to load mold details'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchMold(); }, [fetchMold]);

  // Fetch cavities
  const fetchCavities = useCallback(async () => {
    setCavityLoading(true);
    try { const res = await moldCavityApi.getCavities(id); setCavities(res?.data ?? res ?? []); }
    catch { /* ignore */ }
    finally { setCavityLoading(false); }
  }, [id]);

  // Fetch shot history
  const fetchShotHistory = useCallback(async () => {
    setShotLoading(true);
    try {
      const res = await moldShotCountApi.getShotHistory(id, { page: shotPage, pageSize: 20 });
      // backend: { success, data: { rows, total, page, pageSize } }
      const payload = res?.data ?? res;
      setShotHistory(Array.isArray(payload) ? payload : (payload?.rows ?? []));
      setShotTotal(payload?.total ?? (Array.isArray(payload) ? payload.length : 0));
    } catch { /* ignore */ }
    finally { setShotLoading(false); }
  }, [id, shotPage]);

  // Fetch life config
  const fetchLifeConfig = useCallback(async () => {
    try {
      const res = await moldLifeApi.getLifeStatus(id);
      setLifeConfig(res);
      // Sequelize returns association as 'LifeConfig' (PascalCase alias)
      const cfg = res?.LifeConfig ?? res?.life_config;
      if (cfg) {
        lifeForm.setFieldsValue({
          threshold_70:  cfg.threshold_70  ?? 70,
          threshold_85:  cfg.threshold_85  ?? 85,
          threshold_95:  cfg.threshold_95  ?? 95,
          threshold_100: cfg.threshold_100 ?? 100,
          action_at_100: cfg.action_at_100 ?? 'soft_warning',
        });
      }
    } catch { /* ignore */ }
  }, [id, lifeForm]);

  // Fetch items and machines for modals
  useEffect(() => {
    (async () => {
      try { const res = await itemApi.getAll({ pageSize: 9999 }); setItems(res?.data ?? res ?? []); } catch {}
    })();
    (async () => {
      try { const res = await machineApi.getAll({ pageSize: 9999 }); setMachines(res?.data ?? res ?? []); } catch {}
    })();
  }, []);

  useEffect(() => { if (activeTab === 'cavities') fetchCavities(); }, [activeTab, fetchCavities]);
  useEffect(() => { if (activeTab === 'shots') fetchShotHistory(); }, [activeTab, fetchShotHistory]);
  useEffect(() => { if (activeTab === 'life') fetchLifeConfig(); }, [activeTab, fetchLifeConfig]);

  // Handlers
  const handleAddPart = async () => {
    try {
      const values = await partForm.validateFields();
      await moldMasterApi.addPartMapping(id, values);
      message.success('Part mapping added');
      setPartModalOpen(false);
      partForm.resetFields();
      fetchMold();
    } catch (err) { if (!err?.errorFields) message.error(err?.message || 'Failed to add part mapping'); }
  };

  const handleRemovePart = async (mapId) => {
    try { await moldMasterApi.removePartMapping(id, mapId); message.success('Part mapping removed'); fetchMold(); }
    catch (err) { message.error(err?.message || 'Failed to remove part mapping'); }
  };

  const handleAddMachine = async () => {
    try {
      const values = await machineForm.validateFields();
      await moldMasterApi.addMachineCompat(id, values);
      message.success('Machine compatibility added');
      setMachineModalOpen(false);
      machineForm.resetFields();
      fetchMold();
    } catch (err) { if (!err?.errorFields) message.error(err?.message || 'Failed to add machine compatibility'); }
  };

  const handleBlockCavity = async () => {
    try {
      await moldCavityApi.blockCavity(id, blockCavityId, { reason: blockReason });
      message.success('Cavity blocked');
      setBlockModalOpen(false);
      setBlockReason('');
      fetchCavities();
      fetchMold();
    } catch (err) { message.error(err?.message || 'Failed to block cavity'); }
  };

  const handleUnblockCavity = async (cavId) => {
    try {
      await moldCavityApi.unblockCavity(id, cavId, {});
      message.success('Cavity unblocked');
      fetchCavities();
      fetchMold();
    } catch (err) { message.error(err?.message || 'Failed to unblock cavity'); }
  };

  const handleChangeStatus = async () => {
    try {
      const values = await statusForm.validateFields();
      setStatusChanging(true);
      await moldMasterApi.update(id, {
        status: values.status,
        ...(values.notes ? { notes: values.notes } : {}),
      });
      message.success(`Status changed to ${fmtLabel(values.status)}`);
      setStatusModalOpen(false);
      statusForm.resetFields();
      fetchMold();
    } catch (err) {
      if (!err?.errorFields) message.error(err?.message || 'Failed to change status');
    } finally {
      setStatusChanging(false);
    }
  };

  const handleSaveLifeConfig = async () => {
    try {
      const values = await lifeForm.validateFields();
      setLifeSaving(true);
      await moldLifeApi.updateLifeConfig(id, values);
      message.success('Life configuration updated');
      fetchLifeConfig();
    } catch (err) { if (!err?.errorFields) message.error(err?.message || 'Failed to update life config'); }
    finally { setLifeSaving(false); }
  };

  const handleUploadDoc = async (info) => {
    const formData = new FormData();
    formData.append('file', info.file);
    formData.append('document_type', docType);
    setDocUploading(true);
    try {
      const res = await moldMasterApi.uploadDocument(id, formData);
      // Ant Design Upload requires calling onSuccess to mark the file as done
      info.onSuccess(res, info.file);
      message.success(`"${info.file.name}" uploaded successfully`);
      fetchMold();
    } catch (err) {
      info.onError(err);
      message.error(err?.message ?? 'Failed to upload document');
    } finally {
      setDocUploading(false);
    }
  };

  if (loading) return <AppLayout><div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div></AppLayout>;
  if (!mold) return <AppLayout><div style={{ textAlign: 'center', padding: 80 }}><Text type="secondary">Mold not found</Text></div></AppLayout>;

  const currentShots = mold.current_shot_count ?? 0;
  const expectedLife = mold.expected_life_shots ?? 1;
  const lifePct = expectedLife > 0 ? Math.round((currentShots / expectedLife) * 100) : 0;
  const totalCavities = mold.total_cavities ?? 0;
  const activeCavities = mold.active_cavities ?? totalCavities;

  // Tab items
  const tabItems = [
    { key: 'parts', label: 'Parts', children: (
      <>
        {canWrite && <Button type="primary" icon={<PlusOutlined />} size="small" style={{ marginBottom: 12, borderRadius: 8 }} onClick={() => setPartModalOpen(true)}>Add Part Mapping</Button>}
        <Table rowKey="id" size="small" dataSource={mold.PartMappings ?? mold.part_mappings ?? []} pagination={false} scroll={{ x: 800 }}
          columns={[
            { title: 'Item Code', key: 'item_code', render: (_, r) => { const itm = r.Item ?? r.item; return <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{itm?.item_code ?? itm?.code ?? r.item_code ?? '\u2014'}</Text>; } },
            { title: 'Item Name', key: 'item_name', render: (_, r) => (r.Item ?? r.item)?.name ?? '\u2014' },
            { title: 'Cavities', dataIndex: 'cavities_for_part', key: 'cavities_for_part', width: 80 },
            { title: 'Primary', dataIndex: 'is_primary', key: 'is_primary', width: 80, render: (v) => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
            ...(canWrite ? [{ title: 'Actions', key: 'actions', width: 80, render: (_, r) => <Popconfirm title="Remove this mapping?" onConfirm={() => handleRemovePart(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm> }] : []),
          ]}
        />
      </>
    )},
    { key: 'machines', label: 'Machines', children: (
      <>
        {canWrite && <Button type="primary" icon={<PlusOutlined />} size="small" style={{ marginBottom: 12, borderRadius: 8 }} onClick={() => setMachineModalOpen(true)}>Add Machine Compat</Button>}
        <Table rowKey="id" size="small" dataSource={mold.MachineCompats ?? mold.machine_compatibilities ?? []} pagination={false} scroll={{ x: 800 }}
          columns={[
            { title: 'Machine', key: 'machine', render: (_, r) => (r.Machine ?? r.machine)?.name ?? '\u2014' },
            { title: 'Status', dataIndex: 'compatibility_status', key: 'status', render: (v) => <Tag color={v === 'verified' ? 'green' : v === 'incompatible' ? 'red' : 'orange'}>{fmtLabel(v)}</Tag> },
            { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true },
            { title: 'Verified By', dataIndex: 'verified_by', key: 'verified_by' },
            { title: 'Verified Date', dataIndex: 'verified_date', key: 'verified_date', render: (v) => fmtDate(v) },
          ]}
        />
      </>
    )},
    { key: 'cavities', label: 'Cavities', children: (
      <>
        {canWriteCavity && <Button type="primary" icon={<PlusOutlined />} size="small" style={{ marginBottom: 12, borderRadius: 8 }}
          onClick={() => { Modal.confirm({ title: 'Add Cavity', content: (<Form id="addCavForm"><Form.Item label="Cavity Number" name="cavity_number"><InputNumber min={1} /></Form.Item><Form.Item label="Position" name="position"><Input /></Form.Item></Form>), onOk: async () => { try { await moldCavityApi.createCavity(id, { cavity_number: 1, position: 'A1' }); message.success('Cavity added'); fetchCavities(); fetchMold(); } catch (err) { message.error(err?.message || 'Failed'); } } }); }}>Add Cavity</Button>}
        <Table rowKey="id" size="small" dataSource={cavities} loading={cavityLoading} pagination={false} scroll={{ x: 800 }}
          columns={[
            { title: '#', dataIndex: 'cavity_number', key: 'cavity_number', width: 60 },
            { title: 'Position', dataIndex: 'position', key: 'position', width: 100 },
            { title: 'Status', dataIndex: 'status', key: 'status', width: 120, render: (v) => <Tag color={CAVITY_STATUS_COLOR[v] ?? 'default'}>{fmtLabel(v)}</Tag> },
            { title: 'Block Reason', dataIndex: 'block_reason', key: 'block_reason', ellipsis: true },
            { title: 'Block Date', dataIndex: 'block_date', key: 'block_date', render: (v) => fmtDate(v) },
            ...(canWriteCavity ? [{ title: 'Actions', key: 'actions', width: 160, render: (_, r) => (
              <div style={{ display: 'flex', gap: 4 }}>
                {r.status !== 'blocked' ? <Button size="small" danger icon={<StopOutlined />} onClick={() => { setBlockCavityId(r.id); setBlockModalOpen(true); }}>Block</Button>
                  : <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#16a34a', borderColor: '#16a34a' }} onClick={() => handleUnblockCavity(r.id)}>Unblock</Button>}
              </div>
            )}] : []),
          ]}
        />
      </>
    )},
    { key: 'documents', label: 'Documents', children: (
      <>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Select
              size="small"
              value={docType}
              onChange={setDocType}
              style={{ width: 160 }}
              options={[
                { label: 'Drawing',     value: 'drawing' },
                { label: '3D Model',    value: '3d_model' },
                { label: 'Manual',      value: 'manual' },
                { label: 'Photo',       value: 'photo' },
                { label: 'Certificate', value: 'certificate' },
              ]}
            />
            <Upload
              showUploadList={false}
              customRequest={handleUploadDoc}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
              disabled={docUploading}
            >
              <Button
                icon={<UploadOutlined />}
                size="small"
                loading={docUploading}
                style={{ borderRadius: 8 }}
              >
                {docUploading ? 'Uploading…' : 'Upload Document'}
              </Button>
            </Upload>
          </div>
        )}
        <Table rowKey="id" size="small" dataSource={mold.Documents ?? mold.documents ?? []} pagination={false} scroll={{ x: 800 }}
          columns={[
            { title: 'Type',      dataIndex: 'document_type', key: 'type',      width: 150, render: (v) => fmtLabel(v ?? 'general') },
            { title: 'File Name', dataIndex: 'file_name',     key: 'file_name', ellipsis: true },
            { title: 'Download',  dataIndex: 'file_url',      key: 'file_url',  width: 110,
              render: (v, r) => v
                ? <a href={v.startsWith('http') ? v : `${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:5000'}${v}`} target="_blank" rel="noreferrer">
                    {r.file_name?.endsWith('.pdf') ? '📄' : r.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? '🖼️' : '📎'} Download
                  </a>
                : '\u2014' },
          ]}
        />
      </>
    )},
    { key: 'shots', label: 'Shot History', children: (
      <Table rowKey="id" size="small" dataSource={shotHistory} loading={shotLoading} scroll={{ x: 800 }}
        pagination={{ current: shotPage, pageSize: 20, total: shotTotal, onChange: (p) => setShotPage(p), showTotal: (t) => `${t} records`, style: { marginBottom: 0 } }}
        columns={[
          { title: 'Date', dataIndex: 'logged_at', key: 'logged_at', render: (v) => fmtDateTime(v) },
          { title: 'Shots This Run', dataIndex: 'shots_this_run', key: 'shots_this_run', render: (v) => (v ?? 0).toLocaleString() },
          { title: 'Cumulative', dataIndex: 'cumulative_total', key: 'cumulative_total', render: (v) => (v ?? 0).toLocaleString() },
          { title: 'OK Qty', dataIndex: 'ok_qty', key: 'ok_qty', render: (v) => (v ?? 0).toLocaleString() },
          { title: 'Reject Qty', dataIndex: 'reject_qty', key: 'reject_qty', render: (v) => v > 0 ? <Text type="danger">{v.toLocaleString()}</Text> : '0' },
          { title: 'Machine', key: 'machine', render: (_, r) => r.machine?.name ?? r.machine_name ?? '\u2014' },
          { title: 'Job Card', key: 'job_card', render: (_, r) => r.job_card?.code ?? r.job_card_code ?? '\u2014' },
        ]}
      />
    )},
    { key: 'life', label: 'Life Config', children: (
      <Card size="small" style={{ maxWidth: 500 }}>
        <Form form={lifeForm} layout="vertical">
          <Form.Item name="threshold_70" label="Plan Replacement Threshold (%)"><InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="70" /></Form.Item>
          <Form.Item name="threshold_85" label="Urgent Replacement Threshold (%)"><InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="85" /></Form.Item>
          <Form.Item name="threshold_95" label="Critical Threshold (%)"><InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="95" /></Form.Item>
          <Form.Item name="threshold_100" label="End of Life Threshold (%)"><InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="100" /></Form.Item>
          <Form.Item name="action_at_100" label="Action at 100%">
            <Select placeholder="Select action" options={[{ label: 'Hard Block (block issuance)', value: 'hard_block' }, { label: 'Soft Warning (allow with warning)', value: 'soft_warning' }]} />
          </Form.Item>
          {canWrite && <Button type="primary" loading={lifeSaving} onClick={handleSaveLifeConfig} style={{ borderRadius: 8 }}>Save Configuration</Button>}
        </Form>
      </Card>
    )},
  ];

  const progressColor = lifePct < 70 ? '#52c41a' : lifePct < 85 ? '#faad14' : lifePct < 95 ? '#fa8c16' : '#f5222d';

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={() => navigate('/mold/master')}>Mold Master</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>{mold.mold_code}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/mold/master')} style={{ borderRadius: 8 }} />
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>{mold.name}</Title>
          <Tag color={STATUS_COLOR[mold.status] ?? 'default'} style={{ borderRadius: 20 }}>{fmtLabel(mold.status)}</Tag>
          {mold.life_stage && <Tag color={LIFE_STAGE_COLOR[mold.life_stage] ?? 'default'} style={{ borderRadius: 20 }}>{fmtLabel(mold.life_stage)}</Tag>}
          {canWrite && (VALID_TRANSITIONS[mold.status]?.length ?? 0) > 0 && (
            <Button
              size="small"
              icon={<SwapOutlined />}
              onClick={() => { statusForm.resetFields(); setStatusModalOpen(true); }}
              style={{ borderRadius: 8, marginLeft: 4 }}
            >
              Change Status
            </Button>
          )}
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { label: 'Current Shots', value: currentShots.toLocaleString(), color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Expected Life', value: expectedLife.toLocaleString(), color: '#6b7280', bg: '#f9fafb' },
          { label: 'Life %', value: `${lifePct}%`, color: progressColor, bg: lifePct < 70 ? '#f0fdf4' : lifePct < 85 ? '#fffbeb' : '#fef2f2' },
          { label: 'Active Cavities', value: `${activeCavities} / ${totalCavities}`, color: '#7c3aed', bg: '#f5f3ff' },
        ].map((s) => (
          <Col xs={12} sm={6} key={s.label}>
            <Card size="small" style={{ border: `1px solid ${s.color}30`, borderRadius: 10, background: s.bg, textAlign: 'center' }}>
              <Text style={{ color: s.color, fontWeight: 700, fontSize: 22, display: 'block' }}>{s.value}</Text>
              <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, marginBottom: 20 }} bodyStyle={{ padding: '16px 20px' }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" bordered>
          <Descriptions.Item label="Mold Code"><Text style={{ fontFamily: 'monospace' }}>{mold.mold_code}</Text></Descriptions.Item>
          <Descriptions.Item label="Category">{(mold.Category ?? mold.category)?.name ?? '\u2014'}</Descriptions.Item>
          <Descriptions.Item label="Serial No">{mold.serial_no ?? '\u2014'}</Descriptions.Item>
          <Descriptions.Item label="Manufacturer">{mold.manufacturer ?? '\u2014'}</Descriptions.Item>
          <Descriptions.Item label="Material">{mold.material ?? '\u2014'}</Descriptions.Item>
          <Descriptions.Item label="Weight">{mold.weight_kg ? `${mold.weight_kg} kg` : '\u2014'}</Descriptions.Item>
          <Descriptions.Item label="Tonnage">{mold.tonnage_req ?? '\u2014'}</Descriptions.Item>
          <Descriptions.Item label="Platen Size">{mold.platen_size ?? '\u2014'}</Descriptions.Item>
          <Descriptions.Item label="Tie Bar Spacing">{mold.tie_bar_spacing ?? '\u2014'}</Descriptions.Item>
          <Descriptions.Item label="Owner Type">{fmtLabel(mold.owner_type)}</Descriptions.Item>
          <Descriptions.Item label="Storage Location">{(mold.StorageLocation ?? mold.storage_location)?.name ?? '\u2014'}</Descriptions.Item>
          <Descriptions.Item label="Installation Date">{fmtDate(mold.installation_date)}</Descriptions.Item>
          <Descriptions.Item label="Notes" span={3}>{mold.notes ?? '\u2014'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {(mold.qr_code || (mold.QrRegistry ?? mold.qr_registry)?.qr_code_data) && (
        <Card size="small" style={{ border: '1px solid #e8eaed', borderRadius: 12, marginBottom: 20, maxWidth: 300 }}>
          <div style={{ textAlign: 'center' }}>
            <QrcodeOutlined style={{ fontSize: 24, color: '#1d4ed8', marginBottom: 8 }} />
            <div><Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{mold.qr_code ?? (mold.QrRegistry ?? mold.qr_registry)?.qr_code_data}</Text></div>
          </div>
        </Card>
      )}

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: '8px 16px' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      {/* Add Part Modal */}
      <Modal title="Add Part Mapping" open={partModalOpen} onCancel={() => { setPartModalOpen(false); partForm.resetFields(); }} onOk={handleAddPart} okText="Add">
        <Form form={partForm} layout="vertical">
          <Form.Item name="item_id" label="Item" rules={[{ required: true, message: 'Select an item' }]}>
            <Select placeholder="Select item" showSearch optionFilterProp="label"
              options={items.map((i) => ({ label: `${i.code ?? i.item_code} - ${i.name}`, value: i.id }))} />
          </Form.Item>
          <Form.Item name="cavities_for_part" label="Cavities for Part" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_primary" valuePropName="checked" label="Primary Mapping">
            <Checkbox />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Machine Compat Modal */}
      <Modal title="Add Machine Compatibility" open={machineModalOpen} onCancel={() => { setMachineModalOpen(false); machineForm.resetFields(); }} onOk={handleAddMachine} okText="Add">
        <Form form={machineForm} layout="vertical">
          <Form.Item name="machine_id" label="Machine" rules={[{ required: true, message: 'Select a machine' }]}>
            <Select placeholder="Select machine" showSearch optionFilterProp="label"
              options={machines.map((m) => ({ label: m.name, value: m.id }))} />
          </Form.Item>
          <Form.Item name="compatibility_status" label="Status" initialValue="pending">
            <Select options={[{ label: 'Pending', value: 'pending' }, { label: 'Verified', value: 'verified' }, { label: 'Incompatible', value: 'incompatible' }]} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Block Cavity Modal */}
      <Modal title="Block Cavity" open={blockModalOpen} onCancel={() => { setBlockModalOpen(false); setBlockReason(''); }} onOk={handleBlockCavity} okText="Block" okButtonProps={{ danger: true }}>
        <Form layout="vertical">
          <Form.Item label="Reason for Blocking" required>
            <Input.TextArea rows={3} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Enter reason for blocking this cavity" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Change Status Modal */}
      <Modal
        title={<span><SwapOutlined style={{ marginRight: 8, color: '#1d4ed8' }} />Change Mold Status</span>}
        open={statusModalOpen}
        onCancel={() => { setStatusModalOpen(false); statusForm.resetFields(); }}
        onOk={handleChangeStatus}
        confirmLoading={statusChanging}
        okText="Change Status"
        width={460}
      >
        <Form form={statusForm} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e8eaed' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Current Status</Text>
            <div style={{ marginTop: 4 }}>
              <Tag color={STATUS_COLOR[mold?.status] ?? 'default'} style={{ borderRadius: 20, fontSize: 13, padding: '2px 10px' }}>
                {fmtLabel(mold?.status)}
              </Tag>
            </div>
          </div>
          <Form.Item
            name="status"
            label="New Status"
            rules={[{ required: true, message: 'Please select a new status' }]}
          >
            <Select
              placeholder="Select new status…"
              size="large"
              optionLabelProp="label"
            >
              {(VALID_TRANSITIONS[mold?.status] ?? []).map((s) => (
                <Select.Option key={s} value={s} label={fmtLabel(s)}>
                  <Tag color={STATUS_COLOR[s] ?? 'default'} style={{ borderRadius: 20, marginRight: 8 }}>{fmtLabel(s)}</Tag>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Reason / Notes (optional)">
            <Input.TextArea rows={3} placeholder="e.g. Trial run completed, approved for production…" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
};

export default MoldDetailPage;
