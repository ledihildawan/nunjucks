import { toAnsi, toText, toHtml, createFormatterState, buildSourceTrace, type SourceTrace } from '@nunjucks/error-renderer';
import { normalizeLineBase, type LineBase } from '@nunjucks/error-catalog';
import type { TemplateError, TemplateWarning, ErrorDefinitionEntry, OutputOptions, NormalizedErrorContext, NormalizedWarningContext } from './create-log-types.ts';
import { resolveMessage, createErrorEnvelope } from './create-log-helpers.ts';

const isTemplateError = (log: TemplateError | TemplateWarning): log is TemplateError =>
  (log as TemplateError).templatePath !== undefined;

const toFormatterMetadata = (log: TemplateError | TemplateWarning, renderContext?: Record<string, unknown>) => ({
  lineno: log.lineno,
  colno: log.colno,
  phase: log.phase,
  templateName: log.templateName,
  templatePath: isTemplateError(log) ? log.templatePath : null,
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
    sourceStartLine: err.sourceStartLine ?? 1,
    blockedKeys: collectBlockedKeys(err)
  });
};

const collectBlockedKeys = (err: TemplateError): readonly string[] | null => {
  const fromError = err.blockedKeys;
  if (fromError && fromError.length > 0) { return fromError; }
  const subject = err.subject;
  if (subject && subject.length > 0) { return [subject]; }
  return null;
};

const formatErrorOutput = (err: TemplateError, options: ReturnType<typeof createFormatterState>, format: string | undefined): string => {
  if (format === 'ansi') { return toAnsi(err, options); }
  if (format === 'text') { return toText(err, options); }
  return toHtml(err, options);
};

const formatError = (err: Error | TemplateError, options: OutputOptions = {}): string => {
  const templateError = isTemplateErrorLog(err) ? err : toTemplateError(err);
  const verbosity = options.verbosity ?? 'full';
  const sourceTrace = buildSourceTraceIfNeeded(templateError, verbosity, options);

  const opts = createFormatterState({
    metadata: toFormatterMetadata(templateError, templateError.renderContext),
    options: { ...options, sourceTrace }
  });

  return formatErrorOutput(templateError, opts, options.format);
};

const isTemplateErrorLog = (err: Error | TemplateError): err is TemplateError =>
  (err as TemplateError).templatePath !== undefined || err.name === 'Template render error';

const toTemplateError = (err: Error): TemplateError => {
  const wrapped = new Error(err.message) as TemplateError;
  if (err.stack) { wrapped.stack = err.stack; }
  return wrapped;
};

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
  const err = createErrorEnvelope(resolveMessage(errorDef.message, paramsValue));
  Object.assign(err, { name: 'Template render error', code: errorDef.name, subject, ...normalized });
  if (extra?.sourceContent) { err.sourceContent = extra.sourceContent as string; }
  if (Number.isInteger(extra?.sourceStartLine)) { err.sourceStartLine = extra?.sourceStartLine as number; }
  err.templatePath = normalized.templateName;
  if (errorDef.causes?.length) { err.causes = [...(errorDef.causes ?? [])]; }
  if (errorDef.fixCode) { err.fixCode = errorDef.fixCode; }
  if (errorDef.fixComment) { err.fixComment = errorDef.fixComment; }
  if (errorDef.documentationUrl) { err.documentationUrl = errorDef.documentationUrl; }
  if (errorDef.severity) { err.severity = errorDef.severity; }
  err.toJSON = buildErrorJson(err);
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
  if (errorDef.causes?.length) { warn.causes = [...(errorDef.causes ?? [])]; }
  if (errorDef.fixCode) { warn.fixCode = errorDef.fixCode; }
  if (errorDef.fixComment) { warn.fixComment = errorDef.fixComment; }
  return warn;
};

export { formatError, createErrorFromDef, createWarningFromDef };
