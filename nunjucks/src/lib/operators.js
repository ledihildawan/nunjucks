import { isArray, isString, isObject } from './types.js';

export function inOperator(key, val) {
  if (isArray(val) || isString(val)) {
    return val.indexOf(key) !== -1;
  } else if (isObject(val)) {
    return key in val;
  }
  throw new Error('Cannot use "in" operator to search for "'
    + key + '" in unexpected types.');
}
