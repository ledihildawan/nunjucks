import { pipe } from 'remeda';
import type { TemplateError, TemplateWarning, ErrorDefinitionEntry, LegacyLogData, LogType, ErrorContext, WarningContext, IncludeChain, PrettifyErrorOptions, ErrorInfo, WarningInfo, OutputOptions } from './create-log-types.ts';
import { TEMPLATE_ERROR } from './create-log-types.ts';
import { normalizeErrorContext, normalizeWarningContext, isErrorDefinitionEntry, createBaseMetadata, extractExtraFromContext, buildLocationMessage, createErrorEnvelope } from './create-log-helpers.ts';
import { createErrorFromDef, createWarningFromDef } from './create-log-error.ts';
import { isKeyedObject } from '@nunjucks/shared';

interface CreateLogFields {
  def: ErrorDefinitionEntry | LegacyLogData;
  params?: Record<string, string>;
  subject?: string | null;
  context?: ErrorContext | WarningContext | null;
}

function createLog(type: 'error', fields: CreateLogFields): TemplateError;
function createLog(type: 'warning', fields: CreateLogFields): TemplateWarning;
function createLog(type: string, fields: CreateLogFields): TemplateError | TemplateWarning {
  const { def: errorDefOrData, params, subject, context } = fields;
  assertLogType(type);

  if (!isErrorDefinitionEntry(errorDefOrData)) {
    return createFromLegacyData(type, errorDefOrData);
  }

  const errorDef = errorDefOrData;
  const extra = extractExtraFromContext(context);

  if (type === 'error') {
    const normalized = normalizeErrorContext(context);
    return createErrorFromDef(errorDef, params, normalized, extra, subject ?? null);
  }

  const normalized = normalizeWarningContext(context);
  return createWarningFromDef(errorDef, params, normalized, subject ?? null);
}

const isTemplateError = (value: unknown): value is TemplateError =>
  isKeyedObject(value) && value[TEMPLATE_ERROR] === true;

const asTemplateError = (err: Error | TemplateError): TemplateError => {
  if (isTemplateError(err)) { return err; }
  const e = err as Partial<TemplateError>;
  return createLog('error', {
    def: { name: e.code ?? 'ERROR', message: err.message },
    subject: e.subject ?? null,
    context: {
      lineno: e.lineno ?? null,
      colno: e.colno ?? null,
      phase: e.phase ?? 'render',
      templateName: e.templateName ?? null,
      lineBase: e.lineBase ?? 'zero',
    },
  });
};

const withLocation = ({ path, includeChain }: { path?: string; includeChain?: IncludeChain }) => (err: TemplateError): TemplateError => {
  const result = Object.assign(createErrorEnvelope(err.message, err), err);
  result.applyLocation = (locationPath: string | undefined, chain?: IncludeChain): TemplateError => {
    result.message = buildLocationMessage(locationPath, result, chain) + (result.message ?? '');
    result.firstUpdate = false;
    return result;
  };
  result.templateName = result.templateName ?? (path ?? null);
  if (includeChain) {
    result.includeChain = includeChain;
  }
  return result;
};

const stripInternals = (path?: string) => (err: TemplateError): TemplateError => {
  const clean = createErrorEnvelope(err.message, err);
  clean.name = err.name;
  clean.lineno = err.lineno;
  clean.colno = err.colno;
  clean.path = err.path ?? (path ?? null);
  clean.templateName = err.templateName ?? (path ?? null);
  clean.code = err.code;
  clean.subject = err.subject;
  clean.phase = err.phase;
  clean.lineBase = err.lineBase ?? 'zero';
  if (err.includeChain) {
    clean.includeChain = err.includeChain;
  }
  return clean;
};

const prettifyError = (options: PrettifyErrorOptions): TemplateError => {
  const { path, withInternals, err, includeChain } = options;
  if (withInternals) {
    return pipe(err, asTemplateError, withLocation({ path, includeChain }));
  }
  return pipe(err, asTemplateError, withLocation({ path, includeChain }), stripInternals(path));
};

const createFromLegacyData = (type: LogType, legacyLogData: LegacyLogData): TemplateError | TemplateWarning => {
  const info = (legacyLogData.info ?? {}) as WarningInfo;
  const base = createBaseMetadata({ message: legacyLogData.message, legacyLogData, info, type });

  if (type === 'error') {
    const err = createErrorEnvelope(base.message);
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
    });
    return err;
  }

  const warn: TemplateWarning = {
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
  };
  return warn;
};

function assertLogType(type: string): asserts type is LogType {
  // WHY: invariant — createLog is internal and only ever called with 'error' or 'warning'; reaching here is a programming bug, not an expected failure.
  if (type !== 'error' && type !== 'warning') {
    throw new Error(`Unknown log type: ${type}`);
  }
}

export { createLog, isTemplateError, prettifyError };
export type { ErrorDefinitionEntry, ErrorInfo, WarningInfo, OutputOptions, TemplateError, TemplateWarning, ErrorContext, WarningContext, IncludeChain, CreateLogFields };
