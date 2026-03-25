import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Row, Col, Statistic, Drawer, Descriptions, Divider,
  message, Tree, Tabs, InputNumber, Progress, Tooltip, Alert, Spin, List,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ToolOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, ApartmentOutlined, FileTextOutlined, EditOutlined,
  BulbOutlined, AlertOutlined, ClockCircleOutlined, SyncOutlined, SearchOutlined,
} from '@ant-design/icons';
import { equipmentApi, maintenanceAiApi } from '../../../api/maintenance.api';
import AppLayout from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLOR = {
  operational: 'green', under_maintenance: 'orange',
  breakdown: 'red', decommissioned: 'default',
};
const CRITICALITY_COLOR = { A: 'red', B: 'orange', C: 'blue' };
const LEVEL_COLOR = {
  plant: 'purple', line: 'cyan', machine: 'blue',
  sub_assembly: 'geekblue', component: 'default',
};

export default function EquipmentPage() {
  const [equipment, setEquipment]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState('list');
  const [treeData, setTreeData]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [createModal, setCreateModal]   = useState(false);
  const [editModal, setEditModal]       = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [critSuggesting, setCritSuggesting] = useState(false);
  const [critSuggestion, setCritSuggestion] = useState(null); // { suggested_criticality, reasons[] }
  // MNT-003: Failure Pattern Detection
  const [fpPatterns, setFpPatterns]           = useState(null);   // null = not loaded yet
  const [fpLoading, setFpLoading]             = useState(false);
  const [fpEquipFilter, setFpEquipFilter]     = useState(null);   // null = all equipment
  // MNT-003 per-equipment (detail drawer)
  const [drawerFp, setDrawerFp]               = useState(null);
  const [drawerFpLoading, setDrawerFpLoading] = useState(false);

  // ── MNT-003: Failure Pattern Detection ───────────────────────────────────
  const loadFailurePatterns = useCallback(async (equipId) => {
    setFpLoading(true);
    try {
      const res = await maintenanceAiApi.getFailurePatterns(equipId || undefined);
      setFpPatterns(Array.isArray(res) ? res : (res?.data ?? res ?? []));
    } catch (err) { message.error(err?.message || 'Failed to load failure patterns'); }
    finally { setFpLoading(false); }
  }, []);

  const loadDrawerFailurePatterns = async (equipId) => {
    setDrawerFpLoading(true);
    setDrawerFp(null);
    try {
      const res = await maintenanceAiApi.getFailurePatterns(equipId);
      setDrawerFp(Array.isArray(res) ? res : (res?.data ?? res ?? []));
    } catch { /* silent */ }
    finally { setDrawerFpLoading(false); }
  };

  // ── AI: suggest criticality for an existing equipment ─────────────────────
  const suggestCriticality = async (equipId, targetForm) => {
    if (!equipId) { message.warning('Save the equipment first before getting an AI suggestion.'); return; }
    setCritSuggesting(true);
    setCritSuggestion(null);
    try {
      const res = await maintenanceAiApi.getCriticalitySuggestion(equipId);
      const data = res?.data ?? res;
      setCritSuggestion(data);
      if (targetForm) targetForm.setFieldsValue({ criticality: data.suggested_criticality });
      message.success(`AI suggests Criticality ${data.suggested_criticality} — applied`);
    } catch (err) {
      message.error(err?.message || 'AI suggestion failed — check network');
    } finally {
      setCritSuggesting(false);
    }
  };

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    try {
      const res = await equipmentApi.getAll();
      setEquipment(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (err) { message.error(err?.message ?? 'Failed to load equipment'); }
    finally { setLoading(false); }
  }, []);

  const loadTree = useCallback(async () => {
    try {
      const res = await equipmentApi.getHierarchy();
      const nodes = Array.isArray(res) ? res : (res?.data ?? []);
      const buildTreeNodes = (list) => list.map((n) => ({
        title: (
          <Space>
            <Tag color={LEVEL_COLOR[n.level]}>{n.level}</Tag>
            <Text strong>{n.equipment_code}</Text>
            <Text>{n.name}</Text>
            <Tag color={CRITICALITY_COLOR[n.criticality]}>{n.criticality}</Tag>
            <Tag color={STATUS_COLOR[n.status]}>{n.status?.replace(/_/g, ' ')}</Tag>
          </Space>
        ),
        key: n.id,
        children: n.children?.length ? buildTreeNodes(n.children) : undefined,
      }));
      setTreeData(buildTreeNodes(nodes));
    } catch (err) { message.error(err?.message ?? 'Failed to load hierarchy'); }
  }, []);

  useEffect(() => {
    loadEquipment();
    equipmentApi.getCategories()
      .then((r) => setCategories(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load categories'));
    equipmentApi.getPriorities()
      .then((r) => setPriorities(Array.isArray(r) ? r : (r?.data ?? [])))
      .catch((err) => message.error(err?.message ?? 'Failed to load priorities'));
  }, [loadEquipment]);

  useEffect(() => {
    if (activeTab === 'hierarchy') loadTree();
    // MNT-003: auto-load all-equipment patterns when tab first opened
    if (activeTab === 'failure-patterns' && fpPatterns === null) loadFailurePatterns(null);
  }, [activeTab, loadTree, loadFailurePatterns, fpPatterns]);

  const openDetail = async (id) => {
    try {
      const res = await equipmentApi.getById(id);
      setSelected(res?.id ? res : (res?.data ?? res));
      setDetailDrawer(true);
      setDrawerFp(null);
      loadDrawerFailurePatterns(id); // MNT-003: silently preload per-equipment patterns
    } catch (err) { message.error(err?.message ?? 'Failed to load equipment details'); }
  };

  const createEquipment = async (values) => {
    try {
      await equipmentApi.create(values);
      message.success('Equipment registered successfully');
      setCreateModal(false);
      form.resetFields();
      loadEquipment();
    } catch (err) { message.error(err?.message ?? 'Failed to register equipment'); }
  };

  const updateEquipment = async (values) => {
    try {
      await equipmentApi.update(selected.id, values);
      message.success('Equipment updated');
      setEditModal(false);
      loadEquipment();
      openDetail(selected.id);
    } catch (err) { message.error(err?.message ?? 'Failed to update equipment'); }
  };

  const deactivate = async (id) => {
    Modal.confirm({
      title: 'Deactivate Equipment?',
      content: 'This equipment will be marked inactive.',
      onOk: async () => {
        try {
          await equipmentApi.delete(id);
          message.success('Equipment deactivated');
          setDetailDrawer(false);
          loadEquipment();
        } catch (err) { message.error(err?.message ?? 'Failed to deactivate'); }
      },
    });
  };

  const operationalCount = equipment.filter((e) => e.status === 'operational').length;
  const breakdownCount   = equipment.filter((e) => e.status === 'breakdown').length;
  const criticalACount   = equipment.filter((e) => e.criticality === 'A').length;

  const columns = [
    {
      title: 'Equipment',
      render: (_, r) => (
        <>
          <Text strong>{r.equipment_code}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.name}</Text>
        </>
      ),
    },
    { title: 'Category', dataIndex: ['Category', 'name'], render: (v) => v || '—' },
    {
      title: 'Level',
      dataIndex: 'level',
      render: (v) => <Tag color={LEVEL_COLOR[v]}>{v?.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Criticality',
      dataIndex: 'criticality',
      render: (v) => <Tag color={CRITICALITY_COLOR[v]}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLOR[v]}>{v?.replace(/_/g, ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Health',
      dataIndex: 'current_health_score',
      width: 130,
      render: (v) => {
        const score = v ?? 100;
        const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';
        return (
          <Tooltip title={`Health Score: ${score}/100`}>
            <div style={{ width: 110 }}>
              <Progress
                percent={score}
                size="small"
                strokeColor={color}
                format={(p) => <span style={{ color, fontSize: 11, fontWeight: 600 }}>{p}</span>}
              />
            </div>
          </Tooltip>
        );
      },
    },
    { title: 'Location', dataIndex: 'location', render: (v) => v || '—' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => <Button size="small" onClick={() => openDetail(r.id)}>View</Button>,
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <Title level={4} style={{ margin: 0 }}><ApartmentOutlined /> Equipment Master</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadEquipment}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>Register Equipment</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={8}>
          <Card><Statistic title="Operational" value={operationalCount} valueStyle={{ color: '#16a34a' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={8}>
          <Card><Statistic title="Breakdown" value={breakdownCount} valueStyle={{ color: '#dc2626' }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
        <Col xs={8}>
          <Card><Statistic title="Criticality A" value={criticalACount} valueStyle={{ color: '#dc2626' }} prefix={<ToolOutlined />} /></Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: 'Equipment List',
            children: <ResponsiveTable columns={columns} dataSource={equipment} rowKey="id" loading={loading} scroll={{ x: 800 }} pagination={{ pageSize: 15 }} />,
          },
          {
            key: 'hierarchy',
            label: <><ApartmentOutlined /> Hierarchy</>,
            children: (
              <Card>
                {treeData.length > 0
                  ? <Tree treeData={treeData} defaultExpandAll showLine />
                  : <Text type="secondary">Loading hierarchy...</Text>}
              </Card>
            ),
          },
          {
            key: 'failure-patterns',
            label: (
              <Space size={4}>
                <AlertOutlined style={{ color: '#dc2626' }} />
                <span>Failure Patterns</span>
                {fpPatterns && fpPatterns.length > 0 && (
                  <Tag color="red" style={{ fontSize: 10, marginLeft: 2 }}>{fpPatterns.length}</Tag>
                )}
              </Space>
            ),
            children: (
              <div>
                {/* Toolbar */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                  <Select
                    allowClear
                    showSearch
                    placeholder="Filter by equipment (optional)"
                    style={{ width: 280 }}
                    filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                    options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
                    onChange={(v) => setFpEquipFilter(v ?? null)}
                  />
                  <div style={{ flex: 1 }} />
                  <Button
                    type="primary"
                    icon={fpLoading ? <SyncOutlined spin /> : <SearchOutlined />}
                    loading={fpLoading}
                    onClick={() => loadFailurePatterns(fpEquipFilter)}
                    style={{ background: '#dc2626', borderColor: '#dc2626' }}
                  >
                    Analyze Patterns
                  </Button>
                  {fpPatterns && (
                    <Button icon={<ReloadOutlined />} onClick={() => loadFailurePatterns(fpEquipFilter)}>Refresh</Button>
                  )}
                </div>

                {/* Results */}
                {fpPatterns === null && !fpLoading && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
                    <AlertOutlined style={{ fontSize: 32, marginBottom: 12, color: '#d1d5db' }} />
                    <div>Click <strong>Analyze Patterns</strong> to detect recurring failure patterns across equipment.</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Analyzes last 90 days of completed work orders with failure codes.</div>
                  </div>
                )}

                {fpLoading && (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin size="large" tip="Detecting patterns..." />
                  </div>
                )}

                {fpPatterns !== null && !fpLoading && (
                  <>
                    {fpPatterns.length === 0 ? (
                      <Alert
                        message="No recurring failure patterns detected"
                        description="No equipment has ≥2 occurrences of the same failure code in the last 90 days. Either failure codes are not configured on work orders, or failures have not recurred yet."
                        type="success"
                        showIcon
                      />
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                          <Tag color="red">{fpPatterns.filter(p => p.severity === 'high').length} High Severity</Tag>
                          <Tag color="orange">{fpPatterns.filter(p => p.severity === 'medium').length} Medium</Tag>
                          <Tag color="default">{fpPatterns.filter(p => p.severity === 'low').length} Low</Tag>
                          <Tag color="purple">{fpPatterns.filter(p => p.is_periodic).length} Periodic (predictable)</Tag>
                        </div>
                        <Table
                          size="small"
                          scroll={{ x: 800 }}
                          rowKey={(r) => `${r.equipment_id}-${r.failure_code_id}`}
                          dataSource={fpPatterns}
                          pagination={{ pageSize: 15 }}
                          columns={[
                            {
                              title: 'Equipment',
                              width: 160,
                              render: (_, r) => (
                                <>
                                  <Text strong style={{ fontSize: 12 }}>{r.equipment_code}</Text>
                                  <br />
                                  <Text type="secondary" style={{ fontSize: 11 }}>{r.equipment_name}</Text>
                                </>
                              ),
                            },
                            {
                              title: 'Criticality',
                              dataIndex: 'equipment_criticality',
                              width: 80,
                              render: (v) => <Tag color={v === 'A' ? 'red' : v === 'B' ? 'orange' : 'blue'}>{v}</Tag>,
                            },
                            {
                              title: 'Failure',
                              width: 180,
                              render: (_, r) => (
                                <>
                                  <Text strong style={{ fontSize: 12 }}>{r.failure_name}</Text>
                                  {r.failure_code && <Tag style={{ marginLeft: 4, fontSize: 10 }}>{r.failure_code}</Tag>}
                                  <br />
                                  <Text type="secondary" style={{ fontSize: 11 }}>{r.failure_category}</Text>
                                </>
                              ),
                            },
                            {
                              title: 'Occurrences (90d)',
                              dataIndex: 'occurrences_90d',
                              width: 130,
                              render: (v, r) => (
                                <Space size={4}>
                                  <Tag color={r.severity === 'high' ? 'red' : r.severity === 'medium' ? 'orange' : 'default'}>
                                    {v}×
                                  </Tag>
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    every ~{r.avg_interval_days}d
                                  </Text>
                                </Space>
                              ),
                            },
                            {
                              title: 'Pattern',
                              width: 110,
                              render: (_, r) => (
                                <Tooltip title={r.is_periodic ? 'Consistent intervals — highly predictable' : 'Random intervals — harder to predict'}>
                                  <Tag color={r.is_periodic ? 'purple' : 'default'} style={{ fontSize: 11 }}>
                                    {r.is_periodic ? '⏱ Periodic' : '↔ Random'}
                                  </Tag>
                                </Tooltip>
                              ),
                            },
                            {
                              title: 'Last Occurrence',
                              dataIndex: 'last_occurrence',
                              width: 130,
                              render: (v) => v ? new Date(v).toLocaleDateString() : '—',
                            },
                            {
                              title: 'Recommendation',
                              render: (_, r) => (
                                <Tooltip title={r.typical_cause ? `Typical cause: ${r.typical_cause}` : undefined}>
                                  <Text style={{ fontSize: 12, color: r.is_periodic ? '#7c3aed' : '#dc2626' }}>
                                    {r.recommendation}
                                  </Text>
                                </Tooltip>
                              ),
                            },
                          ]}
                          rowClassName={(r) => r.severity === 'high' ? 'ant-table-row-danger' : ''}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Create Modal */}
      <Modal title="Register New Equipment" open={createModal} onCancel={() => setCreateModal(false)} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={createEquipment}>
          <Form.Item name="name" label="Equipment Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="category_id" label="Category">
                <Select allowClear options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="level" label="Level" initialValue="machine">
                <Select options={['plant','line','machine','sub_assembly','component'].map((v) => ({ value: v, label: v.replace('_', ' ').toUpperCase() }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="criticality"
                label={
                  <Space size={4}>
                    <span>Criticality</span>
                    <Tooltip title="AI suggests criticality based on breakdown history & downtime (only for existing equipment)">
                      <BulbOutlined style={{ color: '#1d4ed8', cursor: 'help' }} />
                    </Tooltip>
                  </Space>
                }
                initialValue="B"
              >
                <Select options={['A','B','C'].map((v) => ({ value: v, label: `${v} — ${v === 'A' ? 'Critical' : v === 'B' ? 'Major' : 'Minor'}` }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="parent_id" label="Parent Equipment">
                <Select
                  allowClear
                  showSearch
                  filterOption={(i, o) => o.label.toLowerCase().includes(i.toLowerCase())}
                  options={equipment.map((e) => ({ value: e.id, label: `${e.equipment_code} — ${e.name}` }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="manufacturer" label="Manufacturer"><Input /></Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="model_no" label="Model No"><Input /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="serial_no" label="Serial No"><Input /></Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="location" label="Location"><Input /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="installation_date" label="Installation Date"><Input type="date" /></Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="warranty_expiry" label="Warranty Expiry"><Input type="date" /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="department" label="Department"><Input /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Register</Button>
            <Button onClick={() => setCreateModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer title="Equipment Details" width={640} open={detailDrawer} onClose={() => setDetailDrawer(false)} destroyOnClose>
        {selected && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Code">{selected.equipment_code}</Descriptions.Item>
              <Descriptions.Item label="Name">{selected.name}</Descriptions.Item>
              <Descriptions.Item label="Criticality"><Tag color={CRITICALITY_COLOR[selected.criticality]}>{selected.criticality}</Tag></Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLOR[selected.status]}>{selected.status?.replace(/_/g, ' ').toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Level"><Tag color={LEVEL_COLOR[selected.level]}>{selected.level?.replace('_', ' ')}</Tag></Descriptions.Item>
              <Descriptions.Item label="Category">{selected.Category?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Manufacturer">{selected.manufacturer || '—'}</Descriptions.Item>
              <Descriptions.Item label="Model No">{selected.model_no || '—'}</Descriptions.Item>
              <Descriptions.Item label="Serial No">{selected.serial_no || '—'}</Descriptions.Item>
              <Descriptions.Item label="Location">{selected.location || '—'}</Descriptions.Item>
              <Descriptions.Item label="Installation">{selected.installation_date || '—'}</Descriptions.Item>
              <Descriptions.Item label="Warranty Expiry">{selected.warranty_expiry || '—'}</Descriptions.Item>
              <Descriptions.Item label="Health Score" span={2}>
                {(() => {
                  const v = selected.current_health_score ?? 100;
                  const color = v >= 70 ? '#16a34a' : v >= 40 ? '#d97706' : '#dc2626';
                  const label = v >= 70 ? 'Good' : v >= 40 ? 'Warning' : 'Critical';
                  return (
                    <div style={{ width: '100%' }}>
                      <Progress
                        percent={v}
                        strokeColor={color}
                        format={(p) => <span style={{ color, fontWeight: 700 }}>{p} <span style={{ fontSize: 11, fontWeight: 400 }}>({label})</span></span>}
                      />
                    </div>
                  );
                })()}
              </Descriptions.Item>
            </Descriptions>

            {selected.Warranty && (
              <>
                <Divider orientation="left">Warranty</Divider>
                <Descriptions size="small" bordered column={2}>
                  <Descriptions.Item label="Provider">{selected.Warranty.warranty_provider}</Descriptions.Item>
                  <Descriptions.Item label="Expires">{selected.Warranty.end_date}</Descriptions.Item>
                </Descriptions>
              </>
            )}

            {(selected.Children || []).length > 0 && (
              <>
                <Divider orientation="left">Sub-Components ({selected.Children.length})</Divider>
                {selected.Children.map((c) => (
                  <Tag key={c.id} style={{ marginBottom: 4 }}>{c.equipment_code} — {c.name}</Tag>
                ))}
              </>
            )}

            {(selected.Documents || []).length > 0 && (
              <>
                <Divider orientation="left">Documents</Divider>
                {selected.Documents.map((d) => (
                  <div key={d.id}><FileTextOutlined /> <Text>{d.file_name}</Text> <Tag>{d.document_type}</Tag></div>
                ))}
              </>
            )}

            {/* MNT-003: Failure Patterns for this equipment */}
            <Divider orientation="left">
              <Space size={4}>
                <AlertOutlined style={{ color: '#dc2626' }} />
                <span style={{ fontSize: 13, color: '#dc2626' }}>Failure Patterns (90 days)</span>
              </Space>
            </Divider>
            {drawerFpLoading ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <Spin size="small" tip="Analyzing..." />
              </div>
            ) : drawerFp === null ? (
              <Text type="secondary" style={{ fontSize: 12 }}>Loading pattern data...</Text>
            ) : drawerFp.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>✓ No recurring failure patterns detected in last 90 days</Text>
            ) : (
              <List
                size="small"
                dataSource={drawerFp}
                renderItem={(p) => (
                  <List.Item style={{ padding: '6px 0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                        <Space size={4} wrap>
                          <Tag color={p.severity === 'high' ? 'red' : p.severity === 'medium' ? 'orange' : 'default'} style={{ fontSize: 10 }}>
                            {p.severity?.toUpperCase()}
                          </Tag>
                          <Text strong style={{ fontSize: 12 }}>{p.failure_name}</Text>
                          {p.is_periodic && (
                            <Tooltip title="Consistent timing — schedule PM to prevent">
                              <Tag color="purple" style={{ fontSize: 10 }}>Periodic</Tag>
                            </Tooltip>
                          )}
                        </Space>
                        <Tag color="default" style={{ fontSize: 10 }}>{p.occurrences_90d}× / every ~{p.avg_interval_days}d</Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>{p.recommendation}</Text>
                    </div>
                  </List.Item>
                )}
              />
            )}

            <Divider />
            <Space wrap>
              <Button icon={<EditOutlined />} onClick={() => {
                editForm.setFieldsValue(selected);
                setEditModal(true);
              }}>Edit</Button>
              <Button danger onClick={() => deactivate(selected.id)}>Deactivate</Button>
            </Space>
          </>
        )}
      </Drawer>

      {/* Edit Modal */}
      <Modal title="Edit Equipment" open={editModal} onCancel={() => { setEditModal(false); setCritSuggestion(null); }} footer={null} width={520}>
        <Form form={editForm} layout="vertical" onFinish={updateEquipment}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="criticality" label="Criticality">
                <Select options={['A','B','C'].map((v) => ({ value: v, label: v }))} />
              </Form.Item>
              <Button
                size="small"
                icon={<BulbOutlined />}
                loading={critSuggesting}
                onClick={() => suggestCriticality(selected?.id, editForm)}
                style={{ marginTop: -8, marginBottom: 12, color: '#1d4ed8', borderColor: '#1d4ed8' }}
              >
                AI Suggest
              </Button>
              {critSuggestion && (
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                  {critSuggestion.reasons.map((r, i) => <div key={i}>• {r}</div>)}
                </div>
              )}
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="Status">
                <Select options={['operational','under_maintenance','breakdown','decommissioned'].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="location" label="Location"><Input /></Form.Item>
          <Form.Item name="department" label="Department"><Input /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Update</Button>
            <Button onClick={() => setEditModal(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </AppLayout>
  );
}
