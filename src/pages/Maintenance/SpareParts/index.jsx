import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  InputNumber, Typography, Row, Col, Statistic, Drawer, Descriptions,
  Divider, message, Tabs, Progress, Alert, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ToolOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, MinusCircleOutlined, WarningOutlined, BulbOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { sparePartsApi, equipmentApi, maintenanceAiApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function SparePartsPage() {
  const [parts, setParts]         = useState([]);
  const [bomItems, setBomItems]   = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [activeTab, setActiveTab] = useState('parts');
  const [selectedEquip, setSelectedEquip] = useState(null);
  const [partDrawer, setPartDrawer]   = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [createModal, setCreateModal] = useState(false);
  const [consumeModal, setConsumeModal] = useState(false);
  const [bomModal, setBomModal]       = useState(false);
  const [form] = Form.useForm();
  const [consumeForm] = Form.useForm();
  const [bomForm] = Form.useForm();
  const [anomalyMap, setAnomalyMap] = useState({}); // spare_part_id → anomaly data
  // MNT-009: Demand forecast state
  const [forecast, setForecast]         = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  const loadParts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sparePartsApi.getSpareParts();
      // res IS already the array after double-unwrap (interceptor + .then(r=>r.data))
      setParts(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load spare parts'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadParts();
    equipmentApi.getAll()
      .then((r) => setEquipment(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load equipment'));
    // MNT-010: load anomaly detection silently in background
    maintenanceAiApi.getSparePartAnomalies()
      .then((res) => {
        const list = res?.data ?? res ?? [];
        const map = {};
        (Array.isArray(list) ? list : []).forEach((a) => { map[a.spare_part_id] = a; });
        setAnomalyMap(map);
      })
      .catch(() => {}); // silent fail — non-critical
  }, [loadParts]);

  const loadBom = async (equipId) => {
    try {
      const res = await sparePartsApi.getBomFor(equipId);
      setBomItems(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load BOM'); }
  };

  // MNT-009: Load demand forecast for selected equipment
  const loadForecast = async (equipId) => {
    setForecastLoading(true);
    setForecast(null);
    try {
      const res = await maintenanceAiApi.getSpareDemandForecast(equipId);
      setForecast(res);
    } catch (err) { message.error(err?.message ?? 'Failed to load demand forecast'); }
    finally { setForecastLoading(false); }
  };

  const createPart = async (values) => {
    try {
      await sparePartsApi.createSparePart(values);
      message.success('Spare part registered');
      setCreateModal(false);
      form.resetFields();
      loadParts();
    } catch (err) { message.error(err?.message ?? 'Failed to create spare part'); }
  };

  const consumePart = async (values) => {
    try {
      const res = await sparePartsApi.consumePart({ ...values, spare_part_id: selectedPart?.id });
      // res = { consumption, remaining_stock } after double-unwrap (backend nests both under data)
      message.success(`Consumed. Remaining stock: ${res?.remaining_stock ?? '—'}`);
      setConsumeModal(false);
      consumeForm.resetFields();
      loadParts();
    } catch (err) { message.error(err?.message ?? 'Failed to consume'); }
  };

  const addBomItem = async (values) => {
    try {
      await sparePartsApi.addBomItem(selectedEquip, values);
      message.success('BOM item added');
      setBomModal(false);
      bomForm.resetFields();
      loadBom(selectedEquip);
    } catch (err) { message.error(err?.message ?? 'Failed to add BOM item'); }
  };

  const removeBomItem = async (equipId, bomId) => {
    Modal.confirm({
      title: 'Remove BOM item?',
      onOk: async () => {
        try {
          await sparePartsApi.removeBomItem(equipId, bomId);
          message.success('BOM item removed');
          loadBom(equipId);
        } catch (err) { message.error(err?.message ?? 'Failed to remove BOM item'); }
      },
    });
  };

  const lowStockCount   = parts.filter((p) => parseFloat(p.current_stock) <= parseFloat(p.min_stock)).length;
  const anomalyCount    = Object.keys(anomalyMap).length;
  const totalParts      = parts.length;
  const totalStockValue = parts.reduce((s, p) => s + (parseFloat(p.current_stock) * parseFloat(p.unit_cost || 0)), 0);

  const partColumns = [
    {
      title: 'Part',
      render: (_, r) => (
        <>
          <Text strong>{r.part_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.name}</Text>
        </>
      ),
    },
    { title: 'UOM', dataIndex: 'unit_of_measure', render: (v) => v || '—' },
    {
      title: 'Stock',
      render: (_, r) => {
        const pct = r.min_stock > 0 ? Math.min(100, Math.round((r.current_stock / r.min_stock) * 100)) : 100;
        const low = parseFloat(r.current_stock) <= parseFloat(r.min_stock);
        return (
          <Space direction="vertical" size={0} style={{ width: 120 }}>
            <Text strong style={{ color: low ? '#dc2626' : '#16a34a' }}>{r.current_stock}</Text>
            <Progress percent={pct} size="small" strokeColor={low ? '#dc2626' : '#16a34a'} showInfo={false} />
            <Text style={{ fontSize: 10 }} type="secondary">Min: {r.min_stock}</Text>
          </Space>
        );
      },
    },
    { title: 'Unit Cost', dataIndex: 'unit_cost', render: (v) => v ? `$${parseFloat(v).toFixed(2)}` : '—' },
    { title: 'Supplier', dataIndex: ['Supplier', 'name'], render: (v) => v || '—' },
    {
      title: 'Status',
      render: (_, r) => {
        const low     = parseFloat(r.current_stock) <= parseFloat(r.min_stock);
        const anomaly = anomalyMap[r.id];
        return (
          <Space size={4} wrap>
            <Tag color={low ? 'red' : 'green'}>{low ? 'Low Stock' : 'OK'}</Tag>
            {anomaly && (
              <Tooltip title={`Consumption anomaly: ${anomaly.recent_30d} used in last 30d vs avg ${anomaly.monthly_avg}/mo (${anomaly.ratio}×)`}>
                <Tag color="orange" icon={<WarningOutlined />} style={{ cursor: 'help' }}>
                  {anomaly.ratio}× Spike
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => { setSelectedPart(r); setPartDrawer(true); }}>View</Button>
          <Button size="small" danger icon={<MinusCircleOutlined />} onClick={() => { setSelectedPart(r); setConsumeModal(true); }}>Consume</Button>
        </Space>
      ),
    },
  ];

  const bomColumns = [
    { title: 'Part Code', dataIndex: ['SparePart', 'part_code'], render: (v) => <Text strong>{v}</Text> },
    { title: 'Part Name', dataIndex: ['SparePart', 'name'] },
    { title: 'Qty Required', dataIndex: 'quantity_required', render: (v) => <Tag>{v} {/* uom */}</Tag> },
    { title: 'In Stock', dataIndex: ['SparePart', 'current_stock'], render: (v, r) => {
      const ok = parseFloat(v) >= parseFloat(r.quantity_required);
      return <Text style={{ color: ok ? '#16a34a' : '#dc2626' }}>{v}</Text>;
    }},
    { title: 'Notes', dataIndex: 'notes', render: (v) => v || '—' },
    {
      title: 'Actions', key: 'actions',
      render: (_, r) => <Button size="small" danger onClick={() => removeBomItem(selectedEquip, r.id)}>Remove</Button>,
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ToolOutlined /> Spare Parts & BOM</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadParts}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>Register Part</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={6}><Card><Statistic title="Total Parts" value={totalParts} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Low Stock Alerts" value={lowStockCount} valueStyle={{ color: '#dc2626' }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={6}>
          <Tooltip title="Parts with last-30d consumption > 2× 5-month average">
            <Card style={{ cursor: 'help' }}>
              <Statistic
                title="Consumption Anomalies"
                value={anomalyCount}
                valueStyle={{ color: anomalyCount > 0 ? '#d97706' : '#16a34a' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Tooltip>
        </Col>
        <Col xs={6}><Card><Statistic title="Total Stock Value" value={`$${totalStockValue.toFixed(0)}`} prefix={<CheckCircleOutlined />} /></Card></Col>
      </Row>

      {lowStockCount > 0 && (
        <Alert
          message={`${lowStockCount} parts are below minimum stock level`}
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
        />
      )}
      {anomalyCount > 0 && (
        <Alert
          message={`${anomalyCount} spare part(s) show unusual consumption spikes — check Status column for details`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'parts',
            label: `Parts Catalog (${parts.length})`,
            children: <ResponsiveTable columns={partColumns} dataSource={parts} rowKey="id" loading={loading} scroll={{ x: 800 }} pagination={{ pageSize: 15 }} />,
          },
          {
            key: 'bom',
            label: 'Equipment BOM',
            children: (
              <div>
                <Space style={{ marginBottom: 16 }} wrap>
                  <Select
                    showSearch
                    placeholder="Select equipment to view BOM"
                    style={{ width: 320 }}
                    filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                    options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
                    onChange={(v) => { setSelectedEquip(v); loadBom(v); setForecast(null); }}
                  />
                  {selectedEquip && (
                    <>
                      <Button icon={<PlusOutlined />} onClick={() => setBomModal(true)}>Add BOM Item</Button>
                      <Button
                        icon={<BulbOutlined />}
                        loading={forecastLoading}
                        onClick={() => loadForecast(selectedEquip)}
                        style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                      >
                        Demand Forecast
                      </Button>
                    </>
                  )}
                </Space>

                {/* MNT-009: Demand Forecast Panel */}
                {forecast && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Space size={6}>
                        <BulbOutlined style={{ color: '#7c3aed' }} />
                        <Text strong style={{ color: '#7c3aed' }}>3-Month Demand Forecast</Text>
                        {forecast.summary && (
                          <>
                            <Tag color="default" style={{ fontSize: 11 }}>Age Factor ×{forecast.summary.age_factor}</Tag>
                            {forecast.summary.stock_up_count > 0 && <Tag color="red" style={{ fontSize: 11 }}>{forecast.summary.stock_up_count} Parts Need Replenishment</Tag>}
                            {forecast.summary.total_replenishment_cost > 0 && <Tag color="orange" style={{ fontSize: 11 }}>Est. Cost: ${forecast.summary.total_replenishment_cost}</Tag>}
                          </>
                        )}
                      </Space>
                    </div>
                    <Table
                      size="small"
                      scroll={{ x: 800 }}
                      rowKey="spare_part_id"
                      dataSource={forecast?.data ?? []}
                      pagination={false}
                      columns={[
                        { title: 'Part', render: (_, r) => <><Text strong style={{ fontSize: 12 }}>{r.part_code}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.part_name}</Text></> },
                        { title: 'Stock', dataIndex: 'current_stock', width: 70, render: (v) => <Text strong>{v}</Text> },
                        { title: 'Consumed 6m', dataIndex: 'consumed_6m', width: 100, render: (v, r) => `${v} ${r.unit_of_measure || ''}` },
                        { title: 'Monthly Avg', dataIndex: 'monthly_avg', width: 100, render: (v, r) => `${v} ${r.unit_of_measure || ''}` },
                        {
                          title: '3-Month Forecast',
                          dataIndex: 'forecast_3m',
                          width: 130,
                          render: (v, r) => (
                            <Space size={4}>
                              <Text style={{ color: r.action === 'stock_up' ? '#dc2626' : '#16a34a' }}>{v}</Text>
                              {r.shortfall > 0 && <Tag color="red" style={{ fontSize: 10 }}>Short {r.shortfall}</Tag>}
                            </Space>
                          ),
                        },
                        {
                          title: 'Action',
                          dataIndex: 'action',
                          width: 130,
                          render: (v, r) => {
                            const cfg = {
                              stock_up:              { color: 'red',     icon: <ArrowUpOutlined />, label: 'Stock Up' },
                              monitor:               { color: 'orange',  icon: <WarningOutlined />, label: 'Monitor' },
                              adequate:              { color: 'green',   icon: <CheckCircleOutlined />, label: 'Adequate' },
                              no_consumption_history:{ color: 'default', icon: null, label: 'No History' },
                            }[v] || { color: 'default', icon: null, label: v };
                            return (
                              <Tooltip title={r.replenishment_cost ? `Est. replenishment: $${r.replenishment_cost}` : undefined}>
                                <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 11 }}>{cfg.label}</Tag>
                              </Tooltip>
                            );
                          },
                        },
                      ]}
                    />
                  </div>
                )}

                {selectedEquip
                  ? <Table columns={bomColumns} dataSource={bomItems} rowKey="id" scroll={{ x: 800 }} pagination={{ pageSize: 15 }} />
                  : <Text type="secondary">Select an equipment to view its spare parts BOM</Text>
                }
              </div>
            ),
          },
        ]}
      />

      {/* Part Detail Drawer */}
      <Drawer title="Spare Part Details" width={480} open={partDrawer} onClose={() => setPartDrawer(false)} destroyOnClose>
        {selectedPart && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Part Code" span={2}><Text strong>{selectedPart.part_code}</Text></Descriptions.Item>
            <Descriptions.Item label="Name" span={2}>{selectedPart.name}</Descriptions.Item>
            <Descriptions.Item label="Current Stock">
              <Text strong style={{ color: parseFloat(selectedPart.current_stock) <= parseFloat(selectedPart.min_stock) ? '#dc2626' : '#16a34a' }}>
                {selectedPart.current_stock} {selectedPart.unit_of_measure}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Min Stock">{selectedPart.min_stock} {selectedPart.unit_of_measure}</Descriptions.Item>
            <Descriptions.Item label="Unit Cost">{selectedPart.unit_cost ? `$${parseFloat(selectedPart.unit_cost).toFixed(2)}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Supplier">{selectedPart.Supplier?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>{selectedPart.description || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* Register Part Modal */}
      <Modal title="Register Spare Part" open={createModal} onCancel={() => setCreateModal(false)} footer={null} width={520}>
        <Form form={form} layout="vertical" onFinish={createPart}>
          <Form.Item name="name" label="Part Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="unit_of_measure" label="Unit of Measure"><Input placeholder="pcs, kg, ltr..." /></Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="unit_cost" label="Unit Cost ($)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="current_stock" label="Opening Stock" initialValue={0}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="min_stock" label="Minimum Stock" initialValue={0}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            </Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit">Register</Button>
            <Button onClick={() => setCreateModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Consume Modal */}
      <Modal title={`Consume — ${selectedPart?.name}`} open={consumeModal} onCancel={() => setConsumeModal(false)} footer={null}>
        <Form form={consumeForm} layout="vertical" onFinish={consumePart}>
          <Form.Item name="quantity_consumed" label="Quantity to Consume" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0.001} step={0.1} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item>
          <Space>
            <Button type="primary" danger htmlType="submit">Consume</Button>
            <Button onClick={() => setConsumeModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Add BOM Item Modal */}
      <Modal title="Add BOM Item" open={bomModal} onCancel={() => setBomModal(false)} footer={null}>
        <Form form={bomForm} layout="vertical" onFinish={addBomItem}>
          <Form.Item name="spare_part_id" label="Spare Part" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={parts.map((p) => ({ value: p.id, label: `${p.part_code} — ${p.name}` }))}
            />
          </Form.Item>
          <Form.Item name="quantity_required" label="Quantity Required" rules={[{ required: true }]} initialValue={1}>
            <InputNumber style={{ width: '100%' }} min={0.001} step={0.1} />
          </Form.Item>
          <Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Add</Button>
            <Button onClick={() => setBomModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </AppLayout>
  );
}
