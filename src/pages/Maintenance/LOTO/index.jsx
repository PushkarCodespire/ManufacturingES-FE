import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Row, Col, Statistic, Drawer, Descriptions,
  Divider, message, Tabs, Timeline, Alert, List, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, LockOutlined, UnlockOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, SafetyOutlined,
  BulbOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import { lotoApi, equipmentApi, maintenanceAiApi } from '../../../api/maintenance.api';
import { userApi } from '../../../api/user.api';
import AppLayout from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ── CSV Upload config (for LOTO Procedures) ─────────────────────────────────
const LOTO_CSV_HEADERS = [
  'Equipment Code', 'Procedure Name', 'Hazard Type',
];
const LOTO_CSV_SAMPLE = [
  { 'Equipment Code': 'EQP-001', 'Procedure Name': 'Main Panel Isolation',
    'Hazard Type': 'Electrical' },
];
const LOTO_VALIDATION_RULES = [
  { field: 'Procedure Name', required: true },
];

const EXEC_COLOR = {
  initiated: 'blue', locked: 'orange', completed: 'green', cancelled: 'default',
};
const PERMIT_COLOR = { active: 'green', expired: 'default', cancelled: 'red' };

export default function LOTOPage() {
  const [procedures, setProcedures] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [permits, setPermits]       = useState([]);
  const [equipment, setEquipment]   = useState([]);
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState('executions');
  const [execDrawer, setExecDrawer] = useState(false);
  const [selectedExec, setSelectedExec] = useState(null);
  const [procModal, setProcModal]   = useState(false);
  const [initiateModal, setInitiateModal] = useState(false);
  const [permitModal, setPermitModal] = useState(false);
  const [lockModal, setLockModal]   = useState(false);
  const [procForm] = Form.useForm();
  const [initForm] = Form.useForm();
  const [permitForm] = Form.useForm();
  const [lockForm] = Form.useForm();
  const [lotoSuggestInfo, setLotoSuggestInfo] = useState(null); // { procedure_name, id } auto-loaded
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [procs, execs, perms] = await Promise.all([
        lotoApi.getProcedures(),
        lotoApi.getExecutions(),
        lotoApi.getPermits(),
      ]);
      // Each res IS already the array after double-unwrap (interceptor + .then(r=>r.data))
      setProcedures(Array.isArray(procs) ? procs : (procs?.data ?? []));
      setExecutions(Array.isArray(execs) ? execs : (execs?.data ?? []));
      setPermits(Array.isArray(perms) ? perms : (perms?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load LOTO data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadAll();
    equipmentApi.getAll()
      .then((r) => setEquipment(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load equipment'));
    userApi.getAll({ roles: 'production_supervisor,qa_manager,plant_head' })
      .then((r) => setUsers(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch(() => {});
  }, [loadAll]);

  const createProcedure = async (values) => {
    try {
      await lotoApi.createProcedure(values);
      message.success('LOTO procedure created');
      setProcModal(false);
      procForm.resetFields();
      loadAll();
    } catch (err) { message.error(err?.message ?? 'Failed to create procedure'); }
  };

  const initiateLoto = async (values) => {
    try {
      await lotoApi.startLoto(null, values);
      message.success('LOTO initiated — equipment is being isolated');
      setInitiateModal(false);
      initForm.resetFields();
      loadAll();
    } catch (err) { message.error(err?.message ?? 'Failed to initiate LOTO'); }
  };

  const lockLoto = async (values) => {
    try {
      // Fix: was incorrectly calling completeLoto — must call lockLoto (PATCH .../lock)
      await lotoApi.lockLoto(selectedExec.id, values);
      message.success('Equipment locked and tagged out');
      setLockModal(false);
      lockForm.resetFields();
      loadAll();
    } catch (err) { message.error(err?.message ?? 'Failed to lock LOTO'); }
  };

  const completeLoto = async (id) => {
    Modal.confirm({
      title: 'Complete LOTO?',
      content: 'This will reinstate the equipment. Ensure all work is complete and workers are clear.',
      okText: 'Complete LOTO',
      okButtonProps: { type: 'primary' },
      onOk: async () => {
        try {
          await lotoApi.completeLoto(id, {});
          message.success('LOTO completed — equipment reinstated');
          loadAll();
        } catch (err) { message.error(err?.message ?? 'Failed to complete LOTO'); }
      },
    });
  };

  const createPermit = async (values) => {
    try {
      await lotoApi.createPermit(values);
      message.success('Permit issued');
      setPermitModal(false);
      permitForm.resetFields();
      loadAll();
    } catch (err) { message.error(err?.message ?? 'Failed to create permit'); }
  };

  // ── CSV Import handler (imports LOTO Procedures) ────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const eqCode = row['Equipment Code'] || '';
        const eq = equipment.find((e) => e.equipment_code?.toLowerCase() === eqCode.toLowerCase() || e.name?.toLowerCase() === eqCode.toLowerCase());
        if (!eq) throw new Error(`Equipment "${eqCode}" not found`);
        await lotoApi.createProcedure({
          equipment_id: eq.id,
          procedure_name: row['Procedure Name'],
          hazard_type: row['Hazard Type'] || null,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Procedure Name']}": ${err?.message || 'Failed'}`);
      }
    }
    loadAll();
    return { success, failed, errors };
  };

  const activeExecs   = executions.filter((e) => e.status === 'locked').length;
  const initiatedExecs= executions.filter((e) => e.status === 'initiated').length;
  const activePermits = permits.filter((p) => p.status === 'active').length;

  const execColumns = [
    {
      title: 'Equipment',
      render: (_, r) => (
        <>
          <Text strong>{r.Equipment?.equipment_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.Equipment?.name}</Text>
        </>
      ),
    },
    { title: 'Procedure', dataIndex: ['Procedure', 'procedure_name'], render: (v) => v || '—' },
    { title: 'Hazard Type', dataIndex: ['Procedure', 'hazard_type'], render: (v) => v ? <Tag color="red">{v}</Tag> : '—' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={EXEC_COLOR[v]}>{v?.toUpperCase()}</Tag> },
    { title: 'Initiated By', dataIndex: ['InitiatedBy', 'name'], render: (v) => v || '—' },
    { title: 'Tag No.', dataIndex: 'lock_tag_number', render: (v) => v || '—' },
    { title: 'Initiated At', dataIndex: 'initiated_at', render: (v) => new Date(v).toLocaleString() },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => { setSelectedExec(r); setExecDrawer(true); }}>View</Button>
          {r.status === 'initiated' && <Button size="small" type="primary" icon={<LockOutlined />} onClick={() => { setSelectedExec(r); setLockModal(true); }}>Lock</Button>}
          {r.status === 'locked' && <Button size="small" icon={<UnlockOutlined />} onClick={() => completeLoto(r.id)}>Complete</Button>}
        </Space>
      ),
    },
  ];

  const procColumns = [
    {
      title: 'Equipment',
      render: (_, r) => (
        <>
          <Text strong>{r.Equipment?.equipment_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.Equipment?.name}</Text>
        </>
      ),
    },
    { title: 'Procedure Name', dataIndex: 'procedure_name', render: (v) => <Text strong>{v}</Text> },
    { title: 'Hazard Type', dataIndex: 'hazard_type', render: (v) => v ? <Tag color="orange">{v}</Tag> : '—' },
    { title: 'Isolation Points', dataIndex: 'isolation_points', render: (v) => <Tag>{(v || []).length} points</Tag> },
    { title: 'Steps', dataIndex: 'reinstatement_steps', render: (v) => <Tag>{(v || []).length} steps</Tag> },
  ];

  const permitColumns = [
    { title: 'Permit No.', dataIndex: 'permit_number', render: (v) => <Text strong>{v}</Text> },
    { title: 'Equipment', render: (_, r) => r.Execution?.Equipment?.equipment_code || '—' },
    { title: 'Type', dataIndex: 'permit_type', render: (v) => v || '—' },
    { title: 'Issued To', dataIndex: ['IssuedTo', 'name'], render: (v) => v || '—' },
    { title: 'Valid From', dataIndex: 'valid_from', render: (v) => new Date(v).toLocaleString() },
    { title: 'Valid To', dataIndex: 'valid_to', render: (v) => new Date(v).toLocaleString() },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={PERMIT_COLOR[v]}>{v?.toUpperCase()}</Tag> },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><LockOutlined /> LOTO & Safety</Title>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => {
            const csvRows = procedures.map((p) => ({
              'Equipment Code': p.Equipment?.equipment_code || '',
              'Procedure Name': p.procedure_name || '',
              'Hazard Type': p.hazard_type || '',
            }));
            downloadSampleCsv('loto-procedures.csv', LOTO_CSV_HEADERS, csvRows);
          }}>Export CSV</Button>
          <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={loadAll}>Refresh</Button>
          <Button icon={<PlusOutlined />} onClick={() => setProcModal(true)}>New Procedure</Button>
          <Button icon={<PlusOutlined />} onClick={() => setPermitModal(true)}>Issue Permit</Button>
          <Button type="primary" danger icon={<LockOutlined />} onClick={() => setInitiateModal(true)}>Initiate LOTO</Button>
        </Space>
      </div>

      {(activeExecs > 0 || initiatedExecs > 0) && (
        <Alert
          message={`${activeExecs} equipment(s) currently locked out${initiatedExecs ? `, ${initiatedExecs} LOTO(s) in initiation` : ''}`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={8}><Card><Statistic title="Active Lockouts" value={activeExecs} valueStyle={{ color: '#dc2626' }} prefix={<LockOutlined />} /></Card></Col>
        <Col xs={8}><Card><Statistic title="Active Permits" value={activePermits} valueStyle={{ color: '#d97706' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={8}><Card><Statistic title="Procedures Defined" value={procedures.length} prefix={<ExclamationCircleOutlined />} /></Card></Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'executions',
            label: `LOTO Executions (${executions.length})`,
            children: <ResponsiveTable columns={execColumns} dataSource={executions} rowKey="id" loading={loading} scroll={{ x: 800 }} pagination={{ pageSize: 15 }} />,
          },
          {
            key: 'procedures',
            label: `Procedures (${procedures.length})`,
            children: (
              <Table
                columns={procColumns}
                dataSource={procedures}
                rowKey="id"
                scroll={{ x: 800 }}
                pagination={{ pageSize: 15 }}
                expandable={{
                  expandedRowRender: (r) => (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Text strong>Isolation Points:</Text>
                        <List size="small" dataSource={r.isolation_points || []} renderItem={(p) => <List.Item><Text>• {p}</Text></List.Item>} />
                      </Col>
                      <Col span={12}>
                        <Text strong>Reinstatement Steps:</Text>
                        <List size="small" dataSource={r.reinstatement_steps || []} renderItem={(s, i) => <List.Item><Text>{i + 1}. {s}</Text></List.Item>} />
                      </Col>
                    </Row>
                  ),
                }}
              />
            ),
          },
          {
            key: 'permits',
            label: `Permits (${permits.length})`,
            children: <Table columns={permitColumns} dataSource={permits} rowKey="id" scroll={{ x: 800 }} pagination={{ pageSize: 15 }} />,
          },
        ]}
      />

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload LOTO Procedures"
        entityName="LOTO Procedure"
        sampleHeaders={LOTO_CSV_HEADERS}
        sampleRows={LOTO_CSV_SAMPLE}
        validationRules={LOTO_VALIDATION_RULES}
      />

      {/* LOTO Execution Drawer */}
      <Drawer title="LOTO Execution Details" width={520} open={execDrawer} onClose={() => setExecDrawer(false)} destroyOnClose>
        {selectedExec && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Equipment" span={2}>{selectedExec.Equipment?.equipment_code} — {selectedExec.Equipment?.name}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={EXEC_COLOR[selectedExec.status]}>{selectedExec.status?.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Tag No.">{selectedExec.lock_tag_number || '—'}</Descriptions.Item>
              <Descriptions.Item label="Procedure">{selectedExec.Procedure?.procedure_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Hazard">{selectedExec.Procedure?.hazard_type || '—'}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left">Timeline</Divider>
            <Timeline>
              <Timeline.Item color="blue">Initiated at {new Date(selectedExec.initiated_at).toLocaleString()}</Timeline.Item>
              {selectedExec.locked_at && <Timeline.Item color="orange">Locked at {new Date(selectedExec.locked_at).toLocaleString()}</Timeline.Item>}
              {selectedExec.completed_at && <Timeline.Item color="green">Completed at {new Date(selectedExec.completed_at).toLocaleString()}</Timeline.Item>}
            </Timeline>
            {(selectedExec.Permits || []).length > 0 && (
              <>
                <Divider orientation="left">Permits ({selectedExec.Permits.length})</Divider>
                {selectedExec.Permits.map((p) => (
                  <Card key={p.id} size="small" style={{ marginBottom: 8 }}>
                    <Space>
                      <Text strong>{p.permit_number}</Text>
                      <Tag color={PERMIT_COLOR[p.status]}>{p.status}</Tag>
                    </Space>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Create Procedure Modal */}
      <Modal title="New LOTO Procedure" open={procModal} onCancel={() => setProcModal(false)} footer={null} width={560}>
        <Form form={procForm} layout="vertical" onFinish={createProcedure}>
          <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
            <Select showSearch filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())} options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))} />
          </Form.Item>
          <Form.Item name="procedure_name" label="Procedure Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="hazard_type" label="Hazard Type"><Input placeholder="Electrical, Pneumatic, Hydraulic..." /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Create</Button>
            <Button onClick={() => setProcModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Initiate LOTO Modal */}
      <Modal
        title="🔒 Initiate LOTO"
        open={initiateModal}
        onCancel={() => { setInitiateModal(false); setLotoSuggestInfo(null); initForm.resetFields(); }}
        footer={null}
      >
        <Alert message="Equipment will be isolated for maintenance. Ensure all operators are informed." type="warning" showIcon style={{ marginBottom: 16 }} />
        <Form form={initForm} layout="vertical" onFinish={initiateLoto}>
          <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
              onChange={async (equipId) => {
                // MNT-011: auto-suggest LOTO procedure for selected equipment
                setLotoSuggestInfo(null);
                initForm.setFieldsValue({ procedure_id: undefined });
                try {
                  const res = await maintenanceAiApi.getLotoSuggestion(equipId);
                  const suggested = res?.suggested ?? null;
                  if (suggested) {
                    initForm.setFieldsValue({ procedure_id: suggested.id });
                    setLotoSuggestInfo(suggested);
                  }
                } catch { /* silent */ }
              }}
            />
          </Form.Item>
          <Form.Item
            name="procedure_id"
            label={
              <Space size={4}>
                <span>LOTO Procedure</span>
                {lotoSuggestInfo && (
                  <Tooltip title={`Auto-suggested: "${lotoSuggestInfo.procedure_name}"`}>
                    <Tag color="blue" icon={<BulbOutlined />} style={{ fontSize: 11 }}>AI Suggested</Tag>
                  </Tooltip>
                )}
              </Space>
            }
          >
            <Select allowClear options={procedures.map((p) => ({ value: p.id, label: p.procedure_name }))} />
          </Form.Item>
          <Form.Item name="lock_tag_number" label="Lock/Tag Number"><Input placeholder="e.g. LT-0042" /></Form.Item>
          <Space>
            <Button type="primary" danger htmlType="submit"><LockOutlined /> Initiate Lockout</Button>
            <Button onClick={() => setInitiateModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Lock Modal */}
      <Modal title="Confirm Lock & Tagout" open={lockModal} onCancel={() => setLockModal(false)} footer={null}>
        <Form form={lockForm} layout="vertical" onFinish={lockLoto}>
          <Form.Item name="lock_tag_number" label="Lock Tag Number"><Input placeholder="Physical tag applied to energy source" /></Form.Item>
          <Form.Item name="notes" label="Notes"><TextArea rows={3} /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<LockOutlined />}>Confirm Lockout</Button>
            <Button onClick={() => setLockModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Issue Permit Modal */}
      <Modal title="Issue Work Permit" open={permitModal} onCancel={() => setPermitModal(false)} footer={null} width={520}>
        <Form form={permitForm} layout="vertical" onFinish={createPermit}>
          <Form.Item name="execution_id" label="LOTO Execution" rules={[{ required: true, message: 'Select a locked execution' }]}>
            <Select
              options={executions.filter((e) => e.status === 'locked').map((e) => ({ value: e.id, label: `${e.Equipment?.equipment_code} — Tag: ${e.lock_tag_number || 'N/A'}` }))}
              placeholder="Select active lockout"
              notFoundContent="No locked executions — lock an execution first"
            />
          </Form.Item>
          <Form.Item name="permit_type" label="Permit Type"><Input placeholder="Hot work, Confined space, General..." /></Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="issued_to" label="Issued To" rules={[{ required: true, message: 'Select the worker this permit is issued to' }]}>
                <Select
                  showSearch
                  filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                  options={users.map((u) => ({ value: u.id, label: `${u.name}${u.employee_id ? ` (${u.employee_id})` : ''}` }))}
                  placeholder="Select worker"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="authorized_by" label="Authorized By" rules={[{ required: true, message: 'Select the supervisor authorizing this permit' }]}>
                <Select
                  showSearch
                  filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                  options={users.map((u) => ({ value: u.id, label: `${u.name}${u.employee_id ? ` (${u.employee_id})` : ''}` }))}
                  placeholder="Select supervisor"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}><Form.Item name="valid_from" label="Valid From" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item name="valid_to" label="Valid To" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item></Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit">Issue Permit</Button>
            <Button onClick={() => setPermitModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </AppLayout>
  );
}
