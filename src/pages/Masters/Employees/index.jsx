import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Button, Input, Select, Tag, Typography,
  Drawer, Form, Row, Col, Alert, Modal, message,
  Tooltip, Badge, Avatar,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  UsergroupAddOutlined,
  UserOutlined,
  CheckCircleOutlined,
  StopOutlined,
  CopyOutlined,
  ReloadOutlined,
  FilterOutlined,
  HomeOutlined,
  BankOutlined,
  AppstoreOutlined,
  RightOutlined,
DownloadOutlined, UploadOutlined, } from '@ant-design/icons';
import { userApi }  from '../../../api/user.api';
import AppLayout    from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';
import usePermissions from '../../../hooks/usePermissions';
import { exportToCsv } from '../../../utils/exportCsv';
import CsvUploadModal from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';

// ── CSV Upload config ────────────────────────────────────────────────────────
const EMP_CSV_HEADERS = ['Name', 'Email', 'Phone', 'Department', 'Role', 'Sites'];
const EMP_CSV_SAMPLE = [
  { 'Name': 'Priya Sharma', 'Email': 'priya@dynatech.com', 'Phone': '9876543210', 'Department': 'Quality', 'Role': 'QA Inspector', 'Sites': 'Site A, Site B' },
];
const EMP_CSV_VALIDATION = [
  { field: 'Name', required: true },
  { field: 'Email', required: true },
  { field: 'Department', required: true },
  { field: 'Role', required: true },
];

const { Title, Text } = Typography;
const { Option }      = Select;

// ── Department colors (matches sidebar palette) ──────────────────────────────
const DEPT_COLORS = {
  10: '#1d4ed8', 11: '#16a34a', 12: '#b45309', 13: '#7c3aed',
  14: '#dc2626', 15: '#0d9488', 16: '#1d4ed8', 17: '#92400e',
};

// ── Landing page options (maps to sidebar nav keys) ──────────────────────────
const LANDING_PAGE_OPTIONS = [
  { value: 'dashboard',   label: 'Dashboard (Default)' },
  { value: 'iqc',         label: 'Incoming QC'         },
  { value: 'procurement', label: 'Procurement'         },
  { value: 'store',       label: 'Store'               },
  { value: 'production',  label: 'Production'          },
  { value: 'dispatch',    label: 'Dispatch'            },
  { value: 'accounts',    label: 'Accounts'            },
  { value: 'hr',          label: 'HR'                  },
];

// ── Table columns ─────────────────────────────────────────────────────────────
const buildColumns = (onToggle, toggleLoading, canWrite) => [
  {
    title:     'Employee ID',
    dataIndex: 'employee_id',
    key:       'employee_id',
    width:     130,
    render: (id) => (
      <Text style={{ fontFamily: 'monospace', fontWeight: 600, color: '#374151', fontSize: 13 }}>
        {id}
      </Text>
    ),
  },
  {
    title: 'Name',
    key:   'name',
    render: (_, r) => {
      const color    = DEPT_COLORS[r.Department?.code] || '#1d4ed8';
      const initials = r.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={32}
            style={{ background: color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}
          >
            {initials}
          </Avatar>
          <div>
            <Text style={{ color: '#111827', fontWeight: 500, fontSize: 13, display: 'block' }}>
              {r.name}
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 11 }}>{r.email}</Text>
          </div>
        </div>
      );
    },
  },
  {
    title: 'Department',
    key:   'department',
    width: 160,
    render: (_, r) => {
      const color = DEPT_COLORS[r.Department?.code] || '#6b7280';
      return (
        <Tag
          style={{
            background:   `${color}12`,
            border:       `1px solid ${color}40`,
            color,
            borderRadius: 20,
            fontSize:     11,
            padding:      '1px 10px',
            fontWeight:   500,
          }}
        >
          {r.Department?.name || '—'}
        </Tag>
      );
    },
  },
  {
    title: 'Role',
    key:   'role',
    width: 180,
    render: (_, r) => (
      <Text style={{ color: '#374151', fontSize: 12 }}>{r.Role?.label || '—'}</Text>
    ),
  },
  {
    title:  'Sites',
    key:    'sites',
    width:  160,
    render: (_, r) =>
      r.Sites?.length
        ? r.Sites.map((s) => (
            <Tag key={s.id} style={{ fontSize: 11, borderRadius: 20, marginBottom: 2 }}>{s.name}</Tag>
          ))
        : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
  },
  {
    title:  'Status',
    key:    'status',
    width:  100,
    render: (_, r) => (
      r.is_active
        ? <Badge status="success" text={<Text style={{ color: '#16a34a', fontSize: 12, fontWeight: 500 }}>Active</Text>} />
        : <Badge status="error"   text={<Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 500 }}>Inactive</Text>} />
    ),
  },
  {
    title:  'First Login',
    key:    'first_login',
    width:  110,
    render: (_, r) => (
      r.is_first_login
        ? <Tag color="orange" style={{ fontSize: 11 }}>Pending</Tag>
        : <Tag color="green"  style={{ fontSize: 11 }}>Done</Tag>
    ),
  },
  ...(canWrite ? [{
    title:  'Actions',
    key:    'actions',
    width:  110,
    render: (_, r) => (
      <Tooltip title={r.is_active ? 'Deactivate employee' : 'Activate employee'}>
        <Button
          size="small"
          icon={r.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
          loading={toggleLoading === r.id}
          danger={r.is_active}
          style={{
            borderRadius: 6,
            fontSize:     12,
            ...(r.is_active ? {} : { color: '#16a34a', borderColor: '#16a34a' }),
          }}
          onClick={() => onToggle(r)}
        >
          {r.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </Tooltip>
    ),
  }] : []),
];

// ── Section header helper ─────────────────────────────────────────────────────
const SectionBox = ({ label, children }) => (
  <div
    style={{
      background: '#ffffff', borderRadius: 10,
      border: '1px solid #e8eaed', padding: '16px 16px 4px', marginBottom: 16,
    }}
  >
    <Text style={{ color: '#374151', fontWeight: 600, fontSize: 11, display: 'block', marginBottom: 12, letterSpacing: '0.05em' }}>
      {label}
    </Text>
    {children}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const EmployeesPage = () => {
  const navigate = useNavigate();
  const { can }  = usePermissions();
  const canWrite = can('sites-employees___access-create_edit_delete');
  const [users,          setUsers]          = useState([]);
  const [departments,    setDepartments]    = useState([]);
  const [roles,          setRoles]          = useState([]);
  const [sites,          setSites]          = useState([]);
  const [warehouses,     setWarehouses]     = useState([]);
  const [filteredRoles,  setFilteredRoles]  = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [toggleLoading,  setToggleLoading]  = useState(null);

  // Filters
  const [search,       setSearch]       = useState('');
  const [deptFilter,   setDeptFilter]   = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);

  // Drawer
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [creating,   setCreating]       = useState(false);
  const [form]                          = Form.useForm();
  const [formDeptId, setFormDeptId]     = useState(null);

  // Success modal
  const [successData, setSuccessData]   = useState(null);
  const [copied,      setCopied]        = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // ── Fetch employees ───────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search)       params.search        = search;
      if (deptFilter)   params.department_id = deptFilter;
      if (statusFilter !== undefined) params.is_active = statusFilter;

      const data = await userApi.getAll(params);
      setUsers(data ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [search, deptFilter, statusFilter]);

  // ── Load reference data on mount ─────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [depts, rls, sts, whs] = await Promise.all([
          userApi.getDepartments(),
          userApi.getRoles(),
          userApi.getSites(),
          userApi.getWarehouses(),
        ]);
        setDepartments(depts ?? []);
        setRoles(rls ?? []);
        setSites(sts ?? []);
        setWarehouses(whs ?? []);
      } catch (err) {
        message.error(err?.message || 'Failed to load reference data');
      }
    };
    init();
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── When form department changes, filter roles ────────────────────────────
  useEffect(() => {
    if (formDeptId) {
      setFilteredRoles(roles.filter((r) => r.department_id === formDeptId));
    } else {
      setFilteredRoles([]);
    }
    form.setFieldValue('role_id', undefined);
  }, [formDeptId, roles, form]);

  // ── Toggle active status ──────────────────────────────────────────────────
  const handleToggle = (record) => {
    const action = record.is_active ? 'deactivate' : 'activate';
    Modal.confirm({
      title:   `${record.is_active ? 'Deactivate' : 'Activate'} Employee?`,
      content: `Are you sure you want to ${action} ${record.name} (${record.employee_id})?`,
      okText:  record.is_active ? 'Deactivate' : 'Activate',
      okType:  record.is_active ? 'danger' : 'primary',
      okButtonProps: record.is_active ? {} : { style: { background: '#16a34a', borderColor: '#16a34a' } },
      onOk: async () => {
        setToggleLoading(record.id);
        try {
          await userApi.toggleStatus(record.id);
          message.success(`${record.name} ${record.is_active ? 'deactivated' : 'activated'} successfully`);
          fetchUsers();
        } catch (err) {
          message.error(err?.message || 'Failed to update status');
        } finally {
          setToggleLoading(null);
        }
      },
    });
  };

  // ── Create employee ───────────────────────────────────────────────────────
  const handleCreate = async (values) => {
    setCreating(true);
    try {
      const res = await userApi.create(values);
      setDrawerOpen(false);
      form.resetFields();
      setFormDeptId(null);
      setSuccessData({
        name:          res.data.name,
        employee_id:   res.data.employee_id,
        temp_password: res.temp_password,
      });
      fetchUsers();
    } catch (err) {
      message.error(err?.message || 'Failed to create employee');
    } finally {
      setCreating(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    form.resetFields();
    setFormDeptId(null);
  };

  const handleCopy = () => {
    if (successData?.temp_password) {
      navigator.clipboard.writeText(successData.temp_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── CSV Import handler ───────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const dept = row['Department'] ? departments.find((d) => d.name?.toLowerCase() === row['Department'].toLowerCase()) : null;
        const role = row['Role'] ? roles.find((r) => r.label?.toLowerCase() === row['Role'].toLowerCase() && (!dept || r.department_id === dept?.id)) : null;
        const siteNames = row['Sites'] ? row['Sites'].split(',').map((s) => s.trim()).filter(Boolean) : [];
        const site_ids = siteNames.length
          ? siteNames.map((sn) => sites.find((s) => s.name?.toLowerCase() === sn.toLowerCase())?.id).filter(Boolean)
          : [];
        await userApi.create({
          name:          row['Name'],
          email:         row['Email'],
          phone:         row['Phone'] || null,
          department_id: dept?.id || null,
          role_id:       role?.id || null,
          site_ids:      site_ids.length ? site_ids : undefined,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Name']}": ${err?.message || 'Failed'}`);
      }
    }
    fetchUsers();
    return { success, failed, errors };
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActive   = users.filter((u) => u.is_active).length;
  const totalInactive = users.filter((u) => !u.is_active).length;
  const totalPending  = users.filter((u) => u.is_first_login).length;

  return (
    <AppLayout>
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Employees &amp; Access</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Employees &amp; Access
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage employees, roles, site access and landing page
        </Text>
      </div>

      {/* ── Summary chips ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',    value: users.length,  color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Active',   value: totalActive,   color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Inactive', value: totalInactive, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Pwd Pending', value: totalPending, color: '#d97706', bg: '#fffbeb' },
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
              minWidth:      80,
            }}
          >
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              {s.value}
            </Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      {/* ── Table card ───────────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search name, ID or email…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="All Departments"
            style={{ width: 180 }}
            value={deptFilter}
            onChange={(v) => setDeptFilter(v)}
            allowClear
            suffixIcon={<FilterOutlined style={{ color: '#9ca3af' }} />}
          >
            {departments.map((d) => (
              <Option key={d.id} value={d.id}>{d.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="All Statuses"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            allowClear
          >
            <Option value="true">Active</Option>
            <Option value="false">Inactive</Option>
          </Select>
          <div style={{ flex: 1 }} />
          {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)} style={{ borderRadius: 8 }}>Upload CSV</Button>}
          <Button icon={<ReloadOutlined />} onClick={fetchUsers} style={{ borderRadius: 8 }}>
            Refresh
          </Button>
          {canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Add Employee
            </Button>
          )}
        </div>

        {/* Table */}
        <ResponsiveTable
          rowKey="id"
          columns={buildColumns(handleToggle, toggleLoading, canWrite)}
          dataSource={users}
          loading={loading}
          pagination={{
            pageSize:        10,
            showSizeChanger: true,
            showTotal:       (total) => `${total} employees`,
            style:           { marginBottom: 0 },
          }}
          scroll={{ x: 1000 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          onRow={(record) => ({
            style: {
              background: record.is_active ? undefined : '#fafafa',
              opacity:    record.is_active ? 1 : 0.7,
              cursor:     'pointer',
            },
            onClick: (e) => {
              // Don't navigate if clicking an action button
              if (e.target.closest('button')) return;
              navigate(`/masters/employees/${record.id}`);
            },
          })}
        />
      </Card>

      {/* ════════════════════════════════════════════════════════════════════
          ADD EMPLOYEE DRAWER
      ════════════════════════════════════════════════════════════════════ */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#eff6ff', border: '1px solid #bfdbfe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#1d4ed8', fontSize: 16,
              }}
            >
              <UsergroupAddOutlined />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>Add New Employee</div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                Default password:{' '}
                <code style={{ background: '#f3f4f6', padding: '0 4px', borderRadius: 3 }}>
                  Dynatech@123
                </code>
              </div>
            </div>
          </div>
        }
        open={drawerOpen}
        onClose={closeDrawer}
        width={560}
        styles={{
          header: { background: '#ffffff', borderBottom: '1px solid #f3f4f6', padding: '16px 24px' },
          body:   { padding: '20px 24px', background: '#f8fafc' },
          footer: { background: '#ffffff', borderTop: '1px solid #f3f4f6', padding: '12px 24px' },
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={closeDrawer}>Cancel</Button>
            <Button
              type="primary"
              loading={creating}
              icon={<UsergroupAddOutlined />}
              onClick={() => form.submit()}
              style={{ fontWeight: 600 }}
            >
              Create Employee
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          requiredMark={false}
          size="large"
        >
          {/* ── Personal Information ───────────────────────────────────── */}
          <SectionBox label="PERSONAL INFORMATION">
            <Form.Item
              name="name"
              label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Full Name</span>}
              rules={[
                { required: true, message: 'Please enter the employee name' },
                { min: 2,         message: 'Name must be at least 2 characters' },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
                placeholder="e.g. Priya Sharma"
              />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="phone"
                  label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Mobile</span>}
                >
                  <Input placeholder="e.g. 9876543210" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="email"
                  label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Email</span>}
                  rules={[
                    { required: true, message: 'Please enter an email address' },
                    { type: 'email',  message: 'Enter a valid email address'   },
                  ]}
                >
                  <Input placeholder="priya@dynatech.com" />
                </Form.Item>
              </Col>
            </Row>
          </SectionBox>

          {/* ── Department & Role ──────────────────────────────────────── */}
          <SectionBox label="DEPARTMENT & ROLE ACCESS">
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="department_id"
                  label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Department</span>}
                  rules={[{ required: true, message: 'Select a department' }]}
                >
                  <Select
                    placeholder="Select department"
                    onChange={(val) => setFormDeptId(val)}
                    showSearch
                    optionFilterProp="label"
                    options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="role_id"
                  label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Role</span>}
                  rules={[{ required: true, message: 'Select a role' }]}
                >
                  <Select
                    placeholder={formDeptId ? 'Select role' : 'Select dept first'}
                    disabled={!formDeptId}
                    showSearch
                    optionFilterProp="label"
                    options={filteredRoles.map((r) => ({ value: r.id, label: r.label }))}
                  />
                </Form.Item>
              </Col>
            </Row>
          </SectionBox>

          {/* ── Sites & Warehouses ─────────────────────────────────────── */}
          <SectionBox label="SITE & WAREHOUSE ACCESS">
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="site_ids"
                  label={
                    <span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>
                      <HomeOutlined style={{ marginRight: 5, color: '#6b7280' }} />
                      Sites
                    </span>
                  }
                >
                  <Select
                    mode="multiple"
                    placeholder={
                      sites.length ? 'Select sites…' : 'No sites configured yet'
                    }
                    disabled={!sites.length}
                    showSearch
                    optionFilterProp="label"
                    maxTagCount="responsive"
                    options={sites.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="warehouse_ids"
                  label={
                    <span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>
                      <BankOutlined style={{ marginRight: 5, color: '#6b7280' }} />
                      Warehouses
                    </span>
                  }
                >
                  <Select
                    mode="multiple"
                    placeholder={
                      warehouses.length ? 'Select warehouses…' : 'No warehouses configured yet'
                    }
                    disabled={!warehouses.length}
                    showSearch
                    optionFilterProp="label"
                    maxTagCount="responsive"
                    options={warehouses.map((w) => ({
                      value: w.id,
                      label: w.Site ? `${w.name} (${w.Site.code})` : w.name,
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            {(!sites.length || !warehouses.length) && (
              <Alert
                type="info"
                showIcon
                message={
                  <span style={{ fontSize: 12 }}>
                    Sites and warehouses can be configured under{' '}
                    <strong>Masters › Configuration</strong>. You can assign them after setup.
                  </span>
                }
                style={{ borderRadius: 6, marginBottom: 12 }}
              />
            )}
          </SectionBox>

          {/* ── Preferences ───────────────────────────────────────────── */}
          <SectionBox label="PREFERENCES">
            <Form.Item
              name="landing_page"
              initialValue="dashboard"
              label={
                <span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>
                  <AppstoreOutlined style={{ marginRight: 5, color: '#6b7280' }} />
                  Landing Page
                </span>
              }
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={LANDING_PAGE_OPTIONS}
              />
            </Form.Item>
          </SectionBox>

          {/* ── Info note ──────────────────────────────────────────────── */}
          <Alert
            type="info"
            showIcon
            message="Employee ID is auto-generated by department (e.g. DT11005 for Quality). Employee must change the default password on first login."
            style={{ borderRadius: 8, fontSize: 12 }}
          />
        </Form>
      </Drawer>

      {/* ════════════════════════════════════════════════════════════════════
          SUCCESS MODAL — shows temp credentials
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!successData}
        onCancel={() => { setSuccessData(null); setCopied(false); }}
        footer={
          <Button
            type="primary"
            onClick={() => { setSuccessData(null); setCopied(false); }}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
          >
            Done
          </Button>
        }
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 18 }} />
            <span style={{ color: '#111827', fontWeight: 700 }}>Employee Created</span>
          </div>
        }
        width={440}
        centered
      >
        {successData && (
          <div>
            <div
              style={{
                padding:      '12px 16px',
                background:   '#f0fdf4',
                border:       '1px solid #bbf7d0',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#15803d', fontSize: 13 }}>
                <strong>{successData.name}</strong> created with Employee ID{' '}
                <strong style={{ fontFamily: 'monospace' }}>{successData.employee_id}</strong>
              </Text>
            </div>

            <Text style={{ color: '#374151', fontSize: 13, display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Share these login credentials with the employee:
            </Text>

            <div style={{ marginBottom: 10 }}>
              <Text style={{ color: '#6b7280', fontSize: 11, display: 'block', marginBottom: 4 }}>
                Employee ID (login username)
              </Text>
              <div
                style={{
                  padding: '10px 14px', background: '#f8fafc',
                  border: '1px solid #e8eaed', borderRadius: 8,
                  fontFamily: 'monospace', fontWeight: 700, fontSize: 16,
                  letterSpacing: '0.05em', color: '#111827',
                }}
              >
                {successData.employee_id}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text style={{ color: '#6b7280', fontSize: 11, display: 'block', marginBottom: 4 }}>
                Temporary Password (employee must change on first login)
              </Text>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: '#f8fafc',
                  border: '1px solid #e8eaed', borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'monospace', fontSize: 16, fontWeight: 700,
                    color: '#111827', flex: 1, letterSpacing: '0.08em',
                  }}
                >
                  {successData.temp_password}
                </Text>
                <Button
                  size="small"
                  icon={copied ? <CheckCircleOutlined style={{ color: '#16a34a' }} /> : <CopyOutlined />}
                  onClick={handleCopy}
                  style={{ color: copied ? '#16a34a' : '#6b7280' }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <Alert
              type="warning"
              showIcon
              message="Note these credentials down. The employee will be forced to change their password on first login."
              style={{ borderRadius: 6, fontSize: 12 }}
            />
          </div>
        )}
      </Modal>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Employees"
        entityName="Employee"
        sampleHeaders={EMP_CSV_HEADERS}
        sampleRows={EMP_CSV_SAMPLE}
        validationRules={EMP_CSV_VALIDATION}
      />
    </AppLayout>
  );
};

export default EmployeesPage;
