import { isNonNullish, isNullish, forEach } from 'remeda';
import { isSafeString, markSafe, copySafeness } from '@nunjucks/runtime';
import { escapeHtml } from '@nunjucks/shared';
import { createLog } from '@nunjucks/log';
import type { ErrorDefinitionEntry } from '@nunjucks/log';
import type { FilterContext, SafeString } from './types.ts';

const getLogContext = (ctx: FilterContext): { templateName: string; phase: string; renderContext: unknown } => {
  if (ctx?.logContext) {
    return { templateName: ctx.logContext.templateName || 'inline', phase: ctx.logContext.phase || 'render', renderContext: ctx.logContext.renderContext ?? null };
  }
  return { templateName: 'inline', phase: 'render', renderContext: null };
};

const filterError = (ctx: FilterContext, errorDef: ErrorDefinitionEntry, params: Record<string, string>, subject: string) => {
  const logContext = getLogContext(ctx);
  return createLog('error', errorDef, params, subject, { phase: logContext.phase, templateName: logContext.templateName, lineBase: 'zero' });
};

const makeFilterError = (
  errorDef: ErrorDefinitionEntry | undefined,
  params: Record<string, string>,
  subject: string,
  fallbackMessage: string,
) => {
  if (errorDef) {
    return filterError(undefined, errorDef, params, subject);
  }
  return new Error(fallbackMessage);
};

const normalize = (value: unknown, defaultValue: string): string => {
  if (isNullish(value) || value === false) {
    return defaultValue;
  }
  return String(value);
};

const safeString = (str: unknown): SafeString => {
  if (isSafeString(str)) { return str as SafeString; }
  const s = isNonNullish(str) ? String(str) : '';
  return markSafe(s) as SafeString;
};

const safeHtml = (str: unknown): SafeString => {
  if (isSafeString(str)) { return str as SafeString; }
  const s = isNonNullish(str) ? String(str) : '';
  return markSafe(escapeHtml(s)) as SafeString;
};

const preserveSafe = (original: unknown, result: string): string =>
  copySafeness(original as object, result) as string;

const requireArrayError = (value: unknown, errorDef: ErrorDefinitionEntry | undefined) =>
  makeFilterError(errorDef, { type: typeof value }, typeof value, `Expected array but got ${typeof value}`);

const requireNumberError = (value: unknown, errorDef: ErrorDefinitionEntry | undefined) =>
  makeFilterError(errorDef, { type: typeof value }, typeof value, `Expected number but got ${typeof value}`);

const assertItemsHaveAttr = (arr: unknown[], attr: string, errorDef: ErrorDefinitionEntry | undefined): void => {
  forEach(arr, (item) => {
    if (item && typeof item === 'object' && !(attr in (item as object))) {
      throw makeFilterError(errorDef, { attr }, attr, `Attribute "${attr}" not found in item`);
    }
  });
};

export { makeFilterError, normalize, safeString, safeHtml, preserveSafe, requireArrayError, requireNumberError, assertItemsHaveAttr };

export { isSafeString } from './types.ts';
