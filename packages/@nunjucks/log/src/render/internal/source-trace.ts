import type { LineBase } from './location.ts';
import { toDisplayLocation } from './location.ts';
import { calculateCaretPosition } from './caret.ts';

// A single line in the Source Trace window.
interface SourceTraceLine {
  // 1-based absolute line number, as shown in the gutter.
  number: number;
  // Raw source text of the line.
  content: string;
  // Whether this is the line the error points at.
  isError: boolean;
}

// The caret that highlights the offending token on the error line.
interface SourceTraceCaret {
  // 1-based absolute line the caret sits on (== the error line).
  line: number;
  // 0-based column where the caret run begins (the token start).
  charStart: number;
  // 0-based column where the caret run ends (exclusive).
  charEnd: number;
  // Pre-built run of '^' characters.
  carets: string;
}

// The fully-resolved source trace — the single source of truth that the HTML
// and ANSI presenters render from. Carries the windowed lines, the caret, and
// the 1-based display coordinates (for the location link).
interface SourceTrace {
  lines: SourceTraceLine[];
  caret: SourceTraceCaret | null;
  // 1-based display line (resolved from lineno + lineBase).
  displayLine: number;
  // 1-based display column.
  displayCol: number;
  // The file whose content was traced, if any (informational).
  resolvedPath: string | null;
}

interface BuildSourceTraceInput {
  sourceContent?: string | null;
  templatePath?: string | null;
  lineno?: number | null;
  colno?: number | null;
  lineBase?: LineBase | null;
  // 1-based number of sourceContent[0] (almost always 1).
  sourceStartLine?: number;
  // Number of context lines on each side of the error line.
  context?: number;
}

const DEFAULT_CONTEXT = 2;

// Pure windowing + caret core — no I/O. Given already-resolved source content
// and 1-based display coordinates, build the trace window and anchor the caret.
// Shared by buildSourceTrace (the caller resolves content upstream) and the
// synchronous getErrorMetadata (which only ever has inline content).
const windowSourceTrace = (params: {
  content: string;
  displayLine: number;
  displayCol: number;
  sourceStartLine: number;
  context: number;
  resolvedPath: string | null;
}): SourceTrace => {
  const { content, displayLine, displayCol, sourceStartLine, context, resolvedPath } = params;

  const lines = content.split('\n');
  // displayLine is the absolute 1-based line and sourceStartLine is the 1-based
  // number of content[0], so the 0-based index is displayLine - sourceStartLine.
  // (Using the raw lineno here was the off-by-one that used to highlight the
  // line above for any error past line 1.)
  const errorIndex = displayLine - sourceStartLine;
  if (errorIndex < 0 || errorIndex >= lines.length) {
    return { lines: [], caret: null, displayLine, displayCol, resolvedPath };
  }

  const ctx = Math.max(0, context);
  const start = Math.max(0, errorIndex - ctx);
  const end = Math.min(lines.length, errorIndex + ctx + 1);

  const traceLines: SourceTraceLine[] = Array.from({ length: end - start }, (_, offset) => {
    const i = start + offset;
    return {
      number: sourceStartLine + i,
      content: lines[i] ?? '',
      isError: i === errorIndex
    };
  });

  const caretInfo = displayCol > 0 ? calculateCaretPosition(lines[errorIndex] ?? '', displayCol) : null;
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

// The canonical "resolved location -> debug trace" computation. Called once per
// error render and shared by every presenter (HTML, ANSI, text metadata), so
// the line-math / windowing / caret logic lives in exactly one place.
//
// Synchronous by design: the source content is resolved upstream by the async
// error-creation pipeline (wrapWithLog -> resolveLocation reads from disk), so
// by the time the trace is built the content is already in hand and no I/O is
// needed here.
const buildSourceTrace = (input: BuildSourceTraceInput): SourceTrace => {
  const {
    sourceContent = null,
    templatePath = null,
    lineno = null,
    colno = null,
    lineBase = null,
    sourceStartLine = 1,
    context = DEFAULT_CONTEXT
  } = input;

  // 1. Resolve 1-based display coordinates (always, even without source — the
  //    renderers use these for the location link).
  const location = toDisplayLocation(lineno, colno, lineBase);
  const displayLine = location.line;
  const displayCol = location.col;

  // 2. No source content -> no window. Callers that need a file read must
  //    populate sourceContent before calling (done in wrapWithLog).
  if (!sourceContent) {
    return { lines: [], caret: null, displayLine, displayCol, resolvedPath: templatePath };
  }

  // 3. Window + caret (shared pure core).
  return windowSourceTrace({
    content: sourceContent,
    displayLine,
    displayCol,
    sourceStartLine,
    context,
    resolvedPath: templatePath
  });
};

export { windowSourceTrace, buildSourceTrace };
export type { SourceTraceLine, SourceTraceCaret, SourceTrace, BuildSourceTraceInput };
