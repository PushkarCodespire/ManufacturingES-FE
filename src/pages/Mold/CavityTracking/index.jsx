import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Card, Row, Col, Tag,
  Modal, message, InputNumber, Spin, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, RightOutlined,
  StopOutlined, CheckCircleOutlined, AppstoreOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import { moldMasterApi, moldCavityApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

const { Title, Text } = Typography;

const CAVITY_STATUS_COLOR = {
  active: '#52c41a', blocked: '#f5222d', flagged: '#fa8c16',
  under_repair: '#1890ff', trial_pending: '#722ed1',
};
const CAVITY_TAG_COLOR = {
  active: 'green', blocked: 'red', flagged: 'orange',
  under_repair: 'blue', trial_pending: 'purple',
};
const fmtLabel = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '\u2014';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';

// ── CSV Upload config ────────────────────────────────────────────────────────
const CAVITY_CSV_HEADERS = ['Cavity Number', 'Position'];
const CAVITY_CSV_SAMPLE = [
  { 'Cavity Number': '1', 'Position': 'A1' },
  { 'Cavity Number': '2', 'Position': 'A2' },
];
const CAVITY_VALIDATION_RULES = [
  { field: 'Cavity Number', required: true },
];

const CavityTrackingPage = () => {
  const { can } = usePermissions();
  const canWrite = can('mold-cavities-create_edit_delete');

  const [molds, setMolds] = useState([]);
  const [selectedMoldId, setSelectedMoldId] = useState(undefined);
  const [selectedMold, setSelectedMold] = useState(null);
  const [cavities, setCavities] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cavLoading, setCavLoading] = useState(false);

  // Block modal
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockCavityId, setBlockCavityId] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  // Add cavity modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Fetch all molds for dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await moldMasterApi.getAll({ pageSize: 9999 });
        setMolds(res?.data ?? res ?? []);
      } catch (err) { message.error(err?.message || 'Failed to load molds'); }
    })();
  }, []);

  // Fetch cavities and heatmap when mold selected
  const fetchCavityData = useCallback(async () => {
    if (!selectedMoldId) return;
    setCavLoading(true);
    try {
      const [cavRes, hmRes, moldRes] = await Promise.all([
        moldCavityApi.getCavities(selectedMoldId),
        moldCavityApi.getHeatmap(selectedMoldId).catch(() => null),
        moldMasterApi.getById(selectedMoldId),
      ]);
      setCavities(cavRes?.data ?? cavRes ?? []);
      setHeatmap(hmRes?.data ?? hmRes ?? []);
      setSelectedMold(moldRes);
    } catch (err) { message.error(err?.message || 'Failed to load cavity data'); }
    finally { setCavLoading(false); }
  }, [selectedMoldId]);

  useEffect(() => { fetchCavityData(); }, [fetchCavityData]);

  const handleBlock = async () => {
    if (!blockReason.trim()) { message.warning('Please provide a reason'); return; }
    try {
      await moldCavityApi.blockCavity(selectedMoldId, blockCavityId, { reason: blockReason });
      message.success('Cavity blocked');
      setBlockModalOpen(false); setBlockReason(''); setBlockCavityId(null);
      fetchCavityData();
    } catch (err) { message.error(err?.message || 'Failed to block cavity'); }
  };

  const handleUnblock = async (cavId) => {
    try {
      await moldCavityApi.unblockCavity(selectedMoldId, cavId, {});
      message.success('Cavity unblocked');
      fetchCavityData();
    } catch (err) { message.error(err?.message || 'Failed to unblock cavity'); }
  };

  const handleAddCavity = async () => {
    try {
      const values = await addForm.validateFields();
      await moldCavityApi.createCavity(selectedMoldId, values);
      message.success('Cavity added');
      setAddModalOpen(false); addForm.resetFields();
      fetchCavityData();
    } catch (err) { if (!err?.errorFields) message.error(err?.message || 'Failed to add cavity'); }
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    if (!selectedMoldId) { return { success: 0, failed: rows.length, errors: ['Select a mold first'] }; }
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        await moldCavityApi.createCavity(selectedMoldId, {
          cavity_number: parseInt(row['Cavity Number'], 10),
          position: row['Position'] || null,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Cavity ${row['Cavity Number']}: ${err?.message || 'Failed'}`);
      }
    }
    fetchCavityData();
    return { success, failed, errors };
  };

  const cavityColumns = [
    { title: '#', dataIndex: 'cavity_number', key: 'cavity_number', width: 60 },
    { title: 'Position', dataIndex: 'position', key: 'position', width: 100 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => <Tag color={CAVITY_TAG_COLOR[v] ?? 'default'}>{fmtLabel(v)}</Tag> },
    { title: 'Block Reason', dataIndex: 'block_reason', key: 'block_reason', ellipsis: true },
    { title: 'Block Date', dataIndex: 'block_date', key: 'block_date', width: 120, render: (v) => fmtDate(v) },
    ...(canWrite ? [{ title: 'Actions', key: 'actions', width: 160,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {r.status !== 'blocked'
            ? <Button size="small" danger icon={<StopOutlined />} onClick={() => { setBlockCavityId(r.id); setBlockModalOpen(true); }}>Block</Button>
            : <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#16a34a', borderColor: '#16a34a' }} onClick={() => handleUnblock(r.id)}>Unblock</Button>}
        </div>
      ) }] : []),
  ];

  // Build heatmap grid from cavity data (fallback to cavities array if heatmap API returns empty)
  const heatmapData = (heatmap.length > 0 ? heatmap : cavities).map((c) => ({
    id: c.id, number: c.cavity_number ?? c.number, position: c.position,
    status: c.status ?? 'active',
  }));

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Mold</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Cavity Tracking</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Cavity Tracking</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Monitor and manage individual mold cavities, block/unblock as needed.</Text>
      </div>

      {/* Mold selector */}
      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, marginBottom: 20 }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text strong style={{ fontSize: 13 }}>Select Mold:</Text>
          <Select placeholder="Choose a mold..." value={selectedMoldId} onChange={setSelectedMoldId}
            showSearch optionFilterProp="label" style={{ width: 320 }}
            options={molds.map((m) => ({ label: `${m.mold_code} - ${m.name}`, value: m.id }))} allowClear />
          {selectedMoldId && <>
            <Button icon={<DownloadOutlined />} onClick={() => {
              const csvRows = cavities.map((c) => ({
                'Cavity Number': c.cavity_number ?? '', 'Position': c.position || '',
              }));
              downloadSampleCsv('cavity-tracking.csv', CAVITY_CSV_HEADERS, csvRows);
            }}>Export CSV</Button>
            {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>}
            <Button icon={<ReloadOutlined />} onClick={fetchCavityData} style={{ borderRadius: 8 }}>Refresh</Button>
          </>}
          {selectedMoldId && canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)} style={{ borderRadius: 8 }}>Add Cavity</Button>}
        </div>
      </Card>

      {selectedMoldId && (
        <>
          {/* Mold summary */}
          {selectedMold && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Mold Code', value: selectedMold.mold_code, color: '#1d4ed8', bg: '#eff6ff' },
                { label: 'Name', value: selectedMold.name, color: '#6b7280', bg: '#f9fafb' },
                { label: 'Total Cavities', value: selectedMold.total_cavities ?? 0, color: '#7c3aed', bg: '#f5f3ff' },
                { label: 'Active Cavities', value: selectedMold.active_cavities ?? cavities.filter((c) => c.status === 'active').length, color: '#16a34a', bg: '#f0fdf4' },
              ].map((s) => (
                <div key={s.label} style={{ padding: '8px 16px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
                  <Text style={{ color: s.color, fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{s.value}</Text>
                  <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
                </div>
              ))}
            </div>
          )}

          {/* Cavity Table */}
          <Card title="Cavities" style={{ border: '1px solid #e8eaed', borderRadius: 12, marginBottom: 20 }} bodyStyle={{ padding: '12px 16px' }}>
            <Table rowKey="id" size="small" dataSource={cavities} loading={cavLoading} pagination={false} scroll={{ x: 800 }} columns={cavityColumns}
              locale={{ emptyText: <Text type="secondary">No cavities found for this mold</Text> }} />
          </Card>

          {/* Heatmap */}
          <Card title={<><AppstoreOutlined style={{ marginRight: 8 }} />Cavity Heatmap</>}
            style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: '16px 20px' }}>
            {heatmapData.length === 0 ? (
              <Text type="secondary">No cavity data available for heatmap</Text>
            ) : (
              <Row gutter={[8, 8]}>
                {heatmapData.map((c) => (
                  <Col key={c.id ?? c.number} xs={4} sm={3} md={2}>
                    <Tooltip title={`Cavity ${c.number} - ${fmtLabel(c.status)}${c.position ? ` (${c.position})` : ''}`}>
                      <div style={{
                        background: CAVITY_STATUS_COLOR[c.status] ?? '#d9d9d9',
                        borderRadius: 8, padding: '12px 4px', textAlign: 'center',
                        color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'default',
                        minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      }}>
                        {c.number}
                      </div>
                    </Tooltip>
                  </Col>
                ))}
              </Row>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
              {Object.entries(CAVITY_STATUS_COLOR).map(([status, color]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: color }} />
                  <Text style={{ fontSize: 12 }}>{fmtLabel(status)}</Text>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Cavities"
        entityName="Cavity"
        sampleHeaders={CAVITY_CSV_HEADERS}
        sampleRows={CAVITY_CSV_SAMPLE}
        validationRules={CAVITY_VALIDATION_RULES}
      />

      {/* Block Cavity Modal */}
      <Modal title="Block Cavity" open={blockModalOpen} onCancel={() => { setBlockModalOpen(false); setBlockReason(''); }}
        onOk={handleBlock} okText="Block" okButtonProps={{ danger: true }}>
        <Form layout="vertical">
          <Form.Item label="Reason for Blocking" required>
            <Input.TextArea rows={3} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Enter reason for blocking" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Cavity Modal */}
      <Modal title="Add Cavity" open={addModalOpen} onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}
        onOk={handleAddCavity} okText="Add">
        <Form form={addForm} layout="vertical">
          <Form.Item name="cavity_number" label="Cavity Number" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="position" label="Position">
            <Input placeholder="e.g. A1, B2" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
};

export default CavityTrackingPage;
