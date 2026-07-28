/**
 * Inputs that influence error location resolution.
 *
 * Each field is optional; the resolver merges them according to the
 * precedence rules documented at the top of this file.
 */
interface LocationInputs {
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
interface ResolvedLocation {
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

export type { LocationInputs, ResolvedLocation, SourcePosition, TemplateMatch };
