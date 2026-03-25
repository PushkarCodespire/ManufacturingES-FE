import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Typography, Tag, Button, Select, DatePicker,
  Drawer, Form, InputNumber, Input, Modal, message, Space, Row, Col, Spin, Empty,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, RightOutlined,
  DeleteOutlined, UserAddOutlined, CalendarOutlined, EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout      from '../../../components/AppLayout';
import ResponsiveTable from '../../../components/ResponsiveTable';
import api            from '../../../api/axios';
import usePermissions from '../../../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option }      = Select;

export default function ShiftPlanningPage() {
  const { can } = usePermissions();
  const canWrite = can('prod-shift_planning-manage_shifts-create_edit_delete');

  // Reference data
  const [shifts,      setShifts]      = useState([]);
  const [workOrders,  setWorkOrders]  = useState([]);
  const [machines,    setMachines]    = useState([]);
  const [workCenters, setWorkCenters] = useState([]);
  const [operators,   setOperators]   = useState([]);

  const [selDate,     setSelDate]     = useState(dayjs());
  const [assignments, setAssignments] = useState([]);
  const [crew,        setCrew]        = useState([]);
  const [loading,     setLoading]     = useState(false);

  const [assignDrawer, setAssignDrawer] = useState(false);
  const [crewDrawer,   setCrewDrawer]   = useState(false);
  const [editRecord,   setEditRecord]   = useState(null);
  const [saving,       setSaving]       = useState(false);

  const [assignForm] = Form.useForm();
  const [crewForm]   = Form.useForm();

  // Load reference data once
  useEffect(() => {
    api.get('/shifts',       { params: { limit: 50 } })
      .then(d => setShifts(d?.data || [])).catch(() => {});
    // Fetch all work orders — no status filter, let planner choose
    api.get('/work-orders',  { params: { limit: 500 } })
      .then(d => setWorkOrders(d?.data || [])).catch(() => {});
    api.get('/machines',     { params: { limit: 300 } })
      .then(d => setMachines(d?.data || [])).catch(() => {});
    api.get('/work-centers', { params: { limit: 200 } })
      .then(d => setWorkCenters(d?.data || [])).catch(() => {});
    // Fetch all users for crew selection
    api.get('/users',        { params: { limit: 300 } })
      .then(d => setOperators(d?.data || d?.rows || [])).catch(() => {});
  }, []);

  // Load assignments + crew for selected date
  const load = useCallback(() => {
    const date = selDate.format('YYYY-MM-DD');
    setLoading(true);
    Promise.all([
      api.get('/shift-assignments',      { params: { date } }),
      api.get('/shift-assignments/crew', { params: { date } }),
    ])
      .then(([a, c]) => {
        setAssignments(a?.data || []);
        setCrew(c?.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selDate]);

  useEffect(() => { load(); }, [load]);

  // Group crew by shift_id
  const crewByShift = crew.reduce((acc, m) => {
    const key = m.shift_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  // Submit shift assignment
  const onSubmitAssignment = async (vals) => {
    setSaving(true);
    try {
      const payload = { ...vals, assignment_date: selDate.format('YYYY-MM-DD') };
      if (editRecord) {
        await api.put(`/shift-assignments/${editRecord.id}`, payload);
        message.success('Assignment updated');
      } else {
        await api.post('/shift-assignments', payload);
        message.success('Assignment created');
      }
      setAssignDrawer(false);
      assignForm.resetFields();
      setEditRecord(null);
      load();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const onDeleteAssignment = (id) => {
    Modal.confirm({
      title: 'Remove this shift assignment?',
      okText: 'Remove', okType: 'danger',
      onOk: async () => {
        await api.delete(`/shift-assignments/${id}`);
        message.success('Removed');
        load();
      },
    });
  };

  // Submit crew member
  const onSubmitCrew = async (vals) => {
    setSaving(true);
    try {
      await api.post('/shift-assignments/crew', {
        ...vals,
        assignment_date: selDate.format('YYYY-MM-DD'),
      });
      message.success('Crew member added');
      setCrewDrawer(false);
      crewForm.resetFields();
      load();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to add crew member');
    } finally {
      setSaving(false);
    }
  };

  const onRemoveCrew = (id) => {
    Modal.confirm({
      title: 'Remove crew member?', okType: 'danger',
      onOk: async () => {
        await api.delete(`/shift-assignments/crew/${id}`);
        message.success('Removed');
        load();
      },
    });
  };

  // Assignment table columns
  const assignCols = [
    {
      title: 'Shift', width: 140,
      render: (_, r) => <Tag color="blue">{r.Shift?.name || `Shift ${r.shift_id}`}</Tag>,
    },
    {
      title: 'Shift Time', width: 130,
      render: (_, r) => r.Shift ? `${r.Shift.start_time} – ${r.Shift.end_time}` : '—',
    },
    {
      title: 'Work Order', width: 130,
      render: (_, r) => <Text strong>{r.WorkOrder?.wo_no || '—'}</Text>,
    },
    {
      title: 'Machine', width: 130,
      render: (_, r) => r.Machine?.name || '—',
    },
    {
      title: 'Planned Qty', width: 110, dataIndex: 'planned_qty',
      render: v => parseFloat(v || 0).toFixed(0),
    },
    { title: 'Notes', dataIndex: 'notes', render: v => v || '—' },
    ...(canWrite ? [{
      title: 'Actions', width: 120,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditRecord(r);
              assignForm.setFieldsValue({
                work_order_id: r.work_order_id,
                shift_id:      r.shift_id,
                machine_id:    r.machine_id,
                planned_qty:   parseFloat(r.planned_qty),
                notes:         r.notes,
              });
              setAssignDrawer(true);
            }}
          />
          <Button
            size="small" danger
            icon={<DeleteOutlined />}
            onClick={() => onDeleteAssignment(r.id)}
          />
        </Space>
      ),
    }] : []),
  ];

  return (
    <AppLayout>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Shift Planning</Text>
        </div>

        <Title level={3} style={{ margin: 0 }}>Shift Planning</Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Assign work orders to shifts and manage crew rosters by date.
        </Text>

        {/* Date + controls bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <CalendarOutlined style={{ color: '#6b7280' }} />
          <DatePicker
            value={selDate}
            onChange={d => d && setSelDate(d)}
            format="DD MMM YYYY"
            allowClear={false}
            style={{ width: 150 }}
          />
          <Tag color="blue">{assignments.length} Assignment{assignments.length !== 1 ? 's' : ''}</Tag>
          <Tag color="green">{crew.length} Crew Member{crew.length !== 1 ? 's' : ''}</Tag>
          <Button icon={<ReloadOutlined />} onClick={load} style={{ marginLeft: 'auto' }}>Refresh</Button>
        </div>

        {/* Assignments card */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Shift Assignments</Text>
              {canWrite && (
                <Button
                  type="primary" size="small" icon={<PlusOutlined />}
                  onClick={() => { setEditRecord(null); assignForm.resetFields(); setAssignDrawer(true); }}
                >
                  Assign WO to Shift
                </Button>
              )}
            </div>
          }
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
          bodyStyle={{ padding: '8px 20px' }}
        >
          <ResponsiveTable
            columns={assignCols}
            dataSource={assignments}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 800 }}
            pagination={false}
            locale={{ emptyText: 'No assignments for this date' }}
          />
        </Card>

        {/* Crew Roster card */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>Crew Roster</Text>
              {canWrite && (
                <Button
                  size="small" icon={<UserAddOutlined />}
                  onClick={() => { crewForm.resetFields(); setCrewDrawer(true); }}
                >
                  Add Crew Member
                </Button>
              )}
            </div>
          }
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: '12px 20px' }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
          ) : shifts.length === 0 ? (
            <Empty description="No shifts configured" />
          ) : (
            <Row gutter={16}>
              {shifts.map(shift => (
                <Col key={shift.id} xs={24} sm={12} md={8} style={{ marginBottom: 12 }}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <Tag color="purple">{shift.name}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {shift.start_time} – {shift.end_time}
                        </Text>
                      </Space>
                    }
                    style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
                  >
                    {!(crewByShift[shift.id]?.length) ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>No crew assigned</Text>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {crewByShift[shift.id].map(m => (
                          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <Text style={{ fontSize: 13 }}>{m.User?.name}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {m.User?.employee_id}
                                {' · '}
                                <Tag style={{ margin: 0, fontSize: 10 }}>{m.role_in_shift}</Tag>
                                {m.WorkCenter ? ` · ${m.WorkCenter.name}` : ''}
                              </Text>
                            </div>
                            {canWrite && (
                              <Button
                                size="small" danger type="text"
                                icon={<DeleteOutlined />}
                                onClick={() => onRemoveCrew(m.id)}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>

        {/* Assignment Drawer */}
        <Drawer
          title={editRecord ? 'Edit Shift Assignment' : 'Assign WO to Shift'}
          open={assignDrawer}
          onClose={() => { setAssignDrawer(false); setEditRecord(null); assignForm.resetFields(); }}
          width={480}
          footer={
            <div style={{ textAlign: 'right' }}>
              <Button style={{ marginRight: 8 }} onClick={() => setAssignDrawer(false)}>Cancel</Button>
              <Button type="primary" loading={saving} onClick={() => assignForm.submit()}>Save</Button>
            </div>
          }
        >
          <Form form={assignForm} layout="vertical" onFinish={onSubmitAssignment}>
            <Form.Item name="shift_id" label="Shift" rules={[{ required: true, message: 'Select a shift' }]}>
              <Select placeholder="Select shift">
                {shifts.map(s => (
                  <Option key={s.id} value={s.id}>{s.name} ({s.start_time} – {s.end_time})</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="work_order_id" label="Work Order" rules={[{ required: true, message: 'Select a work order' }]}>
              <Select placeholder="Select work order" showSearch optionFilterProp="children">
                {workOrders.map(wo => (
                  <Option key={wo.id} value={wo.id}>{wo.wo_no}{wo.status ? ` (${wo.status})` : ''}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="machine_id" label="Machine (optional)">
              <Select placeholder="Select machine" allowClear showSearch optionFilterProp="children">
                {machines.map(m => <Option key={m.id} value={m.id}>{m.name}</Option>)}
              </Select>
            </Form.Item>

            <Form.Item name="planned_qty" label="Planned Qty">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>

            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} placeholder="Optional notes" />
            </Form.Item>
          </Form>
        </Drawer>

        {/* Crew Drawer */}
        <Drawer
          title="Add Crew Member"
          open={crewDrawer}
          onClose={() => { setCrewDrawer(false); crewForm.resetFields(); }}
          width={420}
          footer={
            <div style={{ textAlign: 'right' }}>
              <Button style={{ marginRight: 8 }} onClick={() => setCrewDrawer(false)}>Cancel</Button>
              <Button type="primary" loading={saving} onClick={() => crewForm.submit()}>Add</Button>
            </div>
          }
        >
          <Form form={crewForm} layout="vertical" onFinish={onSubmitCrew}>
            <Form.Item name="shift_id" label="Shift" rules={[{ required: true, message: 'Select a shift' }]}>
              <Select placeholder="Select shift">
                {shifts.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
              </Select>
            </Form.Item>

            <Form.Item name="user_id" label="Employee / Operator" rules={[{ required: true, message: 'Select a person' }]}>
              <Select placeholder="Select person" showSearch optionFilterProp="children">
                {operators.map(u => (
                  <Option key={u.id} value={u.id}>{u.name} ({u.employee_id})</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="role_in_shift" label="Role" initialValue="operator">
              <Select>
                <Option value="operator">Operator</Option>
                <Option value="supervisor">Supervisor</Option>
                <Option value="helper">Helper</Option>
              </Select>
            </Form.Item>

            <Form.Item name="work_center_id" label="Work Centre (optional)">
              <Select placeholder="Select work centre" allowClear showSearch optionFilterProp="children">
                {workCenters.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
              </Select>
            </Form.Item>
          </Form>
        </Drawer>
    </AppLayout>
  );
}
