import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Typography, Modal, message,
  Tag, Tooltip, Form, Input, Switch, Divider, Select,
  InputNumber, Alert,
} from 'antd';
import {
  ReloadOutlined,
  RightOutlined,
  SettingOutlined,
  ApiOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { integrationApi } from '../../../api/integration.api';
import AppLayout          from '../../../components/AppLayout';
import usePermissions     from '../../../hooks/usePermissions';

dayjs.extend(relativeTime);

const { Title, Text }  = Typography;
const { Option }       = Select;

const fmtDate    = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');
const fmtFromNow = (iso) => (iso ? dayjs(iso).fromNow() : '—');

const LEVEL_COLOR  = { success: 'green', info: 'blue', warn: 'orange', error: 'red' };
const ACTION_LABEL = { configure: 'Config', test: 'Test', sync: 'Sync', error: 'Error' };

// ── Real-world configuration schema per integration ────────────────────────────
//
// Field types supported:
//   text | password | number | select | switch | textarea
//
// Each field can have:
//   section  — renders a labelled divider before this field
//   help     — small grey hint below the input
//   options  — required for type: 'select'
//   default  — pre-filled default value
//   required — marks field as required (visual asterisk)
//
const INTEGRATION_META = {

  // ── ZOHO ── (Zoho Books / CRM, OAuth 2.0 + REST API) ──────────────────────
  zoho: {
    color:       '#dc2626',
    bg:          '#fef2f2',
    border:      '#fca5a5',
    initials:    'Z',
    docsUrl:     'https://www.zoho.com/books/api/v3/',
    description: 'Zoho CRM & Books — customer sync, invoicing and payment reconciliation',
    note:        'Requires a Server-based OAuth 2.0 application in Zoho Developer Console. Scopes needed: ZohoBooks.fullaccess.all',
    fields: [
      // ── Connection ──────────────────────────────────────
      {
        section:   'Connection',
        name:      'data_center',
        label:     'Data Center',
        type:      'select',
        required:  true,
        help:      'Select the region where your Zoho account was created',
        options: [
          { value: 'in',     label: 'India  (accounts.zoho.in)'     },
          { value: 'com',    label: 'US  (accounts.zoho.com)'       },
          { value: 'eu',     label: 'Europe  (accounts.zoho.eu)'    },
          { value: 'com.au', label: 'Australia  (accounts.zoho.com.au)' },
          { value: 'jp',     label: 'Japan  (accounts.zoho.jp)'     },
        ],
      },

      // ── OAuth 2.0 App Credentials ──────────────────────
      {
        section:  'OAuth 2.0 Credentials',
        name:     'client_id',
        label:    'Client ID',
        type:     'text',
        required: true,
        help:     'From Zoho Developer Console → API Console → Server-based Application',
        placeholder: '1000.XXXXXXXXXXXXXXXXXXXXXX',
      },
      {
        name:        'client_secret',
        label:       'Client Secret',
        type:        'password',
        required:    true,
        help:        'Keep this secret — never expose in client-side code',
        placeholder: '••••••••••••••••••••',
      },
      {
        name:        'refresh_token',
        label:       'Refresh Token',
        type:        'password',
        help:        'Long-lived token obtained after the one-time OAuth authorization flow. Rotate every 365 days.',
        placeholder: '1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      },

      // ── Zoho Organisation ─────────────────────────────
      {
        section:     'Organisation',
        name:        'organization_id',
        label:       'Organization ID',
        type:        'text',
        required:    true,
        help:        'Zoho Books: Settings → General → Organisation Profile → Organisation ID',
        placeholder: '12345678',
      },
      {
        name:        'crm_account_id',
        label:       'CRM Account ID',
        type:        'text',
        help:        'Optional — used to link Zoho CRM for customer data sync',
        placeholder: '173xxxxxxxxxxxx',
      },

      // ── Sync Settings ─────────────────────────────────
      {
        section:  'Sync Settings',
        name:     'sync_module',
        label:    'Sync Module',
        type:     'select',
        required: true,
        help:     'Which Zoho module to integrate with',
        options: [
          { value: 'books',        label: 'Zoho Books (Invoicing & Accounting)' },
          { value: 'crm',          label: 'Zoho CRM (Customers & Contacts)'     },
          { value: 'books_crm',    label: 'Books + CRM'                         },
          { value: 'inventory',    label: 'Zoho Inventory'                      },
        ],
      },
      {
        name:     'auto_sync',
        label:    'Enable Auto Sync',
        type:     'switch',
        help:     'Automatically sync data at the interval set below',
      },
      {
        name:        'sync_interval_minutes',
        label:       'Sync Interval (minutes)',
        type:        'number',
        default:     60,
        help:        'Minimum: 15 minutes',
        placeholder: '60',
      },
    ],
  },

  // ── TALLY ── (Tally Prime / ERP 9 — XML over HTTP on port 9000) ───────────
  tally: {
    color:       '#1d4ed8',
    bg:          '#eff6ff',
    border:      '#bfdbfe',
    initials:    'T',
    docsUrl:     'https://help.tallysolutions.com/tdl-reference/',
    description: 'Tally Prime / ERP 9 — accounting, GST filing, ledger and voucher sync',
    note:        'Tally must be running on the host machine with "Enable ODBC Server" turned on (Gateway of Tally → Configure → Connectivity). Default port is 9000.',
    fields: [
      // ── Server Connection ───────────────────────────────
      {
        section:     'Server Connection',
        name:        'host',
        label:       'Tally Host',
        type:        'text',
        required:    true,
        help:        'IP address or hostname of the machine running Tally. Use 127.0.0.1 if Tally is on the same server.',
        placeholder: '192.168.1.50',
      },
      {
        name:        'port',
        label:       'Port',
        type:        'number',
        required:    true,
        default:     9000,
        help:        'Default Tally ODBC port is 9000. Change only if you have configured a custom port.',
        placeholder: '9000',
      },
      {
        name:     'tally_version',
        label:    'Tally Version',
        type:     'select',
        required: true,
        options: [
          { value: 'prime_2',   label: 'Tally Prime 2.x / 3.x (2021+)'  },
          { value: 'prime_1',   label: 'Tally Prime 1.x (2020)'          },
          { value: 'erp9',      label: 'Tally ERP 9 (Release 6.x)'      },
        ],
        help: 'Used to format XML request bodies correctly',
      },

      // ── Company Details ─────────────────────────────────
      {
        section:     'Company Details',
        name:        'company_name',
        label:       'Company Name',
        type:        'text',
        required:    true,
        help:        'Must match exactly (case-sensitive) as shown in Tally\'s "Select Company" screen',
        placeholder: 'Dynatech Industries Pvt. Ltd.',
      },
      {
        name:        'gstin',
        label:       'GSTIN',
        type:        'text',
        help:        'Used to validate ledger entries during sync',
        placeholder: '27AAAAA0000A1Z5',
      },
      {
        name:     'financial_year',
        label:    'Financial Year',
        type:     'select',
        help:     'Active financial year in Tally for voucher and ledger sync',
        options: [
          { value: '2024-25', label: '2024–25' },
          { value: '2025-26', label: '2025–26' },
          { value: '2026-27', label: '2026–27' },
        ],
      },

      // ── Sync Preferences ────────────────────────────────
      {
        section:  'Sync Preferences',
        name:     'sync_direction',
        label:    'Sync Direction',
        type:     'select',
        required: true,
        options: [
          { value: 'push',  label: 'Push to Tally (Dynatech → Tally)'     },
          { value: 'pull',  label: 'Pull from Tally (Tally → Dynatech)'   },
          { value: 'both',  label: 'Bidirectional'                         },
        ],
        help: '"Push" sends invoices and vouchers to Tally. "Pull" imports ledgers and balances.',
      },
      {
        name:  'sync_ledgers',
        label: 'Sync Ledgers',
        type:  'switch',
        help:  'Import chart of accounts and ledger balances from Tally',
      },
      {
        name:  'sync_stock_items',
        label: 'Sync Stock Items',
        type:  'switch',
        help:  'Import item master data from Tally',
      },
      {
        name:  'sync_vouchers',
        label: 'Sync Vouchers / Transactions',
        type:  'switch',
        help:  'Push purchase orders, sales invoices and payment vouchers to Tally',
      },
      {
        name:    'auto_sync',
        label:   'Enable Auto Sync',
        type:    'switch',
      },
      {
        name:        'sync_interval_minutes',
        label:       'Sync Interval (minutes)',
        type:        'number',
        default:     30,
        placeholder: '30',
        help:        'How often to run automatic sync. Recommended: 30 min.',
      },
    ],
  },

  // ── SAP ── (SAP S/4HANA / ERP — oData REST or RFC) ───────────────────────
  sap: {
    color:       '#16a34a',
    bg:          '#f0fdf4',
    border:      '#bbf7d0',
    initials:    'S',
    docsUrl:     'https://api.sap.com/shell/discover/contentpackage/SAPS4HANACloud',
    description: 'SAP S/4HANA / ERP — purchase orders, goods receipts, material master and FI sync',
    note:        'Supports SAP oData REST API (recommended for S/4HANA) and SAP RFC/BAPI for on-premise ERP. Create a dedicated technical user with minimum required authorisation objects.',
    fields: [
      // ── Connection ──────────────────────────────────────
      {
        section:  'Connection Type',
        name:     'connection_type',
        label:    'Connection Method',
        type:     'select',
        required: true,
        help:     'Choose REST for S/4HANA Cloud or on-premise with ICM configured. Choose RFC for classic SAP ERP.',
        options: [
          { value: 'odata',  label: 'REST / oData  (S/4HANA Cloud & On-Premise)' },
          { value: 'rfc',    label: 'RFC / BAPI  (SAP ERP On-Premise only)'      },
          { value: 'soap',   label: 'SOAP Web Services  (Legacy)'                },
        ],
      },

      // ── Server ─────────────────────────────────────────
      {
        section:     'Server Details',
        name:        'host',
        label:       'SAP Host',
        type:        'text',
        required:    true,
        help:        'Hostname or IP of the SAP application server. e.g. s4hana.company.com or 10.0.1.50',
        placeholder: 's4hana.company.com',
      },
      {
        name:        'system_id',
        label:       'System ID (SID)',
        type:        'text',
        required:    true,
        help:        '3-character System ID, e.g. PRD for Production, QAS for QA, DEV for Development',
        placeholder: 'PRD',
      },
      {
        name:        'client',
        label:       'SAP Client',
        type:        'text',
        required:    true,
        help:        '3-digit client number configured in SAP. Typically 100 (Production), 200 (QA), 300 (Dev).',
        placeholder: '100',
      },
      {
        name:        'system_number',
        label:       'System / Instance Number',
        type:        'text',
        help:        '2-digit SAP instance number (for RFC). Typically 00. Check with BASIS team.',
        placeholder: '00',
      },
      {
        name:        'base_service_url',
        label:       'oData Base URL',
        type:        'text',
        help:        'For REST/oData only. e.g. https://host:8000/sap/opu/odata/sap',
        placeholder: 'https://s4hana.company.com:8000/sap/opu/odata/sap',
      },

      // ── Authentication ─────────────────────────────────
      {
        section:     'Authentication',
        name:        'username',
        label:       'Technical User',
        type:        'text',
        required:    true,
        help:        'Dedicated service account (type: System). Never use a personal dialog user.',
        placeholder: 'DYNATECH_SVC',
      },
      {
        name:        'password',
        label:       'Password',
        type:        'password',
        required:    true,
        help:        'Password for the technical user. Rotate every 90 days as per SAP security policy.',
        placeholder: '••••••••',
      },
      {
        name:     'language',
        label:    'Logon Language',
        type:     'select',
        default:  'EN',
        help:     'SAP logon language code. Affects text fields returned in API responses.',
        options: [
          { value: 'EN', label: 'English (EN)' },
          { value: 'DE', label: 'German (DE)'  },
          { value: 'HI', label: 'Hindi (HI)'   },
          { value: 'JA', label: 'Japanese (JA)' },
        ],
      },

      // ── Sync Scope ─────────────────────────────────────
      {
        section:  'Sync Scope',
        name:     'sync_purchase_orders',
        label:    'Sync Purchase Orders (MM)',
        type:     'switch',
        help:     'Push purchase orders to SAP MM module (Transaction ME21N / BAPI_PO_CREATE1)',
      },
      {
        name:  'sync_goods_receipts',
        label: 'Sync Goods Receipts (MIGO)',
        type:  'switch',
        help:  'Post goods receipts in SAP after inward inspection passes in Dynatech',
      },
      {
        name:  'sync_material_master',
        label: 'Sync Material Master',
        type:  'switch',
        help:  'Pull item/material data from SAP MM into Dynatech Items master',
      },
      {
        name:  'sync_fi_documents',
        label: 'Sync FI Documents',
        type:  'switch',
        help:  'Post financial documents (invoices, credit notes) to SAP FI/CO module',
      },
      {
        name:    'auto_sync',
        label:   'Enable Auto Sync',
        type:    'switch',
      },
      {
        name:        'sync_interval_minutes',
        label:       'Sync Interval (minutes)',
        type:        'number',
        default:     60,
        placeholder: '60',
        help:        'Recommended: 60 min for ERP sync to avoid SAP system overload during business hours.',
      },
    ],
  },
};

// ══════════════════════════════════════════════════════════════════════════════
//  CONFIGURE MODAL  — renders real-world fields per integration
// ══════════════════════════════════════════════════════════════════════════════
const ConfigureModal = ({ integration, open, onClose, onSaved, canWrite }) => {
  const [form]   = Form.useForm();
  const [saving, setSaving] = useState(false);

  const meta = INTEGRATION_META[integration?.slug] || {};

  useEffect(() => {
    if (open && integration) {
      // Pre-fill with saved config; set defaults for fields not yet saved
      const defaults = {};
      (meta.fields || []).forEach((f) => {
        if (f.type === 'section') return;
        if (f.default !== undefined && integration.config?.[f.name] === undefined) {
          defaults[f.name] = f.default;
        }
      });
      form.setFieldsValue({
        is_enabled: integration.is_enabled,
        ...defaults,
        ...(integration.config || {}),
      });
    }
  }, [open, integration]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }

    setSaving(true);
    try {
      const { is_enabled, ...configValues } = values;
      // Strip blanks/nulls so we don't wipe real keys with empty inputs
      const config = Object.fromEntries(
        Object.entries(configValues).filter(([, v]) => v !== '' && v != null)
      );
      await integrationApi.update(integration.id, { is_enabled, config });
      message.success(`${integration.label} configuration saved`);
      onSaved();
      onClose();
    } catch (err) {
      message.error(err?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!integration) return null;

  // ── Build form fields, injecting section dividers ─────────────────────────
  const renderField = (f) => {
    const labelEl = (
      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
        {f.label}
        {f.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </span>
    );

    let input;
    if (f.type === 'password') {
      input = <Input.Password placeholder={f.placeholder} style={{ borderRadius: 8 }} disabled={!canWrite} />;
    } else if (f.type === 'number') {
      input = (
        <InputNumber
          placeholder={f.placeholder}
          style={{ width: '100%', borderRadius: 8 }}
          min={1}
          disabled={!canWrite}
        />
      );
    } else if (f.type === 'select') {
      input = (
        <Select
          placeholder={`Select ${f.label}…`}
          style={{ width: '100%' }}
          disabled={!canWrite}
        >
          {(f.options || []).map((o) => (
            <Option key={o.value} value={o.value}>{o.label}</Option>
          ))}
        </Select>
      );
    } else if (f.type === 'switch') {
      return (
        <Form.Item
          key={f.name}
          name={f.name}
          valuePropName="checked"
          style={{ marginBottom: 14 }}
          extra={f.help ? <Text style={{ fontSize: 11, color: '#9ca3af' }}>{f.help}</Text> : null}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {labelEl}
            <Switch
              size="small"
              disabled={!canWrite}
              checkedChildren="On"
              unCheckedChildren="Off"
            />
          </div>
        </Form.Item>
      );
    } else {
      input = <Input placeholder={f.placeholder} style={{ borderRadius: 8 }} disabled={!canWrite} />;
    }

    return (
      <Form.Item
        key={f.name}
        name={f.name}
        label={labelEl}
        style={{ marginBottom: 14 }}
        rules={f.required ? [{ required: true, message: `${f.label} is required` }] : []}
        extra={f.help ? <Text style={{ fontSize: 11, color: '#9ca3af' }}>{f.help}</Text> : null}
      >
        {input}
      </Form.Item>
    );
  };

  // Walk fields and inject section headers
  let lastSection = null;
  const formElements = (meta.fields || []).reduce((acc, f) => {
    if (f.section && f.section !== lastSection) {
      lastSection = f.section;
      acc.push(
        <Divider key={`sec-${f.section}`} orientation="left" orientationMargin={0} style={{ margin: '16px 0 12px', fontSize: 11, color: '#9ca3af', borderColor: '#f0f0f0' }}>
          <Text style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {f.section}
          </Text>
        </Divider>
      );
    }
    acc.push(renderField(f));
    return acc;
  }, []);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background:  meta.bg     || '#f3f4f6',
              border:      `1px solid ${meta.border || '#e5e7eb'}`,
              display:     'flex', alignItems: 'center', justifyContent: 'center',
              color:       meta.color  || '#374151',
              fontWeight:  700, fontSize: 14,
            }}
          >
            {meta.initials || integration.label?.[0]}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Configure {integration.label}</div>
            {meta.docsUrl && (
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <LinkOutlined style={{ fontSize: 10 }} /> Official Docs
              </a>
            )}
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      onOk={canWrite ? handleSave : onClose}
      okText={canWrite ? 'Save Configuration' : 'Close'}
      cancelText="Cancel"
      okButtonProps={{ loading: saving }}
      width={580}
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 } }}
    >
      {/* Integration overview note */}
      {meta.note && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={<Text style={{ fontSize: 12 }}>{meta.note}</Text>}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      <Form form={form} layout="vertical" requiredMark={false}>
        {/* ── Enable / Disable toggle ────────────────────────────────────── */}
        <div
          style={{
            display:       'flex',
            alignItems:    'center',
            justifyContent:'space-between',
            padding:       '10px 14px',
            background:    '#f9fafb',
            border:        '1px solid #e5e7eb',
            borderRadius:  8,
            marginBottom:  20,
          }}
        >
          <div>
            <Text style={{ fontWeight: 600, fontSize: 13, color: '#111827', display: 'block' }}>
              Enable Integration
            </Text>
            <Text style={{ fontSize: 11, color: '#9ca3af' }}>
              Activates live data sync between Dynatech and {integration.label}
            </Text>
          </div>
          <Form.Item name="is_enabled" valuePropName="checked" style={{ margin: 0 }}>
            <Switch disabled={!canWrite} checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </div>

        {/* ── Dynamic integration-specific fields ────────────────────────── */}
        {formElements}
      </Form>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  INTEGRATION LOGS MODAL
// ══════════════════════════════════════════════════════════════════════════════
const LogsModal = ({ integrationId, integrationLabel, open, onClose }) => {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const req = integrationId
      ? integrationApi.getLogs(integrationId)
      : integrationApi.getAllLogs();
    req
      .then((d) => setLogs(d ?? []))
      .catch(() => message.error('Failed to load logs'))
      .finally(() => setLoading(false));
  }, [open, integrationId]);

  const columns = [
    {
      title:  'Integration',
      key:    'int',
      width:  110,
      render: (_, r) => {
        const lbl  = r.Integration?.label || integrationLabel || '—';
        const slug = r.Integration?.slug  || '';
        const cfg  = INTEGRATION_META[slug] || {};
        return (
          <Tag
            style={{
              fontWeight: 600, fontSize: 11, borderRadius: 20,
              color:       cfg.color  || '#374151',
              background:  cfg.bg     || '#f3f4f6',
              borderColor: cfg.border || '#e5e7eb',
            }}
          >
            {lbl}
          </Tag>
        );
      },
    },
    {
      title:     'Level',
      dataIndex: 'level',
      key:       'level',
      width:     85,
      render: (v) => (
        <Tag color={LEVEL_COLOR[v] || 'default'} style={{ borderRadius: 20, fontSize: 11, textTransform: 'capitalize' }}>
          {v}
        </Tag>
      ),
    },
    {
      title:     'Action',
      dataIndex: 'action',
      key:       'action',
      width:     80,
      render: (v) => <Text style={{ fontSize: 12, color: '#6b7280' }}>{ACTION_LABEL[v] || v || '—'}</Text>,
    },
    {
      title:    'Message',
      dataIndex:'message',
      key:      'message',
      ellipsis: true,
      render: (v) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title:  'Time',
      key:    'time',
      width:  130,
      render: (_, r) => (
        <Tooltip title={fmtDate(r.createdAt)}>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtFromNow(r.createdAt)}</Text>
        </Tooltip>
      ),
    },
  ];

  return (
    <Modal
      title={integrationId ? `${integrationLabel} — Logs` : 'All Integration Logs'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={860}
      destroyOnClose
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        size="small"
        pagination={{ pageSize: 15, showTotal: (t) => `${t} entries`, style: { marginBottom: 0 } }}
        scroll={{ x: 700 }}
        style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden' }}
        locale={{
          emptyText: (
            <div style={{ padding: 40 }}>
              <FileTextOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
              <Text style={{ color: '#9ca3af' }}>No log entries yet</Text>
            </div>
          ),
        }}
      />
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const IntegrationsPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('sites-integrations-create_edit_delete');

  const [integrations, setIntegrations] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [testing,      setTesting]      = useState({});

  const [configModal, setConfigModal] = useState({ open: false, record: null });
  const [logsModal,   setLogsModal]   = useState({ open: false, id: null, label: null });

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await integrationApi.getAll();
      setIntegrations(data ?? []);
    } catch {
      message.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  // ── Test connection ───────────────────────────────────────────────────────
  const handleTest = async (record) => {
    setTesting((p) => ({ ...p, [record.id]: true }));
    try {
      const res = await integrationApi.test(record.id);
      if (res.success) message.success(res.message);
      else             message.warning(res.message);
      fetchIntegrations();
    } catch {
      message.error('Connection test failed');
    } finally {
      setTesting((p) => ({ ...p, [record.id]: false }));
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const enabled  = integrations.filter((i) => i.is_enabled).length;
  const disabled = integrations.length - enabled;

  const STATS = [
    { label: 'Total',    value: integrations.length, color: '#1d4ed8', bg: '#eff6ff' },
    { label: 'Active',   value: enabled,             color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Inactive', value: disabled,            color: '#6b7280', bg: '#f9fafb' },
  ];

  // ── Status badge ──────────────────────────────────────────────────────────
  const renderStatus = (r) => {
    const hasConfig = Object.keys(r.config || {}).length > 0;
    if (!hasConfig)
      return <Tag icon={<QuestionCircleOutlined />} color="default" style={{ borderRadius: 20 }}>Not Configured</Tag>;
    if (!r.is_enabled)
      return <Tag icon={<CloseCircleOutlined />} color="default" style={{ borderRadius: 20 }}>Disabled</Tag>;
    if (r.last_test_status === 'success')
      return <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 20 }}>Connected</Tag>;
    if (r.last_test_status === 'error')
      return <Tag icon={<CloseCircleOutlined />} color="error" style={{ borderRadius: 20 }}>Error</Tag>;
    return <Tag color="processing" style={{ borderRadius: 20 }}>Configured</Tag>;
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Label',
      key:   'label',
      render: (_, r) => {
        const meta = INTEGRATION_META[r.slug] || {};
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background:  meta.bg     || '#f3f4f6',
                border:      `1px solid ${meta.border || '#e5e7eb'}`,
                display:     'flex', alignItems: 'center', justifyContent: 'center',
                color:       meta.color  || '#374151',
                fontWeight:  800, fontSize: 15,
              }}
            >
              {meta.initials || r.label?.[0]}
            </div>
            <div>
              <Text style={{ fontWeight: 600, fontSize: 13, color: '#111827', display: 'block' }}>
                {r.label}
              </Text>
              <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>
                {meta.description || r.description}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title:  'Status',
      key:    'status',
      width:  180,
      render: (_, r) => renderStatus(r),
    },
    {
      title:  'Last Tested',
      key:    'last_tested',
      width:  180,
      render: (_, r) => (
        r.last_tested_at ? (
          <div>
            <Text
              style={{
                fontSize: 12, fontWeight: 600, display: 'block',
                color: r.last_test_status === 'success' ? '#16a34a' : '#dc2626',
              }}
            >
              {r.last_test_status === 'success' ? '✓ Passed' : '✗ Failed'}
            </Text>
            <Tooltip title={fmtDate(r.last_tested_at)}>
              <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtFromNow(r.last_tested_at)}</Text>
            </Tooltip>
          </div>
        ) : (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>Never tested</Text>
        )
      ),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  145,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            size="small"
            icon={<SettingOutlined />}
            style={{ borderRadius: 6, fontSize: 12 }}
            onClick={() => setConfigModal({ open: true, record: r })}
          >
            Configure
          </Button>
          {canWrite && (
            <Tooltip title="Test Connection">
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                style={{ borderRadius: 6 }}
                loading={!!testing[r.id]}
                onClick={() => handleTest(r)}
              />
            </Tooltip>
          )}
          <Tooltip title="View Logs">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              style={{ borderRadius: 6 }}
              onClick={() => setLogsModal({ open: true, id: r.id, label: r.label })}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      {/* ── Page heading ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Sites</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Integrations</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Integration
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage third-party integrations — configure, test and monitor Zoho, Tally, SAP and more
        </Text>
      </div>

      {/* ── Stats chips ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {STATS.map((s) => (
          <div
            key={s.label}
            style={{
              padding: '8px 16px', background: s.bg,
              border: `1px solid ${s.color}30`, borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90,
            }}
          >
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{s.value}</Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchIntegrations} style={{ borderRadius: 8 }}>
            Refresh
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => setLogsModal({ open: true, id: null, label: null })}
            style={{ borderRadius: 8 }}
          >
            Integration Logs
          </Button>
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={integrations}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} integrations`, style: { marginBottom: 0 } }}
          scroll={{ x: 900 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <ApiOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No integrations available</Text>
              </div>
            ),
          }}
        />
      </Card>

      {/* ── Configure Modal ─────────────────────────────────────────────────── */}
      <ConfigureModal
        integration={configModal.record}
        open={configModal.open}
        onClose={() => setConfigModal({ open: false, record: null })}
        onSaved={fetchIntegrations}
        canWrite={canWrite}
      />

      {/* ── Logs Modal ───────────────────────────────────────────────────────── */}
      <LogsModal
        integrationId={logsModal.id}
        integrationLabel={logsModal.label}
        open={logsModal.open}
        onClose={() => setLogsModal({ open: false, id: null, label: null })}
      />
    </AppLayout>
  );
};

export default IntegrationsPage;
