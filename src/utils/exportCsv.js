/**
 * Export data to a CSV file and trigger browser download.
 *
 * @param {string}   filename  - Name of the downloaded file (e.g. "work-orders.csv")
 * @param {Object[]} rows      - Array of data objects
 * @param {Array<{key: string, label: string}>} columns - Column definitions
 */
export function exportToCsv(filename, rows, columns) {
  const header = columns.map((c) => c.label).join(',');

  const csvRows = rows.map((row) =>
    columns
      .map((c) => {
        let val = row[c.key];
        if (val == null) val = '';
        // Escape double-quotes by doubling them
        val = String(val).replace(/"/g, '""');
        // Wrap in quotes if the value contains comma, quote, or newline
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val}"`;
        }
        return val;
      })
      .join(','),
  );

  const csv = [header, ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
