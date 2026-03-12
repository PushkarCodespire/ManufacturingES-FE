import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Form,
  Select, Modal, message, Tabs, Steps, Alert, Timeline,
  Divider, Empty, Spin,
} from 'antd';
import {
  RightOutlined, CheckCircleOutlined,
  CloseCircleOutlined, WarningOutlined,
  ExportOutlined, ImportOutlined, HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { moldIssueReturnApi, moldMasterApi, moldStoreApi } from '../../../api/mold.api';
import { machineApi } from '../../../api/machine.api';
import { workOrderApi } from '../../../api/production.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { TextArea } = Input;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

const VERIFICATION_LABELS = {
  part_mold_match:     'Part-Mold Match',
  machine_compat:      'Machine Compatibility',
  life_sufficiency:    'Life Sufficiency',
  pm_compliance:       'PM Compliance',
  post_use_inspection: 'Post-Use Inspection',
  trial_validation:    'Trial Validation',
};

export default function MoldIssueReturnPage() {
  const { can } = usePermissions();
  const canWrite = can('mold-issue_return-create_edit_delete');

  const [activeTab, setActiveTab] = useState('issue');

  // ── Master data ─────────────────────────────────────────────────────────
  const [allMolds,     setAllMolds]     = useState([]);
  const [allMachines,  setAllMachines]  = useState([]);
  const [allWorkOrders, setAllWorkOrders] = useState([]);
  const [storageLocations, setStorageLocations] = useState([]);
  const [masterLoading, setMasterLoading] = useState(false);

  // ── Issue tab state ──────────────────────────────────────────────────────
  const [issueStep,    setIssueStep]    = useState(0);
  const [issueMoldId,  setIssueMoldId]  = useState(null);
  const [issueWorkOrder, setIssueWorkOrder] = useState(null);   // wo_no value
  const [issueMachine,   setIssueMachine]   = useState(null);   // machine id (int)
  const [compatMachineIds, setCompatMachineIds] = useState([]); // from selected mold
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying,    setVerifying]    = useState(false);
  const [issuing,      setIssuing]      = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideReason,    setOverrideReason]    = useState('');
  const [moldDetailLoading, setMoldDetailLoading] = useState(false);

  // ── Return tab state ─────────────────────────────────────────────────────
  const [returnStep,   setReturnStep]   = useState(0);
  const [returnMoldId, setReturnMoldId] = useState(null);
  const [returnNotes,  setReturnNotes]  = useState('');
  const [returnResult, setReturnResult] = useState(null);
  const [returning,    setReturning]    = useState(false);
  const [inspectionForm] = Form.useForm();
  const [inspecting,   setInspecting]  = useState(false);

  // ── History tab state ────────────────────────────────────────────────────
  const [historyMoldId,   setHistoryMoldId]   = useState(null);
  const [history,         setHistory]         = useState([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);

  // ── Error helper (interceptor already extracts err.response.data) ────────
  const getErrMsg = (err, fallback) => err?.message ?? fallback;

  // ── Load master data ─────────────────────────────────────────────────────
  const loadMolds = useCallback(async () => {
    try {
      const data = await moldMasterApi.getAll({ limit: 500 });
      setAllMolds(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { /* silent */ }
  }, []);

  const loadMachines = useCallback(async () => {
    try {
      const data = await machineApi.getAll({ limit: 500 });
      // machineApi has .then(r=>r.data) — double-unwrapped, returns array directly
      setAllMachines(Array.isArray(data) ? data : (data?.data ?? []));
    } catch { /* silent */ }
  }, []);

  const loadWorkOrders = useCallback(async () => {
    try {
      // workOrderApi does NOT have .then(r=>r.data) — interceptor gives { success, data:[...] }
      const res = await workOrderApi.getAll({ limit: 500 });
      const items = Array.isArray(res) ? res : (res?.data ?? []);
      // Filter to open/in-progress WOs only
      setAllWorkOrders(items.filter(wo =>
        !['completed', 'cancelled', 'closed'].includes(wo.status)
      ));
    } catch { /* silent */ }
  }, []);

  const loadStorageLocations = useCallback(async () => {
    try {
      const data = await moldStoreApi.getRackMap();
      // Returns array of storage locations
      const locs = Array.isArray(data) ? data : (data?.data ?? []);
      // Show only available locations
      setStorageLocations(locs.filter(l => l.status === 'available' || l.status === 'occupied'));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setMasterLoading(true);
    Promise.allSettled([loadMolds(), loadMachines(), loadWorkOrders(), loadStorageLocations()])
      .finally(() => setMasterLoading(false));
  }, [loadMolds, loadMachines, loadWorkOrders, loadStorageLocations]);

  // ── When mold is selected, fetch its machine compat list ─────────────────
  const handleMoldSelect = async (moldId) => {
    setIssueMoldId(moldId);
    setIssueMachine(null);
    setIssueWorkOrder(null);
    setIssueStep(1);
    setMoldDetailLoading(true);
    try {
      const detail = await moldMasterApi.getById(moldId);
      // detail = { MachineCompats: [{machine_id, compatibility_status}, ...], ... }
      const compats = detail?.MachineCompats ?? detail?.machine_compatibilities ?? [];
      setCompatMachineIds(
        compats.filter(c => c.compatibility_status === 'compatible').map(c => c.machine_id)
      );
    } catch {
      setCompatMachineIds([]);
    } finally {
      setMoldDetailLoading(false);
    }
  };

  // ── Issue handlers ───────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!issueMoldId || !issueWorkOrder || !issueMachine) {
      message.error('Please select a mold, work order, and machine');
      return;
    }
    setVerifying(true);
    try {
      // Route: GET /:moldId/verify/:woId/:machineId
      // woId  = wo_no string, machineId = machine integer id
      const data = await moldIssueReturnApi.verifyForIssue(issueMoldId, issueWorkOrder, issueMachine);
      // After double-unwrap: data = { checks: { ... } }
      const checksObj = data?.checks ?? data ?? {};
      setVerifyResult({ checks: checksObj });
      setIssueStep(2);
    } catch (err) {
      message.error(getErrMsg(err, 'Verification failed'));
    } finally { setVerifying(false); }
  };

  // All checks must be 'pass' or 'warn' — 'fail' blocks issuance
  const allChecksPassed = verifyResult?.checks
    ? Object.values(verifyResult.checks).every((ch) => ch.result !== 'fail')
    : false;

  const handleIssueMold = async () => {
    setIssuing(true);
    try {
      await moldIssueReturnApi.issueMold(issueMoldId, {
        work_order_id: issueWorkOrder,   // wo_no — backend resolves to UUID
        machine_id: issueMachine,        // integer id
      });
      message.success('Mold issued successfully');
      loadMolds();
      resetIssueForm();
    } catch (err) {
      message.error(getErrMsg(err, 'Failed to issue mold'));
    } finally { setIssuing(false); }
  };

  const handleIssueWithOverride = async () => {
    if (!overrideReason.trim()) {
      message.error('Please provide an override reason');
      return;
    }
    setIssuing(true);
    try {
      await moldIssueReturnApi.issueWithOverride(issueMoldId, {
        work_order_id: issueWorkOrder,
        machine_id: issueMachine,
        override_reason: overrideReason,
      });
      message.success('Mold issued with override');
      setOverrideModalOpen(false);
      loadMolds();
      resetIssueForm();
    } catch (err) {
      message.error(getErrMsg(err, 'Failed to issue mold with override'));
    } finally { setIssuing(false); }
  };

  const resetIssueForm = () => {
    setIssueStep(0);
    setIssueMoldId(null);
    setIssueWorkOrder(null);
    setIssueMachine(null);
    setCompatMachineIds([]);
    setVerifyResult(null);
    setOverrideReason('');
  };

  // ── Return handlers ──────────────────────────────────────────────────────
  const handleInitiateReturn = async () => {
    if (!returnMoldId) { message.error('Please select a mold'); return; }
    setReturning(true);
    try {
      const res = await moldIssueReturnApi.returnMold(returnMoldId, { notes: returnNotes });
      const record = res?.id ? res : (res?.data ?? res);
      setReturnResult(record);
      setReturnStep(2);
      message.success('Return initiated — please complete the inspection');
    } catch (err) {
      message.error(getErrMsg(err, 'Failed to initiate return'));
    } finally { setReturning(false); }
  };

  const handleSubmitInspection = async () => {
    let vals;
    try { vals = await inspectionForm.validateFields(); }
    catch { return; }  // AntD inline errors shown

    setInspecting(true);
    try {
      const issueReturnId = returnResult?.id;
      if (!issueReturnId) { message.error('Return record ID missing — please try again'); return; }
      await moldIssueReturnApi.inspectReturn(issueReturnId, {
        ...vals,
        inspection_type: 'return',
      });
      message.success('Inspection submitted successfully');
      loadMolds();
      loadStorageLocations();
      resetReturnForm();
    } catch (err) {
      message.error(getErrMsg(err, 'Failed to submit inspection'));
    } finally { setInspecting(false); }
  };

  const resetReturnForm = () => {
    setReturnStep(0);
    setReturnMoldId(null);
    setReturnNotes('');
    setReturnResult(null);
    inspectionForm.resetFields();
  };

  // ── History handlers ─────────────────────────────────────────────────────
  const loadHistory = async (moldId) => {
    if (!moldId) return;
    setHistoryLoading(true);
    try {
      const data = await moldIssueReturnApi.getHistory(moldId);
      setHistory(Array.isArray(data) ? data : (data?.rows ?? []));
    } catch { message.error('Failed to load history'); }
    finally { setHistoryLoading(false); }
  };

  // ── History table columns ────────────────────────────────────────────────
  const historyColumns = [
    { title: 'Type', key: 'type', width: 90,
      render: (_, r) => <Tag color={r.type === 'issue' ? 'blue' : 'green'}>{(r.type||'').toUpperCase()}</Tag> },
    { title: 'Work Order', key: 'wo', width: 150,
      render: (_, r) => r.WorkOrder?.wo_no ?? r.work_order_id ?? '—' },
    { title: 'Machine', key: 'machine', width: 130,
      render: (_, r) => r.Machine?.name ?? r.machine_id ?? '—' },
    { title: 'Issued By', key: 'issuedBy', width: 130,
      render: (_, r) => r.IssuedBy?.name ?? '—' },
    { title: 'Returned By', key: 'returnedBy', width: 130,
      render: (_, r) => r.ReturnedBy?.name ?? '—' },
    { title: 'Issue Date', key: 'issueDate', width: 160,
      render: (_, r) => fmtDateTime(r.issue_date) },
    { title: 'Return Date', key: 'returnDate', width: 160,
      render: (_, r) => fmtDateTime(r.return_date) },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', width: 200, ellipsis: true,
      render: (v) => v || '—' },
  ];

  // ── Derived mold lists ───────────────────────────────────────────────────
  const availableMolds    = allMolds.filter(m => ['in_storage','production_ready','registered'].includes(m.status));
  const inProductionMolds = allMolds.filter(m => m.status === 'in_production');

  // Machine options — compatible ones shown first with a badge
  const machineOptions = [
    ...allMachines
      .filter(m => compatMachineIds.includes(m.id))
      .map(m => ({ label: `✓ ${m.name} (Compatible)`, value: m.id })),
    ...allMachines
      .filter(m => !compatMachineIds.includes(m.id))
      .map(m => ({ label: m.name, value: m.id })),
  ];

  // Work order options
  const workOrderOptions = allWorkOrders.map(wo => ({
    label: `${wo.wo_no}  [${wo.status}]`,
    value: wo.wo_no,   // pass wo_no — backend searches by wo_no
  }));

  // Storage location options
  const locationOptions = storageLocations.map(l => ({
    label: `Rack ${l.rack_number} · Shelf ${l.shelf_number} · Pos ${l.position_number}${l.status === 'occupied' ? ' (occupied)' : ''}`,
    value: l.id,
    disabled: l.status === 'occupied',
  }));

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabItems = [
    // ── Issue Mold ──────────────────────────────────────────────────────────
    {
      key: 'issue',
      label: <span><ExportOutlined style={{ marginRight: 6 }} />Issue Mold</span>,
      children: (
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: '20px' }}>
          <Steps current={issueStep} style={{ marginBottom: 24 }}
            items={[{ title: 'Select Mold' }, { title: 'Work Order & Machine' }, { title: 'Verify & Issue' }]}
          />

          {/* Step 0 */}
          {issueStep === 0 && (
            <div style={{ maxWidth: 520 }}>
              <Form.Item label="Select Mold" style={{ marginBottom: 16 }}>
                <Select
                  showSearch optionFilterProp="label"
                  placeholder="Search available molds (in_storage / production_ready)..."
                  loading={masterLoading}
                  value={issueMoldId}
                  onChange={handleMoldSelect}
                  options={availableMolds.map(m => ({
                    label: `${m.mold_code} — ${m.name}  (${m.status})`,
                    value: m.id,
                  }))}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              {availableMolds.length === 0 && !masterLoading && (
                <Alert type="info" message="No molds available" description="Molds must have status 'in_storage' or 'production_ready'." showIcon />
              )}
            </div>
          )}

          {/* Step 1 */}
          {issueStep === 1 && (
            <Spin spinning={moldDetailLoading} tip="Loading mold details...">
              <div style={{ maxWidth: 520 }}>
                <Form.Item label="Work Order" style={{ marginBottom: 16 }}>
                  <Select
                    showSearch optionFilterProp="label"
                    placeholder="Select work order..."
                    loading={masterLoading}
                    value={issueWorkOrder}
                    onChange={setIssueWorkOrder}
                    options={workOrderOptions}
                    style={{ width: '100%' }}
                    notFoundContent={masterLoading ? <Spin size="small" /> : 'No open work orders found'}
                  />
                </Form.Item>
                <Form.Item label="Machine" style={{ marginBottom: 16 }}>
                  <Select
                    showSearch optionFilterProp="label"
                    placeholder="Select machine..."
                    loading={masterLoading}
                    value={issueMachine}
                    onChange={setIssueMachine}
                    options={machineOptions}
                    style={{ width: '100%' }}
                    notFoundContent={masterLoading ? <Spin size="small" /> : 'No machines found'}
                  />
                  {compatMachineIds.length > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ✓ = Compatible machines listed first
                    </Text>
                  )}
                </Form.Item>
                <Space>
                  <Button onClick={() => { setIssueStep(0); setCompatMachineIds([]); }}>Back</Button>
                  <Button
                    type="primary"
                    onClick={handleVerify}
                    loading={verifying}
                    disabled={!issueWorkOrder || !issueMachine}
                  >
                    Run Verification
                  </Button>
                </Space>
              </div>
            </Spin>
          )}

          {/* Step 2 — Verification results */}
          {issueStep === 2 && verifyResult && (
            <div>
              <Text style={{ fontWeight: 600, fontSize: 15, display: 'block', marginBottom: 16 }}>
                Verification Results
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {Object.entries(verifyResult.checks || {}).map(([key, check]) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 12px', borderRadius: 8, border: '1px solid #e8eaed',
                    background: check.result === 'pass' ? '#f6ffed' : check.result === 'fail' ? '#fff2f0' : '#fffbe6',
                  }}>
                    {check.result === 'pass'
                      ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                      : check.result === 'fail'
                        ? <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 18 }} />
                        : <WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />}
                    <div style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 500 }}>{VERIFICATION_LABELS[key] || key}</Text>
                      {check.details && (
                        <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>{check.details}</Text>
                      )}
                    </div>
                    <Tag color={check.result === 'pass' ? 'green' : check.result === 'fail' ? 'red' : 'gold'}>
                      {(check.result || '').toUpperCase()}
                    </Tag>
                  </div>
                ))}
              </div>
              <Space wrap>
                <Button onClick={() => { setIssueStep(1); setVerifyResult(null); }}>Back</Button>
                {allChecksPassed
                  ? <Button type="primary" onClick={handleIssueMold} loading={issuing}>Issue Mold</Button>
                  : (
                    <>
                      <Alert message="One or more checks failed. Override required." type="warning" showIcon style={{ marginBottom: 0 }} />
                      {canWrite && (
                        <Button type="primary" danger onClick={() => setOverrideModalOpen(true)} loading={issuing}>
                          Issue with Override
                        </Button>
                      )}
                    </>
                  )
                }
              </Space>
            </div>
          )}

          {issueStep === 2 && !verifyResult && (
            <Alert type="error" message="Verification returned no results — please go back and retry."
              action={<Button size="small" onClick={() => setIssueStep(1)}>Back</Button>} showIcon />
          )}
        </Card>
      ),
    },

    // ── Return Mold ─────────────────────────────────────────────────────────
    {
      key: 'return',
      label: <span><ImportOutlined style={{ marginRight: 6 }} />Return Mold</span>,
      children: (
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: '20px' }}>
          <Steps current={returnStep} style={{ marginBottom: 24 }}
            items={[{ title: 'Select Mold' }, { title: 'Initiate Return' }, { title: 'Inspection' }]}
          />

          {/* Step 0 */}
          {returnStep === 0 && (
            <div style={{ maxWidth: 520 }}>
              <Form.Item label="Select Mold (In Production)" style={{ marginBottom: 16 }}>
                <Select
                  showSearch optionFilterProp="label"
                  placeholder="Search molds in production..."
                  loading={masterLoading}
                  value={returnMoldId}
                  onChange={(v) => { setReturnMoldId(v); setReturnStep(1); }}
                  options={inProductionMolds.map(m => ({ label: `${m.mold_code} — ${m.name}`, value: m.id }))}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              {inProductionMolds.length === 0 && !masterLoading && (
                <Alert type="info" message="No molds in production" description="Only molds with status 'in_production' can be returned." showIcon />
              )}
            </div>
          )}

          {/* Step 1 */}
          {returnStep === 1 && (
            <div style={{ maxWidth: 520 }}>
              <Form.Item label="Return Notes (optional)" style={{ marginBottom: 16 }}>
                <TextArea rows={3} placeholder="Notes about the return..." value={returnNotes} onChange={e => setReturnNotes(e.target.value)} />
              </Form.Item>
              <Space>
                <Button onClick={() => setReturnStep(0)}>Back</Button>
                <Button type="primary" onClick={handleInitiateReturn} loading={returning}>Initiate Return</Button>
              </Space>
            </div>
          )}

          {/* Step 2 — Inspection checklist */}
          {returnStep === 2 && (
            <div>
              <Text style={{ fontWeight: 600, fontSize: 15, display: 'block', marginBottom: 16 }}>
                Return Inspection Checklist
              </Text>
              <Form form={inspectionForm} layout="vertical" style={{ maxWidth: 600 }}>
                <Form.Item name="parting_line" label="Parting Line" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select condition..." options={[{ label: 'OK', value: 'ok' }, { label: 'Wear', value: 'wear' }, { label: 'Damage', value: 'damage' }]} />
                </Form.Item>
                <Form.Item name="cavity_surface" label="Cavity Surface" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select condition..." options={[{ label: 'OK', value: 'ok' }, { label: 'Pitting', value: 'pitting' }, { label: 'Scratch', value: 'scratch' }]} />
                </Form.Item>
                <Form.Item name="ejector_pins" label="Ejector Pins" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select condition..." options={[{ label: 'OK', value: 'ok' }, { label: 'Bent', value: 'bent' }, { label: 'Worn', value: 'worn' }]} />
                </Form.Item>
                <Form.Item name="cooling_channels" label="Cooling Channels" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select condition..." options={[{ label: 'OK', value: 'ok' }, { label: 'Blocked', value: 'blocked' }, { label: 'Leaking', value: 'leaking' }]} />
                </Form.Item>
                <Form.Item name="flash_presence" label="Flash Presence" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select..." options={[{ label: 'None', value: 'none' }, { label: 'Minor', value: 'minor' }, { label: 'Major', value: 'major' }]} />
                </Form.Item>
                <Form.Item name="overall_condition" label="Overall Condition" rules={[{ required: true, message: 'Required' }]}>
                  <Select placeholder="Select overall condition..." options={[{ label: 'Good', value: 'good' }, { label: 'Fair', value: 'fair' }, { label: 'Needs Repair', value: 'needs_repair' }]} />
                </Form.Item>
                <Form.Item name="notes" label="Inspection Notes">
                  <TextArea rows={3} placeholder="Additional notes..." />
                </Form.Item>
                <Form.Item
                  name="storage_location_id"
                  label="Assign Storage Location"
                  rules={[{ required: true, message: 'Please select a storage location' }]}
                >
                  <Select
                    showSearch optionFilterProp="label"
                    placeholder="Select available rack / shelf position..."
                    options={locationOptions}
                    notFoundContent={
                      storageLocations.length === 0
                        ? 'No storage locations found — add them in Mold Store'
                        : 'No available locations'
                    }
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Space>
                  <Button onClick={() => setReturnStep(1)}>Back</Button>
                  <Button type="primary" onClick={handleSubmitInspection} loading={inspecting}>Submit Inspection</Button>
                </Space>
              </Form>
            </div>
          )}
        </Card>
      ),
    },

    // ── History ─────────────────────────────────────────────────────────────
    {
      key: 'history',
      label: <span><HistoryOutlined style={{ marginRight: 6 }} />History</span>,
      children: (
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <Select
              showSearch optionFilterProp="label"
              placeholder="Select mold to view history"
              value={historyMoldId}
              onChange={(v) => { setHistoryMoldId(v); loadHistory(v); }}
              options={allMolds.map(m => ({ label: `${m.mold_code} — ${m.name}`, value: m.id }))}
              style={{ width: 360 }}
              allowClear
            />
          </div>

          {historyMoldId ? (
            <>
              <Table
                dataSource={history} columns={historyColumns}
                rowKey="id" size="small" loading={historyLoading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 1100 }}
              />
              {history.length > 0 && (
                <>
                  <Divider />
                  <Text style={{ fontWeight: 600, fontSize: 15, display: 'block', marginBottom: 12 }}>
                    Recent Activity Timeline
                  </Text>
                  <Timeline style={{ marginTop: 16 }}>
                    {history.slice(0, 10).map((h, idx) => (
                      <Timeline.Item key={idx} color={h.type === 'issue' ? 'blue' : 'green'}>
                        <Text style={{ fontWeight: 500 }}>{h.type === 'issue' ? 'Issued' : 'Returned'}</Text>
                        <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>
                          {h.type === 'issue' ? fmtDateTime(h.issue_date) : fmtDateTime(h.return_date)}
                        </Text>
                        {h.WorkOrder && <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>WO: {h.WorkOrder.wo_no}</Text>}
                        {h.Machine  && <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Machine: {h.Machine.name}</Text>}
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </>
              )}
            </>
          ) : <Empty description="Select a mold to view its issue/return history" />}
        </Card>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Mold</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Issue / Return</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Mold Issue / Return</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Issue molds to production, process returns with inspection, and view history.
      </Text>

      <div style={{ marginTop: 16 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </div>

      {/* Override Confirmation Modal */}
      <Modal
        title="Issue with Override"
        open={overrideModalOpen}
        onCancel={() => setOverrideModalOpen(false)}
        onOk={handleIssueWithOverride}
        confirmLoading={issuing}
        okText="Confirm Override"
        okButtonProps={{ danger: true }}
      >
        <Alert
          message="You are overriding failed checks. This action is logged with your user ID."
          type="warning" showIcon style={{ marginBottom: 16 }}
        />
        <Form.Item label="Override Reason" required>
          <TextArea rows={3} placeholder="Reason for override..." value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
        </Form.Item>
      </Modal>
    </AppLayout>
  );
}
