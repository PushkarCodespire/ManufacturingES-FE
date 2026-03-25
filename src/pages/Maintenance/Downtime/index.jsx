import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Row, Col, Statistic, Drawer, Descriptions, Divider,
  message, DatePicker, List, Progress, Tooltip, Spin,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ClockCircleOutlined,
  BarChartOutlined, ExclamationCircleOutlined, BulbOutlined,
  FireOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { downtimeApi, equipmentApi, maintenanceAiApi } from '../../../api/maintenance.api';
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
  const [activeView, setActiveView]   = useState('log');
  const [logModal, setLogModal]       = useState(false);
  const [patterns, setPatterns]       = useState(null);
  const [patternLoading, setPatternLoading] = useState(false);
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

  const loadPatterns = useCallback(async () => {
    setPatternLoading(true);
    try {
      const res = await maintenanceAiApi.getDowntimePatterns(90);
      setPatterns(res?.data ?? res);
    } catch (err) { message.error(err?.message || 'Failed to load pattern analysis'); }
    finally { setPatternLoading(false); }
  }, []);

  useEffect(() => {
    if (activeView === 'log')      loadLog();
    if (activeView === 'pareto')   loadPareto();
    if (activeView === 'patterns') loadPatterns();
  }, [activeView, loadLog, loadPareto, loadPatterns]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><ClockCircleOutlined /> Downtime Log</Title>
        <Space wrap>
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
        <Button type={activeView === 'patterns' ? 'primary' : 'default'} icon={<BulbOutlined />} onClick={() => setActiveView('patterns')} style={activeView === 'patterns' ? {} : { borderColor: '#7c3aed', color: '#7c3aed' }}>
          Pattern Analysis
        </Button>
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

      {activeView === 'patterns' && (
        <div>
          {patternLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" tip="Analyzing patterns..." /></div>
          ) : patterns ? (
            <Row gutter={16}>
              {/* Peak Hours */}
              <Col xs={24} md={12} style={{ marginBottom: 16 }}>
                <Card
                  title={<Space><FireOutlined style={{ color: '#dc2626' }} /><span>Unplanned Downtime by Hour of Day</span></Space>}
                  size="small"
                  extra={patterns.peak_hours?.length > 0 && <Tag color="red">Peak: {patterns.peak_hours.map(h => `${String(h).padStart(2,'0')}:00`).join(', ')}</Tag>}
                >
                  {(() => {
                    const maxMin = Math.max(1, ...patterns.by_hour.map(h => h.minutes));
                    return (
                      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {patterns.by_hour.map((h) => (
                          <div key={h.hour} style={{ marginBottom: 4 }}>
                            <Row align="middle" gutter={8}>
                              <Col style={{ width: 48, fontSize: 11, color: '#6b7280' }}>{h.label}</Col>
                              <Col flex="auto">
                                <Progress
                                  percent={Math.round((h.minutes / maxMin) * 100)}
                                  showInfo={false}
                                  size="small"
                                  strokeColor={patterns.peak_hours?.includes(h.hour) ? '#dc2626' : '#3b82f6'}
                                />
                              </Col>
                              <Col style={{ width: 70, fontSize: 11, textAlign: 'right', color: h.minutes > 0 ? '#111' : '#9ca3af' }}>
                                {h.minutes > 0 ? `${h.minutes}m / ${h.events}x` : '—'}
                              </Col>
                            </Row>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </Card>
              </Col>

              {/* Day of Week */}
              <Col xs={24} md={12} style={{ marginBottom: 16 }}>
                <Card
                  title={<Space><CalendarOutlined style={{ color: '#d97706' }} /><span>Unplanned Downtime by Day of Week</span></Space>}
                  size="small"
                  extra={patterns.worst_day && <Tag color="orange">Worst: {patterns.worst_day.day_name}</Tag>}
                >
                  {(() => {
                    const maxMin = Math.max(1, ...patterns.by_day.map(d => d.minutes));
                    return patterns.by_day.map((d) => (
                      <div key={d.day} style={{ marginBottom: 8 }}>
                        <Row align="middle" gutter={8}>
                          <Col style={{ width: 80, fontSize: 12 }}>{d.day_name}</Col>
                          <Col flex="auto">
                            <Progress
                              percent={Math.round((d.minutes / maxMin) * 100)}
                              showInfo={false}
                              size="small"
                              strokeColor={patterns.worst_day?.day === d.day ? '#d97706' : '#3b82f6'}
                            />
                          </Col>
                          <Col style={{ width: 70, fontSize: 11, textAlign: 'right', color: d.minutes > 0 ? '#111' : '#9ca3af' }}>
                            {d.minutes > 0 ? `${d.minutes}m / ${d.events}x` : '—'}
                          </Col>
                        </Row>
                      </div>
                    ));
                  })()}
                </Card>
              </Col>

              {/* Top Equipment */}
              <Col xs={24} md={12} style={{ marginBottom: 16 }}>
                <Card title="Top Equipment by Unplanned Downtime (90 days)" size="small">
                  {patterns.top_equipment?.length > 0 ? (
                    (() => {
                      const maxMin = Math.max(1, ...patterns.top_equipment.map(e => e.total_minutes));
                      return patterns.top_equipment.map((e, i) => (
                        <div key={e.equipment_id} style={{ marginBottom: 8 }}>
                          <Row align="middle" gutter={8}>
                            <Col style={{ width: 26, fontSize: 12, color: '#6b7280' }}>#{i + 1}</Col>
                            <Col style={{ width: 100, fontSize: 12 }}>
                              <Tooltip title={e.equipment_name}>
                                <Text strong style={{ fontSize: 12 }}>{e.equipment_code}</Text>
                              </Tooltip>
                            </Col>
                            <Col flex="auto">
                              <Progress
                                percent={Math.round((e.total_minutes / maxMin) * 100)}
                                showInfo={false}
                                size="small"
                                strokeColor={i === 0 ? '#dc2626' : '#f97316'}
                              />
                            </Col>
                            <Col style={{ width: 80, fontSize: 11, textAlign: 'right' }}>
                              {e.total_minutes}m / {e.event_count}x
                            </Col>
                          </Row>
                        </div>
                      ));
                    })()
                  ) : <span style={{ color: '#9ca3af', fontSize: 13 }}>No unplanned downtime in last 90 days</span>}
                </Card>
              </Col>

              {/* Summary */}
              <Col xs={24} md={12} style={{ marginBottom: 16 }}>
                <Card title="90-Day Summary" size="small">
                  <Row gutter={16}>
                    <Col span={12}><Statistic title="Total Events" value={patterns.total_events} /></Col>
                    <Col span={12}><Statistic title="Total Downtime (min)" value={patterns.total_unplanned_minutes} valueStyle={{ color: '#dc2626' }} /></Col>
                    <Col span={12} style={{ marginTop: 12 }}><Statistic title="Avg/Event (min)" value={patterns.total_events > 0 ? Math.round(patterns.total_unplanned_minutes / patterns.total_events) : 0} /></Col>
                    <Col span={12} style={{ marginTop: 12 }}>
                      {patterns.worst_day && <Statistic title="Worst Day" value={patterns.worst_day.day_name} valueStyle={{ color: '#d97706', fontSize: 16 }} />}
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Click "Pattern Analysis" to load insights</div>
          )}
        </div>
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
    </AppLayout>
  );
}
