import React, { useState, useCallback } from 'react';
import {
  Card, Input, Button, Tabs, List, Tag, Typography, Space, Empty, Spin, message,
} from 'antd';
import {
  ApartmentOutlined, SearchOutlined, HistoryOutlined, ArrowRightOutlined,
  InboxOutlined, ToolOutlined, CarOutlined, BarcodeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import { traceabilityApi } from '../../api/traceability.api';

const { Title, Text } = Typography;

const SEARCH_TABS = [
  { key: 'lot',      label: 'Lot / Batch',   icon: <BarcodeOutlined />, placeholder: 'Enter lot no (e.g. LOT-001) or batch no (e.g. BAT-2026-0001)' },
  { key: 'wo',       label: 'Work Order',     icon: <ToolOutlined />,    placeholder: 'Enter WO number (e.g. WO-2026-0001)' },
  { key: 'grn',      label: 'GRN',            icon: <InboxOutlined />,   placeholder: 'Enter GRN number (e.g. GRN-2026-0001)' },
  { key: 'dispatch', label: 'Dispatch Order', icon: <CarOutlined />,     placeholder: 'Enter dispatch order number (e.g. DO-20260325-0001)' },
];

const TYPE_COLOR = { lot: 'blue', grn: 'green', wo: 'purple', dispatch: 'orange' };
const LS_KEY = 'trace_recent';

function getRecent() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function saveRecent(item) {
  const prev = getRecent().filter(r => !(r.type === item.type && r.ref === item.ref));
  localStorage.setItem(LS_KEY, JSON.stringify([item, ...prev].slice(0, 10)));
}

export default function TraceabilitySearch() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab]   = useState('lot');
  const [query, setQuery]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [results, setResults]       = useState(null);
  const [recent, setRecent]         = useState(getRecent);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const data = await traceabilityApi.search(q);
      setResults(data.results || []);
    } catch (err) {
      message.error('Search failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleOpen = useCallback((item) => {
    saveRecent(item);
    setRecent(getRecent());
    navigate('/traceability/result', { state: item });
  }, [navigate]);

  const currentTab = SEARCH_TABS.find(t => t.key === activeTab);

  return (
    <AppLayout>
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={24}>

        {/* Header */}
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ApartmentOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            Lot / Batch Traceability
          </Title>
          <Text type="secondary">
            Trace materials from supplier to customer — forward or backward
          </Text>
        </div>

        {/* Search Card */}
        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={k => { setActiveTab(k); setResults(null); setQuery(''); }}
            items={SEARCH_TABS.map(t => ({
              key: t.key,
              label: <span>{t.icon}&nbsp;{t.label}</span>,
            }))}
          />
          <Space.Compact style={{ width: '100%', marginTop: 8 }}>
            <Input
              size="large"
              placeholder={currentTab?.placeholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
            <Button size="large" type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading}>
              Search
            </Button>
          </Space.Compact>
        </Card>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin size="large" />
          </div>
        )}

        {/* Results */}
        {results !== null && !loading && (
          <Card title={`Results (${results.length})`}>
            {results.length === 0
              ? <Empty description="No matches found" />
              : (
                <List
                  dataSource={results}
                  renderItem={item => (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleOpen(item)}
                      actions={[
                        <Button type="link" icon={<ArrowRightOutlined />} onClick={() => handleOpen(item)}>
                          Trace
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Tag color={TYPE_COLOR[item.type] || 'default'}>{item.type?.toUpperCase()}</Tag>}
                        title={item.label}
                        description={item.sub}
                      />
                    </List.Item>
                  )}
                />
              )}
          </Card>
        )}

        {/* Recent Searches */}
        {results === null && !loading && recent.length > 0 && (
          <Card title={<><HistoryOutlined /> Recent Searches</>} size="small">
            <List
              size="small"
              dataSource={recent}
              renderItem={item => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleOpen(item)}
                  actions={[<ArrowRightOutlined style={{ color: '#1677ff' }} />]}
                >
                  <Tag color={TYPE_COLOR[item.type] || 'default'} style={{ marginRight: 8 }}>
                    {item.type?.toUpperCase()}
                  </Tag>
                  <Text>{item.label}</Text>
                  {item.sub && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{item.sub}</Text>
                  )}
                </List.Item>
              )}
            />
          </Card>
        )}

      </Space>
    </div>
    </AppLayout>
  );
}
