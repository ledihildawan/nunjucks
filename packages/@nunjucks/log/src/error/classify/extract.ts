import { PATTERNS } from '../messages.ts';

export const extractUndefinedName = (message: string): string | null => {
  if (!message) return null;

  const callMatch = message.match(PATTERNS.CALL_MATCH);
  if (callMatch && callMatch[1]) {
    let name = callMatch[1];
    if (name.endsWith('()')) {
      name = name.slice(0, -2);
    }
    return name;
  }

  const varNotDefinedMatch = message.match(PATTERNS.UNDEFINED_VARIABLE);
  if (varNotDefinedMatch?.[1]) {
    return varNotDefinedMatch[1];
  }

  const funcNotDefinedMatch = message.match(PATTERNS.UNDEFINED_FUNCTION);
  if (funcNotDefinedMatch?.[1]) {
    return funcNotDefinedMatch[1];
  }

  const notAFunctionMatch = message.match(PATTERNS.NOT_A_FUNCTION);
  if (notAFunctionMatch?.[1]) {
    return notAFunctionMatch[1];
  }

  const filterNotFoundMatch = message.match(PATTERNS.UNDEFINED_FILTER);
  if (filterNotFoundMatch?.[1]) {
    return filterNotFoundMatch[1];
  }

  const sandboxAccessMatch = message.match(PATTERNS.SANDBOX_ACCESS);
  if (sandboxAccessMatch?.[1]) {
    return sandboxAccessMatch[1];
  }

  const sandboxSetMatch = message.match(PATTERNS.SANDBOX_SET);
  if (sandboxSetMatch?.[1]) {
    return sandboxSetMatch[1];
  }

  const outputMatch = message.match(PATTERNS.OUTPUT_MATCH);
  if (outputMatch?.[1]) {
    const name = outputMatch[1];
    if (name === 'null' || name === 'undefined') return null;
    return name;
  }

  return null;
};

export interface LineInfo {
  line: number | null;
  col: number | null;
}

export const extractLineInfo = (message: string): LineInfo => {
  if (!message) return { line: null, col: null };

  const lineMatch = message.match(PATTERNS.LINE_INFO_MATCH);
  if (lineMatch?.[1]) {
    return {
      line: Number(lineMatch[1]),
      col: lineMatch[2] ? Number(lineMatch[2]) : null
    };
  }

  const includedMatch = message.match(/\(included from [^:]+:(\d+)\)/);
  if (includedMatch?.[1]) {
    return { line: Number(includedMatch[1]), col: null };
  }

  return { line: null, col: null };
};

export const extractColFromMessage = (message: string): number | null => {
  if (!message) return null;

  const colMatch = message.match(PATTERNS.COLUMN_INFO_MATCH);
  if (colMatch?.[1]) {
    return Number(colMatch[1]);
  }

  return null;
};

export interface IncludeChainEntry {
  parentTmpl: string;
  parentLineno: number;
  parentColno: number | null;
}

export const extractIncludeChainFromMessage = (message: string): IncludeChainEntry[] | null => {
  if (!message) return null;

  const match = message.match(PATTERNS.INCLUDED_FROM_WITH_LINE_MATCH);
  if (match?.[1] && match[2]) {
    return [{
      parentTmpl: match[1],
      parentLineno: Number(match[2]),
      parentColno: match[3] ? Number(match[3]) : null
    }];
  }

  return null;
};

export const extractErrorTemplateName = (message: string): string | null => {
  if (!message) return null;

  const match = message.match(PATTERNS.INCLUDED_FROM_MATCH);
  if (match?.[1]) {
    return match[1];
  }

  const simpleMatch = message.match(/^\(([^)]+)\)/);
  return simpleMatch?.[1] ?? null;
};
