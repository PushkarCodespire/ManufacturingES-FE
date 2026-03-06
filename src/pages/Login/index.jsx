import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/AuthLayout';
import BrandLogo from '../../components/BrandLogo';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { login, user }       = useAuth();
  const navigate              = useNavigate();

  if (user && !user.is_first_login) {
    navigate('/dashboard');
    return null;
  }

  const onFinish = async ({ employee_id, password }) => {
    setLoading(true);
    setError('');
    try {
      const { is_first_login } = await login(employee_id, password);
      navigate(is_first_login ? '/change-password' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
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
          maxWidth: 420,
          background: '#ffffff',
          border: '1px solid #e8eaed',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
        bodyStyle={{ padding: '32px 32px 24px' }}
      >
        <Title level={4} style={{ color: '#111827', marginTop: 0, marginBottom: 4, fontWeight: 600 }}>
          Sign In
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Use your Employee ID to access the platform
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
          <Form.Item
            name="employee_id"
            label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Employee ID</span>}
            rules={[{ required: true, message: 'Please enter your Employee ID' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
              placeholder="e.g. DT10001"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Password</span>}
            rules={[{ required: true, message: 'Please enter your password' }]}
            style={{ marginBottom: 24 }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{ height: 46, fontWeight: 600, fontSize: 15 }}
          >
            Sign In
          </Button>
        </Form>

        {/* Demo hint */}
        <div
          style={{
            marginTop: 20,
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e8eaed',
          }}
        >
          <Text style={{ color: '#6b7280', fontSize: 12, display: 'block', marginBottom: 4, fontWeight: 500 }}>
            Demo Credentials
          </Text>
          <Text style={{ color: '#6b7280', fontSize: 12 }}>
            Employee ID: <strong style={{ color: '#111827' }}>DT10001</strong> (Plant Head)
          </Text>
          <br />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>
            Password: <strong style={{ color: '#111827' }}>Dynatech@123</strong>
          </Text>
        </div>
      </Card>
    </AuthLayout>
  );
};

export default LoginPage;
