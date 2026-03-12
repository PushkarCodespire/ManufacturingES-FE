import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Row, Col, Statistic, Drawer, Descriptions, Divider,
  message, DatePicker, List,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ClockCircleOutlined,
  BarChartOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { downtimeApi, equipmentApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const TYPE_COLOR = { planned: 'blue', unplanned: 'red' };
const REASON_CATEGORY_COLOR = {
  planned_pm: 'blue', breakdown: 'red', changeover: 'orange',
  no_material: 'gold', no_operator: 'purple', quality_hold: 'cyan', other: 'default',
};

export default function DowntimePage() {
  const [logs, setLogs]           = useState([]);
  const [reasons, setReasons]     = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [pareto, setPareto]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [filters, setFilters]     = useState({});
  const [activeView, setActiveView] = useState('log');
  const [logModal, setLogModal]   = useState(false);
  const [form] = Form.useForm();

  const loadLog = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await downtimeApi.getLog({ page, limit: 20, ...filters, ...params });
      // res = { logs, total, page } after double-unwrap
      setLogs(Array.isArray(res?.logs) ? res.logs : []);
      setTotal(res?.total || 0);
    } catch (err) { message.error(err?.message ?? 'Failed to load downtime log'); }
    finally { setLoading(false); }
  }, [page, filters]);

  const loadPareto = useCallback(async () => {
    try {
      const res = await downtimeApi.getPareto(filters);
      // res = { byReason, byEquipment, summary } after double-unwrap
      setPareto(res);
    } catch (err) { console.error(err); }
  }, [filters]);

  useEffect(() => {
    downtimeApi.getReasons()
      .then((r) => setReasons(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load downtime reasons'));
    equipmentApi.getAll()
      .then((r) => setEquipment(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load equipment'));
  }, []);

  useEffect(() => {
    if (activeView === 'log')    loadLog();
    if (activeView === 'pareto') loadPareto();
  }, [activeView, loadLog, loadPareto]);

  const logManual = async (values) => {
    try {
      await downtimeApi.logManual(values);
      message.success('Downtime logged');
      setLogModal(false);
      form.resetFields();
      loadLog();
    } catch (err) { message.error(err?.message ?? 'Failed to log downtime'); }
  };

  const closeDowntime = async (id) => {
    try {
      await downtimeApi.closeDowntime(id, { end_time: new Date().toISOString() });
      message.success('Downtime closed');
      loadLog();
    } catch (err) { message.error(err?.message ?? 'Failed to close downtime'); }
  };

  const plannedMin   = logs.filter((l) => l.downtime_type === 'planned').reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const unplannedMin = logs.filter((l) => l.downtime_type === 'unplanned').reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const openLogs     = logs.filter((l) => !l.end_time).length;

  const logColumns = [
    {
      title: 'Equipment',
      render: (_, r) => (
        <>
          <Text strong>{r.Equipment?.equipment_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.Equipment?.name}</Text>
        </>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'downtime_type',
      render: (v) => <Tag color={TYPE_COLOR[v]}>{v?.toUpperCase()}</Tag>,
    },
    { title: 'Reason', dataIndex: ['Reason', 'name'], render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text>{v || '—'}</Text>
          {r.Reason?.category && <Tag color={REASON_CATEGORY_COLOR[r.Reason.category]} style={{ fontSize: 10 }}>{r.Reason.category.replace('_', ' ')}</Tag>}
        </Space>
      )
    },
    { title: 'Start', dataIndex: 'start_time', render: (v) => new Date(v).toLocaleString() },
    { title: 'End',   dataIndex: 'end_time',   render: (v) => v ? new Date(v).toLocaleString() : <Tag color="red">OPEN</Tag> },
    {
      title: 'Duration',
      dataIndex: 'duration_minutes',
      render: (v, r) => {
        if (!r.end_time) return <Tag color="red">Running</Tag>;
        if (!v) return '—';
        const h = Math.floor(v / 60);
        const m = v % 60;
        return <Text strong>{h > 0 ? `${h}h ` : ''}{m}m</Text>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => !r.end_time
        ? <Button size="small" type="primary" onClick={() => closeDowntime(r.id)}>Close</Button>
        : null,
    },
  ];

  return (
    <AppLayout>
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ClockCircleOutlined /> Downtime Log</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { loadLog(); loadPareto(); }}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setLogModal(true)}>Log Downtime</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={6}><Card><Statistic title="Open Downtimes" value={openLogs} valueStyle={{ color: '#dc2626' }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Planned (min)" value={plannedMin} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#2563eb' }} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Unplanned (min)" value={unplannedMin} valueStyle={{ color: '#dc2626' }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
        <Col xs={6}><Card><Statistic title="Total Events" value={total} /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Button type={activeView === 'log' ? 'primary' : 'default'} icon={<ClockCircleOutlined />} onClick={() => setActiveView('log')}>Downtime Log</Button>
        <Button type={activeView === 'pareto' ? 'primary' : 'default'} icon={<BarChartOutlined />} onClick={() => setActiveView('pareto')}>Pareto Analysis</Button>
      </Space>

      {activeView === 'log' && (
        <Table
          columns={logColumns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{ total, pageSize: 20, current: page, onChange: setPage }}
          rowClassName={(r) => !r.end_time ? 'ant-table-row-danger' : ''}
        />
      )}

      {activeView === 'pareto' && pareto && (
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card title="Downtime by Reason" size="small">
              <List
                size="small"
                dataSource={pareto.byReason || []}
                renderItem={(item) => (
                  <List.Item>
                    <Row style={{ width: '100%' }} justify="space-between">
                      <Space>
                        <Tag color={REASON_CATEGORY_COLOR[item.Reason?.category]}>{item.Reason?.name || 'Unknown'}</Tag>
                      </Space>
                      <Space>
                        <Text type="secondary">{item.occurrences}x</Text>
                        <Text strong>{item.total_minutes} min</Text>
                      </Space>
                    </Row>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Top Equipment by Downtime" size="small">
              <List
                size="small"
                dataSource={pareto.byEquipment || []}
                renderItem={(item) => (
                  <List.Item>
                    <Row style={{ width: '100%' }} justify="space-between">
                      <Text strong>{item.Equipment?.equipment_code}</Text>
                      <Space>
                        <Text type="secondary">{item.occurrences}x</Text>
                        <Text strong>{item.total_minutes} min</Text>
                      </Space>
                    </Row>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} style={{ marginTop: 16 }}>
            <Card title="Summary" size="small">
              <Row gutter={16}>
                <Col xs={6}><Statistic title="Total Events" value={pareto.summary?.totalEvents || 0} /></Col>
                <Col xs={6}><Statistic title="Planned (min)" value={pareto.summary?.totalPlannedMinutes || 0} /></Col>
                <Col xs={6}><Statistic title="Unplanned (min)" value={pareto.summary?.totalUnplannedMinutes || 0} valueStyle={{ color: '#dc2626' }} /></Col>
                <Col xs={6}><Statistic title="Total (min)" value={pareto.summary?.totalMinutes || 0} /></Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {/* Log Downtime Modal */}
      <Modal title="Log Downtime" open={logModal} onCancel={() => setLogModal(false)} footer={null} width={520}>
        <Form form={form} layout="vertical" onFinish={logManual}>
          <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="downtime_type" label="Type" rules={[{ required: true }]}>
                <Select options={[{ value: 'planned', label: 'Planned' }, { value: 'unplanned', label: 'Unplanned' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reason_id" label="Reason">
                <Select allowClear options={reasons.map((r) => ({ value: r.id, label: r.name }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="start_time" label="Start Time" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="End Time"><Input type="datetime-local" /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Log Downtime</Button>
            <Button onClick={() => setLogModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </div>
    </AppLayout>
  );
}
