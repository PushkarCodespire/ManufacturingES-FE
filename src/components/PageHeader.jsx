import React from 'react';
import { Typography, Tag } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import useScreen from '../hooks/useScreen';

const { Title, Text } = Typography;

/**
 * PageHeader — standardised page heading block.
 *
 * Original props (unchanged — backward-compatible):
 *   icon     {ReactNode}  — coloured icon box on the left
 *   title    {string}     — main heading
 *   subtitle {string}     — secondary description (optional)
 *   tag      {string}     — badge on the right (optional)
 *   color    {string}     — accent colour for icon bg + tag (default #1d4ed8)
 *
 * New props (all optional):
 *   breadcrumb {string[]}  — e.g. ['Masters', 'Configuration']
 *                            renders a › separated crumb trail above the title
 *   stats      {Array}     — [{ label, value, color, bg }]
 *                            renders stat-chip row below subtitle
 *   extra      {ReactNode} — rendered on the right (Refresh, Add New buttons, etc.)
 *                            stacks below title on mobile
 *
 * Responsive behaviour:
 *   Desktop : title row is flex row (title left, extra right)
 *   Mobile  : title row stacks vertically (extra below title)
 */
const PageHeader = ({
  // ── Original props ────────────────────────────────────────────
  icon,
  title,
  subtitle,
  tag,
  color = '#1d4ed8',
  // ── New props ─────────────────────────────────────────────────
  breadcrumb,
  stats,
  extra,
}) => {
  const { isMobile } = useScreen();

  return (
    <div style={{ marginBottom: 16 }}>

      {/* ── Breadcrumb trail ────────────────────────────────────────── */}
      {breadcrumb && breadcrumb.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={crumb}>
              {i > 0 && (
                <RightOutlined style={{ color: '#d1d5db', fontSize: 9 }} />
              )}
              <Text
                style={{
                  color:    i === breadcrumb.length - 1 ? '#6b7280' : '#9ca3af',
                  fontSize: 12,
                  fontWeight: i === breadcrumb.length - 1 ? 500 : 400,
                }}
              >
                {crumb}
              </Text>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── Title row (icon + title/subtitle + extra) ───────────────── */}
      <div
        style={{
          display:        'flex',
          alignItems:     isMobile ? 'flex-start' : 'center',
          flexDirection:  isMobile ? 'column' : 'row',
          gap:            isMobile ? 8 : 14,
          flexWrap:       'wrap',
          padding:        (icon || tag || extra) ? '16px 20px' : 0,
          background:     (icon || tag || extra) ? '#ffffff' : 'transparent',
          borderRadius:   (icon || tag || extra) ? 10 : 0,
          border:         (icon || tag || extra) ? '1px solid #e8eaed' : 'none',
          boxShadow:      (icon || tag || extra) ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
        }}
      >
        {/* Coloured icon box */}
        {icon && (
          <div
            style={{
              width:      46,
              height:     46,
              background: color,
              borderRadius: 10,
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize:   20,
              color:      '#fff',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}

        {/* Title + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Title level={3} style={{ color: '#111827', margin: 0, fontSize: isMobile ? 18 : 20 }}>
            {title}
          </Title>
          {subtitle && (
            <Text style={{ color: '#6b7280', fontSize: 13 }}>{subtitle}</Text>
          )}
        </div>

        {/* Tag (original prop) */}
        {tag && (
          <Tag
            style={{
              borderRadius: 6,
              padding:      '4px 12px',
              fontSize:     12,
              margin:       0,
              background:   `${color}12`,
              border:       `1px solid ${color}40`,
              color,
              fontWeight:   500,
            }}
          >
            {tag}
          </Tag>
        )}

        {/* Extra (new prop) — action buttons etc. */}
        {extra && (
          <div
            style={{
              display:   'flex',
              gap:       8,
              alignItems: 'center',
              flexWrap:  'wrap',
              width:     isMobile ? '100%' : undefined,
            }}
          >
            {extra}
          </div>
        )}
      </div>

      {/* ── Stat chips row (new prop) ────────────────────────────────── */}
      {stats && stats.length > 0 && (
        <div
          style={{
            display:   'flex',
            gap:       8,
            marginTop: 10,
            flexWrap:  'wrap',
          }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                padding:      '4px 12px',
                borderRadius: 20,
                background:   s.bg  || `${color}10`,
                border:       `1px solid ${s.color || color}30`,
                fontSize:     12,
                color:        s.color || color,
                fontWeight:   500,
                whiteSpace:   'nowrap',
              }}
            >
              {s.label}: <strong>{s.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
