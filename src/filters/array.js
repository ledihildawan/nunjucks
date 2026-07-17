import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';
import { isArray, isString, isPlainObject, map, keys, entries, sum as sumValues } from 'remeda';
import { isSafeString, copySafeness, makeMacro } from '../runtime/index.js';
import { getAttrGetter } from '../helpers/attributes.js';
import { normalize } from './string.js';

const getLogContext = (ctx) => (ctx && ctx.logContext) ? ctx.logContext : { templateName: 'inline', phase: 'render', renderContext: null };

const filterError = (ctx, errorDef, params, subject) => {
  const logContext = getLogContext(ctx);
  return createLog('error', errorDef, params, subject, { phase: logContext.phase || 'render', templateName: logContext.templateName || 'inline', lineBase: 'zero' });
};

export function batch(arr, linecount, fillWith) {
  let i;
  const res = [];
  let tmp = [];

  for (i = 0; i < arr.length; i++) {
    if (i % linecount === 0 && tmp.length) {
      res.push(tmp);
      tmp = [];
    }

    tmp.push(arr[i]);
  }

  if (tmp.length) {
    if (fillWith) {
      for (i = tmp.length; i < linecount; i++) {
        tmp.push(fillWith);
      }
    }

    res.push(tmp);
  }

  return res;
}

export function first(arr) {
  return arr[0];
}

export function last(arr) {
  return arr.at(-1);
}

export function lengthFilter(val) {
  const value = normalize(val, '');

  if (value !== undefined) {
    if (
      (typeof Map === 'function' && value instanceof Map) ||
      (typeof Set === 'function' && value instanceof Set)
    ) {
      return value.size;
    }
    if (isPlainObject(value) && !isSafeString(value)) {
      return keys(value).length;
    }
    return value.length;
  }
  return 0;
}

export function list(val) {
  if (isString(val)) {
    return val.split('');
  } else if (isPlainObject(val)) {
    return entries(val || {}).map(([key, value]) => ({key, value}));
  } else if (isArray(val)) {
    return val;
  } else {
    throw filterError(this, ERROR_DEFINITIONS.LIST_FILTER, { type: typeof val }, typeof val);
  }
}

export function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function reverse(val) {
  let arr;
  if (isString(val)) {
    arr = list(val);
  } else {
    arr = map(val, v => v);
  }

  arr = arr.toReversed();

  if (isString(val)) {
    return copySafeness(val, arr.join(''));
  }
  return arr;
}

export function slice(arr, slices, fillWith) {
  const sliceLength = Math.floor(arr.length / slices);
  const extra = arr.length % slices;
  const res = [];
  let offset = 0;

  for (let i = 0; i < slices; i++) {
    const start = offset + (i * sliceLength);
    if (i < extra) {
      offset++;
    }
    const end = offset + ((i + 1) * sliceLength);

    const currSlice = arr.slice(start, end);
    if (fillWith && i >= extra) {
      currSlice.push(fillWith);
    }
    res.push(currSlice);
  }

  return res;
}

export function sum(arr, attr, start = 0) {
  if (attr) {
    arr = map(arr, (v) => v[attr]);
  }

  return start + sumValues(arr);
}

export const sort = makeMacro(
  ['value', 'reverse', 'case_sensitive', 'attribute'], [],
  function sortFilter(arr, reversed, caseSens, attr) {
    if (!arr || !Array.isArray(arr)) {
      throw filterError(this, ERROR_DEFINITIONS.SORT_FILTER, { type: typeof arr }, typeof arr);
    }

    // Handle positional args: sort(items, attr) or sort(items, attr, reverse)
    // The attribute can be passed as 2nd arg (string) or 4th arg (keyword)
    let sortAttr = attr;
    let sortReverse = reversed;
    if (typeof reversed === 'string') {
      sortAttr = reversed;
      sortReverse = caseSens;
    }

    if (sortAttr) {
      for (const item of arr) {
        if (item && typeof item === 'object' && !(sortAttr in item)) {
          throw filterError(this, ERROR_DEFINITIONS.SORT_FILTER_ATTR, { attr: sortAttr }, sortAttr);
        }
      }
    }

    let array = map(arr, v => v);
    let getAttribute = getAttrGetter(sortAttr);

    array = array.toSorted((a, b) => {
      let x = (sortAttr) ? getAttribute(a) : a;
      let y = (sortAttr) ? getAttribute(b) : b;

      if (!caseSens && isString(x) && isString(y)) {
        x = x.toLowerCase();
        y = y.toLowerCase();
      }

      if (x < y) {
        return sortReverse ? 1 : -1;
      } else if (x > y) {
        return sortReverse ? -1 : 1;
      } else {
        return 0;
      }
    });

    return array;
  });

export function getSelectOrReject(expectedTestResult) {
  function filter(arr, testName = 'truthy', secondArg) {
    const context = this;
    const test = context.env.getTest(testName);

    return Array.from(arr).filter((item) => {
      return test.call(context, item, secondArg) === expectedTestResult;
    });
  }

  return filter;
}

export const reject = getSelectOrReject(false);

export function rejectattr(arr, attr) {
  return arr.filter((item) => !item[attr]);
}

export const select = getSelectOrReject(true);

export function selectattr(arr, attr) {
  return arr.filter((item) => Boolean(item[attr]));
}
