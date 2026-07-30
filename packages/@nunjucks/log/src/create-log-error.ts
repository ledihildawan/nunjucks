import { createFormatterState } from './render/internal/metadata.ts';
import { toAnsi } from './render/to-ansi.ts';
import { toText } from './render/to-text.ts';
import { toHtml } from './render/to-html.ts';
import { toConsoleString } from './render/to-console.ts';
import { normalizeLineBase, type LineBase } from './render/internal/location.ts';
import { buildSourceTrace } from './render/internal/source-trace.ts';
import type { SourceTrace } from './render/internal/source-trace.ts';
import { TEMPLATE_ERROR } from './create-log-types.ts';
import type { TemplateError, TemplateWarning, ErrorDefinitionEntry, OutputOptions, NormalizedErrorContext, NormalizedWarningContext } from './create-log-types.ts';
import { resolveMessage } from './create-log-helpers.ts';

const toFormatterMetadata = (log: TemplateError | TemplateWarning, renderContext?: Record<string, unknown>) => ({
  lineno: log.lineno,
  colno: log.colno,
  phase: log.phase,
  templateName: log.templateName,
  templatePath: (log as { templatePath?: string | null }).templatePath,
  code: log.code,
  subject: log.subject,
  renderContext,
  lineBase: normalizeLineBase(log.lineBase)
});

const resolveTraceLineBase = (err: TemplateError, isJsCaller: boolean | undefined): LineBase => {
  if (isJsCaller) { return 'one'; }
  return normalizeLineBase(err.lineBase);
};

const buildSourceTraceIfNeeded = (
  err: TemplateError,
  verbosity: string,
  options: OutputOptions
): SourceTrace | null => {
  if (verbosity === 'simple') { return null; }
  const traceLineBase = resolveTraceLineBase(err, options.isJsCaller);
  return buildSourceTrace({
    sourceContent: err.sourceContent ?? null,
    templatePath: options.templatePath ?? err.templatePath ?? err.templateName ?? null,
    lineno: err.lineno,
    colno: err.colno,
    lineBase: traceLineBase,
    sourceStartLine: err.sourceStartLine ?? 1
  });
};

const formatErrorOutput = (err: TemplateError, opts: ReturnType<typeof createFormatterState>, format: string | undefined): string => {
  if (format === 'ansi') { return toAnsi(err, opts); }
  if (format === 'text') { return toText(err, opts); }
  return toHtml(err, opts);
};

const buildErrorOutput = (err: TemplateError) => (options: OutputOptions = {}): string => {
  const verbosity = options.verbosity ?? 'full';
  const sourceTrace = buildSourceTraceIfNeeded(err, verbosity, options);

  const opts = createFormatterState({
    metadata: toFormatterMetadata(err, err.renderContext),
    options: { ...options, sourceTrace }
  });

  return formatErrorOutput(err, opts, options.format);
};

const buildWarningOutput = (warn: TemplateWarning) => (options: Omit<OutputOptions, 'format' | 'isProduction'> = {}): string =>
  toConsoleString(warn, createFormatterState({ metadata: toFormatterMetadata(warn), options }));

const buildErrorJson = (err: TemplateError) => (): Record<string, unknown> => ({
  name: err.name,
  code: err.code,
  subject: err.subject,
  message: err.message,
  phase: err.phase,
  templateName: err.templateName,
  templatePath: err.templatePath,
  sourceStartLine: err.sourceStartLine,
  lineno: err.lineno,
  colno: err.colno,
  lineBase: err.lineBase,
  causes: err.causes,
  fixCode: err.fixCode,
  fixComment: err.fixComment,
  severity: err.severity,
  stack: err.stack
});

const createErrorFromDef = (
  errorDef: ErrorDefinitionEntry,
  paramsValue: Record<string, string> | undefined,
  normalized: NormalizedErrorContext,
  extra: Record<string, unknown> | undefined,
  subject: string | null
): TemplateError => {
  const err = new Error(resolveMessage(errorDef.message, paramsValue)) as TemplateError;
  Object.assign(err, { name: 'Template render error', code: errorDef.name, subject, ...normalized, [TEMPLATE_ERROR]: true });
  if (extra?.sourceContent) { err.sourceContent = extra.sourceContent as string; }
  if (extra && Number.isInteger(extra.sourceStartLine)) { err.sourceStartLine = extra.sourceStartLine as number; }
  err.templatePath = normalized.templateName;
  if (errorDef.causes && errorDef.causes.length > 0) { err.causes = errorDef.causes; }
  if (errorDef.fixCode) { err.fixCode = errorDef.fixCode; }
  if (errorDef.fixComment) { err.fixComment = errorDef.fixComment; }
  if (errorDef.documentationUrl) { err.documentationUrl = errorDef.documentationUrl; }
  if (errorDef.severity) { err.severity = errorDef.severity; }
  err.toJSON = buildErrorJson(err);
  err.output = buildErrorOutput(err);
  return err;
};

const createWarningFromDef = (
  errorDef: ErrorDefinitionEntry,
  paramsValue: Record<string, string> | undefined,
  normalizedWarning: NormalizedWarningContext,
  subject: string | null
): TemplateWarning => {
  const warn = {
    message: resolveMessage(errorDef.message, paramsValue),
    code: errorDef.name,
    subject,
    ...normalizedWarning
  } as TemplateWarning;
  if (errorDef.causes && errorDef.causes.length > 0) { warn.causes = errorDef.causes; }
  if (errorDef.fixCode) { warn.fixCode = errorDef.fixCode; }
  if (errorDef.fixComment) { warn.fixComment = errorDef.fixComment; }
  warn.output = buildWarningOutput(warn);
  return warn;
};

export { buildErrorOutput, buildWarningOutput, createErrorFromDef, createWarningFromDef, toFormatterMetadata };
