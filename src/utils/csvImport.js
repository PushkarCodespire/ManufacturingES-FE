import Papa from 'papaparse';

/**
 * Parse a CSV file and return headers + rows
 * @param {File} file
 * @returns {Promise<{ headers: string[], rows: object[], errors: string[] }>}
 */
export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      trimHeaders: true,
      transformHeader: (h) => h.trim(),
      transform: (val) => val?.trim() ?? '',
      complete: (results) => {
        const errors = results.errors
          .filter((e) => e.type !== 'FieldMismatch')
          .map((e) => `Row ${e.row + 1}: ${e.message}`);
        resolve({
          headers: results.meta.fields || [],
          rows: results.data || [],
          errors,
        });
      },
      error: (err) => reject(err),
    });
  });
}

/**
 * Generate and download a sample CSV file
 * @param {string} filename
 * @param {string[]} headers
 * @param {object[]} sampleRows - array of objects matching headers
 */
export function downloadSampleCsv(filename, headers, sampleRows = []) {
  const csv = Papa.unparse({ fields: headers, data: sampleRows });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Validate a row against rules
 * @param {object} row - parsed CSV row
 * @param {Array<{ field: string, required?: boolean, validate?: (val) => string|null }>} rules
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRow(row, rules) {
  const errors = [];
  for (const rule of rules) {
    const val = row[rule.field];
    if (rule.required && (!val || val === '')) {
      errors.push(`"${rule.field}" is required`);
    }
    if (val && rule.validate) {
      const err = rule.validate(val);
      if (err) errors.push(err);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Parse comma-separated tags string into array
 * @param {string} val
 * @returns {string[]}
 */
export function parseTags(val) {
  if (!val) return [];
  return val
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
