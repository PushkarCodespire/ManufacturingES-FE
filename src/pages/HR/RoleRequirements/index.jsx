import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Checkbox, message, Spin, Card, Tag, Empty, Space,
} from 'antd';
import {
  ReloadOutlined, SaveOutlined, TeamOutlined, RightOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { roleRequirementApi } from '../../../api/roleRequirement.api';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';
import api              from '../../../api/axios';

const { Title, Text } = Typography;

const CATEGORY_COLORS = {
  Machine: 'blue', Process: 'purple', Quality: 'green',
  Safety: 'red', SOP: 'orange', Other: 'default',
};

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
const RoleRequirementsPage = () => {
  const { can } = usePermissions();
  const canWrite = can('other-role_requirements-create_edit_delete');

  const [roles,    setRoles]    = useState([]);
  const [topics,   setTopics]   = useState([]);
  const [selected, setSelected] = useState(null);   // selected role object
  const [checked,  setChecked]  = useState([]);      // topic_ids for selected role
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);

  // Load roles and active topics
  const fetchBase = useCallback(async () => {
    setRolesLoading(true);
    try {
      const [rolesRes, topicsRes] = await Promise.all([
        api.get('/users/roles').then((r) => r.data),
        api.get('/hr/training-topics', { params: { is_active: true } }).then((r) => r.data),
      ]);
      setRoles(rolesRes?.data ?? rolesRes ?? []);
      setTopics(topicsRes?.data ?? topicsRes ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load data');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => { fetchBase(); }, [fetchBase]);

  // Load requirements when a role is selected
  const loadRoleReqs = useCallback(async (roleId) => {
    setLoading(true);
    try {
      const res = await roleRequirementApi.getByRole(roleId);
      const data = res?.data ?? res ?? [];
      setChecked(data.map((r) => r.topic_id));
    } catch (err) {
      message.error(err?.message || 'Failed to load requirements');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectRole = (role) => {
    setSelected(role);
    loadRoleReqs(role.id);
  };

  const handleToggle = (topicId) => {
    if (!canWrite) return;
    setChecked((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    );
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await roleRequirementApi.bulkSaveForRole({ role_id: selected.id, topic_ids: checked });
      message.success(`Requirements saved for ${selected.label || selected.name}`);
    } catch (err) {
      message.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Group topics by category
  const grouped = topics.reduce((acc, t) => {
    const cat = t.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>HR &amp; Training</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Role Requirements</Text>
      </div>
      <Title level={3} style={{ margin: 0 }}>Role Requirements</Title>
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 20 }}>
        Define which training topics are required for each role.
      </Text>

      <div className="res-two-panel" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* ── Left: Roles Panel ─────────────────────────────── */}
        <Card
          style={{ width: 280, flexShrink: 0, border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: 0 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Roles</span>
              <Button size="small" icon={<ReloadOutlined />} type="text" onClick={fetchBase} />
            </div>
          }
        >
          {rolesLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
          ) : roles.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>No roles found</Text>
            </div>
          ) : (
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {roles.map((role) => (
                <div
                  key={role.id}
                  onClick={() => handleSelectRole(role)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    background: selected?.id === role.id ? '#eff6ff' : 'transparent',
                    borderLeft: selected?.id === role.id ? '3px solid #1d4ed8' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TeamOutlined style={{ color: selected?.id === role.id ? '#1d4ed8' : '#9ca3af', fontSize: 14 }} />
                    <Text style={{ fontSize: 13, fontWeight: selected?.id === role.id ? 600 : 400, color: selected?.id === role.id ? '#1d4ed8' : '#374151' }}>
                      {role.label || role.name}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Right: Topics Checklist ────────────────────────── */}
        <Card
          style={{ flex: 1, border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '20px 24px' }}
        >
          {!selected ? (
            <Empty
              image={<TeamOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
              imageStyle={{ height: 60 }}
              description={
                <Text style={{ color: '#9ca3af' }}>Select a role to configure requirements</Text>
              }
            />
          ) : (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <Title level={5} style={{ margin: 0, color: '#111827' }}>
                    {selected.label || selected.name}
                  </Title>
                  <Text style={{ color: '#6b7280', fontSize: 12 }}>
                    {checked.length} topic{checked.length !== 1 ? 's' : ''} required
                  </Text>
                </div>
                {canWrite && (
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={handleSave}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    Save Requirements
                  </Button>
                )}
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
              ) : topics.length === 0 ? (
                <Empty description="No active training topics found. Add topics first." />
              ) : (
                <div>
                  {Object.entries(grouped).map(([category, catTopics]) => (
                    <div key={category} style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Tag color={CATEGORY_COLORS[category] || 'default'} style={{ fontWeight: 600, fontSize: 12 }}>
                          {category}
                        </Tag>
                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>
                          {catTopics.filter((t) => checked.includes(t.id)).length}/{catTopics.length} selected
                        </Text>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                        {catTopics.map((topic) => (
                          <div
                            key={topic.id}
                            onClick={() => handleToggle(topic.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              padding: '10px 12px',
                              border: `1px solid ${checked.includes(topic.id) ? '#93c5fd' : '#e8eaed'}`,
                              borderRadius: 8,
                              background: checked.includes(topic.id) ? '#eff6ff' : '#fafafa',
                              cursor: canWrite ? 'pointer' : 'default',
                              transition: 'all 0.15s',
                            }}
                          >
                            <Checkbox
                              checked={checked.includes(topic.id)}
                              onChange={(e) => { e.stopPropagation(); handleToggle(topic.id); }}
                              disabled={!canWrite}
                              style={{ marginTop: 1 }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <Text style={{ fontSize: 13, fontWeight: 500, color: '#111827', display: 'block' }}>
                                {topic.name}
                              </Text>
                              <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                                {topic.validity_months} months validity
                              </Text>
                            </div>
                            {checked.includes(topic.id) && (
                              <CheckCircleOutlined style={{ color: '#1d4ed8', fontSize: 14, marginLeft: 'auto', flexShrink: 0 }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default RoleRequirementsPage;
