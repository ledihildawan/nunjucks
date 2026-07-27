import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const SCRIPT_EXTENSION_RE = /\.(?:[cm]?[jt]sx?|mjs|cjs)$/iu;
const READABLE_EXTENSION_RE = /\.(?:[cm]?[jt]sx?|mjs|cjs|njk|nunjucks|html?|tmpl|tpl)$/iu;
const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[/\\]/u;
const FORWARD_SLASH_RE = /\//gu;
const RELATIVE_PREFIX_RE = /^\.\.?[/\\]/u;

// Paths we treat as JS/TS callers (inline render() calls).
const isScriptPath = (filePath?: string | null): boolean =>
  SCRIPT_EXTENSION_RE.test(filePath || '');

// Paths whose contents we are willing to read from disk for the trace.
const isReadablePath = (filePath?: string | null): boolean =>
  READABLE_EXTENSION_RE.test(filePath || '');

// Normalize a templatePath into an absolute filesystem path, or null when it
// does not look like a real file location (e.g. 'inline' or a bare name).
const resolveFilePath = (templatePath: string): string | null => {
  if (templatePath.startsWith('file://')) {
    return fileURLToPath(templatePath);
  }
  if (WINDOWS_DRIVE_RE.test(templatePath) || templatePath.startsWith('/')) {
    return templatePath.replace(FORWARD_SLASH_RE, '\\');
  }
  if (RELATIVE_PREFIX_RE.test(templatePath) || isReadablePath(templatePath)) {
    return resolve(templatePath);
  }
  return null;
};

interface ResolvedSource {
  content: string | null;
  resolvedPath: string | null;
}

// Consolidated source-content resolution. Merges the former to-html and to-ansi
// file-read branches into one place. The deciding signal is lineBase:
//   - 'one'  => the lineno is a CALLER coordinate (an inline render() call in a
//               script). sourceContent is then the inline template string,
//               which the caller lineno does NOT index into — so we must read
//               the caller file to window around the error.
//   - 'zero' => the lineno is a TEMPLATE coordinate. sourceContent is the
//               template body (or templatePath is the .njk file); window that.
// Rules:
//   1. Caller-coord error pointing at a script file -> read the full caller file.
//   2. Else if sourceContent is present -> use it verbatim (template body).
//   3. Else if templatePath is a readable file -> read it from disk.
//   4. Else -> no source available.
const tryReadFile = async (filePath: string | null): Promise<{ content: string | null; resolvedPath: string | null }> => {
  if (!filePath) { return { content: null, resolvedPath: null }; }
  const resolved = resolveFilePath(filePath);
  if (!resolved) { return { content: null, resolvedPath: null }; }
  try {
    const content = await readFile(resolved, 'utf-8');
    return { content, resolvedPath: resolved };
  } catch {
    return { content: null, resolvedPath: null };
  }
};

const resolveSourceContent = async (
  sourceContent: string | null,
  templatePath: string | null,
  lineBase: LineBase | null
): Promise<ResolvedSource> => {
  if (sourceContent) {
    return { content: sourceContent, resolvedPath: templatePath };
  }

  const isCallerCoord = lineBase === 'one';
  const isScript = templatePath !== null && isScriptPath(templatePath);

  if (isCallerCoord && isScript) {
    const result = await tryReadFile(templatePath);
    if (result.content) { return result; }
  }

  if (templatePath && isReadablePath(templatePath)) {
    return await tryReadFile(templatePath);
  }

  return { content: null, resolvedPath: null };
};

// Pure windowing + caret core — no I/O. Given already-resolved source content
// and 1-based display coordinates, build the trace window and anchor the caret.
// Shared by the async buildSourceTrace (after it resolves content from disk)
// and the synchronous getErrorMetadata (which only ever has inline content).
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

  const traceLines: SourceTraceLine[] = [];
  for (let i = start; i < end; i += 1) {
    traceLines.push({
      number: sourceStartLine + i,
      content: lines[i] ?? '',
      isError: i === errorIndex
    });
  }

  // Anchor the caret on the offending token (word-snap, shared with HTML).
  let caret: SourceTraceCaret | null = null;
  if (displayCol > 0) {
    const caretInfo = calculateCaretPosition(lines[errorIndex] ?? '', displayCol);
    if (caretInfo) {
      caret = {
        line: displayLine,
        charStart: caretInfo.wordStart,
        charEnd: caretInfo.wordEnd,
        carets: caretInfo.carets
      };
    }
  }

  return { lines: traceLines, caret, displayLine, displayCol, resolvedPath };
};

// The canonical "resolved location -> debug trace" computation. Called once per
// error render and shared by every presenter (HTML, ANSI, text metadata), so
// the line-math / windowing / caret logic lives in exactly one place.
const buildSourceTrace = async (input: BuildSourceTraceInput): Promise<SourceTrace> => {
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

  // 2. Resolve the source content to window around (may read from disk).
  const { content, resolvedPath } = await resolveSourceContent(sourceContent, templatePath, lineBase);
  if (!content) {
    return { lines: [], caret: null, displayLine, displayCol, resolvedPath };
  }

  // 3. Window + caret (shared pure core).
  return windowSourceTrace({
    content,
    displayLine,
    displayCol,
    sourceStartLine,
    context,
    resolvedPath
  });
};

export { resolveSourceContent, windowSourceTrace, buildSourceTrace };
export type { SourceTraceLine, SourceTraceCaret, SourceTrace, BuildSourceTraceInput, ResolvedSource };
