import { classifyError } from '../core/classify.js';
import {
  extractLineInfo,
  extractColFromMessage,
  extractIncludeChainFromMessage,
  extractErrorTemplateName
} from '../core/extract.js';
import { getSnippet } from '../core/snippet-utils.js';
import { mergeLine, mergeCol, getDisplayLine, getDisplayCol } from '../core/line-utils.js';

const getSourceLines = (sourceContent) => (sourceContent ? sourceContent.split('\n') : null);

let _idCounter = 0;
const generateErrorId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `err_${Date.now().toString(36)}_${(_idCounter++).toString(36)}`;
};

const SENSITIVE_KEY = /pass|secret|token|api[-_]?key|auth|credit|ssn|cookie|private/i;

const sanitizeValue = (value, depth = 0) => {
  if (value == null) return value;
  const type = typeof value;
  if (type === 'function') return '[Function]';
  if (type === 'symbol') return '[Symbol]';
  if (type === 'string') {
    return value.length > 120 ? value.slice(0, 120) + '…' : value;
  }
  if (type !== 'object') {
    return value;
  }
  if (depth >= 2) return Array.isArray(value) ? '[Array]' : '[Object]';
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((v) => sanitizeValue(v, depth + 1));
  }
  const out = {};
  let count = 0;
  for (const k of Object.keys(value)) {
    if (count++ >= 20) {
      out['…'] = '(truncated)';
      break;
    }
    out[k] = SENSITIVE_KEY.test(k) ? '***' : sanitizeValue(value[k], depth + 1);
  }
  return out;
};

const snapshotContext = (ctx) => {
  if (!ctx || typeof ctx !== 'object') return null;
  const snapshot = {};
  let count = 0;
  for (const k of Object.keys(ctx)) {
    if (count++ >= 30) {
      snapshot['…'] = '(truncated)';
      break;
    }
    snapshot[k] = SENSITIVE_KEY.test(k) ? '***' : sanitizeValue(ctx[k]);
  }
  return snapshot;
};

const extractSourceLine = (sourceContent, line) => {
  if (!sourceContent || line == null) return null;
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
    renderContext = null
  } = options;

  const message = error?.message || '';

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

  const classified = classifyError(message);
  const displayLine = getDisplayLine(line);
  const displayCol = getDisplayCol(col);
  const sourceLine = extractSourceLine(sourceContent, line);

  return {
    errorId: generateErrorId(),
    timestamp: new Date().toISOString(),
    message,
    errorName: error?.name || 'Error',
    originalError: error,
    templateName: templateName || extractErrorTemplateName(message) || 'unknown',
    templatePath: templatePath || null,
    line,
    col,
    sourceLine,
    snippet,
    includeChain: includeChain || extractIncludeChainFromMessage(message),
    classified,
    isProduction,
    renderContext: snapshotContext(renderContext),
    getDisplayLine: () => displayLine ?? '?',
    getDisplayCol: () => displayCol ?? '?'
  };
};

export const formatLocation = (errorData) => {
  const { templateName, line, col, includeChain } = errorData;

  const lineCol = line !== null ? `:${line}${col !== null ? `:${col}` : ''}` : '';
  const mainLoc = templateName + lineCol;

  if (includeChain && includeChain.length > 0) {
    const first = includeChain[0];
    const parentLoc = `${first.parentTmpl}:${first.parentLineno}${first.parentColno ? `:${first.parentColno}` : ''}`;
    return `${mainLoc} (included from ${parentLoc})`;
  }
  return mainLoc;
};

export const getDisplayMessage = (errorData) => {
  const { message, classified } = errorData;
  if (!classified) return message;

  if (classified.category === 'undefined_variable') {
    return classified.undefinedName
      ? `Variable '${classified.undefinedName}' is undefined or null`
      : 'Variable is undefined or null';
  }

  if (classified.category === 'undefined_function') {
    return classified.undefinedName
      ? `Unable to call '${classified.undefinedName}', which is undefined or falsey`
      : 'Unable to call undefined function';
  }

  if (classified.category === 'not_a_function') {
    return classified.undefinedName
      ? `'${classified.undefinedName}' is not a function`
      : 'Value is not a function';
  }

  return message;
};

export const formatCodeTrace = (snippet) => {
  if (!snippet) return [];
  return snippet.split('\n').map(l => l.trim());
};
