import { keys, values } from 'remeda';
import { escapeHtml, highlightHtml, highlightJs } from './highlight.ts';
import { isFilePath, resolveIdeLink } from './ide-links.ts';
import { shortenPath } from './path-shortener.ts';
import { normalizeRenderContext } from './safe-context.ts';

const normalizePath = (p: string): string => p.replace(/^file:\/\/+/u, '');

export const formatCodeTraceHtml = (snippet: string): string => {
  if (!snippet) { return '<div class="code-line"><span class="line-number">&nbsp;</span><span class="code-content">Source not available</span></div>'; }

  const lines = snippet.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    const isError = trimmed.startsWith('>>>');
    let content: string;
    if (isError) {
      content = trimmed.replace(/^>>>\s*/u, '');
    } else {
      content = trimmed;
    }
    const colonIdx = content.indexOf(':');
    let lineNum: string;
    if (colonIdx > 0) {
      lineNum = content.substring(0, colonIdx);
    } else {
      lineNum = '';
    }
    let code: string;
    if (colonIdx > 0) {
      code = content.substring(colonIdx + 1);
    } else {
      code = content;
    }
    let leadingSpace: string;
    if (code.length === code.trimStart().length) {
      leadingSpace = '';
    } else {
      leadingSpace = code.match(/^\s*/u)?.[0] ?? '';
    }
    const trimmedCode = code.trimStart();
    let errorClass = '';
    if (isError) {
      errorClass = ' is-error';
    }
    return `<div class="code-line${errorClass}"><span class="line-number">${lineNum || '&nbsp;'}</span><span class="code-content">${leadingSpace}${highlightHtml(trimmedCode)}</span></div>`;
  }).join('');
};

interface JsCallerLine {
  lineNum: string;
  code: string;
  isError: boolean;
}

export const formatJsTraceHtml = (jsCallerLines: JsCallerLine[]): string => {
  if (jsCallerLines.length === 0) { return ''; }

  return jsCallerLines.map(({ lineNum, code, isError }) => {
    let errorClass = '';
    if (isError) {
      errorClass = ' is-error';
    }
    return `<div class="code-line${errorClass}"><span class="line-number">${lineNum || '&nbsp;'}</span><span class="code-content">${highlightJs(code)}</span></div>`;
  }).join('');
};

type SerializableContext =
  | null
  | string
  | number
  | boolean
  | SerializableContext[]
  | { [key: string]: SerializableContext };

const safeJson = (value: SerializableContext): string =>
  JSON.stringify(value).replace(/</gu, '\\u003c').replace(/>/gu, '\\u003e').replace(/&/gu, '\\u0026');

export const renderContextHtml = (ctx: unknown): string => {
  if (!ctx || typeof ctx !== 'object') { return ''; }
  const serialized = normalizeRenderContext(ctx) as Record<string, SerializableContext>;
  const filteredKeys = keys(serialized);
  if (filteredKeys.length === 0) { return ''; }

  const hasExpandableValues = values(serialized).some(value => value !== null && typeof value === 'object');
  const dataScript = `<script type="application/json" id="ctx-data">${safeJson(serialized)}</script>`;

  let expandButton = '';
  if (hasExpandableValues) {
    expandButton = '<button type="button" class="ctx-action" data-ctx-action="expand">Expand all</button>';
  }
  let collapseButton = '';
  if (hasExpandableValues) {
    collapseButton = '<button type="button" class="ctx-action" data-ctx-action="collapse" disabled>Collapse all</button>';
  }
  return `<section class="render-context" aria-labelledby="h-ctx">
<div class="section-heading">
  <h2 id="h-ctx" class="text-label">Render Context</h2>
  <div class="ctx-toolbar" aria-label="Render context controls">
    ${expandButton}
    ${collapseButton}
    <button type="button" class="ctx-action" data-ctx-action="copy">Copy JSON</button>
  </div>
</div>
<div class="ctx-tree" id="ctx-tree"></div>
</section>${dataScript}`;
};

const linkifyFrame = (frame: string, ide: string): string => {
  let s = escapeHtml(frame);
  if (!/[\\/:]/u.test(s)) {
    s = s.replace(/^at\s+/u, '<span class="stack-at">at</span> ');
    return s;
  }
  s = s.replace(/\(([^()]+):(\d+):(\d+)\)/gu, (match: string, p: string, l: string, c: string) => {
    if (/^native$/u.test(p.trim()) || /^&lt;/u.test(p) || !/[\\/:]/u.test(p) || !isFilePath(p)) { return match; }
    const norm = normalizePath(p);
    const display = shortenPath(norm);
    return `(<a href="${resolveIdeLink(ide, norm, Number.parseInt(l, 10), Number.parseInt(c, 10))}" class="stack-link">${display}:${l}:${c}</a>)`;
  });
  const lcMatch = s.match(/(.*?)(file:\/\/+.*?):(\d+):(\d+)$/u);
  if (lcMatch) {
    const prefix = lcMatch[1];
    const p = lcMatch[2];
    const l = lcMatch[3];
    const c = lcMatch[4];
    if (prefix && p && l && c && /[\\/:]/u.test(p) && !/^native$/u.test(p.trim()) && isFilePath(p)) {
      const norm = normalizePath(p);
      const display = shortenPath(norm);
      const link = `<a href="${resolveIdeLink(ide, norm, Number.parseInt(l, 10), Number.parseInt(c, 10))}" class="stack-link">${display}:${l}:${c}</a>`;
      s = prefix + link;
      return s;
    }
  }
  s = s.replace(/^at\s+/u, '<span class="stack-at">at</span> ');
  s = s.replace(/^(at\s+)([^\s(]+)/u, (_m: string, prefix: string, fn: string) => `${prefix}<span class="stack-fn">${fn}</span>`);
  return s;
};

interface ErrorWithStack {
  stack?: string;
}

export const formatStackTraceHtml = (originalError: ErrorWithStack | null, isProduction = false, ide = 'vscode'): string => {
  if (!originalError?.stack) { return ''; }

  const stackLines = originalError.stack.split('\n').slice(1);
  if (stackLines.length === 0) { return ''; }

  const jsStackLines = stackLines.filter(line => line.trim().startsWith('at '));
  if (jsStackLines.length === 0) { return ''; }

  let linesToShow: string[];
  if (isProduction) {
    linesToShow = jsStackLines.filter(line => {
      const path = line.toLowerCase();
      return !(path.includes('nunjucks/nunjucks/src/') || path.includes('nunjucks\\nunjucks\\src\\'));
    });
  } else {
    linesToShow = jsStackLines;
  }

  if (linesToShow.length === 0) { return ''; }

  const VisibleCount = 5;
  const totalHidden = Math.max(0, linesToShow.length - VisibleCount);

  const allRows = linesToShow.map((line, index) => {
    const isHidden = index >= VisibleCount;
    let hiddenClass = '';
    if (isHidden) {
      hiddenClass = ' is-collapsed';
    }
    return `<div class="stack-row${hiddenClass}"><code class="stack-code">${linkifyFrame(line.trim(), ide)}</code></div>`;
  }).join('');

  let toggleBtn: string;
  if (totalHidden > 0) {
    toggleBtn = `<button class="stack-toggle-btn" id="btn-toggle-stack">Show ${totalHidden} more lines...</button>`;
  } else {
    toggleBtn = '';
  }

  return `<section class="stack-trace" aria-labelledby="h-stack">
<h2 id="h-stack" class="text-label">Stack Trace</h2>
<div class="stack-container" id="stack-container">
  <div class="stack-content">${allRows}</div>
  ${toggleBtn}
</div>
</section>`;
};
