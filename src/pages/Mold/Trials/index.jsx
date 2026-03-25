import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  InputNumber, Typography, Row, Col, Statistic, Drawer,
  Descriptions, Divider, message, Tabs,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, ExperimentOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { moldTrialApi, moldMasterApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = {
  planned: 'blue',
  in_progress: 'orange',
  passed: 'green',
  failed: 'red',
  conditionally_passed: 'gold',
};

const RESULT_COLOR = {
  pass: 'green',
  fail: 'red',
  conditional: 'orange',
  conditional_pass: 'orange',   // legacy
  pending: 'blue',
};

export default function TrialsPage() {
  const [trials, setTrials]         = useState([]);
  const [protocols, setProtocols]   = useState([]);
  const [molds, setMolds]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState('trials');
  const [detailDrawer, setDetailDrawer]     = useState(false);
  const [selected, setSelected]             = useState(null);
  const [startModal, setStartModal]         = useState(false);
  const [paramModal, setParamModal]         = useState(false);
  const [protocolModal, setProtocolModal]   = useState(false);
  const [form] = Form.useForm();
  const [paramForm] = Form.useForm();
  const [protocolForm] = Form.useForm();

  const loadTrials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await moldTrialApi.getTrials();
      setTrials(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load trials'); }
    finally { setLoading(false); }
  }, []);

  const loadProtocols = useCallback(async () => {
    try {
      const res = await moldTrialApi.getProtocols();
      setProtocols(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load protocols'); }
  }, []);

  useEffect(() => {
    loadTrials();
    loadProtocols();
    moldMasterApi.getAll()
      .then((r) => setMolds(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load molds'));
  }, [loadTrials, loadProtocols]);

  const openDetail = async (id) => {
    try {
      const res = await moldTrialApi.getById(id);
      setSelected(res?.id ? res : (res?.data ?? res));
      setDetailDrawer(true);
    } catch (err) { message.error(err?.message ?? 'Failed to load trial details'); }
  };

  const startTrial = async (values) => {
    try {
      const { mold_id, target_shots, target_cycle_time_sec, notes, ...rest } = values;
      const body = { ...rest };
      if (notes) body.summary = notes;
      await moldTrialApi.startTrial(mold_id, body);
      message.success('Trial run started');
      setStartModal(false);
      form.resetFields();
      loadTrials();
    } catch (err) { message.error(err?.message ?? 'Failed to start trial'); }
  };

  const addParameter = async (values) => {
    try {
      await moldTrialApi.addParameter(selected.id, values);
      message.success('Parameter added');
      setParamModal(false);
      paramForm.resetFields();
      openDetail(selected.id);
    } catch (err) { message.error(err?.message ?? 'Failed to add parameter'); }
  };

  const updateResult = async (result) => {
    try {
      await moldTrialApi.updateTrial(selected.id, { overall_result: result });
      message.success('Trial result updated');
      openDetail(selected.id);
      loadTrials();
    } catch (err) { message.error(err?.message ?? 'Failed to update result'); }
  };

  const createProtocol = async (values) => {
    try {
      await moldTrialApi.createProtocol(values);
      message.success('Protocol created');
      setProtocolModal(false);
      protocolForm.resetFields();
      loadProtocols();
    } catch (err) { message.error(err?.message ?? 'Failed to create protocol'); }
  };

  const trialColumns = [
    {
      title: 'Mold', width: 140,
      render: (_, r) => (
        <>
          <Text strong>{r.Mold?.mold_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.Mold?.name}</Text>
        </>
      ),
    },
    {
      title: 'Protocol', width: 150,
      dataIndex: ['Protocol', 'name'],
      render: (v) => v || '—',
    },
    { title: 'Machine', dataIndex: ['Machine', 'name'], width: 140, render: (v) => v || '—' },
    { title: 'Trial No', dataIndex: 'trial_number', width: 80, render: (v) => v || '—' },
    {
      title: 'Status', width: 120,
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v]}>{v?.replace(/_/g, ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Result', width: 110,
      dataIndex: 'overall_result',
      render: (v) => v
        ? <Tag color={RESULT_COLOR[v]}>{v?.replace(/_/g, ' ').toUpperCase()}</Tag>
        : <Tag>PENDING</Tag>,
    },
    { title: 'Shots Run', dataIndex: 'shots_taken', width: 90, render: (v) => v?.toLocaleString() || '—' },
    {
      title: 'Actions', width: 80, key: 'actions',
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)}>View</Button>
      ),
    },
  ];

  const protocolColumns = [
    { title: 'Protocol Name', dataIndex: 'name', width: 180, render: (v) => <Text strong>{v}</Text> },
    { title: 'Trial Type', dataIndex: 'trial_type', width: 120, render: (v) => <Tag>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Min Shots', dataIndex: 'min_sample_shots', width: 100, render: (v) => v?.toLocaleString() || '—' },
    {
      title: 'Status', width: 90,
      dataIndex: 'is_active',
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
  ];

  const completedCount  = trials.filter((t) => t.status === 'passed' || t.status === 'conditionally_passed').length;
  const inProgressCount = trials.filter((t) => t.status === 'in_progress').length;
  const failedCount     = trials.filter((t) => t.overall_result === 'fail').length;

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ExperimentOutlined /> Mold Trials</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadTrials}>Refresh</Button>
          <Button onClick={() => setProtocolModal(true)}>New Protocol</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setStartModal(true)}>Start Trial</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic title="In Progress" value={inProgressCount}
              valueStyle={{ color: '#d97706', fontSize: 20 }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic title="Completed" value={completedCount}
              valueStyle={{ color: '#16a34a', fontSize: 20 }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic title="Failed" value={failedCount}
              valueStyle={{ color: '#dc2626', fontSize: 20 }} prefix={<ExclamationCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'trials',
            label: <><ExperimentOutlined /> Trial Runs</>,
            children: (
              <Table
                columns={trialColumns}
                dataSource={trials}
                rowKey="id"
                loading={loading}
                scroll={{ x: 870 }}
                pagination={{ pageSize: 15 }}
              />
            ),
          },
          {
            key: 'protocols',
            label: 'Protocols',
            children: (
              <Table
                columns={protocolColumns}
                dataSource={protocols}
                rowKey="id"
                scroll={{ x: 490 }}
                pagination={{ pageSize: 15 }}
              />
            ),
          },
        ]}
      />

      {/* Start Trial Modal */}
      <Modal title="Start New Trial Run" open={startModal} onCancel={() => setStartModal(false)} footer={null} width={560}>
        <Form form={form} layout="vertical" onFinish={startTrial}>
          <Form.Item name="mold_id" label="Mold" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={molds.map((m) => ({ value: m.id, label: `${m.mold_code} — ${m.name}` }))}
            />
          </Form.Item>
          <Form.Item name="protocol_id" label="Protocol">
            <Select
              allowClear
              options={protocols.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Form.Item>
          <Form.Item name="trial_type" label="Trial Type" initialValue="post_repair">
            <Select
              options={['new_mold', 'post_repair', 'periodic', 'process_change'].map((v) => ({
                value: v, label: v.replace(/_/g, ' ').toUpperCase(),
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="target_shots" label="Target Shots">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="target_cycle_time_sec" label="Target Cycle Time (s)">
                <InputNumber style={{ width: '100%' }} min={0} precision={1} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Start Trial</Button>
            <Button onClick={() => setStartModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Create Protocol Modal */}
      <Modal title="New Trial Protocol" open={protocolModal} onCancel={() => setProtocolModal(false)} footer={null} width={520}>
        <Form form={protocolForm} layout="vertical" onFinish={createProtocol}>
          <Form.Item name="name" label="Protocol Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="trial_type" label="Trial Type" initialValue="post_repair">
            <Select
              options={['new_mold', 'post_repair', 'periodic', 'process_change'].map((v) => ({
                value: v, label: v.replace(/_/g, ' ').toUpperCase(),
              }))}
            />
          </Form.Item>
          <Form.Item name="min_shots_required" label="Minimum Shots Required">
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Create Protocol</Button>
            <Button onClick={() => setProtocolModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Trial Detail Drawer */}
      <Drawer
        title="Trial Run Details"
        width={620}
        open={detailDrawer}
        onClose={() => setDetailDrawer(false)}
        destroyOnClose
      >
        {selected && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Mold" span={2}>
                {selected.Mold?.mold_code} — {selected.Mold?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Protocol">{selected.Protocol?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Trial Type">
                <Tag>{selected.trial_type?.replace(/_/g, ' ')}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLOR[selected.status]}>{selected.status?.replace(/_/g, ' ').toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Result">
                <Tag color={RESULT_COLOR[selected.overall_result] || 'blue'}>
                  {selected.overall_result?.replace(/_/g, ' ').toUpperCase() || 'PENDING'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Shots Run">{selected.shots_taken?.toLocaleString() || '—'}</Descriptions.Item>
              <Descriptions.Item label="OK Qty">{selected.ok_qty?.toLocaleString() || '—'}</Descriptions.Item>
              <Descriptions.Item label="Reject Qty" span={2}>{selected.reject_qty?.toLocaleString() || '—'}</Descriptions.Item>
              {selected.summary && (
                <Descriptions.Item label="Summary" span={2}>{selected.summary}</Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left">Process Parameters</Divider>
            {(selected.Parameters || []).length === 0
              ? <Text type="secondary">No parameters recorded yet.</Text>
              : (selected.Parameters || []).map((p) => (
                <Card key={p.id} size="small" style={{ marginBottom: 8 }}>
                  <Row justify="space-between">
                    <Text strong>{p.parameter_name}</Text>
                    <Space>
                      <Text type="secondary">Target: {p.target_value} {p.unit}</Text>
                      <Text>Actual: {p.actual_value ?? '—'} {p.unit}</Text>
                    </Space>
                  </Row>
                </Card>
              ))}

            <Divider />
            <Space wrap>
              <Button icon={<PlusOutlined />} onClick={() => setParamModal(true)}>Add Parameter</Button>
              {selected.status === 'in_progress' && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => updateResult('pass')}
                  >
                    Mark Pass
                  </Button>
                  <Button
                    danger
                    onClick={() => updateResult('fail')}
                  >
                    Mark Fail
                  </Button>
                  <Button
                    onClick={() => updateResult('conditional')}
                  >
                    Conditional Pass
                  </Button>
                </>
              )}
            </Space>
          </>
        )}
      </Drawer>

      {/* Add Parameter Modal */}
      <Modal title="Add Process Parameter" open={paramModal} onCancel={() => setParamModal(false)} footer={null}>
        <Form form={paramForm} layout="vertical" onFinish={addParameter}>
          <Form.Item name="parameter_name" label="Parameter Name" rules={[{ required: true }]}>
            <Select
              options={[
                'Melt Temperature', 'Mold Temperature', 'Injection Pressure',
                'Holding Pressure', 'Cooling Time', 'Cycle Time', 'Shot Weight',
                'Back Pressure', 'Injection Speed',
              ].map((v) => ({ value: v, label: v }))}
              mode="combobox"
              placeholder="Select or type parameter"
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="target_value" label="Target Value" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actual_value" label="Actual Value">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit" label="Unit">
                <Select
                  options={['°C', 'bar', 's', 'g', 'mm/s', 'mm'].map((v) => ({ value: v, label: v }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit">Add</Button>
            <Button onClick={() => setParamModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </AppLayout>
  );
}
