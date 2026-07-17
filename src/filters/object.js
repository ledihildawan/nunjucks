import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';
import { isString, isPlainObject, groupBy } from 'remeda';
import { createLog } from '@nunjucks/log';
import { getAttrGetter } from '../helpers/attributes.js';

const isObject = isPlainObject;

const getLogContext = (ctx) => (ctx && ctx.logContext) ? ctx.logContext : { templateName: 'inline', phase: 'render', renderContext: null };

const filterError = (ctx, errorDef, params, subject) => {
  const logContext = getLogContext(ctx);
  return createLog('error', errorDef, params, subject, { phase: logContext.phase || 'render', templateName: logContext.templateName || 'inline', lineBase: 'zero' });
};

export function dictsort(val, caseSensitive, by) {
  if (!isObject(val)) {
    throw filterError(this, ERROR_DEFINITIONS.DICTSDICT_FILTER, { type: typeof val }, typeof val);
  }

  let array = [];
  for (let k in val) {
    array.push([k, val[k]]);
  }

  let si;
  if (by === undefined || by === 'key') {
    si = 0;
  } else if (by === 'value') {
    si = 1;
  } else {
    throw filterError(this, ERROR_DEFINITIONS.DICTSDICT_FILTER_BY, { by }, by);
  }

  array = array.toSorted((t1, t2) => {
    let a = t1[si];
    let b = t2[si];

    if (!caseSensitive) {
      if (isString(a)) {
        a = a.toUpperCase();
      }
      if (isString(b)) {
        b = b.toUpperCase();
      }
    }

    return a > b ? 1 : (a === b ? 0 : -1);
  });

  return array;
}

export function groupby(arr, attr) {
  if (!arr || !Array.isArray(arr)) {
    throw filterError(this, ERROR_DEFINITIONS.GROUPBY_FILTER, { type: typeof arr }, typeof arr);
  }

  for (const item of arr) {
    if (item && typeof item === 'object' && !(attr in item)) {
      throw filterError(this, ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR, { attr }, attr);
    }
  }

  const getAttr = getAttrGetter(attr);

  return groupBy(arr, (item, i) => {
    const key = getAttr(item, i);
    if (key === undefined) {
      throw filterError(this, ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR, { attr }, attr);
    }
    return key;
  });
}
