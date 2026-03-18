import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Card,
  Modal, message, Tag, Space, Divider, Checkbox, Tooltip,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  RightOutlined,
  UserOutlined,
  EnvironmentOutlined,
  EditOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { vendorApi }    from '../../../../api/vendor.api';
import { warehouseApi } from '../../../../api/warehouse.api';
import { userApi }      from '../../../../api/user.api';
import AppLayout        from '../../../../components/AppLayout';
import usePermissions   from '../../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option }      = Select;
const { TextArea }    = Input;

const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Chandigarh','Puducherry','Jammu & Kashmir','Ladakh',
  'Andaman & Nicobar','Dadra & Nagar Haveli','Lakshadweep',
];

// ── Address card sub-component ────────────────────────────────────────────────
const AddressCard = ({ title, prefix, form, canWrite }) => {
  const [expanded, setExpanded] = useState(false);

  // Auto-expand if existing data
  useEffect(() => {
    const vals = form.getFieldsValue([`${prefix}address`, `${prefix}city`]);
    if (vals[`${prefix}address`] || vals[`${prefix}city`]) setExpanded(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? 12 : 0 }}>
        <Text style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
          <EnvironmentOutlined style={{ marginRight: 6, color: '#1d4ed8' }} />
          {title}
        </Text>
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontWeight: 600 }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Collapse' : '+ Add New'}
        </Button>
      </div>

      {expanded && (
        <div style={{ paddingTop: 4 }}>
          <Form.Item
            label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Address</Text>}
            name={`${prefix}address`}
          >
            <TextArea
              placeholder="Building, Street, Area"
              rows={2}
              style={{ borderRadius: 8, resize: 'none' }}
              disabled={!canWrite}
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>City</Text>}
              name={`${prefix}city`}
            >
              <Input placeholder="City" style={{ borderRadius: 8 }} disabled={!canWrite} />
            </Form.Item>
            <Form.Item
              label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Pincode</Text>}
              name={`${prefix}pincode`}
            >
              <Input placeholder="110001" maxLength={6} style={{ borderRadius: 8 }} disabled={!canWrite} />
            </Form.Item>
          </div>

          <Form.Item
            label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>State</Text>}
            name={`${prefix}state`}
          >
            <Select
              showSearch placeholder="Select state…" optionFilterProp="children"
              style={{ width: '100%', borderRadius: 8 }} allowClear disabled={!canWrite}
            >
              {INDIA_STATES.map((s) => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item
            label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Country</Text>}
            name={`${prefix}country`}
          >
            <Select style={{ borderRadius: 8 }} disabled={!canWrite}>
              <Option value="IN">India</Option>
              <Option value="US">United States</Option>
              <Option value="CN">China</Option>
              <Option value="DE">Germany</Option>
              <Option value="JP">Japan</Option>
              <Option value="GB">United Kingdom</Option>
            </Select>
          </Form.Item>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT VIEW
// ══════════════════════════════════════════════════════════════════════════════
const AddEditView = ({ customer, onBack, onSaved, canWrite }) => {
  const [form]         = Form.useForm();
  const [saving,       setSaving]       = useState(false);
  const [warehouses,   setWarehouses]   = useState([]);
  const [users,        setUsers]        = useState([]);
  const [tags,         setTags]         = useState(customer?.item_group_tags ?? []);
  const [tagInput,     setTagInput]     = useState('');
  const [createWh,     setCreateWh]     = useState(false);
  const isEdit = Boolean(customer);

  useEffect(() => {
    warehouseApi.getAll().then((d) => setWarehouses(d ?? [])).catch(() => {});
    userApi.getAll({ is_active: true, limit: 200 }).then((d) => {
      const all = Array.isArray(d) ? d : (d?.rows ?? []);
      setUsers(all.filter((u) => u.Role?.name === 'sales_manager'));
    }).catch(() => {});

    if (isEdit) {
      form.setFieldsValue({
        name:                 customer.name,
        email:                customer.email || '',
        mobile:               customer.mobile || '',
        gstin:                customer.gstin || '',
        sales_manager_id:     customer.sales_manager_id || null,
        linked_warehouse_ids: customer.linked_warehouse_ids ?? [],
        // Invoice address
        address:              customer.address || '',
        city:                 customer.city || '',
        state:                customer.state || '',
        country:              customer.country || 'IN',
        pincode:              customer.pincode || '',
        // Shipping address
        shipping_address:     customer.shipping_address || '',
        shipping_city:        customer.shipping_city || '',
        shipping_state:       customer.shipping_state || '',
        shipping_country:     customer.shipping_country || 'IN',
        shipping_pincode:     customer.shipping_pincode || '',
      });
      setTags(customer.item_group_tags ?? []);
    } else {
      form.setFieldsValue({ country: 'IN', shipping_country: 'IN' });
    }
  }, [customer]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTag    = () => { const t = tagInput.trim(); if (t && !tags.includes(t)) setTags((p) => [...p, t]); setTagInput(''); };
  const removeTag = (tag) => setTags((p) => p.filter((t) => t !== tag));

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }

    setSaving(true);
    try {
      const payload = { ...values, type: 'customer', item_group_tags: tags };

      let savedCustomer;
      if (isEdit) {
        const res = await vendorApi.update(customer.id, payload);
        savedCustomer = res.data ?? res;
        message.success('Customer updated successfully');
      } else {
        const res = await vendorApi.create(payload);
        savedCustomer = res.data ?? res;
        message.success(`${values.name} created with code ${savedCustomer.partner_code}`);
      }

      // Auto-create warehouse if checkbox ticked (create-only)
      if (!isEdit && createWh && savedCustomer?.id) {
        try {
          const whCode = savedCustomer.partner_code || values.name.slice(0, 8).toUpperCase();
          const wh = await warehouseApi.create({
            name:      `${values.name} Warehouse`,
            code:      whCode,
            address:   values.address  || null,
            city:      values.city     || null,
            state:     values.state    || null,
            country:   values.country  || 'IN',
            pincode:   values.pincode  || null,
          });
          const whId = wh?.data?.id ?? wh?.id;
          if (whId) {
            const existing = savedCustomer.linked_warehouse_ids ?? [];
            await vendorApi.update(savedCustomer.id, {
              linked_warehouse_ids: [...existing, whId],
            });
          }
          message.success('Warehouse created and linked to customer');
        } catch {
          message.warning('Customer saved but warehouse creation failed — please link manually');
        }
      }

      onSaved();
    } catch (err) {
      message.error(err?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      {/* ── Heading ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ borderRadius: 8 }} />
        <div>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters › Planning › Customers</Text>
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
            {isEdit ? `Edit — ${customer.name}` : 'Add New Partners'}
          </Title>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── LEFT: main form ─────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '24px 28px' }}
          >
            <Form form={form} layout="vertical" requiredMark={false}>

              {/* Row 1: Name | Partner code */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Name <span style={{ color: '#ef4444' }}>*</span></Text>}
                  name="name"
                  rules={[{ required: true, message: 'Name is required' }]}
                >
                  <Input placeholder="Customer name" style={{ borderRadius: 8 }} disabled={!canWrite} />
                </Form.Item>
                <Form.Item label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Partner code <span style={{ color: '#ef4444' }}>*</span></Text>}>
                  <Input
                    value={isEdit ? customer.partner_code : 'Auto-generated'}
                    disabled
                    style={{ borderRadius: 8, background: '#f9fafb', color: '#6b7280', fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </div>

              {/* Row 2: Type | Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Type</Text>}>
                  <Select value="customer" disabled style={{ borderRadius: 8 }}>
                    <Option value="customer">Customer</Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Email</Text>}
                  name="email"
                  rules={[{ type: 'email', message: 'Enter a valid email' }]}
                >
                  <Input placeholder="customer@company.com" style={{ borderRadius: 8 }} disabled={!canWrite} />
                </Form.Item>
              </div>

              {/* Row 3: Sales Manager | GSTIN */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Sales Manager</Text>}
                  name="sales_manager_id"
                >
                  <Select
                    showSearch
                    allowClear
                    placeholder="Assign sales manager…"
                    optionFilterProp="children"
                    style={{ borderRadius: 8 }}
                    disabled={!canWrite}
                  >
                    {users.map((u) => (
                      <Option key={u.id} value={u.id}>
                        <Space size={6}>
                          <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#9ca3af' }}>{u.employee_id}</Text>
                          {u.name}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item
                  label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>GSTIN</Text>}
                  name="gstin"
                >
                  <Input
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    style={{ borderRadius: 8, fontFamily: 'monospace', textTransform: 'uppercase' }}
                    onChange={(e) => form.setFieldValue('gstin', e.target.value.toUpperCase())}
                    disabled={!canWrite}
                  />
                </Form.Item>
              </div>

              {/* Mobile — full width */}
              <Form.Item
                label={<Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Mobile</Text>}
                name="mobile"
              >
                <Input placeholder="+91 98765 43210" style={{ borderRadius: 8, maxWidth: 280 }} disabled={!canWrite} />
              </Form.Item>

              {/* Linked Warehouse */}
              <Form.Item
                label={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Linked Warehouse</Text>
                    {canWrite && (
                      <Text style={{ fontSize: 12, color: '#1d4ed8', cursor: 'default' }}>Edit</Text>
                    )}
                  </div>
                }
                name="linked_warehouse_ids"
              >
                <Select
                  mode="multiple"
                  placeholder="Select warehouses…"
                  optionFilterProp="children"
                  style={{ width: '100%', borderRadius: 8 }}
                  disabled={!canWrite}
                >
                  {warehouses.map((w) => (
                    <Option key={w.id} value={w.id}>{w.name} ({w.code})</Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Item Group Tags */}
              <Form.Item
                label={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Item Group Tag</Text>
                    {canWrite && <Text style={{ fontSize: 12, color: '#1d4ed8' }}>Edit</Text>}
                  </div>
                }
              >
                <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: '8px 12px', minHeight: 40, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {tags.length === 0 && !tagInput && (
                    <Text style={{ color: '#9ca3af', fontSize: 12 }}>No attached Item Group Tags</Text>
                  )}
                  {tags.map((t) => (
                    <Tag key={t} closable={canWrite} onClose={() => removeTag(t)} style={{ borderRadius: 20, fontSize: 12 }}>{t}</Tag>
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

              {/* Create warehouse checkbox — only on new */}
              {!isEdit && canWrite && (
                <Form.Item style={{ marginBottom: 16 }}>
                  <Checkbox
                    checked={createWh}
                    onChange={(e) => setCreateWh(e.target.checked)}
                    style={{ fontSize: 13 }}
                  >
                    Create a new warehouse for{' '}
                    <span style={{ color: '#1d4ed8', fontWeight: 500 }}>this partner</span>
                  </Checkbox>
                </Form.Item>
              )}

              {canWrite && (
                <Button
                  type="primary"
                  loading={saving}
                  onClick={handleSubmit}
                  style={{ borderRadius: 8, fontWeight: 600, minWidth: 100 }}
                >
                  {isEdit ? 'Update' : 'Submit'}
                </Button>
              )}
            </Form>
          </Card>
        </div>

        {/* ── RIGHT: Addresses ─────────────────────────────────────────── */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <Card
            style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <Form form={form} layout="vertical" requiredMark={false}>
              <AddressCard title="Invoice Address" prefix=""          form={form} canWrite={canWrite} />
              <Divider style={{ margin: '12px 0' }} />
              <AddressCard title="Shipping Address" prefix="shipping_" form={form} canWrite={canWrite} />
            </Form>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const CustomersPage = () => {
  const { can }  = usePermissions();
  const canWrite = can('planning-vendors-create_edit_delete');

  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [view,      setView]      = useState('list');   // list | add | edit
  const [selected,  setSelected]  = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vendorApi.getAll({ type: 'customer', ...(search ? { search } : {}) });
      setCustomers(data ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.name}"?`,
      content: `This will permanently delete ${record.partner_code}. This cannot be undone.`,
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await vendorApi.delete(record.id);
          message.success(`${record.name} deleted`);
          fetchCustomers();
        } catch (err) {
          message.error(err?.message || 'Failed to delete customer');
        }
      },
    });
  };

  const handleSaved = () => { setView('list'); setSelected(null); fetchCustomers(); };

  // ── Table columns ───────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Customer',
      key:   'name',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#16a34a', fontSize: 16, flexShrink: 0,
          }}>
            <TeamOutlined />
          </div>
          <div style={{ minWidth: 0 }}>
            <Text
              style={{ color: '#111827', fontWeight: 600, fontSize: 13, display: 'block', cursor: 'pointer', fontFamily: 'monospace' }}
              onClick={() => { setSelected(r); setView('edit'); }}
            >
              {r.partner_code}
            </Text>
            <Text ellipsis style={{ color: '#6b7280', fontSize: 11, display: 'block', maxWidth: 200 }}>
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
      title:     'Mobile',
      dataIndex: 'mobile',
      key:       'mobile',
      width:     140,
      render: (v) => v || <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title:  'Sales Manager',
      key:    'sales_manager',
      width:  160,
      render: (_, r) => r.SalesManager
        ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserOutlined style={{ color: '#9ca3af', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{r.SalesManager.name}</Text>
          </div>
        )
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
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', color: '#111827' }}>{r.Creator?.name || '—'}</Text>
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
          <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', color: '#111827' }}>{r.Updater?.name || '—'}</Text>
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
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} style={{ borderRadius: 6 }}
              onClick={() => { setSelected(r); setView('edit'); }} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }}
              onClick={() => handleDelete(r)} />
          </Tooltip>
        </Space>
      ),
    }] : []),
  ];

  // ── Add / Edit views ───────────────────────────────────────────────────
  if (view === 'add') {
    return <AddEditView customer={null} onBack={() => setView('list')} onSaved={handleSaved} canWrite={canWrite} />;
  }
  if (view === 'edit' && selected) {
    return <AddEditView customer={selected} onBack={() => { setView('list'); setSelected(null); }} onSaved={handleSaved} canWrite={canWrite} />;
  }

  // ── List view ──────────────────────────────────────────────────────────
  const activeCount = customers.filter((c) => c.is_active).length;

  return (
    <AppLayout>
      {/* Page heading */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Planning</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Customers</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Customers</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage customer partners, billing contacts and shipping addresses
        </Text>
      </div>

      {/* Stats chips — same pattern as Configuration */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Customers', value: customers.length, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Active',          value: activeCount,       color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Inactive',        value: customers.length - activeCount, color: '#6b7280', bg: '#f9fafb' },
        ].map((s) => (
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

      {/* Card */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search customers…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchCustomers} style={{ borderRadius: 8 }}>Refresh</Button>
          {canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setView('add')}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Add New Customer
            </Button>
          )}
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={customers}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} customer${t !== 1 ? 's' : ''}`, style: { marginBottom: 0 } }}
          scroll={{ x: 1100 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <TeamOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No customers added yet</Text>
                {canWrite && (
                  <>
                    <br />
                    <Button type="primary" size="small" onClick={() => setView('add')} style={{ marginTop: 10 }}>
                      Add Your First Customer
                    </Button>
                  </>
                )}
              </div>
            ),
          }}
        />
      </Card>
    </AppLayout>
  );
};

export default CustomersPage;
