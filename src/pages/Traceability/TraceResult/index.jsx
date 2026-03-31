import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Button, Typography, Space, Tag, Descriptions, Spin, Alert,
  Timeline, Table, Badge, Empty,
} from 'antd';
import {
  ApartmentOutlined, PrinterOutlined, ArrowLeftOutlined,
  InboxOutlined, ShopOutlined, ToolOutlined, CarOutlined,
  ExperimentOutlined, BarcodeOutlined,
DownloadOutlined, } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../../../components/AppLayout';
import { traceabilityApi } from '../../../api/traceability.api';
import { printContent } from '../../../utils/printContent';
import { exportToCsv } from '../../../utils/exportCsv';

const { Title, Text } = Typography;

const STAGE_META = {
  grn:        { icon: <InboxOutlined />,     color: '#52c41a', label: 'GRN Receipt' },
  issue:      { icon: <ShopOutlined />,       color: '#1677ff', label: 'Issued to Production' },
  work_order: { icon: <ToolOutlined />,       color: '#722ed1', label: 'Work Order / Production' },
  dispatch:   { icon: <CarOutlined />,        color: '#fa8c16', label: 'Dispatched to Customer' },
};

function QcBadge({ result }) {
  if (!result) return <Badge status="default" text="N/A" />;
  const map = { pass: 'success', fail: 'error', pending: 'processing', conditional: 'warning' };
  return <Badge status={map[result] || 'default'} text={result.toUpperCase()} />;
}

function StageCard({ stage }) {
  const meta = STAGE_META[stage.stage] || { color: '#8c8c8c' };

  return (
    <Card
      size="small"
      style={{ borderLeft: `4px solid ${meta.color}`, marginBottom: 0 }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      {stage.stage === 'grn' && (
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="GRN No">{stage.grn_no || '—'}</Descriptions.Item>
            <Descriptions.Item label="Date">{stage.received_date || '—'}</Descriptions.Item>
            <Descriptions.Item label="Vendor">{stage.vendor || '—'}</Descriptions.Item>
            <Descriptions.Item label="Item">{stage.item_name} {stage.item_code ? `(${stage.item_code})` : ''}</Descriptions.Item>
            <Descriptions.Item label="Qty Received">{stage.qty_received}</Descriptions.Item>
            {stage.expiry_date && <Descriptions.Item label="Expiry">{stage.expiry_date}</Descriptions.Item>}
          </Descriptions>
          {stage.iqc && (
            <div><Text type="secondary" style={{ fontSize: 12 }}>IQC: </Text><QcBadge result={stage.iqc.result} /></div>
          )}
        </Space>
      )}

      {stage.stage === 'issue' && (
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Slip No">{stage.slip_no || '—'}</Descriptions.Item>
          <Descriptions.Item label="Date">{stage.issued_date || '—'}</Descriptions.Item>
          <Descriptions.Item label="Department">{stage.department || '—'}</Descriptions.Item>
          <Descriptions.Item label="Qty Issued">{stage.qty_issued}</Descriptions.Item>
        </Descriptions>
      )}

      {stage.stage === 'work_order' && (
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="WO No">{stage.wo_no}</Descriptions.Item>
            <Descriptions.Item label="Item">{stage.item_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Machine">{stage.machine || '—'}</Descriptions.Item>
            <Descriptions.Item label="Produced Qty">{stage.produced_qty}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={stage.status === 'completed' ? 'success' : 'processing'}>{stage.status}</Tag>
            </Descriptions.Item>
            {stage.manufactured_batch_no && (
              <Descriptions.Item label="Mfg Batch">
                <Tag color="purple"><BarcodeOutlined /> {stage.manufactured_batch_no}</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
          <Space size={16}>
            {stage.pqc && <span><Text type="secondary" style={{ fontSize: 12 }}>PQC: </Text><QcBadge result={stage.pqc.result} /></span>}
            {stage.oqc && <span><Text type="secondary" style={{ fontSize: 12 }}>OQC: </Text><QcBadge result={stage.oqc.result} /></span>}
          </Space>
        </Space>
      )}

      {stage.stage === 'dispatch' && (
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Dispatch No">{stage.dispatch_no || '—'}</Descriptions.Item>
          <Descriptions.Item label="Date">{stage.dispatch_date || '—'}</Descriptions.Item>
          <Descriptions.Item label="Customer">{stage.customer || '—'}</Descriptions.Item>
          <Descriptions.Item label="Qty">{stage.quantity}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={stage.status === 'delivered' ? 'success' : 'processing'}>{stage.status}</Tag>
          </Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  );
}

/* ── WO Genealogy view ────────────────────────────────────────────────────── */
function WoView({ data }) {
  const materialCols = [
    { title: 'Slip No',    dataIndex: 'slip_no',    key: 'slip_no',    width: 130 },
    { title: 'Item',       dataIndex: 'item_name',  key: 'item_name'   },
    { title: 'Lot No',     dataIndex: 'lot_no',     key: 'lot_no',     render: v => v ? <Tag color="blue">{v}</Tag> : '—' },
    { title: 'Qty Issued', dataIndex: 'qty_issued', key: 'qty_issued', width: 110, align: 'right' },
    { title: 'Date',       dataIndex: 'issued_date',key: 'issued_date',width: 120 },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card size="small" title="Work Order Summary">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="WO No">{data.wo_no}</Descriptions.Item>
          <Descriptions.Item label="Item">{data.item_name} {data.item_code ? `(${data.item_code})` : ''}</Descriptions.Item>
          <Descriptions.Item label="Machine">{data.machine || '—'}</Descriptions.Item>
          <Descriptions.Item label="Planned Qty">{data.planned_qty}</Descriptions.Item>
          <Descriptions.Item label="Produced Qty">{data.produced_qty}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={data.status === 'completed' ? 'success' : 'processing'}>{data.status}</Tag>
          </Descriptions.Item>
          {data.manufactured_batch_no && (
            <Descriptions.Item label="Manufactured Batch" span={3}>
              <Tag color="purple" icon={<BarcodeOutlined />}>{data.manufactured_batch_no}</Tag>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card size="small" title="Material Inputs (Lots Used)">
        {data.material_inputs?.length > 0
          ? <Table dataSource={data.material_inputs} columns={materialCols} rowKey={(_, i) => i} pagination={false} size="small" />
          : <Empty description="No lot-tracked material inputs found" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </Card>

      <Card size="small" title="Quality Checks">
        {(!data.pqc?.length && !data.oqc?.length)
          ? <Empty description="No QC records" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          : (
            <Space direction="vertical">
              {data.pqc?.map((p, i) => (
                <div key={i}><Text type="secondary">PQC: </Text><QcBadge result={p.result} />{p.batch_no && <Tag style={{ marginLeft: 8 }}>{p.batch_no}</Tag>}</div>
              ))}
              {data.oqc?.map((o, i) => (
                <div key={i}><Text type="secondary">OQC: </Text><QcBadge result={o.result} />{o.batch_no && <Tag style={{ marginLeft: 8 }}>{o.batch_no}</Tag>}</div>
              ))}
            </Space>
          )}
      </Card>

      {data.dispatches?.length > 0 && (
        <Card size="small" title="Dispatched">
          {data.dispatches.map((d, i) => (
            <Descriptions key={i} column={3} size="small" style={{ marginBottom: i < data.dispatches.length - 1 ? 12 : 0 }}>
              <Descriptions.Item label="Dispatch No">{d.dispatch_no}</Descriptions.Item>
              <Descriptions.Item label="Date">{d.dispatch_date}</Descriptions.Item>
              <Descriptions.Item label="Qty">{d.quantity}</Descriptions.Item>
            </Descriptions>
          ))}
        </Card>
      )}
    </Space>
  );
}

/* ── GRN view ─────────────────────────────────────────────────────────────── */
function GrnView({ data }) {
  const cols = [
    { title: 'Item',         dataIndex: 'item_name',    key: 'item_name' },
    { title: 'Item Code',    dataIndex: 'item_code',    key: 'item_code',    width: 120 },
    { title: 'Lot No',       dataIndex: 'lot_no',       key: 'lot_no',       render: v => v ? <Tag color="blue"><BarcodeOutlined /> {v}</Tag> : '—' },
    { title: 'Qty Received', dataIndex: 'qty_received', key: 'qty_received', width: 120, align: 'right' },
    { title: 'Expiry',       dataIndex: 'expiry_date',  key: 'expiry_date',  width: 120, render: v => v || '—' },
  ];
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card size="small" title="GRN Summary">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="GRN No">{data.grn_no}</Descriptions.Item>
          <Descriptions.Item label="Vendor">{data.vendor || '—'}</Descriptions.Item>
          <Descriptions.Item label="Received Date">{data.received_date || '—'}</Descriptions.Item>
          {data.iqc && (
            <Descriptions.Item label="IQC Result">
              <QcBadge result={data.iqc.result} />
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
      <Card size="small" title="Items Received">
        {data.items?.length > 0
          ? <Table dataSource={data.items} columns={cols} rowKey={(_, i) => i} pagination={false} size="small" />
          : <Empty description="No items found" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      </Card>
    </Space>
  );
}

/* ── Dispatch backward view ───────────────────────────────────────────────── */
function DispatchView({ data }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card size="small" title="Dispatch Summary">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Dispatch No">{data.dispatch_no}</Descriptions.Item>
          <Descriptions.Item label="Customer">{data.customer || '—'}</Descriptions.Item>
          <Descriptions.Item label="Date">{data.dispatch_date}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={data.status === 'delivered' ? 'success' : 'processing'}>{data.status}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {(data.items || []).map((item, idx) => (
        <Card key={idx} size="small"
          title={`${item.item_name || '—'} ${item.item_code ? `(${item.item_code})` : ''} — Qty: ${item.quantity}`}
        >
          {item.lot_no && (
            <div style={{ marginBottom: 10 }}>
              <Text type="secondary">Lot / Batch: </Text>
              <Tag color="blue">{item.lot_no}</Tag>
            </div>
          )}
          {item.source ? (
            item.source.type === 'manufactured' ? (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Source">Manufactured in-house</Descriptions.Item>
                <Descriptions.Item label="WO No">{item.source.wo_no}</Descriptions.Item>
                <Descriptions.Item label="Machine">{item.source.machine || '—'}</Descriptions.Item>
                <Descriptions.Item label="Input Lots">
                  {item.source.input_lots?.length > 0
                    ? item.source.input_lots.map((l, i) => <Tag key={i} color="cyan">{l.lot_no}</Tag>)
                    : '—'}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Source">Supplier</Descriptions.Item>
                <Descriptions.Item label="GRN">{item.source.grn_no}</Descriptions.Item>
                <Descriptions.Item label="Vendor">{item.source.vendor || '—'}</Descriptions.Item>
                <Descriptions.Item label="Received">{item.source.received_date}</Descriptions.Item>
              </Descriptions>
            )
          ) : (
            <Text type="secondary">No lot source traced (lot_no not set on dispatch item)</Text>
          )}
        </Card>
      ))}
    </Space>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function TraceResult() {
  const navigate    = useNavigate();
  const { state }   = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [data, setData]       = useState(null);
  const printRef    = useRef(null);

  useEffect(() => {
    if (!state) return;
    fetchTrace(state);
  }, []);   // eslint-disable-line

  async function fetchTrace(item) {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      let result;
      if (item.type === 'lot') {
        result = await traceabilityApi.lot(item.ref);
        result._view = 'forward';
      } else if (item.type === 'grn') {
        result = await traceabilityApi.grn(item.ref);
        result._view = 'grn';
      } else if (item.type === 'wo') {
        result = await traceabilityApi.wo(item.ref);
        result._view = 'wo';
      } else if (item.type === 'dispatch') {
        result = await traceabilityApi.dispatch(item.ref);
        result._view = 'dispatch';
      } else {
        // unknown type — try lot, then grn, then wo
        try {
          result = await traceabilityApi.lot(item.ref);
          result._view = 'forward';
        } catch {
          try {
            result = await traceabilityApi.grn(item.ref);
            result._view = 'grn';
          } catch {
            result = await traceabilityApi.wo(item.ref);
            result._view = 'wo';
          }
        }
      }
      setData(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = useCallback(() => {
    printContent(printRef.current, {
      title: `Trace: ${state?.label || 'Traceability'}`,
      header: `<h2>Trace: ${state?.label || ''}</h2><p>${state?.sub || ''}</p>`,
    });
  }, [state]);

  if (!state) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/traceability')}>Back to Search</Button>
        <Empty style={{ marginTop: 48 }} description="No trace selected — go back and search" />
      </div>
    );
  }

  return (
    <AppLayout>
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>

        {/* Toolbar */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/traceability')}>Back</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print / Save PDF</Button>
        </div>

        {/* Printable content area */}
        <div ref={printRef}>
          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>
              <ApartmentOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              Trace: {state.label}
            </Title>
            {state.sub && <Text type="secondary">{state.sub}</Text>}
          </div>

          {loading && <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>}

          {error && <Alert type="error" message={error} showIcon />}

          {data && !loading && (
            <>
              {/* Forward (lot) trace */}
              {data._view === 'forward' && (
                <>
                  <div>
                    <Tag color="blue" icon={<BarcodeOutlined />}>Lot: {data.lot_no}</Tag>
                    <Text type="secondary" style={{ marginLeft: 8 }}>{data.stages?.length} stage(s) traced</Text>
                  </div>
                  {data.stages?.length === 0
                    ? <Empty description="No trace chain found for this lot" />
                    : (
                      <Timeline
                        items={(data.stages || []).map(stage => {
                          const meta = STAGE_META[stage.stage] || { icon: <ExperimentOutlined />, color: '#8c8c8c' };
                          return {
                            dot: React.cloneElement(meta.icon, { style: { fontSize: 18, color: meta.color } }),
                            children: (
                              <div>
                                <Text strong style={{ color: meta.color }}>{stage.label}</Text>
                                <div style={{ marginTop: 8 }}>
                                  <StageCard stage={stage} />
                                </div>
                              </div>
                            ),
                          };
                        })}
                      />
                    )}
                </>
              )}

              {data._view === 'grn'      && <GrnView data={data} />}
              {data._view === 'wo'       && <WoView data={data} />}
              {data._view === 'dispatch' && <DispatchView data={data} />}
            </>
          )}
        </div>

      </Space>

    </div>
    </AppLayout>
  );
}
