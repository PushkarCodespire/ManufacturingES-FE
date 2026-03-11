import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Typography, Card, Button, Tabs, Descriptions, Tag, Table, Select,
  Form, Input, message, Popconfirm, Alert, Space, Row, Col,
  Divider, Switch, Modal, Spin,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined, ThunderboltOutlined,
  PlusCircleOutlined, MinusCircleOutlined, DownloadOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import { iqcApi }       from '../../../api/production.api';
import { checkSheetApi } from '../../../api/quality.api';
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
      } else {
        setParams([emptyParam()]);
      }
      dispForm.setFieldsValue({
        disposition: rec.disposition || undefined,
        on_hold:     rec.on_hold     || false,
        notes:       rec.notes       || '',
      });
    } catch (err) {
      message.error('Failed to load IQC inspection');
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

  const wrap = (content) => <div style={{ padding: '20px 4px' }}>{content}</div>;

  const tabItems = [
    { key: 'overview',      label: 'Overview',      children: wrap(tabOverview)      },
    { key: 'measurements',  label: 'Measurements',  children: wrap(tabMeasurements)  },
    { key: 'disposition',   label: 'Disposition',   children: wrap(tabDisposition)   },
    { key: 'capa',          label: 'CAPA Cascade',  children: wrap(tabCapa)          },
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
