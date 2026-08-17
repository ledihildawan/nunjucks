import {
  toAnsi,
  toText,
  toHtml,
  createFormatterState,
  buildSourceTrace,
  parseStackFrame,
  classifyAndBuildTitle,
  type SourceTrace,
} from '@nunjucks/error-renderer';
import type { ProjectSourceContent, SourceFileReader } from './create-log-types.ts';
import { normalizeLineBase, ERROR_CODES, type LineBase } from '@nunjucks/error-catalog';
import type {
  TemplateError,
  TemplateWarning,
  ErrorDefinitionEntry,
  OutputOptions,
  NormalizedErrorContext,
  NormalizedWarningContext,
  ColnoAdjustmentError,
} from './create-log-types.ts';
import { resolveMessage, createErrorEnvelope } from './create-log-helpers.ts';

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

const adjustColnoForNullValue = (err: ColnoAdjustmentError): number | null | undefined => {
  if (err.code !== ERROR_CODES.NULL_VALUE || !err.sourceContent || err.lineno == null) {
    return err.colno;
  }
  const parentMatch = err.message.match(/on (?:null|undefined) '([^']+)'$/u);
  if (!parentMatch?.[1]) {
    return err.colno;
  }
  // WHY: normalizeLineBase so an absent/junk lineBase defaults to 'zero' exactly like
  // resolveTraceLineBase — the raw `=== 'zero'` check used to fall through to the 'one'
  // branch for undefined, producing off-by-one columns for non-branded errors.
  const zeroBased = normalizeLineBase(err.lineBase) === 'zero';
  const lines = err.sourceContent.split('\n');
  const lineIndex = zeroBased ? err.lineno : Math.max(0, err.lineno - 1);
  const errorLine = lines[lineIndex];
  if (!errorLine) {
    return err.colno;
  }
  const parentIdx = errorLine.indexOf(parentMatch[1]);
  if (parentIdx < 0) {
    return err.colno;
  }
  return zeroBased ? parentIdx : parentIdx + 1;
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
  stack: err.stack,
});

interface CreateErrorFromDefOptions {
  errorDef: ErrorDefinitionEntry;
  paramsValue: Record<string, string> | undefined;
  normalized: NormalizedErrorContext;
  extra: Record<string, unknown> | undefined;
  subject: string | null;
}

const createErrorFromDef = ({
  errorDef,
  paramsValue,
  normalized,
  extra,
  subject,
}: CreateErrorFromDefOptions): TemplateError => {
  const err = createErrorEnvelope(resolveMessage(errorDef.message, paramsValue));
  Object.assign(err, {
    name: 'Template render error',
    code: errorDef.name,
    subject,
    ...normalized,
  });
  if (typeof extra?.sourceContent === 'string') {
    err.sourceContent = extra.sourceContent;
  }
  if (typeof extra?.sourceStartLine === 'number') {
    err.sourceStartLine = extra.sourceStartLine;
  }
  err.templatePath = normalized.templateName;
  if (errorDef.causes?.length) {
    err.causes = [...(errorDef.causes ?? [])];
  }
  if (errorDef.fixCode) {
    err.fixCode = errorDef.fixCode;
  }
  if (errorDef.fixComment) {
    err.fixComment = errorDef.fixComment;
  }
  if (errorDef.documentationUrl) {
    err.documentationUrl = errorDef.documentationUrl;
  }
  if (errorDef.severity) {
    err.severity = errorDef.severity;
  }
  err.toJSON = buildErrorJson(err);
  return err;
};

interface CreateWarningFromDefOptions {
  errorDef: ErrorDefinitionEntry;
  paramsValue: Record<string, string> | undefined;
  normalizedWarning: NormalizedWarningContext;
  subject: string | null;
}

const createWarningFromDef = ({
  errorDef,
  paramsValue,
  normalizedWarning,
  subject,
}: CreateWarningFromDefOptions): TemplateWarning => {
  const warn = {
    message: resolveMessage(errorDef.message, paramsValue),
    code: errorDef.name,
    subject,
    ...normalizedWarning,
  } as TemplateWarning;
  if (errorDef.causes?.length) {
    warn.causes = [...(errorDef.causes ?? [])];
  }
  if (errorDef.fixCode) {
    warn.fixCode = errorDef.fixCode;
  }
  if (errorDef.fixComment) {
    warn.fixComment = errorDef.fixComment;
  }
  return warn;
};

export { formatError, createErrorFromDef, createWarningFromDef, adjustColnoForNullValue };
