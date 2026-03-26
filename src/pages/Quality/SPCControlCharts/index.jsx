import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Table, Tag, Space, Select, message, Input,
  Drawer, Form, InputNumber, Divider, Popconfirm, Tooltip, Spin,
  Row, Col, Statistic, Empty, Alert,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, RightOutlined, BarChartOutlined,
  DeleteOutlined, ThunderboltOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { spcApi } from '../../../api/quality.api';
import { itemApi } from '../../../api/item.api';

const { Title, Text } = Typography;

const CHART_TYPES = { xbar_r: 'X-bar & R Chart', p_chart: 'P Chart' };
const DATA_SOURCES = { iqc: 'IQC', lqc: 'LQC', pqc: 'PQC', oqc: 'OQC' };

function ViolationDot(props) {
  const { cx, cy, payload } = props;
  if (payload?.violation) {
    return <circle cx={cx} cy={cy} r={6} fill="#dc2626" stroke="#fff" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="#1d4ed8" stroke="#1d4ed8" />;
}

export default function SPCControlChartsPage() {
  const { can } = usePermissions();
  const canWrite = can('quality-spc_control_charts-create_edit_delete');

  const [configs, setConfigs]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [items, setItems]           = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form]                      = Form.useForm();
  const [saving, setSaving]         = useState(false);

  // Chart view state
  const [selectedId, setSelectedId] = useState(null);
  const [chartData, setChartData]   = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [calcLoading, setCalcLoading]   = useState({});

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await spcApi.getConfigs();
      setConfigs(res?.data ?? []);
    } catch { message.error('Failed to load SPC configs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  useEffect(() => {
    itemApi.getAll({ limit: 500 }).then((res) => {
      const arr = res?.data ?? (Array.isArray(res) ? res : []);
      setItems(arr);
    }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      await spcApi.createConfig(vals);
      message.success('SPC chart config created');
      setDrawerOpen(false);
      form.resetFields();
      loadConfigs();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed to create');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await spcApi.deleteConfig(id);
      message.success('Config deleted');
      if (selectedId === id) { setSelectedId(null); setChartData(null); }
      loadConfigs();
    } catch { message.error('Failed to delete'); }
  };

  const handleCalculate = async (id) => {
    setCalcLoading((p) => ({ ...p, [id]: true }));
    try {
      const res = await spcApi.calculate(id);
      const data = res?.data ?? res;
      message.success(`Calculated ${data?.stats?.total_subgroups || 0} subgroups, ${data?.stats?.violations_count || 0} violations`);
      loadConfigs();
      // Auto-show chart
      setSelectedId(id);
      setChartData(data);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Calculation failed');
    } finally { setCalcLoading((p) => ({ ...p, [id]: false })); }
  };

  const handleViewChart = async (id) => {
    setSelectedId(id);
    setChartLoading(true);
    try {
      const res = await spcApi.getChartData(id);
      setChartData(res?.data ?? res);
    } catch { message.error('Failed to load chart data'); }
    finally { setChartLoading(false); }
  };

  const columns = [
    {
      title: 'Item', key: 'item', width: 180,
      render: (_, r) => (
        <div>
          <Text strong>{r.Item?.code}</Text>
          <br /><Text type="secondary" style={{ fontSize: 11 }}>{r.Item?.name}</Text>
        </div>
      ),
    },
    { title: 'Parameter', dataIndex: 'parameter_name', key: 'param', width: 160 },
    {
      title: 'Chart Type', dataIndex: 'chart_type', key: 'type', width: 120,
      render: (v) => <Tag color={v === 'xbar_r' ? 'blue' : 'purple'}>{CHART_TYPES[v]}</Tag>,
    },
    {
      title: 'Source', dataIndex: 'data_source', key: 'source', width: 80,
      render: (v) => <Tag>{DATA_SOURCES[v]}</Tag>,
    },
    { title: 'n', dataIndex: 'subgroup_size', key: 'n', width: 50, align: 'center' },
    {
      title: 'Control Limits', key: 'limits', width: 180,
      render: (_, r) => r.ucl != null ? (
        <Text style={{ fontSize: 11 }}>UCL: {r.ucl} | CL: {r.cl} | LCL: {r.lcl}</Text>
      ) : <Text type="secondary" style={{ fontSize: 11 }}>Not calculated</Text>,
    },
    {
      title: 'Status', dataIndex: 'is_active', key: 'status', width: 80,
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: '', key: 'actions', width: 160,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Calculate">
            <Button size="small" type="primary" ghost icon={<ThunderboltOutlined />}
              loading={calcLoading[r.id]} onClick={() => handleCalculate(r.id)} />
          </Tooltip>
          <Tooltip title="View Chart">
            <Button size="small" icon={<BarChartOutlined />} onClick={() => handleViewChart(r.id)} />
          </Tooltip>
          <Popconfirm title="Delete this SPC config?" onConfirm={() => handleDelete(r.id)} okText="Delete" okType="danger">
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Chart rendering
  const cfg = chartData?.config;
  const readings = chartData?.readings || [];
  const stats = chartData?.stats;
  const violations = readings.filter((r) => r.violation);

  const xBarData = readings.map((r) => ({
    sg: `#${r.subgroup_no}`,
    x_bar: r.x_bar != null ? parseFloat(r.x_bar) : null,
    range: r.range_value != null ? parseFloat(r.range_value) : null,
    p: r.p_value != null ? parseFloat(r.p_value) * 100 : null,
    violation: r.violation,
    date: r.subgroup_date,
  }));

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Quality</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>SPC Control Charts</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>SPC Control Charts</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        X-bar &amp; R charts and P-charts for critical quality parameters. Auto-raises NCR on Western Electric rule violations.
      </Text>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 16 }}>
        <Tag color="blue">Configs: {configs.length}</Tag>
        <Tag color="green">Active: {configs.filter((c) => c.is_active).length}</Tag>
      </div>

      {/* Configs Table */}
      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24 }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={loadConfigs}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            Add SPC Chart
          </Button>
        </div>
        <Table
          rowKey="id"
          dataSource={configs}
          columns={columns}
          size="small"
          loading={loading}
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'No SPC configurations yet. Click "Add SPC Chart" to create one.' }}
        />
      </Card>

      {/* Chart View */}
      {selectedId && (
        <Spin spinning={chartLoading}>
          {readings.length === 0 && !chartLoading ? (
            <Card style={{ border: '1px solid #e8eaed', borderRadius: 12 }} bodyStyle={{ padding: 40 }}>
              <Empty description={chartData?.message || 'No chart data. Click "Calculate" to generate.'} />
            </Card>
          ) : readings.length > 0 && (
            <>
              {/* Stats */}
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={12} sm={6}>
                  <Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
                    <Statistic title="Subgroups" value={stats?.total_subgroups || readings.length} valueStyle={{ fontSize: 20 }} />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
                    <Statistic title="Total Readings" value={stats?.total_readings || '-'} valueStyle={{ fontSize: 20 }} />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
                    <Statistic title="Violations" value={violations.length}
                      valueStyle={{ fontSize: 20, color: violations.length > 0 ? '#dc2626' : '#16a34a' }} />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
                    <Statistic
                      title={cfg?.chart_type === 'xbar_r' ? 'Center Line' : 'p-bar'}
                      value={cfg?.chart_type === 'xbar_r' ? cfg?.cl : `${(parseFloat(cfg?.cl) * 100).toFixed(2)}%`}
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Violations alert */}
              {violations.length > 0 && (
                <Alert
                  type="error"
                  icon={<ExclamationCircleOutlined />}
                  showIcon
                  style={{ marginBottom: 16, borderRadius: 8 }}
                  message={`${violations.length} Western Electric Rule Violation(s) Detected`}
                  description={violations.map((v) => `Subgroup #${v.subgroup_no}: ${v.violation}`).join(' | ')}
                />
              )}

              {cfg?.chart_type === 'xbar_r' ? (
                <>
                  {/* X-bar Chart */}
                  <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, marginBottom: 16 }} bodyStyle={{ padding: '16px 20px' }}>
                    <Divider orientation="left" style={{ fontWeight: 600, fontSize: 13 }}>X-bar Chart (Subgroup Means)</Divider>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={xBarData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="sg" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                        <ReTooltip formatter={(v, name) => [v?.toFixed(4), name]} labelFormatter={(l) => `Subgroup ${l}`} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <ReferenceLine y={parseFloat(cfg.ucl)} stroke="#dc2626" strokeDasharray="5 5" label={{ value: `UCL: ${cfg.ucl}`, fill: '#dc2626', fontSize: 10 }} />
                        <ReferenceLine y={parseFloat(cfg.cl)} stroke="#16a34a" strokeDasharray="3 3" label={{ value: `CL: ${cfg.cl}`, fill: '#16a34a', fontSize: 10 }} />
                        <ReferenceLine y={parseFloat(cfg.lcl)} stroke="#dc2626" strokeDasharray="5 5" label={{ value: `LCL: ${cfg.lcl}`, fill: '#dc2626', fontSize: 10 }} />
                        {cfg.usl && <ReferenceLine y={parseFloat(cfg.usl)} stroke="#7c3aed" strokeDasharray="8 4" label={{ value: `USL: ${cfg.usl}`, fill: '#7c3aed', fontSize: 10 }} />}
                        {cfg.lsl && <ReferenceLine y={parseFloat(cfg.lsl)} stroke="#7c3aed" strokeDasharray="8 4" label={{ value: `LSL: ${cfg.lsl}`, fill: '#7c3aed', fontSize: 10 }} />}
                        <Line type="monotone" dataKey="x_bar" name="X-bar" stroke="#1d4ed8" strokeWidth={2} dot={<ViolationDot />} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>

                  {/* R Chart */}
                  <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, marginBottom: 16 }} bodyStyle={{ padding: '16px 20px' }}>
                    <Divider orientation="left" style={{ fontWeight: 600, fontSize: 13 }}>R Chart (Subgroup Range)</Divider>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={xBarData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="sg" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                        <ReTooltip formatter={(v) => [v?.toFixed(4), 'Range']} />
                        <ReferenceLine y={parseFloat(cfg.ucl_r)} stroke="#dc2626" strokeDasharray="5 5" label={{ value: `UCL: ${cfg.ucl_r}`, fill: '#dc2626', fontSize: 10 }} />
                        <ReferenceLine y={parseFloat(cfg.cl_r)} stroke="#16a34a" strokeDasharray="3 3" label={{ value: `CL: ${cfg.cl_r}`, fill: '#16a34a', fontSize: 10 }} />
                        {parseFloat(cfg.lcl_r) > 0 && <ReferenceLine y={parseFloat(cfg.lcl_r)} stroke="#dc2626" strokeDasharray="5 5" label={{ value: `LCL: ${cfg.lcl_r}`, fill: '#dc2626', fontSize: 10 }} />}
                        <Line type="monotone" dataKey="range" name="Range" stroke="#b45309" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </>
              ) : (
                /* P Chart */
                <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, marginBottom: 16 }} bodyStyle={{ padding: '16px 20px' }}>
                  <Divider orientation="left" style={{ fontWeight: 600, fontSize: 13 }}>P Chart (Proportion Defective %)</Divider>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={xBarData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="sg" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                      <ReTooltip formatter={(v) => [`${v?.toFixed(2)}%`, 'Defective']} />
                      <ReferenceLine y={parseFloat(cfg.ucl) * 100} stroke="#dc2626" strokeDasharray="5 5" label={{ value: `UCL: ${(parseFloat(cfg.ucl) * 100).toFixed(2)}%`, fill: '#dc2626', fontSize: 10 }} />
                      <ReferenceLine y={parseFloat(cfg.cl) * 100} stroke="#16a34a" strokeDasharray="3 3" label={{ value: `CL: ${(parseFloat(cfg.cl) * 100).toFixed(2)}%`, fill: '#16a34a', fontSize: 10 }} />
                      {parseFloat(cfg.lcl) > 0 && <ReferenceLine y={parseFloat(cfg.lcl) * 100} stroke="#dc2626" strokeDasharray="5 5" label={{ value: `LCL: ${(parseFloat(cfg.lcl) * 100).toFixed(2)}%`, fill: '#dc2626', fontSize: 10 }} />}
                      <Line type="monotone" dataKey="p" name="p %" stroke="#7c3aed" strokeWidth={2} dot={<ViolationDot />} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </>
          )}
        </Spin>
      )}

      {/* Add Config Drawer */}
      <Drawer title="Add SPC Chart Configuration" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        width={440} footer={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleCreate} loading={saving}>Create</Button>
          </Space>
        }>
        <Form form={form} layout="vertical">
          <Form.Item name="item_id" label="Item" rules={[{ required: true, message: 'Select an item' }]}>
            <Select showSearch optionFilterProp="label" placeholder="Select item..."
              options={items.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }))} />
          </Form.Item>
          <Form.Item name="parameter_name" label="Parameter Name"
            rules={[{ required: true, message: 'Enter parameter name' }]}
            extra="Must match the parameter name used in inspection results exactly">
            <Input placeholder="e.g. Diameter, Weight, Hardness" />
          </Form.Item>
          <Form.Item name="chart_type" label="Chart Type" initialValue="xbar_r">
            <Select options={[
              { value: 'xbar_r', label: 'X-bar & R Chart (variable data)' },
              { value: 'p_chart', label: 'P Chart (pass/fail attribute data)' },
            ]} />
          </Form.Item>
          <Form.Item name="data_source" label="Data Source" initialValue="lqc">
            <Select options={Object.entries(DATA_SOURCES).map(([v, l]) => ({ value: v, label: `${l} Inspections` }))} />
          </Form.Item>
          <Form.Item name="subgroup_size" label="Subgroup Size (n)" initialValue={5}>
            <InputNumber min={2} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Divider>Specification Limits (optional)</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="usl" label="USL (Upper Spec)">
                <InputNumber style={{ width: '100%' }} step={0.01} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lsl" label="LSL (Lower Spec)">
                <InputNumber style={{ width: '100%' }} step={0.01} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </AppLayout>
  );
}
