import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Tabs, Table, Switch, Select, Input, Button, Card,
  Slider, Checkbox, Radio, Tag, message, Spin, Empty, Alert,
} from 'antd';
import {
  SettingOutlined, RightOutlined, ReloadOutlined,
  SearchOutlined, SaveOutlined, RobotOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  moduleToggleApi,
  featureToggleApi,
  rolePermissionApi,
  userOverrideApi,
  aiAgentToggleApi,
  fieldVisibilityApi,
  auditLogApi,
} from '../../../api/admin.api';
import AppLayout    from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option }      = Select;

// ══════════════════════════════════════════════════════════════════════════════
//  1. MODULE TOGGLES TAB
// ══════════════════════════════════════════════════════════════════════════════
const ModuleTogglesTab = () => {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await moduleToggleApi.getAll();
      setData(res ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleToggle = async (record, checked) => {
    try {
      await moduleToggleApi.toggle(record.id, { is_enabled: checked });
      message.success(`${record.display_name} ${checked ? 'enabled' : 'disabled'}`);
      setData((prev) =>
        prev.map((m) => (m.id === record.id ? { ...m, is_enabled: checked } : m)),
      );
    } catch (err) {
      message.error(err?.message || 'Failed to toggle module');
    }
  };

  const columns = [
    {
      title:     'Module Name',
      dataIndex: 'display_name',
      key:       'display_name',
      render: (name) => (
        <Text style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>{name}</Text>
      ),
    },
    {
      title:  'Status',
      key:    'status',
      width:  120,
      render: (_, r) => (
        <Switch
          checked={r.is_enabled}
          onChange={(checked) => handleToggle(r, checked)}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
      ),
    },
    {
      title:     'Display Order',
      dataIndex: 'display_order',
      key:       'display_order',
      width:     130,
      render: (v) => (
        <Tag style={{ borderRadius: 20, fontSize: 12 }}>{v ?? '---'}</Tag>
      ),
    },
  ];

  return (
    <Card
      style={{ border: '1px solid #e8eaed', borderRadius: 12 }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Enable or disable entire modules across the platform.
        </Text>
        <Button icon={<ReloadOutlined />} onClick={fetch} style={{ borderRadius: 8 }}>
          Refresh
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        size="middle"
        style={{ borderRadius: 8, overflow: 'hidden' }}
      />
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  2. FEATURE TOGGLES TAB
// ══════════════════════════════════════════════════════════════════════════════
const FeatureTogglesTab = () => {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await featureToggleApi.getAll();
      setData(res ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load features');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleToggle = async (record, checked) => {
    try {
      await featureToggleApi.toggle(record.id, { is_enabled: checked });
      message.success(`${record.display_name} ${checked ? 'enabled' : 'disabled'}`);
      setData((prev) =>
        prev.map((f) => (f.id === record.id ? { ...f, is_enabled: checked } : f)),
      );
    } catch (err) {
      message.error(err?.message || 'Failed to toggle feature');
    }
  };

  const columns = [
    {
      title:     'Feature Name',
      dataIndex: 'display_name',
      key:       'display_name',
      render: (name) => (
        <Text style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>{name}</Text>
      ),
    },
    {
      title:     'Module',
      dataIndex: 'module_key',
      key:       'module_key',
      width:     180,
      render: (mod) => (
        <Tag
          style={{
            background:   '#eff6ff',
            border:       '1px solid #bfdbfe',
            color:        '#1d4ed8',
            borderRadius: 20,
            fontSize:     11,
            padding:      '1px 10px',
            fontWeight:   500,
          }}
        >
          {mod || '---'}
        </Tag>
      ),
    },
    {
      title:  'Status',
      key:    'status',
      width:  120,
      render: (_, r) => (
        <Switch
          checked={r.is_enabled}
          onChange={(checked) => handleToggle(r, checked)}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
      ),
    },
    {
      title:     'Required Roles',
      dataIndex: 'required_roles',
      key:       'required_roles',
      width:     240,
      render: (roles) =>
        roles?.length ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {roles.map((r) => (
              <Tag key={r} style={{ fontSize: 11, borderRadius: 20 }}>{r}</Tag>
            ))}
          </div>
        ) : (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>All Roles</Text>
        ),
    },
  ];

  return (
    <Card
      style={{ border: '1px solid #e8eaed', borderRadius: 12 }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Toggle individual features within modules.
        </Text>
        <Button icon={<ReloadOutlined />} onClick={fetch} style={{ borderRadius: 8 }}>
          Refresh
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} features` }}
        size="middle"
        scroll={{ x: 800 }}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      />
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  3. ROLE PERMISSIONS TAB
// ══════════════════════════════════════════════════════════════════════════════
const RolePermissionsTab = () => {
  const [roles, setRoles]           = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissions, setPermissions]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);

  // Load roles on mount
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const res = await rolePermissionApi.getRoles();
        setRoles(res ?? []);
      } catch (err) {
        message.error(err?.message || 'Failed to load roles');
      }
    };
    loadRoles();
  }, []);

  // Load permission grid when a role is selected
  useEffect(() => {
    if (!selectedRole) { setPermissions([]); return; }
    const loadGrid = async () => {
      setLoading(true);
      try {
        const res = await rolePermissionApi.getGrid(selectedRole);
        setPermissions(res ?? []);
      } catch (err) {
        message.error(err?.message || 'Failed to load permissions');
      } finally {
        setLoading(false);
      }
    };
    loadGrid();
  }, [selectedRole]);

  const handleCheck = (permKey) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.key === permKey ? { ...p, granted: !p.granted } : p,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const granted = permissions.filter((p) => p.granted).map((p) => p.key);
      await rolePermissionApi.update(selectedRole, { permissions: granted });
      message.success('Permissions updated successfully');
    } catch (err) {
      message.error(err?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module for easier scanning
  const grouped = permissions.reduce((acc, p) => {
    const group = p.module || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {});

  return (
    <Card
      style={{ border: '1px solid #e8eaed', borderRadius: 12 }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <Select
          placeholder="Select a role..."
          style={{ width: 280 }}
          value={selectedRole}
          onChange={(v) => setSelectedRole(v)}
          allowClear
          showSearch
          optionFilterProp="label"
        >
          {roles.map((r) => (
            <Option key={r.id} value={r.id} label={r.label}>
              {r.label}
            </Option>
          ))}
        </Select>
        {selectedRole && (
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Save Permissions
          </Button>
        )}
      </div>

      {!selectedRole && (
        <Empty
          description="Select a role to view and edit its permissions"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      {selectedRole && loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {selectedRole && !loading && permissions.length > 0 && (
        <div style={{ maxHeight: 500, overflow: 'auto' }}>
          {Object.entries(grouped).map(([moduleName, perms]) => (
            <div
              key={moduleName}
              style={{
                marginBottom: 16,
                background:   '#f8fafc',
                border:        '1px solid #e8eaed',
                borderRadius:  10,
                padding:       '12px 16px',
              }}
            >
              <Text
                style={{
                  color:         '#374151',
                  fontWeight:    600,
                  fontSize:      12,
                  letterSpacing: '0.04em',
                  display:       'block',
                  marginBottom:  10,
                  textTransform: 'uppercase',
                }}
              >
                {moduleName}
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {perms.map((p) => (
                  <Checkbox
                    key={p.key}
                    checked={p.granted}
                    onChange={() => handleCheck(p.key)}
                    style={{ fontSize: 13 }}
                  >
                    {p.label || p.key}
                  </Checkbox>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedRole && !loading && permissions.length === 0 && (
        <Empty
          description="No permissions found for this role"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  4. USER OVERRIDES TAB
// ══════════════════════════════════════════════════════════════════════════════
const UserOverridesTab = () => {
  const [searchTerm, setSearchTerm]     = useState('');
  const [results, setResults]           = useState([]);
  const [searching, setSearching]       = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [overrides, setOverrides]       = useState([]);
  const [loadingUser, setLoadingUser]   = useState(false);
  const [saving, setSaving]             = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setSelectedUser(null);
    setOverrides([]);
    try {
      const res = await userOverrideApi.search({ search: searchTerm.trim() });
      setResults(res ?? []);
      if (!res?.length) message.info('No users found');
    } catch (err) {
      message.error(err?.message || 'Failed to search users');
    } finally {
      setSearching(false);
    }
  }, [searchTerm]);

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setLoadingUser(true);
    try {
      const res = await userOverrideApi.getById(user.id);
      setOverrides(res?.overrides ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load user overrides');
    } finally {
      setLoadingUser(false);
    }
  };

  const handleOverrideCheck = (permKey) => {
    setOverrides((prev) =>
      prev.map((o) =>
        o.key === permKey ? { ...o, granted: !o.granted } : o,
      ),
    );
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const granted = overrides.filter((o) => o.granted).map((o) => o.key);
      await userOverrideApi.update(selectedUser.id, { overrides: granted });
      message.success(`Overrides saved for ${selectedUser.name}`);
    } catch (err) {
      message.error(err?.message || 'Failed to save overrides');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      style={{ border: '1px solid #e8eaed', borderRadius: 12 }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Input
          placeholder="Search by name, Employee ID, or email..."
          prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 360, borderRadius: 8 }}
          allowClear
        />
        <Button
          type="primary"
          loading={searching}
          onClick={handleSearch}
          style={{ borderRadius: 8 }}
        >
          Search
        </Button>
      </div>

      {/* Search results */}
      {results.length > 0 && !selectedUser && (
        <Table
          rowKey="id"
          dataSource={results}
          size="small"
          pagination={false}
          style={{ marginBottom: 16 }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => handleSelectUser(record),
          })}
          columns={[
            {
              title: 'Employee ID', dataIndex: 'employee_id', key: 'employee_id', width: 130,
              render: (id) => <Text style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>{id}</Text>,
            },
            {
              title: 'Name', dataIndex: 'name', key: 'name',
              render: (n) => <Text style={{ color: '#1d4ed8', fontWeight: 500, fontSize: 13 }}>{n}</Text>,
            },
            { title: 'Role', dataIndex: ['role', 'label'], key: 'role', width: 180 },
            { title: 'Department', dataIndex: ['department', 'name'], key: 'department', width: 160 },
          ]}
        />
      )}

      {/* Selected user overrides */}
      {selectedUser && (
        <div>
          <div
            style={{
              display:       'flex',
              justifyContent:'space-between',
              alignItems:    'center',
              marginBottom:  16,
              padding:       '10px 14px',
              background:    '#eff6ff',
              border:        '1px solid #bfdbfe',
              borderRadius:  8,
            }}
          >
            <div>
              <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 14 }}>
                {selectedUser.name}
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 12, marginLeft: 10 }}>
                {selectedUser.employee_id} -- {selectedUser.role?.label || 'No role'}
              </Text>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="small"
                onClick={() => { setSelectedUser(null); setOverrides([]); }}
                style={{ borderRadius: 6 }}
              >
                Back to results
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
                style={{ borderRadius: 6, fontWeight: 600 }}
              >
                Save Overrides
              </Button>
            </div>
          </div>

          {loadingUser ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
          ) : overrides.length > 0 ? (
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {overrides.map((o) => (
                  <Checkbox
                    key={o.key}
                    checked={o.granted}
                    onChange={() => handleOverrideCheck(o.key)}
                    style={{ fontSize: 13, minWidth: 220 }}
                  >
                    {o.label || o.key}
                  </Checkbox>
                ))}
              </div>
            </div>
          ) : (
            <Empty
              description="No permission overrides available for this user"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      )}

      {results.length === 0 && !selectedUser && (
        <Empty
          description="Search for a user to view and edit their permission overrides"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  5. AI AGENT TOGGLES TAB
// ══════════════════════════════════════════════════════════════════════════════
const AIAgentTogglesTab = () => {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await aiAgentToggleApi.getAll();
      setData(res ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load AI agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleToggle = async (record, checked) => {
    try {
      await aiAgentToggleApi.toggle(record.id, { is_enabled: checked, budget_limit: record.budget_limit });
      message.success(`${record.display_name} ${checked ? 'enabled' : 'disabled'}`);
      setData((prev) =>
        prev.map((a) => (a.id === record.id ? { ...a, is_enabled: checked } : a)),
      );
    } catch (err) {
      message.error(err?.message || 'Failed to toggle agent');
    }
  };

  const handleBudgetChange = async (record, value) => {
    try {
      await aiAgentToggleApi.toggle(record.id, { is_enabled: record.is_enabled, budget_limit: value });
      setData((prev) =>
        prev.map((a) => (a.id === record.id ? { ...a, budget_limit: value } : a)),
      );
    } catch (err) {
      message.error(err?.message || 'Failed to update budget');
    }
  };

  const columns = [
    {
      title:     'Agent Name',
      dataIndex: 'display_name',
      key:       'display_name',
      width:     180,
      render: (name) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ color: '#7c3aed', fontSize: 16 }} />
          <Text style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>{name}</Text>
        </div>
      ),
    },
    {
      title:     'Description',
      dataIndex: 'description',
      key:       'description',
      render: (desc) => (
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{desc || '---'}</Text>
      ),
    },
    {
      title:  'Enabled',
      key:    'enabled',
      width:  120,
      render: (_, r) => (
        <Switch
          checked={r.is_enabled}
          onChange={(checked) => handleToggle(r, checked)}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
      ),
    },
    {
      title:  'Budget',
      key:    'budget',
      width:  260,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Slider
            min={0}
            max={500}
            step={5}
            value={r.budget_limit ?? 0}
            onChange={(val) =>
              setData((prev) =>
                prev.map((a) => (a.id === r.id ? { ...a, budget_limit: val } : a)),
              )
            }
            onChangeComplete={(val) => handleBudgetChange(r, val)}
            style={{ flex: 1, margin: 0 }}
            disabled={!r.is_enabled}
          />
          <Text
            style={{
              fontFamily:  'monospace',
              fontWeight:  600,
              fontSize:    13,
              color:       r.is_enabled ? '#111827' : '#d1d5db',
              minWidth:    60,
              textAlign:   'right',
            }}
          >
            ${parseFloat(r.budget_limit ?? 0).toFixed(2)}
          </Text>
        </div>
      ),
    },
  ];

  return (
    <Card
      style={{ border: '1px solid #e8eaed', borderRadius: 12 }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Enable/disable Madad AI agents and set per-agent budget limits.
        </Text>
        <Button icon={<ReloadOutlined />} onClick={fetch} style={{ borderRadius: 8 }}>
          Refresh
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        size="middle"
        style={{ borderRadius: 8, overflow: 'hidden' }}
      />
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  6. FIELD VISIBILITY TAB
// ══════════════════════════════════════════════════════════════════════════════
const VISIBILITY_OPTIONS = [
  { label: 'Visible',  value: 'visible' },
  { label: 'Hidden',   value: 'hidden' },
  { label: 'ReadOnly', value: 'readonly' },
];

const FieldVisibilityTab = () => {
  const [features, setFeatures]             = useState([]);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [grid, setGrid]                     = useState(null); // { fields: [], roles: [], matrix: {} }
  const [loading, setLoading]               = useState(false);
  const [saving, setSaving]                 = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fieldVisibilityApi.getFeatures();
        setFeatures(res ?? []);
      } catch (err) {
        message.error(err?.message || 'Failed to load features');
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedFeature) { setGrid(null); return; }
    const loadGrid = async () => {
      setLoading(true);
      try {
        const res = await fieldVisibilityApi.getGrid(selectedFeature);
        setGrid(res ?? null);
      } catch (err) {
        message.error(err?.message || 'Failed to load field visibility grid');
      } finally {
        setLoading(false);
      }
    };
    loadGrid();
  }, [selectedFeature]);

  const handleCellChange = (fieldKey, roleKey, value) => {
    setGrid((prev) => {
      if (!prev) return prev;
      const newMatrix = { ...prev.matrix };
      if (!newMatrix[fieldKey]) newMatrix[fieldKey] = {};
      newMatrix[fieldKey] = { ...newMatrix[fieldKey], [roleKey]: value };
      return { ...prev, matrix: newMatrix };
    });
  };

  const handleSave = async () => {
    if (!selectedFeature || !grid) return;
    setSaving(true);
    try {
      await fieldVisibilityApi.update(selectedFeature, { matrix: grid.matrix });
      message.success('Field visibility saved');
    } catch (err) {
      message.error(err?.message || 'Failed to save field visibility');
    } finally {
      setSaving(false);
    }
  };

  // Build dynamic table columns: first col = field name, then one col per role
  const columns = [
    {
      title:     'Field',
      dataIndex: 'key',
      key:       'field',
      fixed:     'left',
      width:     180,
      render: (_, field) => (
        <Text style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>{field.label || field.key}</Text>
      ),
    },
    ...(grid?.roles ?? []).map((role) => ({
      title:     role.label || role.key,
      key:       role.key,
      width:     140,
      align:     'center',
      render: (_, field) => {
        const val = grid?.matrix?.[field.key]?.[role.key] ?? 'visible';
        return (
          <Radio.Group
            size="small"
            value={val}
            onChange={(e) => handleCellChange(field.key, role.key, e.target.value)}
            optionType="button"
            buttonStyle="solid"
            options={VISIBILITY_OPTIONS}
            style={{ fontSize: 10 }}
          />
        );
      },
    })),
  ];

  return (
    <Card
      style={{ border: '1px solid #e8eaed', borderRadius: 12 }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <Select
          placeholder="Select a feature..."
          style={{ width: 300 }}
          value={selectedFeature}
          onChange={(v) => setSelectedFeature(v)}
          allowClear
          showSearch
          optionFilterProp="label"
        >
          {features.map((f) => (
            <Option key={f.id} value={f.id} label={f.name}>
              {f.name}
            </Option>
          ))}
        </Select>
        {selectedFeature && grid && (
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Save Visibility
          </Button>
        )}
      </div>

      {!selectedFeature && (
        <Empty
          description="Select a feature to configure field-level visibility per role"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      {selectedFeature && loading && (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
      )}

      {selectedFeature && !loading && grid && grid.fields?.length > 0 && (
        <Table
          rowKey="key"
          columns={columns}
          dataSource={grid.fields}
          pagination={false}
          size="small"
          scroll={{ x: 180 + (grid.roles?.length ?? 0) * 140 }}
          style={{ borderRadius: 8, overflow: 'hidden' }}
        />
      )}

      {selectedFeature && !loading && grid && (!grid.fields || grid.fields.length === 0) && (
        <Empty
          description="No fields configured for this feature"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  7. AUDIT LOG TAB
// ══════════════════════════════════════════════════════════════════════════════
const AuditLogTab = () => {
  const [data, setData]                   = useState([]);
  const [loading, setLoading]             = useState(false);
  const [pagination, setPagination]       = useState({ current: 1, pageSize: 20, total: 0 });
  const [actionFilter, setActionFilter]   = useState(undefined);
  const [entityFilter, setEntityFilter]   = useState(undefined);

  const fetch = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (actionFilter) params.action      = actionFilter;
      if (entityFilter) params.entity_type = entityFilter;

      const res = await auditLogApi.getAll(params);
      setData(res?.rows ?? res?.data ?? res ?? []);
      setPagination((prev) => ({
        ...prev,
        current:  page,
        pageSize,
        total:    res?.total ?? res?.count ?? 0,
      }));
    } catch (err) {
      message.error(err?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter]);

  useEffect(() => { fetch(1, pagination.pageSize); }, [fetch]);

  const handleTableChange = (pag) => {
    fetch(pag.current, pag.pageSize);
  };

  const columns = [
    {
      title:     'Date',
      dataIndex: 'created_at',
      key:       'date',
      width:     170,
      render: (d) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>
          {d ? dayjs(d).format('DD MMM YYYY HH:mm:ss') : '---'}
        </Text>
      ),
    },
    {
      title:     'Actor',
      dataIndex: 'actor_name',
      key:       'actor',
      width:     160,
      render: (name, r) => (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13, color: '#111827', display: 'block' }}>
            {name || '---'}
          </Text>
          {r.actor_id && (
            <Text style={{ fontSize: 11, color: '#9ca3af' }}>{r.actor_id}</Text>
          )}
        </div>
      ),
    },
    {
      title:     'Action',
      dataIndex: 'action',
      key:       'action',
      width:     130,
      render: (action) => {
        const colorMap = {
          create:  { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' },
          update:  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
          delete:  { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
          toggle:  { bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
        };
        const c = colorMap[action] || { bg: '#f3f4f6', border: '#e5e7eb', text: '#6b7280' };
        return (
          <Tag
            style={{
              background:   c.bg,
              border:       `1px solid ${c.border}`,
              color:        c.text,
              borderRadius: 20,
              fontSize:     11,
              fontWeight:   500,
              padding:      '1px 10px',
            }}
          >
            {action || '---'}
          </Tag>
        );
      },
    },
    {
      title:     'Entity Type',
      dataIndex: 'entity_type',
      key:       'entity_type',
      width:     140,
      render: (t) => <Text style={{ fontSize: 12, color: '#374151' }}>{t || '---'}</Text>,
    },
    {
      title:     'Entity ID',
      dataIndex: 'entity_id',
      key:       'entity_id',
      width:     120,
      render: (id) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{id || '---'}</Text>
      ),
    },
    {
      title:     'Old Value',
      dataIndex: 'old_value',
      key:       'old_value',
      width:     180,
      ellipsis:  true,
      render: (v) => (
        <Text style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
          {v ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : '---'}
        </Text>
      ),
    },
    {
      title:     'New Value',
      dataIndex: 'new_value',
      key:       'new_value',
      width:     180,
      ellipsis:  true,
      render: (v) => (
        <Text style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
          {v ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : '---'}
        </Text>
      ),
    },
  ];

  return (
    <Card
      style={{ border: '1px solid #e8eaed', borderRadius: 12 }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <Select
          placeholder="All Actions"
          style={{ width: 160 }}
          value={actionFilter}
          onChange={(v) => setActionFilter(v)}
          allowClear
          suffixIcon={<FilterOutlined style={{ color: '#9ca3af' }} />}
        >
          <Option value="create">Create</Option>
          <Option value="update">Update</Option>
          <Option value="delete">Delete</Option>
          <Option value="toggle">Toggle</Option>
        </Select>
        <Select
          placeholder="All Entity Types"
          style={{ width: 180 }}
          value={entityFilter}
          onChange={(v) => setEntityFilter(v)}
          allowClear
          suffixIcon={<FilterOutlined style={{ color: '#9ca3af' }} />}
        >
          <Option value="module">Module</Option>
          <Option value="feature">Feature</Option>
          <Option value="role_permission">Role Permission</Option>
          <Option value="user_override">User Override</Option>
          <Option value="ai_agent">AI Agent</Option>
          <Option value="field_visibility">Field Visibility</Option>
        </Select>
        <div style={{ flex: 1 }} />
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetch(1, pagination.pageSize)}
          style={{ borderRadius: 8 }}
        >
          Refresh
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal:       (total) => `${total} entries`,
          style:           { marginBottom: 0 },
        }}
        onChange={handleTableChange}
        size="small"
        scroll={{ x: 1100 }}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      />
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  TAB CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════
const TAB_ITEMS = [
  { key: 'modules',           label: 'Module Toggles',    children: <ModuleTogglesTab /> },
  { key: 'features',          label: 'Feature Toggles',   children: <FeatureTogglesTab /> },
  { key: 'role-permissions',  label: 'Role Permissions',  children: <RolePermissionsTab /> },
  { key: 'user-overrides',    label: 'User Overrides',    children: <UserOverridesTab /> },
  { key: 'ai-agents',         label: 'AI Agent Toggles',  children: <AIAgentTogglesTab /> },
  { key: 'field-visibility',  label: 'Field Visibility',  children: <FieldVisibilityTab /> },
  { key: 'audit-log',         label: 'Audit Log',         children: <AuditLogTab /> },
];

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const ControlRoomPage = () => {
  const { isAdmin } = usePermissions();

  // Only plant_head and it_admin can access
  if (!isAdmin) {
    return (
      <AppLayout>
        <Alert
          type="error"
          showIcon
          message="Access Denied"
          description="The Admin Control Room is restricted to Plant Head and IT Admin roles only."
          style={{ maxWidth: 500, margin: '60px auto', borderRadius: 10 }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* ── Breadcrumb + heading ──────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Admin</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Control Room</Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width:          36,
              height:         36,
              borderRadius:   10,
              background:     '#eff6ff',
              border:         '1px solid #bfdbfe',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              color:          '#1d4ed8',
              fontSize:       18,
            }}
          >
            <SettingOutlined />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
              Admin Control Room
            </Title>
            <Text style={{ color: '#6b7280', fontSize: 13 }}>
              7-layer control system for modules, features, permissions, and AI agents.
            </Text>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs
        items={TAB_ITEMS}
        defaultActiveKey="modules"
        size="middle"
        style={{ marginTop: 4 }}
        tabBarStyle={{
          marginBottom:   20,
          borderBottom:   '1px solid #e8eaed',
        }}
      />
    </AppLayout>
  );
};

export default ControlRoomPage;
