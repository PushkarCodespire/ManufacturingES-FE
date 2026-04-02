import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Input, Typography, Modal, message,
  Select, Radio, TimePicker, Tabs, Tag, Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  RightOutlined,
  FileTextOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { reportApi } from '../../../../api/report.api';
import AppLayout      from '../../../../components/AppLayout';
import usePermissions from '../../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../../utils/exportCsv';
import CsvUploadModal from '../../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../../utils/csvImport';

const { Title, Text } = Typography;
const { Option }      = Select;
const { TextArea }    = Input;

const fmtDate     = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');
const fmtDownload = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY') : '—');

const PARAMETERS = ['IMS', 'DPR', 'Itemwise', 'Order', 'Inventory', 'Availability', 'Quality', 'Tool'];
const RESOURCES  = ['Machine', 'Item', 'Shift', 'Site', 'Vendor', 'Customer', 'Department', 'Process'];
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Ad-hoc'];

// ── Colour map for parameter tags ────────────────────────────────────────────
const PARAM_COLORS = {
  IMS: 'blue', DPR: 'purple', Itemwise: 'geekblue', Order: 'cyan',
  Inventory: 'green', Availability: 'volcano', Quality: 'magenta', Tool: 'gold',
};

// ── Section heading ───────────────────────────────────────────────────────────
const FieldLabel = ({ children, required }) => (
  <Text
    style={{
      fontSize:     12,
      fontWeight:   600,
      color:        '#374151',
      display:      'block',
      marginBottom: 4,
    }}
  >
    {children}
    {required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
  </Text>
);

// ── Field wrapper ─────────────────────────────────────────────────────────────
const Field = ({ label, required, children, style }) => (
  <div style={style}>
    <FieldLabel required={required}>{label}</FieldLabel>
    {children}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
//  REPORT FORM — create / edit view
// ══════════════════════════════════════════════════════════════════════════════
const ReportForm = ({ report, onBack, onSaved, canWrite }) => {
  const isEdit = Boolean(report);

  const [name,          setName]          = useState(report?.name           ?? '');
  const [type,          setType]          = useState(report?.type           ?? 'Periodic');
  const [parameter,     setParameter]     = useState(report?.parameter      ?? null);
  const [resource,      setResource]      = useState(report?.resource       ?? null);
  const [frequency,     setFrequency]     = useState(report?.frequency      ?? null);
  const [scheduledTime, setScheduledTime] = useState(
    report?.scheduled_time ? dayjs(report.scheduled_time, 'HH:mm') : dayjs('00:00', 'HH:mm')
  );
  const [email,         setEmail]         = useState(report?.email          ?? '');
  const [saving,        setSaving]        = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { message.warning('Name is required'); return; }

    const payload = {
      name:           name.trim(),
      type,
      parameter:      parameter      || null,
      resource:       resource       || null,
      frequency:      frequency      || null,
      scheduled_time: scheduledTime  ? scheduledTime.format('HH:mm') : '00:00',
      email:          email.trim()   || null,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await reportApi.update(report.id, payload);
        message.success(`"${name}" updated`);
      } else {
        await reportApi.create(payload);
        message.success(`"${name}" created`);
      }
      onSaved();
    } catch (err) {
      message.error(err?.message || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle  = { borderRadius: 8 };
  const selectStyle = { width: '100%' };

  return (
    <AppLayout>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           12,
          marginBottom:  20,
          paddingBottom: 16,
          borderBottom:  '1px solid #e5e7eb',
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ borderRadius: 8 }} />
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          {isEdit ? `Edit ${report.name}` : 'Add New Reports'}
        </Title>
      </div>

      {/* ── Form card ───────────────────────────────────────────────────── */}
      <Card
        style={{
          border:       '1px solid #e8eaed',
          borderRadius: 12,
          boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        {/* Row 1: Name | Type | Parameter | Resource */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap:                 16,
            marginBottom:        20,
          }}
        >
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Report name"
              style={inputStyle}
              disabled={!canWrite}
            />
          </Field>

          <Field label="Type" required>
            <div style={{ paddingTop: 6 }}>
              <Radio.Group
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={!canWrite}
              >
                <Radio value="Periodic">Periodic</Radio>
                <Radio value="Exception">Exception</Radio>
              </Radio.Group>
            </div>
          </Field>

          <Field label="Parameter">
            <Select
              value={parameter}
              onChange={setParameter}
              allowClear
              placeholder="Select parameter"
              style={selectStyle}
              disabled={!canWrite}
              showSearch
            >
              {PARAMETERS.map((p) => <Option key={p} value={p}>{p}</Option>)}
            </Select>
          </Field>

          <Field label="Resource">
            <Select
              value={resource}
              onChange={setResource}
              allowClear
              placeholder="Select resource"
              style={selectStyle}
              disabled={!canWrite}
              showSearch
            >
              {RESOURCES.map((r) => <Option key={r} value={r}>{r}</Option>)}
            </Select>
          </Field>
        </div>

        {/* Row 2: Frequency | Scheduled Time */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap:                 16,
            marginBottom:        20,
          }}
        >
          <Field label="Frequency">
            <Select
              value={frequency}
              onChange={setFrequency}
              allowClear
              placeholder="Select frequency"
              style={selectStyle}
              disabled={!canWrite}
            >
              {FREQUENCIES.map((f) => <Option key={f} value={f}>{f}</Option>)}
            </Select>
          </Field>

          <Field label="Scheduled Time">
            <TimePicker
              value={scheduledTime}
              onChange={setScheduledTime}
              format="HH:mm"
              style={{ width: '100%', borderRadius: 8 }}
              minuteStep={15}
              disabled={!canWrite}
            />
          </Field>

          {/* empty cols for layout balance */}
          <div /><div />
        </div>

        {/* Row 3: Email */}
        <Field label="Email" style={{ maxWidth: 600 }}>
          <TextArea
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Comma-separated recipient emails"
            rows={3}
            style={{ borderRadius: 8 }}
            disabled={!canWrite}
          />
        </Field>
      </Card>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      {canWrite && (
        <Button
          type="primary"
          loading={saving}
          onClick={handleSubmit}
          style={{ borderRadius: 8, fontWeight: 600, minWidth: 110 }}
        >
          {isEdit ? 'Update' : 'Submit'}
        </Button>
      )}
    </AppLayout>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  REPORTS LIST — tabbed table view
// ══════════════════════════════════════════════════════════════════════════════
const ReportsList = ({
  reports, loading, search, onSearchChange, onRefresh, onNew, onEdit, onDelete,
  canWrite, activeTab, onTabChange, onUploadCsv,
}) => {
  const filtered = reports.filter((r) => r.type === activeTab);

  const columns = [
    {
      title:    'Name',
      key:      'name',
      width:    220,
      ellipsis: true,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width:          32,
              height:         32,
              borderRadius:   8,
              flexShrink:     0,
              background:     '#eff6ff',
              border:         '1px solid #bfdbfe',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          '#1d4ed8',
              fontSize:       14,
            }}
          >
            <FileTextOutlined />
          </div>
          <Text
            ellipsis={{ tooltip: r.name }}
            style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13, cursor: 'pointer', flex: 1, minWidth: 0 }}
            onClick={() => onEdit(r)}
          >
            {r.name}
          </Text>
        </div>
      ),
    },
    {
      title: 'Parameter',
      key:   'parameter',
      width: 140,
      render: (_, r) =>
        r.parameter ? (
          <Tag
            color={PARAM_COLORS[r.parameter] || 'default'}
            style={{ borderRadius: 4 }}
          >
            {r.parameter}
          </Tag>
        ) : (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>
        ),
    },
    {
      title: 'Frequency',
      key:   'frequency',
      width: 120,
      render: (_, r) =>
        r.frequency ? (
          <Tag color="default" style={{ borderRadius: 4 }}>{r.frequency}</Tag>
        ) : (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>
        ),
    },
    {
      title: 'Download Date',
      key:   'download_date',
      width: 140,
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>
          {fmtDownload(r.last_downloaded_at)}
        </Text>
      ),
    },
    {
      title: 'Resource',
      key:   'resource',
      width: 130,
      render: (_, r) =>
        r.resource ? (
          <Tag color="cyan" style={{ borderRadius: 4 }}>{r.resource}</Tag>
        ) : (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>
        ),
    },
    {
      title:  'Created At',
      key:    'created',
      width:  180,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', color: '#111827' }}>
            {r.Creator?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(r.createdAt)}</Text>
        </div>
      ),
    },
    {
      title:  'Last Updated At',
      key:    'updated',
      width:  180,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', color: '#111827' }}>
            {r.Updater?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#1d4ed8' }}>{fmtDate(r.updatedAt)}</Text>
        </div>
      ),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  80,
      align:  'center',
      render: (_, r) =>
        canWrite ? (
          <Tooltip title="Delete report">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ borderRadius: 6 }}
              onClick={() => onDelete(r)}
            />
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Card
      style={{
        border:       '1px solid #e8eaed',
        borderRadius: 12,
        boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
      }}
      bodyStyle={{ padding: '0 0 4px' }}
    >
      {/* Toolbar */}
      <div
        style={{
          display:    'flex',
          gap:        10,
          alignItems: 'center',
          padding:    '14px 20px 0',
        }}
      >
        <Input
          placeholder="Search reports…"
          prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 260, borderRadius: 8 }}
          allowClear
        />
        <div style={{ flex: 1 }} />
        <Button icon={<DownloadOutlined />} onClick={() => {
          const csvRows = filtered.map((r) => ({
            'Name': r.name || '', 'Type': r.type || '', 'Parameter': r.parameter || '',
            'Resource': r.resource || '', 'Frequency': r.frequency || '',
            'Scheduled Time': r.scheduled_time || '', 'Email': r.email || '',
          }));
          downloadSampleCsv('reports.csv', REPORT_CSV_HEADERS, csvRows);
        }}>Export CSV</Button>
        {canWrite && (
          <Button icon={<UploadOutlined />} onClick={onUploadCsv} style={{ borderRadius: 8 }}>Upload CSV</Button>
        )}
        <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>
          Refresh
        </Button>
        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onNew}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            NEW
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        style={{ padding: '0 20px' }}
        items={[
          { key: 'Periodic',  label: 'Periodic'  },
          { key: 'Exception', label: 'Exception' },
        ]}
      />

      {/* Table */}
      <div style={{ padding: '0 0 4px' }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={{
            pageSize:  10,
            showTotal: (t) => `${t} ${activeTab.toLowerCase()} reports`,
            style:     { marginBottom: 0, paddingRight: 16 },
          }}
          scroll={{ x: 1200 }}
          size="middle"
          style={{ borderRadius: 0 }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <FileTextOutlined
                  style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }}
                />
                <Text style={{ color: '#9ca3af' }}>
                  No {activeTab.toLowerCase()} reports created yet
                </Text>
                {canWrite && (
                  <>
                    <br />
                    <Button
                      type="primary"
                      size="small"
                      onClick={onNew}
                      style={{ marginTop: 10 }}
                    >
                      Create First Report
                    </Button>
                  </>
                )}
              </div>
            ),
          }}
        />
      </div>
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
// ── CSV Upload config ────────────────────────────────────────────────────────
const REPORT_CSV_HEADERS = ['Name', 'Type', 'Parameter', 'Resource', 'Frequency', 'Scheduled Time', 'Email'];

const REPORT_CSV_SAMPLE = [
  {
    'Name': 'Daily Production Report', 'Type': 'Periodic', 'Parameter': 'DPR',
    'Resource': 'Machine', 'Frequency': 'Daily', 'Scheduled Time': '08:00',
    'Email': 'ops@company.com',
  },
];

const REPORT_VALIDATION_RULES = [
  { field: 'Name', required: true },
];

const ReportsPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('other-reports-create_edit_delete');

  const [reports,   setReports]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [view,      setView]      = useState('list');   // 'list' | 'create' | 'edit'
  const [selected,  setSelected]  = useState(null);
  const [activeTab, setActiveTab] = useState('Periodic');
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportApi.getAll();
      setReports(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) {
      message.error(err?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.name}"?`,
      content: 'This report definition will be permanently deleted.',
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await reportApi.delete(record.id);
          message.success(`"${record.name}" deleted`);
          fetchReports();
        } catch (err) {
          message.error(err?.message || 'Failed to delete report');
        }
      },
    });
  };

  const handleSaved = () => { setView('list'); setSelected(null); fetchReports(); };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0;
    let failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        await reportApi.create({
          name:           row['Name'] || '',
          type:           row['Type'] || 'Periodic',
          parameter:      row['Parameter'] || null,
          resource:       row['Resource'] || null,
          frequency:      row['Frequency'] || null,
          scheduled_time: row['Scheduled Time'] || '00:00',
          email:          row['Email'] || null,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Name']}": ${err?.message || 'Failed'}`);
      }
    }
    fetchReports();
    return { success, failed, errors };
  };

  // ── Client-side search ─────────────────────────────────────────────────────
  const searchFiltered = search
    ? reports.filter((r) => r.name?.toLowerCase().includes(search.toLowerCase()))
    : reports;

  // ── Form views ─────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <ReportForm
        report={null}
        onBack={() => setView('list')}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }
  if (view === 'edit' && selected) {
    return (
      <ReportForm
        report={selected}
        onBack={() => { setView('list'); setSelected(null); }}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const periodic  = reports.filter((r) => r.type === 'Periodic').length;
  const exception = reports.filter((r) => r.type === 'Exception').length;

  return (
    <AppLayout>
      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Other</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Reports</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Reports
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Define scheduled and exception reports for automated generation and delivery
        </Text>
      </div>

      {/* Stats chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Reports', value: reports.length, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Periodic',      value: periodic,        color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Exception',     value: exception,       color: '#dc2626', bg: '#fef2f2' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding:       '8px 16px',
              background:    s.bg,
              border:        `1px solid ${s.color}30`,
              borderRadius:  8,
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              minWidth:      90,
            }}
          >
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              {s.value}
            </Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      {/* List */}
      <ReportsList
        reports={searchFiltered}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onRefresh={fetchReports}
        onNew={() => setView('create')}
        onEdit={(r) => { setSelected(r); setView('edit'); }}
        onDelete={handleDelete}
        canWrite={canWrite}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onUploadCsv={() => setCsvModalOpen(true)}
      />

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Reports"
        entityName="Report"
        sampleHeaders={REPORT_CSV_HEADERS}
        sampleRows={REPORT_CSV_SAMPLE}
        validationRules={REPORT_VALIDATION_RULES}
      />
    </AppLayout>
  );
};

export default ReportsPage;
