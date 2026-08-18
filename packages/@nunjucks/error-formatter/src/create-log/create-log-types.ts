import type { ErrorSeverity, LineBase } from '@nunjucks/error-catalog';
import { TEMPLATE_ERROR } from '@nunjucks/error-catalog';
import type { Phase, UndefinedMode } from '@nunjucks/shared';

/**
 * Describes one catalog entry: a `name` code, a `message` template (string
 * with `{param}` placeholders or a params-consuming function), a `pattern` for
 * matching thrown messages, and optional causes, fix hints, and severity.
 */
interface ErrorDefinitionEntry {
  name: string;
  message: ((args?: Record<string, string> | string[]) => string) | string;
  pattern: RegExp;
  causes?: readonly string[];
  fixCode?: string;
  fixComment?: string;
  documentationUrl?: string;
  severity?: ErrorSeverity;
}

/** Optional per-error metadata (code, subject, location, phase) for errors and warnings. */
interface ErrorInfo {
  code?: string | null;
  subject?: string | null;
  phase?: Phase | null;
  templateName?: string | null;
  renderContext?: Record<string, unknown>;
  blockedKeys?: readonly string[];
  lineBase?: LineBase | null;
  dev?: boolean;
}

/** Extends `ErrorInfo` with the undefined-variable fields `varName` and `undefinedMode`. */
interface WarningInfo extends ErrorInfo {
  varName?: string | null;
  undefinedMode?: UndefinedMode;
}

/** Identifies a file in the caller's project for `SourceFileReader` lookups. */
interface ProjectSourceLocation {
  path: string;
  line: number | null;
  col: number | null;
}

/** Returns the source text and one-based position of a project file, or `null` when unreadable. */
interface ProjectSourceContent {
  sourceContent: string;
  templatePath: string;
  lineno: number;
  colno: number;
}

/** Loads project source for JS-originating stacks; `null` means no source attached. */
type SourceFileReader = (location: ProjectSourceLocation) => ProjectSourceContent | null;

/**
 * Shapes rendered error output: `format` selects `'html' | 'ansi' | 'text'`
 * (HTML is the default when omitted), `verbosity` and `dev` control detail,
 * and the source fields let callers override template source resolution.
 */
interface OutputOptions {
  format?: 'html' | 'ansi' | 'text';
  verbosity?: 'simple' | 'medium' | 'full';
  dev?: boolean;
  ide?: string;
  isProduction?: boolean;
  templatePath?: string;
  renderContext?: Record<string, unknown>;
  version?: string;
  timestamp?: string;
  sourceContent?: string;
  sourceStartLine?: number;
  snippet?: string;
  csp?: { nonce?: string };
  jsCaller?: string;
  jsCallerErrorLine?: number;
  isJsCaller?: boolean;
  humanTitle?: string;
  sourceFileReader?: SourceFileReader;
}

/**
 * Brands a normalized engine error: `name` is always `'Template render error'`,
 * the optional `[TEMPLATE_ERROR]` marker distinguishes it from plain `Error`s,
 * and location, catalog, and rendering fields are always `null` when unknown.
 */
interface TemplateError extends Error {
  name: 'Template render error';
  lineno: number | null;
  colno: number | null;
  code: string | null;
  subject: string | null;
  phase: Phase | null;
  templateName: string | null;
  templatePath: string | null;
  renderContext?: Record<string, unknown>;
  blockedKeys?: readonly string[];
  lineBase?: LineBase | null;
  sourceContent?: string;
  sourceStartLine?: number;
  causes?: string[];
  fixCode?: string | null;
  fixComment?: string | null;
  documentationUrl?: string | null;
  severity?: ErrorSeverity;
  path?: string | null;
  environment?: string | null;
  timestamp?: string | null;
  toJSON?: () => Record<string, unknown>;
  outputOptions?: Omit<OutputOptions, 'format'>;
  includeChain?: IncludeChain;
  [TEMPLATE_ERROR]?: boolean;
}

// WHY: colno adjustment also serves mid-stream callers whose errors are normalized plain
// Errors — catalog fields are optional there, so only the fields the adjustment reads are
// part of the contract (message arrives via Error).
/**
 * Narrows `Error` to just the fields `adjustColnoForNullValue` reads, so the
 * column adjustment also accepts normalized plain `Error`s from mid-stream
 * callers whose optional catalog fields may be absent.
 */
interface ColnoAdjustmentError extends Error {
  code?: string | null;
  sourceContent?: string;
  lineno?: number | null;
  colno?: number | null;
  lineBase?: LineBase | null;
}

/**
 * Data-only warning counterpart of `TemplateError`: a plain object (not an
 * `Error`) carrying message, location, and undefined-variable metadata, with
 * catalog fields always `null` when unknown.
 */
interface TemplateWarning {
  message: string;
  lineno: number | null;
  colno: number | null;
  varName: string | null;
  templateName: string | null;
  undefinedMode: UndefinedMode;
  code: string | null;
  subject: string | null;
  phase: Phase | null;
  lineBase?: LineBase | null;
  causes?: string[];
  fixCode?: string | null;
  fixComment?: string | null;
}

/**
 * Caller-supplied location and context for `createLog`; every field is
 * optional and null-tolerant, and `sourceContent`/`renderContext` degrade
 * to `null` rather than requiring string casts.
 */
interface ErrorContext {
  lineno?: number | null;
  colno?: number | null;
  phase?: Phase | null;
  templateName?: string | null;
  templatePath?: string | null;
  lineBase?: LineBase | null;
  // WHY: null-tolerant — normalizeErrorMetadata yields null when absent; requiring string
  // forced callers into a masking cast (handle-error.ts).
  sourceContent?: string | null;
  sourceStartLine?: number;
  timestamp?: string | null;
  environment?: string | null;
  renderContext?: Record<string, unknown> | null;
}

/** Extends `ErrorContext` with the undefined-variable fields only warnings consume. */
interface WarningContext extends ErrorContext {
  varName?: string | null;
  undefinedMode?: UndefinedMode | null;
}

/** Location/context shape after null-normalization; every field is resolved, never `undefined`. */
interface BaseContext {
  lineno: number | null;
  colno: number | null;
  phase: Phase | null;
  templateName: string | null;
  lineBase: LineBase | null;
  timestamp: string | null;
  environment: string | null;
}

/** Alias of `BaseContext` with no extra fields, named for call-site readability. */
interface NormalizedErrorContext extends BaseContext {}

/**
 * Warning-context shape after normalization: adds `varName` (resolved to
 * `null` when absent) and `undefinedMode` (defaulted to
 * `DEFAULT_UNDEFINED_MODE`).
 */
interface NormalizedWarningContext extends BaseContext {
  varName: string | null;
  undefinedMode: UndefinedMode;
}

/** Records where an include/import occurred in the parent template for nested-error reporting. */
interface IncludeChain {
  parentTmpl: string;
  parentLineno: number;
  parentColno?: number | null;
}

/** Options for `prettifyError`: error plus optional `path`, `includeChain`, `withInternals`. */
interface PrettifyErrorOptions {
  path?: string;
  withInternals?: boolean;
  err: Error | TemplateError;
  includeChain?: IncludeChain;
}

/**
 * Minimal payload for errors crossing the raw boundary (worker/renderer):
 * a required `message`, optional location, and an `info` object that is
 * narrowed per type rather than asserted against the full contract.
 */
interface RawLogData {
  message: string;
  lineno?: number | null;
  colno?: number | null;
  info?: ErrorInfo | WarningInfo;
}

/** Distinguishes `TemplateError` construction from `TemplateWarning` construction. */
type LogType = 'error' | 'warning';

export type {
  ErrorDefinitionEntry,
  ErrorInfo,
  WarningInfo,
  OutputOptions,
  ProjectSourceLocation,
  ProjectSourceContent,
  SourceFileReader,
  TemplateError,
  TemplateWarning,
  ErrorContext,
  WarningContext,
  IncludeChain,
  PrettifyErrorOptions,
  RawLogData,
  LogType,
  BaseContext,
  NormalizedErrorContext,
  NormalizedWarningContext,
  ColnoAdjustmentError,
};
export { TEMPLATE_ERROR };
