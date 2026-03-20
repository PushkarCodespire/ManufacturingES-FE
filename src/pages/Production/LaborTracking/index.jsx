import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, Drawer, Form,
  Select, DatePicker, TimePicker, Input, Popconfirm, message,
  Row, Col, Statistic, Tooltip, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined,
  UserOutlined, BarChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import api from '../../../api/axios';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const LABOR_TYPE_COLOR = {
  direct:   'blue',
  indirect: 'orange',
  setup:    'purple',
  rework:   'red',
};

export default function LaborTrackingPage() {
  const { can } = usePermissions();
  const canWrite  = can('prod-labor_tracking-manage_labor-create_edit_delete');
  const canDelete = can('prod-labor_tracking-manage_labor-create_edit_delete');

  const [records, setRecords]     = useState([]);
  const [summary, setSummary]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [drawerOpen, setDrawer]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [viewMode, setViewMode]   = useState('logs'); // 'logs' | 'summary'

  // Filter state
  const [filters, setFilters] = useState({ dateRange: null, operator_id: null, labor_type: null });

  // Dropdown data
  const [jobCards, setJobCards]   = useState([]);
  const [operators, setOperators] = useState([]);
  const [steps, setSteps]         = useState([]);

  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.operator_id) params.operator_id = filters.operator_id;
      if (filters.labor_type)  params.labor_type  = filters.labor_type;
      if (filters.dateRange?.[0]) params.date_from = filters.dateRange[0].format('YYYY-MM-DD');
      if (filters.dateRange?.[1]) params.date_to   = filters.dateRange[1].format('YYYY-MM-DD');

      const [logsRes, summaryRes] = await Promise.all([
        api.get('/labor-logs', { params }),
        api.get('/labor-logs/summary', { params }),
      ]);
      setRecords(logsRes.data || []);
      setSummary(summaryRes.data || []);
    } catch {
      message.error('Failed to load labor logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      api.get('/job-cards'),
      api.get('/users'),
    ]).then(([jcRes, usrRes]) => {
      setJobCards(jcRes.data || []);
      setOperators(usrRes.data || []);
    }).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ labor_type: 'direct' });
    setDrawer(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      job_card_id:     record.job_card_id,
      operator_id:     record.operator_id,
      routing_step_id: record.routing_step_id,
      operation_name:  record.operation_name,
      labor_type:      record.labor_type,
      start_time:      dayjs(record.start_time),
      end_time:        record.end_time ? dayjs(record.end_time) : null,
      notes:           record.notes,
    });
    // Load routing steps for this job card
    if (record.job_card_id) loadSteps(record.job_card_id);
    setDrawer(true);
  };

  const loadSteps = async (jobCardId) => {
    try {
      const res = await api.get(`/job-cards/${jobCardId}`);
      const jc  = res.data;
      if (jc?.RoutingStep) setSteps([jc.RoutingStep]);
      else setSteps([]);
    } catch { setSteps([]); }
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        ...vals,
        start_time: vals.start_time?.toISOString(),
        end_time:   vals.end_time?.toISOString() || null,
      };
      if (editing) {
        await api.put(`/labor-logs/${editing.id}`, payload);
        message.success('Labor log updated');
      } else {
        await api.post('/labor-logs', payload);
        message.success('Labor log created');
      }
      setDrawer(false);
      load();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/labor-logs/${id}`);
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const logColumns = [
    { title: 'Log No', dataIndex: 'log_no', width: 130,
      render: v => <Text code>{v}</Text> },
    { title: 'Job Card', dataIndex: ['JobCard', 'job_no'], width: 130,
      render: (v, r) => (
        <span>
          <Text code>{v}</Text>
          {r.JobCard?.WorkOrder && <><br /><Text type="secondary" style={{ fontSize: 11 }}>{r.JobCard.WorkOrder.wo_no}</Text></>}
        </span>
      ),
    },
    { title: 'Operator', dataIndex: ['Operator', 'name'], width: 140,
      render: (v, r) => <><UserOutlined /> {v}<br /><Text type="secondary" style={{ fontSize: 11 }}>{r.Operator?.employee_id}</Text></> },
    { title: 'Operation', dataIndex: 'operation_name', width: 160,
      render: (v, r) => v || r.RoutingStep?.operation_name || <Text type="secondary">—</Text> },
    { title: 'Type', dataIndex: 'labor_type', width: 100,
      render: v => <Tag color={LABOR_TYPE_COLOR[v]}>{v}</Tag> },
    { title: 'Start', dataIndex: 'start_time', width: 150,
      render: v => dayjs(v).format('DD MMM, HH:mm') },
    { title: 'End', dataIndex: 'end_time', width: 150,
      render: v => v ? dayjs(v).format('DD MMM, HH:mm') : <Tag color="green">Active</Tag> },
    { title: 'Duration', dataIndex: 'duration_min', width: 100,
      render: v => v != null ? <><ClockCircleOutlined /> {v} min</> : '—' },
    {
      title: 'Actions', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space>
          {canWrite && <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>}
          {canDelete && (
            <Popconfirm title="Delete this labor log?" onConfirm={() => handleDelete(r.id)} okType="danger">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const summaryColumns = [
    { title: 'Operator', dataIndex: ['Operator', 'name'],
      render: (v, r) => <><UserOutlined /> {v} <Text type="secondary">({r.Operator?.employee_id})</Text></> },
    { title: 'Job Card', dataIndex: ['JobCard', 'job_no'], render: v => <Text code>{v}</Text> },
    { title: 'Type', dataIndex: 'labor_type', render: v => <Tag color={LABOR_TYPE_COLOR[v]}>{v}</Tag> },
    { title: 'Logs', dataIndex: 'log_count', align: 'right' },
    { title: 'Total (min)', dataIndex: 'total_minutes', align: 'right',
      render: v => v ? `${parseFloat(v).toFixed(1)} min` : '—' },
    { title: 'Avg (min)', dataIndex: 'avg_minutes', align: 'right',
      render: v => v ? `${parseFloat(v).toFixed(1)} min` : '—' },
  ];

  // KPI cards
  const totalMin   = records.reduce((s, r) => s + (parseFloat(r.duration_min) || 0), 0);
  const activeLogs = records.filter(r => !r.end_time).length;
  const directMin  = records.filter(r => r.labor_type === 'direct').reduce((s, r) => s + (parseFloat(r.duration_min) || 0), 0);

  return (
    <AppLayout>
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>Labor Tracking</Title>
          <Text type="secondary">Track operator time per job card operation</Text>
        </div>

        {/* KPI row */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="Total Logs" value={records.length} prefix={<BarChartOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="Total Labor (hrs)" value={(totalMin / 60).toFixed(1)} suffix="hrs" />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="Direct Labor (hrs)" value={(directMin / 60).toFixed(1)} suffix="hrs" valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="Active (open)" value={activeLogs} valueStyle={{ color: activeLogs > 0 ? '#52c41a' : undefined }} />
            </Card>
          </Col>
        </Row>

        {/* Main card */}
        <Card>
          {/* Toolbar */}
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Space wrap>
              <RangePicker
                onChange={v => setFilters(f => ({ ...f, dateRange: v }))}
                format="DD MMM YYYY"
                style={{ width: 260 }}
              />
              <Select
                placeholder="Operator"
                allowClear
                style={{ width: 180 }}
                onChange={v => setFilters(f => ({ ...f, operator_id: v }))}
                showSearch
                optionFilterProp="label"
                options={operators.map(u => ({ label: u.name, value: u.id }))}
              />
              <Select
                placeholder="Labor Type"
                allowClear
                style={{ width: 140 }}
                onChange={v => setFilters(f => ({ ...f, labor_type: v }))}
              >
                {Object.keys(LABOR_TYPE_COLOR).map(t => (
                  <Option key={t} value={t}><Tag color={LABOR_TYPE_COLOR[t]}>{t}</Tag></Option>
                ))}
              </Select>
              <Space>
                <Button
                  type={viewMode === 'logs' ? 'primary' : 'default'}
                  onClick={() => setViewMode('logs')} size="small"
                >Logs</Button>
                <Button
                  type={viewMode === 'summary' ? 'primary' : 'default'}
                  onClick={() => setViewMode('summary')} size="small"
                >Summary</Button>
              </Space>
            </Space>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Log Labor
              </Button>
            )}
          </Row>

          <Table
            rowKey="id"
            dataSource={viewMode === 'logs' ? records : summary}
            columns={viewMode === 'logs' ? logColumns : summaryColumns}
            loading={loading}
            size="small"
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </Card>
      </div>

      {/* Create / Edit Drawer */}
      <Drawer
        title={editing ? 'Edit Labor Log' : 'Log Labor'}
        open={drawerOpen}
        onClose={() => setDrawer(false)}
        width={480}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawer(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>Save</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="job_card_id" label="Job Card" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select job card"
              optionFilterProp="label"
              onChange={loadSteps}
              options={jobCards.map(j => ({
                label: `${j.job_no}${j.WorkOrder ? ` — ${j.WorkOrder.wo_no}` : ''}`,
                value: j.id,
              }))}
            />
          </Form.Item>

          <Form.Item name="operator_id" label="Operator" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select operator"
              optionFilterProp="label"
              options={operators.map(u => ({
                label: `${u.name} (${u.employee_id})`,
                value: u.id,
              }))}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="routing_step_id" label="Routing Step">
                <Select allowClear placeholder="Select step (optional)">
                  {steps.map(s => <Option key={s.id} value={s.id}>Step {s.step_no} — {s.operation_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="labor_type" label="Labor Type" rules={[{ required: true }]}>
                <Select>
                  {Object.keys(LABOR_TYPE_COLOR).map(t => (
                    <Option key={t} value={t}><Tag color={LABOR_TYPE_COLOR[t]}>{t}</Tag></Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="operation_name" label="Operation Name (override)">
            <Input placeholder="Leave blank to use routing step name" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="start_time" label="Start Time" rules={[{ required: true }]}>
                <DatePicker showTime format="DD MMM YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_time" label="End Time">
                <DatePicker showTime format="DD MMM YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
