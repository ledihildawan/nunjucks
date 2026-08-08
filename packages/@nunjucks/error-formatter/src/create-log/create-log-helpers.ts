import { isFunction, isString, pickBy } from 'remeda';
import { formatLocationAnnotation } from '@nunjucks/error-renderer';
import { TEMPLATE_ERROR } from './create-log-types.ts';
import type { TemplateError, ErrorContext, WarningContext, NormalizedErrorContext, NormalizedWarningContext, ErrorDefinitionEntry, LegacyLogData, LogType, WarningInfo, IncludeChain, ErrorInfo } from './create-log-types.ts';

const createErrorEnvelope = (message: string, cause?: Error): TemplateError => {
  const err = new Error(message, cause ? { cause } : undefined) as TemplateError;
  err[TEMPLATE_ERROR] = true;
  return err;
};

const resolveMessage = (message: ErrorDefinitionEntry['message'], params?: Record<string, string>): string => {
  if (isFunction(message)) { return message(params); }
  if (isString(message) && params) { return message.replaceAll(/\{(\w+)\}/gu, (_, k) => params[k] ?? ''); }
  return message;
};

const normalizeErrorContext = (context: ErrorContext | null | undefined): NormalizedErrorContext => ({
  lineno: context?.lineno ?? null,
  colno: context?.colno ?? null,
  phase: context?.phase ?? null,
  templateName: context?.templateName ?? null,
  lineBase: context?.lineBase ?? null,
});

const normalizeWarningContext = (context: WarningContext | null | undefined): NormalizedWarningContext => ({
  lineno: context?.lineno ?? null,
  colno: context?.colno ?? null,
  phase: context?.phase ?? null,
  templateName: context?.templateName ?? null,
  lineBase: context?.lineBase ?? null,
  varName: context?.varName ?? null,
  undefinedMode: context?.undefinedMode ?? 'chainable',
});

const isErrorDefinitionEntry = (candidate: unknown): candidate is ErrorDefinitionEntry => {
  if (typeof candidate !== 'object' || candidate === null || !('message' in candidate)) { return false; }
  const { message } = candidate as { message: unknown };
  return (typeof message === 'function' || typeof message === 'string') && !('lineno' in candidate);
};

const createBaseMetadata = (message: string, legacyLogData: LegacyLogData, info: ErrorInfo | WarningInfo, type: LogType) => {
  const base = {
    message,
    lineno: legacyLogData.lineno ?? null,
    colno: legacyLogData.colno ?? null,
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
  const annotation = err.firstUpdate ? formatLocationAnnotation(err.lineno, err.colno, err.lineBase) : null;
  return [
    `(${locationPath ?? 'unknown path'})`,
    annotation ? ` ${annotation}` : null,
    chain && err.firstUpdate ? formatParentLocation(chain) : null,
    '\n ',
    err.firstUpdate ? ' ' : null
  ].filter((part): part is string => part !== null).join('');
};

export { resolveMessage, normalizeErrorContext, normalizeWarningContext, isErrorDefinitionEntry, createBaseMetadata, extractExtraFromContext, formatParentLocation, buildLocationMessage, createErrorEnvelope };
