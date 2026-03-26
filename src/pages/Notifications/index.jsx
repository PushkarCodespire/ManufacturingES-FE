import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Tag, Spin, Empty, Badge,
} from 'antd';
import {
  BellOutlined, CheckCircleOutlined, LockOutlined, KeyOutlined,
  InfoCircleOutlined, CheckOutlined, RightOutlined, ReloadOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import { notificationApi } from '../../api/notification.api';

const { Title, Text } = Typography;

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  FAILED_LOGIN_ALERT: {
    icon: <LockOutlined />, color: '#dc2626', bg: '#fef2f2', label: 'Security Alert',
  },
  PASSWORD_RESET: {
    icon: <KeyOutlined />, color: '#2563eb', bg: '#eff6ff', label: 'Password Reset',
  },
  SYSTEM: {
    icon: <InfoCircleOutlined />, color: '#7c3aed', bg: '#f5f3ff', label: 'System',
  },
};
const DEFAULT_TYPE = { icon: <InfoCircleOutlined />, color: '#6b7280', bg: '#f9fafb', label: 'Notification' };

// ── Time formatter ────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return '';
  const d   = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Group notifications by date bucket ───────────────────────────────────────
function groupByDate(items) {
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);

  const groups = { Today: [], 'This Week': [], Older: [] };
  for (const n of items) {
    const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
    if (d >= today)     groups['Today'].push(n);
    else if (d >= weekStart) groups['This Week'].push(n);
    else                groups['Older'].push(n);
  }
  return groups;
}

// ── Single notification card ──────────────────────────────────────────────────
function NotifCard({ item, onMarkRead }) {
  const cfg = TYPE_CONFIG[item.type] || DEFAULT_TYPE;
  return (
    <div
      onClick={() => !item.is_read && onMarkRead(item.id)}
      style={{
        display:      'flex',
        gap:          14,
        padding:      '14px 18px',
        background:   item.is_read ? '#ffffff' : '#fffbf0',
        borderBottom: '1px solid #f3f4f6',
        cursor:       item.is_read ? 'default' : 'pointer',
        transition:   'background 0.15s',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: cfg.bg, border: `1px solid ${cfg.color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cfg.color, fontSize: 16,
        }}
      >
        {cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ fontWeight: item.is_read ? 500 : 700, fontSize: 13, color: '#111827' }}>
            {item.title}
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>
            {fmtTime(item.createdAt)}
          </Text>
        </div>
        <Text style={{ color: item.is_read ? '#9ca3af' : '#374151', fontSize: 12, display: 'block', marginTop: 2, lineHeight: 1.5 }}>
          {item.message}
        </Text>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag
            style={{
              background: cfg.bg, border: `1px solid ${cfg.color}30`, color: cfg.color,
              borderRadius: 20, fontSize: 10, padding: '0 8px',
            }}
          >
            {cfg.label}
          </Tag>
          {item.is_read && (
            <Text style={{ color: '#9ca3af', fontSize: 10 }}>
              <CheckOutlined style={{ marginRight: 3 }} />Read
            </Text>
          )}
          {!item.is_read && (
            <Badge dot color="#d97706" style={{ marginLeft: 2 }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const navigate       = useNavigate();
  const [items,        setItems]       = useState([]);
  const [unread,       setUnread]      = useState(0);
  const [loading,      setLoading]     = useState(false);
  const [markingAll,   setMarkingAll]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationApi.getAll({ limit: 100 });
      setItems(data?.notifications ?? []);
      setUnread(data?.unreadCount  ?? 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnread((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch { /* silent */ }
    finally { setMarkingAll(false); }
  };

  const groups = groupByDate(items);

  return (
    <AppLayout>
      <div style={{ padding: '0 0 24px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Home</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Notifications</Text>
        </div>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ color: '#6b7280', paddingLeft: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Title level={3} style={{ margin: 0 }}>Notification Center</Title>
              {unread > 0 && (
                <Tag
                  style={{
                    background: '#fef3c7', border: '1px solid #fde68a',
                    color: '#d97706', borderRadius: 20, fontWeight: 700,
                  }}
                >
                  {unread} unread
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              All your in-app alerts and system notifications.
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Refresh
            </Button>
            {unread > 0 && (
              <Button
                icon={<CheckCircleOutlined />}
                onClick={handleMarkAll}
                loading={markingAll}
                style={{ color: '#2563eb', borderColor: '#2563eb' }}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <Spin spinning={loading}>
          {items.length === 0 && !loading ? (
            <Card style={{ borderRadius: 12, textAlign: 'center', padding: 32 }}>
              <Empty
                image={<BellOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
                description={<Text type="secondary">No notifications yet</Text>}
              />
            </Card>
          ) : (
            <>
              {['Today', 'This Week', 'Older'].map((group) => {
                const groupItems = groups[group];
                if (groupItems.length === 0) return null;
                const groupUnread = groupItems.filter((n) => !n.is_read).length;
                return (
                  <div key={group} style={{ marginBottom: 20 }}>
                    {/* Group header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {group}
                      </Text>
                      <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                      {groupUnread > 0 && (
                        <Tag color="orange" style={{ borderRadius: 20, fontSize: 10 }}>
                          {groupUnread} unread
                        </Tag>
                      )}
                    </div>

                    {/* Cards */}
                    <Card
                      style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}
                      bodyStyle={{ padding: 0 }}
                    >
                      {groupItems.map((item) => (
                        <NotifCard key={item.id} item={item} onMarkRead={handleMarkRead} />
                      ))}
                    </Card>
                  </div>
                );
              })}
            </>
          )}
        </Spin>
      </div>
    </AppLayout>
  );
}
