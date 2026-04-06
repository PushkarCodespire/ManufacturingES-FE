import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Divider, Select, Row, Col } from 'antd';
import {
  BankOutlined,
  UserOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/AuthLayout';
import BrandLogo from '../../components/BrandLogo';

const { Title, Text } = Typography;

const INDUSTRY_OPTIONS = [
  'Injection Moulding',
  'CNC Machining',
  'Die Casting',
  'Sheet Metal',
  'Assembly',
  'Packaging',
  'Food & Beverage',
  'Pharma',
  'Textiles',
  'Electronics',
  'Other',
];

const RegisterPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { register }          = useAuth();
  const navigate              = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        company_name: values.company_name,
        industry:     values.industry,
        name:         values.name,
        email:        values.email,
        phone:        values.phone || undefined,
        password:     values.password,
      };

      const { onboarding_completed } = await register(payload);
      navigate(onboarding_completed === false ? '/onboarding' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <BrandLogo />

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
        <Title level={4} style={{ color: '#111827', marginTop: 0, marginBottom: 4, fontWeight: 600 }}>
          Create Account
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Register your company to get started with Dynatech ONE
        </Text>

        <Divider style={{ borderColor: '#f3f4f6', margin: '20px 0' }} />

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError('')}
            style={{ marginBottom: 20, borderRadius: 6 }}
          />
        )}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          {/* Company Info */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="company_name"
                label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Company Name</span>}
                rules={[{ required: true, message: 'Please enter your company name' }]}
              >
                <Input
                  prefix={<BankOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="e.g. Acme Manufacturing Pvt Ltd"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="industry"
                label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Industry</span>}
              >
                <Select placeholder="Select your industry" allowClear>
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <Select.Option key={ind} value={ind}>{ind}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ borderColor: '#f3f4f6', margin: '16px 0' }} />

          {/* Admin User Info */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Your Full Name</span>}
                rules={[{ required: true, message: 'Please enter your full name' }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="e.g. Rajesh Kumar"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Email</span>}
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={24}>
              <Form.Item
                name="phone"
                label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Phone (optional)</span>}
              >
                <Input
                  prefix={<PhoneOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="+91 98765 43210"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="password"
                label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Password</span>}
                rules={[
                  { required: true, message: 'Please enter a password' },
                  { min: 8, message: 'Password must be at least 8 characters' },
                  {
                    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
                    message: 'Must include uppercase, lowercase, number & special character',
                  },
                ]}
                extra={
                  <Text style={{ color: '#9ca3af', fontSize: 11 }}>
                    Min 8 chars with uppercase, lowercase, number & special character
                  </Text>
                }
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="confirm_password"
                label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Confirm Password</span>}
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Please confirm your password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('Passwords do not match'));
                    },
                  }),
                ]}
                style={{ marginBottom: 24 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
          </Row>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{ height: 46, fontWeight: 600, fontSize: 15 }}
          >
            Create Account
          </Button>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text style={{ color: '#6b7280', fontSize: 13 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#1d4ed8', fontWeight: 500 }}>
              Sign In
            </Link>
          </Text>
        </div>
      </Card>
    </AuthLayout>
  );
};

export default RegisterPage;
