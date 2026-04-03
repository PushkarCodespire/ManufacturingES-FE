import React, { useState, useCallback } from 'react';
import {
  Modal,
  Upload,
  Button,
  Table,
  Typography,
  Space,
  Tag,
  message,
  Alert,
  Spin,
  Result,
  Divider,
} from 'antd';
import {
  InboxOutlined,
  DownloadOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { parseCsvFile, downloadSampleCsv, validateRow } from '../../utils/csvImport';

const { Dragger } = Upload;
const { Text, Title } = Typography;

/**
 * Reusable CSV Upload Modal — matches manufapp style
 *
 * Props:
 * @param {boolean}   open           - Modal visible
 * @param {function}  onClose        - Close handler
 * @param {function}  onImport       - Called with validated rows: (rows) => Promise
 * @param {string}    title          - Modal title, e.g. "Upload Machines"
 * @param {string}    entityName     - e.g. "Machine", "Item", "Vendor"
 * @param {Array}     sampleHeaders  - CSV header names
 * @param {Array}     sampleRows     - Sample data rows (array of objects)
 * @param {Array}     validationRules - [{ field, required, validate }]
 * @param {Array}     previewColumns - Ant Table columns for preview (optional, auto-generated if not provided)
 * @param {function}  mapRow         - Transform parsed CSV row → API payload row (optional)
 */
export default function CsvUploadModal({
  open,
  onClose,
  onImport,
  title = 'Upload CSV',
  entityName = 'Record',
  sampleHeaders = [],
  sampleRows = [],
  validationRules = [],
  previewColumns,
  mapRow,
}) {
  const [parsedRows, setParsedRows] = useState([]);
  const [validatedRows, setValidatedRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // { success, failed, errors }

  const reset = useCallback(() => {
    setParsedRows([]);
    setValidatedRows([]);
    setParseErrors([]);
    setFile(null);
    setImporting(false);
    setImportResult(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Handle file selection ──────────────────────────────────────────────────
  const handleFile = async (f) => {
    setFile(f);
    setImportResult(null);
    try {
      const { headers, rows, errors } = await parseCsvFile(f);

      if (rows.length === 0) {
        message.warning('CSV file is empty or has no data rows');
        return;
      }

      // Validate each row
      const validated = rows.map((row, idx) => {
        const { valid, errors: rowErrors } = validateRow(row, validationRules);
        return {
          ...row,
          _rowNum: idx + 1,
          _key: idx,
          _valid: valid,
          _errors: rowErrors,
        };
      });

      setParsedRows(rows);
      setValidatedRows(validated);
      setParseErrors(errors);

      const validCount = validated.filter((r) => r._valid).length;
      const invalidCount = validated.filter((r) => !r._valid).length;

      if (invalidCount > 0) {
        message.info(`${validCount} valid, ${invalidCount} invalid row(s) found`);
      } else {
        message.success(`${validCount} row(s) parsed successfully`);
      }
    } catch (err) {
      message.error('Failed to parse CSV file: ' + err.message);
    }
  };

  // ── Download sample CSV ────────────────────────────────────────────────────
  const handleSampleDownload = () => {
    downloadSampleCsv(
      `${entityName}_Sample.csv`,
      sampleHeaders,
      sampleRows
    );
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    const validRows = validatedRows.filter((r) => r._valid);
    if (validRows.length === 0) {
      message.warning('No valid rows to import');
      return;
    }

    setImporting(true);
    try {
      // Map rows if mapRow provided, otherwise pass raw
      const payload = mapRow ? validRows.map(mapRow) : validRows;
      const result = await onImport(payload);
      setImportResult({
        success: result?.success ?? validRows.length,
        failed: result?.failed ?? 0,
        errors: result?.errors ?? [],
      });
      message.success(
        `Successfully imported ${result?.success ?? validRows.length} ${entityName.toLowerCase()}(s)`
      );
    } catch (err) {
      setImportResult({
        success: 0,
        failed: validRows.length,
        errors: [err.message || 'Import failed'],
      });
      message.error('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  // ── Auto-generate preview columns from headers ─────────────────────────────
  const getPreviewColumns = () => {
    if (previewColumns) return previewColumns;

    const cols = sampleHeaders.map((h) => ({
      title: h,
      dataIndex: h,
      key: h,
      ellipsis: true,
      width: 150,
    }));

    // Add status column at the beginning
    cols.unshift({
      title: 'Status',
      key: '_status',
      width: 80,
      fixed: 'left',
      render: (_, row) =>
        row._valid ? (
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
        ) : (
          <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
        ),
    });

    // Add row number at the beginning
    cols.unshift({
      title: '#',
      key: '_rowNum',
      width: 50,
      fixed: 'left',
      render: (_, row) => row._rowNum,
    });

    return cols;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const validCount = validatedRows.filter((r) => r._valid).length;
  const invalidCount = validatedRows.filter((r) => !r._valid).length;

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={null}
      footer={null}
      width={900}
      destroyOnClose
      styles={{ body: { padding: 0 } }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {title || 'Upload CSV'}
        </Title>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleSampleDownload}
        >
          Sample CSV
        </Button>
      </div>

      <div style={{ padding: '16px 24px' }}>
        {/* Import result */}
        {importResult && (
          <Result
            status={importResult.failed === 0 ? 'success' : 'warning'}
            title={
              importResult.failed === 0
                ? `All ${importResult.success} ${entityName.toLowerCase()}(s) imported successfully!`
                : `${importResult.success} imported, ${importResult.failed} failed`
            }
            subTitle={
              importResult.errors.length > 0
                ? (
                  <div style={{ textAlign: 'left', maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                    <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13, color: '#374151' }}>
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>
                          <span style={{ color: '#dc2626' }}>{err}</span>
                        </li>
                      ))}
                    </ul>
                    {importResult.errors.length > 10 && (
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, paddingLeft: 20 }}>
                        ...and {importResult.errors.length - 10} more errors
                      </div>
                    )}
                  </div>
                )
                : undefined
            }
            extra={
              <Space>
                <Button onClick={handleClose}>Close</Button>
                <Button type="primary" onClick={reset}>
                  Upload Another
                </Button>
              </Space>
            }
          />
        )}

        {/* Upload area — show when no file selected and no result */}
        {!file && !importResult && (
          <Dragger
            accept=".csv"
            multiple={false}
            showUploadList={false}
            beforeUpload={(f) => {
              handleFile(f);
              return false; // prevent auto upload
            }}
            style={{
              padding: '40px 20px',
              background: '#fafafa',
              borderRadius: 8,
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p
              className="ant-upload-text"
              style={{ fontSize: 16, color: '#333' }}
            >
              Drag and drop files here
            </p>
            <p className="ant-upload-hint" style={{ color: '#999' }}>
              Only csv files will be accepted
            </p>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              style={{ marginTop: 16 }}
            >
              Upload file
            </Button>
          </Dragger>
        )}

        {/* Preview table — show when file parsed */}
        {validatedRows.length > 0 && !importResult && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Space>
                <FileExcelOutlined style={{ color: '#52c41a' }} />
                <Text strong>{file?.name}</Text>
                <Tag color="blue">{validatedRows.length} rows</Tag>
                {validCount > 0 && (
                  <Tag color="green">{validCount} valid</Tag>
                )}
                {invalidCount > 0 && (
                  <Tag color="red">{invalidCount} invalid</Tag>
                )}
              </Space>
              <Button
                icon={<DeleteOutlined />}
                size="small"
                onClick={reset}
                danger
              >
                Remove
              </Button>
            </div>

            {/* Validation errors */}
            {parseErrors.length > 0 && (
              <Alert
                type="warning"
                message="Parse warnings"
                description={parseErrors.join('; ')}
                showIcon
                closable
                style={{ marginBottom: 12 }}
              />
            )}

            {/* Show errors for invalid rows */}
            {invalidCount > 0 && (
              <Alert
                type="error"
                message={`${invalidCount} row(s) have validation errors`}
                description={validatedRows
                  .filter((r) => !r._valid)
                  .slice(0, 5)
                  .map((r) => `Row ${r._rowNum}: ${r._errors.join(', ')}`)
                  .join(' | ')}
                showIcon
                style={{ marginBottom: 12 }}
              />
            )}

            <Table
              columns={getPreviewColumns()}
              dataSource={validatedRows}
              rowKey="_key"
              size="small"
              scroll={{ x: 'max-content', y: 300 }}
              pagination={
                validatedRows.length > 50
                  ? { pageSize: 50, showTotal: (t) => `${t} rows` }
                  : false
              }
              rowClassName={(row) =>
                row._valid ? '' : 'csv-row-invalid'
              }
            />

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={handleImport}
                loading={importing}
                disabled={validCount === 0}
              >
                {importing
                  ? 'Importing...'
                  : `Import ${validCount} ${entityName}(s)`}
              </Button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .csv-row-invalid td {
          background: #fff2f0 !important;
        }
      `}</style>
    </Modal>
  );
}
