import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, Typography, Spin } from 'antd';
import {
  MessageOutlined,
  SendOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import madadApi from '../../api/madad.api';
import ChatMessage from './ChatMessage';

const { Text } = Typography;

// ── Helpers ───────────────────────────────────────────────────────────────────
const now = () =>
  new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// ── MadadChatWidget ───────────────────────────────────────────────────────────
const MadadChatWidget = () => {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);

  const sessionId    = useRef(Date.now().toString());
  const listRef      = useRef(null);
  const historyFetched = useRef(false);

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // ── Load chat history on first open ────────────────────────────────────────
  useEffect(() => {
    if (!open || historyFetched.current) return;
    historyFetched.current = true;

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
      .catch(() => {
        // Silently ignore — first conversation
      });
  }, [open]);

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
    } catch (err) {
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
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined style={{ color: '#ffffff', fontSize: 14 }} />}
              onClick={() => setOpen(false)}
              style={{ color: '#ffffff' }}
            />
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
