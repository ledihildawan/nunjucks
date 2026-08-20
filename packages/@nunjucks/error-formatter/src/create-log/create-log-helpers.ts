import { DEFAULT_UNDEFINED_MODE } from '@nunjucks/shared';
import { isFunction, isString, pickBy } from 'remeda';
import type {
  ErrorContext,
  ErrorDefinitionEntry,
  ErrorInfo,
  NormalizedErrorContext,
  NormalizedWarningContext,
  RawLogData,
  TemplateError,
  WarningContext,
} from './create-log-types.ts';
import { TEMPLATE_ERROR } from './create-log-types.ts';

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
  info: ErrorInfo;
}

/**
 * Builds the shared metadata object from a message, `RawLogData` location, and
 * the common `ErrorInfo` fields (code, subject, phase, template name, line
 * base). Warning-only fields (`varName`, `undefinedMode`) stay with the caller,
 * which reads them off `WarningInfo` directly.
 */
const createBaseMetadata = ({ message, rawLogData, info }: CreateBaseMetadataOptions) => ({
  message,
  lineno: rawLogData.lineno ?? null,
  colno: rawLogData.colno ?? null,
  code: info.code ?? null,
  subject: info.subject ?? null,
  phase: info.phase ?? null,
  templateName: info.templateName ?? null,
  lineBase: info.lineBase ?? null,
});

// WHY: module-level Set — hoisted out of the per-error call so the exclusion check
// is a single O(1) has() instead of rebuilding the key list per invocation.
const KNOWN_METADATA_KEYS = new Set([
  'lineno',
  'colno',
  'phase',
  'templateName',
  'lineBase',
  'varName',
  'undefinedMode',
]);

/**
 * Extracts context keys outside the known location/phase set into an `extra`
 * bag (e.g. `sourceContent`, `sourceStartLine`); returns `undefined` when the
 * context itself is absent.
 */
const extractExtraFromContext = (
  context: ErrorContext | null | undefined
): Record<string, unknown> | undefined => {
  if (!context) {
    return undefined;
  }
  return pickBy(context, (_, k) => !KNOWN_METADATA_KEYS.has(k));
};

export {
  createBaseMetadata,
  createErrorEnvelope,
  extractExtraFromContext,
  isErrorDefinitionEntry,
  normalizeErrorContext,
  normalizeWarningContext,
  resolveMessage,
};
