import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, Typography, Spin, Tooltip } from 'antd';
import {
  MessageOutlined,
  SendOutlined,
  CloseOutlined,
  DeleteOutlined,
  ExpandAltOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import madadApi from '../../api/madad.api';
import ChatMessage from './ChatMessage';

const { Text } = Typography;

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_MESSAGES   = 'madad_messages';
const LS_SESSION_ID = 'madad_session_id';
const LS_OPEN       = 'madad_open';
const MAX_STORED    = 100; // keep last 100 messages

// ── Helpers ───────────────────────────────────────────────────────────────────
const now = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

// ── MadadChatWidget ───────────────────────────────────────────────────────────
const MadadChatWidget = () => {
  // Restore from localStorage on first render
  const [open, setOpen]         = useState(() => lsGet(LS_OPEN, false));
  const [messages, setMessages] = useState(() => lsGet(LS_MESSAGES, []));
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Stable session ID — reuse across navigations/refreshes
  const sessionId = useRef(
    lsGet(LS_SESSION_ID, null) || Date.now().toString(),
  );

  const location       = useLocation();
  const navigate       = useNavigate();
  const listRef        = useRef(null);
  const containerRef   = useRef(null);
  const fabRef         = useRef(null);
  const historyFetched = useRef(false);

  // ── Close on navigation ────────────────────────────────────────────────────
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e) => {
      const insideChat = containerRef.current?.contains(e.target);
      const insideFab  = fabRef.current?.contains(e.target);
      if (!insideChat && !insideFab) setOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // Persist session ID once
  useEffect(() => { lsSet(LS_SESSION_ID, sessionId.current); }, []);

  // Persist messages whenever they change
  useEffect(() => {
    lsSet(LS_MESSAGES, messages.slice(-MAX_STORED));
  }, [messages]);

  // Persist open state whenever it changes
  useEffect(() => { lsSet(LS_OPEN, open); }, [open]);

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);

  // When chat opens, wait one frame for the list div to mount, then scroll to bottom
  useEffect(() => {
    if (open) requestAnimationFrame(() => scrollToBottom());
  }, [open, scrollToBottom]);

  // ── Load chat history from API (only if localStorage is empty) ─────────────
  useEffect(() => {
    if (!open || historyFetched.current) return;
    historyFetched.current = true;
    if (messages.length > 0) return; // already have local history

    madadApi
      .getHistory({ session_id: sessionId.current })
      .then((res) => {
        const history = res?.data ?? res ?? [];
        if (Array.isArray(history) && history.length > 0) {
          setMessages(
            history.map((m) => ({
              role:      m.role,
              text:      m.text ?? m.message ?? m.content ?? '',
              timestamp: m.timestamp ?? now(),
            })),
          );
        }
      })
      .catch(() => { /* Silently ignore — first conversation */ });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear chat ─────────────────────────────────────────────────────────────
  const handleClear = () => {
    setMessages([]);
    // Reset session so server also starts fresh
    const newSid = Date.now().toString();
    sessionId.current = newSid;
    lsSet(LS_SESSION_ID, newSid);
    historyFetched.current = false;
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', text: trimmed, timestamp: now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await madadApi.sendMessage({
        message:      trimmed,
        page_context: window.location.pathname,
        session_id:   sessionId.current,
      });

      const reply = res?.data ?? res;
      const aiMsg = {
        role:      'assistant',
        text:      reply?.text ?? reply?.message ?? reply?.content ?? 'Samajh nahi aaya, phir se try karo.',
        timestamp: now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role:      'assistant',
          text:      'Maaf karna, kuch gadbad ho gayi. Thodi der baad try karo.',
          timestamp: now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Key handler: Enter to send, Shift+Enter for newline ────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Chat window ──────────────────────────────────────────────────── */}
      {open && (
        <div
          ref={containerRef}
          style={{
            position:      'fixed',
            bottom:        90,
            right:         24,
            width:         400,
            height:        520,
            zIndex:        1001,
            borderRadius:  12,
            overflow:      'hidden',
            display:       'flex',
            flexDirection: 'column',
            boxShadow:     '0 8px 32px rgba(0,0,0,0.18)',
            border:        '1px solid #e5e7eb',
            background:    '#f9fafb',
          }}
        >
          {/* Header */}
          <div
            style={{
              background:     '#1d4ed8',
              color:          '#ffffff',
              padding:        '12px 16px',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              flexShrink:     0,
            }}
          >
            <Text strong style={{ color: '#ffffff', fontSize: 15 }}>
              Madad
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tooltip title="Full page mein kholein">
                <Button
                  type="text"
                  size="small"
                  icon={<ExpandAltOutlined style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }} />}
                  onClick={() => navigate(`/madad?session=${sessionId.current}`)}
                  style={{ color: '#ffffff' }}
                />
              </Tooltip>
              <Tooltip title="Chat saaf karo">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }} />}
                  onClick={handleClear}
                  style={{ color: '#ffffff' }}
                />
              </Tooltip>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined style={{ color: '#ffffff', fontSize: 14 }} />}
                onClick={() => setOpen(false)}
                style={{ color: '#ffffff' }}
              />
            </div>
          </div>

          {/* Message list */}
          <div
            ref={listRef}
            style={{
              flex:       1,
              overflowY:  'auto',
              padding:    12,
              background: '#f9fafb',
            }}
          >
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', marginTop: 60, color: '#9ca3af', fontSize: 13 }}>
                Madad se baat karo — koi bhi sawal poochho!
              </div>
            )}

            {messages.map((msg, idx) => (
              <ChatMessage
                key={idx}
                role={msg.role}
                text={msg.text}
                timestamp={msg.timestamp}
              />
            ))}

            {/* Typing indicator */}
            {loading && (
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
              display:     'flex',
              alignItems:  'flex-end',
              gap:         8,
              padding:     '10px 12px',
              borderTop:   '1px solid #e5e7eb',
              background:  '#ffffff',
              flexShrink:  0,
            }}
          >
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Madad se poochho..."
              autoSize={{ minRows: 1, maxRows: 3 }}
              style={{ flex: 1, resize: 'none', borderRadius: 8 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
              disabled={!input.trim()}
              style={{ borderRadius: 8, flexShrink: 0 }}
            />
          </div>
        </div>
      )}

      {/* ── Floating action button ───────────────────────────────────────── */}
      <Button
        ref={fabRef}
        type="primary"
        shape="circle"
        size="large"
        icon={<MessageOutlined style={{ fontSize: 24 }} />}
        onClick={() => setOpen((o) => !o)}
        style={{
          position:   'fixed',
          bottom:     24,
          right:      24,
          zIndex:     1000,
          width:      56,
          height:     56,
          boxShadow:  '0 4px 14px rgba(29,78,216,0.4)',
          background: '#1d4ed8',
          border:     'none',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </>
  );
};

export default MadadChatWidget;
