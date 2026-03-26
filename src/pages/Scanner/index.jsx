import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Typography, Card, Button, Input, message, Result, Spin, Tag } from 'antd';
import {
  ScanOutlined, SearchOutlined, CameraOutlined,
  RightOutlined, StopOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import AppLayout from '../../components/AppLayout';
import api from '../../api/axios';

const { Title, Text } = Typography;

export default function ScannerPage() {
  const navigate = useNavigate();
  const [scanning, setScanning]     = useState(false);
  const [looking, setLooking]       = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [error, setError]           = useState(null);
  const scannerRef = useRef(null);
  const processingRef = useRef(false);

  const lookup = useCallback(async (code) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setLooking(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await api.get('/qr-lookup', { params: { code } });
      const data = res?.data ?? res;
      if (data.success !== false) {
        setLastResult(data);
        message.success(`Found: ${data.label || data.identifier}`);
        // Stop scanner before navigating
        if (scannerRef.current) {
          try { await scannerRef.current.stop(); } catch {}
          scannerRef.current.clear();
          scannerRef.current = null;
          setScanning(false);
        }
        navigate(data.path);
      } else {
        setError(data.message || 'Not found');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Lookup failed';
      setError(msg);
    } finally {
      setLooking(false);
      processingRef.current = false;
    }
  }, [navigate]);

  const startScanner = useCallback(async () => {
    setError(null);
    setLastResult(null);
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      setScanning(true);

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => {
          lookup(decodedText);
        },
        () => {}, // ignore errors during scanning
      );
    } catch (err) {
      setError('Camera access denied or not available. Use manual entry below.');
      setScanning(false);
    }
  }, [lookup]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch {}
        try { scannerRef.current.clear(); } catch {}
      }
    };
  }, []);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) { message.warning('Enter a QR code value'); return; }
    lookup(code);
  };

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>Tools</Text>
        <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
        <Text style={{ color: '#6b7280', fontSize: 12 }}>QR Scanner</Text>
      </div>

      <Title level={3} style={{ margin: 0 }}>QR Scanner</Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        Scan a QR code label to instantly navigate to a Work Order, GRN, PO, Job Card, Instrument, or Mold record.
      </Text>

      <div style={{ marginTop: 16, maxWidth: 600 }}>
        {/* Camera scanner */}
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
          bodyStyle={{ padding: '20px 24px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontWeight: 600, fontSize: 14 }}>
              <CameraOutlined style={{ marginRight: 8 }} />Camera Scan
            </Text>
            {!scanning ? (
              <Button type="primary" icon={<ScanOutlined />} onClick={startScanner}>
                Start Scanner
              </Button>
            ) : (
              <Button danger icon={<StopOutlined />} onClick={stopScanner}>
                Stop Scanner
              </Button>
            )}
          </div>

          <div
            id="qr-reader"
            style={{
              width: '100%',
              minHeight: scanning ? 300 : 0,
              borderRadius: 8,
              overflow: 'hidden',
              background: scanning ? '#000' : 'transparent',
            }}
          />

          {!scanning && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
              <ScanOutlined style={{ fontSize: 48, marginBottom: 8, display: 'block' }} />
              <Text type="secondary">Click "Start Scanner" to use your camera</Text>
            </div>
          )}
        </Card>

        {/* Manual entry */}
        <Card
          style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}
          bodyStyle={{ padding: '20px 24px' }}
        >
          <Text style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 12 }}>
            <SearchOutlined style={{ marginRight: 8 }} />Manual Entry
          </Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="e.g. DT:WO:WO-2026-0001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onPressEnter={handleManualSubmit}
              style={{ borderRadius: 8 }}
              size="large"
            />
            <Button type="primary" size="large" onClick={handleManualSubmit} loading={looking}>
              Go
            </Button>
          </div>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Supported formats:{' '}
              {['WO', 'GRN', 'PO', 'JC', 'INST', 'MOLD'].map((t) => (
                <Tag key={t} style={{ fontSize: 11, marginBottom: 4 }}>DT:{t}:...</Tag>
              ))}
            </Text>
          </div>
        </Card>

        {/* Status */}
        {looking && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin size="large" />
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>Looking up record...</Text>
          </div>
        )}
        {error && (
          <Result status="warning" title="Not Found" subTitle={error}
            style={{ padding: '16px 0' }} />
        )}
      </div>
    </AppLayout>
  );
}
