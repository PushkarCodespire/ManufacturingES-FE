import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Typography, Statistic, Table, Tag, Progress,
  Button, Space, Spin, Tooltip, Badge, Modal, InputNumber, message,
} from 'antd';
import {
  RobotOutlined, DollarOutlined, ThunderboltOutlined,
  ReloadOutlined, DownloadOutlined, SettingOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import api from '../../../api/axios';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const AGENT_LABELS = {
  general_madad:      'Madad Chatbot',
  iqc_advisor:        'IQC Advisor',
  production_planner: 'Production Planner',
  quality_analyst:    'Quality Analyst',
  procurement_agent:  'Procurement Agent',
  store_optimizer:    'Store Optimizer',
  dispatch_tracker:   'Dispatch Tracker',
  npd_assistant:      'NPD Assistant',
  maintenance:        'Maintenance AI',
  unknown:            'Other',
};

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16', '#2f54eb', '#a0d911'];

const centsToUSD = (cents) => {
  const usd = cents / 100;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
};

export default function AiDashboard() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [byAgent, setByAgent] = useState([]);
  const [byUser, setByUser] = useState([]);
  const [byModel, setByModel] = useState([]);
  const [history, setHistory] = useState([]);
  const [recent, setRecent] = useState([]);
  const [budgetModal, setBudgetModal] = useState(false);
  const [newBudget, setNewBudget] = useState(50);
  const [budgetSaving, setBudgetSaving] = useState(false);

  const handleSaveBudget = async () => {
    setBudgetSaving(true);
    try {
      await api.put('/admin/ai-dashboard/budget', { budget_usd: newBudget });
      message.success(`Budget updated to $${newBudget}`);
      setBudgetModal(false);
      fetchAll();
    } catch (err) {
      message.error('Failed to update budget');
    } finally {
      setBudgetSaving(false);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d, a, u, m, h, r] = await Promise.all([
        api.get('/admin/ai-dashboard/summary').then(r => r.data),
        api.get('/admin/ai-dashboard/daily').then(r => r.data || []),
        api.get('/admin/ai-dashboard/by-agent').then(r => r.data || []),
        api.get('/admin/ai-dashboard/by-user').then(r => r.data || []),
        api.get('/admin/ai-dashboard/by-model').then(r => r.data || []),
        api.get('/admin/ai-dashboard/history').then(r => r.data || []),
        api.get('/admin/ai-dashboard/recent').then(r => r.data || []),
      ]);
      setSummary(s);
      setDaily(d);
      setByAgent(a);
      setByUser(u);
      setByModel(m);
      setHistory(h);
      setRecent(r);
    } catch (err) {
      console.error('Failed to fetch AI dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const budgetColor = summary
    ? summary.budget_used_pct > 90 ? '#f5222d'
    : summary.budget_used_pct > 70 ? '#faad14'
    : '#52c41a'
    : '#1890ff';

  const recentColumns = [
    { title: 'Time', dataIndex: 'created_at', key: 'created_at', width: 150,
      render: v => dayjs(v).format('DD MMM HH:mm') },
    { title: 'User', dataIndex: 'user_name', key: 'user_name', width: 140 },
    { title: 'Agent', dataIndex: 'agent_key', key: 'agent_key', width: 160,
      render: v => <Tag color="blue">{AGENT_LABELS[v] || v}</Tag> },
    { title: 'Model', dataIndex: 'model', key: 'model', width: 180,
      render: v => <Tag color={v.includes('sonnet') ? 'purple' : 'green'}>{v}</Tag> },
    { title: 'Input Tokens', dataIndex: 'input_tokens', key: 'input_tokens', width: 110, align: 'right',
      render: v => v?.toLocaleString() },
    { title: 'Output Tokens', dataIndex: 'output_tokens', key: 'output_tokens', width: 120, align: 'right',
      render: v => v?.toLocaleString() },
    { title: 'Cost', dataIndex: 'cost_cents', key: 'cost_cents', width: 100, align: 'right',
      render: v => centsToUSD(v) },
    { title: 'Endpoint', dataIndex: 'endpoint', key: 'endpoint', ellipsis: true },
  ];

  const userColumns = [
    { title: 'User', dataIndex: 'user_name', key: 'user_name' },
    { title: 'Employee ID', dataIndex: 'employee_id', key: 'employee_id' },
    { title: 'Calls', dataIndex: 'calls', key: 'calls', align: 'right' },
    { title: 'Input Tokens', dataIndex: 'input_tokens', key: 'input_tokens', align: 'right',
      render: v => v?.toLocaleString() },
    { title: 'Output Tokens', dataIndex: 'output_tokens', key: 'output_tokens', align: 'right',
      render: v => v?.toLocaleString() },
    { title: 'Cost', dataIndex: 'cost_cents', key: 'cost_cents', align: 'right',
      render: v => centsToUSD(v) },
  ];

  const modelColumns = [
    { title: 'Model', dataIndex: 'model', key: 'model',
      render: v => <Tag color={v.includes('sonnet') ? 'purple' : 'green'}>{v}</Tag> },
    { title: 'Calls', dataIndex: 'calls', key: 'calls', align: 'right' },
    { title: 'Input Tokens', dataIndex: 'input_tokens', key: 'input_tokens', align: 'right',
      render: v => v?.toLocaleString() },
    { title: 'Output Tokens', dataIndex: 'output_tokens', key: 'output_tokens', align: 'right',
      render: v => v?.toLocaleString() },
    { title: 'Cost', dataIndex: 'cost_cents', key: 'cost_cents', align: 'right',
      render: v => centsToUSD(v) },
  ];

  const breadcrumb = [
    { label: 'Admin', path: '/admin' },
    { label: 'AI Dashboard' },
  ];

  return (
    <AppLayout breadcrumb={breadcrumb}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <RobotOutlined style={{ marginRight: 8 }} />AI Cost & Usage Dashboard
          </Title>
          <Text type="secondary">Monitor AI API usage, costs, and budget across all agents.</Text>
        </div>
        <Space>
          <Button icon={<SettingOutlined />} onClick={() => { setNewBudget(summary ? summary.budget_cents / 100 : 50); setBudgetModal(true); }}>Set Budget</Button>
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('ai-usage-recent.csv', recent, recentColumns)}>Export CSV</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>Refresh</Button>
        </Space>
      </div>

      <Modal
        title="Set Monthly AI Budget"
        open={budgetModal}
        onCancel={() => setBudgetModal(false)}
        onOk={handleSaveBudget}
        confirmLoading={budgetSaving}
        okText="Save Budget"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>Set the maximum monthly spend for AI API calls. When the budget is exceeded, all AI features will be disabled until the next month.</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong>Monthly Budget:</Text>
          <InputNumber
            value={newBudget}
            onChange={setNewBudget}
            min={0}
            max={10000}
            step={5}
            precision={2}
            prefix="$"
            style={{ width: 160 }}
            addonAfter="USD"
          />
        </div>
        {summary && (
          <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
            <Text type="secondary">Current spend this month: <strong>${(summary.total_cost_cents / 100).toFixed(4)}</strong> of <strong>${(summary.budget_cents / 100).toFixed(2)}</strong></Text>
          </div>
        )}
      </Modal>

      <Spin spinning={loading}>
        {/* Row 1: Summary Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Cost (This Month)"
                value={summary ? `$${(summary.total_cost_cents / 100).toFixed(4)}` : '$0'}
                valueStyle={{ color: budgetColor }}
              />
              <Progress
                percent={summary?.budget_used_pct || 0}
                strokeColor={budgetColor}
                size="small"
                style={{ marginTop: 8 }}
                format={p => `${p.toFixed(1)}%`}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Budget: ${summary ? (summary.budget_cents / 100).toFixed(2) : '0.00'}
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total API Calls"
                value={summary?.total_calls || 0}
                prefix={<ThunderboltOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {summary?.total_input_tokens?.toLocaleString() || 0} input + {summary?.total_output_tokens?.toLocaleString() || 0} output tokens
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Avg Cost per Call"
                value={summary ? `$${(summary.avg_cost_per_call / 100).toFixed(6)}` : '$0'}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Budget Remaining"
                value={summary ? `$${(summary.budget_remaining_cents / 100).toFixed(2)}` : '$0'}
                valueStyle={{ color: budgetColor }}
              />
              <Badge
                status={summary?.ai_enabled ? 'success' : 'error'}
                text={summary?.ai_enabled ? 'AI Enabled' : 'AI Disabled'}
                style={{ marginTop: 8 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Row 2: Charts */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={14}>
            <Card title="Daily Cost Trend (Last 30 Days)" size="small">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={v => dayjs(v).format('DD MMM')} fontSize={11} />
                  <YAxis tickFormatter={v => `$${(v/100).toFixed(2)}`} fontSize={11} />
                  <RTooltip formatter={(v) => [`$${(v/100).toFixed(4)}`, 'Cost']}
                    labelFormatter={v => dayjs(v).format('DD MMM YYYY')} />
                  <Area type="monotone" dataKey="cost_cents" stroke="#1890ff" fill="#1890ff" fillOpacity={0.3} name="Cost" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="Cost by Agent (This Month)" size="small">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={byAgent.map(a => ({ ...a, name: AGENT_LABELS[a.agent_key] || a.agent_key }))}
                    dataKey="cost_cents"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {byAgent.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RTooltip formatter={(v) => [`$${(v/100).toFixed(4)}`, 'Cost']} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Row 3: Tables */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={14}>
            <Card title="Top Users by Cost (This Month)" size="small">
              <Table
                dataSource={byUser}
                columns={userColumns}
                rowKey="user_id"
                size="small"
                pagination={false}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="Cost by Model (This Month)" size="small">
              <Table
                dataSource={byModel}
                columns={modelColumns}
                rowKey="model"
                size="small"
                pagination={false}
              />
            </Card>
          </Col>
        </Row>

        {/* Row 4: Monthly History */}
        {history.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <Card title="Monthly Cost History" size="small">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis tickFormatter={v => `$${(v/100).toFixed(2)}`} fontSize={11} />
                    <RTooltip formatter={(v) => [`$${(v/100).toFixed(4)}`, 'Cost']} />
                    <Bar dataKey="cost_cents" fill="#722ed1" name="Cost" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        )}

        {/* Row 5: Recent Activity */}
        <Card title="Recent AI Calls" size="small">
          <Table
            dataSource={recent}
            columns={recentColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 20 }}
            scroll={{ x: 1100 }}
          />
        </Card>
      </Spin>
    </AppLayout>
  );
}
