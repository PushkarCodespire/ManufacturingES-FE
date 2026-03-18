import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Typography, Card, Button, Tabs, Descriptions, Tag, Table, Select,
  Form, Input, message, Popconfirm, Alert, Space, Row, Col,
  Divider, Switch, Modal, Spin, Upload,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined, ThunderboltOutlined,
  PlusCircleOutlined, MinusCircleOutlined, DownloadOutlined,
  PrinterOutlined, BulbOutlined, CameraOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { iqcApi }       from '../../../api/production.api';
import { checkSheetApi } from '../../../api/quality.api';
import { itemApi }       from '../../../api/item.api';
import aiApi            from '../../../api/ai.api';
import IqcReportTemplate from './templates/IqcReportTemplate';

const { Title, Text } = Typography;

const RESULT_CONFIG = {
  pending:     { color: 'orange', label: 'Pending'     },
  pass:        { color: 'green',  label: 'Pass'        },
  fail:        { color: 'red',    label: 'Fail'        },
  conditional: { color: 'gold',   label: 'Conditional' },
};

const DISPOSITION_OPTIONS = [
  { value: 'use_as_is',          label: 'Use As-Is (Customer Deviation)' },
  { value: 'rework',             label: 'Rework'                         },
  { value: 'scrap',              label: 'Scrap'                          },
  { value: 'return_to_supplier', label: 'Return to Supplier'             },
  { value: 'on_hold',            label: 'On Hold (Pending Decision)'     },
];

const emptyParam = () => ({
  _key:           Date.now() + Math.random(),
  parameter_name: '',
  specification:  '',
  actual_value:   '',
  result:         'pass',
  notes:          '',
});

export default function IQCDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { can }  = usePermissions();
  const canWrite = can('prod-quality_level-iqc-create_edit_delete');

  const [record,      setRecord]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [params,      setParams]      = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [csLoading,   setCsLoading]   = useState(false);
  const [checkSheets, setCheckSheets] = useState([]);
  const [activeTab,   setActiveTab]   = useState('overview');

  const [dispForm]         = Form.useForm();
  const [cascadeLoading,   setCascadeLoading]   = useState(false);

  // ── AI Photo Analysis (Part 4) ─────────────────────────────────────────────
  const [photoLoading,  setPhotoLoading]  = useState(false);
  const [photoResult,   setPhotoResult]   = useState(null);
  const [photoError,    setPhotoError]    = useState(null);
  const [photoFileName, setPhotoFileName] = useState(null);

  // ── Print support ──────────────────────────────────────────────────────────
  const printRef = useRef();
  const handlePrint = useReactToPrint({ contentRef: printRef });

  // ── Load inspection ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await iqcApi.getById(id);
      const rec  = data?.data ?? data;
      setRecord(rec);
      // Populate measurements from existing results
      if (Array.isArray(rec.Results) && rec.Results.length > 0) {
        setParams(rec.Results.map((r) => ({ ...r, _key: r.id })));
      } else if (rec.item_id) {
        // No existing results — try to pre-populate from item's CTQ quality params
        try {
          const qpData = await itemApi.getQualityParams(rec.item_id);
          const qps    = Array.isArray(qpData) ? qpData : (qpData?.data ?? []);
          if (qps.length > 0) {
            setParams(qps.map((p) => ({
              _key:           Date.now() + Math.random(),
              parameter_name: p.param_name,
              specification:  p.specification || '',
              actual_value:   '',
              result:         'pass',
              notes:          '',
            })));
          } else {
            setParams([emptyParam()]);
          }
        } catch {
          setParams([emptyParam()]);
        }
      } else {
        setParams([emptyParam()]);
      }
      dispForm.setFieldsValue({
        disposition: rec.disposition || undefined,
        on_hold:     rec.on_hold     || false,
        notes:       rec.notes       || '',
      });
    } catch (err) {
      message.error(err?.message || 'Failed to load IQC inspection');
    } finally { setLoading(false); }
  }, [id, dispForm]);

  useEffect(() => { load(); }, [load]);

  // ── Load check-sheets for item (IQC-002) ──────────────────────────────────
  useEffect(() => {
    if (!record?.item_id) return;
    checkSheetApi.getAll({ item_id: record.item_id }).then((data) => {
      const rows = Array.isArray(data) ? data : (data?.data ?? []);
      setCheckSheets(rows.filter((cs) => cs.is_active !== false));
    }).catch(() => {});
  }, [record?.item_id]);

  // ── Load check-sheet dimensions (IQC-002) ─────────────────────────────────
  const loadCheckSheet = async (csId) => {
    setCsLoading(true);
    try {
      const data = await checkSheetApi.getById(csId);
      const cs   = data?.data ?? data;
      const dims = Array.isArray(cs.Dimensions) ? cs.Dimensions
                 : Array.isArray(cs.dimensions)  ? cs.dimensions
                 : [];

      if (dims.length === 0) {
        message.warning('No dimensions found in this check-sheet');
        return;
      }

      const mapped = dims.map((d) => ({
        _key:           Date.now() + Math.random(),
        parameter_name: d.balloon_no ? `[${d.balloon_no}] ${d.dimension_desc}` : d.dimension_desc,
        specification:  d.nominal != null
          ? `${d.nominal}${d.usl != null ? ` +${(d.usl - d.nominal).toFixed(3)}` : ''}${d.lsl != null ? `/-${(d.nominal - d.lsl).toFixed(3)}` : ''} ${d.unit || 'mm'}`
          : '',
        actual_value:   '',
        result:         'pass',
        notes:          '',
      }));

      setParams(mapped);
      message.success(`Loaded ${mapped.length} dimensions from check-sheet`);
    } catch { message.error('Failed to load check-sheet'); }
    finally { setCsLoading(false); }
  };

  // ── Parameter helpers ──────────────────────────────────────────────────────
  const addParam    = () => setParams((p) => [...p, emptyParam()]);
  const removeParam = (key) => setParams((p) => p.filter((r) => r._key !== key));
  const updateParam = (key, field, value) =>
    setParams((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r));

  // ── Auto-verdict suggestion (IQC-004) ─────────────────────────────────────
  const anyFail    = params.some((p) => p.result === 'fail');
  const autoVerdict = anyFail ? 'fail' : 'pass';

  // ── Save measurements (IQC-003) ───────────────────────────────────────────
  const saveMeasurements = async () => {
    const validParams = params.filter((p) => p.parameter_name.trim());
    if (validParams.length === 0) {
      message.warning('Add at least one parameter before saving');
      return;
    }
    setSaving(true);
    try {
      const res = await iqcApi.updateResults(id, validParams.map(({ _key, ...p }) => p));
      message.success(`Measurements saved. Auto-verdict: ${(res?.auto_verdict || autoVerdict).toUpperCase()}`);
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  // ── Set verdict (IQC-004) ─────────────────────────────────────────────────
  const setVerdict = async (result) => {
    try {
      await iqcApi.updateResult(id, result);
      message.success(`Verdict set to ${RESULT_CONFIG[result]?.label}`);
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Failed'); }
  };

  // ── Set disposition + on-hold (IQC-006) ───────────────────────────────────
  const saveDisposition = async () => {
    try {
      const vals = await dispForm.validateFields();
      setSaving(true);
      await iqcApi.setDisposition(id, {
        disposition: vals.disposition,
        on_hold:     vals.on_hold ?? false,
        notes:       vals.notes   || null,
      });
      message.success('Disposition saved');
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  // ── CAPA cascade (IQC-007) ────────────────────────────────────────────────
  const triggerCapa = async () => {
    setCascadeLoading(true);
    try {
      const res = await iqcApi.cascadeCapa(id);
      const data = res?.data ?? res;
      message.success(`CAPA created: ${data?.capa_no || 'Done'}`);
      load();
    } catch (err) { message.error(err?.response?.data?.message || 'Failed to create CAPA'); }
    finally { setCascadeLoading(false); }
  };

  // ── AI photo upload handler ────────────────────────────────────────────────
  const handlePhotoUpload = async (file) => {
    setPhotoLoading(true);
    setPhotoError(null);
    setPhotoResult(null);
    setPhotoFileName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (record?.id)         formData.append('inspection_id', record.id);
      if (record?.Item?.name) formData.append('item_name', record.Item.name);
      const res = await aiApi.iqcPhotoAnalyze(formData);
      setPhotoResult(res);
    } catch (err) {
      setPhotoError(err?.message || 'Photo analysis failed');
    } finally { setPhotoLoading(false); }
    return false; // prevent Antd auto-upload
  };

  if (loading) return <AppLayout><div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div></AppLayout>;
  if (!record)  return <AppLayout><Alert type="error" message="Inspection not found" /></AppLayout>;

  const result = record.result;
  const resultCfg = RESULT_CONFIG[result] || { color: 'default', label: result };

  // ── Tab: Overview (IQC-005) ───────────────────────────────────────────────
  const tabOverview = (
    <Descriptions bordered column={2} size="small">
      <Descriptions.Item label="Inspection No">
        <Text style={{ fontWeight: 600 }}>{record.inspection_no}</Text>
      </Descriptions.Item>
      <Descriptions.Item label="Date">
        {record.inspection_date ? dayjs(record.inspection_date).format('DD MMM YYYY') : '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Item">
        {record.Item ? `${record.Item.name}${record.Item.code ? ` (${record.Item.code})` : ''}` : '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Vendor / Supplier">
        {record.Vendor?.name || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="GRN Reference">
        {record.Grn?.grn_no || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Batch / Lot No.">
        {record.batch_no || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Qty Received">
        {record.qty_received ?? '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Qty Inspected">
        {record.qty_inspected ?? '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Qty Rejected">
        {record.qty_rejected > 0
          ? <Text style={{ color: '#dc2626', fontWeight: 600 }}>{record.qty_rejected}</Text>
          : (record.qty_rejected ?? '—')}
      </Descriptions.Item>
      <Descriptions.Item label="Qty Accepted">
        {record.qty_accepted ?? '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Inspector">
        {record.Inspector?.name || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Result">
        <Tag color={resultCfg.color}>{resultCfg.label}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="Disposition" span={1}>
        {record.disposition ? (
          <Tag color="blue">{DISPOSITION_OPTIONS.find((d) => d.value === record.disposition)?.label || record.disposition}</Tag>
        ) : '—'}
      </Descriptions.Item>
      <Descriptions.Item label="On Hold">
        {record.on_hold
          ? <Tag color="red" icon={<WarningOutlined />}>Yes — Material on Hold</Tag>
          : <Tag color="default">No</Tag>}
      </Descriptions.Item>
      {record.notes && (
        <Descriptions.Item label="Notes" span={2}>{record.notes}</Descriptions.Item>
      )}
    </Descriptions>
  );

  // ── Tab: Measurements (IQC-002, IQC-003, IQC-004) ────────────────────────
  const tabMeasurements = (
    <div>
      {/* Load from check-sheet */}
      {checkSheets.length > 0 && canWrite && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 16px', background: '#eff6ff', borderRadius: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>Load from Check-Sheet:</Text>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select a check-sheet to load dimensions..."
            style={{ flex: 1, maxWidth: 400 }}
            options={checkSheets.map((cs) => ({ value: cs.id, label: `${cs.name} (Rev ${cs.revision})` }))}
            onChange={loadCheckSheet}
            loading={csLoading}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Loads dimensions and specs automatically
          </Text>
        </div>
      )}

      {/* Auto-verdict banner */}
      {params.length > 0 && params.some((p) => p.parameter_name) && (
        <Alert
          type={anyFail ? 'error' : 'success'}
          showIcon
          message={`Auto-Verdict Suggestion: ${anyFail ? 'FAIL — one or more parameters out of spec' : 'PASS — all parameters within spec'}`}
          style={{ marginBottom: 12, borderRadius: 8 }}
        />
      )}

      {/* Parameters grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px 90px 1fr 28px', gap: 6, marginBottom: 6 }}>
        {['Parameter Name', 'Specification', 'Actual Value', 'Result', 'Notes', ''].map((h) => (
          <Text key={h} style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{h}</Text>
        ))}
      </div>

      {params.map((row) => (
        <div key={row._key} style={{
          display: 'grid', gridTemplateColumns: '1fr 160px 140px 90px 1fr 28px',
          gap: 6, marginBottom: 8, alignItems: 'center',
          background: row.result === 'fail' ? '#fff1f0' : undefined,
          padding: row.result === 'fail' ? '4px 8px' : undefined,
          borderRadius: 6,
        }}>
          <Input size="small" placeholder="Parameter name"
            value={row.parameter_name}
            onChange={(e) => updateParam(row._key, 'parameter_name', e.target.value)}
          />
          <Input size="small" placeholder="Specification"
            value={row.specification}
            onChange={(e) => updateParam(row._key, 'specification', e.target.value)}
          />
          <Input size="small" placeholder="Actual"
            value={row.actual_value}
            onChange={(e) => updateParam(row._key, 'actual_value', e.target.value)}
            style={{ borderColor: row.result === 'fail' ? '#dc2626' : undefined }}
          />
          <Select size="small" value={row.result}
            onChange={(v) => updateParam(row._key, 'result', v)}
            options={[
              { value: 'pass', label: <Text style={{ color: '#16a34a' }}>Pass</Text> },
              { value: 'fail', label: <Text style={{ color: '#dc2626' }}>Fail</Text> },
            ]}
          />
          <Input size="small" placeholder="Notes"
            value={row.notes}
            onChange={(e) => updateParam(row._key, 'notes', e.target.value)}
          />
          <Button size="small" type="text" danger icon={<MinusCircleOutlined />}
            onClick={() => removeParam(row._key)} disabled={params.length === 1}
          />
        </div>
      ))}

      {canWrite && (
        <Button type="dashed" onClick={addParam} icon={<PlusCircleOutlined />} style={{ marginTop: 4, marginBottom: 16 }}>
          Add Parameter
        </Button>
      )}

      {canWrite && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <Space>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={saveMeasurements}>
              Save Measurements
            </Button>
          </Space>

          <Divider orientation="left" style={{ fontSize: 13, fontWeight: 600, marginTop: 24 }}>
            Set Final Verdict
          </Divider>
          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
              onClick={() => setVerdict('pass')}
              disabled={result === 'pass'}
            >
              Mark Pass
            </Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => setVerdict('fail')}
              disabled={result === 'fail'}
            >
              Mark Fail
            </Button>
            <Button
              icon={<WarningOutlined />}
              style={{ borderColor: '#d97706', color: '#d97706' }}
              onClick={() => setVerdict('conditional')}
              disabled={result === 'conditional'}
            >
              Conditional
            </Button>
          </Space>
        </>
      )}
    </div>
  );

  // ── Tab: Disposition (IQC-006) ────────────────────────────────────────────
  const tabDisposition = (
    <div style={{ maxWidth: 500 }}>
      {record.result === 'pending' && (
        <Alert type="warning" showIcon
          message="Set the verdict in the Measurements tab before setting disposition."
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      <Form form={dispForm} layout="vertical">
        <Form.Item name="disposition" label="Disposition Decision"
          rules={[{ required: true, message: 'Select a disposition' }]}>
          <Select
            options={DISPOSITION_OPTIONS}
            placeholder="What to do with this material?"
          />
        </Form.Item>

        <Form.Item name="on_hold" label="Material On Hold" valuePropName="checked">
          <Switch
            checkedChildren={<><WarningOutlined /> On Hold</>}
            unCheckedChildren="Not on Hold"
          />
        </Form.Item>

        <Form.Item name="notes" label="Disposition Notes">
          <Input.TextArea rows={3} placeholder="Explain the decision, rework instructions, etc." />
        </Form.Item>

        {canWrite && (
          <Button type="primary" loading={saving} onClick={saveDisposition}>
            Save Disposition
          </Button>
        )}
      </Form>

      {record.disposition && (
        <div style={{ marginTop: 20, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <Text style={{ fontWeight: 600 }}>Current Disposition: </Text>
          <Tag color="blue">{DISPOSITION_OPTIONS.find((d) => d.value === record.disposition)?.label || record.disposition}</Tag>
          {record.on_hold && <Tag color="red" style={{ marginLeft: 8 }}><WarningOutlined /> Material On Hold</Tag>}
        </div>
      )}
    </div>
  );

  // ── Tab: CAPA Cascade (IQC-007) ───────────────────────────────────────────
  const tabCapa = (
    <div style={{ maxWidth: 560 }}>
      {!['fail', 'conditional'].includes(record.result) && (
        <Alert type="info" showIcon
          message="CAPA cascade is only available for Fail or Conditional results."
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {record.capa_id ? (
        <Card style={{ borderRadius: 10, border: '1px solid #e0e7ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircleOutlined style={{ color: '#7c3aed', fontSize: 24 }} />
            <div>
              <Text style={{ fontWeight: 600, fontSize: 15 }}>CAPA Linked</Text>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  A CAPA has been created for this rejection. Navigate to Quality → CAPA to track the corrective action.
                </Text>
              </div>
              <Button type="link" style={{ padding: 0 }}
                onClick={() => navigate('/quality/capa')}>
                Open CAPA Module →
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{ borderRadius: 10 }}>
          <Title level={5} style={{ marginTop: 0 }}>Auto-Create CAPA</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            This will automatically create a CAPA record pre-filled with this rejection's details (item, vendor, batch, qty rejected).
            The CAPA will appear in the Quality → CAPA module for root cause analysis and corrective actions.
          </Text>
          <Popconfirm
            title="Create CAPA for this IQC rejection?"
            description="A new CAPA will be auto-created and linked to this inspection."
            onConfirm={triggerCapa}
            okText="Create CAPA"
            disabled={!['fail', 'conditional'].includes(record.result)}
          >
            <Button
              type="primary"
              danger
              icon={<ThunderboltOutlined />}
              loading={cascadeLoading}
              disabled={!canWrite || !['fail', 'conditional'].includes(record.result)}
            >
              Trigger CAPA Cascade
            </Button>
          </Popconfirm>
        </Card>
      )}
    </div>
  );

  // ── Tab: AI Photo Analysis (Part 4) ──────────────────────────────────────
  const ASSESS_COLOR = { pass: 'green', conditional: 'gold', fail: 'red', insufficient_info: 'default' };
  const SEV_COLOR    = { minor: 'orange', major: 'volcano', critical: 'red' };
  const DISP_MAP     = {
    accept:                 'use_as_is',
    accept_with_deviation:  'use_as_is',
    sort_and_inspect:       'on_hold',
    reject:                 'return_to_supplier',
    insufficient_info:      null,
  };

  const tabPhoto = (
    <div style={{ maxWidth: 660 }}>
      <Alert
        type="info"
        showIcon
        icon={<BulbOutlined />}
        message="AI Vision Defect Tagging"
        description="Upload an inspection photo to automatically identify defects, assess severity, and get a recommended disposition."
        style={{ marginBottom: 20, borderRadius: 8 }}
      />

      <Upload.Dragger
        accept="image/*"
        showUploadList={false}
        beforeUpload={handlePhotoUpload}
        disabled={photoLoading}
        style={{ borderRadius: 10, borderColor: '#7c3aed' }}
      >
        <p className="ant-upload-drag-icon">
          <CameraOutlined style={{ fontSize: 36, color: '#7c3aed' }} />
        </p>
        <p className="ant-upload-text" style={{ color: '#374151', fontWeight: 500 }}>
          Click or drag a photo to analyse
        </p>
        <p className="ant-upload-hint" style={{ color: '#9ca3af' }}>
          Supports JPG, PNG, WEBP — max 10 MB
        </p>
      </Upload.Dragger>

      {photoLoading && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Spin size="large" />
          <Text style={{ display: 'block', marginTop: 12, color: '#6b7280' }}>
            Analysing photo with AI vision…
          </Text>
          {photoFileName && (
            <Text type="secondary" style={{ fontSize: 12 }}>{photoFileName}</Text>
          )}
        </div>
      )}

      {photoError && (
        <Alert type="error" message={photoError}
          style={{ marginTop: 16, borderRadius: 8 }}
          action={<Button size="small" onClick={() => setPhotoError(null)}>Dismiss</Button>}
        />
      )}

      {!photoLoading && photoResult && (() => {
        const insight = photoResult?.ai_insight;
        if (!insight) return (
          <Alert type="warning" message="No AI insight returned — try again with a clearer photo."
            style={{ marginTop: 16, borderRadius: 8 }} />
        );

        const defects = Array.isArray(insight.defects_found) ? insight.defects_found : [];
        const dimConcerns = Array.isArray(insight.dimensional_concerns) ? insight.dimensional_concerns : [];
        const suggestedDisp = DISP_MAP[insight.disposition_recommendation];

        return (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Tag color={ASSESS_COLOR[insight.overall_assessment] || 'default'}
                style={{ fontWeight: 700, fontSize: 13, padding: '3px 10px' }}>
                {String(insight.overall_assessment || '—').toUpperCase()}
              </Tag>
              <Tag color="purple">Confidence: {insight.confidence || '—'}</Tag>
              {insight.surface_quality && (
                <Tag color={insight.surface_quality === 'acceptable' ? 'green' : insight.surface_quality === 'borderline' ? 'gold' : 'red'}>
                  Surface: {insight.surface_quality}
                </Tag>
              )}
              {photoFileName && (
                <Text type="secondary" style={{ fontSize: 11 }}>{photoFileName}</Text>
              )}
            </div>

            {/* Disposition recommendation */}
            {insight.disposition_recommendation && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', border: '1px solid #e5e7eb' }}>
                <Text strong style={{ fontSize: 12, color: '#374151' }}>
                  Recommended Disposition:{' '}
                </Text>
                <Tag color={ASSESS_COLOR[insight.overall_assessment] || 'blue'} style={{ fontWeight: 600 }}>
                  {insight.disposition_recommendation.replace(/_/g, ' ').toUpperCase()}
                </Tag>
                {suggestedDisp && canWrite && (
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    style={{ marginLeft: 8, borderColor: '#7c3aed', color: '#7c3aed' }}
                    onClick={() => {
                      dispForm.setFieldsValue({ disposition: suggestedDisp });
                      setActiveTab('disposition');
                      message.success('Disposition pre-filled from AI recommendation — review and save');
                    }}
                  >
                    Apply to Disposition
                  </Button>
                )}
              </div>
            )}

            {/* Defects found */}
            {defects.length > 0 && (
              <div>
                <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Defects Identified ({defects.length})
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {defects.map((d, i) => (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: 8,
                      border: `1px solid ${d.severity === 'critical' ? '#fca5a5' : d.severity === 'major' ? '#fed7aa' : '#fde68a'}`,
                      background: d.severity === 'critical' ? '#fff1f0' : d.severity === 'major' ? '#fff7ed' : '#fffbeb',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Tag color={SEV_COLOR[d.severity] || 'default'} style={{ margin: 0, fontWeight: 600 }}>
                          {(d.severity || '').toUpperCase()}
                        </Tag>
                        <Text style={{ fontWeight: 500, fontSize: 13 }}>{d.defect_type || '—'}</Text>
                        {d.location && (
                          <Text type="secondary" style={{ fontSize: 12 }}>@ {d.location}</Text>
                        )}
                      </div>
                      {d.description && (
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>{d.description}</Text>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dimensional concerns */}
            {dimConcerns.length > 0 && (
              <div>
                <Text strong style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Dimensional Concerns
                </Text>
                <ul style={{ margin: 0, paddingLeft: 20, color: '#dc2626', fontSize: 13 }}>
                  {dimConcerns.map((c, i) => <li key={i} style={{ marginBottom: 3 }}>{c}</li>)}
                </ul>
              </div>
            )}

            {defects.length === 0 && dimConcerns.length === 0 && (
              <Alert type="success" showIcon icon={<CheckCircleOutlined />}
                message="No defects or dimensional concerns identified in this photo."
                style={{ borderRadius: 8 }} />
            )}
          </div>
        );
      })()}
    </div>
  );

  const wrap = (content) => <div style={{ padding: '20px 4px' }}>{content}</div>;

  const tabItems = [
    { key: 'overview',      label: 'Overview',      children: wrap(tabOverview)      },
    { key: 'measurements',  label: 'Measurements',  children: wrap(tabMeasurements)  },
    { key: 'disposition',   label: 'Disposition',   children: wrap(tabDisposition)   },
    { key: 'capa',          label: 'CAPA Cascade',  children: wrap(tabCapa)          },
    {
      key: 'photo',
      label: <span><BulbOutlined style={{ color: '#7c3aed', marginRight: 4 }} />Photo Analysis</span>,
      children: wrap(tabPhoto),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Breadcrumb + back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Button type="text" size="small" icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/production/iqc')} style={{ padding: '0 4px' }} />
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <Text style={{ color: '#d1d5db', fontSize: 10 }}>›</Text>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>IQC</Text>
        <Text style={{ color: '#d1d5db', fontSize: 10 }}>›</Text>
        <Text style={{ color: '#374151', fontSize: 12 }}>{record.inspection_no}</Text>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>{record.inspection_no}</Title>
          <Space style={{ marginTop: 4 }}>
            <Tag color={resultCfg.color} style={{ fontSize: 13 }}>{resultCfg.label}</Tag>
            {record.on_hold && <Tag color="red" icon={<WarningOutlined />}>Material On Hold</Tag>}
            {record.capa_id && <Tag color="purple">CAPA Linked</Tag>}
            {record.Item && <Text type="secondary" style={{ fontSize: 13 }}>{record.Item.name}</Text>}
            {record.Vendor && <Text type="secondary" style={{ fontSize: 13 }}>· {record.Vendor.name}</Text>}
          </Space>
        </div>
        <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Report</Button>
      </div>

      {/* Hidden print template */}
      <div style={{ display: 'none' }}>
        <IqcReportTemplate ref={printRef} inspection={record} />
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 0 }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ padding: '0 20px' }}
          tabBarStyle={{ marginBottom: 0 }}
          destroyInactiveTabPane={false}
        />
      </Card>
    </AppLayout>
  );
}
