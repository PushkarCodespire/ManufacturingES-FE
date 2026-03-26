import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Row, Col, Typography, DatePicker, Button, Table, Tag,
  Statistic, Divider, Space, message, Spin, Empty,
} from 'antd';
import {
  PrinterOutlined, ReloadOutlined, RightOutlined, CalendarOutlined,
  CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import api       from '../../../api/axios';

const { Title, Text } = Typography;

function fmtTime(dt) {
  if (!dt) return '—';
  return dayjs(dt).format('HH:mm');
}

function fmtNum(v) {
  return parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function DPRPage() {
  const [date,    setDate]    = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [dpr,     setDpr]     = useState(null);
  const printRef = useRef();

  const load = useCallback(async (d = date) => {
    setLoading(true);
    try {
      const res = await api.get(`/production-analytics/dpr?date=${d.format('YYYY-MM-DD')}`);
      setDpr(res.data || null);
    } catch {
      message.error('Failed to load DPR data');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>DPR – ${date.format('DD-MM-YYYY')}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .summary-box { border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; }
        .summary-box .label { font-size: 10px; color: #666; text-transform: uppercase; }
        .summary-box .value { font-size: 22px; font-weight: 700; margin-top: 2px; }
        @media print { @page { size: A4 landscape; margin: 15mm; } }
      </style></head>
      <body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // ── Job card columns ───────────────────────────────────────────────────────
  const jobCols = [
    { title: 'Job No.',     dataIndex: 'job_no',          key: 'job',      width: 100 },
    { title: 'WO No.',      dataIndex: 'wo_no',           key: 'wo',       width: 110 },
    { title: 'Item',        dataIndex: 'item_name',       key: 'item',     ellipsis: true,
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 12 }}>{v}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.item_code}</Text>
        </div>
      ),
    },
    { title: 'Machine',     dataIndex: 'machine',         key: 'machine',  width: 110, ellipsis: true },
    { title: 'Operator',    dataIndex: 'operator',        key: 'operator', width: 120, ellipsis: true },
    { title: 'Start',       dataIndex: 'start_time',      key: 'start',    width: 70, render: fmtTime },
    { title: 'End',         dataIndex: 'end_time',        key: 'end',      width: 70, render: fmtTime },
    { title: 'Produced',    dataIndex: 'qty_produced',    key: 'prod',     width: 80, align: 'right',
      render: (v) => <strong>{fmtNum(v)}</strong> },
    { title: 'Rejected',    dataIndex: 'qty_rejected',    key: 'rej',      width: 80, align: 'right',
      render: (v) => <span style={{ color: v > 0 ? '#dc2626' : '#111' }}>{fmtNum(v)}</span> },
    { title: 'Cycle (s)',   dataIndex: 'cycle_time_actual', key: 'ct',     width: 80, align: 'right',
      render: (v) => v > 0 ? fmtNum(v) : '—' },
  ];

  // ── Machine summary columns ────────────────────────────────────────────────
  const machineSumCols = [
    { title: 'Machine',    dataIndex: 'machine',      key: 'machine', ellipsis: true },
    { title: 'Jobs Run',   dataIndex: 'jobs',         key: 'jobs',    width: 80, align: 'center' },
    { title: 'Produced',   dataIndex: 'qty_produced', key: 'prod',    width: 90, align: 'right', render: fmtNum },
    { title: 'Rejected',   dataIndex: 'qty_rejected', key: 'rej',     width: 90, align: 'right',
      render: (v) => <span style={{ color: v > 0 ? '#dc2626' : 'inherit' }}>{fmtNum(v)}</span> },
    { title: 'Rej %', key: 'rpct', width: 80, align: 'center',
      render: (_, r) => {
        const pct = r.qty_produced > 0 ? ((r.qty_rejected / r.qty_produced) * 100).toFixed(1) : 0;
        return <Tag color={pct > 5 ? 'red' : pct > 2 ? 'orange' : 'green'}>{pct}%</Tag>;
      },
    },
  ];

  // ── Item summary columns ───────────────────────────────────────────────────
  const itemSumCols = [
    { title: 'Item',      dataIndex: 'item_name',    key: 'name',  ellipsis: true,
      render: (v, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.item_code}</Text>
        </div>
      ),
    },
    { title: 'Produced',  dataIndex: 'qty_produced', key: 'prod',  width: 90, align: 'right',
      render: (v) => <strong>{fmtNum(v)}</strong> },
    { title: 'Rejected',  dataIndex: 'qty_rejected', key: 'rej',   width: 90, align: 'right',
      render: (v) => <span style={{ color: v > 0 ? '#dc2626' : 'inherit' }}>{fmtNum(v)}</span> },
  ];

  const isToday = date.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');

  return (
    <AppLayout>
      <div style={{ padding: '0 0 24px' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Daily Production Report</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <Title level={3} style={{ margin: 0 }}>Daily Production Report</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Auto-generated from closed Job Cards. Select a date to view production activity.
            </Text>
          </div>
          <Space wrap>
            <DatePicker
              value={date}
              disabledDate={(d) => d && d.isAfter(dayjs(), 'day')}
              onChange={(d) => { if (d) { setDate(d); load(d); } }}
              format="DD-MM-YYYY"
              suffixIcon={<CalendarOutlined />}
              allowClear={false}
            />
            <Button icon={<ReloadOutlined />} onClick={() => load()}>Refresh</Button>
            {dpr?.total_jobs > 0 && (
              <Button icon={<PrinterOutlined />} type="primary" onClick={handlePrint}>
                Print / Export
              </Button>
            )}
          </Space>
        </div>

        <Spin spinning={loading}>
          {!dpr || dpr.total_jobs === 0 ? (
            <Card style={{ borderRadius: 12, textAlign: 'center', padding: 32 }}>
              <Empty description={`No production activity found for ${date.format('DD MMM YYYY')}`} />
            </Card>
          ) : (
            <div ref={printRef}>
              {/* Print header (visible in print only via CSS) */}
              <div style={{ marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>
                  Daily Production Report — {date.format('DD MMMM YYYY')}
                  {isToday && <Tag color="blue" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Today</Tag>}
                </Title>
              </div>

              {/* ── Summary tiles ── */}
              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                {[
                  { label: 'Job Cards Closed', value: dpr.total_jobs,          color: '#1d4ed8' },
                  { label: 'Total Produced',   value: fmtNum(dpr.total_produced), color: '#16a34a', suffix: ' pcs' },
                  { label: 'Total Rejected',   value: fmtNum(dpr.total_rejected), color: '#dc2626', suffix: ' pcs' },
                  { label: 'Rejection Rate',   value: `${dpr.rejection_pct}%`,    color: dpr.rejection_pct > 5 ? '#dc2626' : '#ca8a04' },
                ].map((t) => (
                  <Col xs={12} sm={6} key={t.label}>
                    <Card size="small"
                      style={{ borderTop: `3px solid ${t.color}`, borderRadius: 10,
                               boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                      bodyStyle={{ padding: '12px 14px' }}
                    >
                      <Text style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600,
                                     textTransform: 'uppercase', display: 'block' }}>
                        {t.label}
                      </Text>
                      <div style={{ fontSize: 24, fontWeight: 700, color: t.color, marginTop: 4 }}>
                        {t.value}
                        {t.suffix && <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>{t.suffix}</span>}
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              {/* ── Machine Summary ── */}
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={12}>
                  <Card title="Machine-wise Summary"
                    style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                    bodyStyle={{ padding: 0 }}
                  >
                    <Table
                      dataSource={dpr.by_machine}
                      columns={machineSumCols}
                      rowKey="machine"
                      size="small"
                      pagination={false}
                      scroll={{ x: 380 }}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Item-wise Summary"
                    style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                    bodyStyle={{ padding: 0 }}
                  >
                    <Table
                      dataSource={dpr.by_item}
                      columns={itemSumCols}
                      rowKey="item_code"
                      size="small"
                      pagination={false}
                      scroll={{ x: 340 }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* ── Job Card Detail ── */}
              <Card
                title={`Job Card Detail (${dpr.job_rows.length} jobs)`}
                style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                bodyStyle={{ padding: 0 }}
              >
                <Table
                  dataSource={dpr.job_rows}
                  columns={jobCols}
                  rowKey="job_no"
                  size="small"
                  pagination={{ pageSize: 20, size: 'small' }}
                  scroll={{ x: 860 }}
                />
              </Card>
            </div>
          )}
        </Spin>
      </div>
    </AppLayout>
  );
}
