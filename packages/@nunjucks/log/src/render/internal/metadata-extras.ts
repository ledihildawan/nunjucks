import type { LineBase } from './location.ts';
import { windowSourceTrace } from './source-trace.ts';

export interface ErrorMetadata {
  code: string | null;
  subject: string | null;
  message: string;
  phase: string | null;
  templateName: string | null;
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number | null;
  lineno: number | null;
  colno: number | null;
  displayLine: number | null;
  displayCol: number | null;
  lineBase: LineBase | null;
  snippet: string | null;
  snippetLines: Array<{ number: number; content: string; isError: boolean }>;
  caret: { line: number; col: number; charStart: number; charEnd: number } | null;
  renderContext: Record<string, unknown> | null;
}

export interface GetErrorMetadataOptions {
  includeSource?: boolean;
  includeRenderContext?: boolean;
  snippetContext?: number;
}

interface ErrorLike {
  code?: string | null;
  subject?: string | null;
  message?: string;
  phase?: string | null;
  templateName?: string | null;
  templatePath?: string | null;
  sourceContent?: string | null;
  sourceStartLine?: number | null;
  lineno?: number | null;
  colno?: number | null;
  lineBase?: LineBase | null;
  renderContext?: Record<string, unknown>;
}

const readNumber = (value: unknown): number | null => {
  if (Number.isInteger(value)) {
    return value as number;
  }
  return null;
};

const toDisplayCoordinate = (value: number | null, lineBase: LineBase | null): number | null => {
  if (value === null) { return null; }
  if (lineBase === 'one') {
    return value;
  }
  return value + 1;
};

// Build the public ErrorMetadata shape (snippet text + lines + caret) from the
// shared source-trace windowing core, so getErrorMetadata can never drift from
// what the renderers produce. Synchronous — it only consumes inline
// sourceContent and never reads from disk.
const buildSnippet = (
  sourceContent: string | null,
  displayLine: number | null,
  displayCol: number | null,
  sourceStartLine: number,
  context: number
): { snippet: string | null; snippetLines: ErrorMetadata['snippetLines']; caret: ErrorMetadata['caret'] } => {
  if (!sourceContent || displayLine === null) {
    return { snippet: null, snippetLines: [], caret: null };
  }

  const trace = windowSourceTrace({
    content: sourceContent,
    displayLine,
    displayCol: displayCol ?? 0,
    sourceStartLine,
    context,
    resolvedPath: null
  });

  let caret: ErrorMetadata['caret'] = null;
  if (trace.caret) {
    caret = {
      line: trace.caret.line,
      col: displayCol ?? 0,
      charStart: trace.caret.charStart,
      charEnd: trace.caret.charEnd
    };
  }

  if (trace.lines.length === 0) {
    return { snippet: null, snippetLines: [], caret };
  }

  const lastLine = trace.lines.at(-1);
  const prefixWidth = String(lastLine?.number ?? 0).length;
  const snippet = trace.lines
    .map(line => ` ${String(line.number).padStart(prefixWidth, ' ')} | ${line.content}`)
    .join('\n');

  return { snippet, snippetLines: trace.lines, caret };
};

export const getErrorMetadata = (err: ErrorLike, options: GetErrorMetadataOptions = {}): ErrorMetadata => {
  const {
    includeSource = true,
    includeRenderContext = true,
    snippetContext = 2
  } = options;

  let lineBaseVal: 'one' | 'zero';
  if (err.lineBase === 'one') {
    lineBaseVal = 'one';
  } else {
    lineBaseVal = 'zero';
  }
  const lineBase = lineBaseVal as LineBase;
  const lineno = readNumber(err.lineno);
  const colno = readNumber(err.colno);
  const sourceStartLine = readNumber(err.sourceStartLine) ?? 1;
  let sourceContent: string | null;
  if (includeSource && typeof err.sourceContent === 'string') {
    sourceContent = err.sourceContent;
  } else {
    sourceContent = null;
  }
  const displayLine = toDisplayCoordinate(lineno, lineBase);
  const displayCol = toDisplayCoordinate(colno, lineBase);

  const { snippet, snippetLines, caret } = buildSnippet(
    sourceContent,
    displayLine,
    displayCol,
    sourceStartLine,
    Math.max(0, snippetContext)
  );

  return {
    code: err.code ?? null,
    subject: err.subject ?? null,
    message: err.message ?? '',
    phase: err.phase ?? null,
    templateName: err.templateName ?? null,
    templatePath: err.templatePath ?? null,
    sourceContent,
    sourceStartLine,
    lineno,
    colno,
    displayLine,
    displayCol,
    lineBase,
    snippet,
    snippetLines,
    caret,
    renderContext: (() => {
      if (includeRenderContext && err.renderContext && typeof err.renderContext === 'object') {
        return err.renderContext;
      }
      return null;
    })()
  };
};
