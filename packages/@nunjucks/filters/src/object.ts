import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { isString, isPlainObject } from 'remeda';
import { createLog } from '@nunjucks/log';
import { getAttrGetter } from './attributes.ts';

const isObject = isPlainObject;

type FilterContext = { logContext?: { templateName?: string; phase?: string; renderContext?: unknown } } | undefined;

const getLogContext = (ctx: FilterContext): { templateName: string; phase: string; renderContext: unknown } =>
  (ctx && ctx.logContext) ? { templateName: ctx.logContext.templateName || 'inline', phase: ctx.logContext.phase || 'render', renderContext: ctx.logContext.renderContext ?? null } : { templateName: 'inline', phase: 'render', renderContext: null };

const filterError = (ctx: FilterContext, errorDef: unknown, params: Record<string, unknown>, subject: unknown) => {
  const logContext = getLogContext(ctx);
  return createLog('error', errorDef, params, subject, { phase: logContext.phase, templateName: logContext.templateName, lineBase: 'zero' });
};

export function dictsort(val: unknown, caseSensitive?: boolean, by?: 'key' | 'value'): [string, unknown][] {
  if (!isObject(val)) {
    throw filterError(this, ERROR_DEFINITIONS.DICTSDICT_FILTER, { type: typeof val }, typeof val);
  }

  const obj = val as Record<string, unknown>;
  let array: [string, unknown][] = [];
  for (const k in obj) {
    array.push([k, obj[k]]);
  }

  let si: 0 | 1;
  if (by === undefined || by === 'key') {
    si = 0;
  } else if (by === 'value') {
    si = 1;
  } else {
    throw filterError(this, ERROR_DEFINITIONS.DICTSDICT_FILTER_BY, { by }, by);
  }

  array = array.toSorted((t1, t2) => {
    let a: unknown = t1[si];
    let b: unknown = t2[si];

    if (!caseSensitive) {
      if (isString(a)) {
        a = (a as string).toUpperCase();
      }
      if (isString(b)) {
        b = (b as string).toUpperCase();
      }
    }

    return a > b ? 1 : (a === b ? 0 : -1);
  });

  return array;
}

export function groupby(arr: unknown, attr: string): Record<string, unknown[]> {
  if (!arr || !Array.isArray(arr)) {
    throw filterError(this, ERROR_DEFINITIONS.GROUPBY_FILTER, { type: typeof arr }, typeof arr);
  }

  for (const item of arr) {
    if (item && typeof item === 'object' && !(attr in (item as object))) {
      throw filterError(this, ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR, { attr }, attr);
    }
  }

  const getAttr = getAttrGetter(attr);

  return Object.groupBy(arr as object[], (item, i) => {
    const key = getAttr(item as Record<string, unknown>, i);
    if (key === undefined) {
      throw filterError(this, ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR, { attr }, attr);
    }
    return String(key);
  });
}
