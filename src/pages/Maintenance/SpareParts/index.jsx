import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  InputNumber, Typography, Row, Col, Statistic, Drawer, Descriptions,
  Divider, message, Tabs, Progress, Alert,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ToolOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import { sparePartsApi, equipmentApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';

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
  }, [loadParts]);

  const loadBom = async (equipId) => {
    try {
      const res = await sparePartsApi.getBomFor(equipId);
      setBomItems(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load BOM'); }
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

  const lowStockCount  = parts.filter((p) => parseFloat(p.current_stock) <= parseFloat(p.min_stock)).length;
  const totalParts     = parts.length;
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
        const low = parseFloat(r.current_stock) <= parseFloat(r.min_stock);
        return <Tag color={low ? 'red' : 'green'}>{low ? 'Low Stock' : 'OK'}</Tag>;
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
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ToolOutlined /> Spare Parts & BOM</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadParts}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>Register Part</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={8}><Card><Statistic title="Total Parts" value={totalParts} prefix={<ToolOutlined />} /></Card></Col>
        <Col xs={8}><Card><Statistic title="Low Stock Alerts" value={lowStockCount} valueStyle={{ color: '#dc2626' }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={8}><Card><Statistic title="Total Stock Value" value={`$${totalStockValue.toFixed(0)}`} prefix={<CheckCircleOutlined />} /></Card></Col>
      </Row>

      {lowStockCount > 0 && (
        <Alert
          message={`${lowStockCount} parts are below minimum stock level`}
          type="warning"
          showIcon
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
            children: <Table columns={partColumns} dataSource={parts} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />,
          },
          {
            key: 'bom',
            label: 'Equipment BOM',
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    showSearch
                    placeholder="Select equipment to view BOM"
                    style={{ width: 320 }}
                    filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                    options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
                    onChange={(v) => { setSelectedEquip(v); loadBom(v); }}
                  />
                  {selectedEquip && (
                    <Button icon={<PlusOutlined />} onClick={() => setBomModal(true)}>Add BOM Item</Button>
                  )}
                </Space>
                {selectedEquip
                  ? <Table columns={bomColumns} dataSource={bomItems} rowKey="id" pagination={{ pageSize: 15 }} />
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
            <Col span={12}>
              <Form.Item name="unit_of_measure" label="Unit of Measure"><Input placeholder="pcs, kg, ltr..." /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit_cost" label="Unit Cost ($)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="current_stock" label="Opening Stock" initialValue={0}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            </Col>
            <Col span={12}>
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
    </div>
    </AppLayout>
  );
}
