import React, { useState } from 'react';
import {
  Card, Form, Input, Button, Typography, Alert, Modal,
  Tag, Space, Divider,
} from 'antd';
import {
  KeyOutlined,
  UserOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { authApi } from '../../../api/auth.api';
import AppLayout from '../../../components/AppLayout';

const { Title, Text } = Typography;

/**
 * SYS-003: Admin Password Reset Page
 * Only accessible by IT Admin and Plant Head (enforced by ProtectedRoute + backend).
 *
 * Flow:
 *   1. Admin enters Employee ID
 *   2. Backend generates temp password, sets is_first_login=true, revokes sessions
 *   3. Admin communicates temp password to employee (shown in success modal)
 *   4. Employee logs in → forced to change password (SYS-002)
 */
const ResetPasswordPage = () => {
  const [form]       = Form.useForm();
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [result,     setResult]     = useState(null);  // { employee_id, name, temp_password }
  const [copied,     setCopied]     = useState(false);

  const onFinish = async ({ employee_id }) => {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.resetPassword({ employee_id: employee_id.trim() });
      setResult(res.data);
      form.resetFields();
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.temp_password) {
      navigator.clipboard.writeText(result.temp_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => setResult(null);

  return (
    <AppLayout>
      {/* Page heading */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Admin — Reset Employee Password
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          SYS-003 · Generate a temporary password for any employee (IT Admin / Plant Head only)
        </Text>
      </div>

      <div style={{ maxWidth: 500 }}>
        <Card
          style={{
            background:   '#ffffff',
            border:       '1px solid #e8eaed',
            borderRadius: 12,
            boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
          }}
          bodyStyle={{ padding: '28px 32px' }}
        >
          {/* Warning banner */}
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message="This action will immediately invalidate the employee's current password and all active sessions."
            style={{ marginBottom: 24, borderRadius: 8 }}
          />

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

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
            size="large"
          >
            <Form.Item
              name="employee_id"
              label={
                <span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>
                  Employee ID
                </span>
              }
              rules={[{ required: true, message: 'Please enter the Employee ID' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
                placeholder="e.g. DT11002"
                style={{ textTransform: 'uppercase' }}
              />
            </Form.Item>

            <Divider style={{ borderColor: '#f3f4f6', margin: '4px 0 20px' }} />

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              icon={<KeyOutlined />}
              style={{
                height:     46,
                fontWeight: 600,
                fontSize:   14,
                background: '#dc2626',
                borderColor:'#dc2626',
              }}
            >
              Reset Password
            </Button>
          </Form>

          {/* Info card */}
          <div
            style={{
              marginTop:    20,
              padding:      '12px 16px',
              background:   '#f8fafc',
              borderRadius: 8,
              border:       '1px solid #e8eaed',
            }}
          >
            <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              What happens on reset:
            </Text>
            {[
              'A secure temporary password is generated',
              'Employee is forced to change it on next login (SYS-002)',
              'All active sessions are revoked immediately',
              'Employee receives an in-app notification',
            ].map((line) => (
              <div key={line} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#6b7280', marginTop: 6, flexShrink: 0 }} />
                <Text style={{ color: '#6b7280', fontSize: 12 }}>{line}</Text>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Success Modal — shows temp password ────────────────────────── */}
      <Modal
        open={!!result}
        onCancel={handleClose}
        footer={
          <Button type="primary" onClick={handleClose} style={{ background: '#16a34a', borderColor: '#16a34a' }}>
            Done
          </Button>
        }
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 18 }} />
            <span style={{ color: '#111827', fontWeight: 700 }}>Password Reset Successful</span>
          </div>
        }
        width={440}
        centered
      >
        {result && (
          <div>
            <div
              style={{
                padding:      '12px 16px',
                background:   '#f0fdf4',
                border:       '1px solid #bbf7d0',
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <Text style={{ color: '#15803d', fontSize: 13 }}>
                Password reset for <strong>{result.name}</strong> ({result.employee_id})
              </Text>
            </div>

            <Text style={{ color: '#374151', fontSize: 13, display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Temporary Password — communicate this to the employee:
            </Text>

            <div
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          10,
                padding:      '12px 16px',
                background:   '#f8fafc',
                border:       '1px solid #e8eaed',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: 'monospace',
                  fontSize:   18,
                  fontWeight: 700,
                  color:      '#111827',
                  flex:       1,
                  letterSpacing: '0.08em',
                }}
              >
                {result.temp_password}
              </Text>
              <Button
                size="small"
                icon={copied ? <CheckCircleOutlined style={{ color: '#16a34a' }} /> : <CopyOutlined />}
                onClick={handleCopy}
                style={{ color: copied ? '#16a34a' : '#6b7280' }}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <Alert
              type="warning"
              showIcon
              message="This password will not be shown again. Please note it down before closing."
              style={{ borderRadius: 6 }}
            />
          </div>
        )}
      </Modal>
    </AppLayout>
  );
};

export default ResetPasswordPage;
