import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography, Card, Button, Descriptions, Tag, Space, message,
  Table, Input, InputNumber, Select,
} from 'antd';
import {
  ArrowLeftOutlined, RightOutlined, PlusOutlined, DeleteOutlined, SaveOutlined,
} from '@ant-design/icons';
import AppLayout         from '../../../components/AppLayout';
import usePermissions    from '../../../hooks/usePermissions';
import { checkSheetApi } from '../../../api/quality.api';

const { Title, Text } = Typography;

const STAGE_LABELS = {
  incoming: 'Incoming', in_process: 'In Process', final: 'Final', dispatch: 'Dispatch',
};

const CLASSIFICATION_COLOR = { critical: 'red', major: 'orange', minor: 'default' };

const INSTRUMENT_OPTS = [
  'Micrometer', 'Vernier Caliper', 'CMM', 'Height Gauge',
  'Dial Gauge', 'Pin Gauge', 'Visual', 'Other',
].map((v) => ({ value: v, label: v }));

const CLASSIFICATION_OPTS = [
  { value: 'critical', label: 'Critical' },
  { value: 'major',    label: 'Major'    },
  { value: 'minor',    label: 'Minor'    },
];

const UNIT_OPTS = ['mm', 'cm', 'inch', 'kg', 'N', 'MPa', '°C', '%', 'deg'].map((v) => ({ value: v, label: v }));

let _tempId = 0;
const newDim = (sortOrder = 0) => ({
  _tempId: ++_tempId,
  balloon_no:      '',
  dimension_desc:  '',
  nominal:         0,
  usl:             0,
  lsl:             0,
  unit:            'mm',
  instrument:      '',
  classification:  'major',
  sample_size:     5,
  sort_order:      sortOrder,
});

export default function CheckSheetDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { can }  = usePermissions();
  const canWrite = can('npd-check_sheets-create_edit_delete');

  const [template, setTemplate] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [dims,     setDims]     = useState([]);
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await checkSheetApi.getById(id);
      setTemplate(data);
      setDims((data.Dimensions ?? []).map((d) => ({ ...d, _tempId: ++_tempId })));
    } catch { message.error('Failed to load check-sheet template'); }
    finally   { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Dimension helpers ──────────────────────────────────────────────────────
  const updateDim = (key, field, value) => {
    setDims((prev) => prev.map((d) =>
      (d._tempId === key || d.id === key) ? { ...d, [field]: value } : d,
    ));
  };

  const addDim = () => setDims((prev) => [...prev, newDim(prev.length)]);

  const removeDim = (key) => {
    setDims((prev) => prev.filter((d) => d._tempId !== key && d.id !== key));
  };

  const saveDims = async () => {
    setSaving(true);
    try {
      await checkSheetApi.updateDimensions(id, { dimensions: dims });
      message.success('Dimensions saved');
      load();
    } catch (err) { message.error(err?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  // ── Column definitions ─────────────────────────────────────────────────────
  const dimCols = [
    {
      title: 'Balloon', dataIndex: 'balloon_no', key: 'balloon', width: 80,
      render: (v, r) => (
        <Input
          size="small" value={v}
          disabled={!canWrite}
          onChange={(e) => updateDim(r._tempId ?? r.id, 'balloon_no', e.target.value)}
          style={{ width: 64 }}
        />
      ),
    },
    {
      title: 'Description', dataIndex: 'dimension_desc', key: 'desc',
      render: (v, r) => (
        <Input
          size="small" value={v}
          disabled={!canWrite}
          onChange={(e) => updateDim(r._tempId ?? r.id, 'dimension_desc', e.target.value)}
        />
      ),
    },
    {
      title: 'Nominal', dataIndex: 'nominal', key: 'nom', width: 90,
      render: (v, r) => (
        <InputNumber
          size="small" value={v}
          disabled={!canWrite}
          onChange={(val) => updateDim(r._tempId ?? r.id, 'nominal', val)}
          style={{ width: 76 }}
        />
      ),
    },
    {
      title: 'USL', dataIndex: 'usl', key: 'usl', width: 90,
      render: (v, r) => (
        <InputNumber
          size="small" value={v}
          disabled={!canWrite}
          onChange={(val) => updateDim(r._tempId ?? r.id, 'usl', val)}
          style={{ width: 76 }}
        />
      ),
    },
    {
      title: 'LSL', dataIndex: 'lsl', key: 'lsl', width: 90,
      render: (v, r) => (
        <InputNumber
          size="small" value={v}
          disabled={!canWrite}
          onChange={(val) => updateDim(r._tempId ?? r.id, 'lsl', val)}
          style={{ width: 76 }}
        />
      ),
    },
    {
      title: 'Unit', dataIndex: 'unit', key: 'unit', width: 90,
      render: (v, r) => (
        <Select
          size="small" value={v}
          disabled={!canWrite}
          options={UNIT_OPTS}
          onChange={(val) => updateDim(r._tempId ?? r.id, 'unit', val)}
          style={{ width: 76 }}
        />
      ),
    },
    {
      title: 'Instrument', dataIndex: 'instrument', key: 'inst', width: 160,
      render: (v, r) => (
        <Select
          size="small" value={v || undefined}
          disabled={!canWrite}
          options={INSTRUMENT_OPTS}
          placeholder="Select"
          onChange={(val) => updateDim(r._tempId ?? r.id, 'instrument', val)}
          style={{ width: 150 }}
        />
      ),
    },
    {
      title: 'Class.', dataIndex: 'classification', key: 'cls', width: 110,
      render: (v, r) => (
        <Select
          size="small" value={v}
          disabled={!canWrite}
          options={CLASSIFICATION_OPTS}
          onChange={(val) => updateDim(r._tempId ?? r.id, 'classification', val)}
          style={{ width: 96 }}
        />
      ),
    },
    {
      title: 'n', dataIndex: 'sample_size', key: 'n', width: 70,
      render: (v, r) => (
        <InputNumber
          size="small" min={1} value={v}
          disabled={!canWrite}
          onChange={(val) => updateDim(r._tempId ?? r.id, 'sample_size', val)}
          style={{ width: 58 }}
        />
      ),
    },
    ...(canWrite ? [{
      title: '', key: 'del', width: 40,
      render: (_, r) => (
        <Button
          size="small" type="text" danger
          icon={<DeleteOutlined />}
          onClick={() => removeDim(r._tempId ?? r.id)}
        />
      ),
    }] : []),
  ];

  if (loading) return <AppLayout><div style={{ padding: 40, color: '#6b7280' }}>Loading…</div></AppLayout>;
  if (!template) return <AppLayout><div style={{ padding: 40, color: '#ef4444' }}>Template not found.</div></AppLayout>;

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>NPD</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text
          style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
          onClick={() => navigate('/quality/check-sheets')}
        >
          Check Sheets
        </Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{template.template_code}</Text>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quality/check-sheets')}>Back</Button>
        <div>
          <Title level={3} style={{ margin: 0 }}>{template.template_code} — {template.name}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Check Sheet Template Detail</Text>
        </div>
      </div>

      {/* Card 1 — Template Info */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
        bodyStyle={{ padding: '16px 20px' }}
        title="Template Information"
      >
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Template Code">{template.template_code}</Descriptions.Item>
          <Descriptions.Item label="Name">{template.name}</Descriptions.Item>
          <Descriptions.Item label="Part / Item">{template.Item?.part_no ? `${template.Item.part_no} — ${template.Item.name}` : '—'}</Descriptions.Item>
          <Descriptions.Item label="Inspection Stage">
            <Tag>{STAGE_LABELS[template.stage] ?? template.stage ?? '—'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Revision">{template.revision || '—'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={template.status === 'active' ? 'green' : 'default'}>{template.status}</Tag>
          </Descriptions.Item>
          {template.description && (
            <Descriptions.Item label="Notes / Description" span={2}>{template.description}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Card 2 — Dimensions */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
        title={`Dimensions (${dims.length})`}
        extra={canWrite && (
          <Space>
            <Button icon={<PlusOutlined />} onClick={addDim}>Add Dimension</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={saveDims}>
              Save All Dimensions
            </Button>
          </Space>
        )}
      >
        {/* Classification legend */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Tag color="red">Critical</Tag>
          <Tag color="orange">Major</Tag>
          <Tag color="default">Minor</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>— Edit cells inline, then Save All Dimensions</Text>
        </div>

        <Table
          rowKey={(r) => r._tempId ?? r.id}
          dataSource={dims}
          columns={dimCols}
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: canWrite ? 'No dimensions yet — click "Add Dimension" to start' : 'No dimensions defined' }}
          rowClassName={(r) => {
            const cls = r.classification;
            if (cls === 'critical') return 'dim-row-critical';
            if (cls === 'major')    return 'dim-row-major';
            return '';
          }}
        />
      </Card>
    </AppLayout>
  );
}
