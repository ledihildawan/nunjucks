import { pipe } from 'remeda';
import type { TemplateError, TemplateWarning, ErrorDefinitionEntry, LegacyLogData, LogType, ErrorContext, WarningContext, IncludeChain, PrettifyErrorOptions, NormalizedErrorContext, NormalizedWarningContext } from './create-log-types.ts';
import { normalizeContext, isErrorDefinitionEntry, createBaseMetadata, extractExtraFromContext, buildLocationMessage } from './create-log-helpers.ts';
import { createErrorFromDef, createWarningFromDef, buildErrorOutput, buildWarningOutput } from './create-log-error.ts';

const TEMPLATE_ERROR = Symbol('TemplateError');

function createLog(
  type: string,
  errorDefOrData: ErrorDefinitionEntry | LegacyLogData,
  params?: Record<string, string>,
  subject?: string | null,
  context?: ErrorContext | null
): TemplateError | TemplateWarning {
  assertLogType(type);

  if (!isErrorDefinitionEntry(errorDefOrData)) {
    return createFromLegacyData(type, errorDefOrData);
  }

  const errorDef = errorDefOrData;
  const paramsValue = params as Record<string, string> | undefined;
  let normalized: NormalizedErrorContext | NormalizedWarningContext;
  if (type === 'error') {
    normalized = normalizeContext<NormalizedErrorContext>(context as ErrorContext, () => ({}));
  } else {
    normalized = normalizeContext<NormalizedWarningContext>(context as WarningContext, (c) => ({ varName: (c as WarningContext).varName ?? null, undefinedMode: (c as WarningContext).undefinedMode ?? 'chainable' }));
  }

  const extra = extractExtraFromContext(context);

  if (type === 'error') {
    return createErrorFromDef(errorDef, paramsValue, normalized as NormalizedErrorContext, extra, subject ?? null);
  }

  return createWarningFromDef(errorDef, paramsValue, normalized as NormalizedWarningContext, subject ?? null);
}

function isTemplateError(obj: unknown): obj is TemplateError {
  return (obj as TemplateError | null | undefined)?.[TEMPLATE_ERROR] === true;
}

const asTemplateError = (err: Error | TemplateError): TemplateError => {
  if (isTemplateError(err)) { return err; }
  const e = err as Partial<TemplateError>;
  return createLog('error', { name: e.code ?? 'ERROR', message: err.message }, undefined, e.subject ?? null, {
    lineno: e.lineno ?? null,
    colno: e.colno ?? null,
    phase: e.phase ?? 'render',
    templateName: e.templateName ?? null,
    lineBase: e.lineBase ?? 'zero'
  }) as TemplateError;
};

const withLocation = ({ path, includeChain }: { path?: string; includeChain?: IncludeChain }) => (err: TemplateError): TemplateError => {
  err.applyLocation = (locationPath: string | undefined, chain?: IncludeChain): TemplateError => {
    err.message = buildLocationMessage(locationPath, err, chain) + (err.message || '');
    err.firstUpdate = false;
    return err;
  };
  err.templateName = err.templateName ?? (path ?? null);
  if (includeChain) {
    err._includeChain = includeChain;
  }
  return err;
};

const stripInternals = (path?: string) => (err: TemplateError): TemplateError => {
  const clean = new Error(err.message, { cause: err }) as TemplateError;
  clean.name = err.name;
  clean.lineno = err.lineno;
  clean.colno = err.colno;
  clean.path = err.path ?? (path ?? null);
  clean.templateName = err.templateName ?? (path ?? null);
  clean.code = err.code;
  clean.subject = err.subject;
  clean.phase = err.phase;
  clean.lineBase = err.lineBase ?? 'zero';
  if (err._includeChain) {
    clean._includeChain = err._includeChain;
  }
  return clean;
};

function prettifyError(options: PrettifyErrorOptions): TemplateError {
  const { path, withInternals, err, includeChain } = options;
  if (withInternals) {
    return pipe(err, asTemplateError, withLocation({ path, includeChain })) as TemplateError;
  }
  return pipe(err, asTemplateError, withLocation({ path, includeChain }), stripInternals(path)) as TemplateError;
}

const createFromLegacyData = (type: LogType, data: LegacyLogData): TemplateError | TemplateWarning => {
  const info = (data.info ?? {}) as WarningInfo;
  const base = createBaseMetadata(data.message, data, info, type);

  if (type === 'error') {
    const err = new Error(base.message) as TemplateError;
    Object.assign(err, {
      name: 'Template render error',
      code: base.code,
      subject: base.subject,
      lineno: base.lineno,
      colno: base.colno,
      phase: base.phase,
      templateName: base.templateName,
      lineBase: base.lineBase,
      templatePath: base.templateName,
      [TEMPLATE_ERROR]: true as const,
    });
    err.output = buildErrorOutput(err);
    return err;
  }

  const warn = {
    message: base.message,
    lineno: base.lineno,
    colno: base.colno,
    varName: info.varName ?? null,
    templateName: base.templateName,
    undefinedMode: info.undefinedMode ?? 'chainable',
    code: base.code,
    subject: base.subject,
    phase: base.phase,
    lineBase: base.lineBase,
  } as TemplateWarning;
  warn.output = buildWarningOutput(warn);
  return warn;
};

function assertLogType(type: string): asserts type is LogType {
  if (type !== 'error' && type !== 'warning') {
    throw new Error(`Unknown log type: ${type}`);
  }
}

export { createLog, isTemplateError, prettifyError };
export type { ErrorDefinitionEntry, ErrorInfo, WarningInfo, OutputOptions, TemplateError, TemplateWarning, ErrorContext, WarningContext, IncludeChain };
