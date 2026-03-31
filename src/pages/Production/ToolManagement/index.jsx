import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Typography, Button, Drawer, Form, InputNumber,
  Select, DatePicker, Space, Popconfirm, message, Progress, Tabs,
  Tooltip, Row, Col, Statistic, Spin,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, RightOutlined, ToolOutlined,
  DeleteOutlined, HistoryOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { toolLogApi } from '../../../api/production.api';
import api            from '../../../api/axios';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

function conditionColor(c) {
  return c === 'good' ? 'green' : c === 'worn' ? 'gold' : 'red';
}

export default function ToolManagementPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-tool_management-tool_logs-create_edit_delete');

  const [activeTab, setActiveTab] = useState('summary');

  // Summary tab
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary,        setSummary]        = useState([]);

  // Log tab
  const [logLoading,  setLogLoading]  = useState(false);
  const [logs,        setLogs]        = useState([]);
  const [toolFilter,  setToolFilter]  = useState(null);
  const [condFilter,  setCondFilter]  = useState(null);

  // Tool detail drawer
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailTool,    setDetailTool]    = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData,    setDetailData]    = useState(null);

  // Log usage drawer
  const [logOpen,  setLogOpen]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [logForm]               = Form.useForm();

  // Lookups
  const [tools,    setTools]    = useState([]);
  const [machines, setMachines] = useState([]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await toolLogApi.getSummary();
      setSummary(res.data || []);
    } catch { message.error('Failed to load tool summary'); }
    finally { setSummaryLoading(false); }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const params = {};
      if (toolFilter) params.tool_id   = toolFilter;
      if (condFilter) params.condition = condFilter;
      const res = await toolLogApi.getAll(params);
      setLogs(res.data || []);
    } catch { message.error('Failed to load tool logs'); }
    finally { setLogLoading(false); }
  }, [toolFilter, condFilter]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (activeTab === 'logs') loadLogs(); }, [activeTab, loadLogs]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [toolsRes, machinesRes] = await Promise.all([
          api.get('/tools'),
          api.get('/machines'),
        ]);
        setTools(toolsRes.data || []);
        setMachines(machinesRes.data || []);
      } catch { /* non-fatal */ }
    };
    fetchLookups();
  }, []);

  const openDetail = async (tool) => {
    setDetailTool(tool);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await toolLogApi.getByTool(tool.tool_id);
      setDetailData(res.data);
    } catch { message.error('Failed to load tool detail'); }
    finally { setDetailLoading(false); }
  };

  const handleLogUsage = async (values) => {
    setSaving(true);
    try {
      await toolLogApi.logUsage({
        ...values,
        used_at: values.used_at?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
      });
      message.success('Usage logged');
      setLogOpen(false);
      logForm.resetFields();
      loadSummary();
      if (activeTab === 'logs') loadLogs();
    } catch { message.error('Failed to log usage'); }
    finally { setSaving(false); }
  };

  const handleDeleteLog = async (id) => {
    try {
      await toolLogApi.delete(id);
      message.success('Log deleted');
      loadLogs();
    } catch { message.error('Delete failed'); }
  };

  const summaryColumns = [
    {
      title:  'Tool',
      render: (_, r) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(r)}>
          <ToolOutlined /> {r.tool_code} — {r.tool_name}
        </Button>
      ),
    },
    { title: 'Total Strokes', dataIndex: 'total_strokes',      align: 'right' },
    { title: 'Rated Life',    dataIndex: 'rated_life_strokes',  align: 'right', render: (v) => v ?? '—' },
    {
      title: 'Life Used',
      dataIndex: 'life_pct',
      render: (v) => v != null ? (
        <Progress percent={Math.min(v, 100)} size="small" strokeColor={v >= 90 ? '#dc2626' : v >= 70 ? '#ca8a04' : '#16a34a'} />
      ) : '—',
      width: 160,
    },
    { title: 'Maint. Cycle',  dataIndex: 'maintenance_cycle',   align: 'right', render: (v) => v ?? '—' },
    { title: 'Last Used',     dataIndex: 'last_used' },
    {
      title: 'Condition',
      dataIndex: 'current_condition',
      render: (v) => <Tag color={conditionColor(v)}>{v?.toUpperCase()}</Tag>,
    },
    { title: 'Log Count', dataIndex: 'log_count', align: 'right' },
  ];

  const logColumns = [
    { title: 'Tool',       dataIndex: ['Tool', 'name'],    render: (v, r) => `${r.Tool?.code} – ${v}` },
    { title: 'Strokes',    dataIndex: 'usage_strokes',     align: 'right' },
    { title: 'Date',       dataIndex: 'used_at' },
    { title: 'Machine',    dataIndex: ['Machine', 'name'] },
    { title: 'Logged By',  dataIndex: ['Creator', 'name'] },
    {
      title: 'Condition',
      dataIndex: 'condition_after',
      render: (v) => <Tag color={conditionColor(v)}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => canWrite && (
        <Popconfirm title="Delete this log?" onConfirm={() => handleDeleteLog(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Tool Management</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Tool Management</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Track tool usage strokes, condition, and remaining life.
      </Text>

      <div style={{ marginTop: 16, marginBottom: 16, textAlign: 'right' }}>
        {canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setLogOpen(true)}>
            Log Tool Usage
          </Button>
        )}
      </div>

      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Tool Summary" key="summary">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('tool-management.csv', summary, summaryColumns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={loadSummary}>Refresh</Button>
            </div>
            <Table
              columns={summaryColumns}
              dataSource={summary}
              rowKey="tool_id"
              loading={summaryLoading}
              size="small"
              pagination={false}
              scroll={{ x: 800 }}
            />
          </TabPane>

          <TabPane tab="Usage Log" key="logs">
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <Select
                allowClear
                placeholder="Filter by tool"
                style={{ width: 200 }}
                value={toolFilter}
                onChange={setToolFilter}
                showSearch
                optionFilterProp="label"
                options={tools.map((t) => ({ value: t.id, label: `${t.code} – ${t.name}` }))}
              />
              <Select
                allowClear
                placeholder="Filter by condition"
                style={{ width: 160 }}
                value={condFilter}
                onChange={setCondFilter}
                options={[
                  { value: 'good',    label: 'Good'    },
                  { value: 'worn',    label: 'Worn'    },
                  { value: 'damaged', label: 'Damaged' },
                ]}
              />
              <div style={{ flex: 1 }} />
              <Button icon={<ReloadOutlined />} onClick={loadLogs}>Refresh</Button>
            </div>
            <Table
              columns={logColumns}
              dataSource={logs}
              rowKey="id"
              loading={logLoading}
              size="small"
              pagination={{ pageSize: 20 }}
              scroll={{ x: 700 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Log Usage Drawer */}
      <Drawer
        title="Log Tool Usage"
        open={logOpen}
        onClose={() => setLogOpen(false)}
        width={440}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setLogOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={() => logForm.submit()}>Save Log</Button>
          </div>
        }
      >
        <Form form={logForm} layout="vertical" onFinish={handleLogUsage}>
          <Form.Item name="tool_id" label="Tool" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select tool"
              options={tools.map((t) => ({ value: t.id, label: `${t.code} – ${t.name}` }))}
            />
          </Form.Item>
          <Form.Item name="usage_strokes" label="Usage Strokes" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="used_at" label="Date" initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="machine_id" label="Machine">
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="Machine (optional)"
              options={machines.map((m) => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>
          <Form.Item name="condition_after" label="Condition After" initialValue="good">
            <Select
              options={[
                { value: 'good',    label: 'Good'    },
                { value: 'worn',    label: 'Worn'    },
                { value: 'damaged', label: 'Damaged' },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Tool Detail Drawer */}
      <Drawer
        title={detailTool ? `${detailTool.tool_code} — ${detailTool.tool_name}` : 'Tool Detail'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={600}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin /></div>
        ) : detailData ? (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Statistic title="Total Strokes" value={detailTool?.total_strokes} /></Col>
              <Col span={8}><Statistic title="Rated Life" value={detailTool?.rated_life_strokes ?? '—'} /></Col>
              <Col span={8}>
                <Statistic title="Life Used" value={detailTool?.life_pct ?? '—'} suffix={detailTool?.life_pct ? '%' : ''} />
              </Col>
            </Row>
            <Table
              size="small"
              dataSource={detailData.logs || []}
              rowKey="id"
              columns={[
                { title: 'Date',    dataIndex: 'used_at' },
                { title: 'Strokes', dataIndex: 'usage_strokes', align: 'right' },
                { title: 'Machine', dataIndex: ['Machine', 'name'] },
                {
                  title: 'Condition',
                  dataIndex: 'condition_after',
                  render: (v) => <Tag color={conditionColor(v)}>{v}</Tag>,
                },
              ]}
              pagination={false}
            />
          </>
        ) : null}
      </Drawer>
    </AppLayout>
  );
}
