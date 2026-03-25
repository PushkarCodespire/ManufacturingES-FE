import React from 'react';
import { Table, Card, List, Space } from 'antd';
import useScreen from '../hooks/useScreen';

/**
 * ResponsiveTable — drop-in replacement for antd <Table>.
 *
 * Desktop / tablet  : renders a standard antd <Table> (100 % pass-through,
 *                     all props forwarded unchanged).
 * Mobile (< 768 px) : renders each row as a <Card> inside a <List>.
 *                     - First column  → card title (bold)
 *                     - Middle cols   → two-column label/value grid
 *                     - Actions col   → full-width row at card bottom
 *
 * Usage — replace <Table with <ResponsiveTable, everything else stays the same:
 *
 *   <ResponsiveTable
 *     rowKey="id"
 *     columns={columns}
 *     dataSource={data}
 *     loading={loading}
 *     pagination={{ pageSize: 20 }}
 *     scroll={{ x: 1200 }}
 *   />
 *
 * The `scroll` prop is ignored on mobile (not needed for the card layout).
 * All other antd Table props (onChange, rowSelection, expandable, etc.) are
 * forwarded on desktop and silently dropped on mobile since they don't apply
 * to a list-of-cards layout.
 */
const ResponsiveTable = ({ columns = [], dataSource = [], rowKey, loading, pagination, scroll, ...rest }) => {
  const { isMobile } = useScreen();

  // ── Desktop / tablet: pure pass-through ────────────────────────────────────
  if (!isMobile) {
    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey}
        loading={loading}
        pagination={pagination}
        scroll={scroll}
        {...rest}
      />
    );
  }

  // ── Mobile: card-list layout ───────────────────────────────────────────────
  // Identify the actions column (last column with key/dataIndex 'actions', or
  // the last column that has no dataIndex — common pattern for action buttons).
  const actionCol = columns.find(
    (c) => c.key === 'actions' || c.dataIndex === 'actions' || (!c.dataIndex && c.render),
  );
  const dataColumns = columns.filter((c) => c !== actionCol);

  // Helper: safely call a column's render function or fall back to raw value
  const renderCell = (col, record) => {
    const raw = col.dataIndex ? record[col.dataIndex] : undefined;
    if (col.render) {
      try { return col.render(raw, record); }
      catch { return raw ?? '—'; }
    }
    return raw ?? '—';
  };

  return (
    <List
      loading={loading}
      dataSource={dataSource}
      rowKey={rowKey}
      pagination={
        pagination === false
          ? false
          : {
              size: 'small',
              showSizeChanger: false,
              ...(typeof pagination === 'object' ? pagination : {}),
            }
      }
      renderItem={(record) => {
        const [titleCol, ...restCols] = dataColumns;

        return (
          <Card
            size="small"
            style={{
              marginBottom: 8,
              border:       '1px solid #e8eaed',
              borderRadius: 8,
              boxShadow:    '0 1px 3px rgba(0,0,0,0.04)',
            }}
            styles={{ body: { padding: '10px 14px' } }}
          >
            {/* ── Card title: first column value ── */}
            {titleCol && (
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 8 }}>
                {renderCell(titleCol, record)}
              </div>
            )}

            {/* ── Middle columns: label/value pairs in a 2-col grid ── */}
            {restCols.length > 0 && (
              <div
                style={{
                  display:             'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap:                 '6px 16px',
                  marginBottom:        actionCol ? 8 : 0,
                }}
              >
                {restCols.map((col) => {
                  const key = col.key || col.dataIndex || col.title;
                  return (
                    <div key={key}>
                      <div
                        style={{
                          fontSize:      10,
                          color:         '#9ca3af',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom:  2,
                          fontWeight:    500,
                        }}
                      >
                        {col.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#374151' }}>
                        {renderCell(col, record)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Actions row at card bottom ── */}
            {actionCol && (
              <div
                style={{
                  marginTop:    8,
                  paddingTop:   8,
                  borderTop:    '1px solid #f0f0f0',
                  display:      'flex',
                  gap:          6,
                  flexWrap:     'wrap',
                  alignItems:   'center',
                }}
              >
                {renderCell(actionCol, record)}
              </div>
            )}
          </Card>
        );
      }}
    />
  );
};

export default ResponsiveTable;
