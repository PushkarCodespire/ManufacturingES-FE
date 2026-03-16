import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Input, Table, Tag, Space, Modal, Form,
  Select, message, Row, Col, Statistic, Tooltip, Badge, Empty,
  Timeline, Popover, Divider, Drawer, Popconfirm, InputNumber,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, RightOutlined, EnvironmentOutlined,
  InboxOutlined, ToolOutlined, SwapOutlined, EditOutlined,
  CalendarOutlined, DatabaseOutlined, PlusOutlined, DeleteOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { moldStoreApi, moldMasterApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');
const fmtDate = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY') : '—');

const STATUS_COLORS = {
  in_production: 'blue',
  in_storage: 'green',
  in_repair: 'orange',
  end_of_life: 'default',
  available: 'green',
  issued: 'blue',
};

const LIFE_STAGE_COLORS = {
  normal: 'green',
  plan_replacement: 'gold',
  urgent: 'orange',
  critical: 'red',
  eol: 'default',
};

const SLOT_COLORS = {
  available: '#52c41a',
  occupied: '#1890ff',
  reserved: '#fa8c16',
};

export default function MoldStoreDashboardPage() {
  const { can } = usePermissions();
  const canWrite = can('mold-store_dashboard-create_edit_delete');

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rackMap, setRackMap] = useState([]);
  const [rackLoading, setRackLoading] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedMoldForLocation, setSelectedMoldForLocation] = useState(null);
  const [newLocationId, setNewLocationId] = useState(null);
  const [locationSaving, setLocationSaving] = useState(false);

  // ── Manage Locations drawer ──────────────────────────────────────────────
  const [locDrawerOpen, setLocDrawerOpen] = useState(false);
  const [locForm] = Form.useForm();
  const [editingLoc, setEditingLoc] = useState(null);
  const [locSaving, setLocSaving] = useState(false);

  const openAddLoc = () => { setEditingLoc(null); locForm.resetFields(); setLocDrawerOpen(true); };
  const openEditLoc = (loc) => {
    setEditingLoc(loc);
    locForm.setFieldsValue({
      rack_number:     Number(loc.rack_number),
      shelf_number:    Number(loc.shelf_number),
      position_number: Number(loc.position_number),
      capacity_kg:     loc.capacity_kg != null ? Number(loc.capacity_kg) : null,
    });
    setLocDrawerOpen(true);
  };

  const handleSaveLoc = async () => {
    try {
      const values = await locForm.validateFields();
      setLocSaving(true);
      if (editingLoc) {
        await moldStoreApi.updateLocationRecord(editingLoc.id, values);
        message.success('Location updated');
      } else {
        await moldStoreApi.createLocation(values);
        message.success('Location added');
      }
      setLocDrawerOpen(false);
      locForm.resetFields();
      setEditingLoc(null);
      loadRackMap();
    } catch (err) {
      if (err?.errorFields) return; // validation error
      message.error(err?.message ?? 'Failed to save location');
    } finally { setLocSaving(false); }
  };

  const handleDeleteLoc = async (id) => {
    try {
      await moldStoreApi.deleteLocation(id);
      message.success('Location deleted');
      loadRackMap();
    } catch (err) { message.error(err?.message ?? 'Failed to delete location'); }
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await moldStoreApi.getDashboard();
      // backend: { success, data: { summary, molds } }
      const payload = res?.data ?? res;
      setDashboard(payload?.summary ?? {});
      setInventory(Array.isArray(payload?.molds) ? payload.molds : []);
    } catch { message.error('Failed to load store dashboard'); }
    finally { setLoading(false); }
  }, []);

  const loadRackMap = useCallback(async () => {
    setRackLoading(true);
    try {
      const res = await moldStoreApi.getRackMap();
      // backend: { success, data: locations[] }
      const locations = res?.data ?? res;
      setRackMap(Array.isArray(locations) ? locations : []);
    } catch { message.error('Failed to load rack map'); }
    finally { setRackLoading(false); }
  }, []);

  const loadForecast = useCallback(async () => {
    setForecastLoading(true);
    try {
      const res = await moldStoreApi.getMovementForecast();
      // backend: { success, data: movements[] }
      const movements = res?.data ?? res;
      setForecast(Array.isArray(movements) ? movements : []);
    } catch { message.error('Failed to load movement forecast'); }
    finally { setForecastLoading(false); }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { loadRackMap(); }, [loadRackMap]);
  useEffect(() => { loadForecast(); }, [loadForecast]);

  const handleUpdateLocation = async () => {
    if (!newLocationId) {
      message.error('Please select a storage location');
      return;
    }
    setLocationSaving(true);
    try {
      await moldStoreApi.updateLocation(selectedMoldForLocation.id, { storage_location_id: newLocationId });
      message.success('Location updated successfully');
      setLocationModalOpen(false);
      setSelectedMoldForLocation(null);
      setNewLocationId(null);
      loadDashboard();
      loadRackMap();
    } catch (err) { message.error(err?.message ?? 'Failed to update location'); }
    finally { setLocationSaving(false); }
  };

  const openLocationModal = (mold) => {
    setSelectedMoldForLocation(mold);
    setNewLocationId(mold.storage_location_id ?? null);
    setLocationModalOpen(true);
  };

  const summaryStats = {
    total: dashboard?.total ?? inventory.length,
    in_production: dashboard?.in_production ?? 0,
    in_storage: dashboard?.in_storage ?? 0,
    in_repair: dashboard?.in_repair ?? 0,
    end_of_life: dashboard?.end_of_life ?? 0,
  };

  const filteredInventory = inventory.filter((m) => {
    const q = search.toLowerCase();
    if (q && !(m.mold_code?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q))) return false;
    if (statusFilter && m.status !== statusFilter) return false;
    return true;
  });
  const inventoryColumns = [
    { title: "Mold Code", dataIndex: "mold_code", key: "mold_code", width: 130, sorter: (a, b) => (a.mold_code || "").localeCompare(b.mold_code || ""), render: (val) => <Text style={{ fontWeight: 500, color: "#1d4ed8", fontSize: 13 }}>{val || "—"}</Text> },
    { title: "Name", dataIndex: "name", key: "name", width: 180, ellipsis: true },
    { title: "Status", dataIndex: "status", key: "status", width: 120, render: (val) => <Tag color={STATUS_COLORS[val] || "default"}>{(val || "").replace(/_/g, " ").toUpperCase()}</Tag> },
    { title: "Life Stage", dataIndex: "life_stage", key: "life_stage", width: 130, render: (val) => val ? <Tag color={LIFE_STAGE_COLORS[val] || "default"}>{(val || "").replace(/_/g, " ").toUpperCase()}</Tag> : "—" },
    { title: "Location", key: "location", width: 160, render: (_, r) => {
        const sl = r.StorageLocation;
        if (!sl) return '—';
        return `Rack ${sl.rack_number} · Shelf ${sl.shelf_number} · Pos ${sl.position_number}`;
      }
    },
    { title: "Last Shot Date", key: "last_shot_date", width: 140, render: (_, r) => fmtDate(r.ShotSummary?.last_shot_date) },
    ...(canWrite ? [{ title: "Action", key: "action", width: 100, render: (_, r) => (<Button size="small" type="link" icon={<EditOutlined />} onClick={() => openLocationModal(r)}>Location</Button>) }] : []),
  ];

  const forecastColumns = [
    { title: "Date", dataIndex: "date", key: "date", width: 120, render: (val) => fmtDate(val) },
    { title: "Mold", dataIndex: "mold_code", key: "mold_code", width: 140, render: (val) => <Text style={{ fontWeight: 500 }}>{val || "—"}</Text> },
    { title: "Movement", dataIndex: "movement_type", key: "movement_type", width: 100, render: (val) => <Tag color={val === "issue" ? "blue" : "green"}>{(val || "").toUpperCase()}</Tag> },
    { title: "Work Order", dataIndex: "work_order", key: "work_order", width: 140, render: (val) => val || "—" },
    { title: "Machine", dataIndex: "machine", key: "machine", width: 120, render: (val) => val || "—" },
  ];
  return (
    <AppLayout>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Text style={{ color: "#9ca3af", fontSize: 12 }}>Mold</Text>
        <RightOutlined style={{ color: "#d1d5db", fontSize: 10 }} />
        <Text style={{ color: "#6b7280", fontSize: 12 }}>Store Dashboard</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Mold Store Dashboard</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>Overview of mold storage, rack locations, and upcoming movements.</Text>

      {/* Summary Tiles */}
      <Row gutter={[12, 12]} style={{ marginTop: 16, marginBottom: 16 }}>
        <Col xs={12} sm={8} md={5}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="Total Molds" value={summaryStats.total} valueStyle={{ fontSize: 24, fontWeight: 600 }} prefix={<DatabaseOutlined />} /></Card></Col>
        <Col xs={12} sm={8} md={5}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "3px solid #1890ff" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="In Production" value={summaryStats.in_production} valueStyle={{ fontSize: 24, fontWeight: 600, color: "#1890ff" }} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={12} sm={8} md={5}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "3px solid #52c41a" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="In Storage" value={summaryStats.in_storage} valueStyle={{ fontSize: 24, fontWeight: 600, color: "#52c41a" }} prefix={<InboxOutlined />} /></Card></Col>
        <Col xs={12} sm={8} md={5}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "3px solid #fa8c16" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="In Repair" value={summaryStats.in_repair} valueStyle={{ fontSize: 24, fontWeight: 600, color: "#fa8c16" }} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={12} sm={8} md={4}><Card size="small" style={{ borderRadius: 10, border: "1px solid #e8eaed", borderLeft: "3px solid #8c8c8c" }} bodyStyle={{ padding: "12px 16px" }}><Statistic title="End of Life" value={summaryStats.end_of_life} valueStyle={{ fontSize: 24, fontWeight: 600, color: "#8c8c8c" }} /></Card></Col>
      </Row>

      {/* Visual Rack Map */}
      <Card
        title={<Space><EnvironmentOutlined /><Text style={{ fontWeight: 500 }}>Visual Rack Map</Text></Space>}
        extra={canWrite && <Button size="small" icon={<SettingOutlined />} onClick={() => setLocDrawerOpen(true)}>Manage Locations</Button>}
        style={{ border: "1px solid #e8eaed", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }} bodyStyle={{ padding: "16px 20px" }}>
        {rackLoading ? (<div style={{ textAlign: "center", padding: 40 }}><Text type="secondary">Loading rack map...</Text></div>) : rackMap.length === 0 ? (<Empty description="No rack data available" />) : (
          <Row gutter={[8, 8]}>
            {rackMap.map((slot, idx) => {
              const slotStatus = slot.status || (slot.current_mold ? "occupied" : "available");
              const slotColor = SLOT_COLORS[slotStatus] || "#d9d9d9";
              const label = [slot.rack_number, slot.shelf_number, slot.position_number].filter(Boolean).join("-");
              const content = (
                <div>
                  <Text style={{ fontWeight: 500, display: "block" }}>{label || "Slot " + (idx + 1)}</Text>
                  <Text style={{ fontSize: 12, color: "#6b7280" }}>Status: {slotStatus}</Text>
                  {slot.current_mold && (<><br /><Text style={{ fontSize: 12, fontWeight: 500 }}>Mold: {slot.current_mold.mold_code || slot.current_mold_name || "—"}</Text></>)}
                </div>
              );
              return (
                <Col xs={6} sm={4} md={3} lg={2} key={slot.id || idx}>
                  <Popover content={content} title="Location Details" trigger="click">
                    <div style={{ padding: "8px 4px", borderRadius: 6, border: "1px solid " + slotColor, background: slotColor + "15", textAlign: "center", cursor: "pointer", minHeight: 56, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
                      <Text style={{ fontSize: 10, fontWeight: 500, color: slotColor }}>{label || (idx + 1)}</Text>
                      {slot.current_mold && <Text style={{ fontSize: 9, color: "#6b7280", display: "block" }}>{slot.current_mold.mold_code || slot.current_mold_name || ""}</Text>}
                    </div>
                  </Popover>
                </Col>
              );
            })}
          </Row>
        )}
        <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
          <Space><div style={{ width: 12, height: 12, borderRadius: 2, background: SLOT_COLORS.available }} /><Text style={{ fontSize: 11 }}>Available</Text></Space>
          <Space><div style={{ width: 12, height: 12, borderRadius: 2, background: SLOT_COLORS.occupied }} /><Text style={{ fontSize: 11 }}>Occupied</Text></Space>
          <Space><div style={{ width: 12, height: 12, borderRadius: 2, background: SLOT_COLORS.reserved }} /><Text style={{ fontSize: 11 }}>Reserved</Text></Space>
        </div>
      </Card>
      {/* Mold Inventory */}
      <Card title={<Space><InboxOutlined /><Text style={{ fontWeight: 500 }}>Mold Inventory</Text></Space>} style={{ border: "1px solid #e8eaed", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }} bodyStyle={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <Input placeholder="Search molds..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240, borderRadius: 8 }} allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={setStatusFilter} allowClear style={{ width: 160 }} options={[{ label: "In Production", value: "in_production" }, { label: "In Storage", value: "in_storage" }, { label: "In Repair", value: "in_repair" }, { label: "End of Life", value: "end_of_life" }]} />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={() => { loadDashboard(); loadRackMap(); loadForecast(); }}>Refresh</Button>
        </div>
        <Table dataSource={filteredInventory} columns={inventoryColumns} rowKey="id" size="small" loading={loading} pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => t + " molds" }} scroll={{ x: 900 }} />
      </Card>

      {/* Movement Forecast */}
      <Card title={<Space><CalendarOutlined /><Text style={{ fontWeight: 500 }}>Movement Forecast (Next 7 Days)</Text></Space>} style={{ border: "1px solid #e8eaed", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }} bodyStyle={{ padding: "16px 20px" }}>
        {forecastLoading ? (<div style={{ textAlign: "center", padding: 40 }}><Text type="secondary">Loading forecast...</Text></div>) : forecast.length === 0 ? (<Empty description="No upcoming movements" />) : (
          <>
            <Table dataSource={forecast} columns={forecastColumns} rowKey={(r, i) => r.id || i} size="small" pagination={false} scroll={{ x: 600 }} />
            <Divider />
            <Timeline style={{ marginTop: 16 }}>
              {forecast.slice(0, 10).map((mv, idx) => (
                <Timeline.Item key={idx} color={mv.movement_type === "issue" ? "blue" : "green"}>
                  <Text style={{ fontWeight: 500 }}>{mv.mold_code || "—"} - {mv.movement_type === "issue" ? "Issue" : "Return"}</Text>
                  <Text style={{ fontSize: 12, color: "#6b7280", display: "block" }}>{fmtDate(mv.date)}{mv.work_order ? " | WO: " + mv.work_order : ""}{mv.machine ? " | Machine: " + mv.machine : ""}</Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </>
        )}
      </Card>

      {/* Manage Storage Locations Drawer */}
      <Drawer
        title="Manage Storage Locations"
        width={620}
        open={locDrawerOpen}
        onClose={() => { setLocDrawerOpen(false); setEditingLoc(null); locForm.resetFields(); }}
        extra={canWrite && <Button type="primary" icon={<PlusOutlined />} onClick={openAddLoc}>Add Location</Button>}
      >
        {/* Add / Edit form */}
        {(editingLoc !== null || locDrawerOpen) && (
          <Card
            size="small"
            title={editingLoc ? `Edit — Rack ${editingLoc.rack_number}-${editingLoc.shelf_number}-${editingLoc.position_number}` : 'New Location'}
            style={{ marginBottom: 16, border: '1px solid #e8eaed', borderRadius: 8 }}
            styles={{ body: { padding: '12px 16px' } }}
          >
            <Form form={locForm} layout="inline" onFinish={handleSaveLoc} size="small">
              <Form.Item name="rack_number" label="Rack" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={1} max={999} style={{ width: 70 }} placeholder="1" />
              </Form.Item>
              <Form.Item name="shelf_number" label="Shelf" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={1} max={99} style={{ width: 70 }} placeholder="1" />
              </Form.Item>
              <Form.Item name="position_number" label="Position" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={1} max={99} style={{ width: 70 }} placeholder="1" />
              </Form.Item>
              <Form.Item name="capacity_kg" label="Capacity (kg)">
                <InputNumber min={0} style={{ width: 100 }} placeholder="Optional" />
              </Form.Item>
              <Form.Item style={{ marginTop: 4 }}>
                <Space>
                  <Button type="primary" htmlType="submit" loading={locSaving}>{editingLoc ? 'Update' : 'Add'}</Button>
                  {editingLoc && <Button onClick={() => { setEditingLoc(null); locForm.resetFields(); }}>Cancel</Button>}
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}

        {/* Locations table */}
        <Table
          dataSource={rackMap}
          rowKey="id"
          size="small"
          loading={rackLoading}
          pagination={{ pageSize: 15, showTotal: (t) => `${t} locations` }}
          columns={[
            { title: 'Rack', dataIndex: 'rack_number', key: 'rack', width: 60, sorter: (a, b) => a.rack_number - b.rack_number },
            { title: 'Shelf', dataIndex: 'shelf_number', key: 'shelf', width: 60 },
            { title: 'Pos', dataIndex: 'position_number', key: 'pos', width: 60 },
            { title: 'Capacity (kg)', dataIndex: 'capacity_kg', key: 'cap', width: 110, render: (v) => v ?? '—' },
            { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
              render: (v) => <Tag color={v === 'available' ? 'green' : v === 'occupied' ? 'blue' : 'orange'}>{(v || '').toUpperCase()}</Tag> },
            { title: 'Current Mold', key: 'mold', width: 130,
              render: (_, r) => r.CurrentMold ? <Tag color="blue">{r.CurrentMold.mold_code}</Tag> : '—' },
            ...(canWrite ? [{
              title: '', key: 'actions', width: 90,
              render: (_, r) => (
                <Space size={4}>
                  <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditLoc(r)} style={{ padding: 0 }} />
                  <Popconfirm
                    title={r.status === 'occupied' ? 'This slot is occupied — move the mold first.' : 'Delete this location?'}
                    onConfirm={() => handleDeleteLoc(r.id)}
                    okText="Delete" okButtonProps={{ danger: true }}
                    disabled={r.status === 'occupied'}
                  >
                    <Button size="small" type="link" danger icon={<DeleteOutlined />} style={{ padding: 0 }} disabled={r.status === 'occupied'} />
                  </Popconfirm>
                </Space>
              ),
            }] : []),
          ]}
        />
      </Drawer>

      {/* Update Location Modal */}
      <Modal title="Update Mold Location" open={locationModalOpen} onCancel={() => { setLocationModalOpen(false); setSelectedMoldForLocation(null); }} onOk={handleUpdateLocation} confirmLoading={locationSaving} okText="Update Location">
        {selectedMoldForLocation && (
          <div style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: 500 }}>{selectedMoldForLocation.mold_code} - {selectedMoldForLocation.name}</Text>
          </div>
        )}
        <Form.Item label="New Storage Location">
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select rack / shelf / position..."
            value={newLocationId ?? undefined}
            onChange={(v) => setNewLocationId(v)}
            style={{ width: '100%' }}
            options={rackMap.map((loc) => {
              const locLabel = `Rack ${loc.rack_number} · Shelf ${loc.shelf_number} · Pos ${loc.position_number}`;
              const isCurrentLoc = selectedMoldForLocation?.storage_location_id === loc.id;
              const isOccupied   = loc.status === 'occupied' || loc.status === 'reserved';
              // Allow re-selecting the mold's own current location; disable other occupied/reserved slots
              const disabled = isOccupied && !isCurrentLoc;
              const suffix = isCurrentLoc
                ? ' (current)'
                : isOccupied
                  ? ` — ${loc.CurrentMold?.mold_code ?? 'occupied'}`
                  : '';
              return { label: locLabel + suffix, value: loc.id, disabled };
            })}
            notFoundContent={rackLoading ? 'Loading...' : 'No storage locations found'}
          />
        </Form.Item>
      </Modal>
    </AppLayout>
  );
}
