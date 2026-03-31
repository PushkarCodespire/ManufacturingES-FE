import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Table, Tag, Space, Tooltip, Tabs,
  Row, Col, Statistic, Progress, Badge, message, Spin, Empty, Alert,
  Popconfirm,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, WarningOutlined,
  CheckCircleOutlined, FireOutlined, ThunderboltOutlined,
  CalendarOutlined, BarChartOutlined, LeftOutlined,
DownloadOutlined, } from '@ant-design/icons';
import AppLayout from '../../../components/AppLayout';
import { jobCardApi, capacitySchedulerApi } from '../../../api/production.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const TYPE_COLOR = {
  machining: 'blue', assembly: 'green', welding: 'orange',
  inspection: 'purple', painting: 'cyan', other: 'default',
};

function loadColor(pct) {
  if (pct > 100) return '#dc2626';
  if (pct > 80)  return '#d97706';
  if (pct > 50)  return '#2563eb';
  return '#16a34a';
}

const STATUS_COLORS = { draft: '#9ca3af', published: '#1d4ed8', completed: '#16a34a' };

// ── Gantt View Tab ───────────────────────────────────────────────────────────
function GanttViewTab() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const days = 14;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await capacitySchedulerApi.getGantt({ from: startDate, days });
      setData(res?.data ?? res);
    } catch { message.error('Failed to load Gantt data'); }
    finally { setLoading(false); }
  }, [startDate]);

  useEffect(() => { load(); }, [load]);

  const handleAutoSchedule = async () => {
    setScheduling(true);
    try {
      const res = await capacitySchedulerApi.autoSchedule();
      const d = res?.data ?? res;
      message.success(d?.message || `${d?.scheduled || 0} work orders scheduled`);
      load();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Auto-schedule failed');
    } finally { setScheduling(false); }
  };

  const navigateWeek = (dir) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (dir * 7));
    setStartDate(d.toISOString().slice(0, 10));
  };

  const machines = data?.machines || [];
  const schedules = data?.schedules || [];
  const overloads = data?.overloads || [];
  const dates = data?.dates || [];
  const loadMap = data?.load_map || {};
  const shiftCap = data?.shift_capacity_min || 480;

  // Group schedules by machine_id + date
  const schedByMachineDate = {};
  for (const s of schedules) {
    const key = `${s.machine_id}_${s.schedule_date}`;
    if (!schedByMachineDate[key]) schedByMachineDate[key] = [];
    schedByMachineDate[key].push(s);
  }

  const fmtDate = (d) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const fmtDuration = (min) => {
    if (!min) return '-';
    if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
    return `${min}m`;
  };

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button icon={<LeftOutlined />} onClick={() => navigateWeek(-1)} size="small" />
        <Text strong style={{ fontSize: 13 }}>
          {fmtDate(dates[0] || startDate)} — {fmtDate(dates[dates.length - 1] || startDate)}
        </Text>
        <Button icon={<RightOutlined />} onClick={() => navigateWeek(1)} size="small" />
        <div style={{ flex: 1 }} />
        {overloads.length > 0 && (
          <Tag color="red" icon={<WarningOutlined />}>{overloads.length} Overloaded</Tag>
        )}
        <Tag color="blue">Scheduled: {schedules.length}</Tag>
        <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('capacity-planning.csv', data, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        <Popconfirm title="Auto-schedule all unscheduled WOs using Earliest Due Date algorithm?" onConfirm={handleAutoSchedule} okText="Schedule">
          <Button type="primary" icon={<ThunderboltOutlined />} loading={scheduling}>
            Auto-Schedule (EDD)
          </Button>
        </Popconfirm>
      </div>

      {/* Overload alerts */}
      {overloads.length > 0 && (
        <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 16, borderRadius: 8 }}
          message={`${overloads.length} machine-day(s) overloaded`}
          description={overloads.map((o) => `${o.machine_name} on ${o.date} (${o.load_pct}%)`).join(', ')}
        />
      )}

      {/* Gantt Grid */}
      <Spin spinning={loading && !data}>
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: dates.length * 120 + 160 }}>
            <thead>
              <tr style={{ background: '#f4f6f9' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e8eaed', position: 'sticky', left: 0, background: '#f4f6f9', zIndex: 2, minWidth: 140 }}>
                  <Text strong style={{ fontSize: 12 }}>Machine</Text>
                </th>
                {dates.map((d) => (
                  <th key={d} style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #e8eaed', borderLeft: '1px solid #f0f0f0', minWidth: 120 }}>
                    <Text style={{ fontSize: 11, fontWeight: 600 }}>{fmtDate(d)}</Text>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {machines.length === 0 ? (
                <tr><td colSpan={dates.length + 1} style={{ padding: 40, textAlign: 'center' }}>
                  <Empty description="No machines found" />
                </td></tr>
              ) : machines.map((machine) => (
                <tr key={machine.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px', position: 'sticky', left: 0, background: '#fff', zIndex: 1, borderRight: '1px solid #e8eaed' }}>
                    <Text strong style={{ fontSize: 12 }}>{machine.code}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{machine.name}</Text>
                  </td>
                  {dates.map((d) => {
                    const key = `${machine.id}_${d}`;
                    const cellSchedules = schedByMachineDate[key] || [];
                    const totalMin = loadMap[key] || 0;
                    const loadPct = Math.round((totalMin / shiftCap) * 100);
                    const isOverloaded = loadPct > 100;

                    return (
                      <td key={d} style={{
                        padding: '4px 6px', verticalAlign: 'top', borderLeft: '1px solid #f0f0f0',
                        background: isOverloaded ? '#fef2f2' : cellSchedules.length > 0 ? '#f8fafc' : '#fff',
                        minHeight: 50,
                      }}>
                        {cellSchedules.map((s) => {
                          const wo = s.WorkOrder;
                          const item = s.Item;
                          const statusColor = STATUS_COLORS[s.status] || '#9ca3af';
                          return (
                            <Tooltip key={s.id} title={
                              <div style={{ fontSize: 11 }}>
                                <div><strong>{wo?.wo_no || s.schedule_no}</strong></div>
                                <div>{item?.code} — {item?.name}</div>
                                <div>Qty: {s.planned_qty}</div>
                                <div>Duration: {fmtDuration(s.duration_min)}</div>
                                <div>Status: {s.status}</div>
                                {wo?.planned_end && <div>Due: {wo.planned_end}</div>}
                              </div>
                            }>
                              <div style={{
                                background: statusColor,
                                color: '#fff',
                                padding: '3px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                                marginBottom: 3,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {wo?.wo_no || s.schedule_no}
                                <span style={{ opacity: 0.8, marginLeft: 4 }}>{fmtDuration(s.duration_min)}</span>
                              </div>
                            </Tooltip>
                          );
                        })}
                        {totalMin > 0 && (
                          <div style={{ fontSize: 10, color: loadColor(loadPct), fontWeight: 600, textAlign: 'right', marginTop: 2 }}>
                            {loadPct}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Spin>
    </>
  );
}

// ── Load View Tab (existing capacity bars) ───────────────────────────────────
function LoadViewTab() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await jobCardApi.getCapacityPlan();
      const arr = res?.data ?? (Array.isArray(res) ? res : []);
      setData(Array.isArray(arr) ? arr : []);
    } catch { message.error('Failed to load capacity data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const overloaded = data.filter((wc) => wc.overloaded).length;
  const highLoad   = data.filter((wc) => wc.load_pct > 80 && !wc.overloaded).length;
  const healthy    = data.filter((wc) => wc.load_pct <= 80).length;

  const columns = [
    {
      title: 'Work Center', key: 'wc', width: 200,
      render: (_, r) => (
        <div>
          <Text strong>{r.work_center_name}</Text>
          <br /><Tag color={TYPE_COLOR[r.work_center_type] || 'default'} style={{ fontSize: 10 }}>{r.work_center_type}</Tag>
        </div>
      ),
    },
    {
      title: 'Load', key: 'load', width: 280,
      render: (_, r) => (
        <div>
          <Progress
            percent={Math.min(r.load_pct, 100)}
            strokeColor={loadColor(r.load_pct)}
            format={() => `${r.load_pct}%`}
            style={{ marginBottom: 0 }}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.total_load_min} min / {r.shift_capacity_min} min</Text>
        </div>
      ),
    },
    {
      title: 'Jobs', key: 'jobs', width: 60, align: 'center',
      render: (_, r) => <Badge count={r.job_cards?.length || 0} style={{ backgroundColor: '#1d4ed8' }} />,
    },
    {
      title: 'Status', key: 'status', width: 100,
      render: (_, r) => r.overloaded
        ? <Tag color="red" icon={<WarningOutlined />}>Overloaded</Tag>
        : r.load_pct > 80 ? <Tag color="orange" icon={<FireOutlined />}>High</Tag>
        : <Tag color="green" icon={<CheckCircleOutlined />}>OK</Tag>,
    },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}><Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
          <Statistic title="Overloaded" value={overloaded} valueStyle={{ color: '#dc2626', fontSize: 20 }} />
        </Card></Col>
        <Col xs={8}><Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
          <Statistic title="High Load" value={highLoad} valueStyle={{ color: '#d97706', fontSize: 20 }} />
        </Card></Col>
        <Col xs={8}><Card style={{ border: '1px solid #e8eaed', borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
          <Statistic title="Healthy" value={healthy} valueStyle={{ color: '#16a34a', fontSize: 20 }} />
        </Card></Col>
      </Row>

      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        </div>
        <Table rowKey="work_center_id" dataSource={data} columns={columns} size="small"
          loading={loading} pagination={false} scroll={{ x: 600 }}
          expandable={{
            expandedRowRender: (r) => (
              <Table rowKey="job_no" dataSource={r.job_cards || []} size="small" pagination={false}
                columns={[
                  { title: 'Job No', dataIndex: 'job_no', width: 130 },
                  { title: 'WO No', dataIndex: 'wo_no', width: 130 },
                  { title: 'Operation', dataIndex: 'operation_name', width: 160 },
                  { title: 'Remaining', dataIndex: 'remaining_qty', width: 100, align: 'right' },
                  { title: 'Load (min)', dataIndex: 'load_min', width: 100, align: 'right',
                    render: (v) => <Text style={{ fontWeight: 600 }}>{Math.round(v)}</Text> },
                ]}
              />
            ),
          }}
        />
      </Card>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CapacityPlanningPage() {
  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Capacity Planning</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>Capacity Planning</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Gantt-style scheduling with auto-schedule (EDD), overload detection, and work center load analysis.
      </Text>

      <div style={{ marginTop: 16 }}>
        <Tabs
          defaultActiveKey="gantt"
          items={[
            {
              key: 'gantt',
              label: <span><CalendarOutlined style={{ marginRight: 6 }} />Gantt View</span>,
              children: <GanttViewTab />,
            },
            {
              key: 'load',
              label: <span><BarChartOutlined style={{ marginRight: 6 }} />Load View</span>,
              children: <LoadViewTab />,
            },
          ]}
        />
      </div>
    </AppLayout>
  );
}
