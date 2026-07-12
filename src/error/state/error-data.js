import { keys, isArray, defaultTo, isFunction, isString, isNullish, isPlainObject } from 'remeda';
import { classifyFromError } from '../core/classify.js';
import {
  extractLineInfo,
  extractColFromMessage,
  extractIncludeChainFromMessage,
  extractErrorTemplateName
} from '../core/extract.js';
import { getSnippet } from '../core/snippet.js';
import { mergeLine, mergeCol, getDisplayLine, getDisplayCol } from '../core/line.js';

const getSourceLines = (sourceContent) => (sourceContent ? sourceContent.split('\n') : null);

const parseJsCallerLines = (jsCallerSource, jsCallerErrorLine) => {
  if (!jsCallerSource) return null;
  const lines = jsCallerSource.split('\n');
  return lines.map(line => {
    const colonIdx = line.indexOf(':');
    const lineNum = colonIdx > 0 ? line.substring(0, colonIdx).trim() : '';
    const code = colonIdx > 0 ? line.substring(colonIdx + 1) : line;
    const parsedLineNum = Number(lineNum);
    const isError = jsCallerErrorLine && parsedLineNum === jsCallerErrorLine;
    return { lineNum, code, isError };
  });
};

const formatTimestamp = (iso) => {
  if (!iso) return '';
  return Math.floor(new Date(iso).getTime() / 1000).toString();
};

const SENSITIVE_KEY = /pass|secret|token|api[-_]?key|auth|credit|ssn|cookie|private/i;

const sanitizeValue = (value, depth = 0) => {
  if (isNullish(value)) return value;
  if (isFunction(value)) return '[Function]';
  if (typeof value === 'symbol') return '[Symbol]';
  if (isString(value)) {
    return value.length > 120 ? value.slice(0, 120) + '…' : value;
  }
  if (!isPlainObject(value)) {
    return value;
  }
  if (depth >= 4) return '[Object]';
  if (isArray(value)) {
    return value.slice(0, 10).map((v) => sanitizeValue(v, depth + 1));
  }
  const out = {};
  let count = 0;
  for (const k of keys(value)) {
    if (count++ >= 20) {
      out['…'] = '(truncated)';
      break;
    }
    out[k] = SENSITIVE_KEY.test(k) ? '***' : sanitizeValue(value[k], depth + 1);
  }
  return out;
};

const snapshotContext = (ctx) => {
  if (!ctx || !isPlainObject(ctx)) return null;
  const snapshot = {};
  let count = 0;
  for (const k of keys(ctx)) {
    if (count++ >= 30) {
      snapshot['…'] = '(truncated)';
      break;
    }
    snapshot[k] = SENSITIVE_KEY.test(k) ? '***' : sanitizeValue(ctx[k]);
  }
  return snapshot;
};

const extractSourceLine = (sourceContent, line) => {
  if (!sourceContent || line === null || line === undefined) return null;
  const lines = sourceContent.split('\n');
  const idx = line - 1;
  return idx >= 0 && idx < lines.length ? lines[idx] : null;
};

export const createErrorData = (error, options = {}) => {
  const {
    templateName,
    templatePath,
    sourceContent,
    includeChain = null,
    isProduction = false,
    line: lineOverride,
    col: colOverride,
    renderContext = null,
    ide = 'vscode',
    version = '3.2.4',
    jsCaller = null,
    jsCallerSource = null,
    jsCallerErrorLine = null
  } = options;

  const message = defaultTo(error?.message, '');

  const { line: lineFromMsg, col: colFromMsg } = extractLineInfo(message);
  const colFromRawMsg = extractColFromMessage(message);

  const line = mergeLine(lineOverride ?? error?.lineno ?? null, lineFromMsg);
  const col = mergeCol(colOverride ?? error?.colno ?? null, colFromMsg, colFromRawMsg);

  let snippet = null;
  if (line !== null) {
    const sourceLines = getSourceLines(sourceContent);
    snippet = sourceLines
      ? getSnippet(sourceLines, getDisplayLine(line), 3)
      : `>>> ${getDisplayLine(line)}: [source not available]`;
  }

  const classified = classifyFromError(error);
  const displayLine = getDisplayLine(line);
  const displayCol = getDisplayCol(col);
  const sourceLine = extractSourceLine(sourceContent, line);
  const resolvedTemplateName = templateName || extractErrorTemplateName(message) || 'unknown';
  const jsCallerLines = parseJsCallerLines(jsCallerSource, jsCallerErrorLine);

  return {
    timestamp: formatTimestamp(new Date().toISOString()),
    version,
    code: error?.code ?? null,
    subject: error?.subject ?? null,
    phase: error?.phase ?? null,
    message,
    errorName: error?.name || 'Error',
    originalError: error,
    templateName: resolvedTemplateName,
    templatePath: templatePath || null,
    line,
    col,
    sourceLine,
    snippet,
    includeChain: includeChain || extractIncludeChainFromMessage(message),
    classified,
    isProduction,
    ide,
    jsCaller,
    jsCallerSource,
    jsCallerErrorLine,
    jsCallerLines,
    renderContext: snapshotContext(renderContext),
    getDisplayLine: () => displayLine ?? '?',
    getDisplayCol: () => displayCol ?? '?'
  };
};

