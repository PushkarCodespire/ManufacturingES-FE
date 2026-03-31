import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select, Card,
  message, Tooltip, Tag, Drawer, Progress, DatePicker, InputNumber,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, RightOutlined,
  ToolOutlined,
DownloadOutlined, } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { moldMasterApi } from '../../../api/mold.api';
import { vendorApi } from '../../../api/procurement.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const STATUS_COLOR = {
  registered: 'blue', trial_pending: 'orange', production_ready: 'green',
  in_production: 'cyan', in_storage: 'default', repair_needed: 'red',
  in_repair: 'volcano', end_of_life: 'magenta', decommissioned: 'default',
};

const STATUS_OPTIONS = Object.keys(STATUS_COLOR).map((s) => ({
  label: s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s,
}));

const LIFE_STAGE_COLOR = {
  normal: 'green', plan_replacement: 'gold', urgent_replacement: 'orange',
  critical: 'red', end_of_life: 'magenta', extended_life: 'purple',
};

const LIFE_STAGE_OPTIONS = Object.keys(LIFE_STAGE_COLOR).map((s) => ({
  label: s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: s,
}));

const fmtLabel = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '\u2014';

const MoldMasterPage = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canWrite = can('mold-master-create_edit_delete');
  const [molds, setMolds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [lifeStageFilter, setLifeStageFilter] = useState(undefined);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ownerType, setOwnerType] = useState('company');
  const [form] = Form.useForm();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchMolds = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category_id = categoryFilter;
      if (lifeStageFilter) params.life_stage = lifeStageFilter;
      const res = await moldMasterApi.getAll(params);
      setMolds(res?.data ?? res ?? []);
      setTotal(res?.meta?.total ?? res?.total ?? (res?.data ?? res)?.length ?? 0);
    } catch (err) { message.error(err?.message || 'Failed to load molds'); }
    finally { setLoading(false); }
  }, [page, pageSize, debouncedSearch, statusFilter, categoryFilter, lifeStageFilter]);

  useEffect(() => { fetchMolds(); }, [fetchMolds]);

  useEffect(() => {
    moldMasterApi.getCategories()
      .then((res) => setCategories(res?.data ?? res ?? []))
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    (async () => {
      try { const res = await vendorApi.getAll({ pageSize: 9999 }); setVendors(res?.data ?? res ?? []); }
      catch { /* ignore */ }
    })();
  }, []);

  const openDrawer = (record = null) => {
    setEditRecord(record);
    if (record) {
      form.setFieldsValue({
        ...record,
        category_id: record.category_id ?? (record.Category ?? record.category)?.id,
        installation_date: record.installation_date ? dayjs(record.installation_date) : null,
      });
      setOwnerType(record.owner_type ?? 'company');
    } else { form.resetFields(); setOwnerType('company'); }
    setDrawerOpen(true);
  };
  const closeDrawer = () => { setDrawerOpen(false); setEditRecord(null); form.resetFields(); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = { ...values, installation_date: values.installation_date ? values.installation_date.format('YYYY-MM-DD') : null };
      if (editRecord) { await moldMasterApi.update(editRecord.id, payload); message.success('Mold updated successfully'); }
      else { await moldMasterApi.create(payload); message.success('Mold created successfully'); }
      closeDrawer(); fetchMolds();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message ?? 'Failed to save mold');
    } finally { setSaving(false); }
  };

  const activeCount = molds.filter((m) => m.status === 'in_production').length;

  const columns = [
    { title: 'Mold Code', dataIndex: 'mold_code', key: 'mold_code', width: 130,
      render: (v) => <Text style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>{v}</Text> },
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true,
      render: (v) => <Text style={{ fontWeight: 500 }}>{v}</Text> },
    { title: 'Category', key: 'category', width: 130,
      render: (_, r) => (r.Category ?? r.category)?.name ?? <Text type="secondary">{'\u2014'}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 140,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'} style={{ borderRadius: 20, fontSize: 11 }}>{fmtLabel(v)}</Tag> },
    { title: 'Life Stage', dataIndex: 'life_stage', key: 'life_stage', width: 150,
      render: (v) => v ? <Tag color={LIFE_STAGE_COLOR[v] ?? 'default'} style={{ borderRadius: 20, fontSize: 11 }}>{fmtLabel(v)}</Tag> : <Text type="secondary">{'\u2014'}</Text> },
    { title: 'Shots / Life', key: 'shots_life', width: 180,
      render: (_, r) => {
        const current = r.current_shot_count ?? 0, expected = r.expected_life_shots ?? 1;
        const pct = expected > 0 ? Math.round((current / expected) * 100) : 0;
        const color = pct < 70 ? '#52c41a' : pct < 85 ? '#faad14' : pct < 95 ? '#fa8c16' : '#f5222d';
        return (<Tooltip title={`${current.toLocaleString()} / ${expected.toLocaleString()} shots`}>
          <Progress percent={Math.min(pct, 100)} size="small" strokeColor={color} format={() => `${pct}%`} style={{ minWidth: 120 }} />
        </Tooltip>);
      } },
    { title: 'Owner', dataIndex: 'owner_type', key: 'owner_type', width: 100, render: (v) => fmtLabel(v) },
    { title: 'Storage', key: 'storage_location', width: 120, ellipsis: true,
      render: (_, r) => { const loc = r.StorageLocation ?? r.storage_location; return (typeof loc === 'string' ? loc : loc?.name) ?? <Text type="secondary">{'\u2014'}</Text>; } },
    ...(canWrite ? [{ title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => <Button size="small" icon={<ToolOutlined />} style={{ borderRadius: 6, fontSize: 12 }}
        onClick={(e) => { e.stopPropagation(); openDrawer(r); }}>Edit</Button> }] : []),
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Mold</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Mold Master</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Mold Master</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Register and manage injection molds, track lifecycle and ownership.</Text>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Molds', value: total, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'In Production', value: activeCount, color: '#16a34a', bg: '#f0fdf4' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '8px 16px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{s.value}</Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Input placeholder="Search mold code / name..." prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 240, borderRadius: 8 }} allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={STATUS_OPTIONS} allowClear style={{ width: 170 }} />
          <Select placeholder="Category" value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setPage(1); }}
            options={categories.map((c) => ({ label: c.name, value: c.id }))} allowClear style={{ width: 160 }} />
          <Select placeholder="Life Stage" value={lifeStageFilter} onChange={(v) => { setLifeStageFilter(v); setPage(1); }}
            options={LIFE_STAGE_OPTIONS} allowClear style={{ width: 170 }} />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('mold-master.csv', molds, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchMolds} style={{ borderRadius: 8 }}>Refresh</Button>
          {canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()} style={{ borderRadius: 8, fontWeight: 600 }}>Add Mold</Button>}
        </div>
        <Table rowKey="id" columns={columns} dataSource={molds} loading={loading}
          pagination={{ current: page, pageSize, total, onChange: (p, ps) => { setPage(p); setPageSize(ps); }, showTotal: (t) => `${t} molds`, showSizeChanger: true, style: { marginBottom: 0 } }}
          onRow={(r) => ({ onClick: () => navigate(`/mold/master/${r.id}`), style: { cursor: 'pointer' } })}
          scroll={{ x: 1100 }} size="middle" style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{ emptyText: (<div style={{ padding: 40 }}><ToolOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} /><Text style={{ color: '#9ca3af' }}>No molds found</Text></div>) }} />
      </Card>

      <Drawer title={editRecord ? 'Edit Mold' : 'Add New Mold'} width={520} open={drawerOpen} onClose={closeDrawer} destroyOnClose
        extra={<Button type="primary" loading={saving} onClick={handleSave} style={{ borderRadius: 8 }}>{editRecord ? 'Update' : 'Create'}</Button>}>
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}><Input placeholder="Mold name" /></Form.Item>
          <Form.Item name="category_id" label="Category">
            <Select placeholder="Select category" options={categories.map((c) => ({ label: c.name, value: c.id }))} allowClear showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="serial_no" label="Serial No"><Input placeholder="Manufacturer serial number" /></Form.Item>
          <Form.Item name="manufacturer" label="Manufacturer"><Input placeholder="Manufacturer name" /></Form.Item>
          <Form.Item name="material" label="Material"><Input placeholder="e.g. P20, H13, S7" /></Form.Item>
          <Form.Item name="weight_kg" label="Weight (kg)"><InputNumber placeholder="Weight" min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="tonnage_req" label="Tonnage Requirement"><InputNumber placeholder="Required machine tonnage" min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="platen_size" label="Platen Size"><Input placeholder="e.g. 500x500 mm" /></Form.Item>
          <Form.Item name="tie_bar_spacing" label="Tie Bar Spacing"><Input placeholder="e.g. 560x560 mm" /></Form.Item>
          <Form.Item name="total_cavities" label="Total Cavities"><InputNumber placeholder="Number of cavities" min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="expected_life_shots" label="Expected Life (shots)"><InputNumber placeholder="Expected life in shot count" min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="owner_type" label="Owner Type">
            <Select placeholder="Select owner type" options={[{ label: 'Company', value: 'company' }, { label: 'Customer', value: 'customer' }]} onChange={(v) => setOwnerType(v)} />
          </Form.Item>
          {ownerType === 'customer' && (
            <Form.Item name="customer_id" label="Customer">
              <Select placeholder="Select customer" options={vendors.map((v) => ({ label: v.name, value: v.id }))} allowClear showSearch optionFilterProp="label" />
            </Form.Item>
          )}
          <Form.Item name="installation_date" label="Installation Date"><DatePicker style={{ width: '100%' }} format="DD MMM YYYY" /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} placeholder="Additional notes" /></Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
};

export default MoldMasterPage;
