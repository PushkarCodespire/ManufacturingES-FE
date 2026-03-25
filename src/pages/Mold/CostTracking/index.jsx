import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  InputNumber, Typography, Row, Col, Statistic, Drawer, List,
  Descriptions, Divider, message, Progress,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DollarOutlined, BarChartOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { moldCostApi, moldMasterApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;
const { TextArea } = Input;

const COST_TYPE_COLOR = {
  purchase:     'cyan',
  pm:           'blue',
  repair:       'orange',
  tooling:      'purple',
  modification: 'geekblue',
  transport:    'gold',
  other:        'default',
};

export default function CostTrackingPage() {
  const [dashboard, setDashboard]   = useState(null);
  const [molds, setMolds]           = useState([]);
  const [moldCosts, setMoldCosts]   = useState([]);
  const [costPerShot, setCostPerShot] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [addModal, setAddModal]     = useState(false);
  const [drillDrawer, setDrillDrawer] = useState(false);
  const [selectedMold, setSelectedMold] = useState(null);
  const [form] = Form.useForm();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await moldCostApi.getDashboard();
      setDashboard(res);
    } catch (err) { message.error(err?.message ?? 'Failed to load cost dashboard'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadDashboard();
    moldMasterApi.getAll()
      .then((r) => setMolds(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load molds'));
  }, [loadDashboard]);

  const openMoldDrill = async (mold) => {
    setSelectedMold(mold);
    setDrillDrawer(true);
    const moldId = mold.mold_id ?? mold.id;
    try {
      const [costsRes, cpsRes] = await Promise.all([
        moldCostApi.getMoldCosts(moldId),
        moldCostApi.getCostPerShot(moldId),
      ]);
      setMoldCosts(Array.isArray(costsRes) ? costsRes : (costsRes?.data ?? []));
      setCostPerShot(cpsRes?.mold_id ? cpsRes : (cpsRes?.data ?? cpsRes));
    } catch (err) { message.error(err?.message ?? 'Failed to load mold costs'); }
  };

  const addCost = async (values) => {
    try {
      const { mold_id, notes, ...body } = values;
      await moldCostApi.addCost(mold_id, body);
      message.success('Cost entry added');
      setAddModal(false);
      form.resetFields();
      loadDashboard();
      const selectedId = selectedMold?.mold_id ?? selectedMold?.id;
      if (selectedMold && selectedId === mold_id) {
        openMoldDrill(selectedMold);
      }
    } catch (err) { message.error(err?.message ?? 'Failed to add cost'); }
  };

  const summaryColumns = [
    {
      title: 'Mold', width: 160,
      render: (_, r) => (
        <>
          <Text strong>{r.Mold?.mold_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.Mold?.name}</Text>
        </>
      ),
    },
    {
      title: 'Total Cost', width: 120,
      dataIndex: 'total_cost',
      render: (v) => <Text strong>₹{Number(v || 0).toLocaleString()}</Text>,
      sorter: (a, b) => Number(a.total_cost || 0) - Number(b.total_cost || 0),
    },
    {
      title: 'Cost / Shot', width: 110,
      key: 'cost_per_shot',
      render: (_, r) => {
        const shots = r.Mold?.current_shot_count || 0;
        const cost  = Number(r.total_cost || 0);
        return shots > 0 ? `₹${(cost / shots).toFixed(4)}` : '—';
      },
    },
    {
      title: 'Total Shots', width: 100,
      key: 'total_shots',
      render: (_, r) => r.Mold?.current_shot_count?.toLocaleString() || '0',
    },
    {
      title: 'Actions', width: 110,
      key: 'actions',
      render: (_, r) => (
        <Button size="small" icon={<BarChartOutlined />} onClick={() => openMoldDrill(r)}>
          Drill Down
        </Button>
      ),
    },
  ];

  const costListColumns = [
    {
      title: 'Date',
      dataIndex: 'incurred_date',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      title: 'Type',
      dataIndex: 'cost_type',
      render: (v) => <Tag color={COST_TYPE_COLOR[v] ?? 'default'}>{v?.toUpperCase()}</Tag>,
    },
    { title: 'Description', dataIndex: 'description', render: (v) => v || '—' },
    {
      title: 'Amount',
      dataIndex: 'amount',
      render: (v) => <Text strong>₹{Number(v || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Added By',
      dataIndex: ['Creator', 'name'],
      render: (v) => v || '—',
    },
  ];

  const summaryData   = dashboard?.topMolds || [];
  const totalCost     = summaryData.reduce((s, r) => s + Number(r.total_cost || 0), 0);
  const highCostMolds = summaryData.filter((r) => Number(r.total_cost || 0) > 100000).length;

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><DollarOutlined /> Cost Tracking</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadDashboard}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModal(true)}>Add Cost Entry</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic
              title="Total Fleet Cost"
              value={totalCost}
              prefix="₹"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: '#1d4ed8', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic
              title="Molds Tracked"
              value={summaryData.length}
              valueStyle={{ fontSize: 20 }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic
              title="High-Cost Molds (>₹1L)"
              value={highCostMolds}
              valueStyle={{ color: '#dc2626', fontSize: 20 }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Cost Breakdown Summary Cards */}
      {dashboard?.byType?.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          {dashboard.byType.map(({ cost_type, total }) => (
            <Col xs={24} sm={12} md={6} key={cost_type} style={{ marginBottom: 8 }}>
              <Card size="small">
                <Text type="secondary" style={{ textTransform: 'capitalize' }}>{cost_type} Cost</Text>
                <br />
                <Text strong style={{ fontSize: 16 }}>₹{Number(total || 0).toLocaleString()}</Text>
                {totalCost > 0 && (
                  <Progress
                    percent={Math.round((Number(total || 0) / totalCost) * 100)}
                    size="small"
                    strokeColor={COST_TYPE_COLOR[cost_type] === 'default' ? '#aaa' : undefined}
                    style={{ marginTop: 4 }}
                  />
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Table
        columns={summaryColumns}
        dataSource={summaryData}
        rowKey="mold_id"
        loading={loading}
        scroll={{ x: 600 }}
        pagination={{ pageSize: 15 }}
      />

      {/* Add Cost Modal */}
      <Modal
        title="Add Cost Entry"
        open={addModal}
        onCancel={() => setAddModal(false)}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={addCost}>
          <Form.Item name="mold_id" label="Mold" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={molds.map((m) => ({ value: m.id, label: `${m.mold_code} — ${m.name}` }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cost_type" label="Cost Type" rules={[{ required: true }]}>
                <Select
                  options={['purchase', 'pm', 'repair', 'tooling', 'modification', 'transport', 'other'].map((v) => ({
                    value: v, label: v.toUpperCase(),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="e.g. Monthly PM service" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Add Cost</Button>
            <Button onClick={() => setAddModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Mold Cost Drill-Down Drawer */}
      <Drawer
        title={selectedMold ? `${selectedMold.mold_code} — Cost History` : 'Cost Details'}
        width={640}
        open={drillDrawer}
        onClose={() => setDrillDrawer(false)}
        destroyOnClose
      >
        {costPerShot && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Total Cost"
                    value={costPerShot.total_cost || 0}
                    prefix="₹"
                    formatter={(v) => Number(v).toLocaleString()}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Total Shots"
                    value={costPerShot.total_shots || 0}
                    formatter={(v) => Number(v).toLocaleString()}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Cost / Shot"
                    value={Number(costPerShot.cost_per_shot || 0).toFixed(4)}
                    prefix="₹"
                  />
                </Card>
              </Col>
            </Row>

            {costPerShot.breakdown && (
              <>
                <Divider orientation="left">Cost Breakdown</Divider>
                <List
                  size="small"
                  dataSource={Object.entries(costPerShot.breakdown)}
                  renderItem={([type, amount]) => (
                    <List.Item>
                      <Tag color={COST_TYPE_COLOR[type]}>{type.toUpperCase()}</Tag>
                      <Text strong>₹{Number(amount || 0).toLocaleString()}</Text>
                      {costPerShot.total_cost > 0 && (
                        <Progress
                          percent={Math.round((Number(amount || 0) / costPerShot.total_cost) * 100)}
                          size="small"
                          style={{ width: 120, marginLeft: 12 }}
                        />
                      )}
                    </List.Item>
                  )}
                />
              </>
            )}
            <Divider />
          </>
        )}

        <Table
          columns={costListColumns}
          dataSource={moldCosts}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
        />

        <Divider />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.setFieldValue('mold_id', selectedMold?.mold_id ?? selectedMold?.id);
            setAddModal(true);
          }}
        >
          Add Cost for This Mold
        </Button>
      </Drawer>
    </AppLayout>
  );
}
