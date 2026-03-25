import React, { useState } from 'react';
import {
  Form, Input, Button, Typography, Radio, Select, Switch, Checkbox,
  Row, Col, message, Tag, Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  RightOutlined,
  GlobalOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ToolOutlined,
  InboxOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined,
  NumberOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { siteApi }  from '../../../api/site.api';
import AppLayout    from '../../../components/AppLayout';

const { Title, Text } = Typography;

// ── Section definitions with icons & descriptions ────────────────────────────
const SECTIONS = [
  {
    key:   'owner',
    label: 'Site & Owner Details',
    icon:  <GlobalOutlined />,
    desc:  'Basic information, addresses',
    fields: 5,
  },
  {
    key:   'production',
    label: 'Production & Planning',
    icon:  <ToolOutlined />,
    desc:  'Scheduling, approvals, nomenclature',
    fields: 9,
  },
  {
    key:   'inventory',
    label: 'Inventory & Tracking',
    icon:  <InboxOutlined />,
    desc:  'MRN, rack, bundle, unit config',
    fields: 4,
  },
  {
    key:   'costing',
    label: 'Costing & Financial',
    icon:  <DollarOutlined />,
    desc:  'Cost calculation settings',
    fields: 1,
  },
  {
    key:   'maintenance',
    label: 'Maintenance',
    icon:  <ClockCircleOutlined />,
    desc:  'Downtime template configuration',
    fields: 1,
  },
  {
    key:   'documents',
    label: 'Document & Branding',
    icon:  <FileTextOutlined />,
    desc:  'PDF settings & branding',
    fields: 1,
  },
];

// Mapping: form field name -> section key (for error navigation)
const FIELD_SECTION = {
  name: 'owner', email: 'owner', gstin: 'owner',
  invoice_addresses: 'owner', shipping_addresses: 'owner',
  machine_scheduling: 'production', production_edit_lock_window: 'production',
  manual_po_approval: 'production',
  po_prefix: 'production', po_year_format: 'production', po_separator: 'production',
  dispatch_prefix: 'production', dispatch_year_format: 'production', dispatch_separator: 'production',
  mrn_to_issue: 'inventory', rack_tracking: 'inventory',
  bundle_tracking: 'inventory', alternate_unit: 'inventory',
  costing_calculation: 'costing',
  downtime_template: 'maintenance',
  show_powered_by_pdf: 'documents',
};

// ── Select options ───────────────────────────────────────────────────────────
const YEAR_FORMATS = [
  { value: '',       label: 'None'       },
  { value: '2Y',     label: '2-digit (24)'   },
  { value: '4Y',     label: '4-digit (2024)' },
  { value: 'MMYY',   label: 'MM+2Y (0324)'  },
  { value: 'MMYYYY', label: 'MM+4Y (032024)' },
];

const SEPARATORS = [
  { value: '',  label: 'None' },
  { value: '/', label: '/'    },
  { value: '-', label: '-'    },
  { value: '_', label: '_'    },
  { value: '.', label: '.'    },
];

const LOCK_WINDOWS = [
  { value: 'never', label: 'Never (no lock)'  },
  { value: '1h',    label: '1 Hour'           },
  { value: '2h',    label: '2 Hours'          },
  { value: '4h',    label: '4 Hours'          },
  { value: '8h',    label: '8 Hours'          },
  { value: '24h',   label: '24 Hours'         },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   REUSABLE UI PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Section header inside the content panel */
const SectionHeader = ({ icon, title, description }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <div
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: '#eff6ff', border: '1px solid #bfdbfe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1d4ed8', fontSize: 15,
        }}
      >
        {icon}
      </div>
      <Text style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</Text>
    </div>
    {description && (
      <Text style={{ fontSize: 12, color: '#9ca3af', marginLeft: 42 }}>{description}</Text>
    )}
  </div>
);

/** Sub-section divider with label inside content panel */
const SubSection = ({ title, description, children }) => (
  <div
    style={{
      background: '#f8fafc',
      border: '1px solid #e8eaed',
      borderRadius: 10,
      padding: '20px 24px 8px',
      marginBottom: 20,
    }}
  >
    <div style={{ marginBottom: 16 }}>
      <Text style={{ fontWeight: 600, fontSize: 13, color: '#374151', display: 'block' }}>
        {title}
      </Text>
      {description && (
        <Text style={{ fontSize: 11, color: '#9ca3af' }}>{description}</Text>
      )}
    </div>
    {children}
  </div>
);

/** Toggle card — a nicer alternative to Yes/No radios for booleans */
const ToggleCard = ({ name, label, description }) => (
  <div
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px',
      background: '#ffffff',
      border: '1px solid #e8eaed',
      borderRadius: 10,
      marginBottom: 10,
      transition: 'border-color 0.2s',
    }}
  >
    <div style={{ flex: 1, marginRight: 16 }}>
      <Text style={{ fontWeight: 500, fontSize: 13, color: '#111827', display: 'block' }}>
        {label}
      </Text>
      {description && (
        <Text style={{ fontSize: 11, color: '#9ca3af' }}>{description}</Text>
      )}
    </div>
    <Form.Item name={name} valuePropName="checked" style={{ margin: 0 }}>
      <Switch size="small" />
    </Form.Item>
  </div>
);

/** Address repeater (Form.List) — enterprise styled */
const AddressRepeater = ({ name, label, icon }) => (
  <div style={{ marginBottom: 24 }}>
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text style={{ color: '#374151', fontWeight: 600, fontSize: 13 }}>{label}</Text>
      </div>
    </div>

    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <>
          {fields.map((field, idx) => (
            <div
              key={field.key}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e5ea',
                borderRadius: 10,
                padding: '18px 20px 6px',
                marginBottom: 12,
                position: 'relative',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 14,
                }}
              >
                <Tag
                  style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    color: '#15803d', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  }}
                >
                  Address {idx + 1}
                </Tag>
                <Tooltip title="Remove this address">
                  <Button
                    type="text" danger size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => remove(field.name)}
                    style={{ borderRadius: 6 }}
                  />
                </Tooltip>
              </div>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name={[field.name, 'line1']} label="Address Line 1">
                    <Input placeholder="Street address, building" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name={[field.name, 'line2']} label="Address Line 2">
                    <Input placeholder="Apt, suite, floor, landmark" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={[field.name, 'city']} label="City">
                    <Input placeholder="City" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={[field.name, 'state']} label="State">
                    <Input placeholder="State" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={[field.name, 'pincode']} label="Pincode">
                    <Input placeholder="400001" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          ))}

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => add()}
            block
            style={{
              borderRadius: 10, borderColor: '#bfdbfe', color: '#2563eb',
              height: 42, fontWeight: 500, fontSize: 13,
            }}
          >
            Add {label}
          </Button>
        </>
      )}
    </Form.List>
  </div>
);

/** Nomenclature row with live preview */
const NomenclatureRow = ({ prefixName, yearName, sepName, label, form }) => {
  const prefix = Form.useWatch(prefixName, form) || '';
  const year   = Form.useWatch(yearName,   form) || '';
  const sep    = Form.useWatch(sepName,    form) || '';

  // Build preview
  const yearStr = { '2Y': '24', '4Y': '2024', 'MMYY': '0324', 'MMYYYY': '032024' }[year] || '';
  const preview = [prefix, yearStr, '001'].filter(Boolean).join(sep || '');

  return (
    <div
      style={{
        background: '#ffffff', border: '1px solid #e2e5ea', borderRadius: 10,
        padding: '18px 20px 6px', marginBottom: 12,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <Text style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{label}</Text>
        {preview && (
          <Tag
            style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              color: '#1d4ed8', borderRadius: 6, fontFamily: 'monospace',
              fontWeight: 600, fontSize: 12, letterSpacing: 0.5,
            }}
          >
            Preview: {preview}
          </Tag>
        )}
      </div>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name={prefixName} label="Prefix">
            <Input placeholder="e.g. PO" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name={yearName} label="Year Format">
            <Select placeholder="Select" options={YEAR_FORMATS} allowClear />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name={sepName} label="Separator">
            <Select placeholder="Select" options={SEPARATORS} allowClear />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
};

/** Radio Card — styled radio option */
const RadioCard = ({ value, title, description, isSelected }) => (
  <div
    style={{
      padding: '14px 18px',
      background: isSelected ? '#eff6ff' : '#ffffff',
      border: `1.5px solid ${isSelected ? '#1d4ed8' : '#e8eaed'}`,
      borderRadius: 10,
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}
  >
    <Radio value={value} style={{ width: '100%' }}>
      <div style={{ marginLeft: 4 }}>
        <Text style={{
          fontWeight: 500, fontSize: 13, display: 'block',
          color: isSelected ? '#1d4ed8' : '#111827',
        }}>
          {title}
        </Text>
        {description && (
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{description}</Text>
        )}
      </div>
    </Radio>
  </div>
);


/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */
const AddSitePage = () => {
  const navigate = useNavigate();
  const [form]          = Form.useForm();
  const [activeSection, setActiveSection] = useState('owner');
  const [sectionSearch, setSectionSearch] = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [success,       setSuccess]       = useState(false);
  const [sameAsInvoice, setSameAsInvoice] = useState(false);

  // Copy invoice addresses into shipping when checkbox toggled on
  const handleSameAsInvoice = (e) => {
    const checked = e.target.checked;
    setSameAsInvoice(checked);
    if (checked) {
      const invoiceAddrs = form.getFieldValue('invoice_addresses') || [];
      // Deep-clone so they are independent objects
      const cloned = invoiceAddrs.map((addr) => ({ ...addr }));
      form.setFieldsValue({ shipping_addresses: cloned.length ? cloned : [] });
    }
  };

  // Watch downtime for radio card highlight
  const downtimeVal = Form.useWatch('downtime_template', form);

  // Filter nav items by search
  const visibleSections = sectionSearch
    ? SECTIONS.filter((s) =>
        s.label.toLowerCase().includes(sectionSearch.toLowerCase()) ||
        s.desc.toLowerCase().includes(sectionSearch.toLowerCase())
      )
    : SECTIONS;

  // Current section index for progress
  const currentIdx = SECTIONS.findIndex((s) => s.key === activeSection);

  // On validation failure — navigate to first error section
  const onFinishFailed = ({ errorFields }) => {
    if (errorFields.length > 0) {
      const firstField = String(errorFields[0].name[0]);
      const section    = FIELD_SECTION[firstField] || 'owner';
      setActiveSection(section);
      message.error('Please fix highlighted errors before submitting.');
    }
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      await siteApi.create(values);
      setSuccess(true);
      setTimeout(() => navigate('/masters/configuration'), 1800);
    } catch (err) {
      message.error(err?.message || 'Failed to create site');
    } finally {
      setSubmitting(false);
    }
  };

  // Navigate to next section
  const goNext = () => {
    const idx = SECTIONS.findIndex((s) => s.key === activeSection);
    if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].key);
  };

  // Navigate to prev section
  const goPrev = () => {
    const idx = SECTIONS.findIndex((s) => s.key === activeSection);
    if (idx > 0) setActiveSection(SECTIONS[idx - 1].key);
  };

  /* ── Success screen ───────────────────────────────────────────────────────── */
  if (success) {
    return (
      <AppLayout>
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', paddingTop: 100,
          }}
        >
          <div
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#f0fdf4', border: '2px solid #bbf7d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a' }} />
          </div>
          <Title level={3} style={{ color: '#111827', marginBottom: 6, fontWeight: 700 }}>
            Site Created Successfully
          </Title>
          <Text style={{ color: '#6b7280', fontSize: 14 }}>
            Redirecting to Configuration...
          </Text>
          <div
            style={{
              width: 180, height: 3, borderRadius: 4,
              background: '#e5e7eb', marginTop: 20, overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%', background: '#16a34a', borderRadius: 4,
                animation: 'progressBar 1.8s ease-out forwards',
              }}
            />
          </div>
          <style>{`@keyframes progressBar { from { width: 0%; } to { width: 100%; } }`}</style>
        </div>
      </AppLayout>
    );
  }

  /* ── Main form ────────────────────────────────────────────────────────────── */
  return (
    <AppLayout>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onFinishFailed={onFinishFailed}
        requiredMark={false}
        initialValues={{
          machine_scheduling:          false,
          manual_po_approval:          false,
          production_edit_lock_window: 'never',
          mrn_to_issue:                false,
          rack_tracking:               false,
          bundle_tracking:             false,
          alternate_unit:              false,
          costing_calculation:         false,
          downtime_template:           'duration_instances',
          show_powered_by_pdf:         true,
          invoice_addresses:           [],
          shipping_addresses:          [],
        }}
      >
        {/* ── Page header ────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text
              style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
              onClick={() => navigate('/masters/configuration')}
            >
              Configuration
            </Text>
            <RightOutlined style={{ color: '#d1d5db', fontSize: 9 }} />
            <Text style={{ color: '#6b7280', fontSize: 12 }}>Add New Site</Text>
          </div>

          {/* Title row */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/masters/configuration')}
                style={{
                  color: '#374151', width: 36, height: 36, padding: 0,
                  borderRadius: 8, border: '1px solid #e8eaed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              />
              <div>
                <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
                  Add New Site
                </Title>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                  Configure a new site with production, inventory and branding settings
                </Text>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                onClick={() => navigate('/masters/configuration')}
                style={{ borderRadius: 8, fontWeight: 500, height: 38 }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{ borderRadius: 8, fontWeight: 600, minWidth: 110, height: 38 }}
              >
                Create Site
              </Button>
            </div>
          </div>
        </div>

        {/* ── Progress indicator ──────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', gap: 4, marginBottom: 20,
          }}
        >
          {SECTIONS.map((sec, idx) => (
            <div
              key={sec.key}
              style={{
                flex: 1, height: 3, borderRadius: 4,
                background: idx <= currentIdx ? '#1d4ed8' : '#e5e7eb',
                transition: 'background 0.3s',
                cursor: 'pointer',
              }}
              onClick={() => setActiveSection(sec.key)}
            />
          ))}
        </div>

        {/* ── Two-panel layout ─────────────────────────────────────────────── */}
        <div className="res-two-panel" style={{ display: 'flex', gap: 20, minHeight: 'calc(100vh - 240px)' }}>

          {/* ── LEFT NAV ────────────────────────────────────────────────────── */}
          <div
            style={{
              width: 280, flexShrink: 0,
              position: 'sticky', top: 72, alignSelf: 'flex-start',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e8eaed',
                borderRadius: 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Search */}
              <div style={{ padding: '14px 14px 10px' }}>
                <Input
                  placeholder="Search sections..."
                  prefix={<SearchOutlined style={{ color: '#d1d5db' }} />}
                  size="small"
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  style={{ borderRadius: 8, fontSize: 12 }}
                  allowClear
                />
              </div>

              {/* Nav items */}
              <div style={{ padding: '0 0 8px' }}>
                {visibleSections.map((section, idx) => {
                  const isActive = activeSection === section.key;
                  const sectionIdx = SECTIONS.findIndex((s) => s.key === section.key);
                  const isVisited = sectionIdx <= currentIdx;

                  return (
                    <div
                      key={section.key}
                      onClick={() => setActiveSection(section.key)}
                      style={{
                        padding: '12px 16px 12px 14px',
                        cursor: 'pointer',
                        background: isActive ? '#eff6ff' : 'transparent',
                        borderLeft: isActive ? '3px solid #1d4ed8' : '3px solid transparent',
                        transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Icon */}
                      <div
                        style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: isActive ? '#dbeafe' : '#f3f4f6',
                          color: isActive ? '#1d4ed8' : '#6b7280',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, transition: 'all 0.15s',
                        }}
                      >
                        {section.icon}
                      </div>

                      {/* Label + description */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? '#1d4ed8' : '#374151',
                            display: 'block',
                            lineHeight: 1.3,
                          }}
                        >
                          {section.label}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.2 }}>
                          {section.desc}
                        </Text>
                      </div>

                      {/* Step number */}
                      <Text
                        style={{
                          fontSize: 10, fontWeight: 600, color: '#d1d5db',
                          fontFamily: 'monospace', flexShrink: 0,
                        }}
                      >
                        {sectionIdx + 1}/{SECTIONS.length}
                      </Text>
                    </div>
                  );
                })}

                {visibleSections.length === 0 && (
                  <Text style={{
                    display: 'block', padding: '16px', color: '#9ca3af',
                    fontSize: 12, textAlign: 'center',
                  }}>
                    No sections match your search
                  </Text>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT CONTENT ───────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e8eaed',
                borderRadius: 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                padding: '32px 36px 24px',
                minHeight: 460,
              }}
            >

              {/* ═══════════════════════════════════════
                  SECTION 1: Site / Owner Details
              ═══════════════════════════════════════ */}
              <div style={{ display: activeSection === 'owner' ? 'block' : 'none' }}>
                <SectionHeader
                  icon={<GlobalOutlined />}
                  title="Site & Owner Details"
                  description="Enter the basic information for this site"
                />

                <SubSection title="Basic Information" description="Site name, contact email and GSTIN">
                  <Row gutter={20}>
                    <Col span={8}>
                      <Form.Item
                        name="name"
                        label="Site Name"
                        rules={[{ required: true, message: 'Site name is required' }]}
                      >
                        <Input
                          prefix={<GlobalOutlined style={{ color: '#d1d5db' }} />}
                          placeholder="Dynatech Controls Pvt. Ltd."
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="email"
                        label="Email"
                        rules={[{ type: 'email', message: 'Enter a valid email' }]}
                      >
                        <Input
                          prefix={<MailOutlined style={{ color: '#d1d5db' }} />}
                          placeholder="admin@dynatech.com"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="gstin" label="GSTIN">
                        <Input
                          prefix={<SafetyCertificateOutlined style={{ color: '#d1d5db' }} />}
                          placeholder="22AAAAA0000A1Z5"
                          style={{ textTransform: 'uppercase' }}
                          maxLength={15}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </SubSection>

                <SubSection title="Addresses" description="Invoice and shipping addresses for this site">
                  <AddressRepeater
                    name="invoice_addresses"
                    label="Invoice Address"
                    icon={<FileTextOutlined style={{ color: '#6b7280', fontSize: 13 }} />}
                  />

                  {/* ── Same-as-invoice checkbox ─────────────────────────── */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 16px', marginBottom: 16,
                      background: sameAsInvoice ? '#eff6ff' : '#ffffff',
                      border: `1px solid ${sameAsInvoice ? '#bfdbfe' : '#e8eaed'}`,
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => {
                      // Allow clicking the entire card to toggle
                      handleSameAsInvoice({ target: { checked: !sameAsInvoice } });
                    }}
                  >
                    <Checkbox
                      checked={sameAsInvoice}
                      onChange={handleSameAsInvoice}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <LinkOutlined style={{ color: sameAsInvoice ? '#1d4ed8' : '#9ca3af', fontSize: 14 }} />
                    <div>
                      <Text style={{
                        fontWeight: 500, fontSize: 13, display: 'block',
                        color: sameAsInvoice ? '#1d4ed8' : '#374151',
                      }}>
                        Shipping address same as Invoice address
                      </Text>
                      <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                        {sameAsInvoice
                          ? 'Shipping addresses have been copied from invoice addresses'
                          : 'Check to auto-fill shipping addresses from invoice addresses above'}
                      </Text>
                    </div>
                  </div>

                  {/* Shipping addresses — hidden when sameAsInvoice is checked */}
                  <div style={{ display: sameAsInvoice ? 'none' : 'block' }}>
                    <AddressRepeater
                      name="shipping_addresses"
                      label="Shipping Address"
                      icon={<EnvironmentOutlined style={{ color: '#6b7280', fontSize: 13 }} />}
                    />
                  </div>
                </SubSection>
              </div>

              {/* ═══════════════════════════════════════
                  SECTION 2: Production & Planning
              ═══════════════════════════════════════ */}
              <div style={{ display: activeSection === 'production' ? 'block' : 'none' }}>
                <SectionHeader
                  icon={<ToolOutlined />}
                  title="Production & Planning Configuration"
                  description="Control machine scheduling, approvals and document numbering"
                />

                <SubSection title="Production Controls" description="Toggle features that control how production operates at this site">
                  <Row gutter={16}>
                    <Col span={8}>
                      <ToggleCard
                        name="machine_scheduling"
                        label="Machine Scheduling"
                        description="Enable machine-level scheduling"
                      />
                    </Col>
                    <Col span={8}>
                      <ToggleCard
                        name="manual_po_approval"
                        label="Manual PO Approval"
                        description="Require manual PO approval flow"
                      />
                    </Col>
                    <Col span={8}>
                      <div
                        style={{
                          padding: '14px 18px', background: '#ffffff',
                          border: '1px solid #e8eaed', borderRadius: 10, marginBottom: 10,
                        }}
                      >
                        <Text style={{
                          fontWeight: 500, fontSize: 13, color: '#111827',
                          display: 'block', marginBottom: 4,
                        }}>
                          Edit Lock Window
                        </Text>
                        <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 10 }}>
                          Lock production edits after
                        </Text>
                        <Form.Item name="production_edit_lock_window" style={{ margin: 0 }}>
                          <Select options={LOCK_WINDOWS} style={{ width: '100%' }} />
                        </Form.Item>
                      </div>
                    </Col>
                  </Row>
                </SubSection>

                <SubSection
                  title="Document Nomenclature"
                  description="Define the numbering format for PO and Dispatch documents"
                >
                  <NomenclatureRow
                    label="Purchase Order Format"
                    prefixName="po_prefix"
                    yearName="po_year_format"
                    sepName="po_separator"
                    form={form}
                  />
                  <NomenclatureRow
                    label="Dispatch Order Format"
                    prefixName="dispatch_prefix"
                    yearName="dispatch_year_format"
                    sepName="dispatch_separator"
                    form={form}
                  />
                </SubSection>
              </div>

              {/* ═══════════════════════════════════════
                  SECTION 3: Inventory & Tracking
              ═══════════════════════════════════════ */}
              <div style={{ display: activeSection === 'inventory' ? 'block' : 'none' }}>
                <SectionHeader
                  icon={<InboxOutlined />}
                  title="Inventory & Tracking Configuration"
                  description="Enable inventory modules and tracking features for this site"
                />

                <SubSection
                  title="Tracking Features"
                  description="Toggle the inventory tracking capabilities you need"
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <ToggleCard
                        name="mrn_to_issue"
                        label="MRN to Issue"
                        description="Enable Material Receipt Note to Issue flow"
                      />
                    </Col>
                    <Col span={12}>
                      <ToggleCard
                        name="rack_tracking"
                        label="Rack Tracking"
                        description="Track materials by rack location"
                      />
                    </Col>
                    <Col span={12}>
                      <ToggleCard
                        name="bundle_tracking"
                        label="Bundle Tracking"
                        description="Track materials as bundles or groups"
                      />
                    </Col>
                    <Col span={12}>
                      <ToggleCard
                        name="alternate_unit"
                        label="Alternate Unit"
                        description="Allow alternate units of measurement"
                      />
                    </Col>
                  </Row>
                </SubSection>
              </div>

              {/* ═══════════════════════════════════════
                  SECTION 4: Costing & Financial
              ═══════════════════════════════════════ */}
              <div style={{ display: activeSection === 'costing' ? 'block' : 'none' }}>
                <SectionHeader
                  icon={<DollarOutlined />}
                  title="Costing & Financial Control"
                  description="Configure cost calculation and financial features"
                />

                <SubSection
                  title="Cost Calculation"
                  description="Enable or disable the built-in costing engine for this site"
                >
                  <ToggleCard
                    name="costing_calculation"
                    label="Costing Calculation"
                    description="Automatically calculate material and production costs for orders"
                  />
                  <div
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '12px 16px',
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      borderRadius: 10, marginTop: 12,
                    }}
                  >
                    <InfoCircleOutlined style={{ color: '#1d4ed8', marginTop: 2, flexShrink: 0 }} />
                    <Text style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
                      When enabled, the system will use BOM data and material rates to
                      automatically compute production costs per order. This can be configured
                      further in the Costing module.
                    </Text>
                  </div>
                </SubSection>
              </div>

              {/* ═══════════════════════════════════════
                  SECTION 5: Maintenance
              ═══════════════════════════════════════ */}
              <div style={{ display: activeSection === 'maintenance' ? 'block' : 'none' }}>
                <SectionHeader
                  icon={<ClockCircleOutlined />}
                  title="Maintenance Configuration"
                  description="Define how downtime is recorded and tracked"
                />

                <SubSection
                  title="Downtime Template"
                  description="Choose how machine downtime entries are captured"
                >
                  <Form.Item name="downtime_template" style={{ margin: 0 }}>
                    <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                      <RadioCard
                        value="duration_instances"
                        title="Duration + Number of Instances"
                        description="Record total downtime duration and how many times it occurred"
                        isSelected={downtimeVal === 'duration_instances'}
                      />
                      <RadioCard
                        value="from_duration"
                        title="From Time + Duration"
                        description="Record when downtime started and how long it lasted"
                        isSelected={downtimeVal === 'from_duration'}
                      />
                      <RadioCard
                        value="from_to_time"
                        title="From Time + To Time"
                        description="Record the exact start and end time of each downtime event"
                        isSelected={downtimeVal === 'from_to_time'}
                      />
                    </Radio.Group>
                  </Form.Item>
                </SubSection>
              </div>

              {/* ═══════════════════════════════════════
                  SECTION 6: Document & Branding
              ═══════════════════════════════════════ */}
              <div style={{ display: activeSection === 'documents' ? 'block' : 'none' }}>
                <SectionHeader
                  icon={<FileTextOutlined />}
                  title="Document & Branding Settings"
                  description="Control PDF appearance and branding for this site"
                />

                <SubSection
                  title="PDF Branding"
                  description="Manage how your generated documents look"
                >
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '18px 22px',
                      background: '#ffffff', border: '1px solid #e8eaed', borderRadius: 10,
                    }}
                  >
                    <div style={{ flex: 1, marginRight: 16 }}>
                      <Text style={{
                        fontWeight: 600, fontSize: 14, color: '#111827', display: 'block',
                      }}>
                        Show "Powered by Dynatech ONE" in PDF
                      </Text>
                      <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'block', lineHeight: 1.5 }}>
                        When enabled, Dynatech ONE branding will appear in the footer of all
                        PDFs (invoices, dispatch notes, QC reports) generated from this site.
                      </Text>
                    </div>
                    <Form.Item name="show_powered_by_pdf" valuePropName="checked" style={{ margin: 0 }}>
                      <Switch
                        checkedChildren="Yes"
                        unCheckedChildren="No"
                      />
                    </Form.Item>
                  </div>
                </SubSection>
              </div>

            </div>{/* end content card */}

            {/* ── Bottom navigation ────────────────────────────────────────────── */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 16, padding: '0 4px',
              }}
            >
              <Button
                disabled={currentIdx === 0}
                onClick={goPrev}
                style={{ borderRadius: 8, fontWeight: 500, height: 38 }}
              >
                <ArrowLeftOutlined /> Previous
              </Button>

              <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                Step {currentIdx + 1} of {SECTIONS.length}
              </Text>

              {currentIdx < SECTIONS.length - 1 ? (
                <Button
                  type="primary"
                  onClick={goNext}
                  style={{ borderRadius: 8, fontWeight: 500, height: 38 }}
                >
                  Next <RightOutlined />
                </Button>
              ) : (
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  style={{ borderRadius: 8, fontWeight: 600, height: 38, minWidth: 110 }}
                >
                  Create Site
                </Button>
              )}
            </div>

          </div>{/* end right column */}
        </div>{/* end two-panel */}
      </Form>
    </AppLayout>
  );
};

export default AddSitePage;
