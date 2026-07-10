import { isString, isPlainObject, groupBy } from 'remeda';
import { createTemplateError } from '../error/index.js';
import { getAttrGetter } from '../helpers/attributes.js';

const isObject = isPlainObject;

export function dictsort(val, caseSensitive, by) {
  if (!isObject(val)) {
    throw createTemplateError('dictsort filter: val must be an object');
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
    throw createTemplateError(
      'dictsort filter: You can only sort by either key or value');
  }

  array.sort((t1, t2) => {
    var a = t1[si];
    var b = t2[si];

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
  const undefinedMode = this.env.opts.undefined;
  const getAttr = getAttrGetter(attr);

  return groupBy(arr, (item, i) => {
    const key = getAttr(item, i);
    if (key === undefined) {
      if (undefinedMode === 'strict') {
        throw new TypeError(`groupby: attribute "${attr}" resolved to undefined`);
      }
      return String(key);
    }
    return key;
  });
}
