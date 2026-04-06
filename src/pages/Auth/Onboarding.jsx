import React, { useState, useMemo } from 'react';
import {
  Steps, Button, Card, Form, Input, Select, Checkbox, Typography, Upload,
  Row, Col, Space, Divider, Result, message,
} from 'antd';
import {
  BankOutlined, EnvironmentOutlined, TeamOutlined,
  UserAddOutlined, RocketOutlined, PlusOutlined,
  UploadOutlined, DeleteOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import BrandLogo from '../../components/BrandLogo';

const { Title, Text, Paragraph } = Typography;

const DEFAULT_DEPARTMENTS = [
  'Production',
  'Quality',
  'Store',
  'Procurement',
  'Maintenance',
  'Dispatch',
  'Accounts',
  'HR',
];

const ROLE_OPTIONS = ['Admin', 'Manager', 'Supervisor', 'Operator', 'Inspector', 'Engineer'];

// ─── Step 1: Company Profile ────────────────────────────────────────────────
const CompanyProfileStep = ({ form, organization, loading, onSave }) => (
  <Form form={form} layout="vertical" requiredMark={false} onFinish={onSave}>
    <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Company Profile</Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: 24, fontSize: 13 }}>
      Tell us a bit more about your company. You can update this later from Settings.
    </Text>

    <Form.Item name="logo_url" label="Company Logo (optional)">
      <Upload
        listType="picture-card"
        maxCount={1}
        beforeUpload={() => false}
        accept="image/*"
      >
        <div>
          <UploadOutlined />
          <div style={{ marginTop: 8, fontSize: 12 }}>Upload Logo</div>
        </div>
      </Upload>
    </Form.Item>

    <Divider style={{ margin: '16px 0' }} />
    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>Company Address</Text>

    <Row gutter={16}>
      <Col span={24}>
        <Form.Item name={['address', 'line1']} label="Address Line 1">
          <Input placeholder="Building / Street" />
        </Form.Item>
      </Col>
      <Col span={24}>
        <Form.Item name={['address', 'line2']} label="Address Line 2">
          <Input placeholder="Area / Landmark" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={['address', 'city']} label="City">
          <Input placeholder="e.g. Pune" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={['address', 'state']} label="State">
          <Input placeholder="e.g. Maharashtra" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={['address', 'pincode']} label="Pincode">
          <Input placeholder="e.g. 411001" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name={['address', 'country']} label="Country" initialValue="India">
          <Input placeholder="Country" />
        </Form.Item>
      </Col>
    </Row>

    <Form.Item name="gstin" label="GSTIN (optional)">
      <Input placeholder="e.g. 27AABCU9603R1ZM" />
    </Form.Item>

    <Button type="primary" htmlType="submit" loading={loading} style={{ marginTop: 8 }}>
      Save & Continue
    </Button>
  </Form>
);

// ─── Step 2: Plant / Site Setup ─────────────────────────────────────────────
const PlantSetupStep = ({ form, loading, onSave }) => (
  <Form form={form} layout="vertical" requiredMark={false} onFinish={onSave}>
    <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Plant / Site Setup</Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: 24, fontSize: 13 }}>
      Set up your first manufacturing site. You can add more sites later.
    </Text>

    <Row gutter={16}>
      <Col span={16}>
        <Form.Item
          name="name"
          label="Site Name"
          rules={[{ required: true, message: 'Site name is required' }]}
        >
          <Input placeholder="e.g. Main Plant" />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item
          name="code"
          label="Site Code"
          rules={[{ required: true, message: 'Site code is required' }]}
        >
          <Input placeholder="e.g. PLT-01" />
        </Form.Item>
      </Col>
    </Row>

    <Form.Item name="address" label="Site Address">
      <Input.TextArea rows={2} placeholder="Full address of the site" />
    </Form.Item>

    <Button type="primary" htmlType="submit" loading={loading} style={{ marginTop: 8 }}>
      Create Site & Continue
    </Button>
  </Form>
);

// ─── Step 3: Departments ────────────────────────────────────────────────────
const DepartmentsStep = ({ selectedDepts, setSelectedDepts }) => (
  <div>
    <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Departments</Title>
    <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
      Select the departments relevant to your organization. All are enabled by default.
    </Text>

    <Checkbox.Group
      value={selectedDepts}
      onChange={setSelectedDepts}
      style={{ width: '100%' }}
    >
      <Row gutter={[16, 12]}>
        {DEFAULT_DEPARTMENTS.map((dept) => (
          <Col span={12} key={dept}>
            <Checkbox value={dept} style={{ fontSize: 14 }}>{dept}</Checkbox>
          </Col>
        ))}
      </Row>
    </Checkbox.Group>

    <div
      style={{
        marginTop: 20,
        padding: '10px 14px',
        background: '#f0f9ff',
        borderRadius: 8,
        border: '1px solid #bae6fd',
      }}
    >
      <Text style={{ color: '#0369a1', fontSize: 12 }}>
        Departments can be added later from Masters &rarr; Configuration.
      </Text>
    </div>
  </div>
);

// ─── Step 4: Invite Team ────────────────────────────────────────────────────
const InviteTeamStep = ({ invites, setInvites, selectedDepts }) => {
  const addRow = () => {
    setInvites([...invites, { name: '', email: '', role: '', department: '' }]);
  };

  const removeRow = (idx) => {
    setInvites(invites.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    const updated = [...invites];
    updated[idx] = { ...updated[idx], [field]: value };
    setInvites(updated);
  };

  return (
    <div>
      <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>Invite Your Team</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>
        Add team members who will use the platform. You can skip this and invite them later.
      </Text>

      {invites.map((inv, idx) => (
        <Card
          key={idx}
          size="small"
          style={{ marginBottom: 12, border: '1px solid #e8eaed', borderRadius: 8 }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <Row gutter={12} align="middle">
            <Col span={6}>
              <Input
                placeholder="Name"
                value={inv.name}
                onChange={(e) => updateRow(idx, 'name', e.target.value)}
                size="middle"
              />
            </Col>
            <Col span={7}>
              <Input
                placeholder="Email"
                value={inv.email}
                onChange={(e) => updateRow(idx, 'email', e.target.value)}
                size="middle"
              />
            </Col>
            <Col span={5}>
              <Select
                placeholder="Role"
                value={inv.role || undefined}
                onChange={(v) => updateRow(idx, 'role', v)}
                style={{ width: '100%' }}
                size="middle"
              >
                {ROLE_OPTIONS.map((r) => <Select.Option key={r} value={r}>{r}</Select.Option>)}
              </Select>
            </Col>
            <Col span={5}>
              <Select
                placeholder="Dept"
                value={inv.department || undefined}
                onChange={(v) => updateRow(idx, 'department', v)}
                style={{ width: '100%' }}
                size="middle"
              >
                {selectedDepts.map((d) => <Select.Option key={d} value={d}>{d}</Select.Option>)}
              </Select>
            </Col>
            <Col span={1}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
                onClick={() => removeRow(idx)}
              />
            </Col>
          </Row>
        </Card>
      ))}

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={addRow}
        style={{ width: '100%', marginTop: 4 }}
      >
        Add Team Member
      </Button>

      <div
        style={{
          marginTop: 20,
          padding: '10px 14px',
          background: '#fffbeb',
          borderRadius: 8,
          border: '1px solid #fde68a',
        }}
      >
        <Text style={{ color: '#92400e', fontSize: 12 }}>
          Invitations will be sent once the email service is configured. For now, team members can be added from Masters &rarr; Employees.
        </Text>
      </div>
    </div>
  );
};

// ─── Step 5: Review & Launch ────────────────────────────────────────────────
const ReviewLaunchStep = ({ organization, siteName, selectedDepts, invites, loading, onLaunch }) => (
  <div>
    <Result
      icon={<RocketOutlined style={{ color: '#1d4ed8' }} />}
      title="You're all set!"
      subTitle="Review your setup and launch your workspace."
    />

    <Card
      style={{ border: '1px solid #e8eaed', borderRadius: 10, maxWidth: 480, margin: '0 auto' }}
      bodyStyle={{ padding: '20px 24px' }}
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Organization</Text>
        <div><Text strong>{organization?.name || '—'}</Text></div>
      </div>
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>First Site</Text>
        <div><Text strong>{siteName || '(skipped)'}</Text></div>
      </div>
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Departments Enabled</Text>
        <div><Text strong>{selectedDepts.length}</Text></div>
      </div>
      <Divider style={{ margin: '12px 0' }} />
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>Team Members Invited</Text>
        <div><Text strong>{invites.filter((i) => i.email).length}</Text></div>
      </div>
    </Card>

    <div style={{ textAlign: 'center', marginTop: 28 }}>
      <Button
        type="primary"
        size="large"
        icon={<RocketOutlined />}
        loading={loading}
        onClick={onLaunch}
        style={{ height: 48, fontWeight: 600, fontSize: 15, paddingLeft: 32, paddingRight: 32 }}
      >
        Launch Dashboard
      </Button>
    </div>
  </div>
);

// ─── Main Onboarding Component ──────────────────────────────────────────────
const OnboardingPage = () => {
  const [current, setCurrent]         = useState(0);
  const [loading, setLoading]         = useState(false);
  const [selectedDepts, setSelectedDepts] = useState([...DEFAULT_DEPARTMENTS]);
  const [invites, setInvites]         = useState([{ name: '', email: '', role: '', department: '' }]);
  const [siteName, setSiteName]       = useState('');
  const { organization }              = useAuth();
  const navigate                      = useNavigate();

  const [profileForm] = Form.useForm();
  const [siteForm]    = Form.useForm();

  const orgId = organization?.id;

  // Step handlers
  const handleSaveProfile = async (values) => {
    if (!orgId) { message.error('Organization not found. Please log in again.'); return; }
    setLoading(true);
    try {
      // Remove logo file from payload (upload not wired in Phase 1)
      const { logo_url, ...rest } = values;
      await api.patch(`/organizations/${orgId}`, rest);
      message.success('Company profile saved');
      setCurrent(1);
    } catch (err) {
      message.error(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async (values) => {
    if (!orgId) { message.error('Organization not found.'); return; }
    setLoading(true);
    try {
      await api.post('/sites', { ...values, organization_id: orgId });
      setSiteName(values.name);
      message.success('Site created');
      setCurrent(2);
    } catch (err) {
      message.error(err.message || 'Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!orgId) { message.error('Organization not found.'); return; }
    setLoading(true);
    try {
      await api.post(`/organizations/${orgId}/complete-onboarding`);
      message.success('Setup complete!');
      navigate('/dashboard');
    } catch (err) {
      message.error(err.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => setCurrent((c) => Math.min(c + 1, 4));
  const goPrev = () => setCurrent((c) => Math.max(c - 1, 0));

  const steps = useMemo(() => [
    { title: 'Company',     icon: <BankOutlined /> },
    { title: 'Site',        icon: <EnvironmentOutlined /> },
    { title: 'Departments', icon: <TeamOutlined /> },
    { title: 'Team',        icon: <UserAddOutlined /> },
    { title: 'Launch',      icon: <RocketOutlined /> },
  ], []);

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <CompanyProfileStep
            form={profileForm}
            organization={organization}
            loading={loading}
            onSave={handleSaveProfile}
          />
        );
      case 1:
        return (
          <PlantSetupStep
            form={siteForm}
            loading={loading}
            onSave={handleCreateSite}
          />
        );
      case 2:
        return (
          <DepartmentsStep
            selectedDepts={selectedDepts}
            setSelectedDepts={setSelectedDepts}
          />
        );
      case 3:
        return (
          <InviteTeamStep
            invites={invites}
            setInvites={setInvites}
            selectedDepts={selectedDepts}
          />
        );
      case 4:
        return (
          <ReviewLaunchStep
            organization={organization}
            siteName={siteName}
            selectedDepts={selectedDepts}
            invites={invites}
            loading={loading}
            onLaunch={handleLaunch}
          />
        );
      default:
        return null;
    }
  };

  // Steps 2 (Departments) and 3 (Team) have skip/next buttons (no form submission)
  const showNavButtons = current === 2 || current === 3;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f6f9',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
      }}
    >
      <BrandLogo size={40} subtitle="Setup Wizard" />

      <Card
        style={{
          width: '100%',
          maxWidth: 720,
          background: '#ffffff',
          border: '1px solid #e8eaed',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
        bodyStyle={{ padding: '32px 32px 24px' }}
      >
        <Steps
          current={current}
          items={steps}
          size="small"
          style={{ marginBottom: 32 }}
        />

        {renderStepContent()}

        {/* Navigation buttons for steps without their own form submit */}
        {showNavButtons && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={goPrev}>
              Back
            </Button>
            <Space>
              <Button onClick={goNext}>Skip</Button>
              <Button type="primary" onClick={goNext}>Next</Button>
            </Space>
          </div>
        )}

        {/* Back button for steps with form submit (0, 1) — step 0 has no back */}
        {(current === 1) && (
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goPrev}
            style={{ marginTop: 12 }}
          >
            Back
          </Button>
        )}
      </Card>

      <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 28 }}>
        You can complete the remaining setup from Settings anytime.
      </Text>
    </div>
  );
};

export default OnboardingPage;
