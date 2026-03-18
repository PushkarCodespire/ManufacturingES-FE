import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Button, Select, Spin, Card, Tag, Tooltip, message, Space,
} from 'antd';
import {
  ReloadOutlined, RightOutlined, AppstoreOutlined, DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { trainingRecordApi } from '../../../api/trainingRecord.api';
import AppLayout             from '../../../components/AppLayout';
import api                   from '../../../api/axios';

const { Title, Text } = Typography;

const CATEGORY_COLORS = {
  Machine: '#1d4ed8', Process: '#7c3aed', Quality: '#16a34a',
  Safety: '#dc2626', SOP: '#d97706', Other: '#6b7280',
};

const CellStatus = ({ cell, topic }) => {
  if (!cell) {
    // Not required — shown as blank cell
    return <div style={{ width: '100%', height: 36, background: '#f9fafb', borderRadius: 4 }} />;
  }
  if (cell.status === 'missing') {
    return (
      <Tooltip title={`Missing: ${topic?.name}`}>
        <div style={{
          width: '100%', height: 36, background: '#fee2e2', border: '1px solid #fca5a5',
          borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 16 }}>✕</span>
        </div>
      </Tooltip>
    );
  }
  const color = cell.status === 'active' ? '#dcfce7'
    : cell.status === 'expiring_soon' ? '#fef9c3'
    : '#fee2e2';
  const border = cell.status === 'active' ? '#86efac'
    : cell.status === 'expiring_soon' ? '#fde047'
    : '#fca5a5';
  const textColor = cell.status === 'active' ? '#15803d'
    : cell.status === 'expiring_soon' ? '#854d0e'
    : '#b91c1c';

  const label = cell.status === 'active'
    ? dayjs(cell.expiry_date).format('MMM YY')
    : cell.status === 'expiring_soon'
    ? `${dayjs(cell.expiry_date).diff(dayjs(), 'day')}d`
    : 'Exp';

  return (
    <Tooltip title={
      <div>
        <div><b>{topic?.name}</b></div>
        <div>Status: {cell.status?.replace('_', ' ')}</div>
        <div>Expiry: {cell.expiry_date ? dayjs(cell.expiry_date).format('DD MMM YYYY') : '—'}</div>
      </div>
    }>
      <div style={{
        width: '100%', height: 36, background: color, border: `1px solid ${border}`,
        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: textColor }}>{label}</Text>
      </div>
    </Tooltip>
  );
};

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
const CompetencyMatrixPage = () => {
  const [matrixData,  setMatrixData]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [deptFilter,  setDeptFilter]  = useState(null);
  const [catFilter,   setCatFilter]   = useState(null);
  const [showFilter,  setShowFilter]  = useState('all'); // all | gaps | expiring
  const [departments, setDepartments] = useState([]);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await trainingRecordApi.getMatrix();
      setMatrixData(res?.data ?? res ?? null);
    } catch (err) {
      message.error(err?.message || 'Failed to load competency matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepts = useCallback(async () => {
    try {
      const res = await api.get('/users/departments').then((r) => r.data);
      setDepartments(res?.data ?? res ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchMatrix(); fetchDepts(); }, [fetchMatrix, fetchDepts]);

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip="Loading matrix…" />
        </div>
      </AppLayout>
    );
  }

  const employees = matrixData?.employees ?? [];
  const topics    = matrixData?.topics    ?? [];
  const matrix    = matrixData?.matrix    ?? {};

  // Filter topics by category
  const filteredTopics = catFilter
    ? topics.filter((t) => t.category === catFilter)
    : topics;

  // Filter employees by department
  let filteredEmployees = deptFilter
    ? employees.filter((e) => e.department_id === deptFilter || e.department?.id === deptFilter)
    : employees;

  // Filter by show mode
  if (showFilter === 'gaps') {
    filteredEmployees = filteredEmployees.filter((emp) => {
      const empRow = matrix[emp.id] ?? {};
      return filteredTopics.some((t) => {
        const cell = empRow[t.id];
        return !cell || cell.status === 'missing' || cell.status === 'expired';
      });
    });
  } else if (showFilter === 'expiring') {
    filteredEmployees = filteredEmployees.filter((emp) => {
      const empRow = matrix[emp.id] ?? {};
      return filteredTopics.some((t) => {
        const cell = empRow[t.id];
        return cell && cell.status === 'expiring_soon';
      });
    });
  }

  // Summary stats
  let totalRequired = 0, gapCount = 0, expiringCount = 0, coveredCount = 0;
  employees.forEach((emp) => {
    const empRow = matrix[emp.id] ?? {};
    topics.forEach((t) => {
      const cell = empRow[t.id];
      if (cell) {
        totalRequired++;
        if (cell.status === 'active')         coveredCount++;
        if (cell.status === 'expiring_soon')  expiringCount++;
        if (cell.status === 'missing' || cell.status === 'expired') gapCount++;
      }
    });
  });
  const coverage = totalRequired > 0 ? Math.round((coveredCount / totalRequired) * 100) : 0;

  const handleExportCSV = () => {
    const header = ['Employee', 'Employee ID', ...filteredTopics.map((t) => t.name)].join(',');
    const rows = filteredEmployees.map((emp) => {
      const empRow = matrix[emp.id] ?? {};
      const cells = filteredTopics.map((t) => {
        const cell = empRow[t.id];
        if (!cell) return 'N/R';
        return cell.status === 'active' ? `Active(${cell.expiry_date})`
          : cell.status === 'expiring_soon' ? `Expiring(${cell.expiry_date})`
          : cell.status === 'expired' ? `Expired(${cell.expiry_date})`
          : 'Missing';
      });
      return [`"${emp.name}"`, emp.employee_id, ...cells].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'competency_matrix.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const categories = [...new Set(topics.map((t) => t.category))];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ color: '#9ca3af', fontSize: 12 }}>Masters</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>HR &amp; Training</Text>
          <RightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
          <Text style={{ color: '#6b7280', fontSize: 12 }}>Competency Matrix</Text>
        </div>
        <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>Competency Matrix</Title>
        <Text style={{ color: '#6b7280', fontSize: 13 }}>Visual overview of employee training coverage vs role requirements</Text>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Coverage', value: `${coverage}%`, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Critical Gaps', value: gapCount, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Expiring', value: expiringCount, color: '#d97706', bg: '#fffbeb' },
          { label: 'Employees', value: employees.length, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Topics', value: topics.length, color: '#7c3aed', bg: '#faf5ff' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '8px 16px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
            <Text style={{ color: s.color, fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{s.value}</Text>
            <Text style={{ color: s.color, fontSize: 11, opacity: 0.8 }}>{s.label}</Text>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            placeholder="Department"
            allowClear
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            onChange={setDeptFilter}
            style={{ width: 180 }}
          />
          <Select
            placeholder="Category"
            allowClear
            options={categories.map((c) => ({ value: c, label: c }))}
            onChange={setCatFilter}
            style={{ width: 150 }}
          />
          <Select
            value={showFilter}
            options={[
              { value: 'all', label: 'Show All' },
              { value: 'gaps', label: 'Gaps Only' },
              { value: 'expiring', label: 'Expiring Only' },
            ]}
            onChange={setShowFilter}
            style={{ width: 150 }}
          />
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} onClick={fetchMatrix} style={{ borderRadius: 8 }}>Refresh</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV} style={{ borderRadius: 8 }}>Export CSV</Button>
        </div>
      </Card>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Legend:</Text>
        {[
          { color: '#dcfce7', border: '#86efac', text: 'Active (shows expiry)', textColor: '#15803d' },
          { color: '#fef9c3', border: '#fde047', text: 'Expiring Soon (days left)', textColor: '#854d0e' },
          { color: '#fee2e2', border: '#fca5a5', text: 'Expired / Missing', textColor: '#b91c1c' },
          { color: '#f9fafb', border: '#e5e7eb', text: 'Not Required', textColor: '#9ca3af' },
        ].map((l) => (
          <div key={l.text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 14, background: l.color, border: `1px solid ${l.border}`, borderRadius: 3 }} />
            <Text style={{ fontSize: 11, color: '#6b7280' }}>{l.text}</Text>
          </div>
        ))}
      </div>

      {/* Matrix table */}
      {employees.length === 0 || topics.length === 0 ? (
        <Card style={{ border: '1px solid #e8eaed', borderRadius: 12, textAlign: 'center', padding: 40 }}>
          <AppstoreOutlined style={{ fontSize: 48, color: '#d1d5db', display: 'block', marginBottom: 12 }} />
          <Text style={{ color: '#9ca3af' }}>
            {employees.length === 0
              ? 'No employees found. Add employees and assign roles first.'
              : 'No training topics found. Add topics and role requirements first.'}
          </Text>
        </Card>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
            <thead>
              <tr>
                {/* Sticky employee column header */}
                <th style={{
                  position: 'sticky', left: 0, background: '#f8fafc', zIndex: 10,
                  padding: '10px 14px', borderBottom: '2px solid #e8eaed', borderRight: '2px solid #e8eaed',
                  textAlign: 'left', minWidth: 200, whiteSpace: 'nowrap',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Employee</Text>
                </th>
                {filteredTopics.map((t) => (
                  <th key={t.id} style={{
                    padding: '6px 4px', borderBottom: '2px solid #e8eaed',
                    minWidth: 64, maxWidth: 80, textAlign: 'center', background: '#f8fafc',
                  }}>
                    <Tooltip title={`${t.name} (${t.category})`}>
                      <div style={{
                        writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                        fontSize: 11, fontWeight: 500, color: CATEGORY_COLORS[t.category] || '#6b7280',
                        whiteSpace: 'nowrap', maxHeight: 90, overflow: 'hidden', cursor: 'default',
                        padding: '4px 2px',
                      }}>
                        {t.name.length > 18 ? t.name.slice(0, 18) + '…' : t.name}
                      </div>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp, idx) => {
                const empRow = matrix[emp.id] ?? {};
                return (
                  <tr key={emp.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {/* Sticky name column */}
                    <td style={{
                      position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#fafafa',
                      zIndex: 5, padding: '6px 14px', borderBottom: '1px solid #f3f4f6',
                      borderRight: '2px solid #e8eaed', minWidth: 200, whiteSpace: 'nowrap',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Text style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{emp.name}</Text>
                        <Text style={{ fontSize: 11, color: '#9ca3af' }}>{emp.employee_id}</Text>
                      </div>
                    </td>
                    {filteredTopics.map((t) => {
                      const cell = empRow[t.id];
                      return (
                        <td key={t.id} style={{
                          padding: '4px 4px', borderBottom: '1px solid #f3f4f6',
                          textAlign: 'center', verticalAlign: 'middle',
                        }}>
                          <CellStatus cell={cell} topic={t} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
};

export default CompetencyMatrixPage;
