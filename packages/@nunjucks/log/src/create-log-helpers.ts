import { isFunction, isString, pickBy } from 'remeda';
import { formatLocationAnnotation } from './render/internal/location.ts';
import type { TemplateError, ErrorContext, WarningContext, BaseContext, ErrorDefinitionEntry, LegacyLogData, LogType, WarningInfo, IncludeChain, ErrorInfo } from './create-log-types.ts';

const resolveMessage = (message: ErrorDefinitionEntry['message'], params?: Record<string, string>): string => {
  if (isFunction(message)) { return message(params); }
  if (isString(message) && params) { return message.replace(/\{(\w+)\}/gu, (_, k) => params[k] ?? ''); }
  return message;
};

const normalizeContext = <T extends BaseContext>(
  context: ErrorContext | WarningContext | undefined | null,
  extra: (c: ErrorContext | WarningContext) => Partial<T>
): T => ({
  lineno: context?.lineno ?? null,
  colno: context?.colno ?? null,
  phase: context?.phase ?? null,
  templateName: context?.templateName ?? null,
  lineBase: context?.lineBase ?? null,
  ...extra(context ?? {})
} as T);

const isErrorDefinitionEntry = (data: unknown): data is ErrorDefinitionEntry => {
  if (typeof data !== 'object' || data === null || !('message' in data)) { return false; }
  const { message } = data as { message: unknown };
  return (typeof message === 'function' || typeof message === 'string') && !('lineno' in data);
};

const createBaseMetadata = (message: string, data: LegacyLogData, info: ErrorInfo | WarningInfo, type: LogType) => {
  const base = {
    message,
    lineno: data.lineno ?? null,
    colno: data.colno ?? null,
    code: info.code ?? null,
    subject: info.subject ?? null,
    phase: info.phase ?? null,
    templateName: info.templateName ?? null,
    lineBase: info.lineBase ?? null,
  };
  if (type === 'warning') {
    const warningInfo = info as WarningInfo;
    return {
      ...base,
      varName: warningInfo.varName ?? null,
      undefinedMode: warningInfo.undefinedMode ?? 'chainable'
    };
  }
  return base;
};

const extractExtraFromContext = (context: ErrorContext | null | undefined): Record<string, unknown> | undefined => {
  const extraKeys = ['lineno', 'colno', 'phase', 'templateName', 'lineBase', 'varName', 'undefinedMode'];
  if (!context) { return undefined; }
  return pickBy(context, (_, k) => !extraKeys.includes(k));
};

const formatParentLocation = (chain: IncludeChain): string => {
  const parentColnoPart = chain.parentColno ? `:${chain.parentColno}` : '';
  return `\n   (included from ${chain.parentTmpl}:${chain.parentLineno}${parentColnoPart})`;
};

const buildLocationMessage = (
  locationPath: string | undefined,
  err: TemplateError,
  chain?: IncludeChain
): string => {
  let msg = `(${locationPath || 'unknown path'})`;
  if (err.firstUpdate) {
    const annotation = formatLocationAnnotation(err.lineno, err.colno, err.lineBase);
    if (annotation) { msg += ` ${annotation}`; }
  }
  if (chain && err.firstUpdate) {
    msg += formatParentLocation(chain);
  }
  msg += '\n ';
  if (err.firstUpdate) {
    msg += ' ';
  }
  return msg;
};

export { resolveMessage, normalizeContext, isErrorDefinitionEntry, createBaseMetadata, extractExtraFromContext, formatParentLocation, buildLocationMessage };
