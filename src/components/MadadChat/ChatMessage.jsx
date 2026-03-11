import React from 'react';
import { Avatar } from 'antd';

// ── Lightweight markdown helpers ──────────────────────────────────────────────
// Supports **bold** and bullet-point lines starting with "- " or "* ".
const renderMarkdown = (text) => {
  if (!text) return null;

  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    // Bullet points
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.*)/);
    const isBullet = Boolean(bulletMatch);
    const content = isBullet ? bulletMatch[1] : line;

    // Bold: **text**
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, i) => {
      const boldMatch = part.match(/^\*\*(.+)\*\*$/);
      if (boldMatch) {
        return <strong key={i}>{boldMatch[1]}</strong>;
      }
      return part;
    });

    if (isBullet) {
      return (
        <div key={lineIdx} style={{ paddingLeft: 12, position: 'relative', lineHeight: '22px' }}>
          <span style={{ position: 'absolute', left: 0 }}>&bull;</span>
          {rendered}
        </div>
      );
    }

    return (
      <React.Fragment key={lineIdx}>
        {rendered}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

// ── ChatMessage ───────────────────────────────────────────────────────────────
const ChatMessage = ({ role, text, timestamp }) => {
  const isUser = role === 'user';

  return (
    <div
      style={{
        display:        'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom:   10,
        gap:            8,
        alignItems:     'flex-end',
      }}
    >
      {/* AI avatar on the left */}
      {!isUser && (
        <Avatar
          size={28}
          style={{
            backgroundColor: '#1d4ed8',
            color:           '#ffffff',
            fontSize:        13,
            fontWeight:      700,
            flexShrink:      0,
          }}
        >
          M
        </Avatar>
      )}

      {/* Message bubble */}
      <div style={{ maxWidth: '78%' }}>
        <div
          style={{
            padding:      '8px 12px',
            borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            background:   isUser ? '#1d4ed8' : '#ffffff',
            color:        isUser ? '#ffffff' : '#111827',
            fontSize:     13,
            lineHeight:   '20px',
            wordBreak:    'break-word',
            boxShadow:    isUser ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
            border:       isUser ? 'none' : '1px solid #e5e7eb',
          }}
        >
          {renderMarkdown(text)}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <div
            style={{
              fontSize:  10,
              color:     '#9ca3af',
              marginTop: 3,
              textAlign: isUser ? 'right' : 'left',
            }}
          >
            {timestamp}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
