import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Drawer, Form, DatePicker, Input, Collapse, Checkbox, Space,
  Typography, message, Modal, Divider,
} from 'antd';
import { PlusOutlined, ReloadOutlined, RightOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../../../components/AppLayout';
import { shiftHandoverApi } from '../../../api/production.api';
import { exportTableToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;
const { TextArea } = Input;

const STATUS_COLORS = { draft: 'default', submitted: 'processing', acknowledged: 'success' };

export default function ShiftHandoverPage() {
  const [data, setData]                   = useState([]);
  const [loading, setLoading]             = useState(false);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [selectedHandover, setSelected]   = useState(null);
  const [createModalOpen, setCreateOpen]  = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await shiftHandoverApi.getAll();
      setData(Array.isArray(result) ? result : (result?.data ?? []));
    } catch {
      message.error('Failed to load handovers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadHandover = async (id) => {
    try {
      const result = await shiftHandoverApi.getById(id);
      setSelected(result?.data ?? result);
    } catch {
      message.error('Failed to load handover details');
    }
  };

  const handleCreate = async (values) => {
    try {
      setCreateLoading(true);
      await shiftHandoverApi.create({
        handover_date:    values.handover_date ? dayjs(values.handover_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        production_notes: values.production_notes || null,
        machine_notes:    values.machine_notes    || null,
      });
      message.success('Handover created');
      setCreateOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('Failed to create handover');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSubmit = async (id) => {
    try {
      await shiftHandoverApi.submit(id);
      message.success('Handover submitted');
      if (selectedHandover?.id === id) loadHandover(id);
      loadData();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to submit');
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await shiftHandoverApi.acknowledge(id);
      message.success('Handover acknowledged');
      if (selectedHandover?.id === id) loadHandover(id);
      loadData();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to acknowledge');
    }
  };

  const handleItemCheck = async (handoverId, itemId, checked) => {
    try {
      await shiftHandoverApi.updateItem(handoverId, itemId, { is_checked: checked });
      loadHandover(handoverId);
    } catch {
      message.error('Failed to update item');
    }
  };

  const handleNotesUpdate = async (id, field, value) => {
    try {
      await shiftHandoverApi.update(id, { [field]: value });
      message.success('Saved');
      loadHandover(id);
    } catch {
      message.error('Failed to save notes');
    }
  };

  const columns = [
    { title: 'Date', dataIndex: 'handover_date', key: 'date', width: 120, render: (d) => dayjs(d).format('DD MMM YYYY') },
    { title: 'Outgoing Supervisor', key: 'outgoing', render: (_, r) => r.outgoingSupervisor?.name || '—' },
    { title: 'Incoming Supervisor', key: 'incoming', render: (_, r) => r.incomingSupervisor?.name || '—' },
    {
      title: 'Items', key: 'items', width: 100,
      render: (_, r) => {
        const total   = r.items?.length || 0;
        const checked = r.items?.filter((i) => i.is_checked).length || 0;
        return total > 0 ? `${checked}/${total} done` : '—';
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (s) => <Tag color={STATUS_COLORS[s] || 'default'}>{s?.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 180,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => { setSelected(record); loadHandover(record.id); setDrawerOpen(true); }}>View</Button>
          {record.status === 'draft'     && <Button size="small" type="primary" onClick={() => handleSubmit(record.id)}>Submit</Button>}
          {record.status === 'submitted' && <Button size="small" type="primary" onClick={() => handleAcknowledge(record.id)}>Acknowledge</Button>}
        </Space>
      ),
    },
  ];

  const collapseItems = selectedHandover
    ? [
        { key: 'production', label: 'Production Notes', field: 'production_notes' },
        { key: 'machine',    label: 'Machine Notes',    field: 'machine_notes'    },
        { key: 'quality',    label: 'Quality Notes',    field: 'quality_notes'    },
        { key: 'safety',     label: 'Safety Notes',     field: 'safety_notes'     },
        { key: 'action',     label: 'Action Items',     field: 'action_notes'     },
      ].map((s) => ({
        key:      s.key,
        label:    s.label,
        children: (
          <NotesPanel
            value={selectedHandover[s.field]}
            readOnly={selectedHandover.status === 'acknowledged'}
            onSave={(val) => handleNotesUpdate(selectedHandover.id, s.field, val)}
          />
        ),
      }))
    : [];

  return (
    <AppLayout>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Shift Handover</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Shift Handover</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Manage shift handover records with auto-populated checklists</Text>
          </div>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => exportTableToCsv('shift-handover.csv', data, columns)}>Export CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New Handover</Button>
          </Space>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Tag color="blue">Total: {data.length}</Tag>
          <Tag color="default">Draft: {data.filter((d) => d.status === 'draft').length}</Tag>
          <Tag color="processing">Submitted: {data.filter((d) => d.status === 'submitted').length}</Tag>
          <Tag color="success">Acknowledged: {data.filter((d) => d.status === 'acknowledged').length}</Tag>
        </div>

        {/* Table */}
        <div style={{ border: '1px solid #e8eaed', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
          <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20, showSizeChanger: false }} size="small" scroll={{ x: 800 }} />
        </div>

        {/* Detail Drawer */}
        <Drawer
          title={
            <Space>
              <Text strong>Shift Handover</Text>
              {selectedHandover && <Tag color={STATUS_COLORS[selectedHandover.status] || 'default'}>{selectedHandover.status?.toUpperCase()}</Tag>}
            </Space>
          }
          width={800}
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setSelected(null); }}
          extra={selectedHandover && (
            <Space>
              {selectedHandover.status === 'draft'     && <Button type="primary" onClick={() => handleSubmit(selectedHandover.id)}>Submit Handover</Button>}
              {selectedHandover.status === 'submitted' && <Button type="primary" onClick={() => handleAcknowledge(selectedHandover.id)}>Acknowledge</Button>}
            </Space>
          )}
        >
          {selectedHandover && (
            <div>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Date</Text>
                  <Text strong style={{ display: 'block' }}>{dayjs(selectedHandover.handover_date).format('DD MMM YYYY')}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Outgoing Supervisor</Text>
                  <Text strong style={{ display: 'block' }}>{selectedHandover.outgoingSupervisor?.name || '—'}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Incoming Supervisor</Text>
                  <Text strong style={{ display: 'block' }}>{selectedHandover.incomingSupervisor?.name || '—'}</Text>
                </div>
              </div>

              <Divider style={{ margin: '12px 0' }} />
              <Collapse ghost defaultActiveKey={['production']} items={collapseItems} />
              <Divider style={{ margin: '12px 0' }} />

              <Title level={5} style={{ marginBottom: 12 }}>
                Checklist ({selectedHandover.items?.filter((i) => i.is_checked).length || 0}/{selectedHandover.items?.length || 0} completed)
              </Title>
              {selectedHandover.items?.length > 0 ? (
                selectedHandover.items.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <Checkbox
                      checked={item.is_checked}
                      disabled={selectedHandover.status === 'acknowledged'}
                      onChange={(e) => handleItemCheck(selectedHandover.id, item.id, e.target.checked)}
                    />
                    <div style={{ flex: 1 }}>
                      <Tag style={{ fontSize: 10, marginRight: 6 }} color="blue">{item.item_type?.replace(/_/g, ' ')}</Tag>
                      <Text style={{ textDecoration: item.is_checked ? 'line-through' : undefined, color: item.is_checked ? '#9ca3af' : undefined, fontSize: 13 }}>
                        {item.description}
                      </Text>
                      {item.resolution_notes && (
                        <Text style={{ fontSize: 11, color: '#6b7280', display: 'block' }}>Resolution: {item.resolution_notes}</Text>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <Text type="secondary">No checklist items.</Text>
              )}
            </div>
          )}
        </Drawer>

        {/* Create Modal */}
        <Modal
          title="New Shift Handover"
          open={createModalOpen}
          onCancel={() => { setCreateOpen(false); form.resetFields(); }}
          onOk={() => form.submit()}
          okText="Create Handover"
          confirmLoading={createLoading}
          width={560}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item name="handover_date" label="Handover Date" rules={[{ required: true, message: 'Please select a date' }]} initialValue={dayjs()}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="production_notes" label="Production Notes (optional)">
              <TextArea rows={2} placeholder="Any production notes to hand over..." />
            </Form.Item>
            <Form.Item name="machine_notes" label="Machine Notes (optional)">
              <TextArea rows={2} placeholder="Machine issues or maintenance notes..." />
            </Form.Item>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Open work orders and active breakdowns will be auto-populated in the checklist.
            </Text>
          </Form>
        </Modal>
      </div>
    </AppLayout>
  );
}

function NotesPanel({ value, readOnly, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText]       = useState(value || '');

  useEffect(() => { setText(value || ''); }, [value]);

  if (readOnly) {
    return <Text style={{ fontSize: 13 }}>{value || <span style={{ color: '#9ca3af' }}>No notes</span>}</Text>;
  }

  if (!editing) {
    return (
      <div>
        <Text style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
          {value || <span style={{ color: '#9ca3af' }}>Click Edit to add notes</span>}
        </Text>
        <Button size="small" onClick={() => setEditing(true)}>Edit</Button>
      </div>
    );
  }

  return (
    <div>
      <Input.TextArea rows={3} value={text} onChange={(e) => setText(e.target.value)} style={{ marginBottom: 8 }} />
      <Space>
        <Button size="small" type="primary" onClick={() => { onSave(text); setEditing(false); }}>Save</Button>
        <Button size="small" onClick={() => { setText(value || ''); setEditing(false); }}>Cancel</Button>
      </Space>
    </div>
  );
}
