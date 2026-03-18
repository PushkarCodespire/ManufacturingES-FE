import React, { useState, useEffect, useCallback } from 'react';
import {
  Form, Input, Button, Typography, Radio, Select, Switch, Checkbox,
  Row, Col, message, Tag, Tooltip, Spin, Badge, Skeleton,
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
  ToolOutlined,
  InboxOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  UserOutlined,
  CalendarOutlined,
  EditOutlined,
  HistoryOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { siteApi }  from '../../../api/site.api';
import AppLayout    from '../../../components/AppLayout';

const { Title, Text } = Typography;

// ── Section definitions ──────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'owner',       label: 'Site & Owner Details',   icon: <GlobalOutlined />,       desc: 'Basic information, addresses' },
  { key: 'production',  label: 'Production & Planning',  icon: <ToolOutlined />,         desc: 'Scheduling, approvals, nomenclature' },
  { key: 'inventory',   label: 'Inventory & Tracking',   icon: <InboxOutlined />,        desc: 'MRN, rack, bundle, unit config' },
  { key: 'costing',     label: 'Costing & Financial',    icon: <DollarOutlined />,       desc: 'Cost calculation settings' },
  { key: 'maintenance', label: 'Maintenance',            icon: <ClockCircleOutlined />,  desc: 'Downtime template configuration' },
  { key: 'documents',   label: 'Document & Branding',    icon: <FileTextOutlined />,     desc: 'PDF settings & branding' },
];

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
  { value: 'never', label: 'Never (no lock)' },
  { value: '1h',    label: '1 Hour'          },
  { value: '2h',    label: '2 Hours'         },
  { value: '4h',    label: '4 Hours'         },
  { value: '8h',    label: '8 Hours'         },
  { value: '24h',   label: '24 Hours'        },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   UI PRIMITIVES (same as AddSite)
   ═══════════════════════════════════════════════════════════════════════════════ */

const SectionHeader = ({ icon, title, description }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: '#eff6ff', border: '1px solid #bfdbfe',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1d4ed8', fontSize: 15,
      }}>
        {icon}
      </div>
      <Text style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</Text>
    </div>
    {description && (
      <Text style={{ fontSize: 12, color: '#9ca3af', marginLeft: 42 }}>{description}</Text>
    )}
  </div>
);

const SubSection = ({ title, description, children }) => (
  <div style={{
    background: '#f8fafc', border: '1px solid #e8eaed',
    borderRadius: 10, padding: '20px 24px 8px', marginBottom: 20,
  }}>
    <div style={{ marginBottom: 16 }}>
      <Text style={{ fontWeight: 600, fontSize: 13, color: '#374151', display: 'block' }}>{title}</Text>
      {description && <Text style={{ fontSize: 11, color: '#9ca3af' }}>{description}</Text>}
    </div>
    {children}
  </div>
);

const ToggleCard = ({ name, label, description }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', background: '#ffffff',
    border: '1px solid #e8eaed', borderRadius: 10, marginBottom: 10,
  }}>
    <div style={{ flex: 1, marginRight: 16 }}>
      <Text style={{ fontWeight: 500, fontSize: 13, color: '#111827', display: 'block' }}>{label}</Text>
      {description && <Text style={{ fontSize: 11, color: '#9ca3af' }}>{description}</Text>}
    </div>
    <Form.Item name={name} valuePropName="checked" style={{ margin: 0 }}>
      <Switch size="small" />
    </Form.Item>
  </div>
);

const AddressRepeater = ({ name, label, icon }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      {icon}
      <Text style={{ color: '#374151', fontWeight: 600, fontSize: 13 }}>{label}</Text>
    </div>
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <>
          {fields.map((field, idx) => (
            <div key={field.key} style={{
              background: '#ffffff', border: '1px solid #e2e5ea', borderRadius: 10,
              padding: '18px 20px 6px', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Tag style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  color: '#15803d', borderRadius: 6, fontSize: 11, fontWeight: 600,
                }}>
                  Address {idx + 1}
                </Tag>
                <Tooltip title="Remove this address">
                  <Button type="text" danger size="small" icon={<DeleteOutlined />}
                    onClick={() => remove(field.name)} style={{ borderRadius: 6 }} />
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
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block
            style={{ borderRadius: 10, borderColor: '#bfdbfe', color: '#2563eb', height: 42, fontWeight: 500, fontSize: 13 }}>
            Add {label}
          </Button>
        </>
      )}
    </Form.List>
  </div>
);

const NomenclatureRow = ({ prefixName, yearName, sepName, label, form }) => {
  const prefix  = Form.useWatch(prefixName, form) || '';
  const year    = Form.useWatch(yearName,   form) || '';
  const sep     = Form.useWatch(sepName,    form) || '';
  const yearStr = { '2Y': '24', '4Y': '2024', 'MMYY': '0324', 'MMYYYY': '032024' }[year] || '';
  const preview = [prefix, yearStr, '001'].filter(Boolean).join(sep || '');

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e5ea', borderRadius: 10,
      padding: '18px 20px 6px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{label}</Text>
        {preview && (
          <Tag style={{
            background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8',
            borderRadius: 6, fontFamily: 'monospace', fontWeight: 600, fontSize: 12, letterSpacing: 0.5,
          }}>
            Preview: {preview}
          </Tag>
        )}
      </div>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name={prefixName} label="Prefix"><Input placeholder="e.g. PO" /></Form.Item>
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

const RadioCard = ({ value, title, description, isSelected }) => (
  <div style={{
    padding: '14px 18px',
    background: isSelected ? '#eff6ff' : '#ffffff',
    border: `1.5px solid ${isSelected ? '#1d4ed8' : '#e8eaed'}`,
    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
  }}>
    <Radio value={value} style={{ width: '100%' }}>
      <div style={{ marginLeft: 4 }}>
        <Text style={{ fontWeight: 500, fontSize: 13, display: 'block', color: isSelected ? '#1d4ed8' : '#111827' }}>
          {title}
        </Text>
        {description && <Text style={{ fontSize: 11, color: '#9ca3af' }}>{description}</Text>}
      </div>
    </Radio>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   AUDIT INFO CARD
   ═══════════════════════════════════════════════════════════════════════════════ */
const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const AuditInfoCard = ({ site }) => {
  const items = [
    {
      icon: <UserOutlined style={{ color: '#16a34a' }} />,
      label: 'Created by',
      value: site.Creator?.name || '—',
      sub:   site.Creator?.employee_id || '',
      time:  formatDate(site.createdAt),
      color: '#f0fdf4',
      border: '#bbf7d0',
    },
    {
      icon: <EditOutlined style={{ color: '#1d4ed8' }} />,
      label: 'Last updated by',
      value: site.Updater?.name || '—',
      sub:   site.Updater?.employee_id || '',
      time:  formatDate(site.updatedAt),
      color: '#eff6ff',
      border: '#bfdbfe',
    },
  ];

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e8eaed',
      borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      padding: '18px 20px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <HistoryOutlined style={{ color: '#6b7280', fontSize: 14 }} />
        <Text style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Audit Trail</Text>
      </div>

      <Row gutter={16}>
        {items.map((item) => (
          <Col span={12} key={item.label}>
            <div style={{
              background: item.color, border: `1px solid ${item.border}`,
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {item.icon}
                <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {item.label}
                </Text>
              </div>
              <Text style={{ fontWeight: 600, fontSize: 14, color: '#111827', display: 'block' }}>
                {item.value}
              </Text>
              {item.sub && (
                <Text style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', display: 'block', marginBottom: 4 }}>
                  {item.sub}
                </Text>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <CalendarOutlined style={{ fontSize: 11, color: '#9ca3af' }} />
                <Text style={{ fontSize: 11, color: '#9ca3af' }}>{item.time}</Text>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════════════════════
   EDIT SITE PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */
const EditSitePage = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [form]    = Form.useForm();

  const [site,          setSite]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [activeSection, setActiveSection] = useState('owner');
  const [sectionSearch, setSectionSearch] = useState('');
  const [sameAsInvoice, setSameAsInvoice] = useState(false);

  const downtimeVal = Form.useWatch('downtime_template', form);

  // ── Fetch site on mount ────────────────────────────────────────────────────
  const fetchSite = useCallback(async () => {
    setLoading(true);
    try {
      const res = await siteApi.getById(id);
      const data = res.data || res;
      setSite(data);
      // Populate form — convert booleans properly for Switch (valuePropName="checked")
      form.setFieldsValue({
        name:                        data.name,
        email:                       data.email,
        gstin:                       data.gstin,
        invoice_addresses:           data.invoice_addresses  || [],
        shipping_addresses:          data.shipping_addresses || [],
        machine_scheduling:          data.machine_scheduling          ?? false,
        production_edit_lock_window: data.production_edit_lock_window ?? 'never',
        manual_po_approval:          data.manual_po_approval          ?? false,
        po_prefix:                   data.po_prefix,
        po_year_format:              data.po_year_format,
        po_separator:                data.po_separator,
        dispatch_prefix:             data.dispatch_prefix,
        dispatch_year_format:        data.dispatch_year_format,
        dispatch_separator:          data.dispatch_separator,
        mrn_to_issue:                data.mrn_to_issue    ?? false,
        rack_tracking:               data.rack_tracking   ?? false,
        bundle_tracking:             data.bundle_tracking ?? false,
        alternate_unit:              data.alternate_unit  ?? false,
        costing_calculation:         data.costing_calculation ?? false,
        downtime_template:           data.downtime_template   ?? 'duration_instances',
        show_powered_by_pdf:         data.show_powered_by_pdf ?? true,
      });
    } catch (err) {
      message.error(err?.message || 'Failed to load site details');
      navigate('/masters/configuration');
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate]);

  useEffect(() => { fetchSite(); }, [fetchSite]);

  // ── Same-as-invoice handler ────────────────────────────────────────────────
  const handleSameAsInvoice = (e) => {
    const checked = e.target.checked;
    setSameAsInvoice(checked);
    if (checked) {
      const invoiceAddrs = form.getFieldValue('invoice_addresses') || [];
      const cloned = invoiceAddrs.map((addr) => ({ ...addr }));
      form.setFieldsValue({ shipping_addresses: cloned.length ? cloned : [] });
    }
  };

  // ── Filter sections ────────────────────────────────────────────────────────
  const visibleSections = sectionSearch
    ? SECTIONS.filter((s) =>
        s.label.toLowerCase().includes(sectionSearch.toLowerCase()) ||
        s.desc.toLowerCase().includes(sectionSearch.toLowerCase())
      )
    : SECTIONS;

  const currentIdx = SECTIONS.findIndex((s) => s.key === activeSection);

  // ── Validation error nav ───────────────────────────────────────────────────
  const onFinishFailed = ({ errorFields }) => {
    if (errorFields.length > 0) {
      const firstField = String(errorFields[0].name[0]);
      const section    = FIELD_SECTION[firstField] || 'owner';
      setActiveSection(section);
      message.error('Please fix highlighted errors before saving.');
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (values) => {
    setSaving(true);
    try {
      const res = await siteApi.update(id, values);
      const updated = res?.data?.data || res?.data || res;
      setSite((prev) => ({ ...prev, ...updated }));
      message.success('Site updated successfully');
    } catch (err) {
      message.error(err?.message || 'Failed to update site');
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    const idx = SECTIONS.findIndex((s) => s.key === activeSection);
    if (idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].key);
  };
  const goPrev = () => {
    const idx = SECTIONS.findIndex((s) => s.key === activeSection);
    if (idx > 0) setActiveSection(SECTIONS[idx - 1].key);
  };

  /* ── Loading skeleton ───────────────────────────────────────────────────── */
  if (loading) {
    return (
      <AppLayout>
        <div style={{ padding: '24px 0' }}>
          <Skeleton active paragraph={{ rows: 1 }} style={{ maxWidth: 400, marginBottom: 24 }} />
          <div style={{ display: 'flex', gap: 20 }}>
            <Skeleton.Input active style={{ width: 280, height: 400 }} />
            <div style={{ flex: 1 }}>
              <Skeleton active paragraph={{ rows: 10 }} />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ── Main render ────────────────────────────────────────────────────────── */
  return (
    <AppLayout>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        onFinishFailed={onFinishFailed}
        requiredMark={false}
      >
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
              onClick={() => navigate('/masters/configuration')}>
              Configuration
            </Text>
            <RightOutlined style={{ color: '#d1d5db', fontSize: 9 }} />
            <Text style={{ color: '#6b7280', fontSize: 12 }}>Configure Site</Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button type="text" icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/masters/configuration')}
                style={{
                  color: '#374151', width: 36, height: 36, padding: 0,
                  borderRadius: 8, border: '1px solid #e8eaed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
                    {site?.name}
                  </Title>
                  <Tag style={{
                    fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
                    background: '#f3f4f6', borderRadius: 6, border: '1px solid #e5e7eb',
                    color: '#6b7280',
                  }}>
                    {site?.code}
                  </Tag>
                  {site?.is_active ? (
                    <Badge status="success" text={<Text style={{ color: '#16a34a', fontSize: 12, fontWeight: 500 }}>Active</Text>} />
                  ) : (
                    <Badge status="error" text={<Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 500 }}>Inactive</Text>} />
                  )}
                </div>
                <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                  Modify site configuration, production and branding settings
                </Text>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={() => navigate('/masters/configuration')}
                style={{ borderRadius: 8, fontWeight: 500, height: 38 }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={saving}
                icon={<SaveOutlined />}
                style={{ borderRadius: 8, fontWeight: 600, minWidth: 130, height: 38 }}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>

        {/* ── Audit Info ─────────────────────────────────────────────────── */}
        {site && <AuditInfoCard site={site} />}

        {/* ── Progress indicator ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {SECTIONS.map((sec, idx) => (
            <div key={sec.key}
              style={{
                flex: 1, height: 3, borderRadius: 4,
                background: idx <= currentIdx ? '#1d4ed8' : '#e5e7eb',
                transition: 'background 0.3s', cursor: 'pointer',
              }}
              onClick={() => setActiveSection(sec.key)}
            />
          ))}
        </div>

        {/* ── Two-panel layout ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 20, minHeight: 'calc(100vh - 340px)' }}>

          {/* ── LEFT NAV ──────────────────────────────────────────────────── */}
          <div style={{ width: 280, flexShrink: 0, position: 'sticky', top: 72, alignSelf: 'flex-start' }}>
            <div style={{
              background: '#ffffff', border: '1px solid #e8eaed',
              borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 14px 10px' }}>
                <Input
                  placeholder="Search sections..."
                  prefix={<SearchOutlined style={{ color: '#d1d5db' }} />}
                  size="small" value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  style={{ borderRadius: 8, fontSize: 12 }} allowClear
                />
              </div>

              <div style={{ padding: '0 0 8px' }}>
                {visibleSections.map((section) => {
                  const isActive = activeSection === section.key;
                  const sectionIdx = SECTIONS.findIndex((s) => s.key === section.key);
                  return (
                    <div key={section.key}
                      onClick={() => setActiveSection(section.key)}
                      style={{
                        padding: '12px 16px 12px 14px', cursor: 'pointer',
                        background: isActive ? '#eff6ff' : 'transparent',
                        borderLeft: isActive ? '3px solid #1d4ed8' : '3px solid transparent',
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12,
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: isActive ? '#dbeafe' : '#f3f4f6',
                        color: isActive ? '#1d4ed8' : '#6b7280',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, transition: 'all 0.15s',
                      }}>
                        {section.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{
                          fontSize: 13, fontWeight: isActive ? 600 : 500,
                          color: isActive ? '#1d4ed8' : '#374151', display: 'block', lineHeight: 1.3,
                        }}>
                          {section.label}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.2 }}>{section.desc}</Text>
                      </div>
                      <Text style={{ fontSize: 10, fontWeight: 600, color: '#d1d5db', fontFamily: 'monospace', flexShrink: 0 }}>
                        {sectionIdx + 1}/{SECTIONS.length}
                      </Text>
                    </div>
                  );
                })}
                {visibleSections.length === 0 && (
                  <Text style={{ display: 'block', padding: 16, color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
                    No sections match your search
                  </Text>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT CONTENT ─────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: '#ffffff', border: '1px solid #e8eaed',
              borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              padding: '32px 36px 24px', minHeight: 460,
            }}>

              {/* ═══ SECTION 1: Site & Owner Details ═══ */}
              <div style={{ display: activeSection === 'owner' ? 'block' : 'none' }}>
                <SectionHeader icon={<GlobalOutlined />} title="Site & Owner Details"
                  description="Edit the basic information for this site" />

                <SubSection title="Basic Information" description="Site name, contact email and GSTIN">
                  <Row gutter={20}>
                    <Col span={8}>
                      <Form.Item name="name" label="Site Name"
                        rules={[{ required: true, message: 'Site name is required' }]}>
                        <Input prefix={<GlobalOutlined style={{ color: '#d1d5db' }} />}
                          placeholder="Dynatech Controls Pvt. Ltd." />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="email" label="Email"
                        rules={[{ type: 'email', message: 'Enter a valid email' }]}>
                        <Input prefix={<MailOutlined style={{ color: '#d1d5db' }} />}
                          placeholder="admin@dynatech.com" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="gstin" label="GSTIN">
                        <Input prefix={<SafetyCertificateOutlined style={{ color: '#d1d5db' }} />}
                          placeholder="22AAAAA0000A1Z5" style={{ textTransform: 'uppercase' }} maxLength={15} />
                      </Form.Item>
                    </Col>
                  </Row>
                </SubSection>

                <SubSection title="Addresses" description="Invoice and shipping addresses for this site">
                  <AddressRepeater name="invoice_addresses" label="Invoice Address"
                    icon={<FileTextOutlined style={{ color: '#6b7280', fontSize: 13 }} />} />

                  {/* Same-as-invoice checkbox */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', marginBottom: 16,
                    background: sameAsInvoice ? '#eff6ff' : '#ffffff',
                    border: `1px solid ${sameAsInvoice ? '#bfdbfe' : '#e8eaed'}`,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                  }} onClick={() => handleSameAsInvoice({ target: { checked: !sameAsInvoice } })}>
                    <Checkbox checked={sameAsInvoice} onChange={handleSameAsInvoice}
                      onClick={(e) => e.stopPropagation()} />
                    <LinkOutlined style={{ color: sameAsInvoice ? '#1d4ed8' : '#9ca3af', fontSize: 14 }} />
                    <div>
                      <Text style={{ fontWeight: 500, fontSize: 13, display: 'block',
                        color: sameAsInvoice ? '#1d4ed8' : '#374151' }}>
                        Shipping address same as Invoice address
                      </Text>
                      <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                        {sameAsInvoice
                          ? 'Shipping addresses have been copied from invoice addresses'
                          : 'Check to auto-fill shipping addresses from invoice addresses above'}
                      </Text>
                    </div>
                  </div>

                  <div style={{ display: sameAsInvoice ? 'none' : 'block' }}>
                    <AddressRepeater name="shipping_addresses" label="Shipping Address"
                      icon={<EnvironmentOutlined style={{ color: '#6b7280', fontSize: 13 }} />} />
                  </div>
                </SubSection>
              </div>

              {/* ═══ SECTION 2: Production & Planning ═══ */}
              <div style={{ display: activeSection === 'production' ? 'block' : 'none' }}>
                <SectionHeader icon={<ToolOutlined />} title="Production & Planning Configuration"
                  description="Control machine scheduling, approvals and document numbering" />

                <SubSection title="Production Controls" description="Toggle features that control how production operates at this site">
                  <Row gutter={16}>
                    <Col span={8}>
                      <ToggleCard name="machine_scheduling" label="Machine Scheduling"
                        description="Enable machine-level scheduling" />
                    </Col>
                    <Col span={8}>
                      <ToggleCard name="manual_po_approval" label="Manual PO Approval"
                        description="Require manual PO approval flow" />
                    </Col>
                    <Col span={8}>
                      <div style={{
                        padding: '14px 18px', background: '#ffffff',
                        border: '1px solid #e8eaed', borderRadius: 10, marginBottom: 10,
                      }}>
                        <Text style={{ fontWeight: 500, fontSize: 13, color: '#111827', display: 'block', marginBottom: 4 }}>
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

                <SubSection title="Document Nomenclature"
                  description="Define the numbering format for PO and Dispatch documents">
                  <NomenclatureRow label="Purchase Order Format"
                    prefixName="po_prefix" yearName="po_year_format" sepName="po_separator" form={form} />
                  <NomenclatureRow label="Dispatch Order Format"
                    prefixName="dispatch_prefix" yearName="dispatch_year_format" sepName="dispatch_separator" form={form} />
                </SubSection>
              </div>

              {/* ═══ SECTION 3: Inventory & Tracking ═══ */}
              <div style={{ display: activeSection === 'inventory' ? 'block' : 'none' }}>
                <SectionHeader icon={<InboxOutlined />} title="Inventory & Tracking Configuration"
                  description="Enable inventory modules and tracking features for this site" />
                <SubSection title="Tracking Features" description="Toggle the inventory tracking capabilities you need">
                  <Row gutter={16}>
                    <Col span={12}>
                      <ToggleCard name="mrn_to_issue" label="MRN to Issue"
                        description="Enable Material Receipt Note to Issue flow" />
                    </Col>
                    <Col span={12}>
                      <ToggleCard name="rack_tracking" label="Rack Tracking"
                        description="Track materials by rack location" />
                    </Col>
                    <Col span={12}>
                      <ToggleCard name="bundle_tracking" label="Bundle Tracking"
                        description="Track materials as bundles or groups" />
                    </Col>
                    <Col span={12}>
                      <ToggleCard name="alternate_unit" label="Alternate Unit"
                        description="Allow alternate units of measurement" />
                    </Col>
                  </Row>
                </SubSection>
              </div>

              {/* ═══ SECTION 4: Costing & Financial ═══ */}
              <div style={{ display: activeSection === 'costing' ? 'block' : 'none' }}>
                <SectionHeader icon={<DollarOutlined />} title="Costing & Financial Control"
                  description="Configure cost calculation and financial features" />
                <SubSection title="Cost Calculation"
                  description="Enable or disable the built-in costing engine for this site">
                  <ToggleCard name="costing_calculation" label="Costing Calculation"
                    description="Automatically calculate material and production costs for orders" />
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: 10, marginTop: 12,
                  }}>
                    <InfoCircleOutlined style={{ color: '#1d4ed8', marginTop: 2, flexShrink: 0 }} />
                    <Text style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
                      When enabled, the system will use BOM data and material rates to
                      automatically compute production costs per order. This can be configured
                      further in the Costing module.
                    </Text>
                  </div>
                </SubSection>
              </div>

              {/* ═══ SECTION 5: Maintenance ═══ */}
              <div style={{ display: activeSection === 'maintenance' ? 'block' : 'none' }}>
                <SectionHeader icon={<ClockCircleOutlined />} title="Maintenance Configuration"
                  description="Define how downtime is recorded and tracked" />
                <SubSection title="Downtime Template"
                  description="Choose how machine downtime entries are captured">
                  <Form.Item name="downtime_template" style={{ margin: 0 }}>
                    <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                      <RadioCard value="duration_instances"
                        title="Duration + Number of Instances"
                        description="Record total downtime duration and how many times it occurred"
                        isSelected={downtimeVal === 'duration_instances'} />
                      <RadioCard value="from_duration"
                        title="From Time + Duration"
                        description="Record when downtime started and how long it lasted"
                        isSelected={downtimeVal === 'from_duration'} />
                      <RadioCard value="from_to_time"
                        title="From Time + To Time"
                        description="Record the exact start and end time of each downtime event"
                        isSelected={downtimeVal === 'from_to_time'} />
                    </Radio.Group>
                  </Form.Item>
                </SubSection>
              </div>

              {/* ═══ SECTION 6: Document & Branding ═══ */}
              <div style={{ display: activeSection === 'documents' ? 'block' : 'none' }}>
                <SectionHeader icon={<FileTextOutlined />} title="Document & Branding Settings"
                  description="Control PDF appearance and branding for this site" />
                <SubSection title="PDF Branding" description="Manage how your generated documents look">
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px 22px', background: '#ffffff',
                    border: '1px solid #e8eaed', borderRadius: 10,
                  }}>
                    <div style={{ flex: 1, marginRight: 16 }}>
                      <Text style={{ fontWeight: 600, fontSize: 14, color: '#111827', display: 'block' }}>
                        Show "Powered by Dynatech ONE" in PDF
                      </Text>
                      <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'block', lineHeight: 1.5 }}>
                        When enabled, Dynatech ONE branding will appear in the footer of all
                        PDFs (invoices, dispatch notes, QC reports) generated from this site.
                      </Text>
                    </div>
                    <Form.Item name="show_powered_by_pdf" valuePropName="checked" style={{ margin: 0 }}>
                      <Switch checkedChildren="Yes" unCheckedChildren="No" />
                    </Form.Item>
                  </div>
                </SubSection>
              </div>

            </div>{/* end content card */}

            {/* ── Bottom navigation ────────────────────────────────────────── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 16, padding: '0 4px',
            }}>
              <Button disabled={currentIdx === 0} onClick={goPrev}
                style={{ borderRadius: 8, fontWeight: 500, height: 38 }}>
                <ArrowLeftOutlined /> Previous
              </Button>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                Step {currentIdx + 1} of {SECTIONS.length}
              </Text>
              {currentIdx < SECTIONS.length - 1 ? (
                <Button type="primary" onClick={goNext}
                  style={{ borderRadius: 8, fontWeight: 500, height: 38 }}>
                  Next <RightOutlined />
                </Button>
              ) : (
                <Button type="primary" htmlType="submit" loading={saving}
                  icon={<SaveOutlined />}
                  style={{ borderRadius: 8, fontWeight: 600, height: 38, minWidth: 130 }}>
                  Save Changes
                </Button>
              )}
            </div>

          </div>{/* end right column */}
        </div>{/* end two-panel */}
      </Form>
    </AppLayout>
  );
};

export default EditSitePage;
