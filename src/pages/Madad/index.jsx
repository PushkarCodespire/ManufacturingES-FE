import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, Typography, Spin, Tooltip, Empty } from 'antd';
import {
  PlusOutlined,
  SendOutlined,
  DeleteOutlined,
  MessageOutlined,
  CommentOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import madadApi from '../../api/madad.api';
import ChatMessage from '../../components/MadadChat/ChatMessage';

const { Text, Title } = Typography;

// ── Helpers ───────────────────────────────────────────────────────────────────
const nowTime = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// ── MadadPage ─────────────────────────────────────────────────────────────────
const MadadPage = () => {
  const [searchParams]      = useSearchParams();
  const [sessions, setSessions]               = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSession, setActiveSession]     = useState(null);
  const [messages, setMessages]               = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput]                     = useState('');
  const [sending, setSending]                 = useState(false);

  const listRef   = useRef(null);
  const sessionId = useRef(null);

  // ── Load session list ──────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res  = await madadApi.getSessions();
      const list = res?.data ?? res ?? [];
      const arr  = Array.isArray(list) ? list : [];
      setSessions(arr);
      return arr;
    } catch {
      setSessions([]);
      return [];
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // ── On mount: load sessions, then activate correct one ────────────────────
  useEffect(() => {
    loadSessions().then((list) => {
      const qsSession = searchParams.get('session');
      if (qsSession && list.find((s) => s.session_id === qsSession)) {
        selectSession(qsSession);
      } else if (list.length > 0) {
        selectSession(list[0].session_id);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load messages for a session ───────────────────────────────────────────
  const selectSession = useCallback(async (sid) => {
    setActiveSession(sid);
    sessionId.current = sid;
    setMessages([]);
    setInput('');
    setMessagesLoading(true);
    try {
      const res  = await madadApi.getHistory({ session_id: sid });
      const hist = res?.data ?? res ?? [];
      setMessages(Array.isArray(hist) ? hist : []);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, [messages, sending]);

  // ── New chat ──────────────────────────────────────────────────────────────
  const handleNewChat = () => {
    const newSid = Date.now().toString();
    sessionId.current = newSid;
    setActiveSession(newSid);
    setMessages([]);
    setInput('');
    // Keep widget in sync
    try {
      localStorage.setItem('madad_session_id', JSON.stringify(newSid));
      localStorage.setItem('madad_messages', JSON.stringify([]));
    } catch { /* quota */ }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    if (!sessionId.current) handleNewChat();

    const userMsg = { role: 'user', text: trimmed, timestamp: nowTime() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res   = await madadApi.sendMessage({
        message:      trimmed,
        page_context: '/madad',
        session_id:   sessionId.current,
      });
      const reply = res?.data ?? res;
      setMessages((prev) => [
        ...prev,
        {
          role:      'assistant',
          text:      reply?.text ?? reply?.message ?? reply?.content ?? 'Samajh nahi aaya.',
          timestamp: nowTime(),
        },
      ]);
      // Refresh session list (updates preview + last_at)
      loadSessions().then((list) => {
        if (!sessions.find((s) => s.session_id === sessionId.current)) {
          setSessions(list);
        }
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Maaf karna, kuch gadbad ho gayi.', timestamp: nowTime() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div
        style={{
          display:    'flex',
          height:     'calc(100vh - 52px)',
          overflow:   'hidden',
          background: '#f4f6f9',
          margin:     '-20px -24px',  /* cancel AppLayout Content padding so it fills edge-to-edge */
        }}
      >
        {/* ── Left panel: session list ──────────────────────────────────── */}
        <div
          style={{
            width:        280,
            flexShrink:   0,
            background:   '#ffffff',
            borderRight:  '1px solid #e5e7eb',
            display:      'flex',
            flexDirection:'column',
          }}
        >
          {/* Header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <MessageOutlined style={{ color: '#1d4ed8', fontSize: 18 }} />
              <Title level={5} style={{ margin: 0, color: '#1d4ed8' }}>Madad</Title>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              block
              onClick={handleNewChat}
              style={{ background: '#1d4ed8', borderColor: '#1d4ed8' }}
            >
              New Chat
            </Button>
          </div>

          {/* Session list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {sessionsLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>
                Abhi tak koi baat nahi hui
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = s.session_id === activeSession;
                return (
                  <div
                    key={s.session_id}
                    onClick={() => selectSession(s.session_id)}
                    style={{
                      padding:        '10px 16px',
                      cursor:         'pointer',
                      background:     isActive ? '#eff6ff' : 'transparent',
                      borderLeft:     isActive ? '3px solid #1d4ed8' : '3px solid transparent',
                      transition:     'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        display:        'flex',
                        justifyContent: 'space-between',
                        alignItems:     'flex-start',
                        gap:            6,
                        marginBottom:   2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize:          13,
                          fontWeight:        isActive ? 600 : 400,
                          color:             '#111827',
                          flex:              1,
                          overflow:          'hidden',
                          display:           '-webkit-box',
                          WebkitLineClamp:   2,
                          WebkitBoxOrient:   'vertical',
                          lineHeight:        '18px',
                        }}
                      >
                        {s.first_message?.slice(0, 65) || 'New conversation'}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, marginTop: 2 }}>
                        {fmtDate(s.last_at)}
                      </Text>
                    </div>
                    <Text style={{ fontSize: 11, color: '#6b7280' }}>
                      {s.message_count} {s.message_count === 1 ? 'message' : 'messages'}
                    </Text>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right panel: chat area ────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeSession ? (
            <>
              {/* Chat header */}
              <div
                style={{
                  background:     '#1d4ed8',
                  color:          '#ffffff',
                  padding:        '12px 20px',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  flexShrink:     0,
                  boxShadow:      '0 1px 4px rgba(0,0,0,0.12)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CommentOutlined style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }} />
                  <Text strong style={{ color: '#ffffff', fontSize: 15 }}>
                    Madad Assistant
                  </Text>
                </div>
                <Tooltip title="Is session ke messages saaf karo">
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }} />}
                    onClick={() => setMessages([])}
                  />
                </Tooltip>
              </div>

              {/* Messages */}
              <div
                ref={listRef}
                style={{
                  flex:       1,
                  overflowY:  'auto',
                  padding:    16,
                  background: '#f9fafb',
                }}
              >
                {messagesLoading ? (
                  <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', marginTop: 80, color: '#9ca3af', fontSize: 14 }}>
                    <MessageOutlined style={{ fontSize: 36, marginBottom: 12, display: 'block' }} />
                    Madad se baat karo — koi bhi sawal poochho!
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <ChatMessage
                      key={idx}
                      role={msg.role}
                      text={msg.text}
                      timestamp={msg.timestamp}
                    />
                  ))
                )}

                {sending && (
                  <div
                    style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        8,
                      padding:    '6px 0',
                      color:      '#6b7280',
                      fontSize:   12,
                    }}
                  >
                    <Spin size="small" />
                    <span>Madad soch raha hai...</span>
                  </div>
                )}
              </div>

              {/* Input area */}
              <div
                style={{
                  display:    'flex',
                  alignItems: 'flex-end',
                  gap:        8,
                  padding:    '12px 16px',
                  borderTop:  '1px solid #e5e7eb',
                  background: '#ffffff',
                  flexShrink: 0,
                }}
              >
                <Input.TextArea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Madad se poochho..."
                  autoSize={{ minRows: 1, maxRows: 5 }}
                  style={{ flex: 1, resize: 'none', borderRadius: 8 }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={sending}
                  disabled={!input.trim()}
                  style={{ borderRadius: 8, flexShrink: 0 }}
                />
              </div>
            </>
          ) : (
            <div
              style={{
                flex:            1,
                display:         'flex',
                flexDirection:   'column',
                alignItems:      'center',
                justifyContent:  'center',
                color:           '#9ca3af',
              }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: '#9ca3af', fontSize: 14 }}>
                    Koi session chuniye ya naya chat shuru karein
                  </span>
                }
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={handleNewChat}>
                  New Chat
                </Button>
              </Empty>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default MadadPage;
