import { isNonNullish, isNullish } from 'remeda';
import { isSafeString as runtimeIsSafeString, markSafe, copySafeness } from '@nunjucks/runtime';
import { escapeHtml } from '@nunjucks/shared';
import { createLog, } from '@nunjucks/log';
import type { ErrorDefinitionEntry } from '@nunjucks/log';
import type { FilterContext, SafeString } from './types.ts';

export { isSafeString } from './types.ts';

const getLogContext = (ctx: FilterContext): { templateName: string; phase: string; renderContext: unknown } => {
  if (ctx?.logContext) {
    return { templateName: ctx.logContext.templateName || 'inline', phase: ctx.logContext.phase || 'render', renderContext: ctx.logContext.renderContext ?? null };
  }
  return { templateName: 'inline', phase: 'render', renderContext: null };
};

export const filterError = (ctx: FilterContext, errorDef: ErrorDefinitionEntry, params: Record<string, string>, subject: string) => {
  const logContext = getLogContext(ctx);
  return createLog('error', errorDef, params, subject, { phase: logContext.phase, templateName: logContext.templateName, lineBase: 'zero' });
};

export const normalize = (value: unknown, defaultValue: string): string => {
  if (isNullish(value) || value === false) {
    return defaultValue;
  }
  return String(value);
};

export const safeString = (str: unknown): SafeString => {
  if (runtimeIsSafeString(str)) { return str as SafeString; }
  let s: string;
  if (isNonNullish(str)) {
    s = String(str);
  } else {
    s = '';
  }
  return markSafe(s) as SafeString;
};

export const safeHtml = (str: unknown): SafeString => {
  if (runtimeIsSafeString(str)) { return str as SafeString; }
  let s: string;
  if (isNonNullish(str)) {
    s = String(str);
  } else {
    s = '';
  }
  return markSafe(escapeHtml(s)) as SafeString;
};

export const forceHtml = (str: unknown): SafeString => {
  let s: string;
  if (isNonNullish(str)) {
    s = String(str);
  } else {
    s = '';
  }
  return markSafe(escapeHtml(s)) as SafeString;
};

export const preserveSafe = (original: unknown, result: string): string =>
  copySafeness(original as object, result) as string;
