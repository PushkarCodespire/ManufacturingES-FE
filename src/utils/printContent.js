/**
 * printContent — reliable print utility that works with Ant Design CSS-in-JS
 *
 * Uses a hidden iframe for maximum browser compatibility (Edge, Chrome, Firefox).
 * Copies CSS-in-JS styles (filtering out problematic @media print rules from
 * the global print.css), writes content, then triggers print.
 */
export function printContent(contentElement, { title = 'Print', header = '' } = {}) {
  if (!contentElement) return;

  const html = contentElement.innerHTML;

  // ── Collect styles (CSS-in-JS + linked stylesheets) ──────────────────────
  const headContent = [];

  // Copy <style> tags but strip any @media print blocks to avoid layout
  // interference from the global print.css rules
  document.querySelectorAll('style').forEach(el => {
    let css = el.textContent;
    // Remove @media print { ... } blocks (handles nested braces)
    css = css.replace(/@media\s+print\s*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '');
    if (css.trim()) {
      headContent.push(`<style>${css}</style>`);
    }
  });

  // Copy <link rel="stylesheet"> — skip print.css
  document.querySelectorAll('link[rel="stylesheet"]').forEach(el => {
    if (!el.href.includes('print.css')) {
      headContent.push(`<link rel="stylesheet" href="${el.href}" />`);
    }
  });

  // ── Build the print document ─────────────────────────────────────────────
  const docContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
${headContent.join('\n')}
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: white;
    color: #000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  #print-wrapper {
    padding: 24px;
    max-width: 860px;
    margin: 0 auto;
  }
  .print-report-header {
    text-align: center;
    border-bottom: 2px solid #1d4ed8;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .print-report-header h2 {
    margin: 0;
    color: #1d4ed8;
    font-size: 18px;
  }
  .print-report-header p {
    margin: 4px 0 0;
    color: #666;
    font-size: 12px;
  }
  /* Ant component print fixes */
  .ant-card, [class*="ant-card"] { break-inside: avoid; margin-bottom: 10px; box-shadow: none !important; }
  .ant-descriptions-item-label { font-weight: 600; }
  .ant-table, [class*="ant-table"] { font-size: 12px; }
  .ant-table th { background: #fafafa !important; font-weight: 600; }
  .ant-tag, [class*="ant-tag"] { display: inline-block; padding: 0 7px; font-size: 12px; border-radius: 4px; border: 1px solid #ccc; }
  .ant-descriptions, [class*="ant-descriptions"] { break-inside: avoid; }
  @media print {
    #print-wrapper { padding: 12px; }
    * { color-adjust: exact !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
  <div id="print-wrapper">
    ${header ? `<div class="print-report-header">${header}</div>` : ''}
    ${html}
  </div>
</body>
</html>`;

  // ── Use hidden iframe for reliable cross-browser printing ────────────────
  // Remove any previous print iframe
  const oldFrame = document.getElementById('__print_frame__');
  if (oldFrame) oldFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__print_frame__';
  iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:900px;height:700px;border:none;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(docContent);
  iframeDoc.close();

  // Wait for styles/content to render, then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      // Clean up after print dialog closes
      setTimeout(() => iframe.remove(), 1000);
    }, 300);
  };

  // Fallback if onload doesn't fire (some browsers with about:blank)
  setTimeout(() => {
    if (document.getElementById('__print_frame__')) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    }
  }, 1500);
}
