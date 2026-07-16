import { isString, isPlainObject, groupBy } from 'remeda';
import { createLog } from '@nunjucks/log';
import { getAttrGetter } from '../helpers/attributes.js';

const isObject = isPlainObject;

export function dictsort(val, caseSensitive, by) {
  if (!isObject(val)) {
    throw createLog('error', {
      message: 'dictsort filter: val must be an object',
      lineno: 0,
      colno: 0
    });
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
    throw createLog('error', {
      message: 'dictsort filter: You can only sort by either key or value',
      lineno: 0,
      colno: 0
    });
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
    throw new TypeError('groupby: first argument must be an array');
  }

  for (const item of arr) {
    if (item && typeof item === 'object' && !(attr in item)) {
      throw new TypeError(`groupby: attribute "${attr}" resolved to undefined`);
    }
  }

  const getAttr = getAttrGetter(attr);

  return groupBy(arr, (item, i) => {
    const key = getAttr(item, i);
    if (key === undefined) {
      throw new TypeError(`groupby: attribute "${attr}" resolved to undefined`);
    }
    return key;
  });
}
