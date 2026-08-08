import type { LineBase } from '../../../line-base.ts';
import { escapeRegex } from '@nunjucks/shared';
import { toDisplayLocation } from './location.ts';
import { calculateCaretPosition } from '../highlight/caret.ts';

const buildSecretValuePattern = (blockedKeys: readonly string[] | null): RegExp | null => {
  if (!blockedKeys || blockedKeys.length === 0) { return null; }
  const cleaned = blockedKeys.filter((k): k is string => typeof k === 'string' && k.length > 0);
  if (cleaned.length === 0) { return null; }
  const alternation = cleaned.map(escapeRegex).join('|');
  return new RegExp(`\\b(${alternation})(\\s*[:=]\\s*)(['"])([^'"\\\\]*(?:\\\\.[^'"\\\\]*)*)\\3`, 'giu');
};

const redactSecretValues = (line: string, blockedKeys: readonly string[] | null): string => {
  const pattern = buildSecretValuePattern(blockedKeys);
  if (!pattern) { return line; }
  return line.replaceAll(pattern, (_match, key, sep, quote) => `${key}${sep}${quote}[Redacted]${quote}`);
};

interface SourceTraceLine {
  number: number;
  content: string;
  isError: boolean;
}

interface SourceTraceCaret {
  line: number;
  charStart: number;
  charEnd: number;
  carets: string;
}

interface SourceTrace {
  lines: SourceTraceLine[];
  caret: SourceTraceCaret | null;
  displayLine: number;
  displayCol: number;
  resolvedPath: string | null;
}

interface BuildSourceTraceInput {
  sourceContent?: string | null;
  templatePath?: string | null;
  lineno?: number | null;
  colno?: number | null;
  lineBase?: LineBase | null;
  sourceStartLine?: number;
  context?: number;
  blockedKeys?: readonly string[] | null;
}

const DEFAULT_CONTEXT = 2;

const windowSourceTrace = (params: {
  content: string;
  displayLine: number;
  displayCol: number;
  sourceStartLine: number;
  context: number;
  resolvedPath: string | null;
  blockedKeys: readonly string[] | null;
}): SourceTrace => {
  const { content, displayLine, displayCol, sourceStartLine, context, resolvedPath, blockedKeys } = params;

  const lines = content.split('\n');
  const errorIndex = displayLine - sourceStartLine;
  if (errorIndex < 0 || errorIndex >= lines.length) {
    return { lines: [], caret: null, displayLine, displayCol, resolvedPath };
  }

  const ctx = Math.max(0, context);
  const start = Math.max(0, errorIndex - ctx);
  const end = Math.min(lines.length, errorIndex + ctx + 1);

  const traceLines: SourceTraceLine[] = Array.from({ length: end - start }, (_, offset) => {
    const i = start + offset;
    const rawLine = lines[i] ?? '';
    return {
      number: sourceStartLine + i,
      content: redactSecretValues(rawLine, blockedKeys),
      isError: i === errorIndex
    };
  });

  const errorLineContent = redactSecretValues(lines[errorIndex] ?? '', blockedKeys);
  const caretInfo = displayCol > 0 ? calculateCaretPosition(errorLineContent, displayCol) : null;
  const caret: SourceTraceCaret | null = caretInfo
    ? {
      line: displayLine,
      charStart: caretInfo.wordStart,
      charEnd: caretInfo.wordEnd,
      carets: caretInfo.carets
    }
    : null;

  return { lines: traceLines, caret, displayLine, displayCol, resolvedPath };
};

const buildSourceTrace = (input: BuildSourceTraceInput): SourceTrace => {
  const {
    sourceContent = null,
    templatePath = null,
    lineno = null,
    colno = null,
    lineBase = null,
    sourceStartLine = 1,
    context = DEFAULT_CONTEXT,
    blockedKeys = null
  } = input;

  const location = toDisplayLocation(lineno, colno, lineBase);
  const displayLine = location.line;
  const displayCol = location.col;

  if (!sourceContent) {
    return { lines: [], caret: null, displayLine, displayCol, resolvedPath: templatePath };
  }

  return windowSourceTrace({
    content: sourceContent,
    displayLine,
    displayCol,
    sourceStartLine,
    context,
    resolvedPath: templatePath,
    blockedKeys
  });
};

export { windowSourceTrace, buildSourceTrace };
export type { SourceTraceLine, SourceTraceCaret, SourceTrace, BuildSourceTraceInput };
