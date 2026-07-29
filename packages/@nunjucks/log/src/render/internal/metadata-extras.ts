import type { LineBase } from './location.ts';
import { windowSourceTrace } from './source-trace.ts';
import { readNumber } from './normalize.ts';
import { pipe, map, join } from 'remeda';

interface ErrorMetadata {
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

interface GetErrorMetadataOptions {
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
interface SnippetRequest {
  sourceContent: string | null;
  displayLine: number | null;
  displayCol: number | null;
  sourceStartLine: number;
  context: number;
}

interface SnippetResult {
  snippet: string | null;
  snippetLines: ErrorMetadata['snippetLines'];
  caret: ErrorMetadata['caret'];
}

const buildSnippet = ({
  sourceContent,
  displayLine,
  displayCol,
  sourceStartLine,
  context,
}: SnippetRequest): SnippetResult => {
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
  const snippet = pipe(
    trace.lines,
    map(line => ` ${String(line.number).padStart(prefixWidth, ' ')} | ${line.content}`),
    join('\n')
  );

  return { snippet, snippetLines: trace.lines, caret };
};

const buildErrorMetadataResult = (
  err: ErrorLike,
  lineBase: LineBase,
  lineno: number | null,
  colno: number | null,
  sourceContent: string | null,
  sourceStartLine: number,
  snippet: string | null,
  snippetLines: ErrorMetadata['snippetLines'],
  caret: ErrorMetadata['caret'],
  renderContext: Record<string, unknown> | null
): ErrorMetadata => ({
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
  displayLine: toDisplayCoordinate(lineno, lineBase),
  displayCol: toDisplayCoordinate(colno, lineBase),
  lineBase,
  snippet,
  snippetLines,
  caret,
  renderContext,
});

const getErrorMetadata = (err: ErrorLike, options: GetErrorMetadataOptions = {}): ErrorMetadata => {
  const { includeSource = true, includeRenderContext = true, snippetContext = 2 } = options;
  const lineBase = (err.lineBase === 'one' ? 'one' : 'zero') as LineBase;
  const lineno = readNumber(err.lineno);
  const colno = readNumber(err.colno);
  const sourceStartLine = readNumber(err.sourceStartLine) ?? 1;
  const rawSource = err.sourceContent;
  const sourceContent = includeSource && typeof rawSource === 'string' ? rawSource : null;

  const { snippet, snippetLines, caret } = buildSnippet({
    sourceContent,
    displayLine: toDisplayCoordinate(lineno, lineBase),
    displayCol: toDisplayCoordinate(colno, lineBase),
    sourceStartLine,
    context: Math.max(0, snippetContext),
  });

  const renderContext = includeRenderContext && err.renderContext && typeof err.renderContext === 'object'
    ? err.renderContext
    : null;

  return buildErrorMetadataResult(err, lineBase, lineno, colno, sourceContent, sourceStartLine, snippet, snippetLines, caret, renderContext);
};

export { getErrorMetadata };
export type { ErrorMetadata, GetErrorMetadataOptions };
