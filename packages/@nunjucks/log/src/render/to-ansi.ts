import picocolors from 'picocolors';
import { keys } from 'remeda';
import { shortenPath } from './internal/path-shortener.ts';
import { toDisplayLocation } from './internal/location.ts';
import { isFilePath, resolveIdeLink } from './internal/ide-links.ts';
import { normalizeRenderContext } from './internal/safe-context.ts';
import type { SourceTrace, SourceTraceLine, SourceTraceCaret } from './internal/source-trace.ts';
import { classifyFromError } from '../errors/classify.ts';

interface AnsiOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
  ide?: string;
  sourceTrace?: SourceTrace | null;
  renderContext?: Record<string, unknown>;
}

const SEPARATOR = ' │ ';
const ERROR_MARKER = '> ';
const NORMAL_MARKER = '  ';
const MIN_LINE_NUM_WIDTH = 2;

const getMarker = (isError: boolean): string => {
  if (isError) { return ERROR_MARKER; }
  return NORMAL_MARKER;
};

const getLineNumWidth = (lines: SourceTraceLine[]): number => {
  const maxLineNum = Math.max(...lines.map(l => l.number));
  return Math.max(MIN_LINE_NUM_WIDTH, String(maxLineNum).length);
};

const formatCodeLine = (
  lineNum: number,
  content: string,
  isError: boolean,
  lineNumWidth: number
): string => {
  const marker = getMarker(isError);
  const lineNumStr = String(lineNum).padStart(lineNumWidth, ' ');
  return picocolors.dim(`${marker}${lineNumStr}${SEPARATOR}${content}`);
};

const getLinePrefix = (lineNumWidth: number): string =>
  picocolors.dim(`${NORMAL_MARKER}${' '.repeat(lineNumWidth)}${SEPARATOR}`);

// Render the caret line for the error line. charStart is the 0-based column the
// caret run begins at (the offending token start, shared with the HTML renderer
// via calculateCaretPosition) and carets is the pre-built '^' run.
const formatCaretLine = (
  lineNumWidth: number,
  charStart: number,
  carets: string
): string => {
  const prefix = getLinePrefix(lineNumWidth);
  return `${prefix}${' '.repeat(charStart)}${picocolors.red(carets)}`;
};

// Pure presenter: turn a resolved SourceTrace (windowed lines + caret) into ANSI
// text. The trace is built once upstream (buildSourceTrace), so this holds no
// line-math, no file reading, and no caret-length computation.
const formatSourceTrace = (
  lines: SourceTraceLine[],
  caret: SourceTraceCaret | null
): string[] => {
  if (lines.length === 0) { return []; }

  const lineNumWidth = getLineNumWidth(lines);

  return lines.flatMap((line) => {
    const codeLine = formatCodeLine(line.number, line.content, line.isError, lineNumWidth);
    if (!(line.isError && caret)) {
      return [codeLine];
    }
    return [codeLine, formatCaretLine(lineNumWidth, caret.charStart, caret.carets)];
  });
};

const sanitizePrimitive = (value: unknown): string => {
  if (value === null) { return 'null'; }
  if (value === undefined) { return 'undefined'; }
  if (typeof value === 'function') { return `[Function: ${value.name || 'anonymous'}]`; }
  if (typeof value === 'string') { return `"${value}"`; }
  return String(value);
};

const sanitizeForAnsi = (value: unknown, seen?: WeakSet<object>): string => {
  if (typeof value !== 'object' || value === null) {
    return sanitizePrimitive(value);
  }
  if (seen?.has(value)) { return '[Circular]'; }
  const newSeen = seen || new WeakSet();
  newSeen.add(value);
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  return `Object(${keys(value).length})`;
};

const INDENT = '  ';

// Hoisted so each pattern is compiled once rather than on every stack frame.
const STACK_LOCATION_RE = /\(([^()]+):(\d+):(\d+)\)$/u;
const STACK_FUNCTION_RE = /^at\s+([^\s]+)/u;
const LEADING_AT_RE = /^ at /;

const formatContextValue = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) {
    return sanitizeForAnsi(value);
  }
  if (Array.isArray(value)) {
    return sanitizeForAnsi(value);
  }
  const obj = value as Record<string, unknown>;
  const k = keys(obj);
  if (k.length === 0) {
    return '(empty)';
  }
  const entries = k.map(key => `${INDENT}${key}: ${sanitizeForAnsi(obj[key])}`).join('\n');
  return `:\n${entries}`;
};

const renderContextAnsi = (context: Record<string, unknown>): string => {
  const normalized = normalizeRenderContext(context);
  const header = `\n${picocolors.bold('Render Context:')}\n`;
  // normalizeRenderContext is typed to return unknown (it can yield a primitive
  // or the string '[Unavailable]' from its catch block), so guard before keys().
  if (typeof normalized !== 'object' || normalized === null) {
    return header;
  }
  const record = normalized as Record<string, unknown>;
  const entries = keys(record).map(key => `${INDENT}${key} ${formatContextValue(record[key])}`);
  return header + entries.join('\n');
};

const makeHyperlink = (text: string, url: string): string => `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;

const stripMarkdown = (text: string): string => text.replace(/\*\*([^*]+)\*\*/gu, '$1').replace(/`([^`]+)`/gu, '$1');

const BULLET = `${picocolors.yellow('•')} `;

const getSeverityColor = (severity?: string): ((text: string) => string) => {
  if (severity === 'warning') { return picocolors.yellow; }
  if (severity === 'info') { return picocolors.blue; }
  return picocolors.red;
};

const getSeverityLabel = (severity?: string): ReturnType<typeof picocolors.bold> =>
  picocolors.bold(getSeverityColor(severity)('Error:'));

const getExtrasPart = (causeHint: string, docHint: string): string => {
  const extras = [causeHint, docHint].filter(Boolean).join(' | ');
  if (!extras) { return ''; }
  return `\n${extras}`;
};

const formatStackLine = (
  line: string,
  ide: string
): string => {
  const trimmed = line.trim();
  const pathMatch = trimmed.match(STACK_LOCATION_RE);
  if (!(pathMatch?.[1] && pathMatch[2])) {
    return `  ${trimmed}`;
  }

  const [, fullPath, lineNumRaw, colGroup] = pathMatch;
  const lineNum = Number.parseInt(lineNumRaw, 10);
  let colNum = 1;
  if (colGroup) { colNum = Number.parseInt(colGroup, 10); }
  const shortPath = shortenPath(fullPath);
  const fnMatch = trimmed.match(STACK_FUNCTION_RE);
  const fn = fnMatch?.[1] ?? '';
  const location = `${shortPath}:${lineNum}:${colNum}`;

  if (isFilePath(fullPath)) {
    const url = makeHyperlink(location, resolveIdeLink(ide, fullPath, lineNum, colNum));
    if (fn) { return `  at ${picocolors.cyan(fn)} (${url})`; }
    return `  at ${url}`;
  }
  if (fn) { return `  at ${fn} (${location})`; }
  return `  at ${location}`;
};

const formatLocationString = (
  path: string,
  location: { line: number; col: number },
  ide: string
): string => {
  if (!path) { return ''; }
  const shortPath = shortenPath(path);
  if (isFilePath(path)) {
    const url = makeHyperlink(`${shortPath}:${location.line}:${location.col}`, resolveIdeLink(ide, path, location.line, location.col));
    return ` at ${url}`;
  }
  return ` at ${shortPath}:${location.line}:${location.col}`;
};

const formatCausesAnsi = (causes: readonly string[]): string => {
  if (!causes || causes.length === 0) { return ''; }
  const items = causes.map(c => `  ${BULLET}${stripMarkdown(c)}`).join('\n');
  return `\n${picocolors.bold('Possible Causes:')}\n${items}\n`;
};

const formatFixAnsi = (fixCode: string | null, fixComment: string | null, documentationUrl: string | null): string => {
  if (!fixCode) { return ''; }

  const parts: string[] = [`${picocolors.bold('Suggested Fix:')}`];
  if (fixComment) { parts.push(picocolors.dim(`// ${stripMarkdown(fixComment)}`)); }
  parts.push(picocolors.green(fixCode));
  if (documentationUrl) { parts.push(`\n${picocolors.dim(`Learn more: ${documentationUrl}`)}`); }

  return parts.join('\n');
};

const getErrorMessage = (error: unknown): string => {
  let { message } = error as Error;
  if (!message) {
    message = String(error);
  }
  const firstStackLine = message.indexOf('\n    at ');
  if (firstStackLine !== -1) {
    message = message.slice(0, firstStackLine);
  }
  return message;
};

const formatMediumAnsi = (message: string, path: string, location: ReturnType<typeof toDisplayLocation>, causes: string[], documentationUrl: string | null, ide: string): string => {
  const [firstCause] = causes;
  const causeHint = firstCause ? stripMarkdown(firstCause) : '';
  const extrasPart = getExtrasPart(causeHint, documentationUrl || '');
  const locationPart = path
    ? formatLocationString(path, location, ide).replace(LEADING_AT_RE, '')
    : ` at line ${location.line}`;
  return `${message}${locationPart}${extrasPart}`;
};

interface AnsiErrorParts {
  causes: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
  severity: 'error' | 'warning' | 'info' | undefined;
  path: string;
  displayLineno: number | null;
  displayColno: number | null;
  lineBase: 'zero' | 'one' | null;
}

const extractAnsiErrorParts = (error: unknown, templatePath?: string, lineno?: number | null, colno?: number | null): AnsiErrorParts => {
  const errObj = error as {
    templateName?: string;
    lineno?: number | null;
    colno?: number | null;
    lineBase?: 'zero' | 'one' | null;
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
    severity?: 'error' | 'warning' | 'info';
  };
  const classification = classifyFromError(errObj);
  return {
    causes: classification.causes?.length ? [...classification.causes] : [...(errObj.causes || [])],
    fixCode: classification.fixCode ?? errObj.fixCode ?? '',
    fixComment: classification.fixComment ?? errObj.fixComment ?? '',
    documentationUrl: classification.documentationUrl ?? errObj.documentationUrl ?? null,
    severity: errObj.severity,
    path: templatePath || errObj.templateName || '',
    displayLineno: lineno ?? errObj.lineno ?? null,
    displayColno: colno ?? errObj.colno ?? null,
    lineBase: errObj.lineBase ?? 'zero',
  };
};

const formatFullAnsi = (
  message: string,
  parts: AnsiErrorParts,
  ide: string,
  sourceTrace: SourceTrace | null | undefined,
  renderContext: Record<string, unknown> | undefined
): string => {
  const { causes, fixCode, fixComment, documentationUrl, severity, path } = parts;
  const location = toDisplayLocation(parts.displayLineno, parts.displayColno, parts.lineBase);
  const stack = (sourceTrace as unknown as Error).stack || '';
  const stackLines = stack.split('\n').slice(1);
  const formattedStack = stackLines.map(line => formatStackLine(line, ide)).join('\n');
  const locationStr = formatLocationString(path, location, ide);
  const severityLabel = getSeverityLabel(severity);
  const header = `${severityLabel} ${message}${locationStr}\n`;

  const outputParts: string[] = [header];

  if (sourceTrace && sourceTrace.lines.length > 0) {
    outputParts.push(picocolors.bold('Source Trace:'));
    outputParts.push(formatSourceTrace(sourceTrace.lines, sourceTrace.caret).join('\n'));
  }

  const causesStr = formatCausesAnsi(causes);
  if (causesStr) { outputParts.push(causesStr); }

  const fixStr = formatFixAnsi(fixCode, fixComment, documentationUrl);
  if (fixStr) { outputParts.push(fixStr); }

  if (renderContext) {
    outputParts.push(renderContextAnsi(renderContext));
  }

  outputParts.push(`\n${picocolors.bold('Stack Trace:')}\n${formattedStack}`);

  return outputParts.filter(Boolean).join('\n');
};

const toAnsi = (error: unknown, options: AnsiOptions = {}): string => {
  if (!error) { return ''; }

  const { verbosity = 'full', templatePath, lineno, colno, ide = 'vscode', sourceTrace } = options;
  const message = getErrorMessage(error);

  if (verbosity === 'simple') {
    return message;
  }

  const parts = extractAnsiErrorParts(error, templatePath, lineno, colno);

  if (verbosity === 'medium') {
    const location = toDisplayLocation(parts.displayLineno, parts.displayColno, parts.lineBase);
    return formatMediumAnsi(message, parts.path, location, parts.causes, parts.documentationUrl, ide);
  }

  return formatFullAnsi(message, parts, ide, sourceTrace, options.renderContext);
};

export { toAnsi };
export type { AnsiOptions };
