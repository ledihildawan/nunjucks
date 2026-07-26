import picocolors from 'picocolors';
import { keys } from 'remeda';
import { shortenPath } from './internal/path-shortener.ts';
import { toDisplayLocation } from './internal/location.ts';
import { isFilePath, resolveIdeLink } from './internal/ide-links.ts';
import { normalizeRenderContext } from './internal/safe-context.ts';
import type { SourceTrace, SourceTraceLine, SourceTraceCaret } from './internal/source-trace.ts';
import { classifyFromError } from '../errors/classify.ts';

export interface AnsiOptions {
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

const getMarker = (isError: boolean): string =>
  isError ? ERROR_MARKER : NORMAL_MARKER;

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
    if (!line.isError || !caret) {
      return [codeLine];
    }
    return [codeLine, formatCaretLine(lineNumWidth, caret.charStart, caret.carets)];
  });
};

const sanitizeForAnsi = (value: unknown, seen?: WeakSet<object>): string => {
  if (value === null) { return 'null'; }
  if (value === undefined) { return 'undefined'; }
  if (typeof value === 'function') { return `[Function: ${value.name || 'anonymous'}]`; }
  if (typeof value === 'object') {
    if (seen?.has(value as object)) { return '[Circular]'; }
    const newSeen = seen || new WeakSet();
    newSeen.add(value as object);
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }
    return `Object(${keys(value).length})`;
  }
  if (typeof value === 'string') { return `"${value}"`; }
  return String(value);
};

const INDENT = '  ';

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
  const entries = keys(normalized).map(key => `${INDENT}${key} ${formatContextValue(normalized[key])}`);
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
  return extras ? `\n${extras}` : '';
};

const formatStackLine = (
  line: string,
  ide: string
): string => {
  const trimmed = line.trim();
  const pathMatch = trimmed.match(/\(([^()]+):(\d+):(\d+)\)$/u);
  if (!pathMatch?.[1] || !pathMatch[2]) {
    return `  ${trimmed}`;
  }

  const fullPath = pathMatch[1];
  const lineNum = Number.parseInt(pathMatch[2], 10);
  const colNum = pathMatch[3] ? Number.parseInt(pathMatch[3], 10) : 1;
  const shortPath = shortenPath(fullPath);
  const fnMatch = trimmed.match(/^at\s+([^\s]+)/u);
  const fn = fnMatch?.[1] ?? '';
  const location = `${shortPath}:${lineNum}:${colNum}`;

  if (isFilePath(fullPath)) {
    const url = makeHyperlink(location, resolveIdeLink(ide, fullPath, lineNum, colNum));
    return fn ? `  at ${picocolors.cyan(fn)} (${url})` : `  at ${url}`;
  }
  return fn ? `  at ${fn} (${location})` : `  at ${location}`;
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

  const parts = [
    `${picocolors.bold('Suggested Fix:')}`,
    fixComment ? picocolors.dim(`// ${stripMarkdown(fixComment)}`) : null,
    picocolors.green(fixCode),
    documentationUrl ? `\n${picocolors.dim(`Learn more: ${documentationUrl}`)}` : null
  ].filter(Boolean);

  return parts.join('\n');
};

export const toAnsi = async (error: unknown, options: AnsiOptions = {}): Promise<string> => {
  if (!error) { return ''; }

  const { verbosity = 'full', templatePath, lineno, colno, ide = 'vscode', sourceTrace } = options;

  let message = (error as Error).message;
  if (!message) {
    message = String(error);
  }

  const firstStackLine = message.indexOf('\n    at ');
  if (firstStackLine !== -1) {
    message = message.substring(0, firstStackLine);
  }

  if (verbosity === 'simple') {
    return message;
  }

  const errObj = error as {
    code?: string | null;
    subject?: string | null;
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
    severity?: 'error' | 'warning' | 'info';
  };

  const classification = classifyFromError(errObj);
  let causes: string[];
  if (classification.causes && classification.causes.length > 0) {
    causes = [...classification.causes];
  } else {
    causes = [...(errObj.causes || [])];
  }
  const fixCode = classification.fixCode ?? errObj.fixCode ?? '';
  const fixComment = classification.fixComment ?? errObj.fixComment ?? '';
  const documentationUrl = classification.documentationUrl ?? errObj.documentationUrl ?? null;

  const path = templatePath || (error as { templateName?: string }).templateName || '';
  const displayLineno = lineno ?? (error as { lineno?: number | null }).lineno ?? null;
  const displayColno = colno ?? (error as { colno?: number | null }).colno ?? null;
  const lineBase = (error as { lineBase?: 'zero' | 'one' | null }).lineBase ?? 'zero';

  const location = toDisplayLocation(displayLineno, displayColno, lineBase);

  if (verbosity === 'medium') {
    const causeHint = causes[0] ? stripMarkdown(causes[0]) : '';
    const extrasPart = getExtrasPart(causeHint, documentationUrl || '');
    const locationPart = path ? formatLocationString(path, location, ide).replace(/^ at /, '') : ` at line ${location.line}`;

    return `${message}${locationPart}${extrasPart}`;
  }

  const stack = (error as Error).stack || '';
  const stackLines = stack.split('\n').slice(1);
  const formattedStack = stackLines.map(line => formatStackLine(line, ide)).join('\n');
  const locationStr = formatLocationString(path, location, ide);
  const severityLabel = getSeverityLabel(errObj.severity);
  const header = `${severityLabel} ${message}${locationStr}\n`;

  const parts: string[] = [header];

  if (sourceTrace && sourceTrace.lines.length > 0) {
    parts.push(picocolors.bold('Source Trace:'));
    parts.push(formatSourceTrace(sourceTrace.lines, sourceTrace.caret).join('\n'));
  }

  const causesStr = formatCausesAnsi(causes);
  if (causesStr) { parts.push(causesStr); }

  const fixStr = formatFixAnsi(fixCode, fixComment, documentationUrl);
  if (fixStr) { parts.push(fixStr); }

  if (options.renderContext && verbosity === 'full') {
    parts.push(renderContextAnsi(options.renderContext));
  }

  parts.push(`\n${picocolors.bold('Stack Trace:')}\n${formattedStack}`);

  return parts.filter(Boolean).join('\n');
};
