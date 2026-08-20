import { pipe } from 'remeda';
import { DEFAULT_UNDEFINED_MODE, UNDEFINED_MODES } from '@nunjucks/shared';
import type { UndefinedMode } from '@nunjucks/shared';
import type {
  TemplateError,
  TemplateWarning,
  ErrorDefinitionEntry,
  RawLogData,
  LogType,
  ErrorContext,
  WarningContext,
  IncludeChain,
  PrettifyErrorOptions,
  ErrorInfo,
  WarningInfo,
  OutputOptions,
} from './create-log-types.ts';
import { TEMPLATE_ERROR } from './create-log-types.ts';
import {
  normalizeErrorContext,
  normalizeWarningContext,
  isErrorDefinitionEntry,
  createBaseMetadata,
  extractExtraFromContext,
  createErrorEnvelope,
} from './create-log-helpers.ts';
import { createErrorFromDef, createWarningFromDef } from './create-log-defs.ts';
import { isKeyedObject } from '@nunjucks/lib';

/**
 * Carries the inputs to `createLog`: `def` is a catalog `ErrorDefinitionEntry`
 * or raw `RawLogData`, joined with optional `params`, `subject`, and `context`
 * location metadata.
 */
interface CreateLogFields {
  def: ErrorDefinitionEntry | RawLogData;
  params?: Record<string, string>;
  subject?: string | null;
  context?: ErrorContext | WarningContext | null;
}

/**
 * Creates a branded `TemplateError` or `TemplateWarning` from a catalog
 * definition or raw log data — the monorepo's single error/warning factory.
 *
 * @param type - `'error'` produces a `TemplateError`; `'warning'` produces a
 *   `TemplateWarning`; any other string degrades to a `TemplateError` carrying
 *   an "Unknown log type" message.
 * @param fields - `def` is either a catalog `ErrorDefinitionEntry` (code,
 *   message template, causes, fix hints) or `RawLogData` forwarded as-is;
 *   `params` interpolate the definition's message; `subject` and `context`
 *   supply location, phase, and template metadata.
 */
function createLog(type: 'error', fields: CreateLogFields): TemplateError;
function createLog(type: 'warning', fields: CreateLogFields): TemplateWarning;
function createLog(type: string, fields: CreateLogFields): TemplateError | TemplateWarning {
  const { def: errorDefOrData, params, subject, context } = fields;
  if (type !== 'error' && type !== 'warning') {
    return createFromRawData('error', { message: `Unknown log type: ${type}` });
  }

  if (!isErrorDefinitionEntry(errorDefOrData)) {
    return createFromRawData(type, errorDefOrData);
  }

  const errorDef = errorDefOrData;
  const extra = extractExtraFromContext(context);

  if (type === 'error') {
    const normalizedErrorContext = normalizeErrorContext(context);
    return createErrorFromDef({
      errorDef,
      paramsValue: params,
      normalized: normalizedErrorContext,
      extra,
      subject: subject ?? null,
    });
  }

  const normalizedWarningContext = normalizeWarningContext(context);
  return createWarningFromDef({
    errorDef,
    paramsValue: params,
    normalizedWarning: normalizedWarningContext,
    subject: subject ?? null,
  });
}

const isTemplateError = (value: unknown): value is TemplateError =>
  isKeyedObject(value) && value[TEMPLATE_ERROR] === true;

// WHY: rawLogData.info crosses the raw-error boundary with arbitrary shape — narrow the
// warning-specific fields createFromRawData actually consumes instead of asserting the
// whole WarningInfo contract. The literal-array widening is sound (superset read-only).
const isUndefinedMode = (value: unknown): value is UndefinedMode =>
  typeof value === 'string' && (UNDEFINED_MODES as readonly string[]).includes(value);

const isWarningInfo = (value: unknown): value is WarningInfo => {
  if (!isKeyedObject(value)) {
    return false;
  }
  const { varName, undefinedMode } = value;
  const varNameValid = varName === undefined || varName === null || typeof varName === 'string';
  const undefinedModeValid =
    undefinedMode === undefined || undefinedMode === null || isUndefinedMode(undefinedMode);
  return varNameValid && undefinedModeValid;
};

const asTemplateError = (err: Error | TemplateError): TemplateError => {
  if (isTemplateError(err)) {
    return err;
  }
  const partialErr = err as Partial<TemplateError>;
  return createLog('error', {
    def: { name: partialErr.code ?? 'ERROR', message: err.message },
    subject: partialErr.subject ?? null,
    context: {
      lineno: partialErr.lineno ?? null,
      colno: partialErr.colno ?? null,
      phase: partialErr.phase ?? 'render',
      templateName: partialErr.templateName ?? null,
      lineBase: partialErr.lineBase ?? 'zero',
    },
  });
};

// WHY: Object.assign copies only enumerable own props — the descriptor overlay must match or
// err's non-enumerable message/stack/cause would overwrite the fresh envelope's own.
const ownEnumerableDescriptors = (source: object): PropertyDescriptorMap =>
  Object.fromEntries(
    Reflect.ownKeys(source).flatMap((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      return descriptor?.enumerable === true ? [[key, descriptor] as const] : [];
    })
  );

const withLocation =
  ({ path, includeChain }: { path?: string; includeChain?: IncludeChain }) =>
  (err: TemplateError): TemplateError => {
    // WHY: descriptor spread + Object.create instead of Object.assign — err crosses the raw
    // thrown-object boundary, and an own enumerable "__proto__" (e.g. via JSON.parse) would
    // ride Object.assign's [[Set]] semantics into the prototype setter and retarget the
    // clone; DefineOwnProperty cannot be intercepted. Descriptor-map spread (not assign)
    // keeps the merge itself on CreateDataProperty semantics for the same reason.
    return Object.create(Object.getPrototypeOf(err) ?? Error.prototype, {
      ...Object.getOwnPropertyDescriptors(createErrorEnvelope(err.message, err)),
      ...ownEnumerableDescriptors(err),
      ...Object.getOwnPropertyDescriptors({
        templateName: err.templateName ?? path ?? null,
        ...(includeChain ? { includeChain } : {}),
      }),
    }) as TemplateError;
  };

const stripInternals =
  (path?: string) =>
  (err: TemplateError): TemplateError => {
    const clean = createErrorEnvelope(err.message, err);
    clean.name = err.name;
    clean.lineno = err.lineno;
    clean.colno = err.colno;
    clean.path = err.path ?? path ?? null;
    clean.templateName = err.templateName ?? path ?? null;
    clean.code = err.code;
    clean.subject = err.subject;
    clean.phase = err.phase;
    clean.lineBase = err.lineBase ?? 'zero';
    if (err.includeChain) {
      clean.includeChain = err.includeChain;
    }
    return clean;
  };

/**
 * Coerces any error into a branded `TemplateError` and applies location and
 * internals handling: `path` fills an absent `templateName`, `includeChain`
 * attaches only when provided, and internals are kept unless `withInternals`
 * is falsy, in which case the error is rebuilt with only the public fields.
 */
const prettifyError = (options: PrettifyErrorOptions): TemplateError => {
  const { path, withInternals, err, includeChain } = options;
  if (withInternals) {
    return pipe(err, asTemplateError, withLocation({ path, includeChain }));
  }
  return pipe(err, asTemplateError, withLocation({ path, includeChain }), stripInternals(path));
};

const createFromRawData = (
  type: LogType,
  rawLogData: RawLogData
): TemplateError | TemplateWarning => {
  const warningInfo: WarningInfo = isWarningInfo(rawLogData.info) ? rawLogData.info : {};
  const baseMetadata = createBaseMetadata({
    message: rawLogData.message,
    rawLogData,
    info: warningInfo,
    type,
  });

  if (type === 'error') {
    const err = createErrorEnvelope(baseMetadata.message);
    Object.assign(err, {
      name: 'Template render error',
      code: baseMetadata.code,
      subject: baseMetadata.subject,
      lineno: baseMetadata.lineno,
      colno: baseMetadata.colno,
      phase: baseMetadata.phase,
      templateName: baseMetadata.templateName,
      lineBase: baseMetadata.lineBase,
      templatePath: baseMetadata.templateName,
    });
    return err;
  }

  const warn: TemplateWarning = {
    message: baseMetadata.message,
    lineno: baseMetadata.lineno,
    colno: baseMetadata.colno,
    varName: warningInfo.varName ?? null,
    templateName: baseMetadata.templateName,
    undefinedMode: warningInfo.undefinedMode ?? DEFAULT_UNDEFINED_MODE,
    code: baseMetadata.code,
    subject: baseMetadata.subject,
    phase: baseMetadata.phase,
    lineBase: baseMetadata.lineBase,
  };
  return warn;
};

export { createLog, isTemplateError, prettifyError };
export type {
  ErrorDefinitionEntry,
  ErrorInfo,
  WarningInfo,
  OutputOptions,
  TemplateError,
  TemplateWarning,
  ErrorContext,
  WarningContext,
  IncludeChain,
  CreateLogFields,
  RawLogData,
};
