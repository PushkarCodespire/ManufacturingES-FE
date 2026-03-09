import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Input, Tag, Typography,
  Modal, message, Tooltip, Badge,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  SettingOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { siteApi }      from '../../../api/site.api';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

// ── Table columns ─────────────────────────────────────────────────────────────
const buildColumns = (onToggle, toggleLoading, onView, canWrite) => [
  {
    title: 'Site Name',
    key:   'name',
    render: (_, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#eff6ff', border: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1d4ed8', fontSize: 16, flexShrink: 0,
          }}
        >
          <GlobalOutlined />
        </div>
        <div>
          <Text style={{ color: '#111827', fontWeight: 600, fontSize: 13, display: 'block' }}>
            {r.name}
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>{r.code}</Text>
        </div>
      </div>
    ),
  },
  {
    title:     'GSTIN',
    dataIndex: 'gstin',
    key:       'gstin',
    width:     160,
    render: (g) => g
      ? <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{g}</Text>
      : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
  },
  {
    title:  'Production',
    key:    'production',
    width:  130,
    render: (_, r) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {r.machine_scheduling && (
          <Tag style={{ fontSize: 10, borderRadius: 20, margin: 0 }} color="blue">Machine Scheduling</Tag>
        )}
        {r.manual_po_approval && (
          <Tag style={{ fontSize: 10, borderRadius: 20, margin: 0 }} color="purple">PO Approval</Tag>
        )}
        {!r.machine_scheduling && !r.manual_po_approval && (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>Default</Text>
        )}
      </div>
    ),
  },
  {
    title:  'Inventory',
    key:    'inventory',
    width:  130,
    render: (_, r) => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {r.rack_tracking   && <Tag style={{ fontSize: 10, borderRadius: 20, margin: 0 }} color="cyan">Rack</Tag>}
        {r.bundle_tracking && <Tag style={{ fontSize: 10, borderRadius: 20, margin: 0 }} color="cyan">Bundle</Tag>}
        {r.mrn_to_issue    && <Tag style={{ fontSize: 10, borderRadius: 20, margin: 0 }} color="cyan">MRN</Tag>}
        {r.alternate_unit  && <Tag style={{ fontSize: 10, borderRadius: 20, margin: 0 }} color="cyan">Alt Unit</Tag>}
        {!r.rack_tracking && !r.bundle_tracking && !r.mrn_to_issue && !r.alternate_unit && (
          <Text style={{ color: '#d1d5db', fontSize: 12 }}>Default</Text>
        )}
      </div>
    ),
  },
  {
    title:  'Status',
    key:    'status',
    width:  90,
    render: (_, r) => (
      r.is_active
        ? <Badge status="success" text={<Text style={{ color: '#16a34a', fontSize: 12, fontWeight: 500 }}>Active</Text>} />
        : <Badge status="error"   text={<Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 500 }}>Inactive</Text>} />
    ),
  },
  {
    title:  'Actions',
    key:    'actions',
    width:  170,
    render: (_, r) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Button
          size="small"
          icon={<SettingOutlined />}
          style={{ borderRadius: 6, fontSize: 12 }}
          onClick={() => onView(r)}
        >
          Configure
        </Button>
        {canWrite && (
          <Tooltip title={r.is_active ? 'Deactivate site' : 'Activate site'}>
            <Button
              size="small"
              icon={r.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              loading={toggleLoading === r.id}
              danger={r.is_active}
              style={{
                borderRadius: 6, fontSize: 12,
                ...(r.is_active ? {} : { color: '#16a34a', borderColor: '#16a34a' }),
              }}
              onClick={() => onToggle(r)}
            />
          </Tooltip>
        )}
      </div>
    ),
  },
];

// ── Main Component ─────────────────────────────────────────────────────────────
const ConfigurationPage = () => {
  const navigate = useNavigate();
  const { can }  = usePermissions();
  const canWrite = can('sites-configuration-create_edit_delete');

  const [sites,         setSites]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [toggleLoading, setToggleLoading] = useState(null);
  const [search,        setSearch]        = useState('');

  // ── Fetch sites ───────────────────────────────────────────────────────────
  const fetchSites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await siteApi.getAll(search ? { search } : {});
      setSites(data ?? []);
    } catch {
      message.error('Failed to load sites');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  // ── Toggle ────────────────────────────────────────────────────────────────
  const handleToggle = (record) => {
    Modal.confirm({
      title:   `${record.is_active ? 'Deactivate' : 'Activate'} Site?`,
      content: `${record.is_active ? 'Deactivate' : 'Activate'} site "${record.name}"?`,
      okText:  record.is_active ? 'Deactivate' : 'Activate',
      okType:  record.is_active ? 'danger' : 'primary',
      okButtonProps: record.is_active ? {} : { style: { background: '#16a34a', borderColor: '#16a34a' } },
      onOk: async () => {
        setToggleLoading(record.id);
        try {
          await siteApi.toggleStatus(record.id);
          message.success(`Site "${record.name}" ${record.is_active ? 'deactivated' : 'activated'}`);
          fetchSites();
        } catch {
          message.error('Failed to update site status');
        } finally {
          setToggleLoading(null);
        }
      },
    });
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActive = sites.filter((s) => s.is_active).length;

  return (
    <AppLayout>
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Configuration</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Configuration
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage sites, production settings and branding preferences
        </Text>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Sites', value: sites.length,  color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Active',      value: totalActive,   color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Inactive',    value: sites.length - totalActive, color: '#6b7280', bg: '#f9fafb' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: '8px 16px', background: s.bg,
              border: `1px solid ${s.color}30`, borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90,
            }}
          >
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              {s.value}
            </Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      {/* ── Sites Table Card ────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search sites…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchSites} style={{ borderRadius: 8 }}>
            Refresh
          </Button>
          {canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/masters/configuration/sites/add')}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Add New Site
            </Button>
          )}
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          columns={buildColumns(handleToggle, toggleLoading, (r) => navigate(`/masters/configuration/sites/${r.id}`), canWrite)}
          dataSource={sites}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} sites`, style: { marginBottom: 0 } }}
          scroll={{ x: 900 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <GlobalOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No sites configured yet</Text>
                {canWrite && (
                  <>
                    <br />
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => navigate('/masters/configuration/sites/add')}
                      style={{ marginTop: 10 }}
                    >
                      Add Your First Site
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

export default ConfigurationPage;
