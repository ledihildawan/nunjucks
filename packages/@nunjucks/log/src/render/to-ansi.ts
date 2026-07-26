import picocolors from 'picocolors';
import { keys, forEachObj } from 'remeda';
import { shortenPath } from './internal/path-shortener.ts';
import { toDisplayLocation } from './internal/location.ts';
import { isFilePath, resolveIdeLink } from './internal/ide-links.ts';
import { normalizeRenderContext } from './internal/safe-context.ts';
import { classifyFromError } from '../errors/classify.ts';

export interface AnsiOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
  ide?: string;
  sourceContent?: string;
  sourceStartLine?: number;
  renderContext?: Record<string, unknown>;
}

interface SourceTraceLine {
  lineNum: number;
  content: string;
  isError: boolean;
}

const SEPARATOR = ' │ ';
const ERROR_MARKER = '> ';
const NORMAL_MARKER = '  ';
const MIN_LINE_NUM_WIDTH = 2;
const MAX_CARET_LENGTH = 15;

const getMarker = (isError: boolean): string =>
  isError ? ERROR_MARKER : NORMAL_MARKER;

const getLineNumWidth = (lines: SourceTraceLine[]): number => {
  const maxLineNum = Math.max(...lines.map(l => l.lineNum));
  return Math.max(MIN_LINE_NUM_WIDTH, String(maxLineNum).length);
};

const calculateCaretLength = (content: string, colno: number): number => {
  const remaining = content.slice(colno);
  const nextSpace = remaining.search(/[\s,;)\]}]/);
  const tokenEnd = nextSpace > 0 ? nextSpace : remaining.length;
  return Math.max(1, Math.min(tokenEnd, MAX_CARET_LENGTH));
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

const formatCaretLine = (
  lineNumWidth: number,
  errorColno: number,
  caretLength: number
): string => {
  const prefix = getLinePrefix(lineNumWidth);
  const carets = picocolors.red('^'.repeat(caretLength));
  return `${prefix}${' '.repeat(errorColno)}${carets}`;
};

const formatSourceTrace = (lines: SourceTraceLine[], errorColno: number | null): string[] => {
  if (lines.length === 0) { return []; }

  const lineNumWidth = getLineNumWidth(lines);
  const result: string[] = [];

  for (const line of lines) {
    result.push(formatCodeLine(line.lineNum, line.content, line.isError, lineNumWidth));

    if (line.isError && errorColno !== null && errorColno > 0) {
      const caretLength = calculateCaretLength(line.content, errorColno);
      result.push(formatCaretLine(lineNumWidth, errorColno, caretLength));
    }
  }

  return result;
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

const renderContextAnsi = (context: Record<string, unknown>): string => {
  const normalized = normalizeRenderContext(context);
  const lines: string[] = [];
  lines.push(`\n${picocolors.bold('Render Context:')}\n`);

  const renderValue = (key: string, value: unknown, indent = 0): string => {
    const prefix = '  '.repeat(indent);

    if (value === null || value === undefined) {
      return `${prefix}${key}: ${sanitizeForAnsi(value)}`;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `${prefix}${key}: ${sanitizeForAnsi(value)}`;
      }

      const obj = value as Record<string, unknown>;
      const k = keys(obj);

      if (k.length === 0) {
        return `${prefix}${key}: (empty)`;
      }

      const entries = k.map(key => `${prefix}  ${key}: ${sanitizeForAnsi(obj[key])}`).join('\n');
      return `${prefix}${key}:\n${entries}`;
    }

    return `${prefix}${key}: ${sanitizeForAnsi(value)}`;
  };

  forEachObj(normalized as Record<string, unknown>, (value, key) => {
    lines.push(renderValue(key, value));
  });

  return lines.join('\n');
};

const makeHyperlink = (text: string, url: string): string => `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;

const stripMarkdown = (text: string): string => text.replace(/\*\*([^*]+)\*\*/gu, '$1').replace(/`([^`]+)`/gu, '$1');

const BULLET = `${picocolors.yellow('•')} `;

const getSeverityLabel = (severity?: string): ReturnType<typeof picocolors.bold> => {
  if (severity === 'warning') { return picocolors.bold(picocolors.yellow('Warning:')); }
  if (severity === 'info') { return picocolors.bold(picocolors.blue('Info:')); }
  return picocolors.bold(picocolors.red('Error:'));
};

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
  location: { line: string; col: string },
  ide: string
): string => {
  if (!path) { return ''; }
  const shortPath = shortenPath(path);
  if (isFilePath(path)) {
    const url = makeHyperlink(`${shortPath}:${location.line}:${location.col}`, resolveIdeLink(ide, path, Number(location.line), Number(location.col)));
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
  let out = `\n${picocolors.bold('Suggested Fix:')}`;
  if (fixComment) {
    out += `\n${picocolors.dim(`// ${stripMarkdown(fixComment)}`)}`;
  }
  out += `\n${picocolors.green(fixCode)}`;
  if (documentationUrl) {
    out += `\n${picocolors.dim(`Learn more: ${documentationUrl}`)}`;
  }
  return out + '\n';
};

export const toAnsi = (error: unknown, options: AnsiOptions = {}): string => {
  if (!error) { return ''; }

  const { verbosity = 'full', templatePath, lineno, colno, ide = 'vscode', sourceStartLine = 1 } = options;

  let message = (error as Error).message;
  if (!message || typeof message !== 'string') {
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
    const causeHint = causes.length > 0 ? stripMarkdown(causes[0] ?? '') : '';
    const docHint = documentationUrl || '';
    const extrasPart = getExtrasPart(causeHint, docHint);

    if (path) {
      const shortPath = shortenPath(path);
      if (isFilePath(path)) {
        const url = makeHyperlink(`${shortPath}:${location.line}:${location.col}`, resolveIdeLink(ide, path, location.line, location.col));
        return `${message} at ${url}${extrasPart}`;
      }
      return `${message} at ${shortPath}:${location.line}:${location.col}${extrasPart}`;
    }
    return `${message} at line ${location.line}${extrasPart}`;
  }

  const stack = (error as Error).stack || '';
  const stackLines = stack.split('\n').slice(1);
  const formattedStack = stackLines.map(line => formatStackLine(line, ide)).join('\n');
  const locationStr = formatLocationString(path, location, ide);
  const severityLabel = getSeverityLabel(errObj.severity);
  const header = `${severityLabel} ${message}${locationStr}\n`;

  const parts: string[] = [header];

  if (options.sourceContent && displayLineno !== null) {
    const sourceLines = options.sourceContent.split('\n');
    const errorLineIndex = displayLineno;
    const startLine = Math.max(0, errorLineIndex - 2);
    const endLine = Math.min(sourceLines.length, errorLineIndex + 3);

    const traceLines: SourceTraceLine[] = [];
    for (let i = startLine; i < endLine; i++) {
      const lineNum = (options.sourceStartLine ?? 1) + i;
      traceLines.push({
        lineNum,
        content: sourceLines[i] || '',
        isError: i === errorLineIndex
      });
    }

    parts.push(picocolors.bold('Source Trace:'));
    parts.push(formatSourceTrace(traceLines, displayColno).join('\n'));
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
