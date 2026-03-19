import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Table, Button, Form, Input, InputNumber,
  TimePicker, Modal, message, Tooltip, Space, Card, Tag,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  SearchOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { shiftApi }     from '../../../api/shift.api';
import AppLayout        from '../../../components/AppLayout';
import usePermissions   from '../../../hooks/usePermissions';

const { Title, Text } = Typography;

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtBreak = (mins) => {
  if (!mins) return '0 Minutes';
  return mins === 1 ? '1 Minute' : `${mins} Minutes`;
};

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return dayjs(iso).format('DD MMM YYYY HH:mm');
};

// ═══════════════════════════════════════════════════════════════════════════
//  LIST VIEW
// ═══════════════════════════════════════════════════════════════════════════
const ListView = ({ shifts, loading, onRefresh, onNew, onEdit, onDelete, canWrite, search, setSearch }) => {
  const baseColumns = [
    {
      title:     'Name',
      dataIndex: 'name',
      key:       'name',
      render: (name) => (
        <Text style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 13 }}>{name}</Text>
      ),
    },
    {
      title: 'Start Time',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 120,
      render: (t) => (
        <Text style={{ fontSize: 13, color: '#374151' }}>{t || '—'}</Text>
      ),
    },
    {
      title: 'End Time',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 120,
      render: (t) => (
        <Text style={{ fontSize: 13, color: '#d97706' }}>{t || '—'}</Text>
      ),
    },
    {
      title: 'Lunch / Break Duration',
      dataIndex: 'lunch_break_duration',
      key: 'lunch_break_duration',
      width: 180,
      render: (mins) => (
        <Text style={{ fontSize: 13, color: '#374151' }}>{fmtBreak(mins)}</Text>
      ),
    },
    {
      title: 'Created At',
      key: 'createdAt',
      width: 160,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>—</Text>
          <Text style={{ fontSize: 11, color: '#374151' }}>{fmtDateTime(r.createdAt)}</Text>
        </div>
      ),
    },
    {
      title: 'Last Updated At',
      key: 'updatedAt',
      width: 160,
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 11, color: '#9ca3af', display: 'block' }}>—</Text>
          <Text style={{ fontSize: 11, color: '#1d4ed8' }}>{fmtDateTime(r.updatedAt)}</Text>
        </div>
      ),
    },
  ];

  // Only show Actions column if user has write permission
  const columns = canWrite
    ? [
        ...baseColumns,
        {
          title:  'Actions',
          key:    'actions',
          width:  100,
          align:  'center',
          render: (_, r) => (
            <Space size={4}>
              <Tooltip title="Edit shift">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#1d4ed8', fontSize: 15 }} />}
                  onClick={() => onEdit(r)}
                />
              </Tooltip>
              <Tooltip title="Delete shift">
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined style={{ color: '#e879b0', fontSize: 15 }} />}
                  onClick={() => onDelete(r)}
                  style={{ color: '#e879b0' }}
                />
              </Tooltip>
            </Space>
          ),
        },
      ]
    : baseColumns;

  return (
    <div>
      {/* ── Summary chips ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Shifts', value: shifts.length, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Active',       value: shifts.filter((s) => s.is_active).length, color: '#16a34a', bg: '#f0fdf4' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: '8px 16px', background: s.bg,
              border: `1px solid ${s.color}30`, borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90,
            }}
          >
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{s.value}</Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      {/* ── Table Card ─────────────────────────────────────────────────── */}
      <Card
        style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Input
            placeholder="Search shifts…"
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
          />
          <div style={{ flex: 1 }} />
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
              Add New Shift
            </Button>
          )}
        </div>

        {/* Table */}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={shifts}
          loading={loading}
          pagination={{
            pageSize:        10,
            showSizeChanger: true,
            showTotal:       (total) => `${total} shifts`,
            style:           { marginBottom: 0 },
          }}
          scroll={{ x: 900 }}
          size="middle"
          style={{ borderRadius: 8, overflow: 'hidden' }}
          locale={{
            emptyText: (
              <div style={{ padding: 40 }}>
                <CalendarOutlined style={{ fontSize: 32, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
                <Text style={{ color: '#9ca3af' }}>No shifts configured yet</Text>
                {canWrite && (
                  <>
                    <br />
                    <Button
                      type="primary"
                      size="small"
                      onClick={onNew}
                      style={{ marginTop: 10 }}
                    >
                      Add Your First Shift
                    </Button>
                  </>
                )}
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  SHARED FORM VIEW  (used by both Add and Edit)
// ═══════════════════════════════════════════════════════════════════════════
const ShiftFormView = ({ shift, onBack, onSaved }) => {
  const isEdit        = !!shift;
  const [form]        = Form.useForm();
  const [saving, setSaving] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (isEdit) {
      form.setFieldsValue({
        name:                 shift.name,
        start_time:           dayjs(shift.start_time, 'HH:mm'),
        end_time:             dayjs(shift.end_time,   'HH:mm'),
        lunch_break_duration: shift.lunch_break_duration ?? 0,
      });
    }
  }, [shift, form, isEdit]);

  // Computed display values for the shift duration badge
  const watchStart = Form.useWatch('start_time', form);
  const watchEnd   = Form.useWatch('end_time',   form);
  const shiftInfo  = (() => {
    if (!watchStart || !watchEnd) return null;
    const startMins = watchStart.hour() * 60 + watchStart.minute();
    const endMins   = watchEnd.hour()   * 60 + watchEnd.minute();
    const durationMins = endMins > startMins
      ? endMins - startMins                     // same-day shift
      : (24 * 60 - startMins) + endMins;        // overnight shift
    const hrs  = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const overnight = endMins <= startMins;
    return { durationMins, label: `${hrs}h${mins ? ` ${mins}m` : ''}`, overnight };
  })();

  const handleSubmit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const payload = {
      name:                 values.name,
      start_time:           values.start_time.format('HH:mm'),
      end_time:             values.end_time.format('HH:mm'),
      lunch_break_duration: values.lunch_break_duration ?? 0,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await shiftApi.update(shift.id, payload);
        message.success('Shift updated successfully');
      } else {
        const res = await shiftApi.create(payload);
        message.success(res.message || 'Shift created successfully');
      }
      form.resetFields();
      onSaved();
    } catch (err) {
      message.error(
        err?.message || err?.message ||
        (isEdit ? 'Failed to update shift' : 'Failed to create shift')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{ color: '#374151', fontWeight: 500, paddingLeft: 0 }}
        />
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          {isEdit ? `Edit Shift — ${shift.name}` : 'Add New Shift'}
        </Title>
      </div>

      {/* ── Form card ──────────────────────────────────────────────────── */}
      <div
        style={{
          background:   '#ffffff',
          border:       '1px solid #e8eaed',
          borderRadius: 12,
          padding:      '28px 32px',
          boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          size="large"
          initialValues={{ lunch_break_duration: 0 }}
        >
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Name */}
            <Form.Item
              name="name"
              label={
                <span style={{ color: '#374151', fontWeight: 500, fontSize: 13 }}>Name*</span>
              }
              rules={[{ required: true, message: 'Shift name is required' }]}
              style={{ flex: '2 1 260px', minWidth: 200, marginBottom: 0 }}
            >
              <Input placeholder="e.g. Day Shift" />
            </Form.Item>

            {/* Start Time */}
            <Form.Item
              name="start_time"
              label={
                <span style={{ color: '#374151', fontWeight: 500, fontSize: 13 }}>Start Time*</span>
              }
              rules={[{ required: true, message: 'Please select a start time' }]}
              style={{ flex: '1 1 140px', minWidth: 130, marginBottom: 0 }}
            >
              <TimePicker
                format="HH:mm"
                minuteStep={5}
                suffixIcon={<ClockCircleOutlined />}
                style={{ width: '100%' }}
                placeholder="Start"
              />
            </Form.Item>

            {/* End Time */}
            <Form.Item
              name="end_time"
              label={
                <span style={{ color: '#374151', fontWeight: 500, fontSize: 13 }}>
                  End Time*
                  {shiftInfo?.overnight && (
                    <Tag color="blue" style={{ marginLeft: 6, fontSize: 10, fontWeight: 400 }}>
                      +1 day
                    </Tag>
                  )}
                </span>
              }
              rules={[{ required: true, message: 'Please select an end time' }]}
              style={{ flex: '1 1 140px', minWidth: 130, marginBottom: 0 }}
            >
              <TimePicker
                format="HH:mm"
                minuteStep={5}
                suffixIcon={<ClockCircleOutlined />}
                style={{ width: '100%' }}
                placeholder="End"
              />
            </Form.Item>

            {/* Duration badge */}
            {shiftInfo && (
              <div style={{ flex: '0 0 auto', paddingBottom: 2, alignSelf: 'flex-end', marginBottom: 0 }}>
                <Tag
                  color={shiftInfo.overnight ? 'geekblue' : 'green'}
                  style={{ fontWeight: 600, fontSize: 12, padding: '3px 10px' }}
                >
                  {shiftInfo.overnight ? '🌙 ' : '☀️ '}{shiftInfo.label}
                </Tag>
              </div>
            )}

            {/* Lunch / Break Duration */}
            <Form.Item
              name="lunch_break_duration"
              label={
                <span style={{ color: '#374151', fontWeight: 500, fontSize: 13 }}>
                  Lunch / Break Duration
                </span>
              }
              style={{ flex: '1 1 160px', minWidth: 140, marginBottom: 0 }}
            >
              <InputNumber
                min={0}
                max={480}
                addonAfter="mins"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>

          {/* Submit */}
          <div style={{ marginTop: 28 }}>
            <Button
              type="primary"
              loading={saving}
              onClick={handleSubmit}
              style={{
                borderRadius: 8,
                fontWeight:   600,
                background:   '#1d4ed8',
                paddingInline: 28,
              }}
            >
              {isEdit ? 'Save Changes' : 'Submit'}
            </Button>
            <Button
              onClick={onBack}
              style={{ marginLeft: 12, borderRadius: 8 }}
            >
              Cancel
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
const ShiftsPage = () => {
  const { can } = usePermissions();
  const canWrite = can('sites-shifts___leaves-create_edit_delete');

  const [shifts,       setShifts]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [view,         setView]         = useState('list'); // 'list' | 'form'
  const [editingShift, setEditingShift] = useState(null);  // null = add mode
  const [search,       setSearch]       = useState('');

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shiftApi.getAll();
      setShifts(res?.data ?? res ?? []);
    } catch (err) {
      message.error(err?.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  const handleDelete = (record) => {
    Modal.confirm({
      title:   `Delete "${record.name}"?`,
      content: 'This action cannot be undone.',
      okText:  'Delete',
      okType:  'danger',
      onOk: async () => {
        try {
          await shiftApi.delete(record.id);
          message.success(`Shift "${record.name}" deleted`);
          fetchShifts();
        } catch (err) {
          message.error(err?.message || 'Failed to delete shift');
        }
      },
    });
  };

  const handleNew = () => {
    setEditingShift(null);
    setView('form');
  };

  const handleEdit = (record) => {
    setEditingShift(record);
    setView('form');
  };

  const handleSaved = () => {
    setView('list');
    setEditingShift(null);
    fetchShifts();
  };

  const handleBack = () => {
    setView('list');
    setEditingShift(null);
  };

  // Client-side search filter
  const filteredShifts = search
    ? shifts.filter((s) => s.name?.toLowerCase().includes(search.toLowerCase()))
    : shifts;

  return (
    <AppLayout>
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Shifts &amp; Leaves</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
          Shifts &amp; Leaves
        </Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>
          Manage shift schedules, break durations and leave policies
        </Text>
      </div>

      {view === 'list' ? (
        <ListView
          shifts={filteredShifts}
          loading={loading}
          onRefresh={fetchShifts}
          onNew={handleNew}
          onEdit={handleEdit}
          onDelete={handleDelete}
          canWrite={canWrite}
          search={search}
          setSearch={setSearch}
        />
      ) : (
        <ShiftFormView
          shift={editingShift}
          onBack={handleBack}
          onSaved={handleSaved}
        />
      )}
    </AppLayout>
  );
};

export default ShiftsPage;
