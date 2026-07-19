import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { isNonNullish, isFunction } from 'remeda';

const NULL_MARKER = '__nunjucks_null__';
const PARENT_NAME = '__nunjucks_parent__';
const ACCESS_PATH = '__access_path__';
const PROP_NOT_FOUND = '__nunjucks_prop_not_found__';

export function memberLookup(obj, val, parentName = null) {
  if (obj == null) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val };
  }

  if (!Object.prototype.hasOwnProperty.call(obj, val) && !(val in obj)) {
    const marker = { [PROP_NOT_FOUND]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val };
    const callable = () => undefined;
    Object.setPrototypeOf(callable, null);
    Object.assign(callable, marker);
    return callable;
  }

  if (isFunction(obj[val])) {
    return (...args) => obj[val].apply(obj, args);
  }

  return obj[val];
}

export function isNullAccessResult(val) {
  return val && typeof val === 'object' && val[NULL_MARKER] === true;
}

export function isPropertyNotFoundResult(val) {
  return val && (val[PROP_NOT_FOUND] === true);
}

export function getNullParentName(val) {
  return val && val[PARENT_NAME];
}

export function getAccessPath(val) {
  return val && val[ACCESS_PATH];
}

export function optionalMemberLookup(obj, val, parentName = null) {
  if (obj == null) {
    return undefined;
  }

  if (!Object.prototype.hasOwnProperty.call(obj, val) && !(val in obj)) {
    return undefined;
  }

  if (isFunction(obj[val])) {
    return (...args) => obj[val].apply(obj, args);
  }

  return obj[val];
}

export function slice(arr, start, stop, step) {
  if (step === 0) {
    throw createLog('error', ERROR_DEFINITIONS.SLICE_STEP, {}, 'step', { phase: 'render', lineBase: 'zero' });
  }

  const len = arr.length;

  if (!isNonNullish(start)) {
    start = (step < 0) ? len - 1 : 0;
  }
  if (!isNonNullish(stop)) {
    stop = (step < 0) ? -1 : len;
  }

  const normalizeStart = (idx) => {
    if (idx < 0) return Math.max(0, len + idx);
    return Math.min(len, idx);
  };

  start = normalizeStart(start);

  if (!isNonNullish(step) || step === 1) {
    return arr.slice(start, stop);
  }

  if (step > 0) {
    const result = [];
    for (let i = start; i < stop; i += step) {
      result.push(arr[i]);
    }
    return result;
  } else {
    const result = [];
    for (let i = start; i >= 0 && i > stop; i += step) {
      result.push(arr[i]);
    }
    return result;
  }
}

export function nullishCoalesce(left, right) {
  return isNonNullish(left) ? left : right;
}
