import { PATTERNS } from '../constants/error-patterns.js';

export const extractUndefinedName = (message) => {
  if (!message) return null;

  const callMatch = message.match(PATTERNS.CALL_MATCH);
  if (callMatch) return callMatch[1];

  const outputMatch = message.match(PATTERNS.OUTPUT_MATCH);
  if (outputMatch) {
    const name = outputMatch[1];
    if (name === 'null' || name === 'undefined') return null;
    return name;
  }

  return null;
};

export const extractLineInfo = (message) => {
  if (!message) return { line: null, col: null };

  const lineMatch = message.match(PATTERNS.LINE_INFO);
  if (lineMatch) {
    return {
      line: parseInt(lineMatch[1], 10),
      col: lineMatch[2] ? parseInt(lineMatch[2], 10) : null
    };
  }

  const includedMatch = message.match(/\(included from [^:]+:(\d+)\)/);
  if (includedMatch) {
    return { line: parseInt(includedMatch[1], 10), col: null };
  }

  return { line: null, col: null };
};

export const extractColFromMessage = (message) => {
  if (!message) return null;

  const colMatch = message.match(PATTERNS.COLUMN_INFO);
  if (colMatch) {
    return parseInt(colMatch[1], 10);
  }

  return null;
};

export const extractIncludeChainFromMessage = (message) => {
  if (!message) return null;

  const match = message.match(PATTERNS.INCLUDED_FROM_WITH_LINE);
  if (match) {
    return [{
      parentTmpl: match[1],
      parentLineno: parseInt(match[2], 10),
      parentColno: match[3] ? parseInt(match[3], 10) : null
    }];
  }

  return null;
};

export const extractErrorTemplateName = (message) => {
  if (!message) return null;

  const match = message.match(PATTERNS.INCLUDED_FROM);
  if (match) {
    return match[1];
  }

  const simpleMatch = message.match(/^\(([^)]+)\)/);
  return simpleMatch ? simpleMatch[1] : null;
};
