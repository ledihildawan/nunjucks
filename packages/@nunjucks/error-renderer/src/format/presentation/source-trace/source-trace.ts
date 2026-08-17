import type { LineBase } from '@nunjucks/error-catalog';
import { escapeRegex } from '@nunjucks/lib';
import { calculateCaretPosition } from '../syntax-highlight/caret.ts';
import { toDisplayLocation } from './location.ts';

const buildSecretValuePattern = (blockedKeys: readonly string[] | null): RegExp | null => {
  if (!blockedKeys || blockedKeys.length === 0) {
    return null;
  }
  const cleaned = blockedKeys.filter((k): k is string => typeof k === 'string' && k.length > 0);
  if (cleaned.length === 0) {
    return null;
  }
  const alternation = cleaned.map(escapeRegex).join('|');
  return new RegExp(
    `\\b(${alternation})(\\s*[:=]\\s*)(['"])([^'"\\\\]*(?:\\\\.[^'"\\\\]*)*)\\3`,
    'giu'
  );
};

const redactSecretValues = (line: string, blockedKeys: readonly string[] | null): string => {
  const pattern = buildSecretValuePattern(blockedKeys);
  if (!pattern) {
    return line;
  }
  return line.replaceAll(
    pattern,
    (_match, key, sep, quote) => `${key}${sep}${quote}[Redacted]${quote}`
  );
};

/** A single line of a source trace: 1-based `number`, redacted `content`, error flag. */
interface SourceTraceLine {
  number: number;
  content: string;
  isError: boolean;
}

/** Caret underline for the offending token: 0-based char offsets and the `carets` string. */
interface SourceTraceCaret {
  line: number;
  charStart: number;
  charEnd: number;
  carets: string;
}

/**
 * A windowed, redacted view of template source around an error: numbered lines, an
 * optional caret, and the resolved 1-based display coordinates and path. Empty `lines`
 * means no source was available or the line fell outside the window.
 */
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
  const { content, displayLine, displayCol, sourceStartLine, context, resolvedPath, blockedKeys } =
    params;

  const lines = content.split('\n');
  const errorIndex = displayLine - sourceStartLine;
  if (errorIndex < 0 || errorIndex >= lines.length) {
    return { lines: [], caret: null, displayLine, displayCol, resolvedPath };
  }

  const contextWindow = Math.max(0, context);
  const start = Math.max(0, errorIndex - contextWindow);
  const end = Math.min(lines.length, errorIndex + contextWindow + 1);

  const traceLines: SourceTraceLine[] = Array.from({ length: end - start }, (_, offset) => {
    const index = start + offset;
    const rawLine = lines[index] ?? '';
    return {
      number: sourceStartLine + index,
      content: redactSecretValues(rawLine, blockedKeys),
      isError: index === errorIndex,
    };
  });

  const errorLineContent = redactSecretValues(lines[errorIndex] ?? '', blockedKeys);
  const caretInfo = displayCol > 0 ? calculateCaretPosition(errorLineContent, displayCol) : null;
  const caret: SourceTraceCaret | null = caretInfo
    ? {
        line: displayLine,
        charStart: caretInfo.wordStart,
        charEnd: caretInfo.wordEnd,
        carets: caretInfo.carets,
      }
    : null;

  return { lines: traceLines, caret, displayLine, displayCol, resolvedPath };
};

/**
 * Builds a source trace around the error location: converts coordinates to 1-based,
 * windows `context` lines around the error, redacts blocked-key values in place, and
 * computes a caret underline from the display column. Missing source yields empty
 * `lines` with coordinates preserved.
 */
const buildSourceTrace = (input: BuildSourceTraceInput): SourceTrace => {
  const {
    sourceContent = null,
    templatePath = null,
    lineno = null,
    colno = null,
    lineBase = null,
    sourceStartLine = 1,
    context = DEFAULT_CONTEXT,
    blockedKeys = null,
  } = input;

  const location = toDisplayLocation({ lineno, colno, lineBase });
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
    blockedKeys,
  });
};

export type { BuildSourceTraceInput, SourceTrace, SourceTraceCaret, SourceTraceLine };
export { buildSourceTrace };
