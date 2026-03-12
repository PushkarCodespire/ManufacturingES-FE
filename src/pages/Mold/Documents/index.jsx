import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Form, Select,
  Typography, Row, Col, Statistic, Drawer, Divider,
  message, Descriptions, List, Spin,
} from 'antd';
import {
  ReloadOutlined, FileTextOutlined, PrinterOutlined,
  DownloadOutlined, CheckCircleOutlined, ToolOutlined,
} from '@ant-design/icons';
import { moldDocumentsApi, moldMasterApi } from '../../../api/mold.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;

export default function MoldDocumentsPage() {
  const [molds, setMolds]               = useState([]);
  const [selectedMold, setSelectedMold] = useState(null);
  const [historyCard, setHistoryCard]   = useState(null);
  const [certificate, setCertificate]   = useState(null);
  const [loadingHistory, setLoadingHistory]   = useState(false);
  const [loadingCert, setLoadingCert]         = useState(false);
  const [reportDrawer, setReportDrawer]       = useState(false);
  const [reportData, setReportData]           = useState(null);
  const [loadingReport, setLoadingReport]     = useState(false);
  const [reportForm] = Form.useForm();

  useEffect(() => {
    moldMasterApi.getAll()
      .then((r) => setMolds(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load molds'));
  }, []);

  const loadHistoryCard = async (moldId) => {
    if (!moldId) return;
    setLoadingHistory(true);
    setHistoryCard(null);
    setCertificate(null);
    try {
      const res = await moldDocumentsApi.getHistoryCard(moldId);
      setHistoryCard(res);
    } catch (err) { message.error(err?.message ?? 'Failed to load mold history card'); }
    finally { setLoadingHistory(false); }
  };

  const loadCertificate = async (moldId) => {
    if (!moldId) return;
    setLoadingCert(true);
    try {
      const res = await moldDocumentsApi.getStatusCertificate(moldId);
      setCertificate(res);
    } catch (err) { message.error(err?.message ?? 'Failed to load status certificate'); }
    finally { setLoadingCert(false); }
  };

  const handleMoldSelect = (moldId) => {
    const mold = molds.find((m) => m.id === moldId);
    setSelectedMold(mold || null);
    setHistoryCard(null);
    setCertificate(null);
  };

  const generateReport = async (values) => {
    setLoadingReport(true);
    // Only pass fields the Joi schema allows: report_type, date_from, date_to
    const { report_type, date_from, date_to } = values;
    const params = { report_type };
    if (date_from) params.date_from = date_from;
    if (date_to)   params.date_to   = date_to;
    try {
      const res = await moldDocumentsApi.generateReport(params);
      setReportData(res);
    } catch (err) { message.error(err?.message ?? 'Failed to generate report'); }
    finally { setLoadingReport(false); }
  };

  const printDocument = () => {
    window.print();
  };

  const STATUS_COLOR = {
    registered: 'blue', trial_pending: 'gold', production_ready: 'cyan',
    in_production: 'green', in_storage: 'default', repair_needed: 'orange',
    in_repair: 'orange', end_of_life: 'red', decommissioned: 'default',
  };

  const LIFE_STAGE_COLOR = {
    normal: 'green', plan_replacement: 'blue', urgent_replacement: 'orange',
    critical: 'red', end_of_life: 'red', extended_life: 'purple',
  };

  return (
    <AppLayout>
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><FileTextOutlined /> Mold Documents</Title>
        <Space>
          <Button onClick={() => setReportDrawer(true)}>Fleet Report</Button>
          {selectedMold && (
            <Button icon={<PrinterOutlined />} onClick={printDocument}>Print</Button>
          )}
        </Space>
      </div>

      {/* Mold Selector */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} md={12}>
            <Text strong style={{ marginRight: 12 }}>Select Mold:</Text>
            <Select
              showSearch
              style={{ width: 320 }}
              placeholder="Search by mold code or name..."
              filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
              options={molds.map((m) => ({ value: m.id, label: `${m.mold_code} — ${m.name}` }))}
              onChange={handleMoldSelect}
              allowClear
              onClear={() => { setSelectedMold(null); setHistoryCard(null); setCertificate(null); }}
            />
          </Col>
          {selectedMold && (
            <Col xs={24} md={12}>
              <Space>
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={loadingHistory}
                  onClick={() => loadHistoryCard(selectedMold.id)}
                >
                  History Card
                </Button>
                <Button
                  icon={<CheckCircleOutlined />}
                  loading={loadingCert}
                  onClick={() => loadCertificate(selectedMold.id)}
                >
                  Status Certificate
                </Button>
              </Space>
            </Col>
          )}
        </Row>
      </Card>

      {/* Mold History Card */}
      {loadingHistory && (
        <Card style={{ marginBottom: 24, textAlign: 'center', padding: 40 }}>
          <Spin tip="Generating history card..." />
        </Card>
      )}
      {historyCard && (
        <Card
          title={<><FileTextOutlined /> Mold History Card — {historyCard.mold?.mold_code}</>}
          style={{ marginBottom: 24 }}
          extra={
            <Button size="small" icon={<PrinterOutlined />} onClick={printDocument}>Print</Button>
          }
        >
          <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Mold Code" span={1}>{historyCard.mold?.mold_code}</Descriptions.Item>
            <Descriptions.Item label="Name" span={2}>{historyCard.mold?.name}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[historyCard.mold?.status]}>
                {historyCard.mold?.status?.replace(/_/g, ' ').toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Life Stage">
              <Tag color={LIFE_STAGE_COLOR[historyCard.mold?.life_stage]}>
                {historyCard.mold?.life_stage?.replace(/_/g, ' ').toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Total Shots">
              {Number(historyCard.mold?.current_shot_count || 0).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Manufacturer">{historyCard.mold?.manufacturer || '—'}</Descriptions.Item>
            <Descriptions.Item label="Material">{historyCard.mold?.material || '—'}</Descriptions.Item>
            <Descriptions.Item label="Expected Life">
              {historyCard.mold?.expected_life_shots?.toLocaleString() || '—'} shots
            </Descriptions.Item>
            <Descriptions.Item label="Installation Date">
              {historyCard.mold?.installation_date || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Serial No">{historyCard.mold?.serial_no || '—'}</Descriptions.Item>
            <Descriptions.Item label="Weight">{historyCard.mold?.weight_kg ? `${historyCard.mold.weight_kg} kg` : '—'}</Descriptions.Item>
          </Descriptions>

          {historyCard.repairHistory?.length > 0 && (
            <>
              <Divider orientation="left"><ToolOutlined /> Repair History ({historyCard.repairHistory.length})</Divider>
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={historyCard.repairHistory}
                columns={[
                  { title: 'Date', dataIndex: 'created_at', render: (v) => new Date(v).toLocaleDateString() },
                  { title: 'Type', dataIndex: ['RepairType', 'name'], render: (v) => v || '—' },
                  { title: 'Damage', dataIndex: 'damage_description', ellipsis: true },
                  { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v?.replace(/_/g, ' ')}</Tag> },
                  { title: 'Cost', dataIndex: 'total_cost', render: (v) => v ? `₹${Number(v).toLocaleString()}` : '—' },
                ]}
              />
            </>
          )}

          {historyCard.pmHistory?.length > 0 && (
            <>
              <Divider orientation="left">PM History ({historyCard.pmHistory.length})</Divider>
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={historyCard.pmHistory}
                columns={[
                  { title: 'Date', dataIndex: 'completed_at', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
                  { title: 'Template', dataIndex: ['Template', 'name'], render: (v) => v || '—' },
                  { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                  { title: 'Shots at PM', dataIndex: 'shots_at_schedule', render: (v) => v?.toLocaleString() || '—' },
                ]}
              />
            </>
          )}

          {historyCard.costSummary && (
            <>
              <Divider orientation="left">Cost Summary</Divider>
              {(() => {
                const records   = historyCard.costSummary.records || [];
                const totalCost = historyCard.costSummary.totalCost || 0;
                const pmCost    = records.filter(c => c.cost_type === 'pm').reduce((s, c) => s + parseFloat(c.amount || 0), 0);
                const repCost   = records.filter(c => c.cost_type === 'repair').reduce((s, c) => s + parseFloat(c.amount || 0), 0);
                const shots     = historyCard.mold?.current_shot_count || 0;
                const cps       = shots > 0 ? (totalCost / shots).toFixed(4) : null;
                return (
                  <Row gutter={16}>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic title="Total Cost" value={totalCost} prefix="₹"
                          formatter={(v) => Number(v).toLocaleString()} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic title="PM Cost" value={pmCost} prefix="₹"
                          formatter={(v) => Number(v).toLocaleString()} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic title="Repair Cost" value={repCost} prefix="₹"
                          formatter={(v) => Number(v).toLocaleString()} />
                      </Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small">
                        <Statistic title="Cost / Shot" value={cps ?? '—'} prefix={cps ? '₹' : ''} />
                      </Card>
                    </Col>
                  </Row>
                );
              })()}
            </>
          )}
        </Card>
      )}

      {/* Status Certificate */}
      {loadingCert && (
        <Card style={{ marginBottom: 24, textAlign: 'center', padding: 40 }}>
          <Spin tip="Generating status certificate..." />
        </Card>
      )}
      {certificate && (
        <Card
          title={<><CheckCircleOutlined /> Mold Status Certificate — {certificate.mold?.mold_code}</>}
          style={{ marginBottom: 24 }}
          extra={
            <Button size="small" icon={<PrinterOutlined />} onClick={printDocument}>Print</Button>
          }
        >
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Mold Code">{certificate.mold?.mold_code}</Descriptions.Item>
            <Descriptions.Item label="Mold Name">{certificate.mold?.name}</Descriptions.Item>
            <Descriptions.Item label="Current Status">
              <Tag color={STATUS_COLOR[certificate.mold?.status]}>
                {certificate.mold?.status?.replace(/_/g, ' ').toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Life Stage">
              <Tag color={LIFE_STAGE_COLOR[certificate.mold?.life_stage]}>
                {certificate.mold?.life_stage?.replace(/_/g, ' ').toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Total Shots">
              {Number(certificate.mold?.current_shot_count || 0).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Life Used">
              {certificate.lifePercent ? `${certificate.lifePercent}%` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Last Repair Completed">
              {certificate.lastRepair?.updated_at
                ? new Date(certificate.lastRepair.updated_at).toLocaleDateString() : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Last Inspection">
              {certificate.lastInspection?.inspected_at
                ? new Date(certificate.lastInspection.inspected_at).toLocaleDateString() : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Overall Condition">
              {certificate.lastInspection?.overall_condition
                ? <Tag>{certificate.lastInspection.overall_condition.toUpperCase()}</Tag>
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Certificate Date">
              {certificate.certificateDate
                ? new Date(certificate.certificateDate).toLocaleDateString()
                : new Date().toLocaleDateString()}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Fleet Report Drawer */}
      <Drawer
        title="Generate Fleet Report"
        width={520}
        open={reportDrawer}
        onClose={() => setReportDrawer(false)}
        destroyOnClose
      >
        <Form form={reportForm} layout="vertical" onFinish={generateReport}>
          <Form.Item name="report_type" label="Report Type" initialValue="history_card" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'history_card',        label: 'History Card' },
                { value: 'status_certificate',  label: 'Status Certificate Report' },
                { value: 'customer_report',     label: 'Customer Report' },
                { value: 'cost_summary',        label: 'Cost Summary Report' },
              ]}
            />
          </Form.Item>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" htmlType="submit" loading={loadingReport} icon={<FileTextOutlined />}>
              Generate Report
            </Button>
            <Button onClick={() => setReportDrawer(false)}>Cancel</Button>
          </Space>
        </Form>

        {loadingReport && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="Generating fleet report..." />
          </div>
        )}

        {reportData && (
          <>
            <Divider>Report Results</Divider>
            {(() => {
              const moldList    = reportData.molds || [];
              const inProd      = moldList.filter(m => m.status === 'in_production').length;
              const critical    = moldList.filter(m => m.life_stage === 'critical' || m.life_stage === 'end_of_life').length;
              return (
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic title="Total Molds" value={reportData.total_molds || moldList.length} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic title="In Production" value={inProd} valueStyle={{ color: '#16a34a' }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic title="Critical" value={critical} valueStyle={{ color: '#dc2626' }} />
                    </Card>
                  </Col>
                </Row>
              );
            })()}

            {reportData.molds?.length > 0 && (
              <Table
                size="small"
                dataSource={reportData.molds}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Code', dataIndex: 'mold_code' },
                  { title: 'Name', dataIndex: 'name', ellipsis: true },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    render: (v) => <Tag color={STATUS_COLOR[v]}>{v?.replace(/_/g, ' ')}</Tag>,
                  },
                  {
                    title: 'Life %',
                    key: 'life_pct',
                    render: (_, r) => {
                      const pct = r.ShotSummary?.life_percentage;
                      if (pct != null) return `${Number(pct).toFixed(1)}%`;
                      if (r.expected_life_shots && r.current_shot_count) {
                        return `${((r.current_shot_count / r.expected_life_shots) * 100).toFixed(1)}%`;
                      }
                      return '—';
                    },
                  },
                  {
                    title: 'Shots',
                    dataIndex: 'current_shot_count',
                    render: (v) => v?.toLocaleString() || '0',
                  },
                ]}
              />
            )}

            <Divider />
            <Button icon={<PrinterOutlined />} onClick={printDocument} block>
              Print Report
            </Button>
          </>
        )}
      </Drawer>
    </div>
    </AppLayout>
  );
}
