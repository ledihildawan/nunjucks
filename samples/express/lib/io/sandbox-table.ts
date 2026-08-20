import { escapeHtml } from '@nunjucks/lib';
import type { SandboxSuite, SandboxTestResult } from '../domain/sandbox-demo.ts';
import { outcomeError, outcomeOutput, statusClass, statusLabel } from '../domain/sandbox-demo.ts';

const renderTable = (table: SandboxTestResult[], suite: SandboxSuite): string => {
  const rows = table
    .map((row) => {
      const err = outcomeError(row);
      // WHY: both branches are data-derived (error messages and rendered probe output) —
      // this table is hand-built HTML, not a template render, so autoescape never applies
      // and the seam itself must escape.
      const resultText = err !== null ? escapeHtml(err.message) : escapeHtml(outcomeOutput(row));
      const statusClassName = statusClass(row, suite);
      const statusLabelText = statusLabel(row, suite);
      return (
        '<tr>' +
        '<td>' +
        escapeHtml(row.name) +
        '</td>' +
        '<td>' +
        resultText +
        '</td>' +
        '<td class="' +
        statusClassName +
        '">' +
        statusLabelText +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  const intro = suite.introHtml ?? '';
  const outro = suite.outroHtml ?? '';

  return (
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<title>' +
    escapeHtml(suite.title) +
    '</title>' +
    '<style>' +
    'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:900px;margin:0 auto;padding:20px}' +
    'h1{color:' +
    suite.headingColor +
    '}' +
    'table{width:100%;border-collapse:collapse;margin:20px 0}' +
    'th,td{text-align:left;padding:12px;border:1px solid #ddd}' +
    'th{background:' +
    suite.accentColor +
    ';color:white}' +
    '.blocked{background:#fee;color:#c0392b}' +
    '.allowed{background:#efe;color:#27ae60}' +
    '.passed{background:#d5f4e6;color:#27ae60}' +
    '.failed{background:#fadbd8;color:#e74c3c}' +
    '.code{background:#f8f9fa;padding:15px;border-radius:8px;font-family:monospace;margin:15px 0}' +
    '.info{background:#e8f4f8;padding:15px;border-radius:8px;margin:15px 0}' +
    'a{color:#3498db}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<h1>' +
    escapeHtml(suite.title) +
    '</h1>' +
    '<p><a href="/sandbox">Back to Sandbox Demo</a></p>' +
    intro +
    '<table>' +
    '<tr><th>Test</th><th>Result</th><th>Status</th></tr>' +
    rows +
    '</table>' +
    outro +
    '</body>' +
    '</html>'
  );
};

export { renderTable };
