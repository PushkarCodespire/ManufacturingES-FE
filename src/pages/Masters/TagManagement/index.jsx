import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Input, Select, Card, Modal, message, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, ArrowLeftOutlined, InfoCircleOutlined,
  SearchOutlined, RightOutlined,
DownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { tagApi } from '../../../api/tag.api';
import { siteApi } from '../../../api/site.api';
import AppLayout from '../../../components/AppLayout';
import usePermissions from '../../../hooks/usePermissions';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return dayjs(iso).format('DD MMM YYYY HH:mm');
};

const TAG_TYPE_OPTIONS = [
  'General',
  'Machine Group',
  'Process',
  'Customer',
  'Packaging',
  'Item Group',
  'Industry',
];

// ══════════════════════════════════════════════════════════════════════════════
//  INFO MODAL
// ══════════════════════════════════════════════════════════════════════════════
const TagInfoModal = ({ tag, open, onClose, onDeactivate }) => {
  if (!tag) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable
      width={480}
      centered
    >
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0 }}>
            {tag.name} ({tag.id})
          </Title>
          <Button
            danger
            size="small"
            onClick={() => { onDeactivate(tag); onClose(); }}
            style={{ borderRadius: 6, fontWeight: 600 }}
          >
            Deactivate
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          <div>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Tag Type:</Text>
            <Text style={{ fontSize: 13 }}>{tag.tag_type}</Text>
          </div>
          <div>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Machines Count:</Text>
            <Text style={{ fontSize: 13 }}>{tag.machines_count || 0}</Text>
          </div>
          <div>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Is Sku Group:</Text>
            <Text style={{ fontSize: 13 }}>{tag.is_item_group ? 'True' : 'False'}</Text>
          </div>
          <div>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Items Count:</Text>
            <Text style={{ fontSize: 13 }}>{tag.items_count || 0}</Text>
          </div>
          <div>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>System:</Text>
            <Text style={{ fontSize: 13 }}>{tag.is_system ? 'True' : 'False'}</Text>
          </div>
          <div>
            <Text style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>Rules Count:</Text>
            <Text style={{ fontSize: 13 }}>{tag.rules_count || 0}</Text>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({ tags, loading, search, onSearchChange, onRefresh, onNew, onDeactivate, canWrite }) => {
  const [infoTag, setInfoTag] = useState(null);

  const columns = [
    {
      title: 'Name',
      key:   'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (_, r) => (
        <Text style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{r.name}</Text>
      ),
    },
    {
      title: 'Type',
      key:   'tag_type',
      width: 160,
      sorter: (a, b) => a.tag_type.localeCompare(b.tag_type),
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>{r.tag_type}</Text>
      ),
    },
    {
      title: 'Is Item Group',
      key:   'is_item_group',
      width: 120,
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>{r.is_item_group ? 'Yes' : 'No'}</Text>
      ),
    },
    {
      title: 'System',
      key:   'is_system',
      width: 100,
      render: (_, r) => (
        <Text style={{ fontSize: 12, color: '#374151' }}>{r.is_system ? 'Yes' : 'No'}</Text>
      ),
    },
    {
      title: 'Created At',
      key:   'createdAt',
      width: 200,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>
            {r.Creator?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#374151' }}>{fmtDateTime(r.createdAt)}</Text>
        </div>
      ),
    },
    {
      title: 'Last Updated At',
      key:   'updatedAt',
      width: 220,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, color: '#1d4ed8', display: 'block', fontWeight: 500 }}>
            {r.Updater?.name || '—'}
          </Text>
          <Text style={{ fontSize: 11, color: '#374151' }}>{fmtDateTime(r.updatedAt)}</Text>
        </div>
      ),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  80,
      render: (_, r) => (
        <Tooltip title="View details">
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => setInfoTag(r)}
            style={{ color: '#1d4ed8' }}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      {/* ── Page heading ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Other</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Tags</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Tag Management
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage tags for machines, items, processes and more
        </Text>
      </div>

      {/* ── Table Card ───────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search tags…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('tag-management.csv', tags, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>
            Refresh
          </Button>
          {canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onNew}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Add New Tag
            </Button>
          )}
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tags}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} tags`, style: { marginBottom: 0 } }}
          scroll={{ x: 900 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <Text style={{ color: '#9ca3af' }}>No tags added yet</Text>
                {canWrite && (
                  <>
                    <br />
                    <Button
                      type="primary"
                      size="small"
                      onClick={onNew}
                      style={{ marginTop: 10 }}
                    >
                      Add Your First Tag
                    </Button>
                  </>
                )}
              </div>
            ),
          }}
        />
      </Card>

      <TagInfoModal
        tag={infoTag}
        open={!!infoTag}
        onClose={() => setInfoTag(null)}
        onDeactivate={onDeactivate}
      />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ADD TAG FORM
// ══════════════════════════════════════════════════════════════════════════════
const AddTagForm = ({ sites, onDone, onCancel }) => {
  const [tagType, setTagType] = useState('General');
  const [name, setName]       = useState('');
  const [siteIds, setSiteIds] = useState([]);
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      message.warning('Tag name is required');
      return;
    }
    setSaving(true);
    try {
      await tagApi.create({
        name: name.trim(),
        tag_type: tagType,
        site_ids: siteIds,
      });
      message.success('Tag created successfully');
      onDone();
    } catch (err) {
      message.error(err?.message || 'Failed to create tag');
    } finally {
      setSaving(false);
    }
  };

  const siteOptions = sites.map((s) => ({ label: s.name, value: s.id }));

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Other</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={onCancel}>Tags</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Add New Tag</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onCancel} style={{ padding: 0, color: '#6b7280' }} />
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Add New Tag</Title>
        </div>
      </div>

      <div style={{ maxWidth: 360 }}>
        <div style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Tag Type</Text>
          <Select
            value={tagType}
            onChange={setTagType}
            style={{ width: '100%' }}
            options={TAG_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Name</Text>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag name"
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Sites</Text>
          <Select
            mode="multiple"
            value={siteIds}
            onChange={setSiteIds}
            style={{ width: '100%' }}
            options={siteOptions}
            placeholder="Select sites"
            allowClear
          />
        </div>
        <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 24 }}>
          Blank means company wide tag. Otherwise tag will be available in selected sites (one or more).
        </Text>

        <Button
          type="primary"
          onClick={handleSubmit}
          loading={saving}
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          Submit
        </Button>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const TagManagementPage = () => {
  const [view, setView]     = useState('list');
  const [tags, setTags]     = useState([]);
  const [sites, setSites]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { can }  = usePermissions();
  const canWrite = can('other-tag_management-create_edit_delete');

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tagApi.getAll(search ? { search } : {});
      setTags(res?.data ?? res ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchSites = useCallback(async () => {
    try {
      const res = await siteApi.getAll();
      setSites(res?.data ?? res ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);
  useEffect(() => { fetchSites(); }, [fetchSites]);

  const handleDeactivate = (tag) => {
    Modal.confirm({
      title:   `Deactivate "${tag.name}"?`,
      content: 'This tag will be deactivated and no longer available for use.',
      okText:  'Deactivate',
      okType:  'danger',
      onOk: async () => {
        try {
          await tagApi.update(tag.id, { is_system: false });
          message.success(`Tag "${tag.name}" deactivated`);
          fetchTags();
        } catch (err) {
          message.error(err?.message || 'Failed to deactivate tag');
        }
      },
    });
  };

  return (
    <AppLayout>
      {view === 'list' && (
        <ListView
          tags={tags}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          onRefresh={fetchTags}
          onNew={() => setView('add')}
          onDeactivate={handleDeactivate}
          canWrite={canWrite}
        />
      )}
      {view === 'add' && canWrite && (
        <AddTagForm
          sites={sites}
          onDone={() => { setView('list'); fetchTags(); }}
          onCancel={() => setView('list')}
        />
      )}
    </AppLayout>
  );
};

export default TagManagementPage;
