// CENTRALIZED ERROR LOCATION RESOLUTION
//
// Single source of truth for "where did this error occur?".
// Replaces the duplicated logic previously spread across:
//
//   - packages/@nunjucks/log/src/diagnostics.ts (resolveErrorLocation, now removed)
//   - packages/@nunjucks/core/src/core/render.ts (caller detection setup)
//   - packages/@nunjucks/runtime/src/helpers.ts (handleError re-wrap)
//
// ## Precedence Order (high to low)
//
// 1. **Caller file location** (`jsCaller` or auto-detected inline caller)
//    When the error happened in an inline template string, look for the
//    template literal in the JS caller source and translate the
//    template-internal (line, col) into the caller's (line, col).
//
// 2. **Caller line fallback** (`_callerLocation`)
//    If we cannot find the template in the caller (multiline strings,
//    source map mismatches), use the caller's raw line/col from V8 stack.
//
// 3. **Template coords** (`errLineno` / `errColno`)
//    The 0-based line/col within the template itself. Used when there is
//    no caller info (loaded templates from disk, etc.).
//
// 4. **Explicit config** (`config.lineno` / `config.colno`)
//    Manual override from the config object.
//
// 5. **Null fallback**
//    When nothing is known, both are `null` and the caller decides what
//    to render.
//
// `lineBase` follows the location that won:
//   - Caller-derived locations are always `one`-based (V8 is 1-based).
//   - Template-coords locations are always `zero`-based (matching AST).

import { readFile } from 'node:fs/promises';

/**
 * Inputs that influence error location resolution.
 *
 * Each field is optional; the resolver merges them according to the
 * precedence rules documented at the top of this file.
 */
export interface LocationInputs {
  /** Template source (for inline templates), used to find it in caller. */
  template?: string | null;
  /** Path to the template file (if loaded from disk). */
  templatePath?: string | null;
  /** JS caller file (explicit override). */
  jsCaller?: string | null;
  /** Line in the JS caller file (explicit override). */
  jsCallerErrorLine?: number | null;
  /** Column in the JS caller file (explicit override). */
  jsCallerErrorCol?: number | null;
  /** JS caller file (auto-detected from V8 stack). */
  _callerFile?: string | null;
  /** JS caller location (auto-detected from V8 stack). */
  _callerLocation?: { lineNumber?: number | null; columnNumber?: number | null } | null;
  /** Line in the template where the error was thrown (0-based). */
  errLineno?: number | null;
  /** Column in the template where the error was thrown (0-based). */
  errColno?: number | null;
  /**
   * Coordinate system of `errLineno`/`errColno`. If `'one'`, the values
   * already point at the caller and should NOT be re-derived.
   */
  errLineBase?: 'zero' | 'one' | null;
  /** Explicit fallback line. */
  lineno?: number | null;
  /** Explicit fallback column. */
  colno?: number | null;
  /** Subject (variable name, etc.) used to refine the lookup. */
  subject?: string | null;
}

/**
 * Output of `resolveLocation`.
 *
 * Every field is meaningful and the caller can use it directly without
 * needing to know which precedence tier produced it.
 */
export interface ResolvedLocation {
  /** Final line to report (1-based when preferCallerLocation, else 0-based). */
  lineno: number | null;
  /** Final column to report (1-based when preferCallerLocation, else 0-based). */
  colno: number | null;
  /** Coordinate system: `'one'` for caller-derived, `'zero'` for template. */
  lineBase: 'zero' | 'one';
  /** The path that owns `lineno`/`colno` (a .ts file for caller, the template name otherwise). */
  templatePath: string | null;
  /** The full source of `templatePath` (used to render the snippet). */
  sourceContent: string | null;
  /** First line number in `sourceContent` (usually 1; >1 when a window is shown). */
  sourceStartLine: number;
  /** Whether the location was derived from the JS caller. */
  preferCallerLocation: boolean;
}

interface SourcePosition {
  line: number;
  col: number;
}

interface TemplateMatch {
  index: number;
  template: string;
}

/**
 * Find the best occurrence of `templateHint` in `content` near `preferredLine`.
 *
 * This is the single algorithm used to locate an inline template inside the
 * caller source. Replaces the two parallel algorithms previously living in
 * `render.ts` (the `_autoCallerLocation` heuristic) and `diagnostics.ts`
 * (`findTemplateOccurrence`).
 *
 * - For single-line templates, we search the entire content and prefer the
 *   occurrence closest to `preferredLine`.
 * - For multi-line templates, we additionally try the `\r\n` variant.
 */
const findTemplateOccurrence = (
  content: string,
  templateHint: string,
  preferredLine: number | null
): TemplateMatch | null => {
  let best = -1;
  let bestTemplate = templateHint;
  let bestDistance = Number.POSITIVE_INFINITY;
  const candidates: string[] = templateHint.includes('\n')
    ? [templateHint, templateHint.replace(/\n/g, '\r\n')]
    : [templateHint];

  for (const candidate of candidates) {
    let searchFrom = 0;
    while (true) {
      const found = content.indexOf(candidate, searchFrom);
      if (found === -1) { break; }
      const line = positionAtOffset(content, found).lineOffset + 1;
      const distance = preferredLine === null || preferredLine === undefined
        ? 0
        : Math.abs(line - preferredLine);
      if (distance < bestDistance) {
        best = found;
        bestTemplate = candidate;
        bestDistance = distance;
      }
      searchFrom = found + 1;
    }
  }

  return best === -1 ? null : { index: best, template: bestTemplate };
};

/**
 * Convert a byte offset into `{lineOffset, col}`, both 0-based.
 */
const positionAtOffset = (text: string, offset: number): { lineOffset: number; col: number } => {
  const before = text.slice(0, offset);
  const parts = before.split('\n');
  return {
    lineOffset: parts.length - 1,
    col: (parts.at(-1)?.length ?? 0)
  };
};

/**
 * Compute the byte offset within a template that corresponds to
 * (templateErrorLine, templateErrorCol). Both inputs are 0-based.
 */
const templateLocationOffset = (
  template: string,
  templateErrorLine: number | null,
  templateErrorCol: number | null
): number => {
  const templateLines = template.split('\n');
  const line = templateErrorLine ?? 0;
  const col = templateErrorCol ?? 0;
  const clampedLine = Math.max(0, Math.min(line, templateLines.length - 1));
  let offset = 0;
  for (let i = 0; i < clampedLine; i++) {
    offset += (templateLines[i]?.length ?? 0) + 1;
  }
  return offset + Math.max(0, Math.min(col, templateLines[clampedLine]?.length ?? 0));
};

/**
 * Validate that (templateErrorLine, templateErrorCol) is a real position
 * inside `template`. Returns false if any input is missing/invalid.
 */
const isCoordinateWithinTemplate = (
  template: string,
  templateErrorLine: number | null,
  templateErrorCol: number | null
): boolean => {
  if (!Number.isInteger(templateErrorLine) || !Number.isInteger(templateErrorCol)) {
    return false;
  }
  const templateLines = template.split('\n');
  const line = templateErrorLine as number;
  const col = templateErrorCol as number;
  if (line < 0 || line >= templateLines.length) {
    return false;
  }
  const targetLine = templateLines[line] ?? '';
  return col >= 0 && col <= targetLine.length;
};

/**
 * Resolve (line, col) within the template into (line, col) within the
 * caller source. Returns null if the template cannot be found in the caller.
 */
const matchTemplateInCaller = (
  content: string,
  templateHint: string,
  templateErrorLine: number | null,
  templateErrorCol: number | null,
  preferredLine: number | null
): SourcePosition | null => {
  if (!isCoordinateWithinTemplate(templateHint, templateErrorLine, templateErrorCol)) {
    return null;
  }
  const match = findTemplateOccurrence(content, templateHint, preferredLine);
  if (!match) { return null; }
  const targetOffset = match.index + templateLocationOffset(match.template, templateErrorLine, templateErrorCol);
  const pos = positionAtOffset(content, targetOffset);
  return { line: pos.lineOffset + 1, col: pos.col + 1 };
};

/**
 * Try to find the subject (e.g. "product.name") in the caller content
 * near `preferredLine`. Used as a fallback when we can't find the template
 * literal itself.
 */
const findSubjectOccurrence = (
  content: string,
  subject: string | null,
  preferredLine: number | null
): SourcePosition | null => {
  if (!subject || typeof subject !== 'string') { return null; }
  let best: SourcePosition | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let subjectColOffset = subject.includes('.') ? subject.lastIndexOf('.') + 1 : 0;
  const escaped = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns: Array<{ re: RegExp; group: number }> = [
    { re: new RegExp(`'(${escaped})'`, 'g'), group: 1 },
    { re: new RegExp(`"(${escaped})"`, 'g'), group: 1 },
    { re: new RegExp(`\\b(${escaped})\\b`, 'g'), group: 1 }
  ];

  for (const { re, group } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const groupText = match[group];
      if (!groupText) { continue; }
      const groupOffset = match[0].indexOf(groupText);
      if (groupOffset < 0) { continue; }
      const offset = match.index + groupOffset + subjectColOffset;
      const pos = positionAtOffset(content, offset);
      const line = pos.lineOffset + 1;
      const col = pos.col + 1;
      const distance = preferredLine === null || preferredLine === undefined
        ? 0
        : Math.abs(line - preferredLine);
      if (distance < bestDistance) {
        best = { line, col };
        bestDistance = distance;
      }
    }
  }
  return best;
};

/**
 * Compute the position of the last meaningful (non-whitespace) character in a
 * template. Used as an anchor for errors that carry no position of their own —
 * most notably parser "unexpected end of input" errors, where the parser ran
 * off the end of the template and reports null line/col. Pointing at the end of
 * the template literal is far more useful than falling back to the `render(`
 * call site. Both returned values are 0-based.
 */
const templateEndPosition = (template: string): SourcePosition => {
  const trimmed = template.replace(/\s+$/u, '');
  const lines = trimmed.split('\n');
  const line = Math.max(0, lines.length - 1);
  const lastLine = lines[line] ?? '';
  const col = Math.max(0, lastLine.length - 1);
  return { line, col };
};

/**
 * Try to extract the actual position of the template within the caller.
 *
 * Strategy:
 *   1. Match the template literal verbatim (preferred).
 *   2. If that fails (or template is non-string like a number), match by subject.
 *   3. If subject match fails, try matching by `String(template)` for the
 *      legacy edge case where `template` is something like `123` and we
 *      want to point at that literal in the caller.
 *   4. If all fail, return null and let the caller fall back to raw line/col.
 */
const extractCallerPosition = (
  content: string,
  template: string | null,
  errLineno: number | null,
  errColno: number | null,
  subject: string | null,
  preferredLine: number | null
): SourcePosition | null => {
  // 1. Exact match: the error carries a valid coordinate inside the template,
  //    so map that coordinate into the caller source.
  if (typeof template === 'string') {
    const matched = matchTemplateInCaller(content, template, errLineno, errColno, preferredLine);
    if (matched) { return matched; }
  }
  // 2. Subject wins for positionless errors that name one — a reserved filter
  //    name ('if'), a config key ('executionTimeout'), etc. These have no
  //    in-template coordinate, and the subject token in the caller is far more
  //    useful than the template body. Tried before the template-end anchor so
  //    it is not preempted by it.
  if (subject) {
    const bySubject = findSubjectOccurrence(content, subject, preferredLine);
    if (bySubject) { return bySubject; }
  }
  // 3. Parser end-of-input and other positionless, subject-less errors carry
  //    no valid coordinate within the template. Rather than falling through to
  //    the raw `render(` call site, anchor at the end of the template literal
  //    itself, which is where "unexpected end of input" logically occurred.
  if (
    typeof template === 'string' &&
    template.length > 0 &&
    !isCoordinateWithinTemplate(template, errLineno, errColno)
  ) {
    const end = templateEndPosition(template);
    const atEnd = matchTemplateInCaller(content, template, end.line, end.col, preferredLine);
    if (atEnd) { return atEnd; }
  }
  // Legacy fallback: non-string template arguments — numbers (render(123)),
  // booleans, and null/undefined (render(null), render(undefined)). Locate the
  // literal token in the caller source via its string form. null/undefined were
  // previously excluded, which made render(null) fall back to the raw V8 caller
  // line/col and point at the `render(` call site (often whitespace) instead of
  // the offending `null` argument.
  if (typeof template !== 'string') {
    const literal = template === null ? 'null' : template === undefined ? 'undefined' : String(template);
    const byValue = findSubjectOccurrence(content, literal, preferredLine);
    if (byValue) { return byValue; }
  }
  return null;
};

/**
 * CENTRAL API: resolve the final error location.
 *
 * Returns a fully-populated `ResolvedLocation` so the caller never has to
 * re-derive precedence. See the precedence table at the top of this file.
 */
export const resolveLocation = async (inputs: LocationInputs): Promise<ResolvedLocation> => {
  const {
    template = null,
    templatePath = null,
    jsCaller = null,
    jsCallerErrorLine = null,
    jsCallerErrorCol = null,
    _callerFile = null,
    _callerLocation = null,
    errLineno = null,
    errColno = null,
    lineno: configLineno = null,
    colno: configColno = null,
    subject = null,
    errLineBase = null
  } = inputs;

  const hasErrorLocation = errLineno !== undefined && errLineno !== null;
  // When `errLineBase === 'one'`, the errLineno/errColno already point at
  // the caller (1-based). We must NOT re-derive them from V8 stack or the
  // template literal — they are authoritative.
  const hasCallerLocation = hasErrorLocation && errLineBase === 'one';

  const useExplicitCaller = jsCaller !== null && jsCaller !== undefined && jsCallerErrorLine !== null && jsCallerErrorLine !== undefined;
  const useAutoCaller =
    !templatePath &&
    jsCaller === null &&
    _callerFile !== null &&
    _callerFile !== undefined &&
    _callerFile !== 'unknown' &&
    _callerLocation !== null &&
    _callerLocation !== undefined;
  const preferCallerLocation = !templatePath && (useExplicitCaller || useAutoCaller);
  const activeCaller = jsCaller ?? (useAutoCaller ? _callerFile ?? null : null);
  const activeCallerLine = useExplicitCaller
    ? jsCallerErrorLine
    : useAutoCaller
      ? _callerLocation?.lineNumber ?? null
      : null;
  const activeCallerCol = useExplicitCaller
    ? jsCallerErrorCol
    : useAutoCaller
      ? _callerLocation?.columnNumber ?? null
      : null;

  let finalPath: string | null;
  if (preferCallerLocation) {
    finalPath = activeCaller ?? templatePath ?? null;
  } else {
    finalPath = templatePath ?? _callerFile ?? null;
  }

  let sourceContent: string | null = template;
  let sourceStartLine = 1;
  // Start with the raw caller coordinates. If `hasCallerLocation`, the
  // errLineno/errColno (already caller-derived) take precedence over V8.
  let resolvedCallerLine: number | null = hasCallerLocation ? errLineno : activeCallerLine;
  let resolvedCallerCol: number | null = hasCallerLocation ? errColno : activeCallerCol;

  if (preferCallerLocation && activeCaller && !hasCallerLocation) {
    const fileContent = await tryReadFile(activeCaller);
    if (fileContent !== null) {
      const position = extractCallerPosition(
        fileContent,
        template,
        errLineno,
        errColno,
        subject,
        activeCallerLine
      );
      if (position) {
        sourceContent = fileContent;
        sourceStartLine = 1;
        resolvedCallerLine = position.line;
        resolvedCallerCol = position.col;
      }
    }
  }

  let lineno: number | null;
  let colno: number | null;
  let lineBase: 'zero' | 'one';

  if (preferCallerLocation) {
    lineno = resolvedCallerLine ?? configLineno ?? errLineno ?? null;
    colno = resolvedCallerCol ?? configColno ?? errColno ?? null;
    lineBase = 'one';
  } else if (hasErrorLocation && errLineno !== null) {
    lineno = errLineno;
    colno = errColno;
    lineBase = 'zero';
  } else {
    lineno = configLineno;
    colno = configColno;
    lineBase = 'zero';
  }

  return {
    lineno,
    colno,
    lineBase,
    templatePath: finalPath,
    sourceContent,
    sourceStartLine,
    preferCallerLocation
  };
};

const tryReadFile = async (path: string): Promise<string | null> => {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
};