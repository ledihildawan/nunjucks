import { isFunction, isString, pickBy } from 'remeda';
import { DEFAULT_UNDEFINED_MODE } from '@nunjucks/shared';
import { TEMPLATE_ERROR } from './create-log-types.ts';
import type {
  TemplateError,
  ErrorContext,
  WarningContext,
  NormalizedErrorContext,
  NormalizedWarningContext,
  ErrorDefinitionEntry,
  RawLogData,
  LogType,
  WarningInfo,
  ErrorInfo,
} from './create-log-types.ts';

/**
 * Wraps a message and optional `cause` in an `Error` branded with the
 * `[TEMPLATE_ERROR]` marker so later guards recognize it as a `TemplateError`.
 */
const createErrorEnvelope = (message: string, cause?: Error): TemplateError => {
  const err = new Error(message, cause ? { cause } : undefined) as TemplateError;
  err[TEMPLATE_ERROR] = true;
  return err;
};

/**
 * Resolves a definition's message: function templates receive `params`
 * directly, string templates get `{param}` placeholders interpolated with
 * `''` for missing keys, and bare strings pass through untouched.
 */
const resolveMessage = (
  message: ErrorDefinitionEntry['message'],
  params?: Record<string, string>
): string => {
  if (isFunction(message)) {
    return message(params);
  }
  if (isString(message) && params) {
    return message.replaceAll(/\{(\w+)\}/gu, (_, k) => params[k] ?? '');
  }
  return message;
};

const normalizeErrorContext = (
  context: ErrorContext | null | undefined
): NormalizedErrorContext => ({
  lineno: context?.lineno ?? null,
  colno: context?.colno ?? null,
  phase: context?.phase ?? null,
  templateName: context?.templateName ?? null,
  lineBase: context?.lineBase ?? null,
  timestamp: context?.timestamp ?? null,
  environment: context?.environment ?? null,
});

// WHY: defaults `undefinedMode` to `DEFAULT_UNDEFINED_MODE` when absent or `null`.
const normalizeWarningContext = (
  context: WarningContext | null | undefined
): NormalizedWarningContext => ({
  lineno: context?.lineno ?? null,
  colno: context?.colno ?? null,
  phase: context?.phase ?? null,
  templateName: context?.templateName ?? null,
  lineBase: context?.lineBase ?? null,
  timestamp: context?.timestamp ?? null,
  environment: context?.environment ?? null,
  varName: context?.varName ?? null,
  undefinedMode: context?.undefinedMode ?? DEFAULT_UNDEFINED_MODE,
});

/**
 * Distinguishes catalog `ErrorDefinitionEntry` values from `RawLogData`:
 * a candidate needs a function-or-string `message` and must NOT carry a
 * `lineno` key (the marker raw log data uses for location instead).
 */
const isErrorDefinitionEntry = (candidate: unknown): candidate is ErrorDefinitionEntry => {
  if (typeof candidate !== 'object' || candidate === null || !('message' in candidate)) {
    return false;
  }
  const { message } = candidate as { message: unknown };
  return (typeof message === 'function' || typeof message === 'string') && !('lineno' in candidate);
};

interface CreateBaseMetadataOptions {
  message: string;
  rawLogData: RawLogData;
  info: ErrorInfo | WarningInfo;
  type: LogType;
}

/**
 * Builds the shared metadata object from a message, `RawLogData` location,
 * and `info` fields; for `'warning'` it also resolves `varName` and defaults
 * `undefinedMode`, matching the `TemplateWarning` payload shape.
 */
const createBaseMetadata = ({ message, rawLogData, info, type }: CreateBaseMetadataOptions) => {
  const baseMetadata = {
    message,
    lineno: rawLogData.lineno ?? null,
    colno: rawLogData.colno ?? null,
    code: info.code ?? null,
    subject: info.subject ?? null,
    phase: info.phase ?? null,
    templateName: info.templateName ?? null,
    lineBase: info.lineBase ?? null,
  };
  if (type === 'warning') {
    const warningInfo = info as WarningInfo;
    return {
      ...baseMetadata,
      varName: warningInfo.varName ?? null,
      undefinedMode: warningInfo.undefinedMode ?? DEFAULT_UNDEFINED_MODE,
    };
  }
  return baseMetadata;
};

/**
 * Extracts context keys outside the known location/phase set into an `extra`
 * bag (e.g. `sourceContent`, `sourceStartLine`); returns `undefined` when the
 * context itself is absent.
 */
const extractExtraFromContext = (
  context: ErrorContext | null | undefined
): Record<string, unknown> | undefined => {
  const extraKeys = [
    'lineno',
    'colno',
    'phase',
    'templateName',
    'lineBase',
    'varName',
    'undefinedMode',
  ];
  if (!context) {
    return undefined;
  }
  return pickBy(context, (_, k) => !extraKeys.includes(k));
};

export {
  resolveMessage,
  normalizeErrorContext,
  normalizeWarningContext,
  isErrorDefinitionEntry,
  createBaseMetadata,
  extractExtraFromContext,
  createErrorEnvelope,
};
