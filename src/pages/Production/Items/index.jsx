import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, Select,
  Card, Modal, message, Tooltip, Badge, Tag,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  SettingOutlined,
  SearchOutlined,
  RightOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { itemApi } from '../../../api/item.api';
import AppLayout   from '../../../components/AppLayout';

const { Title, Text } = Typography;
const { TextArea }    = Input;

const fmtDateTime = (iso) => (iso ? dayjs(iso).format('DD MMM YYYY HH:mm') : '—');

const CATEGORY_OPTIONS = [
  { label: 'Raw Material',  value: 'Raw Material' },
  { label: 'Component',     value: 'Component' },
  { label: 'Finished Good', value: 'Finished Good' },
  { label: 'Consumable',    value: 'Consumable' },
];

const UNIT_OPTIONS = [
  { label: 'Nos',  value: 'Nos' },
  { label: 'Kg',   value: 'Kg' },
  { label: 'Mtr',  value: 'Mtr' },
  { label: 'Ltr',  value: 'Ltr' },
  { label: 'Set',  value: 'Set' },
  { label: 'Pair', value: 'Pair' },
  { label: 'Box',  value: 'Box' },
  { label: 'Roll', value: 'Roll' },
];

const CATEGORY_COLORS = {
  'Raw Material':  'orange',
  'Component':     'blue',
  'Finished Good': 'green',
  'Consumable':    'purple',
};

// ══════════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════════════════════════════════════════
const ListView = ({ items, loading, search, onSearchChange, onRefresh, onNew, onDetail, onDelete }) => {

  const columns = [
    {
      title: 'Name',
      key:   'name',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#ede9fe', border: '1px solid #c4b5fd',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#7c3aed', fontSize: 16, flexShrink: 0,
            }}
          >
            <AppstoreOutlined />
          </div>
          <div>
            <Text
              style={{ color: '#111827', fontWeight: 600, fontSize: 13, display: 'block', cursor: 'pointer' }}
              onClick={() => onDetail(r)}
            >
              {r.name}
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>{r.code}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Category',
      key:   'category',
      width: 140,
      render: (_, r) =>
        r.category
          ? <Tag color={CATEGORY_COLORS[r.category] || 'default'} style={{ borderRadius: 20, fontSize: 11 }}>{r.category}</Tag>
          : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Unit',
      key:   'unit',
      width: 80,
      render: (_, r) =>
        r.unit
          ? <Text style={{ fontSize: 12, color: '#374151' }}>{r.unit}</Text>
          : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'HSN Code',
      key:   'hsn_code',
      width: 120,
      render: (_, r) =>
        r.hsn_code
          ? <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.hsn_code}</Text>
          : <Text style={{ color: '#d1d5db', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Status',
      key:   'status',
      width: 100,
      render: (_, r) =>
        r.is_active
          ? <Badge status="success" text={<Text style={{ color: '#16a34a', fontSize: 12, fontWeight: 500 }}>Active</Text>} />
          : <Badge status="error"   text={<Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 500 }}>Inactive</Text>} />,
    },
    {
      title: 'Created At',
      key:   'createdAt',
      width: 200,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>{r.Creator?.name || '—'}</Text>
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
          <Text style={{ fontSize: 11, color: '#1d4ed8', display: 'block', fontWeight: 500 }}>{r.Updater?.name || '—'}</Text>
          <Text style={{ fontSize: 11, color: '#374151' }}>{fmtDateTime(r.updatedAt)}</Text>
        </div>
      ),
    },
    {
      title:  'Actions',
      key:    'actions',
      width:  170,
      render: (_, r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="small" icon={<SettingOutlined />} style={{ borderRadius: 6, fontSize: 12 }} onClick={() => onDetail(r)}>
            Configure
          </Button>
          <Tooltip title="Delete item">
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }} onClick={() => onDelete(r)} />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Items</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Items</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Manage raw materials, components and finished goods</Text>
      </div>

      {/* Table Card */}
      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search items…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={onRefresh} style={{ borderRadius: 8 }}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onNew} style={{ borderRadius: 8, fontWeight: 600 }}>
            Add New Item
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} items`, style: { marginBottom: 0 } }}
          scroll={{ x: 1000 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <AppstoreOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No items added yet</Text>
                <br />
                <Button type="primary" size="small" onClick={onNew} style={{ marginTop: 10 }}>Add Your First Item</Button>
              </div>
            ),
          }}
        />
      </Card>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  ADD / EDIT FORM
// ══════════════════════════════════════════════════════════════════════════════
const ItemForm = ({ item, onSave, onCancel, saving }) => {
  const [form] = Form.useForm();
  const isEdit = !!item;

  useEffect(() => {
    if (item) {
      form.setFieldsValue({
        name:        item.name,
        description: item.description,
        unit:        item.unit || undefined,
        hsn_code:    item.hsn_code,
        category:    item.category || undefined,
      });
    } else {
      form.resetFields();
    }
  }, [item, form]);

  const handleSubmit = async (values) => {
    await onSave(values);
  };

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={onCancel}>Items</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>{isEdit ? 'Edit' : 'Add New'}</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onCancel} style={{ padding: 0, color: '#6b7280' }} />
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
            {isEdit ? `Edit — ${item.name}` : 'Add New Item'}
          </Title>
        </div>
      </div>

      {/* Form Card */}
      <div style={{ background: '#ffffff', border: '1px solid #e8eaed', borderRadius: 12, padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px', maxWidth: 800 }}>
            <Form.Item name="name" label="Item Name" rules={[{ required: true, message: 'Item name is required' }]}>
              <Input placeholder="e.g. Steel Rod 12mm" style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item name="category" label="Category">
              <Select placeholder="Select category" options={CATEGORY_OPTIONS} allowClear style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item name="unit" label="Unit of Measurement">
              <Select placeholder="Select unit" options={UNIT_OPTIONS} allowClear showSearch style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item name="hsn_code" label="HSN / SAC Code">
              <Input placeholder="e.g. 7213" style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item name="description" label="Description" style={{ gridColumn: '1 / -1' }}>
              <TextArea rows={3} placeholder="Brief description of the item…" style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={saving} style={{ borderRadius: 8, fontWeight: 600 }}>
              {isEdit ? 'Update Item' : 'Create Item'}
            </Button>
            <Button onClick={onCancel} style={{ borderRadius: 8 }}>Cancel</Button>
          </div>
        </Form>
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  DETAIL VIEW
// ══════════════════════════════════════════════════════════════════════════════
const DetailView = ({ item, onBack, onEdit }) => (
  <>
    {/* Breadcrumb */}
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#9ca3af', fontSize: 12, cursor: 'pointer' }} onClick={onBack}>Items</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>{item.name}</Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ padding: 0, color: '#6b7280' }} />
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>{item.name}</Title>
        <Text style={{ color: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}>{item.code}</Text>
      </div>
    </div>

    {/* Detail Card */}
    <div style={{ background: '#ffffff', border: '1px solid #e8eaed', borderRadius: 12, padding: '28px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px', maxWidth: 800 }}>
        <div>
          <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Item Name</Text>
          <Text style={{ color: '#111827', fontWeight: 500, fontSize: 14 }}>{item.name}</Text>
        </div>
        <div>
          <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Code</Text>
          <Text style={{ color: '#111827', fontFamily: 'monospace', fontSize: 14 }}>{item.code}</Text>
        </div>
        <div>
          <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Category</Text>
          {item.category
            ? <Tag color={CATEGORY_COLORS[item.category] || 'default'} style={{ borderRadius: 20 }}>{item.category}</Tag>
            : <Text style={{ color: '#d1d5db' }}>—</Text>}
        </div>
        <div>
          <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Unit</Text>
          <Text style={{ color: '#111827', fontSize: 14 }}>{item.unit || '—'}</Text>
        </div>
        <div>
          <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>HSN / SAC Code</Text>
          <Text style={{ color: '#111827', fontFamily: 'monospace', fontSize: 14 }}>{item.hsn_code || '—'}</Text>
        </div>
        <div>
          <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Status</Text>
          {item.is_active
            ? <Badge status="success" text={<Text style={{ color: '#16a34a', fontSize: 13, fontWeight: 500 }}>Active</Text>} />
            : <Badge status="error"   text={<Text style={{ color: '#dc2626', fontSize: 13, fontWeight: 500 }}>Inactive</Text>} />}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Description</Text>
          <Text style={{ color: '#111827', fontSize: 14 }}>{item.description || '—'}</Text>
        </div>
        <div>
          <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Created</Text>
          <Text style={{ color: '#374151', fontSize: 12 }}>{item.Creator?.name || '—'} · {fmtDateTime(item.createdAt)}</Text>
        </div>
        <div>
          <Text style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 4 }}>Last Updated</Text>
          <Text style={{ color: '#374151', fontSize: 12 }}>{item.Updater?.name || '—'} · {fmtDateTime(item.updatedAt)}</Text>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Button type="primary" icon={<SettingOutlined />} onClick={onEdit} style={{ borderRadius: 8, fontWeight: 600 }}>
          Edit Item
        </Button>
      </div>
    </div>
  </>
);

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const ItemsPage = () => {
  const [view,     setView]     = useState('list');
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await itemApi.getAll(search ? { search } : {});
      setItems(res?.data ?? res ?? []);
    } catch {
      message.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCreate = async (values) => {
    setSaving(true);
    try {
      await itemApi.create(values);
      message.success('Item created');
      setView('list');
      fetchItems();
    } catch {
      message.error('Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (values) => {
    setSaving(true);
    try {
      await itemApi.update(selected.id, values);
      message.success('Item updated');
      setView('list');
      setSelected(null);
      fetchItems();
    } catch {
      message.error('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title:   'Delete Item?',
      content: `Permanently delete "${record.name}"? This cannot be undone.`,
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await itemApi.delete(record.id);
          message.success(`Item "${record.name}" deleted`);
          fetchItems();
        } catch {
          message.error('Failed to delete item');
        }
      },
    });
  };

  const handleDetail = (record) => { setSelected(record); setView('detail'); };

  return (
    <AppLayout>
      {view === 'list' && (
        <ListView
          items={items}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          onRefresh={fetchItems}
          onNew={() => { setSelected(null); setView('add'); }}
          onDetail={handleDetail}
          onDelete={handleDelete}
        />
      )}
      {view === 'add' && (
        <ItemForm item={null} onSave={handleCreate} onCancel={() => setView('list')} saving={saving} />
      )}
      {view === 'detail' && selected && (
        <DetailView
          item={selected}
          onBack={() => { setView('list'); setSelected(null); }}
          onEdit={() => setView('edit')}
        />
      )}
      {view === 'edit' && selected && (
        <ItemForm item={selected} onSave={handleUpdate} onCancel={() => setView('detail')} saving={saving} />
      )}
    </AppLayout>
  );
};

export default ItemsPage;
