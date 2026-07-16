import { PATTERNS } from '../constants/error-patterns.js';

export const extractUndefinedName = (message) => {
  if (!message) return null;

  const callMatch = message.match(PATTERNS.CALL_MATCH);
  if (callMatch) {
    let name = callMatch[1];
    if (name.endsWith('()')) {
      name = name.slice(0, -2);
    }
    return name;
  }

  const varNotDefinedMatch = message.match(PATTERNS.VARIABLE_NOT_DEFINED);
  if (varNotDefinedMatch) {
    return varNotDefinedMatch[1];
  }

  const funcNotDefinedMatch = message.match(PATTERNS.UNDEFINED_FUNCTION);
  if (funcNotDefinedMatch) {
    return funcNotDefinedMatch[1];
  }

  const notAFunctionMatch = message.match(PATTERNS.NOT_A_FUNCTION);
  if (notAFunctionMatch) {
    return notAFunctionMatch[1];
  }

  const filterNotFoundMatch = message.match(PATTERNS.UNDEFINED_FILTER);
  if (filterNotFoundMatch) {
    return filterNotFoundMatch[1];
  }

  const sandboxAccessMatch = message.match(PATTERNS.SANDBOX_ACCESS);
  if (sandboxAccessMatch) {
    return sandboxAccessMatch[1];
  }

  const sandboxSetMatch = message.match(PATTERNS.SANDBOX_SET);
  if (sandboxSetMatch) {
    return sandboxSetMatch[1];
  }

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
      line: Number(lineMatch[1]),
      col: lineMatch[2] ? Number(lineMatch[2]) : null
    };
  }

  const includedMatch = message.match(/\(included from [^:]+:(\d+)\)/);
  if (includedMatch) {
    return { line: Number(includedMatch[1]), col: null };
  }

  return { line: null, col: null };
};

export const extractColFromMessage = (message) => {
  if (!message) return null;

  const colMatch = message.match(PATTERNS.COLUMN_INFO);
  if (colMatch) {
    return Number(colMatch[1]);
  }

  return null;
};

export const extractIncludeChainFromMessage = (message) => {
  if (!message) return null;

  const match = message.match(PATTERNS.INCLUDED_FROM_WITH_LINE);
  if (match) {
    return [{
      parentTmpl: match[1],
      parentLineno: Number(match[2]),
      parentColno: match[3] ? Number(match[3]) : null
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
