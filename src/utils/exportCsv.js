/**
 * Export an antd Table's data to CSV — drop-in for any page.
 *
 * @param {string}   filename   - e.g. "work-orders.csv"
 * @param {Object[]} rows       - The table's dataSource array
 * @param {Array}    antdCols   - The antd columns array (same one passed to <Table columns={…}>)
 */
export function exportTableToCsv(filename, rows, antdCols) {
  if (!rows?.length) return;

  // Filter out action / selection / expand columns
  const cols = antdCols.filter(c => {
    if (!c) return false;
    const title = typeof c.title === 'string' ? c.title : '';
    const key = c.key || '';
    if (['actions', 'action', 'select', 'expand'].includes(key.toLowerCase())) return false;
    if (['Actions', 'Action', ''].includes(title) && !c.dataIndex) return false;
    return true;
  });

  const header = cols.map(c => {
    const t = typeof c.title === 'string' ? c.title : (c.key || c.dataIndex || '');
    return escapeCsvField(t);
  }).join(',');

  const csvRows = rows.map(row => {
    return cols.map(c => {
      let val = '';
      try {
        // 1. Try render function — it may return a React element, so extract text
        if (c.render) {
          const dataVal = c.dataIndex ? getNestedValue(row, c.dataIndex) : undefined;
          const rendered = c.render(dataVal, row);
          val = extractText(rendered);
        }
        // 2. Fallback to dataIndex
        else if (c.dataIndex) {
          val = getNestedValue(row, c.dataIndex);
        }
        // 3. Fallback to key
        else if (c.key && row[c.key] != null) {
          val = row[c.key];
        }
      } catch {
        val = '';
      }
      return escapeCsvField(val);
    }).join(',');
  });

  const csv = [header, ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Extract plain text from a React element or primitive.
 */
function extractText(node) {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  // React element
  if (node?.props) {
    const { children } = node.props;
    if (children == null) return '';
    if (typeof children === 'string' || typeof children === 'number') return String(children);
    if (Array.isArray(children)) return children.map(extractText).filter(Boolean).join(' ');
    return extractText(children);
  }
  // Array of elements
  if (Array.isArray(node)) return node.map(extractText).filter(Boolean).join(' ');
  return String(node);
}

function getNestedValue(obj, path) {
  if (!obj) return '';
  if (typeof path === 'string') {
    return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : ''), obj);
  }
  if (Array.isArray(path)) {
    return path.reduce((o, k) => (o && o[k] != null ? o[k] : ''), obj);
  }
  return '';
}

function escapeCsvField(val) {
  if (val == null) val = '';
  val = String(val).replace(/"/g, '""');
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    val = `"${val}"`;
  }
  return val;
}

// Legacy API — still works for pages that use it directly
export function exportToCsv(filename, rows, columns) {
  exportTableToCsv(filename, rows, columns);
}
