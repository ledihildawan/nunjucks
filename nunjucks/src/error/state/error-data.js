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

const generateFingerprint = (code, templateName, line, col) => {
  const str = [code, templateName, line, col].filter(Boolean).join(':');
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).padStart(6, '0').slice(0, 8);
};

const formatTimestamp = (iso) => {
  if (!iso) return '';
  return iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
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
  if (depth >= 4) return '[Object]';
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
    renderContext = null,
    ide = 'vscode',
    version = '3.2.4'
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

  const classified = classifyFromError(error);
  const displayLine = getDisplayLine(line);
  const displayCol = getDisplayCol(col);
  const sourceLine = extractSourceLine(sourceContent, line);
  const resolvedTemplateName = templateName || extractErrorTemplateName(message) || 'unknown';
  const fingerprint = generateFingerprint(error?.code, resolvedTemplateName, line, col);

  return {
    errorId: fingerprint,
    fingerprint,
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
    renderContext: snapshotContext(renderContext),
    getDisplayLine: () => displayLine ?? '?',
    getDisplayCol: () => displayCol ?? '?'
  };
};

