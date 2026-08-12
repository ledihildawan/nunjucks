import { pipe, keys, values, filter, join, map, split } from 'remeda';
import { escapeHtml, highlightHtml, highlightJs } from '../syntax-highlight/highlight.ts';
import { isFilePath, resolveIdeLink } from '../ide-links/ide-links.ts';
import { shortenPath } from '../source-trace/path-shortener.ts';
import { DEFAULT_IDE } from '../ide-links/defaults.ts';
import { normalizeRenderContext } from './safe-context.ts';
import { replace, slice } from '@nunjucks/lib';

const FILE_URL_PREFIX_RE = /^file:\/\/+/u;
const LEADING_WHITESPACE_RE = /^\s*/u;
const PATH_SEPARATOR_RE = /[\\/:]/u;
const STACK_AT_PREFIX_RE = /^at\s+/u;
const NATIVE_FRAME_RE = /^native$/u;
const LEADING_ANGLE_RE = /^</u;
const PARENTHESISED_LOCATION_RE = /\(([^()]+):(\d+):(\d+)\)/gu;
const FILE_URL_LOCATION_RE = /(.*?)(file:\/\/+.*?):(\d+):(\d+)$/u;
const ERROR_MARKER_PREFIX_RE = /^>>>\s*/u;
const LT_RE = /</gu;
const GT_RE = />/gu;
const AMP_RE = /&/gu;

const normalizePath = (path: string): string => path.replace(FILE_URL_PREFIX_RE, '');

const formatCodeTraceHtml = (snippet: string): string => {
  if (!snippet) { return '<div class="code-line"><span class="line-number">&nbsp;</span><span class="code-content">Source not available</span></div>'; }

  const lines = snippet.split('\n');
  return pipe(lines, map(formatCodeLine), join(''));
};

const formatCodeLine = (line: string): string => {
  const trimmed = line.trim();
  const isError = trimmed.startsWith('>>>');
  const content = isError ? trimmed.replace(ERROR_MARKER_PREFIX_RE, '') : trimmed;
  const colonIdx = content.indexOf(':');
  const lineNum = colonIdx > 0 ? content.slice(0, colonIdx) : '';
  const code = colonIdx > 0 ? content.slice(colonIdx + 1) : content;
  const leadingSpace = code.length === code.trimStart().length ? '' : code.match(LEADING_WHITESPACE_RE)?.[0] ?? '';
  const trimmedCode = code.trimStart();
  const errorClass = isError ? ' is-error' : '';
  return `<div class="code-line${errorClass}"><span class="line-number">${lineNum || '&nbsp;'}</span><span class="code-content">${leadingSpace}${highlightHtml(trimmedCode)}</span></div>`;
};

interface JsCallerLine {
  lineNum: string;
  code: string;
  isError: boolean;
}

const formatJsTraceHtml = (jsCallerLines: JsCallerLine[]): string => {
  if (jsCallerLines.length === 0) { return ''; }

  return jsCallerLines.map(({ lineNum, code, isError }) => {
    const errorClass = isError ? ' is-error' : '';
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
  pipe(JSON.stringify(value), replace(LT_RE, '\\u003c'), replace(GT_RE, '\\u003e'), replace(AMP_RE, '\\u0026'));

const renderContextHtml = (ctx: unknown, blockedKeys?: readonly string[] | null): string => {
  if (!ctx || typeof ctx !== 'object') { return ''; }
  const serialized = normalizeRenderContext(ctx, { blockedKeys }) as Record<string, SerializableContext>;
  const filteredKeys = pipe(serialized, keys());
  if (filteredKeys.length === 0) { return ''; }

  const hasExpandableValues = values(serialized).some(value => value !== null && typeof value === 'object');
  const dataScript = `<script type="application/json" id="ctx-data">${safeJson(serialized)}</script>`;

  const expandButton = hasExpandableValues ? '<button type="button" class="ctx-action" data-ctx-action="expand">Expand all</button>' : '';
  const collapseButton = hasExpandableValues ? '<button type="button" class="ctx-action" data-ctx-action="collapse" disabled>Collapse all</button>' : '';
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

const isLinkablePath = (rawPath: string): boolean =>
  !NATIVE_FRAME_RE.test(rawPath.trim())
  && !LEADING_ANGLE_RE.test(rawPath)
  && PATH_SEPARATOR_RE.test(rawPath)
  && isFilePath(rawPath);

const buildLocationLink = (ide: string, target: { path: string; line: string; col: string }): string => {
  const norm = normalizePath(target.path);
  const display = shortenPath(norm, '');
  return `<a href="${resolveIdeLink(ide, { path: norm, line: Number.parseInt(target.line, 10), col: Number.parseInt(target.col, 10) })}" class="stack-link">${escapeHtml(display)}:${target.line}:${target.col}</a>`;
};

const functionSpan = (fnRaw: string): string =>
  fnRaw ? `<span class="stack-fn">${escapeHtml(fnRaw)}</span> ` : '';

const renderParenFrame = (body: string, ide: string): string | null => {
  const paren = [...body.matchAll(PARENTHESISED_LOCATION_RE)][0];
  if (!paren) { return null; }
  const rawPath = paren[1] ?? '';
  const line = paren[2] ?? '';
  const col = paren[3] ?? '';
  const fnRaw = body.slice(0, paren.index ?? 0).trim();
  const inner = isLinkablePath(rawPath)
    ? buildLocationLink(ide, { path: rawPath, line, col })
    : `${escapeHtml(rawPath)}:${line}:${col}`;
  return `${functionSpan(fnRaw)}(${inner})`;
};

const renderFileUrlFrame = (body: string, ide: string): string | null => {
  const m = body.match(FILE_URL_LOCATION_RE);
  if (!m) { return null; }
  const rawPath = m[2] ?? '';
  if (!isLinkablePath(rawPath)) { return null; }
  return `${functionSpan((m[1] ?? '').trim())}${buildLocationLink(ide, { path: rawPath, line: m[3] ?? '', col: m[4] ?? '' })}`;
};

const renderFallbackFrame = (body: string): string => {
  const fnToken = body.match(/^[^\s(]+/);
  return fnToken
    ? `<span class="stack-fn">${escapeHtml(fnToken[0])}</span>${escapeHtml(body.slice(fnToken[0].length))}`
    : escapeHtml(body);
};

const linkifyFrame = (frame: string, ide: string): string => {
  const trimmed = frame.trim();

  if (!PATH_SEPARATOR_RE.test(trimmed)) {
    return escapeHtml(trimmed).replace(STACK_AT_PREFIX_RE, '<span class="stack-at">at</span> ');
  }

  const atMatch = trimmed.match(STACK_AT_PREFIX_RE);
  const atSpan = atMatch ? '<span class="stack-at">at</span> ' : '';
  const body = atMatch ? trimmed.slice(atMatch[0].length) : trimmed;

  return `${atSpan}${renderParenFrame(body, ide) ?? renderFileUrlFrame(body, ide) ?? renderFallbackFrame(body)}`;
};

interface ErrorWithStack {
  stack?: string;
}

const STACK_VISIBLE_COUNT = 5;

const isInternalStackLine = (line: string): boolean => {
  const path = line.toLowerCase();
  return path.includes('nunjucks/nunjucks/src/') || path.includes('nunjucks\\nunjucks\\src\\');
};

interface RenderStackRowInput {
  line: string;
  index: number;
  ide: string;
}

const renderStackRow = ({ line, index, ide }: RenderStackRowInput): string => {
  const isHidden = index >= STACK_VISIBLE_COUNT;
  const hiddenClass = isHidden ? ' is-collapsed' : '';
  return `<div class="stack-row${hiddenClass}"><code class="stack-code">${linkifyFrame(line.trim(), ide)}</code></div>`;
};

interface FormatStackTraceHtmlInput {
  originalError: ErrorWithStack | null;
  isProduction?: boolean;
  ide?: string;
}

const formatStackTraceHtml = ({ originalError, isProduction = false, ide = DEFAULT_IDE }: FormatStackTraceHtmlInput): string => {
  if (!originalError?.stack) { return ''; }

  const jsStackLines = pipe(originalError.stack, split('\n'), slice(1), filter(line => line.trim().startsWith('at ')));
  if (jsStackLines.length === 0) { return ''; }

  const linesToShow = isProduction
    ? jsStackLines.filter(line => !isInternalStackLine(line))
    : jsStackLines;

  if (linesToShow.length === 0) { return ''; }

  const totalHidden = Math.max(0, linesToShow.length - STACK_VISIBLE_COUNT);

  const allRows = linesToShow.map((line, index) => renderStackRow({ line, index, ide })).join('');

  const toggleBtn = totalHidden > 0
    ? `<button class="stack-toggle-btn" id="btn-toggle-stack">Show ${totalHidden} more lines...</button>`
    : '';

  return `<section class="stack-trace" aria-labelledby="h-stack">
<h2 id="h-stack" class="text-label">Stack Trace</h2>
<div class="stack-container" id="stack-container">
  <div class="stack-content">${allRows}</div>
  ${toggleBtn}
</div>
</section>`;
};

export { formatCodeTraceHtml, formatJsTraceHtml, renderContextHtml, formatStackTraceHtml };
