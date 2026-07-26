import { keys, values } from 'remeda';
import { escapeHtml, highlightHtml, highlightJs } from './highlight.ts';
import { isFilePath, resolveIdeLink } from './ide-links.ts';
import { shortenPath } from './path-shortener.ts';
import { normalizeRenderContext } from './safe-context.ts';

// Hoisted so each pattern is compiled once rather than on every call.
const FILE_URL_PREFIX_RE = /^file:\/\/+/u;
const LEADING_WHITESPACE_RE = /^\s*/u;
const PATH_SEPARATOR_RE = /[\\/:]/u;
const STACK_AT_PREFIX_RE = /^at\s+/u;
const NATIVE_FRAME_RE = /^native$/u;
const ESCAPED_ANGLE_RE = /^&lt;/u;
const PARENTHESISED_LOCATION_RE = /\(([^()]+):(\d+):(\d+)\)/gu;
const FILE_URL_LOCATION_RE = /(.*?)(file:\/\/+.*?):(\d+):(\d+)$/u;
const ERROR_MARKER_PREFIX_RE = /^>>>\s*/u;
const STACK_FRAME_FUNCTION_RE = /^(at\s+)([^\s(]+)/u;
const LT_RE = /</gu;
const GT_RE = />/gu;
const AMP_RE = /&/gu;

const normalizePath = (p: string): string => p.replace(FILE_URL_PREFIX_RE, '');

const formatCodeTraceHtml = (snippet: string): string => {
  if (!snippet) { return '<div class="code-line"><span class="line-number">&nbsp;</span><span class="code-content">Source not available</span></div>'; }

  const lines = snippet.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    const isError = trimmed.startsWith('>>>');
    let content: string;
    if (isError) {
      content = trimmed.replace(ERROR_MARKER_PREFIX_RE, '');
    } else {
      content = trimmed;
    }
    const colonIdx = content.indexOf(':');
    let lineNum: string;
    if (colonIdx > 0) {
      lineNum = content.slice(0, colonIdx);
    } else {
      lineNum = '';
    }
    let code: string;
    if (colonIdx > 0) {
      code = content.slice(colonIdx + 1);
    } else {
      code = content;
    }
    let leadingSpace: string;
    if (code.length === code.trimStart().length) {
      leadingSpace = '';
    } else {
      leadingSpace = code.match(LEADING_WHITESPACE_RE)?.[0] ?? '';
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

const formatJsTraceHtml = (jsCallerLines: JsCallerLine[]): string => {
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
  JSON.stringify(value).replace(LT_RE, '\\u003c').replace(GT_RE, '\\u003e').replace(AMP_RE, '\\u0026');

const renderContextHtml = (ctx: unknown): string => {
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
  if (!PATH_SEPARATOR_RE.test(s)) {
    s = s.replace(STACK_AT_PREFIX_RE, '<span class="stack-at">at</span> ');
    return s;
  }
  s = s.replace(PARENTHESISED_LOCATION_RE, (match: string, p: string, l: string, c: string) => {
    if (NATIVE_FRAME_RE.test(p.trim()) || ESCAPED_ANGLE_RE.test(p) || !PATH_SEPARATOR_RE.test(p) || !isFilePath(p)) { return match; }
    const norm = normalizePath(p);
    const display = shortenPath(norm);
    return `(<a href="${resolveIdeLink(ide, norm, Number.parseInt(l, 10), Number.parseInt(c, 10))}" class="stack-link">${display}:${l}:${c}</a>)`;
  });
  const lcMatch = s.match(FILE_URL_LOCATION_RE);
  if (lcMatch) {
    const [, prefix, p, l, c] = lcMatch;
    if (prefix && p && l && c && PATH_SEPARATOR_RE.test(p) && !NATIVE_FRAME_RE.test(p.trim()) && isFilePath(p)) {
      const norm = normalizePath(p);
      const display = shortenPath(norm);
      const link = `<a href="${resolveIdeLink(ide, norm, Number.parseInt(l, 10), Number.parseInt(c, 10))}" class="stack-link">${display}:${l}:${c}</a>`;
      s = prefix + link;
      return s;
    }
  }
  s = s.replace(STACK_AT_PREFIX_RE, '<span class="stack-at">at</span> ');
  s = s.replace(STACK_FRAME_FUNCTION_RE, (_m: string, prefix: string, fn: string) => `${prefix}<span class="stack-fn">${fn}</span>`);
  return s;
};

interface ErrorWithStack {
  stack?: string;
}

const formatStackTraceHtml = (originalError: ErrorWithStack | null, isProduction = false, ide = 'vscode'): string => {
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

export { formatCodeTraceHtml, formatJsTraceHtml, renderContextHtml, formatStackTraceHtml };
