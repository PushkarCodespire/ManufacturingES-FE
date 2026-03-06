import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth.api';
import AuthLayout from '../../components/AuthLayout';
import BrandLogo from '../../components/BrandLogo';

const { Text } = Typography;

const PASSWORD_REQUIREMENTS = [
  'At least 8 characters',
  'At least 1 uppercase letter (A–Z)',
  'At least 1 number (0–9)',
];

const ChangePasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { user, updateUser }  = useAuth();
  const navigate              = useNavigate();

  const onFinish = async ({ current_password, new_password }) => {
    setLoading(true);
    setError('');
    try {
      await authApi.changePassword({ current_password, new_password });
      updateUser({ ...user, is_first_login: false });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <BrandLogo
        icon={<SafetyOutlined style={{ color: '#fff', fontSize: 26 }} />}
        title="Set Your Password"
        subtitle={`Welcome, ${user?.name ?? 'User'}. Create a secure password to continue.`}
        size={56}
      />

      <Card
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#ffffff',
          border: '1px solid #e8eaed',
          borderRadius: 12,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
        bodyStyle={{ padding: '28px 32px' }}
      >
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
            name="current_password"
            label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Current Password</span>}
            rules={[{ required: true, message: 'Enter your current password' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="Dynatech@123 if first login"
            />
          </Form.Item>

          <Form.Item
            name="new_password"
            label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>New Password</span>}
            rules={[
              { required: true, message: 'Enter a new password' },
              { min: 8, message: 'Minimum 8 characters' },
              {
                pattern: /^(?=.*[A-Z])(?=.*\d).{8,}$/,
                message: 'Must include 1 uppercase letter and 1 number',
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="Create a strong password"
            />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label={<span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>Confirm New Password</span>}
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
              placeholder="Re-enter new password"
            />
          </Form.Item>

          {/* Password requirements hint */}
          <div
            style={{
              marginBottom: 20,
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: 8,
              border: '1px solid #e8eaed',
            }}
          >
            <Text style={{ color: '#6b7280', fontSize: 12, display: 'block', marginBottom: 6, fontWeight: 500 }}>
              Password requirements:
            </Text>
            {PASSWORD_REQUIREMENTS.map((rule) => (
              <div
                key={rule}
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}
              >
                <div
                  style={{ width: 4, height: 4, borderRadius: '50%', background: '#1d4ed8', flexShrink: 0 }}
                />
                <Text style={{ color: '#6b7280', fontSize: 12 }}>{rule}</Text>
              </div>
            ))}
          </div>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{ height: 46, fontWeight: 600, fontSize: 15 }}
          >
            Set Password & Continue
          </Button>
        </Form>
      </Card>
    </AuthLayout>
  );
};

export default ChangePasswordPage;
