import React, { useState } from 'react';
import {
  Card, Button, Table, Tag, Space, Typography, Row, Col, Statistic,
  Select, DatePicker, Tooltip, message, Modal, Form, Input, Popover,
  Divider, Badge,
} from 'antd';
import {
  PlayCircleOutlined, RightOutlined, WarningOutlined,
  CheckCircleOutlined, ShoppingCartOutlined, InfoCircleOutlined,
  ReloadOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import api            from '../../../api/axios';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const WO_STATUSES = [
  { value: 'draft',       label: 'Draft'       },
  { value: 'open',        label: 'Open'        },
  { value: 'released',    label: 'Released'    },
  { value: 'in_progress', label: 'In Progress' },
];

export default function MrpPlanningPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-mrp_expected_production-create_plan-create_edit_delete');

  // Filters
  const [statuses,      setStatuses]      = useState(['open', 'released', 'in_progress']);
  const [dateRange,     setDateRange]     = useState(null);

  // Results
  const [running,       setRunning]       = useState(false);
  const [hasRun,        setHasRun]        = useState(false);
  const [requirements,  setRequirements]  = useState([]);
  const [workOrders,    setWorkOrders]    = useState([]);
  const [summary,       setSummary]       = useState(null);

  // PR generation
  const [selectedRows,  setSelectedRows]  = useState([]);
  const [prModalOpen,   setPrModalOpen]   = useState(false);
  const [prSaving,      setPrSaving]      = useState(false);
  const [lastPr,        setLastPr]        = useState(null);
  const [prForm]                          = Form.useForm();

  // ── Run MRP ─────────────────────────────────────────────────────────────────
  const handleRunMrp = async () => {
    setRunning(true);
    setHasRun(false);
    setRequirements([]);
    setSummary(null);
    setSelectedRows([]);
    setLastPr(null);
    try {
      const params = { statuses: statuses.join(',') };
      if (dateRange?.[0]) params.planned_start = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.planned_end   = dateRange[1].format('YYYY-MM-DD');

      const res = await api.get('/mrp/run', { params });
      if (res.success) {
        setRequirements(res.data.requirements || []);
        setWorkOrders(res.data.work_orders    || []);
        setSummary(res.data.summary           || {});
        setHasRun(true);
        if ((res.data.summary?.wo_count || 0) === 0) {
          message.info('No work orders found matching the filters');
        }
      }
    } catch (err) {
      message.error(err?.message || 'MRP run failed');
    } finally {
      setRunning(false);
    }
  };

  // ── Generate PR ─────────────────────────────────────────────────────────────
  const openPrModal = () => {
    if (selectedRows.length === 0) { message.warning('Select at least one shortage item'); return; }
    prForm.resetFields();
    prForm.setFieldsValue({ required_date: dayjs().add(7, 'day') });
    setPrModalOpen(true);
  };

  const handleGeneratePr = async () => {
    try {
      const vals = await prForm.validateFields();
      setPrSaving(true);

      const items = selectedRows.map(row => ({
        item_id:      row.item_id,
        qty_required: row.net_required,
        unit:         row.unit,
        justification: `MRP: ${row.net_required} ${row.unit} required (on hand: ${row.on_hand})`,
      }));

      const payload = {
        items,
        required_date: vals.required_date?.format('YYYY-MM-DD') || null,
        notes:         vals.notes || '',
      };

      const res = await api.post('/mrp/generate-pr', payload);
      if (res.success) {
        setLastPr(res.data);
        message.success(res.message || 'PR created');
        setPrModalOpen(false);
        setSelectedRows([]);
      } else {
        message.error(res.message || 'Failed to create PR');
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed to create PR');
    } finally {
      setPrSaving(false);
    }
  };

  // ── Columns ──────────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Component Item', key: 'item', width: 220,
      render: (_, r) => (
        <div>
          <Text style={{ fontWeight: 500, fontSize: 13 }}>{r.item?.name || `Item #${r.item_id}`}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.item?.code || '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Unit', dataIndex: 'unit', width: 70,
      render: v => <Text type="secondary">{v || 'pcs'}</Text>,
    },
    {
      title: 'Gross Required', dataIndex: 'gross_required', align: 'right', width: 130,
      render: v => <Text>{parseFloat(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}</Text>,
    },
    {
      title: 'On Hand', dataIndex: 'on_hand', align: 'right', width: 110,
      render: v => <Text style={{ color: '#16a34a' }}>{parseFloat(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}</Text>,
    },
    {
      title: 'On Order', dataIndex: 'on_order', align: 'right', width: 110,
      render: v => parseFloat(v) > 0
        ? <Text style={{ color: '#2563eb' }}>{parseFloat(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Net Required', dataIndex: 'net_required', align: 'right', width: 120,
      render: (v, r) => (
        <Text style={{ fontWeight: 600, color: r.status === 'shortage' ? '#dc2626' : '#16a34a' }}>
          {parseFloat(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}
        </Text>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: s => s === 'shortage'
        ? <Tag color="red" icon={<WarningOutlined />}>Shortage</Tag>
        : <Tag color="green" icon={<CheckCircleOutlined />}>Sufficient</Tag>,
    },
    {
      title: 'Driven by', key: 'wo_count', width: 110,
      render: (_, r) => (
        <Popover
          title="Work Orders driving this requirement"
          content={
            <div style={{ maxWidth: 340 }}>
              {r.wo_breakdown?.map((wb, i) => (
                <div key={i} style={{ marginBottom: 6, fontSize: 12 }}>
                  <Text code>{wb.wo_no}</Text>
                  <Text type="secondary"> — {wb.product} ({wb.product_code})</Text>
                  <br />
                  <Text type="secondary">
                    Planned Qty: {wb.planned_qty} × BOM: {wb.bom_qty} = <strong>{wb.contribution}</strong> {r.unit}
                  </Text>
                </div>
              ))}
            </div>
          }
        >
          <Button type="link" size="small" style={{ padding: 0 }}>
            {r.wo_breakdown?.length || 0} WO(s) <InfoCircleOutlined />
          </Button>
        </Popover>
      ),
    },
  ];

  const shortageRows  = requirements.filter(r => r.status === 'shortage');
  const sufficientRows = requirements.filter(r => r.status === 'sufficient');

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>MRP / Net Requirements</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>MRP / Net Requirements</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Explode work order BOMs to calculate material shortages and generate purchase requisitions.
      </Text>

      {/* Filter + Run card */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 16, marginBottom: 16 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={12} align="middle" wrap>
          <Col>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>WO Status</Text>
            <Select
              mode="multiple"
              value={statuses}
              onChange={setStatuses}
              options={WO_STATUSES}
              style={{ minWidth: 280 }}
              placeholder="Select WO statuses to include"
            />
          </Col>
          <Col>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Planned Date Range</Text>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD MMM YYYY"
              style={{ width: 260 }}
              placeholder={['Planned Start', 'Planned End']}
            />
          </Col>
          <Col style={{ marginTop: 20 }}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={running}
              onClick={handleRunMrp}
              size="middle"
            >
              Run MRP
            </Button>
          </Col>
          {hasRun && (
            <Col style={{ marginTop: 20 }}>
              <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('mrp-planning.csv', requirements, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={handleRunMrp} loading={running}>
                Re-run
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* KPI summary */}
      {hasRun && summary && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small" styles={{ body: { padding: '12px 16px' } }}
              style={{ border: '1px solid #e8eaed', borderRadius: 10 }}>
              <Statistic title="Work Orders Analysed" value={summary.wo_count} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" styles={{ body: { padding: '12px 16px' } }}
              style={{ border: '1px solid #e8eaed', borderRadius: 10 }}>
              <Statistic title="Component Items" value={summary.total_items} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" styles={{ body: { padding: '12px 16px' } }}
              style={{ border: '1px solid #e8eaed', borderRadius: 10 }}>
              <Statistic
                title="Shortage Items"
                value={summary.shortage_items}
                valueStyle={{ color: summary.shortage_items > 0 ? '#dc2626' : '#16a34a' }}
                prefix={summary.shortage_items > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" styles={{ body: { padding: '12px 16px' } }}
              style={{ border: '1px solid #e8eaed', borderRadius: 10 }}>
              <Statistic
                title="Sufficient Items"
                value={(summary.total_items || 0) - (summary.shortage_items || 0)}
                valueStyle={{ color: '#16a34a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Last PR generated banner */}
      {lastPr && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircleOutlined style={{ color: '#16a34a' }} />
          <Text style={{ color: '#15803d' }}>
            Purchase Requisition <Text code>{lastPr.pr_no}</Text> created successfully.
            Go to <Text strong>Procurement → Purchase Requisitions</Text> to submit for approval.
          </Text>
        </div>
      )}

      {/* Results table */}
      {hasRun && (
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          styles={{ body: { padding: '16px 20px' } }}
        >
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <Space>
              <Tag color="red">Shortages: {shortageRows.length}</Tag>
              <Tag color="green">Sufficient: {sufficientRows.length}</Tag>
              {selectedRows.length > 0 && (
                <Tag color="blue">{selectedRows.length} selected</Tag>
              )}
            </Space>
            {canWrite && (
              <Button
                type="primary"
                icon={<ShoppingCartOutlined />}
                disabled={selectedRows.length === 0}
                onClick={openPrModal}
              >
                Generate PR ({selectedRows.length})
              </Button>
            )}
          </div>

          <Table
            rowKey="item_id"
            dataSource={requirements}
            columns={columns}
            size="small"
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 30, showSizeChanger: true }}
            rowSelection={canWrite ? {
              selectedRowKeys: selectedRows.map(r => r.item_id),
              onChange: (_, rows) => setSelectedRows(rows),
              getCheckboxProps: (record) => ({
                disabled: record.status !== 'shortage',
              }),
            } : undefined}
            rowClassName={(r) => r.status === 'shortage' ? 'mrp-shortage-row' : ''}
          />
        </Card>
      )}

      {/* Empty state */}
      {hasRun && requirements.length === 0 && (
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, textAlign: 'center', padding: 32 }}>
          <CheckCircleOutlined style={{ fontSize: 40, color: '#16a34a', marginBottom: 8 }} />
          <div>
            <Text strong style={{ display: 'block', fontSize: 15 }}>No component requirements found</Text>
            <Text type="secondary">No active BOMs found for the selected work orders, or all items are sufficiently stocked.</Text>
          </div>
        </Card>
      )}

      {/* PR Modal */}
      <Modal
        title={<><ShoppingCartOutlined /> Generate Purchase Requisition</>}
        open={prModalOpen}
        onCancel={() => setPrModalOpen(false)}
        onOk={handleGeneratePr}
        okText="Create PR"
        confirmLoading={prSaving}
        width={540}
      >
        <Divider style={{ margin: '8px 0 16px' }} />
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            A draft PR will be created with {selectedRows.length} line(s):
          </Text>
          <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto' }}>
            {selectedRows.map(r => (
              <div key={r.item_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                <Text>{r.item?.name} <Text type="secondary">({r.item?.code})</Text></Text>
                <Text strong style={{ color: '#dc2626' }}>{r.net_required} {r.unit}</Text>
              </div>
            ))}
          </div>
        </div>
        <Form form={prForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="required_date" label="Required By Date">
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes for the PR" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
}
