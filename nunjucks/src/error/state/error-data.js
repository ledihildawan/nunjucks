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

export const createErrorData = (error, options = {}) => {
  const {
    templateName,
    templatePath,
    sourceContent,
    includeChain = null,
    isProduction = false,
    line: lineOverride,
    col: colOverride
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

  return {
    message,
    errorName: error?.name || 'Error',
    originalError: error,
    templateName: templateName || extractErrorTemplateName(message) || 'unknown',
    templatePath: templatePath || null,
    line,
    col,
    snippet,
    includeChain: includeChain || extractIncludeChainFromMessage(message),
    classified,
    isProduction,
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
