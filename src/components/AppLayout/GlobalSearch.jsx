import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input, Spin, Typography, Tag } from 'antd';
import {
  SearchOutlined,
  FileTextOutlined,
  ToolOutlined,
  UserOutlined,
  ShopOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  FileDoneOutlined,
  AppstoreOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const { Text } = Typography;

// ── Icon map from backend `icon` string ──────────────────────────────────────
const ICON_MAP = {
  'box':           <AppstoreOutlined style={{ color: '#7c3aed' }} />,
  'file-text':     <FileTextOutlined style={{ color: '#1d4ed8' }} />,
  'tool':          <ToolOutlined     style={{ color: '#b45309' }} />,
  'user':          <UserOutlined     style={{ color: '#0d9488' }} />,
  'shop':          <ShopOutlined     style={{ color: '#16a34a' }} />,
  'shopping-cart': <ShoppingCartOutlined style={{ color: '#dc2626' }} />,
  'inbox':         <InboxOutlined    style={{ color: '#d97706' }} />,
  'file-done':     <FileDoneOutlined style={{ color: '#6b7280' }} />,
};

// ── Tag colour per module type ────────────────────────────────────────────────
const TAG_COLOR = {
  'Items':           'purple',
  'Work Orders':     'blue',
  'Machines':        'gold',
  'Employees':       'cyan',
  'Vendors':         'green',
  'Customer Orders': 'red',
  'GRNs':            'orange',
  'Purchase Orders': 'default',
};

let debounceTimer = null;

export default function GlobalSearch() {
  const navigate    = useNavigate();
  const inputRef    = useRef(null);
  const dropdownRef = useRef(null);
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);

  // ── Search with 300 ms debounce ─────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(q)}&limit=5`);
      setResults(res.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    clearTimeout(debounceTimer);
    if (!val.trim()) { setResults([]); return; }
    debounceTimer = setTimeout(() => doSearch(val), 300);
  };

  // ── Navigate on result click ─────────────────────────────────────────────
  const handleSelect = (link) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    navigate(link);
  };

  // ── Close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current   && !inputRef.current.input.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const totalResults = results.reduce((s, g) => s + g.items.length, 0);

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Input ── */}
      <Input
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onFocus={() => query && setOpen(true)}
        placeholder="Search items, WOs, machines…"
        prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
        suffix={
          query ? (
            <CloseOutlined
              style={{ color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}
              onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            />
          ) : null
        }
        style={{
          width:        220,
          borderRadius: 20,
          border:       '1px solid #e5e7eb',
          background:   '#f9fafb',
          fontSize:     13,
          height:       32,
        }}
        allowClear={false}
      />

      {/* ── Dropdown ── */}
      {open && (query.trim()) && (
        <div
          ref={dropdownRef}
          style={{
            position:    'absolute',
            top:         '100%',
            left:        0,
            zIndex:      9999,
            width:       360,
            marginTop:   6,
            background:  '#ffffff',
            borderRadius: 12,
            boxShadow:   '0 8px 32px rgba(0,0,0,0.12)',
            border:      '1px solid #e5e7eb',
            maxHeight:   420,
            overflowY:   'auto',
          }}
        >
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <Spin size="small" />
              <Text style={{ display: 'block', color: '#9ca3af', fontSize: 12, marginTop: 8 }}>
                Searching…
              </Text>
            </div>
          ) : totalResults === 0 ? (
            <div style={{ padding: '16px 20px' }}>
              <Text style={{ color: '#9ca3af', fontSize: 13 }}>
                No results for "<strong>{query}</strong>"
              </Text>
            </div>
          ) : (
            <>
              {/* Total count bar */}
              <div style={{ padding: '8px 16px 6px', borderBottom: '1px solid #f3f4f6' }}>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>
                  {totalResults} result{totalResults !== 1 ? 's' : ''} found
                </Text>
              </div>

              {results.map((group) => (
                <div key={group.type}>
                  {/* Group header */}
                  <div
                    style={{
                      padding:     '8px 16px 4px',
                      display:     'flex',
                      alignItems:  'center',
                      gap:         6,
                      background:  '#f8fafc',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{ICON_MAP[group.icon]}</span>
                    <Text style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {group.type}
                    </Text>
                    <Tag color={TAG_COLOR[group.type] || 'default'} style={{ marginLeft: 'auto', fontSize: 10, borderRadius: 20, lineHeight: '16px' }}>
                      {group.items.length}
                    </Tag>
                  </div>

                  {/* Items */}
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item.link)}
                      style={{
                        padding:    '9px 16px',
                        cursor:     'pointer',
                        borderBottom: '1px solid #f9fafb',
                        transition: 'background 0.12s',
                        display:    'flex',
                        alignItems: 'center',
                        gap:        10,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 14, color: '#9ca3af' }}>{ICON_MAP[group.icon]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: 500, color: '#111827', display: 'block' }}>
                          {item.label}
                        </Text>
                        {item.sublabel && (
                          <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                            {item.sublabel}
                          </Text>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
