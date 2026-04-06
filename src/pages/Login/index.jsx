import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Divider, Segmented } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/AuthLayout';
import BrandLogo from '../../components/BrandLogo';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [loginMode, setLoginMode] = useState('employee_id'); // 'employee_id' | 'email'
  const { login, user }           = useAuth();
  const navigate                  = useNavigate();
  const [form]                    = Form.useForm();

  if (user && !user.is_first_login) {
    navigate('/dashboard');
    return null;
  }

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      const credentials =
        loginMode === 'employee_id'
          ? { employee_id: values.employee_id, password: values.password }
          : { email: values.email, password: values.password };

      const { is_first_login } = await login(credentials);
      navigate(is_first_login ? '/change-password' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (value) => {
    setLoginMode(value);
    setError('');
    form.resetFields(['employee_id', 'email']);
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
          {loginMode === 'employee_id'
            ? 'Use your Employee ID to access the platform'
            : 'Use your email address to sign in'}
        </Text>

        <Divider style={{ borderColor: '#f3f4f6', margin: '20px 0' }} />

        {/* Login mode toggle */}
        <div style={{ marginBottom: 20 }}>
          <Segmented
            value={loginMode}
            onChange={handleModeChange}
            options={[
              { label: 'Employee ID', value: 'employee_id' },
              { label: 'Email', value: 'email' },
            ]}
            block
            style={{ borderRadius: 8 }}
          />
        </div>

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

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          {loginMode === 'employee_id' ? (
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
          ) : (
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
          )}

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

        {/* Register link */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text style={{ color: '#6b7280', fontSize: 13 }}>
            New to the platform?{' '}
            <Link to="/register" style={{ color: '#1d4ed8', fontWeight: 500 }}>
              Register your company
            </Link>
          </Text>
        </div>

        {/* Demo hint */}
      </Card>
    </AuthLayout>
  );
};

export default LoginPage;
