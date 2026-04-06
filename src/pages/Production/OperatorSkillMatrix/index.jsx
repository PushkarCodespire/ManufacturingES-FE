import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, Drawer, Form,
  Select, DatePicker, Input, Popconfirm, message,
  Row, Col, Tabs, Badge, Tooltip, Progress, Alert,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined,
  SafetyCertificateOutlined, WarningOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import api from '../../../api/axios';
import { exportToCsv } from '../../../utils/exportCsv';
import CsvUploadModal       from '../../../components/common/CsvUploadModal';
import { downloadSampleCsv } from '../../../utils/csvImport';
import { UploadOutlined }   from '@ant-design/icons';

// ── CSV Upload config ─────────────────────────────────────────────────────────
const SKILL_CSV_HEADERS = ['Operator Employee ID', 'Skill Name', 'Proficiency', 'Certified Date', 'Expiry Date', 'Notes'];
const SKILL_CSV_SAMPLE = [
  { 'Operator Employee ID': 'DT10002', 'Skill Name': 'MIG Welding', 'Proficiency': 'competent', 'Certified Date': '2026-01-15', 'Expiry Date': '2027-01-15', 'Notes': '' },
];
const SKILL_CSV_VALIDATION = [
  { field: 'Operator Employee ID', required: true },
  { field: 'Skill Name', required: true },
  { field: 'Proficiency', required: true },
];

const { Title, Text } = Typography;
const { Option } = Select;

const PROF_COLOR   = { trainee: 'default', competent: 'blue', proficient: 'green', expert: 'gold' };
const PROF_PERCENT = { trainee: 25, competent: 50, proficient: 75, expert: 100 };

export default function OperatorSkillMatrixPage() {
  const { can } = usePermissions();
  const canWrite  = can('prod-skill_matrix-manage_skills-create_edit_delete');
  const canDelete = can('prod-skill_matrix-manage_skills-create_edit_delete');

  // Skills tab
  const [skills, setSkills]         = useState([]);
  const [skillLoading, setSkillLoad] = useState(false);
  const [skillDrawer, setSkillDraw]  = useState(false);
  const [editSkill, setEditSkill]    = useState(null);
  const [skillSearch, setSkillSearch] = useState('');

  // Matrix tab
  const [matrix, setMatrix]         = useState([]);
  const [matrixLoading, setMatLoad]  = useState(false);
  const [matDrawer, setMatDraw]      = useState(false);
  const [editMatrix, setEditMatrix]  = useState(null);
  const [expiryFilter, setExpiryFilter] = useState(null);

  // Dropdown data
  const [users, setUsers]           = useState([]);
  const [activeTab, setActiveTab]   = useState('matrix');

  const [saving, setSaving]         = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [skillForm]  = Form.useForm();
  const [matrixForm] = Form.useForm();

  const loadSkills = useCallback(async () => {
    setSkillLoad(true);
    try {
      const res = await api.get('/operator-skills', { params: skillSearch ? { search: skillSearch } : {} });
      setSkills(res.data || []);
    } catch { message.error('Failed to load skills'); }
    finally  { setSkillLoad(false); }
  }, [skillSearch]);

  const loadMatrix = useCallback(async () => {
    setMatLoad(true);
    try {
      const params = {};
      if (expiryFilter) params.expiring_in_days = expiryFilter;
      const res = await api.get('/operator-skills/matrix', { params });
      setMatrix(res.data || []);
    } catch { message.error('Failed to load skill matrix'); }
    finally  { setMatLoad(false); }
  }, [expiryFilter]);

  useEffect(() => { loadSkills(); }, [loadSkills]);
  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  useEffect(() => {
    api.get('/users')
      .then(r => setUsers(r.data || []))
      .catch(() => {});
  }, []);

  // ── SKILLS CRUD ────────────────────────────────────────────────────────────
  const openCreateSkill = () => { setEditSkill(null); skillForm.resetFields(); setSkillDraw(true); };
  const openEditSkill   = (s) => { setEditSkill(s); skillForm.setFieldsValue({ name: s.name, category: s.category, description: s.description, is_active: s.is_active }); setSkillDraw(true); };

  const saveSkill = async () => {
    try {
      const vals = await skillForm.validateFields();
      setSaving(true);
      if (editSkill) {
        await api.put(`/operator-skills/${editSkill.id}`, vals);
        message.success('Skill updated');
      } else {
        await api.post('/operator-skills', vals);
        message.success('Skill created');
      }
      setSkillDraw(false);
      loadSkills();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const deleteSkill = async (id) => {
    try {
      await api.delete(`/operator-skills/${id}`);
      message.success('Skill deleted');
      loadSkills();
    } catch (err) { message.error(err?.response?.data?.message || 'Delete failed'); }
  };

  // ── MATRIX CRUD ────────────────────────────────────────────────────────────
  const openAssign  = () => { setEditMatrix(null); matrixForm.resetFields(); matrixForm.setFieldsValue({ proficiency: 'trainee' }); setMatDraw(true); };
  const openEditMat = (m) => {
    setEditMatrix(m);
    matrixForm.setFieldsValue({
      user_id:        m.user_id,
      skill_id:       m.skill_id,
      proficiency:    m.proficiency,
      certified_date: m.certified_date ? dayjs(m.certified_date) : null,
      expiry_date:    m.expiry_date    ? dayjs(m.expiry_date)    : null,
      certified_by:   m.certified_by,
      notes:          m.notes,
    });
    setMatDraw(true);
  };

  const saveMat = async () => {
    try {
      const vals = await matrixForm.validateFields();
      setSaving(true);
      const payload = {
        ...vals,
        certified_date: vals.certified_date?.format('YYYY-MM-DD') || null,
        expiry_date:    vals.expiry_date?.format('YYYY-MM-DD')    || null,
      };
      if (editMatrix) {
        await api.put(`/operator-skills/matrix/${editMatrix.id}`, payload);
        message.success('Updated');
      } else {
        await api.post('/operator-skills/matrix', payload);
        message.success('Skill assigned');
      }
      setMatDraw(false);
      loadMatrix();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const deleteMat = async (id) => {
    try {
      await api.delete(`/operator-skills/matrix/${id}`);
      message.success('Assignment removed');
      loadMatrix();
    } catch (err) { message.error(err?.response?.data?.message || 'Delete failed'); }
  };

  // ── CSV Import handler ────────────────────────────────────────────────────────
  const handleCsvImport = async (rows) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const opEid = (row['Operator Employee ID'] || '').trim();
        const op = users.find((u) => u.employee_id?.toLowerCase() === opEid.toLowerCase());
        if (!op) throw new Error(`Operator "${opEid}" not found`);
        const skillName = (row['Skill Name'] || '').trim();
        const skill = skills.find((s) => s.name?.toLowerCase() === skillName.toLowerCase());
        if (!skill) throw new Error(`Skill "${skillName}" not found`);
        await api.post('/operator-skills/matrix', {
          user_id:        op.id,
          skill_id:       skill.id,
          proficiency:    row['Proficiency'] || 'trainee',
          certified_date: row['Certified Date'] || null,
          expiry_date:    row['Expiry Date'] || null,
          notes:          row['Notes'] || null,
        });
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row "${row['Operator Employee ID']}/${row['Skill Name']}": ${err?.response?.data?.message || err.message}`);
      }
    }
    loadMatrix();
    return { success, failed, errors };
  };

  // Expiry helpers
  const isExpired  = (d) => d && dayjs(d).isBefore(dayjs());
  const isExpiring = (d) => d && !isExpired(d) && dayjs(d).diff(dayjs(), 'day') <= 30;

  // ── Skill table columns ────────────────────────────────────────────────────
  const skillColumns = [
    { title: 'Code', dataIndex: 'code', width: 90, render: v => <Text code>{v}</Text> },
    { title: 'Name', dataIndex: 'name', ellipsis: true },
    { title: 'Category', dataIndex: 'category', width: 140,
      render: v => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'Status', dataIndex: 'is_active', width: 90,
      render: v => <Badge status={v ? 'success' : 'default'} text={v ? 'Active' : 'Inactive'} /> },
    {
      title: 'Actions', width: 90, render: (_, r) => (
        <Space>
          {canWrite  && <Button size="small" icon={<EditOutlined />}   onClick={() => openEditSkill(r)} />}
          {canDelete && (
            <Popconfirm title="Delete skill?" onConfirm={() => deleteSkill(r.id)} okType="danger">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ── Matrix table columns ───────────────────────────────────────────────────
  const matrixColumns = [
    { title: 'Operator', dataIndex: ['Operator', 'name'], width: 160,
      render: (v, r) => <><UserOutlined /> {v}<br /><Text type="secondary" style={{ fontSize: 11 }}>{r.Operator?.employee_id}</Text></> },
    { title: 'Skill', dataIndex: ['Skill', 'name'], ellipsis: true,
      render: (v, r) => <><SafetyCertificateOutlined /> {v}<br /><Text type="secondary" style={{ fontSize: 11 }}>{r.Skill?.category}</Text></> },
    { title: 'Proficiency', dataIndex: 'proficiency', width: 150,
      render: v => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Tag color={PROF_COLOR[v]}>{v}</Tag>
          <Progress percent={PROF_PERCENT[v]} showInfo={false} size="small" strokeColor={PROF_COLOR[v] === 'gold' ? '#faad14' : undefined} />
        </Space>
      ),
    },
    { title: 'Certified', dataIndex: 'certified_date', width: 110,
      render: v => v ? dayjs(v).format('DD MMM YY') : <Text type="secondary">—</Text> },
    { title: 'Expiry', dataIndex: 'expiry_date', width: 130,
      render: v => {
        if (!v) return <Text type="secondary">—</Text>;
        const expired  = isExpired(v);
        const expiring = isExpiring(v);
        return (
          <Tag color={expired ? 'red' : expiring ? 'orange' : 'green'}>
            {expired ? <><WarningOutlined /> Expired</> : expiring ? <><WarningOutlined /> {dayjs(v).diff(dayjs(), 'day')}d</> : dayjs(v).format('DD MMM YY')}
          </Tag>
        );
      },
    },
    { title: 'Certified By', dataIndex: ['CertifiedBy', 'name'], width: 130,
      render: v => v || <Text type="secondary">—</Text> },
    {
      title: 'Actions', width: 90, fixed: 'right', render: (_, r) => (
        <Space>
          {canWrite  && <Button size="small" icon={<EditOutlined />} onClick={() => openEditMat(r)} />}
          {canDelete && (
            <Popconfirm title="Remove skill assignment?" onConfirm={() => deleteMat(r.id)} okType="danger">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const expiredCount  = matrix.filter(m => isExpired(m.expiry_date)).length;
  const expiringCount = matrix.filter(m => isExpiring(m.expiry_date)).length;

  return (
    <AppLayout>
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>Operator Skill Matrix</Title>
          <Text type="secondary">Define skills and track operator proficiency & certifications</Text>
        </div>

        {(expiredCount > 0 || expiringCount > 0) && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <>
                {expiredCount  > 0 && <Tag color="red">{expiredCount} certifications expired</Tag>}
                {expiringCount > 0 && <Tag color="orange">{expiringCount} expiring within 30 days</Tag>}
              </>
            }
          />
        )}

        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'matrix',
                label: <><SafetyCertificateOutlined /> Skill Matrix <Badge count={matrix.length} style={{ marginLeft: 4 }} /></>,
                children: (
                  <>
                    <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                      <Space>
                        <Select
                          placeholder="Expiring in..."
                          allowClear
                          style={{ width: 160 }}
                          onChange={v => setExpiryFilter(v)}
                        >
                          <Option value={30}>Next 30 days</Option>
                          <Option value={60}>Next 60 days</Option>
                          <Option value={90}>Next 90 days</Option>
                        </Select>
                      </Space>
                      <Button icon={<DownloadOutlined />} onClick={() => exportToCsv('skill-matrix.csv', matrix, matrixColumns)}>Export CSV</Button>
                      {canWrite && <Button icon={<UploadOutlined />} onClick={() => setCsvModalOpen(true)}>Upload CSV</Button>}
                      {canWrite && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAssign}>
                          Assign Skill
                        </Button>
                      )}
                    </Row>
                    <Table
                      rowKey="id"
                      dataSource={matrix}
                      columns={matrixColumns}
                      loading={matrixLoading}
                      size="small"
                      scroll={{ x: 900 }}
                      pagination={{ pageSize: 20, showSizeChanger: true }}
                      rowClassName={r => isExpired(r.expiry_date) ? 'ant-table-row-danger' : isExpiring(r.expiry_date) ? 'ant-table-row-warning' : ''}
                    />
                  </>
                ),
              },
              {
                key: 'skills',
                label: `Skill Definitions (${skills.length})`,
                children: (
                  <>
                    <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                      <Input.Search
                        placeholder="Search skills..."
                        onSearch={setSkillSearch}
                        onChange={e => !e.target.value && setSkillSearch('')}
                        style={{ width: 260 }}
                        allowClear
                      />
                      {canWrite && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateSkill}>
                          Add Skill
                        </Button>
                      )}
                    </Row>
                    <Table
                      rowKey="id"
                      dataSource={skills}
                      columns={skillColumns}
                      loading={skillLoading}
                      size="small"
                      pagination={{ pageSize: 20 }}
                    />
                  </>
                ),
              },
            ]}
          />
        </Card>

      {/* Skill Drawer */}
      <Drawer
        title={editSkill ? 'Edit Skill' : 'Add Skill'}
        open={skillDrawer}
        onClose={() => setSkillDraw(false)}
        width={420}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setSkillDraw(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={saveSkill}>Save</Button>
          </Space>
        }
      >
        <Form form={skillForm} layout="vertical">
          <Form.Item name="name" label="Skill Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. MIG Welding" />
          </Form.Item>
          <Form.Item name="category" label="Category">
            <Select placeholder="Select or type category" mode="combobox" allowClear>
              {['Welding', 'Assembly', 'Machining', 'Quality Control', 'Painting', 'Packing', 'Material Handling'].map(c => (
                <Option key={c} value={c}>{c}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          {editSkill && (
            <Form.Item name="is_active" label="Status">
              <Select>
                <Option value={true}>Active</Option>
                <Option value={false}>Inactive</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Drawer>

      {/* Matrix / Assign Drawer */}
      <Drawer
        title={editMatrix ? 'Edit Skill Assignment' : 'Assign Skill to Operator'}
        open={matDrawer}
        onClose={() => setMatDraw(false)}
        width={480}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setMatDraw(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={saveMat}>Save</Button>
          </Space>
        }
      >
        <Form form={matrixForm} layout="vertical">
          <Form.Item name="user_id" label="Operator" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select operator"
              disabled={!!editMatrix}
              optionFilterProp="label"
              options={users.map(u => ({ label: `${u.name} (${u.employee_id})`, value: u.id }))}
            />
          </Form.Item>

          <Form.Item name="skill_id" label="Skill" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Select skill"
              disabled={!!editMatrix}
              optionFilterProp="label"
              options={skills.filter(s => s.is_active).map(s => ({
                label: `${s.name}${s.category ? ` (${s.category})` : ''}`,
                value: s.id,
              }))}
            />
          </Form.Item>

          <Form.Item name="proficiency" label="Proficiency Level" rules={[{ required: true }]}>
            <Select>
              {Object.entries(PROF_COLOR).map(([k, c]) => (
                <Option key={k} value={k}>
                  <Tag color={c}>{k}</Tag>
                  <Progress percent={PROF_PERCENT[k]} showInfo={false} size="small" style={{ width: 80, marginLeft: 8 }} />
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="certified_date" label="Certified Date">
                <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expiry_date" label="Expiry Date">
                <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="certified_by" label="Certified By">
            <Select
              showSearch
              allowClear
              placeholder="Select certifier (optional)"
              optionFilterProp="label"
              options={users.map(u => ({ label: u.name, value: u.id }))}
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>

      <CsvUploadModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImport={handleCsvImport}
        title="Upload Skill Assignments"
        entityName="Skill Assignment"
        sampleHeaders={SKILL_CSV_HEADERS}
        sampleRows={SKILL_CSV_SAMPLE}
        validationRules={SKILL_CSV_VALIDATION}
      />
    </AppLayout>
  );
}
