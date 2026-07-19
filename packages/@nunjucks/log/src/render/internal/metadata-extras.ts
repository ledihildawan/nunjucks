import type { LineBase } from './location.ts';
import { calculateCaretPosition } from './caret.ts';

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

const readNumber = (value: unknown): number | null => Number.isInteger(value) ? (value as number) : null;

const toDisplayCoordinate = (value: number | null, lineBase: LineBase | null): number | null => {
  if (value === null) return null;
  return lineBase === 'one' ? value : value + 1;
};

const buildSnippet = (
  sourceContent: string | null,
  lineno: number | null,
  displayCol: number | null,
  displayLine: number | null,
  sourceStartLine: number,
  context: number
): { snippet: string | null; snippetLines: Array<{ number: number; content: string; isError: boolean }>; caret: ErrorMetadata['caret'] } => {
  if (!sourceContent || lineno === null) {
    return { snippet: null, snippetLines: [], caret: null };
  }

  const lines = sourceContent.split('\n');
  const errorIndex = lineno - sourceStartLine;
  if (errorIndex < 0 || errorIndex >= lines.length) {
    return { snippet: null, snippetLines: [], caret: null };
  }

  const start = Math.max(0, errorIndex - context);
  const end = Math.min(lines.length, errorIndex + context + 1);

  const snippetLines: ErrorMetadata['snippetLines'] = [];
  for (let i = start; i < end; i++) {
    snippetLines.push({
      number: sourceStartLine + i,
      content: lines[i] ?? '',
      isError: i === errorIndex
    });
  }

  const prefixWidth = String(sourceStartLine + end - 1).length;
  const snippet = snippetLines
    .map(line => {
      const numberLabel = String(line.number).padStart(prefixWidth, ' ');
      const marker = line.isError ? '>' : ' ';
      return ` ${numberLabel} | ${line.content}`;
    })
    .join('\n');

  let caret: ErrorMetadata['caret'] = null;
  if (displayCol !== null && displayCol > 0) {
    const caretInfo = calculateCaretPosition(lines[errorIndex] ?? '', displayCol);
    if (caretInfo) {
      caret = {
        line: displayLine ?? lineno,
        col: displayCol,
        charStart: caretInfo.wordStart,
        charEnd: caretInfo.wordEnd
      };
    }
  }

  return { snippet, snippetLines, caret };
};

export const getErrorMetadata = (err: ErrorLike, options: GetErrorMetadataOptions = {}): ErrorMetadata => {
  const {
    includeSource = true,
    includeRenderContext = true,
    snippetContext = 2
  } = options;

  const lineBase = (err.lineBase === 'one' ? 'one' : 'zero') as LineBase;
  const lineno = readNumber(err.lineno);
  const colno = readNumber(err.colno);
  const sourceStartLine = readNumber(err.sourceStartLine) ?? 1;
  const sourceContent = includeSource && typeof err.sourceContent === 'string'
    ? err.sourceContent
    : null;
  const displayLine = toDisplayCoordinate(lineno, lineBase);
  const displayCol = toDisplayCoordinate(colno, lineBase);

  const { snippet, snippetLines, caret } = buildSnippet(
    sourceContent,
    lineno,
    displayCol,
    displayLine,
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
    renderContext: includeRenderContext && err.renderContext && typeof err.renderContext === 'object'
      ? err.renderContext
      : null
  };
};

export const formatSnippet = (err: ErrorLike, options: Omit<GetErrorMetadataOptions, 'includeRenderContext'> = {}): string | null => {
  const meta = getErrorMetadata(err, { ...options, includeRenderContext: false });
  return meta.snippet;
};
