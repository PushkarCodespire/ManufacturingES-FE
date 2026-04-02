import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, InputNumber, message, Popconfirm,
  Tabs, Descriptions, Alert, Badge, Collapse, Modal, List,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, RightOutlined,
  CheckCircleOutlined, DeleteOutlined, PlayCircleOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout       from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';
import usePermissions  from '../../../hooks/usePermissions';
import { auditPlanApi } from '../../../api/quality.api';
import { exportTableToCsv } from '../../../utils/exportCsv';
import CsvUploadModal       from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

const { Title, Text } = Typography;
const { TextArea }    = Input;
const { Panel }       = Collapse;

const STATUS_COLOR = {
  draft:       'default',
  approved:    'green',
  in_progress: 'blue',
  completed:   'cyan',
};
const FINDING_COLOR = {
  major_nc:    'red',
  minor_nc:    'orange',
  observation: 'blue',
  ofi:         'purple',
};
const FINDING_OPTS = [
  { value: 'major_nc',    label: 'Major NC'    },
  { value: 'minor_nc',    label: 'Minor NC'    },
  { value: 'observation', label: 'Observation' },
  { value: 'ofi',         label: 'OFI'         },
];
const ITEM_STATUS_OPTS = [
  { value: 'scheduled',  label: 'Scheduled'  },
  { value: 'in_progress',label: 'In Progress'},
  { value: 'completed',  label: 'Completed'  },
  { value: 'cancelled',  label: 'Cancelled'  },
];
const STANDARDS = [
  { value: 'ISO 9001:2015',        label: 'ISO 9001:2015'        },
  { value: 'IATF 16949:2016',      label: 'IATF 16949:2016'      },
  { value: 'ISO 14001:2015',       label: 'ISO 14001:2015'       },
  { value: 'ISO 45001:2018',       label: 'ISO 45001:2018'       },
  { value: 'Internal',             label: 'Internal Audit'        },
];

// ── CSV Upload config ────────────────────────────────────────────────────────
const AUDIT_CSV_HEADERS = ['Plan Name', 'Year', 'Standard', 'Notes'];
const AUDIT_CSV_SAMPLE = [
  { 'Plan Name': 'Annual Internal Audit 2025', 'Year': '2025', 'Standard': 'ISO 9001:2015', 'Notes': '' },
];
const AUDIT_VALIDATION_RULES = [
  { field: 'Plan Name', required: true },
];

export default function AuditPlanPage() {
  const { can }  = usePermissions();
  const canWrite = can('quality-audit_plan-create_edit_delete');

  const [records,      setRecords]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [createOpen,   setCreateOpen]   = useState(false);
  const [detailRow,    setDetailRow]    = useState(null);
  const [detailOpen,   setDetailOpen]   = useState(false);
  const [addItemOpen,  setAddItemOpen]  = useState(false);
  const [execItemOpen, setExecItemOpen] = useState(false);
  const [findingOpen,  setFindingOpen]  = useState(false);
  const [selItem,      setSelItem]      = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [createForm]                    = Form.useForm();
  const [addItemForm]                   = Form.useForm();
  const [execForm]                      = Form.useForm();
  const [findingForm]                   = Form.useForm();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditPlanApi.getAll({ search });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) { message.error('Failed to load audit plans'); }
    finally       { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openDetail = async (row) => {
    try {
      const full = await auditPlanApi.getById(row.id);
      setDetailRow(full);
      setDetailOpen(true);
    } catch (err) { message.error('Failed to load audit plan'); }
  };

  const reloadDetail = async () => {
    if (!detailRow) return;
    try {
      const full = await auditPlanApi.getById(detailRow.id);
      setDetailRow(full);
    } catch {}
  };

  // ── Create plan ─────────────────────────────────────────────────────────────
  const onCreate = async () => {
    try {
      const vals = await createForm.validateFields();
      setSaving(true);
      await auditPlanApi.create({ ...vals, year: parseInt(vals.year, 10) });
      message.success('Audit plan created');
      setCreateOpen(false);
      createForm.resetFields();
      fetchAll();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Create failed');
    } finally { setSaving(false); }
  };

  // ── Approve plan ────────────────────────────────────────────────────────────
  const onApprove = async (id) => {
    try {
      await auditPlanApi.approve(id);
      message.success('Audit plan approved');
      fetchAll();
      reloadDetail();
    } catch (err) { message.error(err?.message || 'Approve failed'); }
  };

  // ── Delete plan ─────────────────────────────────────────────────────────────
  const onDelete = async (id) => {
    try {
      await auditPlanApi.delete(id);
      message.success('Audit plan deleted');
      fetchAll();
    } catch (err) { message.error(err?.message || 'Delete failed'); }
  };

  // ── Add audit item ──────────────────────────────────────────────────────────
  const onAddItem = async () => {
    try {
      const vals = await addItemForm.validateFields();
      setSaving(true);
      await auditPlanApi.addItem(detailRow.id, {
        ...vals,
        scheduled_date: vals.scheduled_date?.format('YYYY-MM-DD'),
      });
      message.success('Audit item added');
      setAddItemOpen(false);
      addItemForm.resetFields();
      reloadDetail();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Add item failed');
    } finally { setSaving(false); }
  };

  // ── Execute item ────────────────────────────────────────────────────────────
  const onExecItem = async () => {
    try {
      const vals = await execForm.validateFields();
      setSaving(true);
      await auditPlanApi.executeItem(selItem.id, {
        ...vals,
        actual_date: vals.actual_date?.format('YYYY-MM-DD'),
      });
      message.success('Audit item executed');
      setExecItemOpen(false);
      execForm.resetFields();
      reloadDetail();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Execute failed');
    } finally { setSaving(false); }
  };

  // ── Add finding ─────────────────────────────────────────────────────────────
  const onAddFinding = async () => {
    try {
      const vals = await findingForm.validateFields();
      setSaving(true);
      const result = await auditPlanApi.addFinding(selItem.id, vals);
      message.success('Finding recorded');
      if (result?.capa_no) message.info(`CAPA ${result.capa_no} auto-created`);
      setFindingOpen(false);
      findingForm.resetFields();
      reloadDetail();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Add finding failed');
    } finally { setSaving(false); }
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        await auditPlanApi.create({
          plan_name: row['Plan Name'],
          year: row['Year'] ? parseInt(row['Year'], 10) : new Date().getFullYear(),
          standard: row['Standard'] || null,
          notes: row['Notes'] || null,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Plan Name']}": ${err?.message || 'Failed'}`);
      }
    }
    fetchAll();
    return { success, failed, errors };
  };

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    { title: 'Plan No.', dataIndex: 'plan_no', key: 'plan_no', width: 160 },
    { title: 'Plan Name', dataIndex: 'plan_name', key: 'plan_name', ellipsis: true },
    { title: 'Year', dataIndex: 'year', key: 'year', width: 70 },
    { title: 'Standard', dataIndex: 'standard', key: 'standard', width: 140 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Items', key: 'items', width: 100,
      render: (_, r) => {
        const items = r.Items ?? [];
        const done = items.filter((i) => i.status === 'completed').length;
        return `${done} / ${items.length}`;
      },
    },
    { title: 'Created By', key: 'creator', width: 120,
      render: (_, r) => r.Creator?.name ?? '—' },
    {
      title: '', key: 'actions', width: 160,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost onClick={() => openDetail(r)}>Open</Button>
          {canWrite && r.status === 'draft' && (
            <Popconfirm title="Approve this plan?" onConfirm={() => onApprove(r.id)} okText="Approve">
              <Button size="small" icon={<CheckCircleOutlined />}>Approve</Button>
            </Popconfirm>
          )}
          {canWrite && r.status === 'draft' && (
            <Popconfirm title="Delete?" onConfirm={() => onDelete(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const filtered = records.filter((r) =>
    !search ||
    r.plan_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.plan_name?.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Detail view ─────────────────────────────────────────────────────────────
  const renderDetail = () => {
    if (!detailRow) return null;
    const items = detailRow.Items ?? [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card bodyStyle={{ padding: '12px 16px' }} style={{ border: '1px solid #e8eaed', borderRadius: 10 }}>
          <Descriptions size="small" column={3} bordered>
            <Descriptions.Item label="Plan No.">{detailRow.plan_no}</Descriptions.Item>
            <Descriptions.Item label="Year">{detailRow.year}</Descriptions.Item>
            <Descriptions.Item label="Standard">{detailRow.standard}</Descriptions.Item>
            <Descriptions.Item label="Plan Name" span={2}>{detailRow.plan_name}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[detailRow.status] ?? 'default'}>{detailRow.status?.replace(/_/g, ' ')}</Tag>
            </Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            {canWrite && ['approved', 'in_progress'].includes(detailRow.status) && (
              <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => { addItemForm.resetFields(); setAddItemOpen(true); }}>
                Add Audit Item
              </Button>
            )}
            {canWrite && detailRow.status === 'draft' && (
              <Popconfirm title="Approve this plan?" onConfirm={() => onApprove(detailRow.id)} okText="Approve">
                <Button type="primary" icon={<CheckCircleOutlined />}>Approve Plan</Button>
              </Popconfirm>
            )}
          </div>
        </Card>

        {/* Audit items */}
        {items.length === 0 ? (
          <Alert type="info" showIcon message="No audit items yet. Add items to schedule audits." />
        ) : (
          <Collapse>
            {items.map((item) => {
              const findings = item.Findings ?? [];
              const statusTag = <Tag color={STATUS_COLOR[item.status] ?? 'default'} style={{ marginLeft: 8 }}>{item.status?.replace(/_/g, ' ')}</Tag>;
              return (
                <Panel
                  key={item.id}
                  header={
                    <span>
                      <strong>{item.process_area}</strong>
                      {item.clause_ref && <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>[{item.clause_ref}]</Text>}
                      {statusTag}
                      {item.scheduled_date && <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>📅 {item.scheduled_date}</Text>}
                    </span>
                  }
                >
                  <Descriptions size="small" column={2} bordered style={{ marginBottom: 12 }}>
                    <Descriptions.Item label="Auditor">{item.Auditor?.name ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="Duration">{item.duration_hrs ? `${item.duration_hrs} hr(s)` : '—'}</Descriptions.Item>
                    <Descriptions.Item label="Actual Date">{item.actual_date || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Finding Summary" span={2}>{item.finding_summary || '—'}</Descriptions.Item>
                  </Descriptions>

                  {findings.length > 0 && (
                    <List
                      size="small"
                      header={<Text strong>Findings ({findings.length})</Text>}
                      dataSource={findings}
                      renderItem={(f) => (
                        <List.Item>
                          <Space>
                            <Tag color={FINDING_COLOR[f.finding_type] ?? 'default'}>{f.finding_type?.replace(/_/g, ' ')}</Tag>
                            <Text style={{ fontSize: 12 }}>{f.description}</Text>
                            {f.capa_id && <Tag color="purple" style={{ fontSize: 11 }}>CAPA raised</Tag>}
                          </Space>
                        </List.Item>
                      )}
                    />
                  )}

                  {canWrite && item.status !== 'cancelled' && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      {item.status !== 'completed' && (
                        <Button size="small" icon={<PlayCircleOutlined />}
                          onClick={() => { setSelItem(item); execForm.resetFields(); setExecItemOpen(true); }}>
                          Execute / Update
                        </Button>
                      )}
                      <Button size="small" icon={<PlusOutlined />}
                        onClick={() => { setSelItem(item); findingForm.resetFields(); setFindingOpen(true); }}>
                        Add Finding
                      </Button>
                    </div>
                  )}
                </Panel>
              );
            })}
          </Collapse>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Audit Plans</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Audit Plans</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Plan, schedule, execute, and track internal quality audits with finding management.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Total: {records.length}</Tag>
        <Tag color="green">Approved: {records.filter((r) => r.status === 'approved').length}</Tag>
        <Tag color="blue">In Progress: {records.filter((r) => r.status === 'in_progress').length}</Tag>
        <Tag color="cyan">Completed: {records.filter((r) => r.status === 'completed').length}</Tag>
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input placeholder="Search plan no. or name..." prefix={<SearchOutlined />}
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }} allowClear />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => {
            const csvRows = filtered.map((r) => ({
              'Plan Name': r.plan_name || '', 'Year': r.year ?? '',
              'Standard': r.standard || '', 'Notes': r.notes || '',
            }));
            downloadSampleCsv('audit-plan.csv', AUDIT_CSV_HEADERS, csvRows);
          }}>Export CSV</Button>
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>}
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Refresh</Button>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>
              New Audit Plan
            </Button>
          )}
        </div>

        <ResponsiveTable
          rowKey="id" dataSource={filtered} columns={columns} loading={loading} size="small"
          pagination={{ pageSize: 20, showTotal: (t) => `${t} records` }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* ── Create Drawer ──────────────────────────────────────────────────────── */}
      <Drawer title="Create Audit Plan" width={480} open={createOpen} onClose={() => setCreateOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={onCreate}>Create</Button>
          </div>
        }
      >
        <Form form={createForm} layout="vertical" requiredMark={false}>
          <Form.Item name="plan_name" label="Plan Name" rules={[{ required: true }]}>
            <Input placeholder="Annual Internal Quality Audit 2026" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="year" label="Year" rules={[{ required: true }]} initialValue={new Date().getFullYear()}>
              <InputNumber min={2020} max={2099} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="standard" label="Standard" initialValue="ISO 9001:2015">
              <Select options={STANDARDS} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Scope, objectives, notes..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Detail Drawer ──────────────────────────────────────────────────────── */}
      <Drawer
        title={detailRow ? `${detailRow.plan_no} — ${detailRow.plan_name}` : 'Audit Plan Detail'}
        width={860}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {renderDetail()}
      </Drawer>

      {/* ── Add Item Modal ─────────────────────────────────────────────────────── */}
      <Modal title="Add Audit Item" open={addItemOpen} onCancel={() => setAddItemOpen(false)}
        onOk={onAddItem} confirmLoading={saving} okText="Add Item">
        <Form form={addItemForm} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
          <Form.Item name="process_area" label="Process Area" rules={[{ required: true }]}>
            <Input placeholder="e.g. Production, Procurement, Design" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="clause_ref" label="Clause Ref.">
              <Input placeholder="e.g. 8.4" />
            </Form.Item>
            <Form.Item name="duration_hrs" label="Duration (hrs)" initialValue={1}>
              <InputNumber min={0.5} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="scheduled_date" label="Scheduled Date">
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Execute Item Modal ─────────────────────────────────────────────────── */}
      <Modal title={`Execute: ${selItem?.process_area}`} open={execItemOpen}
        onCancel={() => setExecItemOpen(false)} onOk={onExecItem}
        confirmLoading={saving} okText="Save">
        <Form form={execForm} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="actual_date" label="Actual Date" initialValue={dayjs()}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="status" label="Status" initialValue="completed">
              <Select options={ITEM_STATUS_OPTS} />
            </Form.Item>
          </div>
          <Form.Item name="finding_summary" label="Finding Summary">
            <TextArea rows={3} placeholder="Summary of what was found during audit..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Add Finding Modal ──────────────────────────────────────────────────── */}
      <Modal title={`Add Finding: ${selItem?.process_area}`} open={findingOpen}
        onCancel={() => setFindingOpen(false)} onOk={onAddFinding}
        confirmLoading={saving} okText="Record Finding">
        <Form form={findingForm} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="finding_type" label="Finding Type" initialValue="observation">
              <Select options={FINDING_OPTS} />
            </Form.Item>
            <Form.Item name="clause_ref" label="Clause Ref.">
              <Input placeholder="e.g. 8.4.1" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description" rules={[{ required: true, min: 5 }]}>
            <TextArea rows={3} placeholder="Describe the finding in detail..." />
          </Form.Item>
          <Form.Item name="evidence" label="Evidence">
            <TextArea rows={2} placeholder="Objective evidence observed..." />
          </Form.Item>
          <Alert type="info" showIcon
            message="Major NC and Minor NC findings will automatically generate a CAPA." />
        </Form>
      </Modal>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Audit Plans"
        entityName="Audit Plan"
        sampleHeaders={AUDIT_CSV_HEADERS}
        sampleRows={AUDIT_CSV_SAMPLE}
        validationRules={AUDIT_VALIDATION_RULES}
      />
    </AppLayout>
  );
}
