import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Row, Col, Statistic, Drawer, Descriptions, Divider,
  message, Tree, Tabs, InputNumber,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ToolOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, ApartmentOutlined, FileTextOutlined, EditOutlined,
} from '@ant-design/icons';
import { equipmentApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = {
  operational: 'green', under_maintenance: 'orange',
  breakdown: 'red', decommissioned: 'default',
};
const CRITICALITY_COLOR = { A: 'red', B: 'orange', C: 'blue' };
const LEVEL_COLOR = {
  plant: 'purple', line: 'cyan', machine: 'blue',
  sub_assembly: 'geekblue', component: 'default',
};

export default function EquipmentPage() {
  const [equipment, setEquipment]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState('list');
  const [treeData, setTreeData]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [createModal, setCreateModal]   = useState(false);
  const [editModal, setEditModal]       = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    try {
      const res = await equipmentApi.getAll();
      setEquipment(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load equipment'); }
    finally { setLoading(false); }
  }, []);

  const loadTree = useCallback(async () => {
    try {
      const res = await equipmentApi.getHierarchy();
      const nodes = Array.isArray(res) ? res : (res?.data ?? []);
      const buildTreeNodes = (list) => list.map((n) => ({
        title: (
          <Space>
            <Tag color={LEVEL_COLOR[n.level]}>{n.level}</Tag>
            <Text strong>{n.equipment_code}</Text>
            <Text>{n.name}</Text>
            <Tag color={CRITICALITY_COLOR[n.criticality]}>{n.criticality}</Tag>
            <Tag color={STATUS_COLOR[n.status]}>{n.status?.replace(/_/g, ' ')}</Tag>
          </Space>
        ),
        key: n.id,
        children: n.children?.length ? buildTreeNodes(n.children) : undefined,
      }));
      setTreeData(buildTreeNodes(nodes));
    } catch (err) { message.error(err?.message ?? 'Failed to load hierarchy'); }
  }, []);

  useEffect(() => {
    loadEquipment();
    equipmentApi.getCategories()
      .then((r) => setCategories(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load categories'));
    equipmentApi.getPriorities()
      .then((r) => setPriorities(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load priorities'));
  }, [loadEquipment]);

  useEffect(() => {
    if (activeTab === 'hierarchy') loadTree();
  }, [activeTab, loadTree]);

  const openDetail = async (id) => {
    try {
      const res = await equipmentApi.getById(id);
      setSelected(res?.id ? res : (res?.data ?? res));
      setDetailDrawer(true);
    } catch (err) { message.error(err?.message ?? 'Failed to load equipment details'); }
  };

  const createEquipment = async (values) => {
    try {
      await equipmentApi.create(values);
      message.success('Equipment registered successfully');
      setCreateModal(false);
      form.resetFields();
      loadEquipment();
    } catch (err) { message.error(err?.message ?? 'Failed to register equipment'); }
  };

  const updateEquipment = async (values) => {
    try {
      await equipmentApi.update(selected.id, values);
      message.success('Equipment updated');
      setEditModal(false);
      loadEquipment();
      openDetail(selected.id);
    } catch (err) { message.error(err?.message ?? 'Failed to update equipment'); }
  };

  const deactivate = async (id) => {
    Modal.confirm({
      title: 'Deactivate Equipment?',
      content: 'This equipment will be marked inactive.',
      onOk: async () => {
        try {
          await equipmentApi.delete(id);
          message.success('Equipment deactivated');
          setDetailDrawer(false);
          loadEquipment();
        } catch (err) { message.error(err?.message ?? 'Failed to deactivate'); }
      },
    });
  };

  const operationalCount = equipment.filter((e) => e.status === 'operational').length;
  const breakdownCount   = equipment.filter((e) => e.status === 'breakdown').length;
  const criticalACount   = equipment.filter((e) => e.criticality === 'A').length;

  const columns = [
    {
      title: 'Equipment',
      render: (_, r) => (
        <>
          <Text strong>{r.equipment_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.name}</Text>
        </>
      ),
    },
    { title: 'Category', dataIndex: ['Category', 'name'], render: (v) => v || '—' },
    {
      title: 'Level',
      dataIndex: 'level',
      render: (v) => <Tag color={LEVEL_COLOR[v]}>{v?.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Criticality',
      dataIndex: 'criticality',
      render: (v) => <Tag color={CRITICALITY_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v]}>{v?.replace(/_/g, ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Health',
      dataIndex: 'current_health_score',
      render: (v) => {
        const color = v >= 70 ? '#16a34a' : v >= 40 ? '#d97706' : '#dc2626';
        return <Text strong style={{ color }}>{v ?? 100}</Text>;
      },
    },
    { title: 'Location', dataIndex: 'location', render: (v) => v || '—' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => <Button size="small" onClick={() => openDetail(r.id)}>View</Button>,
    },
  ];

  return (
    <AppLayout>
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ApartmentOutlined /> Equipment Master</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadEquipment}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>Register Equipment</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={8}>
          <Card><Statistic title="Operational" value={operationalCount} valueStyle={{ color: '#16a34a' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={8}>
          <Card><Statistic title="Breakdown" value={breakdownCount} valueStyle={{ color: '#dc2626' }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
        <Col xs={8}>
          <Card><Statistic title="Criticality A" value={criticalACount} valueStyle={{ color: '#dc2626' }} prefix={<ToolOutlined />} /></Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: 'Equipment List',
            children: <Table columns={columns} dataSource={equipment} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />,
          },
          {
            key: 'hierarchy',
            label: <><ApartmentOutlined /> Hierarchy</>,
            children: (
              <Card>
                {treeData.length > 0
                  ? <Tree treeData={treeData} defaultExpandAll showLine />
                  : <Text type="secondary">Loading hierarchy...</Text>}
              </Card>
            ),
          },
        ]}
      />

      {/* Create Modal */}
      <Modal title="Register New Equipment" open={createModal} onCancel={() => setCreateModal(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={createEquipment}>
          <Form.Item name="name" label="Equipment Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category_id" label="Category">
                <Select allowClear options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="level" label="Level" initialValue="machine">
                <Select options={['plant','line','machine','sub_assembly','component'].map((v) => ({ value: v, label: v.replace('_', ' ').toUpperCase() }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="criticality" label="Criticality" initialValue="B">
                <Select options={['A','B','C'].map((v) => ({ value: v, label: `${v} — ${v === 'A' ? 'Critical' : v === 'B' ? 'Major' : 'Minor'}` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="parent_id" label="Parent Equipment">
                <Select
                  allowClear
                  showSearch
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                  options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="manufacturer" label="Manufacturer"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model_no" label="Model No"><Input /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="serial_no" label="Serial No"><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="Location"><Input /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="installation_date" label="Installation Date"><Input type="date" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warranty_expiry" label="Warranty Expiry"><Input type="date" /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="department" label="Department"><Input /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Register</Button>
            <Button onClick={() => setCreateModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer title="Equipment Details" width={640} open={detailDrawer} onClose={() => setDetailDrawer(false)} destroyOnClose>
        {selected && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Code">{selected.equipment_code}</Descriptions.Item>
              <Descriptions.Item label="Name">{selected.name}</Descriptions.Item>
              <Descriptions.Item label="Criticality"><Tag color={CRITICALITY_COLOR[selected.criticality]}>{selected.criticality}</Tag></Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLOR[selected.status]}>{selected.status?.replace(/_/g, ' ').toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Level"><Tag color={LEVEL_COLOR[selected.level]}>{selected.level?.replace('_', ' ')}</Tag></Descriptions.Item>
              <Descriptions.Item label="Category">{selected.Category?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Manufacturer">{selected.manufacturer || '—'}</Descriptions.Item>
              <Descriptions.Item label="Model No">{selected.model_no || '—'}</Descriptions.Item>
              <Descriptions.Item label="Serial No">{selected.serial_no || '—'}</Descriptions.Item>
              <Descriptions.Item label="Location">{selected.location || '—'}</Descriptions.Item>
              <Descriptions.Item label="Installation">{selected.installation_date || '—'}</Descriptions.Item>
              <Descriptions.Item label="Warranty Expiry">{selected.warranty_expiry || '—'}</Descriptions.Item>
              <Descriptions.Item label="Health Score" span={2}>
                {(() => {
                  const v = selected.current_health_score ?? 100;
                  const color = v >= 70 ? '#16a34a' : v >= 40 ? '#d97706' : '#dc2626';
                  return <Text strong style={{ color, fontSize: 18 }}>{v} / 100</Text>;
                })()}
              </Descriptions.Item>
            </Descriptions>

            {selected.Warranty && (
              <>
                <Divider orientation="left">Warranty</Divider>
                <Descriptions size="small" bordered column={2}>
                  <Descriptions.Item label="Provider">{selected.Warranty.warranty_provider}</Descriptions.Item>
                  <Descriptions.Item label="Expires">{selected.Warranty.end_date}</Descriptions.Item>
                </Descriptions>
              </>
            )}

            {(selected.Children || []).length > 0 && (
              <>
                <Divider orientation="left">Sub-Components ({selected.Children.length})</Divider>
                {selected.Children.map((c) => (
                  <Tag key={c.id} style={{ marginBottom: 4 }}>{c.equipment_code} — {c.name}</Tag>
                ))}
              </>
            )}

            {(selected.Documents || []).length > 0 && (
              <>
                <Divider orientation="left">Documents</Divider>
                {selected.Documents.map((d) => (
                  <div key={d.id}><FileTextOutlined /> <Text>{d.file_name}</Text> <Tag>{d.document_type}</Tag></div>
                ))}
              </>
            )}

            <Divider />
            <Space wrap>
              <Button icon={<EditOutlined />} onClick={() => {
                editForm.setFieldsValue(selected);
                setEditModal(true);
              }}>Edit</Button>
              <Button danger onClick={() => deactivate(selected.id)}>Deactivate</Button>
            </Space>
          </>
        )}
      </Drawer>

      {/* Edit Modal */}
      <Modal title="Edit Equipment" open={editModal} onCancel={() => setEditModal(false)} footer={null} width={520}>
        <Form form={editForm} layout="vertical" onFinish={updateEquipment}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="criticality" label="Criticality">
                <Select options={['A','B','C'].map((v) => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select options={['operational','under_maintenance','breakdown','decommissioned'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="location" label="Location"><Input /></Form.Item>
          <Form.Item name="department" label="Department"><Input /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Update</Button>
            <Button onClick={() => setEditModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </div>
    </AppLayout>
  );
}
