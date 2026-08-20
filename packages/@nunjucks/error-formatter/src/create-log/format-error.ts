// WHY: this module is the ONLY renderer-coupled part of error-formatter, exposed via
// the `@nunjucks/error-formatter/format` subpath — NOT the root barrel. Keeping it out
// of the barrel means every domain package importing `createLog` (lexer, parser,
// compiler, runtime, filters, validators) loads zero presentation code (ANSI/HTML
// rendering, picocolors) in its import closure.
import { classifyAndBuildTitle } from '@nunjucks/error-catalog';
import {
  toAnsi,
  toText,
  toHtml,
  createFormatterState,
  buildSourceTrace,
  parseStackFrame,
  type SourceTrace,
} from '@nunjucks/error-renderer';
import type { ProjectSourceContent, SourceFileReader } from './create-log-types.ts';
import { normalizeLineBase, type LineBase } from '@nunjucks/error-catalog';
import type { TemplateError, TemplateWarning, OutputOptions } from './create-log-types.ts';
import { adjustColnoForNullValue } from './adjust-colno.ts';

const isTemplateError = (log: TemplateError | TemplateWarning): log is TemplateError =>
  (log as TemplateError).templatePath !== undefined;

const toFormatterMetadata = (
  log: TemplateError | TemplateWarning,
  renderContext?: Record<string, unknown>
) => ({
  lineno: log.lineno,
  colno: log.colno,
  phase: log.phase,
  templateName: log.templateName,
  templatePath: isTemplateError(log) ? log.templatePath : null,
  code: log.code,
  subject: log.subject,
  renderContext,
  lineBase: normalizeLineBase(log.lineBase),
});

const resolveTraceLineBase = (err: TemplateError, isJsCaller: boolean | undefined): LineBase => {
  if (isJsCaller) {
    return 'one';
  }
  return normalizeLineBase(err.lineBase);
};

const buildSourceTraceIfNeeded = (
  err: TemplateError,
  options: OutputOptions
): SourceTrace | null => {
  if ((options.verbosity ?? 'full') === 'simple') {
    return null;
  }
  const traceLineBase = resolveTraceLineBase(err, options.isJsCaller);
  return buildSourceTrace({
    sourceContent: err.sourceContent ?? null,
    templatePath: options.templatePath ?? err.templatePath ?? err.templateName ?? null,
    lineno: err.lineno,
    colno: adjustColnoForNullValue(err),
    lineBase: traceLineBase,
    sourceStartLine: err.sourceStartLine ?? 1,
    blockedKeys: collectBlockedKeys(err),
  });
};

const collectBlockedKeys = (err: TemplateError): readonly string[] | null => {
  const fromError = err.blockedKeys;
  if (fromError && fromError.length > 0) {
    return fromError;
  }
  const subject = err.subject;
  if (subject && subject.length > 0) {
    return [subject];
  }
  return null;
};

interface FormatErrorOutputInput {
  err: TemplateError;
  options: ReturnType<typeof createFormatterState>;
  format: string | undefined;
}

const formatErrorOutput = ({ err, options, format }: FormatErrorOutputInput): string => {
  if (format === 'ansi') {
    return toAnsi(err, options);
  }
  if (format === 'text') {
    return toText(err, options);
  }
  return toHtml(err, options);
};

/**
 * Formats a template error into a human-readable report (HTML error page, ANSI
 * terminal output, or plain text).
 *
 * Plain `Error` inputs are normalized to `TemplateError` shape before formatting;
 * hostile error objects (throwing getters, trapped proxies) degrade to placeholders
 * instead of throwing — `formatError` itself never throws.
 *
 * @param err - Error to format. A branded `TemplateError` renders with full
 *   diagnostics (code, location, subject, fix hints); a plain `Error` is treated
 *   as an engine-level failure.
 * @param options - Output shaping. `format` picks `'html' | 'ansi' | 'text'`
 *   (default: HTML); `verbosity`, `dev`, and `ide` control detail level and
 *   editor links; source/snippet fields override template source resolution;
 *   `sourceFileReader` supplies caller project sources for JS-originating errors.
 * @returns The formatted error report as a string.
 */
const formatError = (err: Error | TemplateError, options: OutputOptions = {}): string => {
  const templateError = isTemplateErrorLog(err) ? err : toTemplateError(err, options);
  const sourceTrace = buildSourceTraceIfNeeded(templateError, options);
  const humanTitle = classifyAndBuildTitle(templateError);

  const opts = createFormatterState({
    metadata: toFormatterMetadata(templateError, templateError.renderContext),
    options: { ...options, sourceTrace, humanTitle },
  });

  return formatErrorOutput({ err: templateError, options: opts, format: options.format });
};

const isTemplateErrorLog = (err: Error | TemplateError): err is TemplateError =>
  (err as TemplateError).templatePath !== undefined || err.name === 'Template render error';

const isProjectSource = (path: string): boolean => {
  // WHY: backslashes are normalized away first, so the posix check below is exhaustive.
  const normalized = path.replace(/\\/g, '/');
  return !normalized.includes('/node_modules/');
};

const extractSourceFromStack = (
  stack: string,
  sourceFileReader: SourceFileReader | undefined
): ProjectSourceContent | null => {
  if (!sourceFileReader) {
    return null;
  }
  const lines = stack.split('\n');
  const projectFrame = lines
    .map(parseStackFrame)
    .find((frame) => frame.path !== null && frame.line !== null && isProjectSource(frame.path));
  if (!projectFrame?.path || projectFrame.line === null) {
    return null;
  }
  return sourceFileReader({
    path: projectFrame.path,
    line: projectFrame.line,
    col: projectFrame.col ?? null,
  });
};

const toTemplateError = (err: Error, options: OutputOptions): TemplateError => {
  const wrapped = new Error(err.message) as TemplateError;
  if (err.stack) {
    wrapped.stack = err.stack;
    const sourceInfo = extractSourceFromStack(err.stack, options.sourceFileReader);
    if (sourceInfo) {
      wrapped.sourceContent = sourceInfo.sourceContent;
      wrapped.templatePath = sourceInfo.templatePath;
      wrapped.lineno = sourceInfo.lineno;
      wrapped.colno = sourceInfo.colno;
    }
  }
  return wrapped;
};

export { formatError };
