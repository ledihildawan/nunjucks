import { isArray, isString, isPlainObject, map, keys, entries } from 'remeda';
import { isSafeString, copySafeness, makeMacro } from '../runtime/index.js';
import { getAttrGetter } from '../helpers/attributes.js';
import { normalize } from './string.js';

export function batch(arr, linecount, fillWith) {
  var i;
  var res = [];
  var tmp = [];

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
  return arr[arr.length - 1];
}

export function lengthFilter(val) {
  var value = normalize(val, '');

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
    throw new Error('list filter: type not iterable');
  }
}

export function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function reverse(val) {
  var arr;
  if (isString(val)) {
    arr = list(val);
  } else {
    arr = map(val, v => v);
  }

  arr.reverse();

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

  return start + arr.reduce((a, b) => a + b, 0);
}

export const sort = makeMacro(
  ['value', 'reverse', 'case_sensitive', 'attribute'], [],
  function sortFilter(arr, reversed, caseSens, attr) {
    let array = map(arr, v => v);
    let getAttribute = getAttrGetter(attr);

    array.sort((a, b) => {
      let x = (attr) ? getAttribute(a) : a;
      let y = (attr) ? getAttribute(b) : b;

      if (
        this.env.opts.throwOnUndefined &&
        attr && (x === undefined || y === undefined)
      ) {
        throw new TypeError(`sort: attribute "${attr}" resolved to undefined`);
      }

      if (!caseSens && isString(x) && isString(y)) {
        x = x.toLowerCase();
        y = y.toLowerCase();
      }

      if (x < y) {
        return reversed ? 1 : -1;
      } else if (x > y) {
        return reversed ? -1 : 1;
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

    return Array.from(arr).filter(function examineTestResult(item) {
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
  return arr.filter((item) => !!item[attr]);
}
