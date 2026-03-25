import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Tag, Button, Modal, Select, Input, Typography, Space, message,
} from 'antd';
import {
  AlertOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import AppLayout from '../../../components/AppLayout';
import { andonApi } from '../../../api/production.api';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ALERT_TYPES = [
  { value: 'machine_down',      label: 'Machine Down',      color: '#f5222d' },
  { value: 'material_shortage', label: 'Material Shortage', color: '#fa8c16' },
  { value: 'quality_hold',      label: 'Quality Hold',      color: '#1d4ed8' },
  { value: 'safety',            label: 'Safety',            color: '#722ed1' },
  { value: 'other',             label: 'Other',             color: '#8c8c8c' },
];

const getBorderColor = (status) => {
  if (status === 'alert')        return '#f5222d';
  if (status === 'acknowledged') return '#fa8c16';
  if (status === 'running')      return '#52c41a';
  return '#d9d9d9';
};

const getBgColor = (status) => {
  if (status === 'alert')        return '#fff1f0';
  if (status === 'acknowledged') return '#fff7e6';
  if (status === 'running')      return '#f6ffed';
  return '#fafafa';
};

export default function AndonPage() {
  const [board, setBoard]                     = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [raiseModalVisible, setRaiseVisible]  = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [alertType, setAlertType]             = useState(null);
  const [alertNotes, setAlertNotes]           = useState('');
  const [submitting, setSubmitting]           = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await andonApi.getBoard();
      setBoard(Array.isArray(result) ? result : (result?.data ?? []));
    } catch {
      // silent fail on auto-refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(loadBoard, 5000);
    return () => clearInterval(interval);
  }, [loadBoard]);

  const handleRaiseAlert = async () => {
    if (!alertType) { message.warning('Please select an alert type'); return; }
    try {
      setSubmitting(true);
      await andonApi.raiseAlert({
        machine_id: selectedMachine?.machine_id || null,
        alert_type: alertType,
        notes: alertNotes || null,
      });
      message.success('Alert raised successfully');
      setRaiseVisible(false);
      setAlertType(null);
      setAlertNotes('');
      setSelectedMachine(null);
      loadBoard();
    } catch {
      message.error('Failed to raise alert');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await andonApi.acknowledgeAlert(alertId);
      message.success('Alert acknowledged');
      loadBoard();
    } catch {
      message.error('Failed to acknowledge alert');
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await andonApi.resolveAlert(alertId, {});
      message.success('Alert resolved');
      loadBoard();
    } catch {
      message.error('Failed to resolve alert');
    }
  };

  return (
    <AppLayout>
      <div>
        <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 0 3px rgba(245,34,45,0.3)} 50%{box-shadow:0 0 0 8px rgba(245,34,45,0.05)} }`}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>Production</Text>
              <Text style={{ color: '#d1d5db', fontSize: 10 }}>›</Text>
              <Text style={{ color: '#6b7280', fontSize: 12 }}>Andon Board</Text>
            </div>
            <Title level={3} style={{ margin: 0 }}>Andon Board</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Real-time machine alert dashboard — auto-refreshes every 5 seconds</Text>
          </div>
          <Button type="primary" danger icon={<AlertOutlined />} onClick={() => setRaiseVisible(true)}>
            Raise Alert
          </Button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { color: '#52c41a', label: 'Running', pulse: false },
            { color: '#f5222d', label: 'Alert (Open)', pulse: true },
            { color: '#fa8c16', label: 'Acknowledged', pulse: false },
            { color: '#d9d9d9', label: 'Idle', pulse: false },
          ].map((item) => (
            <Space key={item.label}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                background: item.color,
                animation: item.pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }} />
              <Text style={{ fontSize: 12 }}>{item.label}</Text>
            </Space>
          ))}
        </div>

        {/* Board Grid */}
        <Row gutter={[12, 12]}>
          {board.map((machine) => {
            const borderColor = getBorderColor(machine.board_status);
            const bgColor     = getBgColor(machine.board_status);
            const isPulsing   = machine.board_status === 'alert';

            return (
              <Col key={machine.machine_id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  style={{ borderRadius: 10, border: `2px solid ${borderColor}`, background: bgColor, minHeight: 160 }}
                  styles={{ body: { padding: '12px 14px' } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <Text strong style={{ fontSize: 14, display: 'block' }}>{machine.machine_name}</Text>
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>{machine.machine_code}</Text>
                    </div>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                      background: borderColor,
                      animation: isPulsing ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    }} />
                  </div>

                  <Text style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 8 }}>
                    {machine.current_wo ? `WO: ${machine.current_wo.wo_no}` : 'No active WO'}
                  </Text>

                  {machine.alert && (
                    <div style={{ marginBottom: 8 }}>
                      <Tag color={ALERT_TYPES.find((t) => t.value === machine.alert_type)?.color || 'red'} style={{ fontSize: 11 }}>
                        {machine.alert_type?.replace(/_/g, ' ').toUpperCase()}
                      </Tag>
                      <Text style={{ fontSize: 10, color: '#6b7280', display: 'block', marginTop: 2 }}>
                        Raised: {new Date(machine.alert.createdAt || machine.alert.created_at).toLocaleTimeString()}
                      </Text>
                    </div>
                  )}

                  {machine.alert && machine.board_status === 'alert' && (
                    <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleAcknowledge(machine.alert.id)} style={{ marginRight: 6 }}>
                      Ack
                    </Button>
                  )}
                  {machine.alert && machine.board_status === 'acknowledged' && (
                    <Button size="small" type="primary" icon={<CloseCircleOutlined />} onClick={() => handleResolve(machine.alert.id)}>
                      Resolve
                    </Button>
                  )}
                  {!machine.alert && (
                    <Button size="small" danger icon={<AlertOutlined />} onClick={() => { setSelectedMachine(machine); setRaiseVisible(true); }}>
                      Raise Alert
                    </Button>
                  )}
                </Card>
              </Col>
            );
          })}
          {!loading && board.length === 0 && (
            <Col span={24}>
              <Text type="secondary">No machines found.</Text>
            </Col>
          )}
        </Row>

        {/* Raise Alert Modal */}
        <Modal
          title={<Space><AlertOutlined style={{ color: '#f5222d' }} /><span>Raise Andon Alert</span></Space>}
          open={raiseModalVisible}
          onCancel={() => { setRaiseVisible(false); setAlertType(null); setAlertNotes(''); setSelectedMachine(null); }}
          onOk={handleRaiseAlert}
          okText="Raise Alert"
          okButtonProps={{ danger: true, loading: submitting }}
        >
          {selectedMachine && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Machine: </Text>
              <Text strong>{selectedMachine.machine_name}</Text>
            </div>
          )}
          {!selectedMachine && (
            <div style={{ marginBottom: 16 }}>
              <Text style={{ display: 'block', marginBottom: 6 }}>Machine (optional)</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="Select machine (optional)"
                allowClear
                value={selectedMachine?.machine_id || undefined}
                onChange={(val) => setSelectedMachine(board.find((b) => b.machine_id === val) || null)}
                options={board.map((m) => ({ value: m.machine_id, label: m.machine_name }))}
              />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <Text style={{ display: 'block', marginBottom: 8 }}>Alert Type</Text>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ALERT_TYPES.map((type) => (
                <Button
                  key={type.value}
                  size="small"
                  type={alertType === type.value ? 'primary' : 'default'}
                  style={{
                    borderColor: type.color,
                    color: alertType === type.value ? '#fff' : type.color,
                    background: alertType === type.value ? type.color : undefined,
                  }}
                  onClick={() => setAlertType(type.value)}
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>Notes (optional)</Text>
            <TextArea rows={3} placeholder="Describe the issue..." value={alertNotes} onChange={(e) => setAlertNotes(e.target.value)} />
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
