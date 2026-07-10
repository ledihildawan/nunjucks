import { escapeHtml, highlightHtml } from './highlight.js';
import { resolveIdeLink } from '../../constants/ide-links.js';
import { shortenPath } from '../../../shared/path-shortener.js';

const normalizePath = (p) => p.replace(/^file:\/\/+/, '');

export const formatCodeTraceHtml = (snippet) => {
  if (!snippet) return '<div class="code-line"><span class="line-number">&nbsp;</span><span class="code-content">Source not available</span></div>';

  const lines = snippet.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    const isError = trimmed.startsWith('>>>');
    const content = isError ? trimmed.replace(/^>>>\s*/, '') : trimmed;
    const colonIdx = content.indexOf(':');
    const lineNum = colonIdx > 0 ? content.substring(0, colonIdx) : '';
    const code = colonIdx > 0 ? content.substring(colonIdx + 1) : content;
    const leadingSpace = code.length !== code.trimStart().length ? code.match(/^\s*/)[0] : '';
    const trimmedCode = code.trimStart();
    return `<div class="code-line${isError ? ' is-error' : ''}"><span class="line-number">${lineNum || '&nbsp;'}</span><span class="code-content">${leadingSpace}${highlightHtml(trimmedCode)}</span></div>`;
  }).join('');
};

const serializeValue = (value, depth = 0) => {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return '[Symbol]';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth >= 4) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return '[' + value.slice(0, 10).map(v => serializeValue(v, depth + 1)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(k => !k.startsWith('__nunjucks'));
    if (keys.length === 0) return '{}';
    const pairs = keys.slice(0, 20).map(k => JSON.stringify(k) + ':' + serializeValue(value[k], depth + 1));
    return '{' + pairs.join(',') + '}';
  }
  return 'null';
};

const filterContext = (ctx) => {
  if (!ctx || typeof ctx !== 'object') return {};
  const filtered = {};
  for (const k of Object.keys(ctx)) {
    if (k.startsWith('__nunjucks')) continue;
    filtered[k] = ctx[k];
  }
  return filtered;
};

export const renderContextHtml = (ctx) => {
  if (!ctx || typeof ctx !== 'object') return '';
  const filtered = filterContext(ctx);
  const keys = Object.keys(filtered);
  if (keys.length === 0) return '';

  const dataScript = `<script>window.__ctxData=${serializeValue(filtered)};</scr` + `ipt>`;

  return `<section class="render-context" aria-labelledby="h-ctx">
<h2 id="h-ctx" class="text-label">Render Context</h2>
<div class="ctx-tree" id="ctx-tree"></div>
</section>${dataScript}`;
};

const linkifyFrame = (frame, ide) => {
  let s = escapeHtml(frame);
  s = s.replace(/\(([^()]+):(\d+):(\d+)\)$/, (match, p, l, c) => {
    if (/^native$/.test(p.trim()) || /^&lt;/.test(p) || !/[\\/]/.test(p)) return match;
    const norm = normalizePath(p);
    const display = shortenPath(norm);
    return `(<a href="${resolveIdeLink(ide, norm, l, c)}" class="stack-link">${display}:${l}:${c}</a>)`;
  });
  s = s.replace(/^at\s+/, '<span class="stack-at">at</span> ');
  s = s.replace(/^(at\s+)([^\s(]+)/, (m, prefix, fn) => `${prefix}<span class="stack-fn">${fn}</span>`);
  return s;
};

export const formatStackTraceHtml = (originalError, isProduction = false, ide = 'vscode') => {
  if (!originalError?.stack) return '';

  const stackLines = originalError.stack.split('\n').slice(1);
  if (stackLines.length === 0) return '';

  const jsStackLines = stackLines.filter(line => line.trim().startsWith('at '));
  if (jsStackLines.length === 0) return '';

  const linesToShow = isProduction
    ? jsStackLines.filter(line => {
        const path = line.toLowerCase();
        return !path.includes('nunjucks/nunjucks/src/') && !path.includes('nunjucks\\nunjucks\\src\\');
      })
    : jsStackLines;

  if (linesToShow.length === 0) return '';

  const VISIBLE_COUNT = 5;
  const totalHidden = Math.max(0, linesToShow.length - VISIBLE_COUNT);

  const allRows = linesToShow.map((line, index) => {
    const isHidden = index >= VISIBLE_COUNT;
    return `<div class="stack-row${isHidden ? ' is-collapsed' : ''}"><code class="stack-code">${linkifyFrame(line.trim(), ide)}</code></div>`;
  }).join('');

  const toggleBtn = totalHidden > 0
    ? `<button class="stack-toggle-btn" id="btn-toggle-stack">Show ${totalHidden} more lines...</button>`
    : '';

  return `<section class="stack-trace" aria-labelledby="h-stack">
<h2 id="h-stack" class="text-label">Stack Trace</h2>
<div class="stack-container" id="stack-container">
  <div class="stack-content">${allRows}${toggleBtn}</div>
</div>
</section>`;
};
