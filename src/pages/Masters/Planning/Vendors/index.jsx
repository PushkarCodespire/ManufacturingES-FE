import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Checkbox,
  Card, Modal, message, Tag, Space, Tabs, Divider,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  ShopOutlined,
  SearchOutlined,
  RightOutlined,
  EnvironmentOutlined,
  UserOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { vendorApi }   from '../../../../api/vendor.api';
import { warehouseApi } from '../../../../api/warehouse.api';
import AppLayout        from '../../../../components/AppLayout';
import ResponsiveTable  from '../../../../components/ResponsiveTable';
import usePermissions   from '../../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../../utils/exportCsv';
import CsvUploadModal from '../../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../../utils/csvImport';

const { Title, Text } = Typography;
const { Option }      = Select;

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

// ── Type config ────────────────────────────────────────────────────────────────
const TYPE_LABELS  = { vendor: 'Vendor', jobwork_vendor: 'Jobwork Vendor', customer: 'Customer' };
const TYPE_COLORS  = { vendor: 'blue',   jobwork_vendor: 'purple',         customer: 'green'    };

// ── Stat chip ─────────────────────────────────────────────────────────────────
const StatChip = ({ label, value, color, bg }) => (
  <div
    style={{
      padding: '8px 16px', background: bg,
      border: `1px solid ${color}30`, borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90,
    }}
  >
    <Text style={{ color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{value}</Text>
    <Text style={{ color, fontSize: 11, opacity: 0.8 }}>{label}</Text>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT VIEW
// ══════════════════════════════════════════════════════════════════════════════
const AddEditView = ({ vendor, defaultType = 'vendor', onBack, onSaved, canWrite }) => {
  const [form]       = Form.useForm();
  const [saving,     setSaving]     = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [tags,       setTags]       = useState(vendor?.item_group_tags ?? []);
  const [tagInput,   setTagInput]   = useState('');
  const isEdit = Boolean(vendor);

  useEffect(() => {
    warehouseApi.getAll().then((d) => setWarehouses(d ?? [])).catch(() => {});
    if (isEdit) {
      form.setFieldsValue({
        name:                 vendor.name,
        type:                 vendor.type,
        email:                vendor.email || '',
        mobile:               vendor.mobile || '',
        gstin:                vendor.gstin || '',
        address:              vendor.address || '',
        city:                 vendor.city || '',
        state:                vendor.state || '',
        country:              vendor.country || 'IN',
        pincode:              vendor.pincode || '',
        linked_warehouse_ids: vendor.linked_warehouse_ids ?? [],
      });
      setTags(vendor.item_group_tags ?? []);
    } else {
      form.setFieldsValue({ type: defaultType, country: 'IN' });
    }
  }, [vendor]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag) => setTags((prev) => prev.filter((t) => t !== tag));

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); }
    catch { return; }

    setSaving(true);
    try {
      const payload = { ...values, item_group_tags: tags };
      if (isEdit) {
        await vendorApi.update(vendor.id, payload);
        message.success('Partner updated successfully');
      } else {
        await vendorApi.create(payload);
        message.success('Partner created successfully');
      }
      onSaved();
    } catch (err) {
      message.error(err?.message || 'Failed to save partner');
    } finally {
      setSaving(false);
    }
  };

  const INDIA_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
    'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
    'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
    'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
    'Delhi','Chandigarh','Puducherry','Jammu & Kashmir','Ladakh',
    'Andaman & Nicobar','Dadra & Nagar Haveli','Lakshadweep',
    'Central Delhi','North Delhi','East Delhi','Faridabad',
  ];

  return (
    <AppLayout>
      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{ borderRadius: 8 }}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters › Planning › Vendors</Text>
          </div>
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
            {isEdit ? `Edit — ${vendor.name}` : 'Add New Partners'}
          </Title>
        </div>
      </div>

      <div className="res-two-panel" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Left: Form ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '24px 28px' }}
          >
            <Form form={form} layout="vertical" requiredMark={false}>
              {/* Row 1: Name | Partner Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Name <span style={{ color: '#ef4444' }}>*</span></Text>}
                  name="name"
                  rules={[{ required: true, message: 'Name is required' }]}
                >
                  <Input placeholder="Enter partner name" style={{ borderRadius: 8 }} />
                </Form.Item>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Partner code</Text>}
                >
                  <Input
                    value={isEdit ? vendor.partner_code : 'Auto-generated'}
                    disabled
                    style={{ borderRadius: 8, background: '#f9fafb', color: '#6b7280', fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </div>

              {/* Row 2: Type | Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Type</Text>}
                  name="type"
                >
                  <Select style={{ borderRadius: 8 }}>
                    <Option value="vendor">Vendor</Option>
                    <Option value="jobwork_vendor">Jobwork Vendor</Option>
                    <Option value="customer">Customer</Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Email</Text>}
                  name="email"
                  rules={[{ type: 'email', message: 'Enter a valid email' }]}
                >
                  <Input placeholder="vendor@company.com" style={{ borderRadius: 8 }} />
                </Form.Item>
              </div>

              {/* Row 3: GSTIN | Mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>GSTIN</Text>}
                  name="gstin"
                >
                  <Input
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    maxLength={15}
                    style={{ borderRadius: 8, fontFamily: 'monospace', textTransform: 'uppercase' }}
                    onChange={(e) => form.setFieldValue('gstin', e.target.value.toUpperCase())}
                  />
                </Form.Item>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Mobile</Text>}
                  name="mobile"
                >
                  <Input placeholder="+91 98765 43210" style={{ borderRadius: 8 }} />
                </Form.Item>
              </div>

              {/* Linked Warehouse */}
              <Form.Item
                label={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Linked Warehouse</Text>
                  </div>
                }
                name="linked_warehouse_ids"
              >
                <Select
                  mode="multiple"
                  placeholder="Select warehouses…"
                  optionFilterProp="children"
                  style={{ width: '100%', borderRadius: 8 }}
                >
                  {warehouses.map((w) => (
                    <Option key={w.id} value={w.id}>{w.name} ({w.code})</Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Item Group Tag */}
              <Form.Item
                label={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Item Group Tag</Text>
                  </div>
                }
              >
                <div
                  style={{
                    border: '1px solid #d9d9d9', borderRadius: 8,
                    padding: '8px 12px', minHeight: 40,
                    display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
                  }}
                >
                  {tags.length === 0 && !tagInput && (
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>No attached Item Group Tags</Text>
                  )}
                  {tags.map((t) => (
                    <Tag
                      key={t}
                      closable={canWrite}
                      onClose={() => removeTag(t)}
                      style={{ borderRadius: 20, fontSize: 12 }}
                    >
                      {t}
                    </Tag>
                  ))}
                  {canWrite && (
                    <Input
                      size="small"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onPressEnter={addTag}
                      onBlur={addTag}
                      placeholder="Type and press Enter…"
                      style={{ border: 'none', boxShadow: 'none', width: 160, padding: '0 4px', fontSize: 12 }}
                    />
                  )}
                </div>
              </Form.Item>

              {/* Submit */}
              {canWrite && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 8 }}>
                  <Button
                    type="primary"
                    loading={saving}
                    onClick={handleSubmit}
                    style={{ borderRadius: 8, fontWeight: 600, minWidth: 100 }}
                  >
                    {isEdit ? 'Update' : 'Submit'}
                  </Button>
                </div>
              )}
            </Form>
          </Card>
        </div>

        {/* ── Right: Invoice Address ────────────────────────────────────────── */}
        <div style={{ width: 340, flexShrink: 0 }}>
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                <EnvironmentOutlined style={{ marginRight: 6, color: '#1d4ed8' }} />
                Invoice Address
              </Text>
            </div>

            <Form form={form} layout="vertical" requiredMark={false}>
              <Form.Item
                label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Address</Text>}
                name="address"
              >
                <Input.TextArea
                  placeholder="Building, Street, Area"
                  rows={2}
                  style={{ borderRadius: 8, resize: 'none' }}
                />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>City</Text>}
                  name="city"
                >
                  <Input placeholder="City" style={{ borderRadius: 8 }} />
                </Form.Item>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Pincode</Text>}
                  name="pincode"
                >
                  <Input placeholder="110001" maxLength={6} style={{ borderRadius: 8 }} />
                </Form.Item>
              </div>

              <Form.Item
                label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>State</Text>}
                name="state"
              >
                <Select
                  showSearch
                  placeholder="Select state…"
                  optionFilterProp="children"
                  style={{ width: '100%', borderRadius: 8 }}
                  allowClear
                >
                  {INDIA_STATES.map((s) => <Option key={s} value={s}>{s}</Option>)}
                </Select>
              </Form.Item>

              <Form.Item
                label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Country</Text>}
                name="country"
              >
                <Select style={{ borderRadius: 8 }}>
                  <Option value="IN">India</Option>
                  <Option value="US">United States</Option>
                  <Option value="CN">China</Option>
                  <Option value="DE">Germany</Option>
                  <Option value="JP">Japan</Option>
                  <Option value="GB">United Kingdom</Option>
                </Select>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({ vendors, loading, search, onSearchChange, onRefresh, onNew, onEdit, onDelete, canWrite, onUploadCsv }) => {
  const vendorCount  = vendors.filter((v) => v.type === 'vendor').length;
  const jobworkCount = vendors.filter((v) => v.type === 'jobwork_vendor').length;
  const [tab, setTab] = useState('vendor');

  const filtered = vendors.filter((v) => v.type === tab);

  const columns = [
    {
      title: 'Name',
      key:   'name',
      width: 240,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#f0f9ff', border: '1px solid #bae6fd',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#0369a1', fontSize: 16, flexShrink: 0,
            }}
          >
            <ShopOutlined />
          </div>
          <div style={{ minWidth: 0 }}>
            <Text
              style={{ color: '#111827', fontWeight: 600, fontSize: 13, display: 'block', cursor: 'pointer', fontFamily: 'monospace' }}
              onClick={() => onEdit(r)}
            >
              {r.partner_code}
            </Text>
            <Text
              ellipsis
              style={{ color: '#6b7280', fontSize: 11, display: 'block', maxWidth: 180 }}
            >
              {r.name}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title:     'Email',
      dataIndex: 'email',
      key:       'email',
      width:     200,
      render: (v) => v
        ? <Text style={{ fontSize: 12 }}>{v}</Text>
        : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title:     'Address',
      dataIndex: 'address',
      key:       'address',
      width:     200,
      ellipsis:  true,
      render: (v) => v
        ? <Text style={{ fontSize: 12 }}>{v}</Text>
        : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title:     'City',
      dataIndex: 'city',
      key:       'city',
      width:     120,
      render: (v) => v || <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title:  'Created At',
      key:    'created',
      width:  160,
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
      width:  160,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', color: '#111827' }}>
            {r.Updater?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(r.updatedAt)}</Text>
        </div>
      ),
    },
    ...(canWrite ? [{
      title:  'Actions',
      key:    'actions',
      width:  90,
      align:  'center',
      render: (_, r) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          style={{ borderRadius: 6 }}
          onClick={() => onDelete(r)}
        />
      ),
    }] : []),
  ];

  const tabItems = [
    {
      key:   'vendor',
      label: `Vendors (${vendorCount})`,
    },
    {
      key:   'jobwork_vendor',
      label: `Jobwork Vendors (${jobworkCount})`,
    },
  ];

  return (
    <>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <StatChip label="Total Partners" value={vendors.length}  color="#1d4ed8" bg="#eff6ff" />
        <StatChip label="Vendors"        value={vendorCount}     color="#b45309" bg="#fef3c7" />
        <StatChip label="Jobwork"        value={jobworkCount}    color="#7c3aed" bg="#f5f3ff" />
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '0 20px 16px' }}
      >
        {/* Tabs */}
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={tabItems}
          style={{ marginBottom: 0 }}
          tabBarStyle={{ marginBottom: 0 }}
          tabBarExtraContent={
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 4 }}>
              <Input
                placeholder={`Search ${tab === 'vendor' ? 'vendors' : 'jobwork vendors'}…`}
                prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                style={{ width: 220, borderRadius: 8 }}
                allowClear
              />
              <Button icon={<DownloadOutlined />} onClick={() => {
                const csvRows = filtered.map((v) => ({
                  'Name': v.name || '', 'Type': v.type || '', 'Email': v.email || '',
                  'Mobile': v.mobile || '', 'GSTIN': v.gstin || '',
                  'Address': v.address || '', 'City': v.city || '',
                  'State': v.state || '', 'Country': v.country || '', 'Pincode': v.pincode || '',
                }));
                downloadSampleCsv('vendors.csv', VENDOR_CSV_HEADERS, csvRows);
              }}>Export CSV</Button>
              {canWrite && (
                <Button icon={<UploadOutlined />} onClick={onUploadCsv} style={{ borderRadius: 8 }}>Upload CSV</Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }} />
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
          }
        />

        <Divider style={{ margin: '0 0 16px' }} />

        {/* Table */}
        <ResponsiveTable
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={{
            pageSize:  10,
            showTotal: (t) => `${t} ${tab === 'vendor' ? 'vendor' : 'jobwork vendor'}${t !== 1 ? 's' : ''}`,
            style:     { marginBottom: 0 },
          }}
          scroll={undefined}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <ShopOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>
                  No {tab === 'vendor' ? 'vendors' : 'jobwork vendors'} added yet
                </Text>
                {canWrite && (
                  <>
                    <br />
                    <Button type="primary" size="small" onClick={onNew} style={{ marginTop: 10 }}>
                      Add Your First {tab === 'vendor' ? 'Vendor' : 'Jobwork Vendor'}
                    </Button>
                  </>
                )}
              </div>
            ),
          }}
        />
      </Card>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
// ── CSV Upload config ────────────────────────────────────────────────────────
const VENDOR_CSV_HEADERS = [
  'Name', 'Type', 'Email', 'Mobile', 'GSTIN',
  'Address', 'City', 'State', 'Country', 'Pincode',
];

const VENDOR_CSV_SAMPLE = [
  {
    'Name': 'Steel Suppliers Ltd', 'Type': 'vendor', 'Email': 'info@steelsupply.com',
    'Mobile': '+91 98765 43210', 'GSTIN': '27AAAAA0000A1Z5',
    'Address': '45 Industrial Area', 'City': 'Pune', 'State': 'Maharashtra',
    'Country': 'IN', 'Pincode': '411018',
  },
];

const VENDOR_VALIDATION_RULES = [
  { field: 'Name', required: true },
];

const VendorsPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('planning-vendors-create_edit_delete');

  const [vendors,  setVendors]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [view,     setView]     = useState('list');  // 'list' | 'add' | 'edit'
  const [selected, setSelected] = useState(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vendorApi.getAll(search ? { search } : {});
      setVendors(data ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.name}"?`,
      content: `This will permanently delete ${record.partner_code} (${record.name}). This cannot be undone.`,
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await vendorApi.delete(record.id);
          message.success(`${record.name} deleted`);
          fetchVendors();
        } catch (err) {
          message.error(err?.message || 'Failed to delete partner');
        }
      },
    });
  };

  // ── Saved callback (add/edit) ─────────────────────────────────────────────
  const handleSaved = () => {
    setView('list');
    setSelected(null);
    fetchVendors();
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0;
    let failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const typeVal = (row['Type'] || 'vendor').toLowerCase().replace(/\s+/g, '_');
        await vendorApi.create({
          type:    typeVal || 'vendor',
          name:    row['Name'] || '',
          email:   row['Email'] || null,
          mobile:  row['Mobile'] || null,
          gstin:   row['GSTIN'] || null,
          address: row['Address'] || null,
          city:    row['City'] || null,
          state:   row['State'] || null,
          country: row['Country'] || 'IN',
          pincode: row['Pincode'] || null,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Name']}": ${err?.message || 'Failed'}`);
      }
    }
    fetchVendors();
    return { success, failed, errors };
  };

  // ── Add / Edit views ─────────────────────────────────────────────────────
  if (view === 'add') {
    return (
      <AddEditView
        vendor={null}
        onBack={() => setView('list')}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }
  if (view === 'edit' && selected) {
    return (
      <AddEditView
        vendor={selected}
        onBack={() => { setView('list'); setSelected(null); }}
        onSaved={handleSaved}
        canWrite={canWrite}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Planning</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Vendors</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Customers | Vendors
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage vendors, jobwork vendors and customer partners
        </Text>
      </div>

      <ListView
        vendors={vendors}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        onRefresh={fetchVendors}
        onNew={() => setView('add')}
        onEdit={(r) => { setSelected(r); setView('edit'); }}
        onDelete={handleDelete}
        canWrite={canWrite}
        onUploadCsv={() => setCsvModalOpen(true)}
      />

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Vendors"
        entityName="Vendor"
        sampleHeaders={VENDOR_CSV_HEADERS}
        sampleRows={VENDOR_CSV_SAMPLE}
        validationRules={VENDOR_VALIDATION_RULES}
      />
    </AppLayout>
  );
};

export default VendorsPage;
