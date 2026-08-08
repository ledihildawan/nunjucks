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

interface FilterErrorInput {
  ctx: FilterContext;
  errorDef: ErrorDefinitionEntry;
  params: Record<string, string>;
  subject: string;
}

const filterError = ({ ctx, errorDef, params, subject }: FilterErrorInput) => {
  const logContext = getLogContext(ctx);
  return createLog('error', errorDef, params, subject, { phase: logContext.phase, templateName: logContext.templateName, lineBase: 'zero' });
};

interface MakeFilterErrorInput {
  errorDef: ErrorDefinitionEntry | undefined;
  params: Record<string, string>;
  subject: string;
  fallbackMessage: string;
}

const makeFilterError = ({ errorDef, params, subject, fallbackMessage }: MakeFilterErrorInput) => {
  if (errorDef) {
    return filterError({ ctx: undefined, errorDef, params, subject });
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
  if (isSafeString(str)) { return str; }
  const s = isNonNullish(str) ? String(str) : '';
  return markSafe(s) as SafeString;
};

const safeHtml = (str: unknown): SafeString => {
  if (isSafeString(str)) { return str; }
  const s = isNonNullish(str) ? String(str) : '';
  return markSafe(escapeHtml(s)) as SafeString;
};

const preserveSafe = (original: unknown, result: string): string =>
  copySafeness(original as object, result) as string;

const requireArrayError = (value: unknown, errorDef: ErrorDefinitionEntry | undefined) =>
  makeFilterError({ errorDef, params: { type: typeof value }, subject: typeof value, fallbackMessage: `Expected array but got ${typeof value}` });

const requireNumberError = (value: unknown, errorDef: ErrorDefinitionEntry | undefined) =>
  makeFilterError({ errorDef, params: { type: typeof value }, subject: typeof value, fallbackMessage: `Expected number but got ${typeof value}` });

const assertItemsHaveAttr: <T>(items: unknown[], attr: string, errorDef: ErrorDefinitionEntry | undefined) => asserts items is Record<string, T>[] = (items, attr, errorDef) => {
  forEach(items, (item) => {
    if (item === null || typeof item !== 'object' || !(attr in item)) {
      throw makeFilterError({ errorDef, params: { attr }, subject: attr, fallbackMessage: `Attribute "${attr}" not found in item` });
    }
  });
};

export { makeFilterError, normalize, safeString, safeHtml, preserveSafe, requireArrayError, requireNumberError, assertItemsHaveAttr };

export { isSafeString } from './types.ts';
