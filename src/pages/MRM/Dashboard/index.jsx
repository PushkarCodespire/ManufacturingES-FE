import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Card, Button, Table, Tag, Space, Drawer,
  Form, Select, DatePicker, message, Popconfirm, Tabs, Row, Col,
  Alert, Spin, Badge, List, Descriptions, Modal, Radio, Collapse, Input,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, RightOutlined,
  BulbOutlined, CheckCircleOutlined, PlayCircleOutlined,
  FileDoneOutlined, AuditOutlined, TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { mrmApi }    from '../../../api/mrm.api';

const { Title, Text } = Typography;
const { TextArea }    = Input;
const { Panel }       = Collapse;

const STATUS_COLOR = {
  scheduled:       'default',
  in_progress:     'blue',
  minutes_drafted: 'orange',
  signed:          'green',
};

const currentQ = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}-${new Date().getFullYear()}`;
const QUARTERS = ['Q1','Q2','Q3','Q4'].flatMap((q) =>
  [2025, 2026, 2027].map((y) => ({ value: `${q}-${y}`, label: `${q} ${y}` }))
);

const CATEGORY_OPTS = [
  { value: 'quality',     label: 'Quality Trends'       },
  { value: 'delivery',    label: 'Delivery Performance'  },
  { value: 'audit',       label: 'Audit & Findings'     },
  { value: 'capa',        label: 'CAPA Status'          },
  { value: 'supplier',    label: 'Supplier Performance'  },
  { value: 'complaints',  label: 'Customer Complaints'  },
  { value: 'training',    label: 'Training'             },
  { value: 'copq',        label: 'COPQ'                 },
  { value: 'calibration', label: 'Calibration'          },
  { value: 'general',     label: 'General'              },
];

const MCQ_OPTS = [
  { value: 'satisfactory',      label: '✅ Satisfactory'      },
  { value: 'needs_improvement', label: '⚠️ Needs Improvement' },
  { value: 'critical',          label: '🔴 Critical'          },
  { value: 'na',                label: '— N/A'                },
];

const parseInsight = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object' && !raw.raw_text) return raw;
  const text = raw.raw_text ?? raw;
  if (typeof text !== 'string') return raw;
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  try { return JSON.parse(text.trim()); } catch {}
  return null;
};

export default function MRMDashboard() {
  const { can }  = usePermissions();
  const canWrite = can('management-mrm-create_edit_delete');

  const [meetings,      setMeetings]      = useState([]);
  const [mlLoading,     setMlLoading]     = useState(false);
  const [createOpen,    setCreateOpen]    = useState(false);
  const [detailRow,     setDetailRow]     = useState(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [createForm]                      = Form.useForm();
  const [captureOpen,   setCaptureOpen]   = useState(false);
  const [captureSaving, setCaptureSaving] = useState(false);
  const [captureForm]                     = Form.useForm();
  const [isRecording,   setIsRecording]   = useState(false);
  const [transcript,    setTranscript]    = useState('');
  const recognitionRef                    = React.useRef(null);
  const [actionOpen,    setActionOpen]    = useState(false);
  const [actionSaving,  setActionSaving]  = useState(false);
  const [actionForm]                      = Form.useForm();
  const [allActions,    setAllActions]    = useState([]);
  const [actLoading,    setActLoading]    = useState(false);
  const [quarter,       setQuarter]       = useState(currentQ);
  const [compiling,     setCompiling]     = useState(false);
  const [compiled,      setCompiled]      = useState(null);
  const [activeTab,     setActiveTab]     = useState('meetings');

  const loadMeetings = useCallback(async () => {
    setMlLoading(true);
    try {
      const data = await mrmApi.getAll();
      setMeetings(Array.isArray(data) ? data : []);
    } catch { message.error('Failed to load meetings'); }
    finally  { setMlLoading(false); }
  }, []);

  const loadActions = useCallback(async () => {
    setActLoading(true);
    try {
      const data = await mrmApi.getAllActions({ status: 'open' });
      setAllActions(Array.isArray(data) ? data : []);
    } catch { message.error('Failed to load actions'); }
    finally  { setActLoading(false); }
  }, []);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);
  useEffect(() => { if (activeTab === 'actions') loadActions(); }, [activeTab, loadActions]);

  const openDetail = async (row) => {
    try {
      const full = await mrmApi.getById(row.id);
      setDetailRow(full);
      setDetailOpen(true);
    } catch { message.error('Failed to load meeting'); }
  };

  const reloadDetail = async () => {
    if (!detailRow) return;
    try { const full = await mrmApi.getById(detailRow.id); setDetailRow(full); } catch {}
  };

  const onCreate = async () => {
    try {
      const vals = await createForm.validateFields();
      setSaving(true);
      await mrmApi.create({ ...vals, meeting_date: vals.meeting_date?.format('YYYY-MM-DD') });
      message.success('MRM meeting scheduled');
      setCreateOpen(false);
      createForm.resetFields();
      loadMeetings();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Create failed');
    } finally { setSaving(false); }
  };

  const onStart = async () => {
    try { await mrmApi.startMeeting(detailRow.id); message.success('Meeting started'); reloadDetail(); loadMeetings(); }
    catch (err) { message.error(err?.message || 'Failed'); }
  };

  const onDraft = async () => {
    try { await mrmApi.draftMinutes(detailRow.id); message.success('Minutes drafted'); reloadDetail(); loadMeetings(); }
    catch (err) { message.error(err?.message || 'Failed'); }
  };

  const onSign = async () => {
    try { await mrmApi.sign(detailRow.id); message.success('MRM signed and closed'); reloadDetail(); loadMeetings(); }
    catch (err) { message.error(err?.message || 'Failed'); }
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { message.warning('Voice recognition not supported in this browser'); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-IN';
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
      setTranscript(t.trim());
      captureForm.setFieldValue('voice_transcript', t.trim());
    };
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  };

  const stopVoice = () => { recognitionRef.current?.stop(); setIsRecording(false); };

  const onCapture = async () => {
    try {
      const vals = await captureForm.validateFields();
      setCaptureSaving(true);
      await mrmApi.captureMinute(detailRow.id, vals);
      message.success('Minute captured');
      setCaptureOpen(false);
      captureForm.resetFields();
      setTranscript('');
      reloadDetail();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Capture failed');
    } finally { setCaptureSaving(false); }
  };

  const onAddAction = async () => {
    try {
      const vals = await actionForm.validateFields();
      setActionSaving(true);
      await mrmApi.addAction(detailRow.id, { ...vals, target_date: vals.target_date?.format('YYYY-MM-DD') });
      message.success('Action item added');
      setActionOpen(false);
      actionForm.resetFields();
      reloadDetail();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Failed');
    } finally { setActionSaving(false); }
  };

  const onCompile = async () => {
    setCompiling(true);
    try { const data = await mrmApi.compile(quarter); setCompiled(data); }
    catch { message.error('Compilation failed'); }
    finally { setCompiling(false); }
  };

  const meetingCols = [
    { title: 'Meeting No.', dataIndex: 'meeting_no', key: 'no', width: 150 },
    { title: 'Quarter',     dataIndex: 'quarter',    key: 'q',  width: 90  },
    { title: 'Date',        dataIndex: 'meeting_date', key: 'date', width: 120 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 140,
      render: (v) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v?.replace(/_/g,' ')}</Tag> },
    { title: 'Open Actions', key: 'acts', width: 110,
      render: (_, r) => {
        const open = (r.Actions ?? []).filter((a) => a.status === 'open').length;
        return open > 0 ? <Badge count={open}><Tag>Actions</Tag></Badge> : <Tag color="green">None</Tag>;
      },
    },
    { title: '', key: 'open', width: 80,
      render: (_, r) => <Button size="small" type="primary" ghost onClick={() => openDetail(r)}>Open</Button> },
  ];

  const actionCols = [
    { title: 'Meeting', key: 'meeting', width: 130, render: (_, r) => r.Meeting?.meeting_no ?? '—' },
    { title: 'Action', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Assigned To', key: 'a', width: 130, render: (_, r) => r.AssignedTo?.name ?? 'Unassigned' },
    { title: 'Target Date', dataIndex: 'target_date', key: 'td', width: 110, render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', key: 's', width: 90,
      render: (v) => <Tag color={v==='completed'?'green':v==='overdue'?'red':'orange'}>{v}</Tag> },
    ...(canWrite ? [{
      title: '', key: 'complete', width: 100,
      render: (_, r) => r.status !== 'completed' ? (
        <Popconfirm title="Mark as completed?" onConfirm={() =>
          mrmApi.updateAction(r.id, { status: 'completed' }).then(() => { message.success('Done'); loadActions(); })
        }>
          <Button size="small" icon={<CheckCircleOutlined />}>Complete</Button>
        </Popconfirm>
      ) : null,
    }] : []),
  ];

  const renderDetail = () => {
    if (!detailRow) return null;
    const minutes = detailRow.Minutes ?? [];
    const actions = detailRow.Actions ?? [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card bodyStyle={{ padding: '12px 16px' }} style={{ border: '1px solid #e8eaed', borderRadius: 10 }}>
          <Descriptions size="small" column={3} bordered>
            <Descriptions.Item label="Meeting No.">{detailRow.meeting_no}</Descriptions.Item>
            <Descriptions.Item label="Quarter">{detailRow.quarter}</Descriptions.Item>
            <Descriptions.Item label="Date">{detailRow.meeting_date}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[detailRow.status] ?? 'default'}>{detailRow.status?.replace(/_/g,' ')}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Minutes">{minutes.length} captured</Descriptions.Item>
            <Descriptions.Item label="Open Actions">{actions.filter(a=>a.status==='open').length}</Descriptions.Item>
          </Descriptions>
          <Space style={{ marginTop: 12 }}>
            {canWrite && detailRow.status === 'scheduled' && (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={onStart}>Start Meeting</Button>
            )}
            {canWrite && detailRow.status === 'in_progress' && (<>
              <Button icon={<PlusOutlined />} onClick={() => { captureForm.resetFields(); setTranscript(''); setCaptureOpen(true); }}>
                Capture Minute
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => { actionForm.resetFields(); setActionOpen(true); }}>
                Add Action
              </Button>
              <Button type="primary" ghost icon={<FileDoneOutlined />} onClick={onDraft}>Draft Minutes</Button>
            </>)}
            {canWrite && detailRow.status === 'minutes_drafted' && (
              <Popconfirm title="Sign and close this MRM?" onConfirm={onSign} okText="Sign">
                <Button type="primary" icon={<CheckCircleOutlined />}>Sign & Close</Button>
              </Popconfirm>
            )}
          </Space>
        </Card>

        <Title level={5} style={{ margin: 0 }}>Minutes ({minutes.length})</Title>
        {minutes.length === 0
          ? <Alert type="info" showIcon message="No minutes captured yet." />
          : (
            <Collapse>
              {minutes.map((m, idx) => (
                <Panel key={m.id} header={
                  <Space>
                    <Text strong>{idx+1}. {m.agenda_item}</Text>
                    {m.category && <Tag style={{fontSize:11}}>{m.category}</Tag>}
                    {m.mcq_response && <Tag color={m.mcq_response==='satisfactory'?'green':m.mcq_response==='critical'?'red':'orange'} style={{fontSize:11}}>{MCQ_OPTS.find(o=>o.value===m.mcq_response)?.label ?? m.mcq_response}</Tag>}
                    {m.action_required && <Tag color="volcano" style={{fontSize:11}}>Action Required</Tag>}
                  </Space>
                }>
                  {m.discussion_summary && <><Text strong>Discussion: </Text><Text>{m.discussion_summary}</Text><br/></>}
                  {m.decision && <><Text strong>Decision: </Text><Text>{m.decision}</Text><br/></>}
                  {m.voice_transcript && (
                    <div style={{ marginTop:8, padding:'8px 12px', background:'#f8fafc', borderRadius:6, fontSize:12, color:'#374151' }}>
                      <Text type="secondary" style={{fontSize:11}}>Voice transcript:</Text><br/>{m.voice_transcript}
                    </div>
                  )}
                </Panel>
              ))}
            </Collapse>
          )
        }

        {actions.length > 0 && (<>
          <Title level={5} style={{ margin: 0 }}>Action Items ({actions.length})</Title>
          <Table rowKey="id" size="small" dataSource={actions} pagination={false} columns={[
            { title: 'Action', dataIndex: 'title', key: 'title', ellipsis: true },
            { title: 'Assigned To', key: 'a', width: 130, render: (_, r) => r.AssignedTo?.name ?? 'Unassigned' },
            { title: 'Target', dataIndex: 'target_date', key: 'td', width: 100 },
            { title: 'Status', dataIndex: 'status', key: 's', width: 90,
              render: (v) => <Tag color={v==='completed'?'green':v==='overdue'?'red':'orange'}>{v}</Tag> },
          ]} />
        </>)}
      </div>
    );
  };

  const renderCompile = () => {
    const src = compiled?.compiled?.sources;
    const insight = compiled ? parseInsight(compiled.ai_insight) : null;
    const RISK_COLOR = { low: 'green', medium: 'orange', high: 'red', critical: 'red' };
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <Card bodyStyle={{ padding:'12px 16px' }} style={{ border:'1px solid #e8eaed', borderRadius:10 }}>
          <Space>
            <Select value={quarter} onChange={setQuarter} options={QUARTERS} style={{ width:150 }} />
            <Button type="primary" icon={<BulbOutlined />} loading={compiling} onClick={onCompile}>
              Compile & Generate Agenda
            </Button>
          </Space>
        </Card>

        {compiling && <div style={{textAlign:'center',padding:40}}><Spin size="large" tip="Compiling data sources and generating AI agenda..." /></div>}

        {src && (
          <>
            <Row gutter={12}>
              {[
                { label:'NCR',            val:`${src.ncr.total} (${src.ncr.open} open)`,                                          color: src.ncr.open>5?'#ef4444':'#1d4ed8' },
                { label:'Complaints',     val:`${src.complaints.total} (${src.complaints.open} open)`,                             color: src.complaints.open>3?'#ef4444':'#1d4ed8' },
                { label:'Audit Findings', val:`${src.audit_findings.total} (${src.audit_findings.major_nc} Major NC)`,             color: src.audit_findings.major_nc>0?'#ef4444':'#16a34a' },
                { label:'CAPA',           val:`${src.capa.total} total — ${src.capa.closure_rate}% closed`,                       color: src.capa.closure_rate<70?'#d97706':'#16a34a' },
                { label:'Calibration',    val:`${src.calibration.fail} failures, ${src.calibration.overdue_instruments} overdue`,  color: src.calibration.overdue_instruments>0?'#ef4444':'#16a34a' },
                { label:'Training',       val:`${src.training.completed}/${src.training.total} completed`,                         color:'#1d4ed8' },
                { label:'COPQ',           val:`₹${(src.copq.total_amount||0).toLocaleString('en-IN')}`,                           color:'#7c3aed' },
              ].map((item) => (
                <Col key={item.label} span={6} style={{ marginBottom:12 }}>
                  <Card size="small" style={{ borderRadius:8, border:'1px solid #e8eaed' }} bodyStyle={{ padding:'10px 14px' }}>
                    <Text style={{ fontSize:11, color:'#9ca3af', display:'block' }}>{item.label}</Text>
                    <Text style={{ fontSize:13, fontWeight:600, color:item.color }}>{item.val}</Text>
                  </Card>
                </Col>
              ))}
            </Row>

            {insight && (
              <Card bodyStyle={{ padding:'16px 20px' }} style={{ border:'1px solid #dbeafe', borderRadius:12, background:'#f0f9ff' }}>
                <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
                  <Text strong>AI-Generated MRM Agenda — {quarter}</Text>
                  {insight.risk_level && <Tag color={RISK_COLOR[insight.risk_level]??'default'}>Risk: {insight.risk_level?.toUpperCase()}</Tag>}
                  {insight.confidence && <Tag color="purple">Confidence: {insight.confidence}</Tag>}
                </div>
                {insight.key_highlights?.length > 0 && (
                  <Alert type="info" showIcon style={{ marginBottom:12 }}
                    message={<ul style={{margin:0,paddingLeft:18}}>{insight.key_highlights.map((h,i)=><li key={i}>{h}</li>)}</ul>} />
                )}
                {insight.critical_concerns?.length > 0 && (
                  <Alert type="error" showIcon style={{ marginBottom:12 }}
                    message={<><Text strong>Critical Concerns:</Text><ul style={{margin:0,paddingLeft:18}}>{insight.critical_concerns.map((c,i)=><li key={i}>{c}</li>)}</ul></>} />
                )}
                {insight.agenda_items?.length > 0 && (
                  <List size="small" header={<Text strong>Agenda Items ({insight.agenda_items.length})</Text>}
                    dataSource={insight.agenda_items}
                    renderItem={(item) => (
                      <List.Item>
                        <Space direction="vertical" style={{ width:'100%' }} size={2}>
                          <Space>
                            <Tag>{item.order}</Tag>
                            <Text strong>{item.topic}</Text>
                            <Tag color={item.priority==='high'?'red':item.priority==='medium'?'orange':'default'}>{item.priority}</Tag>
                            {item.category && <Tag color="blue" style={{fontSize:11}}>{item.category}</Tag>}
                          </Space>
                          {item.discussion_points?.length > 0 && (
                            <ul style={{ margin:'2px 0 0 24px', padding:0, fontSize:12, color:'#6b7280' }}>
                              {item.discussion_points.map((p,i)=><li key={i}>{p}</li>)}
                            </ul>
                          )}
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
                {insight.recommended_decisions?.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <Text strong style={{ fontSize:12 }}>Recommended Decisions:</Text>
                    <ul style={{ margin:'4px 0 0 16px', fontSize:12, color:'#166534' }}>
                      {insight.recommended_decisions.map((d,i)=><li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}
              </Card>
            )}
            {compiled?.ai_error && <Alert type="warning" showIcon message={`AI unavailable: ${compiled.ai_error}`} />}
          </>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
        <Text style={{ color:'#9ca3af', fontSize:12 }}>Management</Text>
        <RightOutlined style={{ color:'#d1d5db', fontSize:10 }} />
        <Text style={{ color:'#6b7280', fontSize:12 }}>MRM</Text>
      </div>
      <Title level={3} style={{ margin:0 }}>Management Review Meeting</Title>
      <Text type="secondary" style={{ fontSize:13 }}>
        Auto-compile 12 data sources, capture minutes with voice, and track action items.
      </Text>

      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginTop:12 }} items={[
        {
          key: 'meetings',
          label: <span><TeamOutlined /> Meetings</span>,
          children: (
            <div style={{ paddingTop:8 }}>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                <Tag color="blue">Total: {meetings.length}</Tag>
                <Tag color="blue">In Progress: {meetings.filter(m=>m.status==='in_progress').length}</Tag>
                <Tag color="green">Signed: {meetings.filter(m=>m.status==='signed').length}</Tag>
                <div style={{ flex:1 }} />
                <Button icon={<ReloadOutlined />} onClick={loadMeetings}>Refresh</Button>
                {canWrite && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>
                    Schedule MRM
                  </Button>
                )}
              </div>
              <Card style={{ border:'1px solid #e8eaed', borderRadius:12, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding:'16px 20px' }}>
                <Table rowKey="id" dataSource={meetings} columns={meetingCols} loading={mlLoading} size="small" pagination={{ pageSize:15 }} />
              </Card>
            </div>
          ),
        },
        {
          key: 'compile',
          label: <span><BulbOutlined /> Compile Data</span>,
          children: <div style={{ paddingTop:8 }}>{renderCompile()}</div>,
        },
        {
          key: 'actions',
          label: <span><AuditOutlined /> Action Tracker</span>,
          children: (
            <div style={{ paddingTop:8 }}>
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
                <Button icon={<ReloadOutlined />} onClick={loadActions}>Refresh</Button>
              </div>
              <Card style={{ border:'1px solid #e8eaed', borderRadius:12 }} bodyStyle={{ padding:'16px 20px' }}>
                <Table rowKey="id" dataSource={allActions} columns={actionCols} loading={actLoading} size="small" pagination={{ pageSize:20 }} />
              </Card>
            </div>
          ),
        },
      ]} />

      {/* Create Drawer */}
      <Drawer title="Schedule MRM" width={420} open={createOpen} onClose={() => setCreateOpen(false)}
        footer={<div style={{display:'flex',justifyContent:'flex-end',gap:8}}><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="primary" loading={saving} onClick={onCreate}>Schedule</Button></div>}>
        <Form form={createForm} layout="vertical" requiredMark={false}>
          <Form.Item name="quarter" label="Quarter" rules={[{ required:true }]}>
            <Select options={QUARTERS} placeholder="Select quarter" />
          </Form.Item>
          <Form.Item name="meeting_date" label="Meeting Date" rules={[{ required:true }]}>
            <DatePicker style={{ width:'100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Scope, objectives, venue..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer title={detailRow ? `${detailRow.meeting_no} — ${detailRow.quarter}` : 'Meeting Detail'}
        width={860} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {renderDetail()}
      </Drawer>

      {/* Capture Minute Modal */}
      <Modal title="Capture Meeting Minute" open={captureOpen}
        onCancel={() => { stopVoice(); setCaptureOpen(false); }}
        onOk={onCapture} confirmLoading={captureSaving} okText="Save Minute" width={620}>
        <Form form={captureForm} layout="vertical" requiredMark={false} style={{ marginTop:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Form.Item name="agenda_item" label="Agenda Item" rules={[{ required:true }]}>
              <Input placeholder="e.g. CAPA Status Review" />
            </Form.Item>
            <Form.Item name="category" label="Category" initialValue="general">
              <Select options={CATEGORY_OPTS} />
            </Form.Item>
          </div>
          <Form.Item name="mcq_response" label="Quick Status (MCQ)">
            <Radio.Group>
              {MCQ_OPTS.map(o => <Radio.Button key={o.value} value={o.value}>{o.label}</Radio.Button>)}
            </Radio.Group>
          </Form.Item>
          <Form.Item name="discussion_summary" label="Discussion Summary">
            <TextArea rows={2} placeholder="Key points discussed..." />
          </Form.Item>
          <Form.Item name="decision" label="Decision / Outcome">
            <TextArea rows={2} placeholder="What was decided..." />
          </Form.Item>
          <Form.Item name="voice_transcript" label="Voice Recording">
            <div>
              <Space style={{ marginBottom:8 }}>
                {!isRecording
                  ? <Button icon={<PlayCircleOutlined />} onClick={startVoice} style={{ borderColor:'#16a34a', color:'#16a34a' }}>Start Recording</Button>
                  : <Button danger onClick={stopVoice}>Stop Recording</Button>
                }
                {isRecording && <Badge status="processing" text="Recording..." />}
              </Space>
              <TextArea rows={3} value={transcript}
                onChange={(e) => { setTranscript(e.target.value); captureForm.setFieldValue('voice_transcript', e.target.value); }}
                placeholder="Voice transcript will appear here, or type manually..." />
            </div>
          </Form.Item>
          <Form.Item name="action_required" label="Action Required?" initialValue={false}>
            <Select options={[{ value:false, label:'No' }, { value:true, label:'Yes' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Action Modal */}
      <Modal title="Add Action Item" open={actionOpen} onCancel={() => setActionOpen(false)}
        onOk={onAddAction} confirmLoading={actionSaving} okText="Add Action">
        <Form form={actionForm} layout="vertical" requiredMark={false} style={{ marginTop:16 }}>
          <Form.Item name="title" label="Action Title" rules={[{ required:true }]}>
            <Input placeholder="e.g. Close all pending CAPAs by Q2" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Details of the action required..." />
          </Form.Item>
          <Form.Item name="target_date" label="Target Date">
            <DatePicker style={{ width:'100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
}
