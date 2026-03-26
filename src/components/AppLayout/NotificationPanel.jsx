import React, { useEffect, useState, useCallback } from 'react';
import {
  Drawer, Badge, Button, List, Typography, Tag, Tooltip,
  Empty, Spin, Divider,
} from 'antd';
import {
  BellOutlined,
  LockOutlined,
  KeyOutlined,
  InfoCircleOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../../api/notification.api';

const { Text } = Typography;

// ── Notification type config ──────────────────────────────────────────────────
const TYPE_CONFIG = {
  FAILED_LOGIN_ALERT: {
    icon:  <LockOutlined />,
    color: '#dc2626',
    bg:    '#fef2f2',
    label: 'Security Alert',
  },
  PASSWORD_RESET: {
    icon:  <KeyOutlined />,
    color: '#2563eb',
    bg:    '#eff6ff',
    label: 'Password Reset',
  },
  SYSTEM: {
    icon:  <InfoCircleOutlined />,
    color: '#7c3aed',
    bg:    '#f5f3ff',
    label: 'System',
  },
};

const DEFAULT_TYPE = {
  icon:  <InfoCircleOutlined />,
  color: '#6b7280',
  bg:    '#f9fafb',
  label: 'Notification',
};

const fmtTime = (iso) => {
  if (!iso) return '';
  const d    = new Date(iso);
  const now  = new Date();
  const diff = (now - d) / 1000; // seconds

  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// ─── Notification Panel (triggered by bell icon) ──────────────────────────────
const NotificationPanel = () => {
  const navigate      = useNavigate();
  const [open,        setOpen]        = useState(false);
  const [items,       setItems]       = useState([]);
  const [unread,      setUnread]      = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [markingAll,  setMarkingAll]  = useState(false);

  // ── Fetch unread count (for badge) ──────────────────────────────────────
  const fetchCount = useCallback(async () => {
    try {
      const data = await notificationApi.getUnread();
      setUnread(data?.count ?? 0);
    } catch { /* silent */ }
  }, []);

  // ── Fetch notification list ──────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationApi.getAll({ limit: 30 });
      setItems(data?.notifications ?? []);
      setUnread(data?.unreadCount  ?? 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  // Poll unread count every 60s while panel is closed
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Refresh list when drawer opens
  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  // ── Mark one as read ─────────────────────────────────────────────────────
  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnread((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  // ── Mark all as read ──────────────────────────────────────────────────────
  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch { /* silent */ }
    finally { setMarkingAll(false); }
  };

  return (
    <>
      {/* ── Bell trigger ─────────────────────────────────────────────── */}
      <Badge count={unread} size="small" color="#d97706" overflowCount={99}>
        <Button
          type="text"
          icon={<BellOutlined />}
          style={{ color: '#6b7280', fontSize: 17 }}
          onClick={() => setOpen(true)}
        />
      </Badge>

      {/* ── Notification Drawer ──────────────────────────────────────── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text style={{ color: '#111827', fontWeight: 700, fontSize: 15 }}>
                Notifications
              </Text>
              {unread > 0 && (
                <Tag
                  style={{
                    marginLeft: 8,
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#d97706',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {unread} unread
                </Tag>
              )}
            </div>
            {unread > 0 && (
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                loading={markingAll}
                onClick={handleMarkAll}
                style={{ color: '#2563eb', fontSize: 12 }}
              >
                Mark all read
              </Button>
            )}
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={380}
        styles={{
          header: {
            background: '#ffffff',
            borderBottom: '1px solid #f3f4f6',
            padding: '14px 20px',
          },
          body: {
            padding: 0,
            background: '#f8fafc',
          },
        }}
        closeIcon={null}
        footer={
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Button
              type="link"
              size="small"
              icon={<ArrowRightOutlined />}
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              style={{ color: '#2563eb', fontSize: 13 }}
            >
              View all notifications
            </Button>
          </div>
        }
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Text style={{ color: '#9ca3af', fontSize: 13 }}>No notifications yet</Text>
              }
            />
          </div>
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => {
              const cfg = TYPE_CONFIG[item.type] || DEFAULT_TYPE;
              return (
                <List.Item
                  key={item.id}
                  style={{
                    background:   item.is_read ? '#ffffff' : '#fffbf0',
                    borderBottom: '1px solid #f3f4f6',
                    padding:      '14px 20px',
                    cursor:       item.is_read ? 'default' : 'pointer',
                    transition:   'background 0.15s',
                  }}
                  onClick={() => !item.is_read && handleMarkRead(item.id)}
                >
                  <div style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'flex-start' }}>
                    {/* Type icon */}
                    <div
                      style={{
                        width:           36,
                        height:          36,
                        borderRadius:    10,
                        background:      cfg.bg,
                        border:          `1px solid ${cfg.color}25`,
                        display:         'flex',
                        alignItems:      'center',
                        justifyContent:  'center',
                        color:           cfg.color,
                        fontSize:        15,
                        flexShrink:      0,
                      }}
                    >
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Text
                          style={{
                            color:      '#111827',
                            fontWeight: item.is_read ? 500 : 700,
                            fontSize:   13,
                          }}
                        >
                          {item.title}
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 11, flexShrink: 0, marginLeft: 8 }}>
                          {fmtTime(item.createdAt)}
                        </Text>
                      </div>

                      <Text
                        style={{
                          color:    item.is_read ? '#9ca3af' : '#374151',
                          fontSize: 12,
                          display:  'block',
                          lineHeight: 1.5,
                        }}
                      >
                        {item.message}
                      </Text>

                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tag
                          style={{
                            background:  cfg.bg,
                            border:      `1px solid ${cfg.color}30`,
                            color:       cfg.color,
                            borderRadius: 20,
                            fontSize:    10,
                            padding:     '0 8px',
                          }}
                        >
                          {cfg.label}
                        </Tag>
                        {item.is_read && (
                          <Text style={{ color: '#9ca3af', fontSize: 10 }}>
                            <CheckOutlined /> Read
                          </Text>
                        )}
                      </div>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </Drawer>
    </>
  );
};

export default NotificationPanel;
